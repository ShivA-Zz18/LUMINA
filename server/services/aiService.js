const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
require('dotenv').config();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "YOUR_OPENROUTER_API_KEY", // Get this from openrouter.ai
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const backoffDelays = [5000, 10000, 20000];

const callAIPipeline = async (prompt, modelName = 'meta-llama/llama-3-8b-instruct:free', retries = 3) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: modelName,
        response_format: { type: 'json_object' }
      });
      return JSON.parse(completion.choices[0]?.message?.content || '{}');
    } catch (error) {
      if (error.status === 429 || error.status >= 500 || (error.message && error.message.toLowerCase().includes('rate limit'))) {
        logger.warn(`OpenRouter limit reached (Attempt ${i + 1}/${retries + 1}): ${error.message}`);
        if (i < retries) {
          const waitTime = backoffDelays[i] || 20000;
          logger.info(`Waiting ${waitTime}ms before retry...`);
          await delay(waitTime);
          continue;
        } else {
          logger.info('OpenRouter exhausted. Failing over to Gemini 1.5 Flash...');
          try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig: { responseMimeType: "application/json" } });
            const result = await model.generateContent(prompt);
            let rawText = result.response.text();
            rawText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
            return JSON.parse(rawText || '{}');
          } catch (geminiError) {
            logger.error(`Gemini failover also failed: ${geminiError.message}`);
            throw new Error('Both AI pipelines failed');
          }
        }
      } else {
        throw error;
      }
    }
  }
};

const smartSummarizeJob = async (jobData, userProfile, userLanguage = 'English', userLocation = 'Karnataka', searchIntent = '') => {
  let localAdvantage = null;

  const jobText = (jobData.title + ' ' + (jobData.description||'') + ' ' + (jobData.qualifications||'')).toLowerCase();
  
  if (jobText.includes('karnataka') || jobText.includes('bangalore') || jobText.includes('mangalore') || jobText.includes('udupi') || jobText.includes('dakshina kannada') || userLocation !== 'Global') {
    localAdvantage = 'Karnataka Region Role';
  }

  const prompt = `
    You are an expert career counselor in India.
    Analyze the following job details against the User's Search Intent and Profile, then provide a structured JSON response.

    [USER SEARCH INTENT]
    Search Query: "${searchIntent}"
    
    [USER PROFILE]
    Degree: ${userProfile.degree || 'Student'}
    Skills: ${Array.isArray(userProfile.skills) ? userProfile.skills.join(', ') : userProfile.skills || 'None'}
    Preferred Role: ${userProfile.preferredRole || 'Any Entry Level'}
    Location: ${userLocation}

    [JOB DETAILS]
    Job Title: ${jobData.title || 'N/A'}
    Sector: ${jobData.sector || 'Private'}
    Source: ${jobData.source || 'N/A'}
    Qualifications required: ${jobData.qualifications || 'N/A'}
    Job Description: ${jobData.description || 'N/A'}

    [LOGIC INSTRUCTIONS]
    1. calculate an "eligibility_score" (0-100). The HIGHEST MATCHING factor is how well the job relates to the User's Search Query ("${searchIntent}"). If it matches well, score 90-100. If it doesn't match, score < 40.
    2. Write a 2-sentence summary. You MUST generate THIS SAME SUMMARY simultaneously in ALL THREE LANGUAGES: English, Hindi, and Kannada!
    3. PIVOT DETECTION: If the job is in a completely different industry than the user's profile, include the phrase "You are eligible, but this is a career pivot" inside all three summaries natively.

    You must output ONLY a valid JSON object with EXACTLY this schema:
    {
      "title": "<Extract actual job title here>",
      "eligibility_score": <number 0-100>,
      "summary_english": "<2-sentence summary strictly in English>",
      "summary_hindi": "<2-sentence summary strictly in Hindi>",
      "summary_kannada": "<2-sentence summary strictly in Kannada>",
      "apply_link": "${jobData.url || ''}",
      "last_date": "${jobData.last_date || 'Not Specified'}",
      "source_reliability_rating": "High/Medium/Low",
      "local_advantage": ${localAdvantage ? `"${localAdvantage}"` : `null`},
      "sector": "${jobData.sector || 'Private'}"
    }
  `;

  try {
    const result = await callAIPipeline(prompt);
    
    if (!result.local_advantage && localAdvantage) {
      result.local_advantage = localAdvantage;
    }
    
    if (result.title === '<Extract actual job title here>') {
      result.title = jobData.title;
    }
    
    return result;
  } catch (err) {
    logger.error(`SmartSummarizer failed for job: ${jobData.title}. Error: ${err.message}`);
    return {
      title: jobData.title,
      eligibility_score: 50, // Neutral fallback score
      summary_english: 'Summary unavailable',
      summary_hindi: 'Summary unavailable',
      summary_kannada: 'Summary unavailable',
      apply_link: jobData.url,
      last_date: jobData.last_date || 'Not Specified',
      source_reliability_rating: 'Medium',
      local_advantage: localAdvantage,
      sector: jobData.sector || 'Private'
    };
  }
};

module.exports = { smartSummarizeJob };
