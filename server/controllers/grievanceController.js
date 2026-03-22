/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║     GRIEVANCE DRAFTSMAN CONTROLLER — RESILIENT FALLBACK  ║
 * ║  Gemini → Groq → HuggingFace → Demo Mode (2026 Edition)  ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Groq } = require("groq-sdk");
const OpenAI = require("openai");
const GRIEVANCE_DRAFTSMAN_PROMPT = require("../prompts/grievanceDraftsman");

// ═══════════════════════════════════════════════════════════
// HELPER: Extract JSON from AI response
// ═══════════════════════════════════════════════════════════
function extractJSON(text) {
  try {
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    
    // Replace [NEWLINE] markers with actual \n characters for rendering safely
    if (typeof parsed.draftLetter === 'string') parsed.draftLetter = parsed.draftLetter.replace(/\[NEWLINE\]/g, "\n");
    if (typeof parsed.draftLetterKannada === 'string') parsed.draftLetterKannada = parsed.draftLetterKannada.replace(/\[NEWLINE\]/g, "\n");
    if (typeof parsed.draftLetterHindi === 'string') parsed.draftLetterHindi = parsed.draftLetterHindi.replace(/\[NEWLINE\]/g, "\n");
    
    // Fallback for previous array implementations just in case
    if (Array.isArray(parsed.draftLetter)) parsed.draftLetter = parsed.draftLetter.join("\n");
    if (Array.isArray(parsed.draftLetterKannada)) parsed.draftLetterKannada = parsed.draftLetterKannada.join("\n");
    if (Array.isArray(parsed.draftLetterHindi)) parsed.draftLetterHindi = parsed.draftLetterHindi.join("\n");
    
    return parsed;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER: Validate environment variables
// ═══════════════════════════════════════════════════════════
function validateAPIKeys() {
  const keys = {
    github: process.env.GITHUB_TOKEN,
    openrouter: process.env.OPENROUTER_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
  };

  const available = [];
  if (keys.github) available.push("github");
  if (keys.openrouter) available.push("openrouter");
  if (keys.gemini && keys.gemini !== "your_gemini_api_key_here") available.push("gemini");
  if (keys.groq && keys.groq !== "your_groq_api_key_here") available.push("groq");

  console.log(`✓ Available AI providers: ${available.join(", ") || "NONE - using demo mode"}`);
  return { keys, available };
}

// ═══════════════════════════════════════════════════════════
// PROVIDER 1: Google Gemini (with v1 stable SDK)
// ═══════════════════════════════════════════════════════════
async function tryGemini(userMessage) {
  try {
    console.log("📡 Attempting Gemini...");
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use stable v1 SDK pattern (not v1beta)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      { text: GRIEVANCE_DRAFTSMAN_PROMPT },
      { text: userMessage },
    ]);

    const responseText = result.response.text();
    const parsed = extractJSON(responseText);

    if (parsed) {
      console.log("✓ Gemini succeeded!");
      return { success: true, data: parsed, provider: "Gemini" };
    }
  } catch (error) {
    console.error(`⚠️ Gemini failed: ${error.message}`);
  }
  return { success: false };
}

// ═══════════════════════════════════════════════════════════
// PROVIDER 2: Groq (with updated model ID)
// ═══════════════════════════════════════════════════════════
async function tryGroq(userMessage) {
  try {
    console.log("📡 Attempting Groq...");
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY not set");

    const groq = new Groq({ apiKey });

    // Use current model (mixtral-8x7b-32768 is decommissioned, use llama-3.3-70b-versatile)
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: GRIEVANCE_DRAFTSMAN_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const responseText = response.choices[0].message.content;
    const parsed = extractJSON(responseText);

    if (parsed) {
      console.log("✓ Groq succeeded!");
      return { success: true, data: parsed, provider: "Groq" };
    }
  } catch (error) {
    console.error(`⚠️ Groq failed: ${error.message}`);
  }
  return { success: false };
}

// ═══════════════════════════════════════════════════════════
// PROVIDER 3: OpenRouter (Deep-Language Gemini Backdoor)
// ═══════════════════════════════════════════════════════════
async function tryOpenRouter(userMessage) {
  try {
    console.log("📡 Attempting OpenRouter (Gemini 2.0 Flash Lite)...");
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

    const openRouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
    });

    const response = await openRouterClient.chat.completions.create({
      model: "google/gemini-2.0-flash-lite-preview-02-05:free",
      messages: [
        { role: "system", content: GRIEVANCE_DRAFTSMAN_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: 'json_object' }, // Enforce JSON mode
      temperature: 0.7,
      max_tokens: 2048,
    });

    const responseText = response.choices[0]?.message?.content || "{}";
    const parsed = extractJSON(responseText);

    if (parsed) {
      console.log("✓ OpenRouter succeeded!");
      return { success: true, data: parsed, provider: "OpenRouter Gemini" };
    }
  } catch (error) {
    console.error(`⚠️ OpenRouter failed: ${error.message}`);
  }
  return { success: false };
}

