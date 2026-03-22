'use strict';

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Groq } = require('groq-sdk');
const logger = require('../utils/logger');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// AI PROVIDER CLIENTS (Single Source of Truth)
// Primary:  OpenRouter (free-tier LLM models via OpenAI-compatible API)
// Failover: Google Gemini 1.5 Flash
// ─────────────────────────────────────────────────────────────────────────────

const openRouterClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const githubModelsClient = process.env.GITHUB_TOKEN ? new OpenAI({
  baseURL: 'https://models.inference.ai.azure.com',
  apiKey: process.env.GITHUB_TOKEN,
}) : null;

const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

/**
 * Prioritized list of OpenRouter free-tier models to attempt in sequence.
 * The pipeline tries each model from first to last, skipping any that return 404.
 * Update this list when models are deprecated — check https://openrouter.ai/models?q=free
 *
 * @constant {string[]}
 */
const FREE_TIER_MODEL_PRIORITY_LIST = [
  'meta-llama/llama-3.3-70b-instruct:free',  // Confirmed active March 2026
  'meta-llama/llama-3.2-3b-instruct:free',   // Lightweight fallback
  'google/gemma-3-27b-it:free',              // Google Gemma — stable free tier
  'google/gemma-3-12b-it:free',              // Smaller Gemma variant
];

/**
 * Gemini failover model, activated when the entire OpenRouter pipeline is exhausted.
 * @constant {string}
 */
const GEMINI_FAILOVER_MODEL = 'gemini-1.5-flash';

/**
 * Exponential backoff delay intervals (in ms) for retrying rate-limited AI calls.
 * Index corresponds to the retry attempt: [attempt-1, attempt-2, attempt-3].
 * @constant {number[]}
 */
const BACKOFF_SCHEDULE_MS = [5000, 10000, 20000];

/**
 * Utility: returns a promise that resolves after `ms` milliseconds.
 *
 * @param {number} ms - Duration to wait in milliseconds.
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Core AI inference pipeline with model-level fallback, exponential backoff, and Gemini failover.
 *
 * Attempt order:
 * 1. PRIMARY_INFERENCE_MODEL (mistral-7b-instruct:free)
 * 2. SECONDARY_INFERENCE_MODEL (mistral-nemo:free) — only if primary returns 404
 * 3. Exponential backoff retries on 429/5xx
 * 4. GEMINI_FAILOVER_MODEL — activated when all OpenRouter retries are exhausted
 *
 * @async
 * @param {string} aiInferencePrompt - The full prompt to send to the AI model.
 * @param {string} [modelName=PRIMARY_INFERENCE_MODEL] - The OpenRouter model identifier to use.
 * @param {number} [maxRetries=3] - Maximum retry attempts before triggering Gemini failover.
 * @returns {Promise<Object>} Parsed JSON object returned by the AI model.
 * @throws {Error} Throws if both the OpenRouter pipeline and Gemini failover both fail.
 */
const callAIPipeline = async (
  aiInferencePrompt,
  modelName = null,
  maxRetries = 3
) => {
  let lastProviderError = null;

  // ── 0. Try GitHub Models (Unlimited Quota, Highest Reliability) ────────
  if (githubModelsClient) {
    try {
      const githubCompletion = await githubModelsClient.chat.completions.create({
        messages: [{ role: 'user', content: aiInferencePrompt }],
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
      });
      return JSON.parse(githubCompletion.choices[0]?.message?.content || '{}');
    } catch (githubError) {
      logger.warn(`GitHub Models primary inference failed: ${githubError.message}. Falling back to Groq...`);
      lastProviderError = githubError;
    }
  }

  // ── 1. Try Groq (High Speed Llama) ───────────────────────────────────────
  if (groqClient) {
    try {
      const groqCompletion = await groqClient.chat.completions.create({
        messages: [{ role: 'user', content: aiInferencePrompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
      });
      return JSON.parse(groqCompletion.choices[0]?.message?.content || '{}');
    } catch (groqError) {
      logger.warn(`Groq inference failed: ${groqError.message}. Falling back to OpenRouter...`);
      lastProviderError = groqError;
    }
  }

  // Use the caller's model if specified, otherwise walk the full priority list.
  const modelsToAttempt = modelName ? [modelName] : [...FREE_TIER_MODEL_PRIORITY_LIST];

  for (const currentModel of modelsToAttempt) {
    // ── Per-model attempt with exponential backoff for rate-limit errors ──
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const completion = await openRouterClient.chat.completions.create({
          messages: [{ role: 'user', content: aiInferencePrompt }],
          model: currentModel,
          response_format: { type: 'json_object' },
        });
        return JSON.parse(completion.choices[0]?.message?.content || '{}');
      } catch (providerError) {
        // 404 = model endpoint removed from OpenRouter — skip to next model immediately.
        if (providerError.status === 404) {
          logger.warn(`OpenRouter model '${currentModel}' returned 404 (endpoint removed). Trying next...`);
          break;
        }

        const isRetryable =
          providerError.status === 429 ||
          providerError.status >= 500 ||
          providerError.message?.toLowerCase().includes('rate limit');

        if (!isRetryable) {
          throw providerError;
        }

        logger.warn(`OpenRouter rate-limited on '${currentModel}' (attempt ${attempt + 1}/${maxRetries + 1}): ${providerError.message}`);
        lastProviderError = providerError;

        if (attempt < maxRetries) {
          const backoffMs = BACKOFF_SCHEDULE_MS[attempt] || 20000;
          logger.info(`Backoff: waiting ${backoffMs}ms before retry attempt ${attempt + 2}...`);
          await delay(backoffMs);
        }
      }
    }
  }

  // ── All OpenRouter models failed — activate Gemini failover ──────────────
  logger.info('All OpenRouter models exhausted. Activating Gemini 1.5 Flash failover...');
  try {
    const geminiModel = geminiClient.getGenerativeModel({
      model: GEMINI_FAILOVER_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });
    const geminiResponse = await geminiModel.generateContent(aiInferencePrompt);
    const rawGeminiText = geminiResponse.response
      .text()
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .trim();
    return JSON.parse(rawGeminiText || '{}');
  } catch (geminiFailoverError) {
    logger.error(`Gemini failover failed: ${geminiFailoverError.message}`);
    throw new Error(
      `Both AI pipelines exhausted. Last OpenRouter error: ${lastProviderError?.message || 'unknown'}. Gemini error: ${geminiFailoverError.message}`
    );
  }
};

