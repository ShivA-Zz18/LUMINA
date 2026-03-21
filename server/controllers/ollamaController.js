/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║     OLLAMA DOCUMENT SCANNER — LINGO-BRIDGE              ║
 * ║  Expert Data Extraction Agent for Indian Documents      ║
 * ║  Powered by Llama 3.2 (Local, Offline-First)            ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * Features:
 *  • Prompt Injection Shield  — triple-quote delimiters
 *  • Regex Pre-Processor      — validates ID formats; adjusts confidence
 *  • Graceful Fallback        — 503 when Ollama is not running
 *  • Zero temperature         — strictly factual, no hallucination
 */

const { Ollama } = require('ollama');

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

// ═══════════════════════════════════════════════════════════
// SYSTEM PROMPT — Expert Indian Document Parser
// ═══════════════════════════════════════════════════════════

const SCAN_SYSTEM_PROMPT = `### SYSTEM INSTRUCTIONS
You are a High-Precision Indian Document Parser. Your goal is to extract text from OCR and return ONLY a valid JSON object.

### STEP-BY-STEP REASONING PROCESS:
1. CLASSIFY: Identify the document type (Aadhaar, PAN, Voter ID, Resume, Marks Card, Ration Card, Land Notice, or Receipt).
2. CLEAN: Fix common Indian OCR errors:
   - '|' or 'l' → 'I' in names
   - '0' → 'O' in names where relevant
   - 'Kamataka' → 'Karnataka', 'Lndia' → 'India'
   - Remove stray symbols like é, ®, © that are OCR artifacts
3. MAP: Align data to the correct schema fields.
4. VALIDATE: If a field is missing or unreadable, set it to null. Do NOT hallucinate or invent data.

### OUTPUT FORMAT (STRICT JSON ONLY, NO MARKDOWN):
{
  "doc_type": "string",
  "extracted_data": {
    "full_name": "string or null",
    "id_number": "string or null",
    "date_of_birth": "DD-MM-YYYY or null",
    "address": "string or null",
    "gender": "Male | Female | Other | null",
    "skills": ["for resumes only, else []"],
    "education": ["for resumes only, else []"]
  },
  "confidence_score": 0
}

### EXAMPLE (IDENTITY CARD):
Input: "Govt of lndia AADHAR 9876 5432 1098 Raju Sharma DOB: 15/08/1985 Male Kamataka"
Output: {"doc_type":"Aadhaar","extracted_data":{"full_name":"Raju Sharma","id_number":"9876 5432 1098","date_of_birth":"15-08-1985","address":"Karnataka","gender":"Male","skills":[],"education":[]},"confidence_score":92}

### RULE: Return ONLY the JSON object. No explanations, no markdown, no code fences.`;

// ═══════════════════════════════════════════════════════════
// REGEX PRE-PROCESSOR — Validate ID Formats & Adjust Score
// ═══════════════════════════════════════════════════════════

/**
 * Validation rules per doc type.
 * Each rule has a regex test and a penalty if the extracted id_number fails.
 */
const ID_VALIDATORS = {
  Aadhaar: {
    // 12 digits, optionally space-separated in groups of 4
    pattern: /^\d{4}\s?\d{4}\s?\d{4}$/,
    description: 'Aadhaar must be exactly 12 digits',
  },
  PAN: {
    // Standard PAN: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
    pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    description: 'PAN must be 10 chars: AAAAA9999A format',
  },
  'Voter ID': {
    // Typical Voter ID: 3 letters + 7 digits (varies by state)
    pattern: /^[A-Z]{3}[0-9]{7}$/,
    description: 'Voter ID typically is 3 letters + 7 digits',
  },
};

/**
 * Validates the AI's extracted id_number against known Indian ID patterns.
 * Returns an adjusted confidence score and a list of validation notes.
 *
 * @param {string} docType
 * @param {string|null} idNumber
 * @param {number} aiScore   — base score returned by the model
 * @returns {{ finalScore: number, validationNotes: string[] }}
 */
function validateAndAdjustScore(docType, idNumber, aiScore) {
  const notes = [];
  let score = aiScore;

  const validator = ID_VALIDATORS[docType];

  if (!validator) {
    // Marks Card / Receipt / Unknown — no strict format rules
    return { finalScore: score, validationNotes: notes };
  }

  if (!idNumber) {
    score = Math.max(0, score - 20);
    notes.push(`ID number not found — confidence reduced`);
    return { finalScore: score, validationNotes: notes };
  }

  // Normalise: remove spaces for comparison
  const normalised = idNumber.replace(/\s/g, '');
  const testValue = docType === 'Aadhaar' ? idNumber.trim() : normalised;

  if (!validator.pattern.test(testValue)) {
    score = Math.max(0, score - 25);
    notes.push(`⚠ ${docType} format mismatch: "${idNumber}" — ${validator.description}`);
  } else {
    notes.push(`✔ ${docType} ID format validated successfully`);
  }

  return { finalScore: score, validationNotes: notes };
}

