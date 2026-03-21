# 🚀 DOCUMENT SCANNER — QUICK REFERENCE CARD

## 📦 NPM Commands Quick List

```bash
# Installation
npm install tesseract.js@5.0.4                    # Install OCR
npm install                                        # Install all dependencies
npm install --save tesseract.js                   # Add to package.json

# Verification
npm list | grep tesseract                          # Check if installed
npm list tesseract.js pdf-parse mammoth multer     # Check all document libs

# Server
npm start                                          # Start server
npm run dev                                        # Development mode

# Cleanup
npm prune                                          # Remove unused packages
npm audit                                          # Check vulnerabilities
npm audit fix                                      # Fix low-risk issues
```

---

## 🔍 Console Log Quick Reference

### Emoji Indicators
| Emoji | Meaning | Status |
|-------|---------|--------|
| 📤 | Upload stage | Processing |
| 📋 | File upload | Processing |
| ✅ | Success | Complete ✓ |
| ❌ | Error | Failed ✗ |
| ⚠️  | Warning | Caution ⚠ |
| 📂 | Parsing stage | Processing |
| 📖 | PDF parsing | Processing |
| 📄 | DOCX parsing | Processing |
| 🖼️  | Image/OCR | Processing |
| 🤖 | AI processing | Processing |
| 🔑 | API validation | Processing |
| 🌍 | Translation | Processing |
| 💾 | Database save | Processing |

### Reading Logs
```
✅  ← Success
❌  ← Error - check this line
⚠️   ← Warning - might be ok
🔄 ← Fallback attempt

Look for these patterns:
- "❌ ERROR" = Something failed here
- "⚠️  WARN" = Optional, might work around it
- "✅ Success" = Stage complete
- Multiple attempts = Fallback chain working
```

---

## 🧪 Testing Commands

### Test 1: Upload PDF
```bash
curl -X POST http://localhost:5001/api/simplify \
  -F "image=@document.pdf"
```

### Test 2: Upload Image
```bash
curl -X POST http://localhost:5001/api/simplify \
  -F "image=@scan.jpg"
```

### Test 3: Upload DOCX
```bash
curl -X POST http://localhost:5001/api/simplify \
  -F "image=@document.docx"
```

### Test 4: Check History
```bash
curl http://localhost:5001/api/simplify/history
```

### Test 5: Upload Invalid File (should fail)
```bash
curl -X POST http://localhost:5001/api/simplify \
  -F "image=@document.txt"
```

Expected: HTTP 400 with error message

---

## 🛠️ Common Issues Cheat Sheet

| Issue | Quick Fix |
|-------|-----------|
| `Cannot find module 'tesseract.js'` | `npm install tesseract.js@5.0.4 --save` |
| OCR very slow (first time) | ✅ Normal, wait 45-60s for model download |
| OCR fast after first run | ✅ Models are cached locally |
| "Invalid MIME type" | Rename file with correct extension |
| "PDF parsing failed" | If scanned PDF, upload as image instead |
| "401 API rate limit" | Groq fallback should work automatically |
| Empty translation | Check Google Cloud credentials |
| Slow uploads | Use memory storage or compress file |

---

## 📋 File Structure Reference

```
server/
├── controllers/
│   └── simplifyController.js      ← Main file (600+ lines)
│       ├── Multer config
│       ├── Buffer cleanup function
│       ├── extractPdfText()
│       ├── extractDocxText()
│       ├── extractImageText()
│       ├── processWithAI()
│       ├── parseAIResponse()
│       └── simplifyDocument()      ← Main endpoint
├── routes/
│   └── simplify.js                ← Route definitions
├── models/
│   └── History.js                 ← Store processing records
├── uploads/                        ← Processed files (auto-created)
├── package.json                    ← Dependencies (updated)
└── .env                           ← API keys
```

---

## 🔑 Environment Variables Needed

```bash
# Required (at least ONE)
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key

# Optional but recommended
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Database
MONGO_URI=mongodb+srv://...

# Server
PORT=5001
```

---

## 📊 API Endpoint Reference

### POST /api/simplify
**Upload and process document**

```bash
Request:
- Method: POST
- Content-Type: multipart/form-data
- Field name: "image"
- Value: File (JPG, PNG, PDF, DOCX)
- Optional params: language, dialect

Response:
{
  "success": true,
  "data": {
    "originalText": "...",
    "simplifiedText": "...",
    "simplifiedKannada": "...",
    "simplifiedHindi": "...",
    "jargonTerms": [...],
    "confidence": "high|medium|low",
    "processingStages": {
      "upload": "✅ Success",
      "parsing": "✅ Success",
      "ai": "✅ Success",
      "translation": "✅ Success",
      "database": "✅ Success"
    }
  }
}
```