const smartSummarizeJobBatch = async (
  jobDataArray,
  candidateProfile,
  userLanguage = 'English',
  userLocation = 'Karnataka',
  searchIntent = ''
) => {
  if (!jobDataArray || jobDataArray.length === 0) return [];
  
  const KARNATAKA_REGION_KEYWORDS = ['karnataka', 'bangalore', 'mangalore', 'udupi', 'dakshina kannada'];
  
  const jobsListStr = jobDataArray.map((job, idx) => {
    const jobTextCorpus = (`${job.title} ${job.description || ''} ${job.qualifications || ''}`).toLowerCase();
    const localAdvantageTag = KARNATAKA_REGION_KEYWORDS.some((kw) => jobTextCorpus.includes(kw)) || userLocation !== 'Global'
        ? 'Karnataka Region Role' : null;
    
    return `[JOB ${idx}]
Title: ${job.title || 'N/A'}
Sector: ${job.sector || 'Private'}
Source: ${job.source || 'N/A'}
Qualifications: ${job.qualifications || 'N/A'}
URL: ${job.url || ''}
Last Date: ${job.last_date || 'Not Specified'}
Local Advantage: ${localAdvantageTag || 'None'}
Description: ${job.description || 'N/A'}`;
  }).join('\n\n');

  const aiInferencePrompt = `
    You are an expert career counselor in India.
    Analyze the following list of ${jobDataArray.length} jobs against the User's Search Intent and Profile, then provide a structured JSON ARRAY response.

    [USER SEARCH INTENT]
    Search Query: "${searchIntent}"

    [USER PROFILE]
    Degree: ${candidateProfile.degree || 'Student'}
    Skills: ${Array.isArray(candidateProfile.skills) ? candidateProfile.skills.join(', ') : candidateProfile.skills || 'None'}
    Preferred Role: ${candidateProfile.preferredRole || 'Any Entry Level'}
    Location: ${userLocation}

    [JOBS LIST]
    ${jobsListStr}

    [LOGIC INSTRUCTIONS]
    1. For EVERY job in the list (0 to ${jobDataArray.length - 1}), calculate an "eligibility_score" (0-100). The HIGHEST scoring factor is match with the Search Query.
    2. Write a 2-sentence summary simultaneously in ALL THREE LANGUAGES: English, Hindi, and Kannada.
    3. PIVOT DETECTION: If the job is in a completely different industry than the user's profile, include the phrase "You are eligible, but this is a career pivot" in all three summaries.

    Return ONLY a valid JSON object with EXACTLY this schema:
    {
      "summarized_jobs": [
        {
          "id": <Job Index Number>,
          "title": "<Actual job title>",
          "eligibility_score": <number 0-100>,
          "summary_english": "<2-sentence summary strictly in English>",
          "summary_hindi": "<2-sentence summary strictly in Hindi>",
          "summary_kannada": "<2-sentence summary strictly in Kannada>",
          "apply_link": "<URL>",
          "last_date": "<Last Date>",
          "source_reliability_rating": "High/Medium/Low",
          "local_advantage": "<local advantage tag if any, else null>",
          "sector": "<Sector>"
        }
      ]
    }
  `;

  try {
    const extractedData = await callAIPipeline(aiInferencePrompt);
    const results = extractedData.summarized_jobs || [];
    
    // Map outputs back to fallback fields if missing
    return jobDataArray.map((job, idx) => {
      const summary = results.find(r => r.id === idx) || {};
      return {
        title: summary.title && summary.title !== '<Actual job title>' ? summary.title : job.title,
        eligibility_score: summary.eligibility_score || 50,
        summary_english: summary.summary_english || 'Summary unavailable',
        summary_hindi: summary.summary_hindi || 'Summary unavailable',
        summary_kannada: summary.summary_kannada || 'Summary unavailable',
        apply_link: summary.apply_link || job.url,
        last_date: summary.last_date || job.last_date || 'Not Specified',
        source_reliability_rating: summary.source_reliability_rating || 'Medium',
        local_advantage: summary.local_advantage || null,
        sector: summary.sector || job.sector || 'Private',
      };
    });
  } catch (pipelineError) {
    logger.error(`smartSummarizeJobBatch failed: ${pipelineError.message}`);
    // Fallback: return unsummarized basic jobs
    return jobDataArray.map((job) => ({
      title: job.title,
      eligibility_score: 50,
      summary_english: 'Summary unavailable',
      summary_hindi: 'Summary unavailable',
      summary_kannada: 'Summary unavailable',
      apply_link: job.url,
      last_date: job.last_date || 'Not Specified',
      source_reliability_rating: 'Medium',
      local_advantage: null,
      sector: job.sector || 'Private',
    }));
  }
};

module.exports = { smartSummarizeJobBatch };