// ═══════════════════════════════════════════════════════════
// MAIN CONTROLLER — POST /api/ai/scan-document
// ═══════════════════════════════════════════════════════════

const scanDocument = async (req, res) => {
  const { ocrText } = req.body;

  if (!ocrText || typeof ocrText !== 'string' || !ocrText.trim()) {
    return res.status(400).json({
      success: false,
      error: 'ocrText is required and must be a non-empty string.',
    });
  }

  // ─────────────────────────────────────────────────────────
  // PROMPT INJECTION SHIELD
  // Wrap raw OCR text in triple-quote delimiters so that any
  // adversarial text (e.g. "Ignore previous instructions")
  // is clearly scoped as DATA, not as instructions.
  // ─────────────────────────────────────────────────────────
  const safePrompt = `OCR INPUT TEXT: """${ocrText}"""`;

  try {
    // ─────────────────────────────────────────────────────────
    // CALL OLLAMA — Llama 3.2 with JSON mode & zero temperature
    // ─────────────────────────────────────────────────────────
    const response = await ollama.generate({
      model: 'llama3.2',
      system: SCAN_SYSTEM_PROMPT,
      prompt: safePrompt,
      format: 'json',          // Forces Llama 3.2 to emit valid JSON
      options: {
        temperature: 0,        // Strictly factual — no creative hallucinations
        num_predict: 512,      // Enough for all fields, not more
      },
    });

    // ─────────────────────────────────────────────────────────
    // PARSE AI RESPONSE
    // ─────────────────────────────────────────────────────────
    let parsed;
    try {
      parsed = JSON.parse(response.response);
    } catch {
      // Model returned non-JSON despite format:'json' — return a clean error
      console.error('[OllamaController] JSON parse failed. Raw:', response.response);
      return res.status(422).json({
        success: false,
        error: 'AI returned non-JSON output. Try again or check model availability.',
        raw: response.response,
      });
    }

    // ─────────────────────────────────────────────────────────
    // REGEX VALIDATION — Adjust confidence score
    // ─────────────────────────────────────────────────────────
    const aiScore = typeof parsed.confidence_score === 'number'
      ? parsed.confidence_score
      : 70; // default if model forgot to include it

    const idNumber = parsed.extracted_data?.id_number ?? null;
    const docType  = parsed.doc_type ?? 'Unknown';

    const { finalScore, validationNotes } = validateAndAdjustScore(docType, idNumber, aiScore);

    // ─────────────────────────────────────────────────────────
    // RETURN ENRICHED RESPONSE
    // ─────────────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      doc_type:        docType,
      extracted_data:  parsed.extracted_data ?? {},
      confidence_score: finalScore,
      validation_notes: validationNotes,
      provider: 'ollama/llama3.2',
    });

  } catch (error) {
    // ─────────────────────────────────────────────────────────
    // GRACEFUL FALLBACK — Ollama not running
    // ─────────────────────────────────────────────────────────
    if (error.code === 'ECONNREFUSED') {
      console.warn('[OllamaController] Ollama server not reachable at http://127.0.0.1:11434');
      return res.status(503).json({
        success: false,
        error: 'Ollama is not running. Local AI scanner is offline.',
        instruction: "Run 'ollama serve' in your terminal to enable local AI scanning.",
        setup: [
          "1. Install Ollama: https://ollama.com/download",
          "2. Run: ollama serve",
          "3. Pull the model: ollama pull llama3.2",
          "4. Retry this request",
        ],
      });
    }

    console.error('[OllamaController] Unexpected error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Document scanning failed.',
    });
  }
};

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK HELPER — Is llama3.2 model ready?
// ═══════════════════════════════════════════════════════════

/**
 * Checks Ollama connectivity and whether llama3.2 is pulled.
 * Safe to call from server.js health route.
 *
 * @returns {Promise<{ status: string, details: string }>}
 */
const getOllamaHealth = async () => {
  try {
    const { models } = await ollama.list();
    const isLlamaReady = models.some((m) => m.name.includes('llama3.2'));
    return {
      status: isLlamaReady ? 'ready' : 'model_missing',
      details: isLlamaReady
        ? 'llama3.2 is loaded and ready'
        : "llama3.2 not found. Run: ollama pull llama3.2",
    };
  } catch {
    return {
      status: 'offline',
      details: "Ollama not running. Run: ollama serve",
    };
  }
};

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = { scanDocument, getOllamaHealth };