### GET /api/simplify/history
**Get processing history**

```bash
Request:
- Method: GET
- No parameters

Response:
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "originalText": "...",
      "simplifiedText": "...",
      "createdAt": "2026-03-18T..."
    }
  ]
}
```

---

## 🔄 Processing Flow Diagram

```
Upload File
    ↓
┌─────────────────────────────┐
│ Stage 1: Upload Validation   │ → ❌ File rejected
└────────────┬────────────────┘
             ↓
┌─────────────────────────────┐
│ Stage 2: Text Parsing        │ → ❌ Parse error
├─────────────────────────────┤
│ • PDF → pdf-parse            │
│ • DOCX → mammoth             │
│ • Image → Tesseract OCR      │
└────────────┬────────────────┘
             ↓
┌─────────────────────────────┐
│ Stage 3: API Validation      │ → ❌ No API key
└────────────┬────────────────┘
             ↓
┌─────────────────────────────┐
│ Stage 4: AI Processing       │ → Try Gemini → Try Groq → ❌ Fail
├─────────────────────────────┤
│ Send text to LLM             │
│ Receive simplified response  │
└────────────┬────────────────┘
             ↓
┌─────────────────────────────┐
│ Stage 5: Translation         │ → ⚠️  Optional (warn if fails)
└────────────┬────────────────┘
             ↓
┌─────────────────────────────┐
│ Stage 6: Database Save       │ → ❌ DB error
└────────────┬────────────────┘
             ↓
         ✅ Success
```

---

## 🚨 Error Codes Reference

| Error | Stage | Fix |
|-------|-------|-----|
| `Invalid file extension` | Upload | Use correct file type |
| `Invalid MIME type` | Upload | Rename file correctly |
| `File size exceeds`  | Upload | Compress file |
| `PDF parsing failed` | Parsing | If scanned, use image |
| `No AI provider` | API Validation | Add GEMINI/GROQ key |
| `Gemini rate limit` | AI | Wait or use Groq |
| `Translation failed` | Translation | Check Google Cloud |
| `DB connection error` | Database | Check MongoDB |

---

## 💡 Pro Tips

### Tip 1: Speed Up OCR
```javascript
// Use memory storage instead of disk
storage: memoryStorage,
```

### Tip 2: Batch Processing
```bash
# For multiple files, use queue:
npm install bull
# Then implement queue processing
```

### Tip 3: Monitor Performance
```bash
# Check which stage is slow
# Look at timestamps in logs
```

### Tip 4: Debug Specific Issue
Add this to see detailed logs:
```javascript
console.log(`DEBUG: ${JSON.stringify(object, null, 2)}`);
```

### Tip 5: Test Without API Keys
Remove GEMINI_API_KEY and GROQ_API_KEY, server falls back to demo mode

---

## 🔄 Fallback Chain

```
Primary:    Gemini
            ↓ (if fails)
Backup:     Groq
            ↓ (if fails)
Tertiary:   HuggingFace
            ↓ (if fails)
Last:       Demo Mode
            ↓
        Response sent ✅
```

---

## 📱 Response Time Breakdown

```
Upload: 0.1s
Parsing: 2-60s (depends on file type & size)
API call: 2-5s (Gemini) or 1-3s (Groq)
Translation: 1-2s
Database: 0.1-0.5s
─────────────────────
Total: 5-70s (typical: 10-15s)
```

---

## 🎯 Debugging Checklist

- [ ] Is Tesseract.js installed? `npm list tesseract.js`
- [ ] Are API keys in .env? `grep GEMINI .env`
- [ ] Is server running? Check console output
- [ ] Is MongoDB connected? Check connection logs
- [ ] File valid format? Check console for upload errors
- [ ] Large file? Check file size limits
- [ ] Slow OCR? First run downloads models (normal)
- [ ] Empty response? Check parse errors

---

## 📚 Documentation Map

| Topic | File |
|-------|------|
| Full Implementation | `DOCUMENT_SCANNER_REFACTOR.md` |
| Troubleshooting | `TROUBLESHOOTING_GUIDE.md` |
| API Fixes | `API_FIXES_SUMMARY.md` |
| Completion Status | `COMPLETION_SUMMARY.md` |
| Quick Reference | This file |

---

## 🚀 Quick Start (30 seconds)

```bash
# 1. Install (5s)
npm install tesseract.js@5.0.4

# 2. Verify (5s)
npm list tesseract.js

# 3. Check .env (5s)
grep GROQ .env  # Should show key

# 4. Start (5s)
npm start

# 5. Test (5s)
curl -F "image=@test.pdf" http://localhost:5001/api/simplify
```

**Done! You're ready to process documents.**

---

**Version:** 2.0.0
**Last Updated:** March 2026
**Status:** ✅ Production Ready
