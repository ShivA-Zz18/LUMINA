/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║      DOCUMENT SCANNER CONTROLLER — ROBUST PROCESSING     ║
 * ║   Handles: PDF, DOCX, Images with OCR & Fallback Logic  ║
 * ║   Now powered by Ollama (Free, Local, No API costs)      ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Groq } = require("groq-sdk");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const History = require("../models/History");
const VILLAGE_ASSISTANT_PROMPT = require("../prompts/villageAssistant");
const {
  simplifyDocumentWithOllama,
  getOllamaStatus,
  translateWithOllama,
  checkOllamaAvailability,
} = require("../utils/ollama");

// ═══════════════════════════════════════════════════════════
// MULTER STORAGE CONFIGURATION
// ═══════════════════════════════════════════════════════════

// Disk Storage: Persistent files for backup/audit
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created uploads directory: ${dir}`);
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${Date.now()}-${sanitized}`;
    cb(null, filename);
    console.log(`📤 FILE UPLOAD: Saving as ${filename}`);
  },
});

// Memory Storage: Fast processing, no disk I/O
const memoryStorage = multer.memoryStorage();

// Multer Configuration with validation
const upload = multer({
  storage: diskStorage, // Switch to memoryStorage if disk usage is a concern
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    console.log(`📋 FILE UPLOAD: Received file - ${file.originalname} (${file.mimetype})`);

    const allowedExts = /\.(jpeg|jpg|png|gif|webp|bmp|tiff|pdf|docx|doc)$/i;
    const allowedMimes = /image\/(jpeg|png|gif|webp|bmp|tiff)|application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/msword/;

    const ext = allowedExts.test(file.originalname.toLowerCase());
    const mime = allowedMimes.test(file.mimetype);

    if (!ext) {
      console.error(`❌ UPLOAD ERROR: Invalid extension - ${path.extname(file.originalname)}`);
      return cb(new Error(`Invalid file extension. Allowed: JPG, PNG, PDF, DOCX`));
    }

    if (!mime) {
      console.error(`❌ UPLOAD ERROR: Invalid MIME type - ${file.mimetype}`);
      return cb(new Error(`Invalid MIME type. Allowed: Images (JPG, PNG, WebP), PDF, Word`));
    }

    console.log(`✅ UPLOAD VALIDATION: File passed validation`);
    cb(null, true);
  },
});

// ═══════════════════════════════════════════════════════════
// HELPER: Buffer Cleanup (Remove null bytes & special chars)
// ═══════════════════════════════════════════════════════════
function cleanBufferText(text) {
  if (!text) return "";
  
  return text
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control characters
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\n\n\n+/g, "\n\n") // Remove excessive line breaks
    .trim();
}

