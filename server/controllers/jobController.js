'use strict';

const NodeCache = require('node-cache');
const { scrapeSarkariResultNaukri, scrapeIndGovtJobs } = require('../services/scraperService');
const { aggregateJobs } = require('../services/aggregatorService');
const { smartSummarizeJobBatch } = require('../services/aiService');
const logger = require('../utils/logger');

/** @type {NodeCache} In-memory cache for job results. TTL: 1 hour. */
const jobCache = new NodeCache({ stdTTL: 3600 });

/**
 * Mock user profile used for generating contextual eligibility scores.
 * In production, replace this with authenticated user data from the session/DB.
 * @constant {Object}
 */
const CANDIDATE_PROFILE = {
  degree: 'BCA (Bachelor of Computer Applications)',
  college: "Alva's College",
  skills: ['HTML', 'CSS', 'React', 'Node.js'],
  preferredRole: 'Junior Engineer, IT Support',
};

/**
 * Regional localities that are normalized to the 'Dakshina Kannada' district
 * for more accurate regional job matching.
 * @constant {string[]}
 */
const DAKSHINA_KANNADA_LOCALITIES = ['Moodbidri', 'Mangalore'];

/**
 * Retrieves, AI-summarizes, and returns a paginated list of government jobs.
 *
 * Flow:
 * 1. Checks the in-memory cache for a previously computed result.
 * 2. If a cache miss occurs, scrapes relevant job boards based on the search intent and location.
 * 3. Aggregates raw scraped data with the `aggregatorService`.
 * 4. Pipes each job sequentially through the AI summarization pipeline with 2s throttle delays
 *    to prevent 429 Rate Limit errors.
 * 5. Filters, sorts by eligibility score, caches, and returns the final result.
 *
 * @async
 * @param {import('express').Request} req - Express Request. Accepts `keyword`, `language`, and `location` as query params.
 * @param {import('express').Response} res - Express Response.
 * @returns {Promise<void>} JSON response with `success`, `source`, `count`, `language`, `location`, and `data` fields.
 * @throws Will return HTTP 500 if the top-level scraping or aggregation pipeline fails.
 */
const getJobs = async (req, res) => {
  try {
    let { keyword = '', language = 'Kannada', location = 'Karnataka' } = req.query;

    keyword = keyword.trim();
    const searchIntent = keyword === '' ? 'Latest Jobs in India' : keyword;

    // Normalize regional sub-districts to their parent district for broader matching.
    const resolvedLocation = DAKSHINA_KANNADA_LOCALITIES.includes(location)
      ? 'Dakshina Kannada'
      : location;

    const cacheKey = `jobs_${searchIntent}_${resolvedLocation}_${language}`;
    const cachedJobMissions = jobCache.get(cacheKey);

    if (cachedJobMissions) {
      logger.info(`Cache hit: returning ${cachedJobMissions.length} jobs for [${searchIntent}] in [${resolvedLocation}]`);
      return res.status(200).json({
        success: true,
        source: 'cache',
        count: cachedJobMissions.length,
        language,
        location: resolvedLocation,
        data: cachedJobMissions,
      });
    }

    logger.info(`Cache miss: fetching fresh jobs for [${searchIntent}] in [${resolvedLocation}]`);

    let harvestedJobListings = [];

    // Activate regional scrapers for Karnataka-centric or government-sector searches.
    const isRegionalOrGovtSearch =
      searchIntent === 'Latest Jobs in India' ||
      ['Karnataka', 'Dakshina Kannada', 'Udupi'].includes(resolvedLocation) ||
      searchIntent.toLowerCase().includes('govt');

    if (isRegionalOrGovtSearch) {
      logger.info('Activating regional job scrapers (SarkariResult, IndGovt)...');
      const [sarkariNaukriJobs, indGovtJobs] = await Promise.all([
        scrapeSarkariResultNaukri(searchIntent),
        scrapeIndGovtJobs(searchIntent),
      ]);
      harvestedJobListings.push(...sarkariNaukriJobs, ...indGovtJobs);
    }

    const aggregatedJobPayloads = await aggregateJobs(searchIntent, resolvedLocation, harvestedJobListings);

    // Cap at 12 jobs to provide more results while preserving AI provider daily token quotas.
    const jobBatchForInference = aggregatedJobPayloads.slice(0, 12);
    logger.info(`Dispatching ${jobBatchForInference.length} jobs to the AI summarization pipeline...`);

    const summarizedJobResults = await smartSummarizeJobBatch(
      jobBatchForInference,
      CANDIDATE_PROFILE,
      language,
      resolvedLocation,
      searchIntent
    );

    // Filter out malformed or placeholder job entries before caching.
    const inferencePayload = summarizedJobResults.filter(
      (j) => j && j.title && j.title !== 'N/A' && !j.title.includes('Cleaned up')
    );

    // Sort descending by eligibility score to surface the most relevant roles first.
    inferencePayload.sort((a, b) => (b.eligibility_score || 0) - (a.eligibility_score || 0));

    jobCache.set(cacheKey, inferencePayload);
    logger.info(`Cached ${inferencePayload.length} jobs for key: ${cacheKey}`);

    return res.status(200).json({
      success: true,
      source: 'api',
      count: inferencePayload.length,
      language,
      location: resolvedLocation,
      data: inferencePayload,
    });
  } catch (error) {
    logger.error(`Job retrieval pipeline failure: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, message: 'Failed to retrieve jobs.' });
  }
};

module.exports = { getJobs };