// ═══════════════════════════════════════════════════════════
// PROVIDER 4: GitHub Models API (Azure GPT-4o-mini)
// ═══════════════════════════════════════════════════════════
async function tryGitHubModels(userMessage) {
  try {
    console.log("📡 Attempting GitHub Models (GPT-4o-mini)...");
    const apiKey = process.env.GITHUB_TOKEN;
    if (!apiKey) throw new Error("GITHUB_TOKEN not set");

    const githubClient = new OpenAI({
      baseURL: 'https://models.inference.ai.azure.com',
      apiKey: apiKey,
    });

    const response = await githubClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: GRIEVANCE_DRAFTING_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2048,
    });

    const responseText = response.choices[0]?.message?.content || "{}";
    const parsed = extractJSON(responseText);

    if (parsed) {
      console.log("✓ GitHub Models succeeded!");
      return { success: true, data: parsed, provider: "GitHub Models (GPT-4o-mini)" };
    }
  } catch (error) {
    console.error(`⚠️ GitHub Models failed: ${error.message}`);
  }
  return { success: false };
}

// ═══════════════════════════════════════════════════════════
// DEMO MODE: Return sample grievance draft
// ═══════════════════════════════════════════════════════════
function demoMode(userIntent, language) {
  console.log("ℹ️ Using demo mode (no API providers available)");
  return {
    draftLetter: `Dear Sir/Madam,

I am writing to lodge a formal ${userIntent} regarding the matter described below.

[Please fill in specific details about your grievance here]

I request that immediate action be taken to resolve this matter at the earliest.

Yours faithfully`,
    draftLetterKannada: "ಇದು ಡೆಮೋ ಮೋಡ್ ಕನ್ನಡ ಉತ್ತರವಾಗಿದೆ. ನೈಜ API ಕೋNND ಉತ್ತರಕ್ಕಾಗಿ API ಕೀ ಸಿದ್ಧಪಡಿಸಿ.",
    draftLetterHindi: "यह डेमो मोड हिंदी उत्तर है। वास्तविक API प्रतिक्रिया के लिए API कुंजी तैयार करें।",
    formatType: userIntent,
    tips: [
      "Include specific dates and references",
      "Be clear and concise",
      "Keep a copy for your records",
      "Review with legal aid if needed",
    ],
    disclaimer:
      "⚠️ DEMO MODE: This is a template. This is an AI-generated draft. Please review it with a local legal aid centre before submitting.",
    submitTo: "Relevant Government Authority",
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN CONTROLLER: Resilient Fallback Chain
// ═══════════════════════════════════════════════════════════
const draftGrievance = async (req, res) => {
  try {
    const { documentContext, userIntent, language } = req.body;

    // ─── Input Validation ───
    if (!documentContext || !userIntent) {
      return res.status(400).json({
        error: "documentContext and userIntent are required",
      });
    }

    // ─── Environment Validation ───
    const envValidation = validateAPIKeys();
    if (envValidation.available.length === 0) {
      console.log("⚠️ No API keys configured - using demo mode");
      return res.json({
        success: true,
        data: demoMode(userIntent, language || "en"),
        provider: "Demo Mode",
        warning:
          "No API keys configured. Configure Gemini, Groq, or HuggingFace API keys for real responses.",
      });
    }

    // ─── Build User Message ───
    const userMessage = `
Document Context:
${documentContext}

User Intent: ${userIntent}

Please draft the appropriate formal letter based on the above context in English, Kannada, and Hindi concurrently.
Return ONLY valid JSON with fields: draftLetter, draftLetterKannada, draftLetterHindi, formatType, tips, disclaimer, submitTo
`;

    // ─── RESILIENT FALLBACK CHAIN ───
    // Try providers in order: GitHub Models → OpenRouter → Gemini SDK → Groq → Demo

    // Step 1: Try GitHub Models (Unlimited Quota, Highest Reliability)
    if (envValidation.available.includes("github")) {
      const result = await tryGitHubModels(userMessage);
      if (result.success) {
        return res.json({ success: true, data: result.data, provider: result.provider });
      }
    }

    // Step 2: Try OpenRouter (Bypass Gemini limit)
    if (envValidation.available.includes("openrouter")) {
      const result = await tryOpenRouter(userMessage);
      if (result.success) {
        return res.json({ success: true, data: result.data, provider: result.provider });
      }
    }

    // Step 3: Try Gemini SDK
    if (envValidation.available.includes("gemini")) {
      const result = await tryGemini(userMessage);
      if (result.success) {
        return res.json({ success: true, data: result.data, provider: result.provider });
      }
    }

    // Step 4: Try Groq
    if (envValidation.available.includes("groq")) {
      const result = await tryGroq(userMessage);
      if (result.success) {
        return res.json({ success: true, data: result.data, provider: result.provider });
      }
    }

    // Step 4: Fall back to Demo Mode
    console.log("ℹ️ All providers failed - falling back to demo mode");
    return res.json({
      success: true,
      data: demoMode(userIntent, language || "en"),
      provider: "Demo Mode",
      warning: "All API providers failed. Using demo mode template.",
    });
  } catch (error) {
    console.error("❌ Grievance draft error:", error);
    res.status(500).json({
      error: error.message || "Failed to draft grievance",
      provider: "error",
    });
  }
};

module.exports = { draftGrievance };
