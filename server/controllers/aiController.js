/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║           AI CONTROLLER — LINGO-BRIDGE CORE            ║
 * ║  Multi-Provider LLM (Groq → HuggingFace → Demo Mode)   ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

const { Groq } = require("groq-sdk");
const { HfInference } = require("@huggingface/inference");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const { translate } = require("../utils/bhashini");

// ═══════════════════════════════════════════════════════════
// SYSTEM PROMPTS — Multi-lingual Village-Level Guidance
// ═══════════════════════════════════════════════════════════

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

const GRIEVANCE_PROMPT = `### SYSTEM ROLE
You are a Senior Administrative Officer and Legal Draftsman expert in Indian Governance (RTI Act 2005, Public Grievance Portals, and Consumer Forum). Your goal is to draft formal, high-impact documents based on user input.

### INSTRUCTIONS:
1. CLASSIFY: Determine if the request is a (A) Formal Reply, (B) Grievance Letter, or (C) RTI Request.
2. STRUCTURE: 
   - Use standard Indian formal letter headers (To, From, Date, Subject).
   - For RTI: Use the specific "Form A" format; cite relevant sections of the RTI Act 2005.
   - For Grievances: Include a "Prayer" (what action you want taken) at the end.
3. TONE: Professional, firm, and respectful. Use administrative vocabulary (e.g., "perusal," "undersigned," "redressal").
4. LANGUAGE: Provide the output in the specified language requested by the User. If the user picks Kannada or Hindi, ensure the grammar is formal (Official/Sarkari style).

### SCHEMA OUTPUT (JSON ONLY):
{
  "document_type": "string",
  "subject": "string",
  "draft_content": "Full letter body in requested language with placeholders like [Name], [Date]",
  "key_sections_cited": ["string"],
  "next_steps": ["Step-by-step advice on where/how to submit"]
}`;

// ═══════════════════════════════════════════════════════════
// HELPER: Convert file to base64
// ═══════════════════════════════════════════════════════════

function fileToBase64(filePath) {
  const fileData = fs.readFileSync(filePath);
  return Buffer.from(fileData).toString("base64");
}

// ═══════════════════════════════════════════════════════════
// HELPER: Get MIME type from file
// ═══════════════════════════════════════════════════════════

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };
  return mimeTypes[ext] || "image/jpeg";
}

// ═══════════════════════════════════════════════════════════
// HELPER: Parse Gemini response (JSON extraction)
// ═══════════════════════════════════════════════════════════

