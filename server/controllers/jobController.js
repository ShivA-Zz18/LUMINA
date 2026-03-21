const NodeCache = require('node-cache');
const { scrapeSarkariResultNaukri, scrapeIndGovtJobs } = require('../services/scraperService');
const { aggregateJobs } = require('../services/aggregatorService');
const { smartSummarizeJob } = require('../services/aiService');
const logger = require('../utils/logger');

const jobCache = new NodeCache({ stdTTL: 3600 });

const MOCK_USER_PROFILE = {
  degree: "BCA (Bachelor of Computer Applications)",
  college: "Alva's College",
  skills: ["HTML", "CSS", "React", "Node.js"],
  preferredRole: "Junior Engineer, IT Support"
};

const getJobs = async (req, res) => {
  try {
    let { keyword = '', language = 'Kannada', location = 'Karnataka' } = req.query;
    
    keyword = keyword.trim();
    const searchIntent = keyword === '' ? 'Latest Jobs in India' : keyword;
    
    let resolvedLocation = location;
    if (['Moodbidri', 'Mangalore'].includes(location)) {
      resolvedLocation = 'Dakshina Kannada';
    }

    const cacheKey = `jobs_${searchIntent}_${resolvedLocation}_${language}`;
    const cachedData = jobCache.get(cacheKey);
    
    if (cachedData) {
      logger.info(`Returning cached jobs for ${searchIntent} in ${resolvedLocation}`);
      return res.status(200).json({ success: true, source: 'cache', count: cachedData.length, language, location: resolvedLocation, data: cachedData });
    }

    logger.info(`Fetching fresh jobs for [${searchIntent}] in [${resolvedLocation}]`);

    let scrapedJobs = [];
    
    if (searchIntent === 'Latest Jobs in India' || resolvedLocation === 'Karnataka' || resolvedLocation === 'Dakshina Kannada' || resolvedLocation === 'Udupi' || searchIntent.toLowerCase().includes('govt')) {
      logger.info('Running Regional Scrapers...');
      
      const [sarkariNaukriJobs, indGovtJobs] = await Promise.all([
        scrapeSarkariResultNaukri(searchIntent),
        scrapeIndGovtJobs(searchIntent)
      ]);
      
      scrapedJobs.push(...sarkariNaukriJobs, ...indGovtJobs);
    }

    const allJobs = await aggregateJobs(searchIntent, resolvedLocation, scrapedJobs);

    // Reduced to 8 to preserve AI daily tokens and prevent hard 429 limits
    const jobsToProcess = allJobs.slice(0, 8);
    logger.info(`Sending ${jobsToProcess.length} jobs to AI pipeline for summarization...`);
    
    const finalJobs = [];
    
    // Sequential Processing: Processing jobs in a strict serial loop to stop hitting AI 429 limits
    for (let i = 0; i < jobsToProcess.length; i++) {
      const job = jobsToProcess[i];
      try {
        const summarizedJob = await smartSummarizeJob(job, MOCK_USER_PROFILE, language, resolvedLocation, searchIntent);
        if (summarizedJob) {
          finalJobs.push(summarizedJob);
        }
      } catch (err) {
        logger.error(`Error processing job sequentially: ${err.message}`);
      }
      
      // Request Throttling: Mandatory 2000ms delay between AI calls
      if (i < jobsToProcess.length - 1) {
         logger.info(`Throttling: Waiting 2000ms before next AI call...`);
         await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const validJobs = finalJobs.filter(j => j && j.title && j.title !== 'N/A' && !j.title.includes('Cleaned up'));

    // Sort to prioritize high relevance jobs tailored to the specific search query at the top
    validJobs.sort((a, b) => (b.eligibility_score || 0) - (a.eligibility_score || 0));

    jobCache.set(cacheKey, validJobs);

    return res.status(200).json({
      success: true,
      source: 'api',
      count: validJobs.length,
      language,
      location: resolvedLocation,
      data: validJobs
    });

  } catch (error) {
    logger.error(`Job retrieval error: ${error.message}`, { stack: error.stack });
    return res.status(500).json({ success: false, message: 'Failed to retrieve jobs.' });
  }
};

module.exports = { getJobs };
