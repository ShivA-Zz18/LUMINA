'use strict';

/**
 * @fileoverview AI Controller — Lingo-Bridge Core
 * Multi-provider LLM orchestration: Groq (primary) → Gemini (secondary) → HuggingFace (tertiary) → Demo Mode (fallback).
 * Handles two major API surfaces:
 *  - `aiProcess`: Unified document & chat processing endpoint.
 *  - `draftGrievance`: AI-powered formal grievance/RTI letter drafting.
 */

const { Groq } = require('groq-sdk');
const { HfInference } = require('@huggingface/inference');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { translate } = require('../utils/bhashini');
const logger = require('../utils/logger');

/** OpenRouter client — used as the emergency 3rd-tier fallback in grievance drafting. */
const openRouterClient = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

/** GitHub Models Client — The ultimate unbreakable Free Tier fallback */
const githubModelsClient = new OpenAI({
  baseURL: 'https://models.inference.ai.azure.com',
  apiKey: process.env.GITHUB_TOKEN,
});

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * System prompt for the "Gaon Sahayak" document simplification persona.
 * Instructs the model to return structured JSON with multilingual simplifications.
 * @constant {string}
 */
const VILLAGE_ASSISTANT_PROMPT = `You are **"Gaon Sahayak"** (Village Helper), a warm, patient AI assistant who helps rural Indian citizens understand complex government and legal documents.

### Your Personality
- Speak like a trusted village elder who happens to know legal terminology.
- Never be condescending. Assume the user is intelligent but unfamiliar with bureaucratic language.
- When unsure, say so honestly rather than guessing.

### Strict Output Format
When processing documents, return **only** valid JSON:
{
  "originalText": "<text extracted from image>",
  "simplifiedText": "<simplified English, village-level language>",
  "simplifiedKannada": "<ಕನ್ನಡ version, rural dialect>",
  "simplifiedHindi": "<हिन्दी version, village-level>",
  "jargonTerms": [
    { "term": "<complex term>", "meaning": "<simple explanation>" }
  ],
  "documentType": "<e.g. Land Notice, Ration Card>",
  "department": "<relevant government body>",
  "confidence": "high | medium | low",
  "warnings": "<important caveats>"
}

### Rules
- Use native scripts: ಕನ್ನಡ (Kannada), हिन्दी (Hindi)
- No transliteration
- If unreadable: set originalText to "Unable to read" and confidence to "low"
- Keep simplifications to 60% of original length
- Maximum 8 jargon terms`;

/**
 * System prompt for the general-purpose chat assistant.
 * @constant {string}
 */
const CHAT_SYSTEM_PROMPT = `You are "Lingo-Bridge Assistant" — a friendly, knowledgeable helper for rural Indian citizens.

### Your Role
- Help people understand government schemes, documents, and their rights
- Answer in simple, clear language a village Elder would understand
- Explain documents practically, not just legally
- Describe scheme eligibility and how to apply
- Explain rights with real-world examples
- Respond in English, Hindi, or Kannada based on user preference

### Key Rules
- Keep answers concise (2-3 paragraphs max)
- Use bullet points for steps or lists
- Always be empathetic and encouraging
- If unsure, admit it honestly
- Never give legal advice — suggest visiting Jan Seva Kendra
- Include scheme names or document references when relevant
- Use village-level language (avoid legal jargon)`;

/**
 * System prompt for the grievance/RTI letter drafting persona.
 * Instructs the model to behave as a Senior Administrative Officer.
 * @constant {string}
 */
const GRIEVANCE_DRAFTING_PROMPT = `### SYSTEM ROLE
You are a Senior Administrative Officer and Legal Draftsman expert in Indian Governance (RTI Act 2005, Public Grievance Portals, and Consumer Forum). Your goal is to draft formal, high-impact documents based on user input.

### INSTRUCTIONS:
1. CLASSIFY: Determine if the request is a (A) Formal Reply, (B) Grievance Letter, or (C) RTI Request.
2. STRUCTURE:
   - Use standard Indian formal letter headers (To, From, Date, Subject).
   - For RTI: Use the specific "Form A" format; cite relevant sections of the RTI Act 2005.
   - For Grievances: Include a "Prayer" (what action you want taken) at the end.
3. TONE: Professional, firm, and respectful. Use administrative vocabulary (e.g., "perusal," "undersigned," "redressal").
4. LANGUAGE: Generate the draft natively in ALL THREE languages simultaneously: English, formal Hindi (Sarkari style), and formal Kannada.

### SCHEMA OUTPUT (JSON ONLY):
{
  "document_type": "string",
  "subject": "string",
  "draft_content_english": "Full letter body in English with placeholders like [Name], [Date]",
  "draft_content_hindi": "Full letter body translated to formal Hindi with placeholders",
  "draft_content_kannada": "Full letter body translated to formal Kannada with placeholders",
  "key_sections_cited": ["string"],
  "next_steps": ["Step-by-step advice on where/how to submit"]
}`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads a file from disk and returns its content as a Base64-encoded string.
 *
 * @param {string} filePath - Absolute path to the file.
 * @returns {string} Base64-encoded file content.
 */
function fileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return Buffer.from(fileBuffer).toString('base64');
}

/**
 * Resolves a MIME type string from a file's extension.
 * Defaults to `image/jpeg` for unrecognised extensions.
 *
 * @param {string} filePath - Path to the file (only extension is used).
 * @returns {string} MIME type string (e.g., `'image/png'`).
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  return mimeMap[ext] || 'image/jpeg';
}

/**
 * Extracts a JSON object from a raw AI response string.
 * Safely strips markdown code fences (```json ... ```) before parsing.
 *
 * @param {string} rawResponseText - Raw text output from the AI model.
 * @returns {Object|null} Parsed JSON object, or `null` if parsing fails.
 */