function extractJSON(text) {
  try {
    // Remove markdown code fences
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN CONTROLLER: Unified AI Processing
// ── 1. Voice Assistant (Chat) ────────────────────────────────
const aiProcess = async (req, res) => {
  try {
    const { type, imageFile, text, language = "en", sessionId, offlineMode } = req.body;

    // Validate request
    if (!type || !["document", "chat"].includes(type)) {
      return res.status(400).json({ error: "Type must be 'document' or 'chat'" });
    }

    if (type === "document" && !imageFile) {
      return res.status(400).json({ error: "imageFile (base64) required for document processing" });
    }

    if (type === "chat" && !text) {
      return res.status(400).json({ error: "text required for chat" });
    }

    // ═══════════════════════════════════════════════════════════
    // OFFLINE DEMO MODE (No API calls needed - fully functional)
    // ═══════════════════════════════════════════════════════════
    let isDemo = offlineMode || false; // Set to false to use real Gemini API

    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY && !isDemo) {
      console.warn("⚠️ AI API Keys missing! Reverting to Demo Mode to prevent crash.");
      isDemo = true;
    }

    if (isDemo) {
      // Document processing demo
      if (type === "document") {
        const demoData = {
          originalText: "This is a demo document showing how simplification works.",
          simplifiedText: "This is a simple document example.",
          simplifiedKannada: "ಇದು ಸರಳೀಕರಣ ಹೇಗೆ ಕಾಗುತ್ತದೆ ಎಂಬುದನ್ನು ತೋರಿಸುವ ಸರಳ ದಾಖಲೆ ಉದಾಹರಣೆ.",
          simplifiedHindi: "यह एक साधारण दस्तावेज उदाहरण है।",
          documentType: "Demo Document",
          confidence: "high",
          warnings: "This is demo mode - API not configured"
        };
        return res.json({ success: true, data: demoData, type: "document", demo: true });
      }

      // Chat processing demo
      if (type === "chat") {
        const demoChats = {
          en: {
            schemes: "Common government schemes include: 1) Pradhan Mantri Jan Dhan Yojana (bank accounts), 2) Ayushman Bharat (health insurance), 3) Mudra Loan (business loans). Visit your nearest Jan Seva Kendra for details.",
            documents: "Government documents like Ration Cards, Aadhaar, and Land Notices can be confusing. Would you like me to explain a specific document?",
            rights: "You have rights! These include: Right to Information, Right to Education, Right to Work. Contact your local authorities for help.",
            default: "Hello! I'm here to help explain government schemes, documents, and your rights. What would you like to know?"
          },
          hi: {
            schemes: "सामान्य सरकारी योजनाएं हैं: 1) प्रधान मंत्री जन धन योजना (बैंक खाते), 2) आयुष्मान भारत (स्वास्थ्य बीमा), 3) मुद्रा ऋण (व्यावसायिक ऋण)। विवरण के लिए अपने निकटतम जन सेवा केंद्र पर जाएं।",
            documents: "राशन कार्ड, आधार और भूमि नोटिस जैसे सरकारी दस्तावेज भ्रामक हो सकते हैं। क्या आप किसी विशिष्ट दस्तावेज़ की व्याख्या चाहते हैं?",
            rights: "आपके अधिकार हैं! इनमें शामिल हैं: सूचना का अधिकार, शिक्षा का अधिकार, काम का अधिकार। मदद के लिए अपने स्थानीय अधिकारियों से संपर्क करें।",
            default: "नमस्ते! मैं सरकारी योजनाओं, दस्तावेजों और आपके अधिकारों को समझाने में मदद करने के लिए यहां हूं। आप क्या जानना चाहते हैं?"
          },
          kn: {
            schemes: "ಸಾಮಾನ್ಯ ಸರಕಾರಿ ಯೋಜನೆಗಳು: 1) ಪ್ರಧಾನ ಮಂತ್ರಿ ಜನ ಧನ ಯೋಜನೆ (ಬ್ಯಾಂಕ್ ಖಾತೆಗಳು), 2) ಆಯುಷ್ಮಾನ್ ಭಾರತ (ಆರೋಗ್ಯ ವಿಮೆ), 3) ಮುದ್ರಾ ಋಣ (ವ್ಯವಹಾರ ಋಣ). ವಿವರಗಳಿಗಾಗಿ ನಿಮ್ಮ ಹತ್ತಿರದ ಜನ ಸೇವಾ ಕೇಂದ್ರಕ್ಕೆ ಭೇಟಿ ನೀಡಿ.",
            documents: "ರೇಷನ್ ಕಾರ್ಡ್, ಆಧಾರ್ ಮತ್ತು ಭೂಮಿ ಸೂಚನೆಗಳಂತಹ ಸರಕಾರಿ ದಾಖಲೆಗಳು ಗೊಂಬೆಯಾಗಿರಬಹುದು. ನೀವು ನಿರ್ದಿಷ್ಟ ದಾಖಲೆಯನ್ನು ವಿವರಿಸಲು ಬಯಸುತ್ತೀರಾ?",
            rights: "ನಿನಗೆ ಅಧಿಕಾರವಿದೆ! ಇವುಗಳು ಸೇರಿವೆ: ಮಾಹಿತಿ ಹಕ್ಕು, ಶಿಕ್ಷೆಯ ಹಕ್ಕು, ಕಾಮ ಹಕ್ಕು. ಸಹಾಯಿಗಾಗಿ ನಿಮ್ಮ ಸ್ಥಳೀಯ ಅಧಿಕಾರಿಗಳ ಸಂಪರ್ಕಿಸಿ.",
            default: "ನಮಸ್ಕಾರ! ನಾನು ಸರಕಾರಿ ಯೋಜನೆಗಳು, ದಾಖಲೆಗಳು ಮತ್ತು ನಿಮ್ಮ ಅಧಿಕಾರಗಳನ್ನು ವಿವರಿಸಲು ಸಹಾಯ ಮಾಡಲು ಇಲ್ಲಿದ್ದೇನೆ. ನೀವು ಏನನ್ನು ತಿಳಿದುಕೊಳ್ಳಲು ಬಯಸುತ್ತೀರಿ?"
          }
        };

        // Select appropriate response based on keywords
        const lowerText = text.toLowerCase();
        let response;
        
        if (lowerText.includes("scheme") || lowerText.includes("योजना") || lowerText.includes("ಯೋಜನೆ")) {
          response = demoChats[language]?.schemes || demoChats.en.schemes;
        } else if (lowerText.includes("document") || lowerText.includes("दस्तावेज") || lowerText.includes("ದಾಖಲೆ")) {
          response = demoChats[language]?.documents || demoChats.en.documents;
        } else if (lowerText.includes("right") || lowerText.includes("अधिकार") || lowerText.includes("ಅಧಿಕಾರ")) {
          response = demoChats[language]?.rights || demoChats.en.rights;
        } else {
          response = demoChats[language]?.default || demoChats.en.default;
        }

        return res.json({
          success: true,
          reply: response,
          language,
          sessionId: sessionId || "demo",
          type: "chat",
          demo: true,
          message: "Demo mode - No API key required for testing"
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // REAL API MODE (only if API key is properly configured)
    // ═══════════════════════════════════════════════════════════
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return res.status(500).json({ 
        error: "API key not configured - Running in Demo Mode",
        solution: "Get a working API key from https://makersuite.google.com/app/apikey"
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Try latest model first, fallback to alternatives
    let model;
    try {
      model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    } catch {
      try {
        model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
      } catch {
        model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      }
    }

    // ─────────────────────────────────────────────────────
    // DOCUMENT PROCESSING (Vision)
    // ─────────────────────────────────────────────────────
    if (type === "document") {
      if (!imageFile.startsWith("data:")) {
        return res.status(400).json({ error: "imageFile must be a valid base64 data URL" });
      }

      // This endpoint is no longer used since we use client-side OCR now
      // But keeping for backward compatibility
      return res.status(400).json({
        success: false,
        error: "✨ File uploads now use smart OCR!",
        info: "Your browser is extracting text from the image automatically using OCR. If you see this, please refresh the page and try again."
      });
    }

    // ─────────────────────────────────────────────────────
    // CHAT PROCESSING (Text) - Multi-Provider Fallback
    // ─────────────────────────────────────────────────────
    if (type === "chat") {
      const langInstruction =
        language === "hi"
          ? "Respond in Hindi (हिन्दी). Use village-level, simple language."
          : language === "kn"
          ? "Respond in Kannada (ಕನ್ನಡ). Use village-level, simple language."
          : "Respond in English. Use simple, village-level language.";

      const fullPrompt = `${CHAT_SYSTEM_PROMPT}\n\n${langInstruction}\n\nUser question: ${text}\n\nProvide a helpful, empathetic answer in the specified language. Keep it concise and practical.`;

      let reply = null;
      let provider = null;

      // ═══════════════════════════════════════════════════
      // TRY 1: GROQ API (Primary - Unlimited Free)
      // ═══════════════════════════════════════════════════
      if (!reply) {
        try {
          const groqKey = process.env.GROQ_API_KEY;
          if (groqKey && groqKey !== "your_groq_key_here") {
            const groq = new Groq({ apiKey: groqKey });
            const groqReply = await groq.chat.completions.create({
              model: "llama-3.3-70b-versatile", // Updated: mixtral-8x7b-32768 was decommissioned
              messages: [
                { role: "system", content: CHAT_SYSTEM_PROMPT },
                { role: "user", content: fullPrompt }
              ],
              max_tokens: 500,
              temperature: 0.7
            });
            reply = groqReply.choices[0].message.content;
            provider = "groq";
            console.log("✅ Using Groq API");
          }
        } catch (groqError) {
          console.warn("⚠️ Groq failed, trying HuggingFace:", groqError.message);
        }
      }

      // ═══════════════════════════════════════════════════
      // TRY 2: GEMINI API (Second Choice)
      // ═══════════════════════════════════════════════════
      if (!reply) {
        try {
          const geminiKey = process.env.GEMINI_API_KEY;
          if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const geminiResult = await geminiModel.generateContent([{ text: fullPrompt }]);
            reply = geminiResult.response.text();
            provider = "gemini";
            console.log("✅ Using Gemini 2.0 Flash for chat");
          }
        } catch (geminiError) {
          console.warn("⚠️ Gemini chat failed, trying HuggingFace:", geminiError.message);
        }
      }

      // ═══════════════════════════════════════════════════
      // TRY 3: HUGGING FACE API (Backup)
      // ═══════════════════════════════════════════════════
      if (!reply) {
        try {
          const hfKey = process.env.HUGGINGFACE_API_KEY;
          if (hfKey && hfKey !== "your_hf_key_here") {
            const hf = new HfInference(hfKey);
            const hfReply = await hf.textGeneration({
              model: "mistralai/Mistral-7B-Instruct-v0.1",
              inputs: fullPrompt,
              parameters: {
                max_new_tokens: 500,
                temperature: 0.7
              }
            });
            reply = hfReply.generated_text.split(fullPrompt)[1] || hfReply.generated_text;
            provider = "huggingface";
            console.log("✅ Using HuggingFace API");
          }
        } catch (hfError) {
          console.warn("⚠️ HuggingFace failed, using demo mode:", hfError.message);
        }
      }

      // ═══════════════════════════════════════════════════
      // FALLBACK: Demo Mode with Smart Keyword Matching
      // ═══════════════════════════════════════════════════
      if (!reply) {
        console.log("ℹ️ Using demo mode with keyword matching");
        
        // Enhanced demo responses with keyword matching
        const demoResponses = {
          en: {
            scholarship: "Scholarships available: 1) National Scholarship Portal (NSP) - for merit & SC/ST students, 2) Post-Matric Scholarship - for OBC & minority students, 3) PJMS/Atal Scholarship - for girls. Apply on scholarships.gov.in",
            student: "For students: Look into AICTE scholarships, NHEQF schemes, and college-specific aid. Government also offers schemes for girl education like Sukanya Samriddhi Yojana.",
            loan: "Loans available: 1) Mudra Loan (₹50,000 to ₹10 lakh for business), 2) Student loans with subsidy, 3) PM Loans for dairy/agriculture. Contact your nearest bank or Government office.",
            health: "Health schemes: 1) Ayushman Bharat (free treatment up to ₹5 lakh), 2) PMJAY (PM-JAY), 3) Jeevan Bima Yojana (₹2 lakh life insurance). Register at your nearest health center.",
            pension: "Pensions: 1) APY (Atal Pension Yojana) - ₹1000 to ₹5000/month, 2) Widow pension, 3) Old age pension (₹500-₹2000/month by state). Apply through local government office.",
            grievance: "File grievance through: 1) CPGRAMS portal (cpgrams.gov.in), 2) RTI Act for information, 3) Local Ombudsman office. Provide clear details and supporting documents.",
            rti: "RTI (Right to Information): You can ask for ANY government record. Apply to concerned department with ₹10 fee. Response within 30 days. No reason needed!",
            default: "Common schemes: Pradhan Mantri Jan Dhan (bank accounts), Ayushman Bharat (health), Mudra Loans (business). Tell me specifically what you need!"
          },
          hi: {
            scholarship: "छात्रवृत्ति उपलब्ध हैं: 1) राष्ट्रीय छात्रवृत्ति पोर्टल - मेधावी व SC/ST छात्र, 2) अन्य पिछड़ा वर्ग छात्रवृत्ति, 3) लड़कियों के लिए PJMS। scholarships.gov.in पर आवेदन करें।",
            student: "छात्रों के लिए: AICTE छात्रवृत्ति, सुकन्या समृद्धि योजना (लड़कियों के लिए), और कॉलेज स्कॉलरशिप देखें।",
            loan: "ऋण: 1) मुद्रा लोन (₹50,000 से ₹10 लाख व्यापार के लिए), 2) छात्र ऋण, 3) कृषि ऋण। अपने बैंक से संपर्क करें।",
            health: "स्वास्थ्य योजनाएं: 1) आयुष्मान भारत (₹5 लाख तक मुफ्त इलाज), 2) PMJAY, 3) जीवन बीमा योजना। आपके स्वास्थ्य केंद्र पर पंजीकरण करें।",
            pension: "पेंशन: 1) APY (₹1000 से ₹5000 मासिक), 2) विधवा पेंशन, 3) वृद्धावस्था पेंशन। अपने ग्राम कार्यालय में आवेदन करें।",
            grievance: "शिकायत दर्ज करें: 1) CPGRAMS पोर्टल पर, 2) RTI से जानकारी मांगें, 3) लोकपाल कार्यालय। स्पष्ट विवरण दें।",
            rti: "सूचना का अधिकार (RTI): आप किसी भी सरकारी रिकॉर्ड के बारे में पूछ सकते हैं। ₹10 फीस के साथ आवेदन करें। 30 दिनों में उत्तर मिलना चाहिए!",
            default: "सामान्य योजनाएं: प्रधान मंत्री जन धन (बैंक), आयुष्मान भारत (स्वास्थ्य), मुद्रा लोन (व्यापार)। मुझे बताएं कि आपको क्या चाहिए!"
          },
          kn: {
            scholarship: "ವೃತ್ತಿ ನಿಮಗಿರುತ್ತದೆ: 1) ರಾಷ್ಟ್ರೀಯ ವೃತ್ತಿ ಪೋರ್ಟಲ್, 2) OBC ವೃತ್ತಿ, 3) ಹುಡುಗಿಯರಿಗೆ PJMS। scholarships.gov.in ನಲ್ಲಿ ಅರ್ಜಿ ಹಾಕಿ।",
            student: "ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ: AICTE ವೃತ್ತಿ, ಸುಕನ್ಯ ಸಮೃದ್ಧಿ ಯೋಜನೆ (ಹುಡುಗಿಯರಿಗೆ), ಮತ್ತು ಕಾಲೇಜು ವಿಶೇಷ ನಿಮಗಿರುತ್ತದೆ ನೋಡಿ।",
            loan: "ಸಾಲ: 1) ಮುದ್ರಾ ಲೋನ್ (ವ್ಯಾಪಾರಕ್ಕೆ), 2) ವಿದ್ಯಾರ್ಥಿ ಸಾಲ, 3) ಕೃಷಿ ಸಾಲ। ನಿಮ್ಮ ಬ್ಯಾಂಕಿಗೆ ಸೇರಿಸಿ।",
            health: "ಆರೋಗ್ಯ ಯೋಜನೆಗಳು: 1) ಆಯುಷ್ಮಾನ್ ಭಾರತ (₹5 ಲಕ್ಷ ಮುಕ್ತ ಚಿಕಿತ್ಸೆ), 2) PMJAY, 3) ಜೀವನ ವಿಮೆ ಯೋಜನೆ।",
            pension: "ಪಿಂಚಣಿ: 1) APY (₹1000 ರಿಂದ ₹5000 ಮಾಸಿಕ), 2) ವಿಧವೆ ಪಿಂಚಣಿ, 3) ವೃದ್ಧಾವಸ್ಥೆ ಪಿಂಚಣಿ।",
            grievance: "ನಿಂದೆ ದಾಖಲು ಮಾಡಿ: 1) CPGRAMS ನಲ್ಲಿ, 2) RTI ಮೂಲಕ, 3) ಲೋಕಪಾಲ ಕಚೇರಿಯಲ್ಲಿ।",
            rti: "ಮಾಹಿತಿಯ ಹಕ್ಕು (RTI): ವಿವರಣೆ ಇಲ್ಲದೆ ಯಾವುದೇ ಸರಕಾರಿ ದಾಖಲೆ ಕೇಳಬಹುದು। ₹10 ಫೀಸ್ ನೊಂದಿಗೆ ಅರ್ಜಿ.",
            default: "ಸಾಮಾನ್ಯ ಯೋಜನೆಗಳು: ಪ್ರಧಾನ ಮಂತ್ರಿ ಜನ ಧನ, ಆಯುಷ್ಮಾನ್ ಭಾರತ, ಮುದ್ರಾ ಲೋನ್। ನಿಮಗೆ ಪ್ರಯೋಜನವಾಗುತ್ತದೆ ಹೇಳಿ!"
          }
        };

        const lowerText = text.toLowerCase();
        const responses = demoResponses[language] || demoResponses['en'];
        let response = responses.default;

        // Match keywords with responses
        if (lowerText.match(/scholarship|छात्रवृत्ति|ವೃತ್ತಿ|nsp|nheqf|pjms/i)) {
          response = responses.scholarship;
        } else if (lowerText.match(/student|छात्र|విద్యార్థి|exam|college|पढाई/i)) {
          response = responses.student;
        } else if (lowerText.match(/loan|ऋण|ಸಾಲ|mudra|business|व्यापार/i)) {
          response = responses.loan;
        } else if (lowerText.match(/health|स्वास्थ्य|ಆರೋಗ್ಯ|ayushman|treatment|चिकित्सा/i)) {
          response = responses.health;
        } else if (lowerText.match(/pension|पेंशन|ಪಿಂಚಣಿ|apy|old age|बुजुर्ग/i)) {
          response = responses.pension;
        } else if (lowerText.match(/grievance|शिकायत|ನಿಂದೆ|complaint|cpgrams/i)) {
          response = responses.grievance;
        } else if (lowerText.match(/rti|information|सूचना|ಮಾಹಿತಿ|rights/i)) {
          response = responses.rti;
        }

        return res.json({
          success: true,
          reply: response,
          language,
          sessionId: sessionId || "default",
          type: "chat",
          provider: provider || "demo",
          fallback: !provider
        });
      }

      // This should never be reached, but just in case
      return res.json({
        success: true,
        reply: reply || "Unable to generate response. Please try again.",
        language,
        sessionId: sessionId || "default",
        type: "chat",
        provider: provider || "fallback"
      });
    }
  } catch (error) {
    console.error("AI Processing Error:", error);

    // Handle API rate limits gracefully
    if (error.message?.includes("429") || error.message?.includes("quota")) {
      return res.status(429).json({
        error: "API quota exceeded. Please try again in a few moments.",
        retryAfter: 60,
      });
    }

    res.status(500).json({
      error: error.message || "AI processing failed",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// GRIEVANCE DRAFTING
// ═══════════════════════════════════════════════════════════

const draftGrievance = async (req, res) => {
  try {
    const {
      documentContext,
      userIntent,
      language = "en",
      authority,
      issueDetails,
    } = req.body;

    if (!documentContext || !userIntent) {
      return res.status(400).json({
        error: "documentContext and userIntent are required",
      });
    }

    // ═══════════════════════════════════════════════════════════
    // OFFLINE DEMO MODE FOR GRIEVANCE
    // ═══════════════════════════════════════════════════════════
    const OFFLINE_DEMO_MODE = false; // Use real AI (Gemini / Groq)

    if (OFFLINE_DEMO_MODE) {
      const demoLetters = {
        en: `[Date: ${new Date().toLocaleDateString()}]

To,
${authority || "Relevant Authority"}

Subject: Formal Complaint Regarding [Issue]

Dear Sir/Madam,

I am writing to formally lodge a complaint regarding the matter detailed below:

Context: ${documentContext}
Issue: ${userIntent}
Details: ${issueDetails || "As mentioned above"}

I request you to kindly review this matter and take appropriate action as per the rules and regulations.

Thanking you for your immediate attention to this matter.

Yours faithfully,
[Your Name]
[Your Contact]
[Date]`,
        hi: `[तारीख: ${new Date().toLocaleDateString('hi-IN')}]

को,
${authority || "संबंधित प्राधिकार"}

विषय: [समस्या] के संबंध में औपचारिक शिकायत

प्रिय महोदय/महोदया,

मैं नीचे दी गई समस्या के संबंध में एक औपचारिक शिकायत दर्ज करने के लिए लिख रहा हूँ:

संदर्भ: ${documentContext}
समस्या: ${userIntent}
विवरण: ${issueDetails || "जैसा कि ऊपर उल्लेख है"}

मैं आपसे अनुरोध करता हूँ कि इस मामले की समीक्षा करें और नियमों के अनुसार उचित कार्रवाई करें।

इस महत्वपूर्ण मामले पर आपके तत्काल ध्यान के लिए धन्यवाद।

आपका विश्वासपात्र,
[आपका नाम]
[आपका संपर्क]
[तारीख]`,
        kn: `[ದಿನಾಂಕ: ${new Date().toLocaleDateString()}]

ಕಿ,
${authority || "ಸಂಬಂಧಿತ ಅಧಿಕಾರ"}

ವಿಷಯ: [ಸಮಸ್ಯೆ] ಸಂಬಂಧಿ ಔಪಚಾರಿಕ ದೂರು

ಮೆಹೆಬೊ/ಮೆಹೆಬೆ,

ನಾನು ಕೆಳಗಿನ ಸಮಸ್ಯೆ ಸಂಬಂಧಿ ಔಪಚಾರಿಕ ದೂರು ಸಲ್ಲಿಸಲು ಬರೆತಿದ್ದೇನೆ:

ಸಂದರ್ಭ: ${documentContext}
ಸಮಸ್ಯೆ: ${userIntent}
ವಿವರಣೆ: ${issueDetails || "ಮೇಲಿನಲ್ಲಿ ಹೇಳಿದಂತೆ"}

ಈ ವಿಷಯವನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ನಿಯಮಾವಳಿ ಅನುಸಾರ ಸೂಕ್ತ ನಿರ್ವಾಹಕ ದೃಷ್ಟಿಕೋನವನ್ನು ತೆಗೆದುಕೊಳ್ಳುವಂತೆ ನನ್ನ ಅನುರೋಧವಾಗಿದೆ.

ಈ ಪರಿಸ್ಥಿತಿಗೆ ಆಪಣೆ ಅವಧಾನ ಕೊಡಿದಿರಲು ಕೃತಜ್ಞತೆ.

ನಿಮ್ಮ ವಿಶ್ವಾಸಿ,
[ನಿಮ್ಮ ಹೆಸರು]
[ನಿಮ್ಮ ಸಂಪರ್ಕ]
[ದಿನಾಂಕ]`
      };

      const response = {
        success: true,
        draftLetter: demoLetters[language] || demoLetters.en,
        draftLetterEnglish: demoLetters.en,
        letterType: userIntent,
        tips: [
          "Print the letter on plain paper",
          "Write the date and signature in blue or black ink",
          "Keep a copy for your records",
          "Submit to the authority with supporting documents",
          "Keep proof of submission (receipt or acknowledgment)"
        ],
        submitTo: authority || "Relevant Authority",
        disclaimer: "This is a template. Consult with a legal advisor for complex cases. This is demo mode only."
      };

      return res.json(response);
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (!geminiKey && !groqKey) {
      return res.status(500).json({ error: "No AI API Keys configured" });
    }

    const langInstruction = "Draft the content ENTIRELY in English. The final output must be pure English for processing in the next pipeline step.";

    const userMessage = `
### USER CONTEXT:
Document Type/Intent: ${userIntent}
Situation Context: ${documentContext}
Authority to Submit To: ${authority || "Relevant Authority"}
Additional Details: ${issueDetails || "As per document context"}

${langInstruction}

Return ONLY valid JSON matching the exact schema format requested in the system prompt.`;

    let rawReply = null;

    // TRY 1: GEMINI
    if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([
          { text: GRIEVANCE_PROMPT },
          { text: userMessage },
        ]);
        rawReply = result.response.text();
        console.log("✅ Grievance Drafting: Using Gemini 2.0 Flash");
      } catch (geminiErr) {
        console.warn("⚠️ Gemini API failed (likely quota limit), falling back to Groq...", geminiErr.message);
      }
    }

    // TRY 2: GROQ (Fallback)
    if (!rawReply && groqKey && groqKey !== "your_groq_key_here") {
      try {
        const groq = new Groq({ apiKey: groqKey });
        const groqReply = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: GRIEVANCE_PROMPT },
            { role: "user", content: userMessage }
          ],
          max_tokens: 4096,
          temperature: 0.7
        });
        rawReply = groqReply.choices[0].message.content;
        console.log("✅ Grievance Drafting: Using Groq API Fallback");
      } catch (groqErr) {
        console.warn("⚠️ Groq API also failed:", groqErr.message);
      }
    }

    if (!rawReply) {
      return res.status(500).json({ error: "Both Gemini and Groq APIs failed to generate a draft. Please check your API Quota limits." });
    }

    let parsed = extractJSON(rawReply);

    // Fallback
    if (!parsed) {
      parsed = {
        draft_content: rawReply,
        document_type: userIntent,
        next_steps: [
          "Review the draft carefully before submission.",
          "Get it signed by the person filing the complaint.",
          "Keep a photocopy for your records.",
        ],
        subject: "Drafted Grievance/Letter",
        key_sections_cited: []
      };
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: BHASHINI TRANSLATION
    // ─────────────────────────────────────────────────────────────
    if (parsed && parsed.draft_content && (language === "kn" || language === "hi")) {
      const targetDialect = language === "kn" ? "standard-kannada" : "standard-hindi";
      console.log(`[Bhashini Workflow] Translating draft_content to ${targetDialect}...`);
      
      const transResult = await translate(parsed.draft_content, "en", targetDialect);
      
      if (transResult.success && transResult.translatedText) {
        parsed.draft_content = transResult.translatedText;
      }
    }

    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error("Grievance Draft Error:", error);
    res.status(500).json({
      error: error.message || "Failed to draft grievance",
    });
  }
};

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  aiProcess,
  draftGrievance,
  fileToBase64,
  getMimeType,
};
