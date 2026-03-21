/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║         OLLAMA LOCAL LLM INTEGRATION                      ║
 * ║  Free, Self-Hosted Document Processing & Simplification  ║
 * ║  No API costs, No rate limits, Private data               ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

const axios = require("axios");

// Ollama server configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "neural-chat";
const REQUEST_TIMEOUT = 120000; // 2 minutes for document processing

// ═══════════════════════════════════════════════════════════
// CHECK OLLAMA AVAILABILITY
// ═══════════════════════════════════════════════════════════
async function checkOllamaAvailability() {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });
    console.log(`✅ OLLAMA: Server is running at ${OLLAMA_BASE_URL}`);
    console.log(`📦 Available models: ${response.data.models?.length || 0} found`);
    return true;
  } catch (error) {
    console.warn(`⚠️ OLLAMA: Server not responding at ${OLLAMA_BASE_URL}`);
    console.warn(`   Make sure to run: ollama serve`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// GENERATE TEXT WITH OLLAMA
// ═══════════════════════════════════════════════════════════
async function generateWithOllama(prompt, options = {}) {
  try {
    const model = options.model || OLLAMA_MODEL;
    
    console.log(`🤖 OLLAMA: Starting generation with "${model}" model...`);
    console.log(`   Prompt length: ${prompt.length} characters`);

    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: model,
        prompt: prompt,
        stream: false,
        temperature: options.temperature ?? 0,
        num_predict: options.num_predict || 600, // Cap output to prevent timeouts
      },
      { timeout: REQUEST_TIMEOUT }
    );

    const text = response.data.response || "";
    
    console.log(`✅ OLLAMA: Generation complete - ${text.length} characters`);
    console.log(`   Stop reason: ${response.data.done_reason || "completion"}`);
    
    return text;
  } catch (error) {
    console.error(`❌ OLLAMA ERROR: ${error.message}`);
    if (error.code === "ECONNREFUSED") {
      console.error(`   Connection refused. Make sure Ollama is running: ollama serve`);
    }
    throw new Error(`Ollama processing failed: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// SIMPLIFY DOCUMENT TEXT
// ═══════════════════════════════════════════════════════════
async function simplifyDocumentWithOllama(documentText, fileType = "document") {
  try {
    console.log(`📄 OLLAMA SIMPLIFY: Processing ${fileType}...`);
    
    // Truncate to 2000 chars to prevent slow/timeout Ollama generation
    const truncatedText = documentText.substring(0, 2000);
    
    const prompt = `You are an assistant that simplifies Indian government documents for village-level understanding.

Document content:
---
${truncatedText}
---

Simplify in this format:
# Summary
[2-3 sentence overview]

## Key Points
- Point 1
- Point 2

## Terms Explained
- Term: Simple meaning

## What to Do
1. Step 1
2. Step 2

Respond ONLY with the formatted output.`;

    const simplifiedText = await generateWithOllama(prompt, { num_predict: 500, temperature: 0 });
    
    console.log(`✅ OLLAMA SIMPLIFY: Complete - ${simplifiedText.length} characters`);
    return simplifiedText;
  } catch (error) {
    console.error(`❌ OLLAMA SIMPLIFY ERROR: ${error.message}`);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// ANALYZE DOCUMENT (WITH CONTEXT)
// ═══════════════════════════════════════════════════════════
async function analyzeDocumentWithOllama(documentText, analysisType = "general") {
  try {
    console.log(`🔍 OLLAMA ANALYZE: Starting ${analysisType} analysis...`);
    
    const analysisPrompts = {
      legal: `Analyze this legal document and explain:
1. What is the main purpose?
2. What are the key obligations?
3. What are the rights granted?
4. When does it take effect?
5. Any important dates or deadlines?`,
      
      scheme: `Analyze this government scheme document and explain:
1. What is the scheme about?
2. Who is eligible?
3. What are the benefits?
4. How to apply?
5. Required documents?`,
      
      general: `Analyze this document and provide:
1. Main topic/purpose
2. Key information
3. Important terms
4. Required actions
5. Important dates/deadlines`,
    };

    const analysisPrompt = analysisPrompts[analysisType] || analysisPrompts.general;
    
    const prompt = `Document to analyze:
---
${documentText}
---

${analysisPrompt}

Provide clear, structured answers.`;

    const analysis = await generateWithOllama(prompt);
    
    console.log(`✅ OLLAMA ANALYZE: Complete`);
    return analysis;
  } catch (error) {
    console.error(`❌ OLLAMA ANALYZE ERROR: ${error.message}`);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// TRANSLATE TEXT USING OLLAMA (LOCAL)
// ═══════════════════════════════════════════════════════════
async function translateWithOllama(text, targetLanguage = "hindi") {
  try {
    console.log(`🌍 OLLAMA TRANSLATE: Translating to ${targetLanguage}...`);
    
    const languageMap = {
      hindi: "Hindi (हिंदी)",
      kannada: "Kannada (ಕನ್ನಡ)",
      tamil: "Tamil (தமிழ்)",
      telugu: "Telugu (తెలుగు)",
      marathi: "Marathi (मराठी)",
      gujarati: "Gujarati (ગુજરાતી)",
    };

    const targetLangName = languageMap[targetLanguage.toLowerCase()] || targetLanguage;
    
    // For local translation, we'll use Ollama's capability
    // Note: Quality depends on model. For best results, use Mistral or Llama 2
    const prompt = `Translate the following text to ${targetLangName}.
Provide ONLY the translation, no explanation.

Text: "${text.substring(0, 300)}"`;

    const translation = await generateWithOllama(prompt, { num_predict: 300, temperature: 0 });
    
    console.log(`✅ OLLAMA TRANSLATE: Complete - ${translation.length} characters`);
    return translation;
  } catch (error) {
    console.error(`⚠️ OLLAMA TRANSLATE: Falling back to original text`);
    // Return original text if translation fails
    return text;
  }
}

// ═══════════════════════════════════════════════════════════
// EXTRACT STRUCTURED DATA
// ═══════════════════════════════════════════════════════════
async function extractStructuredData(documentText, dataType = "general") {
  try {
    console.log(`📊 OLLAMA EXTRACT: Extracting ${dataType} data...`);
    
    const prompt = `Extract the following from this document and return as JSON:

Document:
${documentText.substring(0, 1000)}

${dataType === "general" ? `{
  "title": "Document title",
  "purpose": "Main purpose",
  "date": "Date issued",
  "key_points": ["point 1", "point 2"],
  "next_steps": ["step 1", "step 2"]
}` : "{}"}

Return ONLY valid JSON, no markdown or extra text.`;

    const response = await generateWithOllama(prompt);
    
    try {
      const data = JSON.parse(response);
      console.log(`✅ OLLAMA EXTRACT: Complete`);
      return data;
    } catch (e) {
      console.warn(`⚠️ OLLAMA EXTRACT: Could not parse JSON, returning raw response`);
      return { raw: response };
    }
  } catch (error) {
    console.error(`❌ OLLAMA EXTRACT ERROR: ${error.message}`);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// GET OLLAMA STATUS
// ═══════════════════════════════════════════════════════════
async function getOllamaStatus() {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 5000,
    });

    const models = response.data.models || [];
    const modelNames = models.map((m) => ({
      name: m.name,
      size: `${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB`,
      modified: m.modified_at,
    }));

    console.log(`✅ OLLAMA STATUS:`);
    console.log(`   Server: ${OLLAMA_BASE_URL}`);
    console.log(`   Models: ${models.length}`);
    console.log(`   Default: ${OLLAMA_MODEL}`);

    return {
      status: "running",
      baseUrl: OLLAMA_BASE_URL,
      defaultModel: OLLAMA_MODEL,
      models: modelNames,
    };
  } catch (error) {
    console.warn(`⚠️ OLLAMA STATUS: Server not available`);
    return {
      status: "offline",
      baseUrl: OLLAMA_BASE_URL,
      defaultModel: OLLAMA_MODEL,
      error: error.message,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════
module.exports = {
  checkOllamaAvailability,
  generateWithOllama,
  simplifyDocumentWithOllama,
  analyzeDocumentWithOllama,
  translateWithOllama,
  extractStructuredData,
  getOllamaStatus,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
};