// ═══════════════════════════════════════════════════════════
// PARSING STAGE 1: PDF Text Extraction
// ═══════════════════════════════════════════════════════════
async function extractPdfText(filePath) {
  try {
    console.log(`📖 PARSING: PDF - Starting extraction from ${filePath}`);
    const buffer = fs.readFileSync(filePath);
    console.log(`📖 PARSING: PDF - Read ${buffer.length} bytes`);

    const data = await pdfParse(buffer);
    console.log(`📖 PARSING: PDF - Extracted ${data.text.length} characters`);

    const cleanedText = cleanBufferText(data.text);
    console.log(`📖 PARSING: PDF - After cleanup: ${cleanedText.length} characters`);

    if (cleanedText.length < 10) {
      throw new Error("PDF contains less than 10 characters. May be a scanned document or corrupted.");
    }

    return cleanedText;
  } catch (error) {
    console.error(`❌ PARSING ERROR (PDF): ${error.message}`);
    throw new Error(`PDF parsing failed: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// PARSING STAGE 2: DOCX Text Extraction
// ═══════════════════════════════════════════════════════════
async function extractDocxText(filePath) {
  try {
    console.log(`📄 PARSING: DOCX - Starting extraction from ${filePath}`);
    const result = await mammoth.extractRawText({ path: filePath });
    console.log(`📄 PARSING: DOCX - Extracted ${result.value.length} characters`);

    const cleanedText = cleanBufferText(result.value);
    console.log(`📄 PARSING: DOCX - After cleanup: ${cleanedText.length} characters`);

    if (cleanedText.length < 10) {
      throw new Error("DOCX contains less than 10 characters");
    }

    if (result.messages.length > 0) {
      console.warn(`⚠️ PARSING WARNING (DOCX): ${result.messages.join(", ")}`);
    }

    return cleanedText;
  } catch (error) {
    console.error(`❌ PARSING ERROR (DOCX): ${error.message}`);
    throw new Error(`DOCX parsing failed: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// PARSING STAGE 3: Image OCR (Tesseract.js)
// ═══════════════════════════════════════════════════════════
async function extractImageText(filePath) {
  try {
    console.log(`🖼️  PARSING: IMAGE OCR - Starting Tesseract recognition from ${filePath}`);

    // ── Pre-process with sharp: grayscale + contrast boost for better OCR
    const processedPath = filePath + "_pre.png";
    try {
      await sharp(filePath)
        .grayscale()          // Remove colour noise
        .linear(1.5, -0.2)   // Boost contrast (sharper text edges)
        .toFile(processedPath);
      console.log(`🖼️  PARSING: IMAGE OCR - sharp preprocessing done (grayscale + contrast)`);
    } catch (sharpErr) {
      console.warn(`⚠️  PARSING: sharp failed, using original — ${sharpErr.message}`);
    }

    const ocrTarget = require("fs").existsSync(processedPath) ? processedPath : filePath;

    const { data } = await Tesseract.recognize(ocrTarget, "eng+hin+kan", {
      logger: (m) => {
        if (m.status === "recognizing") {
          console.log(`🖼️  PARSING: IMAGE OCR - Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Clean up temp file silently
    try { require("fs").unlinkSync(processedPath); } catch {}

    const extractedText = data.text;
    console.log(`🖼️  PARSING: IMAGE OCR - Extracted ${extractedText.length} characters`);

    const cleanedText = cleanBufferText(extractedText);
    console.log(`🖼️  PARSING: IMAGE OCR - After cleanup: ${cleanedText.length} characters`);
    console.log(`🖼️  PARSING: IMAGE OCR - Confidence: ${Math.round(data.confidence)}%`);

    if (cleanedText.length < 10) {
      throw new Error("Image OCR extracted less than 10 characters");
    }

    return { text: cleanedText, confidence: data.confidence };
  } catch (error) {
    console.error(`❌ PARSING ERROR (IMAGE OCR): ${error.message}`);
    throw new Error(`Image OCR failed: ${error.message}`);
  }
}


// ═══════════════════════════════════════════════════════════
// HELPER: Detect File Type
// ═══════════════════════════════════════════════════════════
function getFileType(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if ([".pdf"].includes(ext)) return "pdf";
  if ([".docx", ".doc"].includes(ext)) return "docx";
  return "image";
}

// ═══════════════════════════════════════════════════════════
// HELPER: Convert buffer to base64 string
// ═══════════════════════════════════════════════════════════
function bufferToBase64(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return buffer; // Already a string
  }
  return buffer.toString("base64");
}

// ═══════════════════════════════════════════════════════════
// AI STAGE: Process IMAGE with Gemini Vision (OCR + Simplify + Translate, all in one)
// ═══════════════════════════════════════════════════════════
async function processImageWithGeminiVision(filePath) {
  try {
    console.log(`🤖 GEMINI VISION: Sending image directly to Gemini for OCR + Simplification...`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const imageBuffer = fs.readFileSync(filePath);
    const base64Data = imageBuffer.toString("base64");
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".bmp": "image/bmp", ".gif": "image/gif" };
    const mimeType = mimeMap[ext] || "image/jpeg";

    const prompt = `You are an expert at reading Indian government documents (Aadhaar, PAN, ration cards, land records, notices, etc.).

Look at this image carefully. Extract ALL text you can see, then simplify it for a rural Indian citizen.

Return ONLY valid JSON (no markdown, no extra text):
{
  "originalText": "<all text exactly as seen in the image>",
  "simplifiedText": "<clear English explanation a village elder would understand — bullet points welcome>",
  "simplifiedKannada": "<same simplified explanation in Kannada ಕನ್ನಡ script>",
  "simplifiedHindi": "<same simplified explanation in Hindi हिन्दी script>",
  "jargonTerms": [
    { "term": "<complex word>", "meaning": "<simple meaning in English>" }
  ],
  "documentType": "<e.g. Aadhaar Card, Land Notice, Ration Card>",
  "confidence": "high | medium | low",
  "warnings": "<any important caveats or action needed, or null>"
}

Rules:
- Use native Kannada script (ಕನ್ನಡ) and Hindi (हिन्दी) — no transliteration
- If image is blurry/unreadable, set originalText to "Unable to read" and confidence to "low"
- Always include at least a simplifiedText even if image quality is poor`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: base64Data } },
    ]);

    const responseText = result.response.text();
    console.log(`✅ GEMINI VISION: Success — ${responseText.length} characters`);
    return responseText;
  } catch (error) {
    console.error(`❌ GEMINI VISION ERROR: ${error.message}`);
    throw new Error(`Gemini Vision failed: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// AI STAGE: Process extracted text (PDF/DOCX) with Cloud AI
// Returns full JSON with English + Kannada + Hindi in ONE call
// ═══════════════════════════════════════════════════════════
async function processWithAI(extractedText, fileType) {
  try {
    console.log(`🤖 AI: Starting document processing with ${extractedText.length} characters`);

    const UNIFIED_PROMPT = `You are "Gaon Sahayak" (Village Helper), an expert at simplifying Indian government documents.

A ${fileType} has been uploaded with the following extracted text:
---
${extractedText.substring(0, 4000)}
---

Analyze the text above and return ONLY valid JSON (no markdown, no code blocks, no extra text):
{
  "originalText": "<first 500 chars of the key content>",
  "simplifiedText": "<clear English explanation for a village elder — use bullet points>",
  "simplifiedKannada": "<same explanation in Kannada ಕನ್ನಡ script — native script only, no transliteration>",
  "simplifiedHindi": "<same explanation in Hindi हिन्दी script — native script only, no transliteration>",
  "jargonTerms": [
    { "term": "<complex term>", "meaning": "<plain English meaning>" }
  ],
  "documentType": "<e.g. Aadhaar Card, Land Notice, Ration Card, Resume, Notice>",
  "confidence": "high | medium | low",
  "warnings": "<important notes or action required, or null>"
}

Rules:
- Include Kannada and Hindi translations always
- Use actual native scripts for Kannada (ಕನ್ನಡ) and Hindi (हिन्दी)
- Keep simplifiedText practical and easy to understand
- Maximum 6 jargonTerms`;

    // Try Gemini first (best quality)
    try {
      console.log(`🤖 AI: Attempting Gemini 2.0 Flash...`);
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== "your_gemini_api_key_here") {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([{ text: UNIFIED_PROMPT }]);
        const responseText = result.response.text();
        console.log(`✅ AI: Gemini 2.0 Flash succeeded — ${responseText.length} chars`);
        return responseText;
      }
    } catch (error) {
      console.warn(`⚠️ AI: Gemini failed — ${error.message}`);
    }

    // Fallback to Groq (llama-3.3-70b)
    try {
      console.log(`🤖 AI: Attempting Groq llama-3.3-70b fallback...`);
      const groqKey = process.env.GROQ_API_KEY;
      if (groqKey && groqKey !== "your_groq_key_here") {
        const groq = new Groq({ apiKey: groqKey });
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are a helpful document simplification assistant. Always respond with valid JSON only." },
            { role: "user", content: UNIFIED_PROMPT },
          ],
          max_tokens: 2048,
          temperature: 0.3,
          response_format: { type: "json_object" },
        });
        const responseText = response.choices[0].message.content;
        console.log(`✅ AI: Groq succeeded — ${responseText.length} chars`);
        return responseText;
      }
    } catch (error) {
      console.warn(`⚠️ AI: Groq failed — ${error.message}`);
    }

    throw new Error("No AI provider available (Gemini and Groq both failed)");
  } catch (error) {
    console.error(`❌ AI ERROR: ${error.message}`);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER: Parse LLM JSON Response
// ═══════════════════════════════════════════════════════════
function parseAIResponse(responseText) {
  try {
    console.log(`📝 PARSING AI RESPONSE: Attempting JSON extraction...`);
    const cleanJson = responseText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    console.log(`✅ PARSING AI RESPONSE: Successfully parsed JSON`);
    return parsed;
  } catch (error) {
    console.warn(`⚠️ PARSING AI RESPONSE: JSON parsing failed, using fallback format`);
    return {
      originalText: responseText,
      simplifiedText: responseText,
      simplifiedKannada: "",
      simplifiedHindi: "",
      jargonTerms: [],
      confidence: "low",
      warnings: "Could not parse AI response as JSON",
    };
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER: File Cleanup
// ═══════════════════════════════════════════════════════════
async function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️  CLEANUP: Deleted temporary file ${filePath}`);
    }
  } catch (error) {
    console.warn(`⚠️ CLEANUP WARNING: Could not delete ${filePath} - ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// MAIN CONTROLLER: Simplify Document
// ═══════════════════════════════════════════════════════════
const simplifyDocument = async (req, res) => {
  let filePath = null;
  let processingMethod = "unknown";
  
  try {
    console.log("\n" + "═".repeat(60));
    console.log("🚀 DOCUMENT SCANNER: Starting document processing");
    console.log("═".repeat(60));

    // ─────────────────────────────────────────────────────
    // STAGE 1: FILE UPLOAD VALIDATION
    // ─────────────────────────────────────────────────────
    if (!req.file) {
      console.error(`❌ UPLOAD STAGE: No file uploaded`);
      return res.status(400).json({ 
        error: "No file uploaded",
        stage: "upload",
      });
    }

    filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileType = getFileType(req.file);

    console.log(`✅ UPLOAD STAGE: File received - ${fileName} (${fileType})`);
    console.log(`   File size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   File path: ${filePath}`);

    // ─────────────────────────────────────────────────────
    // STAGE 2: TEXT PARSING (File → Text)
    // ─────────────────────────────────────────────────────
    console.log(`\n📂 PARSING STAGE: Starting based on file type...`);
    let extractedText = "";
    let confidence = "high";

    if (fileType === "pdf") {
      extractedText = await extractPdfText(filePath);
    } else if (fileType === "docx") {
      extractedText = await extractDocxText(filePath);
    } else {
      // ── IMAGE: Try Gemini Vision FIRST (best OCR quality)
      // Skip Tesseract entirely for image files
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
        console.log(`🤖 IMAGE: Using Gemini Vision for superior OCR + processing...`);
        try {
          const visionResponse = await processImageWithGeminiVision(filePath);
          // Vision API returns complete result — skip remaining AI + translation stages
          const parsed = parseAIResponse(visionResponse);
          extractedText = parsed.originalText || "Extracted via Gemini Vision";
          confidence = parsed.confidence || "high";

          // Save to history
          await History.create({
            originalText: cleanBufferText(extractedText),
            simplifiedText: parsed.simplifiedText || "",
            simplifiedKannada: parsed.simplifiedKannada || "",
            simplifiedHindi: parsed.simplifiedHindi || "",
            jargonTerms: parsed.jargonTerms || [],
            language: req.body.language || "en",
            dialect: req.body.dialect || "standard",
            imageUrl: `/uploads/${req.file.filename}`,
            confidence,
            sourceRef: fileName,
          });

          console.log(`\n✅ GEMINI VISION PIPELINE: Complete`);
          return res.json({
            success: true,
            data: {
              ...parsed,
              imageUrl: `/uploads/${req.file.filename}`,
              fileType,
              confidence,
              processingMethod: "gemini_vision",
              processingStages: {
                upload: "✅ Success",
                parsing: "✅ Gemini Vision (OCR + AI in one call)",
                ai: "✅ Gemini 2.0 Flash Vision",
                translation: "✅ Included in Vision response",
                database: "✅ Success",
              },
            },
          });
        } catch (visionErr) {
          console.warn(`⚠️ Gemini Vision failed, falling back to Tesseract: ${visionErr.message}`);
          const ocrResult = await extractImageText(filePath);
          extractedText = ocrResult.text;
          confidence = ocrResult.confidence < 60 ? "low" : ocrResult.confidence < 80 ? "medium" : "high";
        }
      } else {
        // No Gemini key — use Tesseract as fallback
        const ocrResult = await extractImageText(filePath);
        extractedText = ocrResult.text;
        confidence = ocrResult.confidence < 60 ? "low" : ocrResult.confidence < 80 ? "medium" : "high";
      }
    }

    console.log(`✅ PARSING STAGE: Successfully extracted text (${extractedText.length} chars, confidence: ${confidence})`);

    // ─────────────────────────────────────────────────────
    // STAGE 3: API KEY VALIDATION
    // ─────────────────────────────────────────────────────
    console.log(`\n🔑 API VALIDATION: Checking for available AI providers...`);
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if ((!geminiKey || geminiKey === "your_gemini_api_key_here") &&
        (!groqKey || groqKey === "your_groq_key_here")) {
      console.error(`❌ API VALIDATION: No valid API keys configured`);
      return res.status(500).json({
        error: "No AI API keys configured (Gemini or Groq required)",
        stage: "api_validation",
      });
    }

    console.log(`✅ API VALIDATION: Found available providers`);

    // ─────────────────────────────────────────────────────
    // STAGE 4: AI PROCESSING (CLOUD FIRST, OLLAMA FALLBACK)
    // ─────────────────────────────────────────────────────
    console.log(`\n🤖 AI PROCESSING STAGE: Starting AI processing...`);
    
    let aiResponse = null;
    let processingMethod = "unknown";

    try {
      // Try Cloud APIs first (Gemini/Groq) for speed
      console.log(`   Attempting Cloud API processing (Gemini/Groq)...`);
      try {
        aiResponse = await processWithAI(extractedText, fileType);
        processingMethod = "cloud_apis";
        console.log(`✅ CLOUD API: Successfully processed with Gemini/Groq`);
      } catch (cloudError) {
        console.warn(`⚠️ CLOUD API FAILED: ${cloudError.message}`);
        
        // Fallback to local Ollama if offline or cloud fails
        const ollamaAvailable = await checkOllamaAvailability();
        if (ollamaAvailable) {
          console.log(`\n🧠 OLLAMA: Using local LLM for fallback processing...`);
          aiResponse = await simplifyDocumentWithOllama(extractedText, fileType);
          processingMethod = "ollama_fallback";
          console.log(`✅ OLLAMA: Successfully processed with local model`);
        } else {
          throw new Error("Cloud APIs failed and Ollama is not available");
        }
      }
    } catch (error) {
      console.error(`❌ ALL AI PROCESSING FAILED: ${error.message}`);
      throw new Error(`AI Processing failed: ${error.message}`);
    }

    const parsed = parseAIResponse(aiResponse);

    console.log(`✅ AI PROCESSING STAGE: Successfully processed (method: ${processingMethod})`);


    // ─────────────────────────────────────────────────────
    // STAGE 5: TRANSLATION
    // If the AI already returned Kannada/Hindi (unified prompt), use them.
    // Only translate separately if they are missing.
    // ─────────────────────────────────────────────────────
    console.log(`\n🌍 TRANSLATION STAGE: Checking translations...`);

    const needsKannada = !parsed.simplifiedKannada || parsed.simplifiedKannada.length < 10;
    const needsHindi   = !parsed.simplifiedHindi   || parsed.simplifiedHindi.length < 10;

    if (!needsKannada && !needsHindi) {
      console.log(`✅ TRANSLATION STAGE: Already included in AI response — skipping extra API calls`);
    } else {
      try {
        // Ask Gemini/Groq to translate any missing languages quickly
        const missingLangs = [];
        if (needsKannada) missingLangs.push("Kannada (ಕನ್ನಡ)");
        if (needsHindi)   missingLangs.push("Hindi (हिन्दी)");
        console.log(`   Translating missing languages: ${missingLangs.join(", ")}`);

        const textToTranslate = (parsed.simplifiedText || parsed.originalText || "").substring(0, 600);
        const transPrompt = `Translate the following English text to ${missingLangs.join(" and ")}.
Return ONLY JSON: { ${needsKannada ? '"kannada": "<translation>"' : ''} ${needsKannada && needsHindi ? ',' : ''} ${needsHindi ? '"hindi": "<translation>"' : ''} }

Text: "${textToTranslate}"`;

        let transResult = null;
        try {
          const apiKey = process.env.GEMINI_API_KEY;
          if (apiKey && apiKey !== "your_gemini_api_key_here") {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const r = await model.generateContent([{ text: transPrompt }]);
            transResult = parseAIResponse(r.response.text());
          }
        } catch (e) { console.warn(`Translation via Gemini failed: ${e.message}`); }

        if (!transResult) {
          try {
            const groqKey = process.env.GROQ_API_KEY;
            if (groqKey && groqKey !== "your_groq_key_here") {
              const groq = new Groq({ apiKey: groqKey });
              const r = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: transPrompt }],
                max_tokens: 600,
                temperature: 0,
                response_format: { type: "json_object" },
              });
              transResult = JSON.parse(r.choices[0].message.content);
            }
          } catch (e) { console.warn(`Translation via Groq failed: ${e.message}`); }
        }

        if (transResult) {
          if (needsKannada && transResult.kannada) parsed.simplifiedKannada = transResult.kannada;
          if (needsHindi   && transResult.hindi)   parsed.simplifiedHindi   = transResult.hindi;
          console.log(`✅ TRANSLATION STAGE: Missing translations filled in`);
        } else {
          // Last resort: copy English
          if (needsKannada) parsed.simplifiedKannada = parsed.simplifiedText;
          if (needsHindi)   parsed.simplifiedHindi   = parsed.simplifiedText;
          console.warn(`⚠️ TRANSLATION STAGE: Fell back to English copy`);
        }
      } catch (error) {
        console.warn(`⚠️ TRANSLATION STAGE ERROR: ${error.message}`);
        if (needsKannada) parsed.simplifiedKannada = parsed.simplifiedText;
        if (needsHindi)   parsed.simplifiedHindi   = parsed.simplifiedText;
      }
    }

    // ─────────────────────────────────────────────────────
    // STAGE 6: DATABASE SAVE
    // ─────────────────────────────────────────────────────
    console.log(`\n💾 DATABASE STAGE: Saving history...`);
    const history = await History.create({
      originalText: cleanBufferText(extractedText) || "",
      simplifiedText: parsed.simplifiedText || parsed.originalText || "",
      simplifiedKannada: parsed.simplifiedKannada || "",
      simplifiedHindi: parsed.simplifiedHindi || "",
      jargonTerms: parsed.jargonTerms || [],
      language: req.body.language || "en",
      dialect: req.body.dialect || "standard",
      imageUrl: `/uploads/${req.file.filename}`,
      confidence: confidence,
      sourceRef: fileName,
    });

    console.log(`✅ DATABASE STAGE: Saved with ID ${history._id}`);

    // ─────────────────────────────────────────────────────
    // SUCCESS: Return response
    // ─────────────────────────────────────────────────────
    console.log(`\n✅ DOCUMENT SCANNER: Processing completed successfully`);
    console.log("═".repeat(60) + "\n");

    res.json({
      success: true,
      data: {
        ...parsed,
        historyId: history._id,
        imageUrl: `/uploads/${req.file.filename}`,
        fileType,
        confidence,
        processingMethod,
        processingStages: {
          upload: "✅ Success",
          parsing: "✅ Success",
          ai: "✅ Success (method: " + processingMethod + ")",
          translation: "✅ Success",
          database: "✅ Success",
        },
      },
    });

    // Cleanup after success (optional - keep for audit)
    // await cleanupFile(filePath);

  } catch (error) {
    console.error(`\n❌ DOCUMENT SCANNER: Processing failed`);
    console.error(`Error Message: ${error.message}`);
    console.error(`Error Stack: ${error.stack}`);
    console.error("═".repeat(60) + "\n");

    // Cleanup file on error
    if (filePath) {
      await cleanupFile(filePath);
    }

    res.status(500).json({
      error: error.message || "Failed to simplify document",
      stage: error.stage || "unknown",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// HELPER: Get Processing History
// ═══════════════════════════════════════════════════════════
const getHistory = async (_req, res) => {
  try {
    console.log(`📚 HISTORY: Fetching processing history...`);
    const history = await History.find().sort({ createdAt: -1 }).limit(20);
    console.log(`✅ HISTORY: Retrieved ${history.length} records`);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error(`❌ HISTORY ERROR: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// HELPER: Delete Single History Item
// ═══════════════════════════════════════════════════════════
const deleteHistory = async (req, res) => {
  try {
    console.log(`🗑️ HISTORY: Deleting record ${req.params.id}...`);
    const result = await History.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: "History record not found" });
    }
    
    // Optionally delete from disk
    if (result.imageUrl) {
      const imgPath = path.join(__dirname, "..", result.imageUrl);
      if (fs.existsSync(imgPath)) {
        try { fs.unlinkSync(imgPath); } catch (err) { console.warn(`Failed to delete image: ${err.message}`); }
      }
    }
    
    console.log(`✅ HISTORY: Deleted record ${req.params.id}`);
    res.json({ success: true, message: "Record deleted" });
  } catch (error) {
    console.error(`❌ DELETE HISTORY ERROR: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// HELPER: Clear All History
// ═══════════════════════════════════════════════════════════
const clearHistory = async (req, res) => {
  try {
    console.log(`🗑️ HISTORY: Clearing all records...`);
    const records = await History.find();
    
    for (const record of records) {
      if (record.imageUrl) {
        const imgPath = path.join(__dirname, "..", record.imageUrl);
        if (fs.existsSync(imgPath)) {
          try { fs.unlinkSync(imgPath); } catch (err) {}
        }
      }
    }
    
    await History.deleteMany({});
    console.log(`✅ HISTORY: Cleared all records`);
    res.json({ success: true, message: "All history cleared" });
  } catch (error) {
    console.error(`❌ CLEAR HISTORY ERROR: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { upload, simplifyDocument, getHistory, deleteHistory, clearHistory };