function extractJSON(rawResponseText) {
  try {
    const sanitizedText = rawResponseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    return JSON.parse(sanitizedText);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO MODE PAYLOADS
// ─────────────────────────────────────────────────────────────────────────────

/** @private Demo document response returned when no API keys are configured. */
const DEMO_DOCUMENT_RESPONSE = {
  originalText: 'This is a demo document showing how simplification works.',
  simplifiedText: 'This is a simple document example.',
  simplifiedKannada: 'ಇದು ಸರಳೀಕರಣ ಹೇಗೆ ಕಾಗುತ್ತದೆ ಎಂಬುದನ್ನು ತೋರಿಸುವ ಸರಳ ದಾಖಲೆ ಉದಾಹರಣೆ.',
  simplifiedHindi: 'यह एक साधारण दस्तावेज उदाहरण है।',
  documentType: 'Demo Document',
  confidence: 'high',
  warnings: 'Demo mode — Configure GEMINI_API_KEY and GROQ_API_KEY to enable live processing.',
};

/**
 * Multilingual keyword-matched demo chat responses.
 * Keyed by language code (`en`, `hi`, `kn`), then by topic category.
 * @private
 * @type {Object.<string, Object.<string, string>>}
 */
const DEMO_CHAT_RESPONSES = {
  en: {
    schemes: 'Common government schemes include: 1) Pradhan Mantri Jan Dhan Yojana (bank accounts), 2) Ayushman Bharat (health insurance), 3) Mudra Loan (business loans). Visit your nearest Jan Seva Kendra for details.',
    documents: 'Government documents like Ration Cards, Aadhaar, and Land Notices can be confusing. Would you like me to explain a specific document?',
    rights: 'You have rights! These include: Right to Information, Right to Education, Right to Work. Contact your local authorities for help.',
    scholarship: 'Scholarships available: 1) National Scholarship Portal (NSP) - for merit & SC/ST students, 2) Post-Matric Scholarship - for OBC & minority students. Apply on scholarships.gov.in',
    loan: 'Loans available: 1) Mudra Loan (₹50,000 to ₹10 lakh for business), 2) Student loans with subsidy. Contact your nearest bank or Government office.',
    health: 'Health schemes: 1) Ayushman Bharat (free treatment up to ₹5 lakh), 2) PMJAY, 3) Jeevan Bima Yojana (₹2 lakh life insurance).',
    pension: 'Pensions: 1) APY (₹1000 to ₹5000/month), 2) Widow pension, 3) Old age pension (₹500-₹2000/month by state).',
    grievance: 'File grievance through: 1) CPGRAMS portal (cpgrams.gov.in), 2) RTI Act for information, 3) Local Ombudsman office.',
    rti: 'RTI (Right to Information): You can ask for ANY government record. Apply with ₹10 fee. Response required within 30 days. No reason needed!',
    default: 'Hello! I\'m here to help explain government schemes, documents, and your rights. What would you like to know?',
  },
  hi: {
    schemes: 'सामान्य सरकारी योजनाएं हैं: 1) प्रधान मंत्री जन धन योजना, 2) आयुष्मान भारत, 3) मुद्रा ऋण।',
    documents: 'राशन कार्ड, आधार और भूमि नोटिस जैसे सरकारी दस्तावेज भ्रामक हो सकते हैं। क्या आप किसी विशिष्ट दस्तावेज़ की व्याख्या चाहते हैं?',
    rights: 'आपके अधिकार हैं! सूचना का अधिकार, शिक्षा का अधिकार, काम का अधिकार।',
    scholarship: 'छात्रवृत्ति: 1) NSP पोर्टल - मेधावी व SC/ST छात्र, 2) OBC छात्रवृत्ति। scholarships.gov.in पर आवेदन करें।',
    loan: 'ऋण: 1) मुद्रा लोन (₹50,000 से ₹10 लाख), 2) छात्र ऋण। अपने बैंक से संपर्क करें।',
    health: 'स्वास्थ्य: 1) आयुष्मान भारत (₹5 लाख तक मुफ्त इलाज), 2) PMJAY, 3) जीवन बीमा योजना।',
    pension: 'पेंशन: 1) APY (₹1000 से ₹5000 मासिक), 2) विधवा पेंशन, 3) वृद्धावस्था पेंशन।',
    grievance: 'शिकायत: 1) CPGRAMS पोर्टल, 2) RTI, 3) लोकपाल कार्यालय।',
    rti: 'सूचना का अधिकार: ₹10 फीस के साथ आवेदन करें। 30 दिनों में उत्तर मिलना चाहिए।',
    default: 'नमस्ते! मैं सरकारी योजनाओं और आपके अधिकारों को समझाने में मदद करने के लिए यहां हूं।',
  },
  kn: {
    schemes: 'ಸಾಮಾನ್ಯ ಯೋಜನೆಗಳು: 1) ಪ್ರಧಾನ ಮಂತ್ರಿ ಜನ ಧನ ಯೋಜನೆ, 2) ಆಯುಷ್ಮಾನ್ ಭಾರತ, 3) ಮುದ್ರಾ ಋಣ।',
    documents: 'ರೇಷನ್ ಕಾರ್ಡ್, ಆಧಾರ್ ದಾಖಲೆಗಳು ಗೊಂದಲಮಯವಾಗಿರಬಹುದು. ನಿರ್ದಿಷ್ಟ ದಾಖಲೆ ವಿವರಿಸಲು ಬಯಸುತ್ತೀರಾ?',
    rights: 'ನಿಮಗೆ ಅಧಿಕಾರವಿದೆ! ಮಾಹಿತಿ ಹಕ್ಕು, ಶಿಕ್ಷೆಯ ಹಕ್ಕು, ಕಾಮ ಹಕ್ಕು।',
    scholarship: 'ವೃತ್ತಿ: 1) NSP ಪೋರ್ಟಲ್, 2) OBC ವೃತ್ತಿ। scholarships.gov.in ನಲ್ಲಿ ಅರ್ಜಿ ಹಾಕಿ।',
    loan: 'ಸಾಲ: 1) ಮುದ್ರಾ ಲೋನ್ (ವ್ಯಾಪಾರಕ್ಕೆ), 2) ವಿದ್ಯಾರ್ಥಿ ಸಾಲ। ನಿಮ್ಮ ಬ್ಯಾಂಕಿನಲ್ಲಿ ಸಂಪರ್ಕಿಸಿ।',
    health: 'ಆರೋಗ್ಯ: 1) ಆಯುಷ್ಮಾನ್ ಭಾರತ (₹5 ಲಕ್ಷ ಮುಕ್ತ ಚಿಕಿತ್ಸೆ), 2) PMJAY।',
    pension: 'ಪಿಂಚಣಿ: 1) APY (₹1000 ರಿಂದ ₹5000 ಮಾಸಿಕ), 2) ವಿಧವೆ ಪಿಂಚಣಿ।',
    grievance: 'ದೂರು: 1) CPGRAMS ನಲ್ಲಿ, 2) RTI ಮೂಲಕ, 3) ಲೋಕಪಾಲ ಕಚೇರಿ.',
    rti: 'ಮಾಹಿತಿಯ ಹಕ್ಕು: ₹10 ಫೀಸ್ ನೊಂದಿಗೆ ಅರ್ಜಿ। 30 ದಿನಗಳಲ್ಲಿ ಉತ್ತರ ನಿರೀಕ್ಷಿಸಿ.',
    default: 'ನಮಸ್ಕಾರ! ಸರಕಾರಿ ಯೋಜನೆಗಳು ಮತ್ತು ನಿಮ್ಮ ಅಧಿಕಾರಗಳನ್ನು ವಿವರಿಸಲು ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇನೆ.',
  },
};

/**
 * Resolves a demo chat response string using keyword matching against the user query.
 *
 * @private
 * @param {string} userText - The user's raw query text.
 * @param {string} languageCode - BCP-47 language code (`en`, `hi`, or `kn`).
 * @returns {string} The matched demo response string.
 */
function resolveDemoChatResponse(userText, languageCode) {
  const queryLower = userText.toLowerCase();
  const responseBucket = DEMO_CHAT_RESPONSES[languageCode] || DEMO_CHAT_RESPONSES.en;

  if (/scholarship|छात्रवृत्ति|ವೃತ್ತಿ|nsp|nheqf|pjms/i.test(queryLower)) return responseBucket.scholarship;
  if (/loan|ऋण|ಸಾಲ|mudra|business|व्यापार/i.test(queryLower)) return responseBucket.loan;
  if (/health|स्वास्थ्य|ಆರೋಗ್ಯ|ayushman|treatment/i.test(queryLower)) return responseBucket.health;
  if (/pension|पेंशन|ಪಿಂಚಣಿ|apy|old age|बुजुर्ग/i.test(queryLower)) return responseBucket.pension;
  if (/grievance|शिकायत|ನಿಂದೆ|complaint|cpgrams/i.test(queryLower)) return responseBucket.grievance;
  if (/rti|information|सूचना|ಮಾಹಿತಿ|rights/i.test(queryLower)) return responseBucket.rti;
  if (/scheme|योजना|ಯೋಜನೆ/i.test(queryLower)) return responseBucket.schemes;
  if (/document|दस्तावेज|ದಾಖಲೆ/i.test(queryLower)) return responseBucket.documents;
  if (/right|अधिकार|ಅಧಿಕಾರ/i.test(queryLower)) return responseBucket.rights;
  return responseBucket.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL TEMPLATE ENGINE — zero-dependency, always-available fallback
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifies a userIntent string into one of three canonical document types.
 * Used to select the appropriate template structure.
 *
 * @private
 * @param {string} userIntent - Raw intent string from the request body.
 * @returns {'rti'|'grievance'|'formal_reply'} Classified document type.
 */
/**
 * Classifies a userIntent string into one of three canonical document types.
 *
 * @private
 * @param {string} userIntent - Raw intent string from the request body.
 * @returns {'rti'|'grievance'|'formal_reply'} Classified document type.
 */
function classifyDocumentIntent(userIntent) {
  const intentLower = userIntent.toLowerCase();
  if (/rti|right to information|information request|सूचना का अधिकार|ಮಾಹಿತಿ ಹಕ್ಕು/.test(intentLower)) return 'rti';
  if (/formal reply|response|reply|answer|counter|जवाब|ಉತ್ತರ/.test(intentLower)) return 'formal_reply';
  return 'grievance';
}

/**
 * Generates professional letters in all 3 languages (English, Hindi, Kannada).
 * Zero API calls — works completely offline.
 *
 * @param {Object} params
 * @param {string} params.userIntent
 * @param {string} params.documentContext
 * @param {string} [params.authority]
 * @param {string} [params.issueDetails]
 * @param {string} [params.language='en']
 * @returns {Object} Schema-compatible draft object with all 3 language drafts.
 */
function generateLocalGrievanceTemplate({ userIntent, documentContext, authority, issueDetails, language = 'en' }) {
  const docType = classifyDocumentIntent(userIntent);
  const auth = authority || 'The Concerned Authority / संबंधित प्राधिकरण / ಸಂಬಂಧಿಸಿದ ಅಧಿಕಾರಿ';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const details = issueDetails || '';

  // ─── RTI APPLICATION ──────────────────────────────────────────────────────
  if (docType === 'rti') {
    const en = `Date: ${today}

To,
The Public Information Officer (PIO)
${auth}

Subject: Application for Information under the Right to Information Act, 2005

Sir/Madam,

I, the undersigned, a citizen of India, hereby request the following information under Section 6 of the Right to Information Act, 2005:

Context / Subject Matter:
${documentContext}

Specific Information Requested:
${details || 'Please provide all relevant records, files, documents and communications pertaining to the above subject.'}

Period of Information Sought: Last 3 years / as applicable

I am enclosing an application fee of Rs. 10/- (Rupees Ten Only) as prescribed. If additional fee is required, kindly inform me in writing.

I request that the information be provided within 30 days as mandated under Section 7(1) of the RTI Act, 2005.

Yours faithfully,

[Your Full Name]
[Your Complete Address]
[Your Mobile Number]
[Your Email ID]
[Date: ${today}]`;

    const hi = `दिनांक: ${today}

प्रति,
जन सूचना अधिकारी (PIO)
${auth}

विषय: सूचना का अधिकार अधिनियम, 2005 के तहत सूचना के लिए आवेदन

महोदय/महोदया,

मैं, अधोहस्ताक्षरी, भारत का एक नागरिक/नागरिका, सूचना का अधिकार अधिनियम, 2005 की धारा 6 के अंतर्गत निम्नलिखित सूचना का अनुरोध करता/करती हूँ:

संदर्भ / विषय वस्तु:
${documentContext}

मांगी गई विशिष्ट सूचना:
${details || 'कृपया उपरोक्त विषय से संबंधित सभी प्रासंगिक अभिलेख, फाइलें, दस्तावेज और पत्राचार उपलब्ध कराएं।'}

सूचना का अपेक्षित कार्यकाल: पिछले 3 वर्ष / जैसा लागू हो

मैं RTI नियमों के अनुसार ₹10/- (दस रुपये मात्र) आवेदन शुल्क संलग्न कर रहा/रही हूँ।

कृपया RTI अधिनियम, 2005 की धारा 7(1) के अनुसार 30 दिनों के भीतर सूचना प्रदान करने की कृपा करें।

भवदीय,

[आपका पूरा नाम]
[आपका पूरा पता]
[आपका मोबाइल नंबर]
[आपकी ईमेल आईडी]
[दिनांक: ${today}]`;

    const kn = `ದಿನಾಂಕ: ${today}

ಗೆ,
ಸಾರ್ವಜನಿಕ ಮಾಹಿತಿ ಅಧಿಕಾರಿ (PIO)
${auth}

ವಿಷಯ: ಮಾಹಿತಿ ಹಕ್ಕು ಅಧಿನಿಯಮ, 2005 ರ ಅಡಿಯಲ್ಲಿ ಮಾಹಿತಿಗಾಗಿ ಅರ್ಜಿ

ಮಹೋದಯ/ಮಹೋದಯೆ,

ನಾನು, ಕೆಳಗೆ ಸಹಿ ಮಾಡಿದ, ಭಾರತದ ನಾಗರಿಕ/ನಾಗರಿಕಳಾಗಿ, ಮಾಹಿತಿ ಹಕ್ಕು ಅಧಿನಿಯಮ, 2005 ರ ಧಾರೆ 6 ರ ಅಡಿಯಲ್ಲಿ ಈ ಕೆಳಗಿನ ಮಾಹಿತಿಯನ್ನು ಕೋರುತ್ತೇನೆ:

ಸಂದರ್ಭ / ವಿಷಯ:
${documentContext}

ಕೋರಿದ ನಿರ್ದಿಷ್ಟ ಮಾಹಿತಿ:
${details || 'ಮೇಲಿನ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಎಲ್ಲಾ ದಾಖಲೆಗಳು, ಫೈಲ್‌ಗಳು ಮತ್ತು ಪತ್ರವ್ಯವಹಾರಗಳನ್ನು ದಯವಿಟ್ಟು ಒದಗಿಸಿ.'}

ಮಾಹಿತಿ ಅಪೇಕ್ಷಿತ ಅವಧಿ: ಕಳೆದ 3 ವರ್ಷಗಳು / ಅನ್ವಯಿಸಿದಂತೆ

ನಿಯಮಗಳ ಪ್ರಕಾರ ₹10/- ಅರ್ಜಿ ಶುಲ್ಕ ಲಗತ್ತಿಸುತ್ತಿದ್ದೇನೆ.

RTI ಅಧಿನಿಯಮ ಧಾರೆ 7(1) ರ ಅಡಿಯಲ್ಲಿ 30 ದಿನಗಳಲ್ಲಿ ಮಾಹಿತಿ ನೀಡಬೇಕೆಂದು ಕೋರುತ್ತೇನೆ.

ನಿಮ್ಮ ವಿಶ್ವಾಸಿ,

[ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು]
[ನಿಮ್ಮ ಸಂಪೂರ್ಣ ವಿಳಾಸ]
[ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ]
[ನಿಮ್ಮ ಇಮೇಲ್ ಐಡಿ]
[ದಿನಾಂಕ: ${today}]`;

    const primaryDraft = language === 'hi' ? hi : language === 'kn' ? kn : en;
    return {
      document_type: 'RTI Application',
      subject: `RTI Application — ${documentContext.slice(0, 80)}`,
      draft_content: primaryDraft,
      draft_content_english: en,
      draft_content_hindi: hi,
      draft_content_kannada: kn,
      key_sections_cited: [
        'RTI Act 2005 — Section 6 (Filing of Request)',
        'RTI Act 2005 — Section 7(1) (30-day Response Mandate)',
        'RTI Act 2005 — Section 7(5) (Fee Waiver for BPL applicants)',
      ],
      next_steps: [
        'Submit to the PIO of the department in person or by Registered Post.',
        'Attach ₹10 Postal Order / Court Fee Stamp as RTI filing fee.',
        'Keep a self-attested copy of your application.',
        'If no reply within 30 days → First Appeal to First Appellate Authority.',
        'Second Appeal → Central/State Information Commission.',
      ],
      generated_by: 'local_template',
    };
  }

  // ─── FORMAL REPLY ─────────────────────────────────────────────────────────
  if (docType === 'formal_reply') {
    const en = `Date: ${today}

To,
${auth}

Subject: Formal Reply — ${documentContext.slice(0, 80)}

Sir/Madam,

With reference to the above subject, I, the undersigned, hereby submit my formal response for your kind perusal and necessary action.

Background / Context:
${documentContext}

My Response / Clarification:
${details || 'I have carefully reviewed the matter. All documents and evidence in support of my position are submitted herewith for your consideration.'}

I request you to kindly acknowledge receipt of this reply and take appropriate action as per applicable laws and departmental procedures.

Thanking you,

Yours faithfully,

[Your Full Name]
[Your Designation / Role, if applicable]
[Your Complete Address]
[Your Mobile Number]
[Date: ${today}]`;

    const hi = `दिनांक: ${today}

प्रति,
${auth}

विषय: औपचारिक जवाब — ${documentContext.slice(0, 80)}

महोदय/महोदया,

उपरोक्त विषय के संदर्भ में, मैं, अधोहस्ताक्षरी, अपना औपचारिक उत्तर आपके अवलोकनार्थ एवं आवश्यक कार्रवाई हेतु प्रस्तुत करता/करती हूँ।

पृष्ठभूमि / संदर्भ:
${documentContext}

मेरा उत्तर / स्पष्टीकरण:
${details || 'मैंने इस विषय का ध्यानपूर्वक परीक्षण किया है। अपने पक्ष के समर्थन में सभी दस्तावेज़ एवं साक्ष्य संलग्न हैं।'}

कृपया इस उत्तर की प्राप्ति स्वीकार करें और लागू कानूनों व विभागीय प्रक्रियाओं के अनुसार आवश्यक कार्रवाई करें।

धन्यवाद,

भवदीय,

[आपका पूरा नाम]
[पदनाम / भूमिका, यदि लागू हो]
[आपका पूरा पता]
[आपका मोबाइल नंबर]
[दिनांक: ${today}]`;

    const kn = `ದಿನಾಂಕ: ${today}

ಗೆ,
${auth}

ವಿಷಯ: ಔಪಚಾರಿಕ ಉತ್ತರ — ${documentContext.slice(0, 80)}

ಮಹೋದಯ/ಮಹೋದಯೆ,

ಮೇಲಿನ ವಿಷಯದ ಉಲ್ಲೇಖದೊಂದಿಗೆ, ನಾನು, ಕೆಳಗೆ ಸಹಿ ಮಾಡಿದ, ನಿಮ್ಮ ದಯಾ ಪರಿಶೀಲನೆ ಮತ್ತು ಅಗತ್ಯ ಕ್ರಮಕ್ಕಾಗಿ ನನ್ನ ಔಪಚಾರಿಕ ಉತ್ತರವನ್ನು ಸಲ್ಲಿಸುತ್ತೇನೆ.

ಹಿನ್ನೆಲೆ / ಸಂದರ್ಭ:
${documentContext}

ನನ್ನ ಉತ್ತರ / ಸ್ಪಷ್ಟೀಕರಣ:
${details || 'ನಾನು ಈ ವಿಷಯವನ್ನು ಎಚ್ಚರಿಕೆಯಿಂದ ಪರಿಶೀಲಿಸಿದ್ದೇನೆ. ನನ್ನ ನಿಲುವನ್ನು ಬೆಂಬಲಿಸುವ ಎಲ್ಲಾ ದಾಖಲೆಗಳನ್ನು ಇದರೊಂದಿಗೆ ಲಗತ್ತಿಸಲಾಗಿದೆ.'}

ದಯವಿಟ್ಟು ಈ ಉತ್ತರದ ರಸೀದಿಯನ್ನು ಸ್ವೀಕರಿಸಿ ಮತ್ತು ಅನ್ವಯವಾಗುವ ಕಾನೂನುಗಳ ಪ್ರಕಾರ ಕ್ರಮ ತೆಗೆದುಕೊಳ್ಳಿ.

ವಂದನೆಗಳೊಂದಿಗೆ,

ನಿಮ್ಮ ವಿಶ್ವಾಸಿ,

[ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು]
[ಹುದ್ದೆ / ಪಾತ್ರ, ಅನ್ವಯಿಸಿದರೆ]
[ನಿಮ್ಮ ಸಂಪೂರ್ಣ ವಿಳಾಸ]
[ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ]
[ದಿನಾಂಕ: ${today}]`;

    const primaryDraft = language === 'hi' ? hi : language === 'kn' ? kn : en;
    return {
      document_type: 'Formal Reply',
      subject: `Formal Reply — ${documentContext.slice(0, 80)}`,
      draft_content: primaryDraft,
      draft_content_english: en,
      draft_content_hindi: hi,
      draft_content_kannada: kn,
      key_sections_cited: ['Standard administrative correspondence format'],
      next_steps: [
        'Print on A4 paper and sign with blue or black ink.',
        'Submit in person — obtain a stamped receipt.',
        'If posting, use Registered Post with Acknowledgement Due (RPAD).',
        'Keep a photocopy of the signed letter and postal receipt.',
      ],
      generated_by: 'local_template',
    };
  }

  // ─── GRIEVANCE LETTER (Default) ───────────────────────────────────────────
  const en = `Date: ${today}

To,
${auth}

Subject: Formal Grievance — ${documentContext.slice(0, 80)}

Sir/Madam,

I, the undersigned, am a resident of [Your City/Village, State] and respectfully wish to bring the following matter to your esteemed attention for immediate redressal.

Nature of Grievance:
${userIntent}

Detailed Description of the Issue:
${documentContext}
${details ? `\nAdditional Details:\n${details}\n` : ''}
Impact:
This issue has caused significant hardship and inconvenience to me and my family. Despite prior attempts to resolve the matter, it remains unaddressed.

Prayer / Relief Sought:
I humbly request that your good office kindly:
1. Examine and investigate the above grievance in a time-bound manner.
2. Direct the concerned department/officer to take immediate corrective action.
3. Provide a written acknowledgement and update on the action taken.

I shall be grateful for your prompt intervention.

Thanking you,
Yours faithfully,

[Your Full Name]
[Son/Daughter/Wife of: ____________________]
[Complete Address with PIN Code]
[Mobile Number]
[Aadhaar Number (last 4 digits only): XXXX]
[Date: ${today}]

Enclosures:
1. Copy of relevant document / ID proof
2. Any prior correspondence on this matter
3. [Other supporting documents]`;

  const hi = `दिनांक: ${today}

प्रति,
${auth}

विषय: औपचारिक शिकायत — ${documentContext.slice(0, 80)}

महोदय/महोदया,

मैं, अधोहस्ताक्षरी, [आपका शहर/गाँव, राज्य] का/की निवासी हूँ और आपसे विनम्र निवेदन करता/करती हूँ कि निम्नलिखित विषय पर तत्काल कार्रवाई की जाए।

शिकायत की प्रकृति:
${userIntent}

समस्या का विस्तृत विवरण:
${documentContext}
${details ? `\nअतिरिक्त विवरण:\n${details}\n` : ''}
प्रभाव:
इस समस्या के कारण मुझे और मेरे परिवार को अत्यधिक कठिनाई और परेशानी हो रही है। पूर्व प्रयासों के बावजूद यह समस्या अभी तक अनसुलझी बनी हुई है।

प्रार्थना / राहत की मांग:
मैं विनम्रतापूर्वक अनुरोध करता/करती हूँ कि आपका कार्यालय कृपया:
1. उपरोक्त शिकायत की समय-सीमा में जांच करे।
2. संबंधित विभाग/अधिकारी को तत्काल सुधारात्मक कार्रवाई के निर्देश दे।
3. मुझे लिखित पावती और कृत कार्रवाई की जानकारी प्रदान करे।

आपके त्वरित हस्तक्षेप के लिए अत्यंत आभारी रहूँगा/रहूँगी।

धन्यवाद,
भवदीय,

[आपका पूरा नाम]
[पुत्र/पुत्री/पत्नी: ____________________]
[पूरा पता, पिन कोड सहित]
[मोबाइल नंबर]
[आधार नंबर (केवल अंतिम 4 अंक): XXXX]
[दिनांक: ${today}]

संलग्नक:
1. संबंधित दस्तावेज / पहचान प्रमाण की प्रति
2. इस विषय पर पूर्व पत्राचार
3. [अन्य सहायक दस्तावेज]`;

  const kn = `ದಿನಾಂಕ: ${today}

ಗೆ,
${auth}

ವಿಷಯ: ಔಪಚಾರಿಕ ದೂರು — ${documentContext.slice(0, 80)}

ಮಹೋದಯ/ಮಹೋದಯೆ,

ನಾನು, ಕೆಳಗೆ ಸಹಿ ಮಾಡಿದ, [ನಿಮ್ಮ ನಗರ/ಗ್ರಾಮ, ರಾಜ್ಯ] ದ ನಿವಾಸಿಯಾಗಿ, ಈ ಕೆಳಗಿನ ವಿಷಯವನ್ನು ನಿಮ್ಮ ಗಮನಕ್ಕೆ ತರಲು ಮತ್ತು ತಕ್ಷಣ ಪರಿಹಾರ ಕೋರಲು ವಿನಂತಿಸುತ್ತೇನೆ.

ದೂರಿನ ಸ್ವರೂಪ:
${userIntent}

ಸಮಸ್ಯೆಯ ವಿಸ್ತೃತ ವಿವರಣೆ:
${documentContext}
${details ? `\nಹೆಚ್ಚುವರಿ ವಿವರಗಳು:\n${details}\n` : ''}
ಪರಿಣಾಮ:
ಈ ಸಮಸ್ಯೆಯು ನನಗೆ ಮತ್ತು ನನ್ನ ಕುಟುಂಬಕ್ಕೆ ತುಂಬಾ ತೊಂದರೆ ಮತ್ತು ಅಸೌಕರ್ಯವನ್ನು ಉಂಟುಮಾಡಿದೆ. ಹಿಂದಿನ ಪ್ರಯತ್ನಗಳ ಹೊರತಾಗಿಯೂ ಸಮಸ್ಯೆ ಇನ್ನೂ ಬಗೆಹರಿದಿಲ್ಲ.

ಕೋರಿಕೆ / ಪರಿಹಾರ:
ಈ ಕೆಳಗಿನ ಕ್ರಮಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳಬೇಕೆಂದು ವಿನಂತಿಸುತ್ತೇನೆ:
1. ಮೇಲಿನ ದೂರನ್ನು ನಿಗದಿತ ಅವಧಿಯಲ್ಲಿ ತನಿಖೆ ಮಾಡಿ.
2. ಸಂಬಂಧಿಸಿದ ಇಲಾಖೆ/ಅಧಿಕಾರಿಗೆ ತಕ್ಷಣ ಸರಿಪಡಿಸುವ ಕ್ರಮ ತೆಗೆದುಕೊಳ್ಳಲು ನಿರ್ದೇಶಿಸಿ.
3. ಕೈಗೊಂಡ ಕ್ರಮದ ಬಗ್ಗೆ ಲಿಖಿತ ದೃಢೀಕರಣ ಮತ್ತು ಮಾಹಿತಿ ನೀಡಿ.

ನಿಮ್ಮ ತ್ವರಿತ ಹಸ್ತಕ್ಷೇಪಕ್ಕಾಗಿ ತುಂಬಾ ಆಭಾರಿ.

ವಂದನೆಗಳೊಂದಿಗೆ,
ನಿಮ್ಮ ವಿಶ್ವಾಸಿ,

[ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು]
[ಮಗ/ಮಗಳು/ಪತ್ನಿ: ____________________]
[ಸಂಪೂರ್ಣ ವಿಳಾಸ, ಪಿನ್ ಕೋಡ್ ಸಹಿತ]
[ಮೊಬೈಲ್ ಸಂಖ್ಯೆ]
[ಆಧಾರ್ ಸಂಖ್ಯೆ (ಕೊನೆಯ 4 ಅಂಕಿಗಳು ಮಾತ್ರ): XXXX]
[ದಿನಾಂಕ: ${today}]

ಲಗತ್ತುಗಳು:
1. ಸಂಬಂಧಿಸಿದ ದಾಖಲೆ / ಗುರುತಿನ ಪ್ರಮಾಣ ಪತ್ರದ ಪ್ರತಿ
2. ಈ ವಿಷಯದಲ್ಲಿ ಹಿಂದಿನ ಪತ್ರವ್ಯವಹಾರ
3. [ಇತರ ಬೆಂಬಲ ದಾಖಲೆಗಳು]`;

  const primaryDraft = language === 'hi' ? hi : language === 'kn' ? kn : en;
  return {
    document_type: 'Grievance Letter',
    subject: (language === 'hi' ? `औपचारिक शिकायत — ` : language === 'kn' ? `ಔಪಚಾರಿಕ ದೂರು — ` : `Formal Grievance — `) + documentContext.slice(0, 80),
    draft_content: primaryDraft,
    draft_content_english: en,
    draft_content_hindi: hi,
    draft_content_kannada: kn,
    key_sections_cited: [
      'CPGRAMS — cpgrams.gov.in (Online Grievance Portal)',
      'Consumer Protection Act 2019 (if applicable)',
      'RTI Act 2005 — Section 6 (for seeking related information)',
    ],
    next_steps: language === 'hi'
      ? [
          '[ ] से चिह्नित सभी स्थानों को भरें।',
          'संबंधित कार्यालय में व्यक्तिगत रूप से जमा करें — दिनांक मुहर वाली रसीद लें।',
          'ऑनलाइन भी दर्ज करें: pgportal.gov.in या CPGRAMS पर।',
          '30 दिनों में उत्तर न मिले तो जिला कलेक्टर / लोकायुक्त को अपील करें।',
          'सभी रसीदें और पत्राचार सुरक्षित रखें।',
        ]
      : language === 'kn'
      ? [
          '[ ] ಎಂದು ಗುರುತಿಸಲಾದ ಎಲ್ಲಾ ಸ್ಥಳಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ.',
          'ಸಂಬಂಧಿಸಿದ ಕಚೇರಿಯಲ್ಲಿ ವೈಯಕ್ತಿಕವಾಗಿ ಸಲ್ಲಿಸಿ — ದಿನಾಂಕ ಮುದ್ರೆ ರಸೀದಿ ಪಡೆಯಿರಿ.',
          'ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ: pgportal.gov.in ಅಥವಾ CPGRAMS ನಲ್ಲಿ ಸಲ್ಲಿಸಿ.',
          '30 ದಿನಗಳಲ್ಲಿ ಉತ್ತರ ಬಾರದಿದ್ದರೆ ಜಿಲ್ಲಾ ಕಲೆಕ್ಟರ್ / ಲೋಕಾಯುಕ್ತರಿಗೆ ಮೇಲ್ಮನವಿ ಸಲ್ಲಿಸಿ.',
          'ಎಲ್ಲಾ ರಸೀದಿಗಳು ಮತ್ತು ಪತ್ರವ್ಯವಹಾರಗಳನ್ನು ಸುರಕ್ಷಿತವಾಗಿ ಇಟ್ಟುಕೊಳ್ಳಿ.',
        ]
      : [
          'Fill in all placeholders marked with [ ] before submitting.',
          'Submit at the concerned department office in person — get a date-stamped receipt.',
          'Alternatively, file online at pgportal.gov.in or CPGRAMS.',
          'If no response within 30 days, escalate to District Collector / Lokayukta.',
          'Keep all receipts and correspondence safely.',
        ],
    generated_by: 'local_template',
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Unified AI processing controller.
 *
 * Handles two request types:
 * - `"document"`: Previously handled client-side OCR; now returns a descriptive redirect
 *   error to inform the client to use the `/api/simplify` endpoint instead.
 * - `"chat"`: Generates a conversational AI response using a 3-provider cascade:
 *   Groq → Gemini → HuggingFace → Demo Mode.
 *
 * @async
 * @param {import('express').Request} req - Express Request.
 *   @param {Object} req.body
 *   @param {'document'|'chat'} req.body.type - Processing mode.
 *   @param {string} [req.body.imageFile] - Base64 data URL (required for `document` type).
 *   @param {string} [req.body.text] - User query text (required for `chat` type).
 *   @param {string} [req.body.language='en'] - Language code (`en`, `hi`, `kn`).
 *   @param {string} [req.body.sessionId] - Optional session identifier for tracking.
 *   @param {boolean} [req.body.offlineMode=false] - If `true`, forces demo mode regardless of API config.
 * @param {import('express').Response} res - Express Response.
 * @returns {Promise<void>}
 * @throws Will return HTTP 400 for invalid request shapes, HTTP 429 for quota errors, HTTP 500 for unhandled failures.
 */
const aiProcess = async (req, res) => {
  try {
    const { type, imageFile, text, language = 'en', sessionId, offlineMode } = req.body;

    if (!type || !['document', 'chat'].includes(type)) {
      return res.status(400).json({ error: "Type must be 'document' or 'chat'" });
    }
    if (type === 'document' && !imageFile) {
      return res.status(400).json({ error: 'imageFile (base64) required for document processing' });
    }
    if (type === 'chat' && !text) {
      return res.status(400).json({ error: 'text required for chat' });
    }

    // Activate demo mode if no API keys are configured or if explicitly requested.
    const isApiConfigured = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
    const isDemoMode = offlineMode || !isApiConfigured;

    if (!isApiConfigured) {
      logger.warn('No AI API keys configured. Activating demo mode to prevent crash.');
    }

    if (isDemoMode) {
      if (type === 'document') {
        return res.json({ success: true, data: DEMO_DOCUMENT_RESPONSE, type: 'document', demo: true });
      }
      const demoReply = resolveDemoChatResponse(text, language);
      return res.json({
        success: true,
        reply: demoReply,
        language,
        sessionId: sessionId || 'demo',
        type: 'chat',
        demo: true,
      });
    }

    // ── DOCUMENT PROCESSING ─────────────────────────────────────────────────
    // Document uploads are now processed via client-side OCR → /api/simplify.
    if (type === 'document') {
      if (!imageFile.startsWith('data:')) {
        return res.status(400).json({ error: 'imageFile must be a valid base64 data URL' });
      }
      return res.status(400).json({
        success: false,
        error: '✨ File uploads now use smart OCR!',
        info: 'Your browser extracts text via OCR automatically. Please refresh and try again, or use the /api/simplify endpoint directly.',
      });
    }

    // ── CHAT PROCESSING — 3-Provider Cascade ──────────────────────────────
    if (type === 'chat') {
      const languageInstruction =
        language === 'hi'
          ? 'Respond in Hindi (हिन्दी). Use village-level, simple language.'
          : language === 'kn'
          ? 'Respond in Kannada (ಕನ್ನಡ). Use village-level, simple language.'
          : 'Respond in English. Use simple, village-level language.';

      const inferencePrompt = `${CHAT_SYSTEM_PROMPT}\n\n${languageInstruction}\n\nUser question: ${text}\n\nProvide a helpful, empathetic answer in the specified language. Keep it concise and practical.`;

      let generatedReply = null;
      let resolvedProvider = null;

      // 1. GROQ — primary provider.
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!generatedReply && groqApiKey && groqApiKey !== 'your_groq_key_here') {
        try {
          const groqClient = new Groq({ apiKey: groqApiKey });
          const groqCompletion = await groqClient.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: CHAT_SYSTEM_PROMPT },
              { role: 'user', content: inferencePrompt },
            ],
            max_tokens: 500,
            temperature: 0.7,
          });
          generatedReply = groqCompletion.choices[0].message.content;
          resolvedProvider = 'groq';
          logger.info('Chat inference resolved via Groq.');
        } catch (groqError) {
          logger.warn(`Groq chat inference failed: ${groqError.message}. Trying Gemini...`);
        }
      }

      // 2. GEMINI — secondary provider.
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!generatedReply && geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
        try {
          const geminiClient = new GoogleGenerativeAI(geminiApiKey);
          const geminiModel = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
          const geminiResult = await geminiModel.generateContent([{ text: inferencePrompt }]);
          generatedReply = geminiResult.response.text();
          resolvedProvider = 'gemini';
          logger.info('Chat inference resolved via Gemini 2.0 Flash.');
        } catch (geminiError) {
          logger.warn(`Gemini chat inference failed: ${geminiError.message}. Trying HuggingFace...`);
        }
      }

      // 3. HUGGINGFACE — tertiary provider.
      const hfApiKey = process.env.HUGGINGFACE_API_KEY;
      if (!generatedReply && hfApiKey && hfApiKey !== 'your_hf_key_here') {
        try {
          const hfClient = new HfInference(hfApiKey);
          const hfResult = await hfClient.textGeneration({
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            inputs: inferencePrompt,
            parameters: { max_new_tokens: 500, temperature: 0.7 },
          });
          generatedReply = hfResult.generated_text.split(inferencePrompt)[1] || hfResult.generated_text;
          resolvedProvider = 'huggingface';
          logger.info('Chat inference resolved via HuggingFace.');
        } catch (hfError) {
          logger.warn(`HuggingFace inference failed: ${hfError.message}.`);
        }
      }

      // 4. GITHUB MODELS — ultimate unmetered fallback.
      const githubToken = process.env.GITHUB_TOKEN;
      if (!generatedReply && githubToken && githubToken !== 'ghp_your_github_token_here') {
        try {
          const githubCompletion = await githubModelsClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: CHAT_SYSTEM_PROMPT },
              { role: 'user', content: inferencePrompt },
            ],
            max_tokens: 500,
            temperature: 0.7,
          });
          generatedReply = githubCompletion.choices[0].message.content;
          resolvedProvider = 'github';
          logger.info('Chat inference resolved via GitHub Models (GPT-4o-mini).');
        } catch (githubError) {
          logger.warn(`GitHub Models inference failed: ${githubError.message}. Falling back to demo mode.`);
        }
      }

      // 5. DEMO MODE — graceful final fallback.
      if (!generatedReply) {
        logger.info('All AI providers exhausted. Serving demo mode keyword-matched response.');
        generatedReply = resolveDemoChatResponse(text, language);
      }

      return res.json({
        success: true,
        reply: generatedReply,
        language,
        sessionId: sessionId || 'default',
        type: 'chat',
        provider: resolvedProvider || 'demo',
        fallback: !resolvedProvider,
      });
    }
  } catch (error) {
    logger.error(`aiProcess unhandled error: ${error.message}`, { stack: error.stack });

    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return res.status(429).json({
        error: 'API quota exceeded. Please try again in a few moments.',
        retryAfter: 60,
      });
    }

    res.status(500).json({
      error: error.message || 'AI processing failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Drafts a formal grievance letter, RTI request, or legal reply using AI.
 *
 * Uses a 2-provider cascade: Gemini (primary) → Groq (fallback).
 * After generating the English draft, the content is translated to Kannada or Hindi
 * via the Bhashini API if requested.
 *
 * @async
 * @param {import('express').Request} req - Express Request.
 *   @param {Object} req.body
 *   @param {string} req.body.documentContext - Context or subject of the grievance.
 *   @param {string} req.body.userIntent - The type of letter/action required.
 *   @param {string} [req.body.language='en'] - Target language (`en`, `hi`, `kn`).
 *   @param {string} [req.body.authority] - The authority the letter is addressed to.
 *   @param {string} [req.body.issueDetails] - Additional details about the issue.
 * @param {import('express').Response} res - Express Response.
 * @returns {Promise<void>}
 * @throws Will return HTTP 400 for missing fields, HTTP 500 if all AI providers fail.
 */
const draftGrievance = async (req, res) => {
  try {
    const { documentContext, userIntent, language = 'en', authority, issueDetails } = req.body;

    if (!documentContext || !userIntent) {
      return res.status(400).json({ error: 'documentContext and userIntent are required' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!geminiApiKey && !groqApiKey) {
      return res.status(500).json({ error: 'No AI API keys configured. Cannot draft grievance.' });
    }

    const grievanceUserMessage = `
### USER CONTEXT:
Document Type/Intent: ${userIntent}
Situation Context: ${documentContext}
Authority to Submit To: ${authority || 'Relevant Authority'}
Additional Details: ${issueDetails || 'As per document context'}

Draft the content natively in English, Hindi, and Kannada simultaneously. Return ONLY valid JSON matching the exact schema format defined in the system prompt.`;

    let rawAiDraftText = null;

    // 1. OPENROUTER — primary (free-tier Gemini 2.0, no daily token wall for user).
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    if (openRouterApiKey && openRouterApiKey !== 'YOUR_OPENROUTER_API_KEY') {
      const openRouterModels = [
        'google/gemini-2.0-flash-lite-preview-02-05:free',
        'google/gemma-3-27b-it:free',
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
      ];
      for (const orModel of openRouterModels) {
        try {
          logger.info(`Activating OpenRouter fallback for grievance drafting (model: ${orModel})...`);
          const openRouterCompletion = await openRouterClient.chat.completions.create({
            model: orModel,
            messages: [
              { role: 'system', content: GRIEVANCE_DRAFTING_PROMPT },
              { role: 'user', content: grievanceUserMessage },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 4096,
            temperature: 0.7,
          });
          rawAiDraftText = openRouterCompletion.choices[0]?.message?.content || null;
          if (rawAiDraftText) {
            logger.info(`Grievance drafting resolved via OpenRouter (${orModel}).`);
            break;
          }
        } catch (openRouterError) {
          if (openRouterError.status === 404) {
            logger.warn(`OpenRouter model '${orModel}' returned 404. Trying next...`);
            continue;
          }
          logger.warn(`OpenRouter grievance fallback failed (${orModel}): ${openRouterError.message}`);
        }
      }
    }

    // 2. GEMINI — secondary for grievance drafting.
    if (!rawAiDraftText && geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        const geminiClient = new GoogleGenerativeAI(geminiApiKey);
        const grievanceModel = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const geminiResult = await grievanceModel.generateContent([
          { text: GRIEVANCE_DRAFTING_PROMPT },
          { text: grievanceUserMessage },
        ]);
        rawAiDraftText = geminiResult.response.text();
        logger.info('Grievance drafting resolved via Gemini 2.0 Flash.');
      } catch (geminiError) {
        logger.warn(`Gemini grievance drafting failed: ${geminiError.message}.`);
      }
    }

    // 3. GROQ — tertiary fallback.
    if (!rawAiDraftText && groqApiKey && groqApiKey !== 'your_groq_key_here') {
      try {
        const groqClient = new Groq({ apiKey: groqApiKey });
        const groqCompletion = await groqClient.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: GRIEVANCE_DRAFTING_PROMPT },
            { role: 'user', content: grievanceUserMessage },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 4096,
          temperature: 0.7,
        });
        rawAiDraftText = groqCompletion.choices[0].message.content;
        logger.info('Grievance drafting resolved via Groq fallback.');
      } catch (groqError) {
        logger.error(`Groq grievance drafting also failed: ${groqError.message}`);
      }
    }

    // 4. GITHUB MODELS — ultimate unbreakable fallback for JSON generation.
    const githubToken = process.env.GITHUB_TOKEN;
    if (!rawAiDraftText && githubToken && githubToken !== 'YOUR_GITHUB_TOKEN') {
      try {
        const githubCompletion = await githubModelsClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: GRIEVANCE_DRAFTING_PROMPT },
            { role: 'user', content: grievanceUserMessage },
          ],
          response_format: { type: 'json_object' },
        });
        rawAiDraftText = githubCompletion.choices[0]?.message?.content || null;
        if (rawAiDraftText) {
          logger.info('Grievance drafting resolved via GitHub Models (gpt-4o-mini).');
        }
      } catch (githubError) {
        logger.error(`GitHub Models grievance fallback failed: ${githubError.message}`);
      }
    }

    // 4. LOCAL TEMPLATE ENGINE — guaranteed last resort, zero-dependency, always works.
    if (!rawAiDraftText) {
      logger.warn('All AI providers failed. Generating professional local template as guaranteed fallback.');
      const localDraft = generateLocalGrievanceTemplate({
        userIntent,
        documentContext,
        authority,
        issueDetails,
        language,
      });
      return res.json({ success: true, data: localDraft, source: 'local_template' });
    }

    let parsedDraft = extractJSON(rawAiDraftText);

    // Graceful degradation — if JSON parsing fails, return raw text wrapped in schema.
    if (!parsedDraft) {
      parsedDraft = {
        draft_content: rawAiDraftText,
        draft_content_english: rawAiDraftText,
        document_type: userIntent,
        subject: 'Drafted Grievance / Letter',
        key_sections_cited: [],
        next_steps: [
          'Review the draft carefully before submission.',
          'Sign the letter with blue or black ink.',
          'Keep a photocopy for your personal records.',
        ],
      };
    }

    // Bind primary draft_content based on requested language
    // (Local templates already set this appropriately, so we only need to do this for LLM JSON generation)
    if (!parsedDraft.generated_by && parsedDraft.draft_content_english) {
      if (language === 'hi' && parsedDraft.draft_content_hindi) {
        parsedDraft.draft_content = parsedDraft.draft_content_hindi;
      } else if (language === 'kn' && parsedDraft.draft_content_kannada) {
        parsedDraft.draft_content = parsedDraft.draft_content_kannada;
      } else {
        parsedDraft.draft_content = parsedDraft.draft_content_english;
      }
    }

    return res.json({ success: true, data: parsedDraft });
  } catch (error) {
    logger.error(`draftGrievance unhandled error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ error: error.message || 'Failed to draft grievance' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  aiProcess,
  draftGrievance,
  fileToBase64,
  getMimeType,
};
