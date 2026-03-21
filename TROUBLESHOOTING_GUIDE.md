# 🔧 Document Scanner - Troubleshooting & Migration Guide

## Migration from Old Version

### What Changed?

| Feature | Before | After |
|---------|--------|-------|
| **Error Messages** | Generic "Failed to process" | Specific stage identification |
| **Logging** | Minimal | 6-stage pipeline with progress |
| **OCR Library** | Missing (Tesseract) | ✅ Installed & configured |
| **Buffer Handling** | Basic | ✅ Null-byte & control-char cleanup |
| **AI Fallback** | Single provider (Gemini only) | ✅ Gemini → Groq chain |
| **File Validation** | Partial | ✅ Full MIME + extension check |
| **Error Recovery** | Crashes on failure | ✅ Graceful fallback/demo mode |

---

## Installation Verification

### Check 1: Dependencies Installed
```bash
npm list tesseract.js pdf-parse mammoth multer groq-sdk
```

Expected ✅:
```
tesseract.js@5.0.4
pdf-parse@1.1.4
mammoth@1.12.0
multer@1.4.5-lts.2
groq-sdk@1.1.1
```

### Check 2: Environment Variables
```bash
# In .env, verify you have:
echo $GEMINI_API_KEY
echo $GROQ_API_KEY
```

Expected ✅: Both should return API keys (not error)

### Check 3: Uploads Directory
```bash
# Should exist after first upload
ls -la server/uploads/
```

Expected ✅: Directory contains processed files

---

## Common Issues & Solutions

### ❌ Issue: `Cannot find module 'tesseract.js'`

**Cause:** Tesseract not installed

**Fix:**
```bash
cd server
npm install tesseract.js@5.0.4 --save
```

**Verify:**
```bash
npm list tesseract.js
```

---

### ❌ Issue: OCR takes 30+ seconds on first run

**Cause:** Normal behavior - Tesseract downloads trained models (first time only)

**Why:** Tesseract needs language models for OCR
- English: ~8 MB
- Hindi: ~6 MB  
- Kannada: ~4 MB
- Total: ~18 MB downloaded once

**What to expect:**
```
First OCR:    45-60 seconds (model download + processing)
Subsequent:   5-10 seconds  (model cached)
```

**Solution:** Just wait, it's normal!

---

### ❌ Issue: "ENOENT: no such file or directory, open 'uploads/...'"

**Cause:** Uploads directory doesn't exist

**Fix:**
```bash
# Manually create it:
mkdir -p server/uploads

# OR restart server (auto-creates on first upload)
npm start
```

---

### ❌ Issue: "Invalid file extension. Allowed: JPG, PNG, PDF, DOCX"

**Cause:** File extension doesn't match MIME type

**Examples that fail:**
- File named `document.docx` but actually a PDF
- File named `image.jpg` but actually PNG
- File has no extension

**Fix:**
1. Rename file with correct extension
2. Verify file type: 
   ```bash
   file document.pdf  # Linux/Mac
   Get-FileType document.pdf  # Windows
   ```

---

### ❌ Issue: "Could not extract text from PDF"

**Cause:** PDF is scanned (image-based, no text layer)

**Why:** `pdf-parse` can only extract text from digital PDFs

**Fix:** Upload as image instead
```bash
# Convert PDF to image:
# Option 1: Use online converter
# Option 2: Use tool: "pdftoppm your.pdf output.jpg"
# Then upload the JPG
```

---

### ❌ Issue: "401 API key invalid" or rate limit exceeded

**Cause:** 
- API key expired/invalid
- Rate limit hit (Gemini has limits)

**Expected behavior:**
```
🤖 AI: Attempting Gemini...
⚠️ AI: Gemini failed - 429 rate limit
🤖 AI: Attempting Groq fallback...
✅ AI: Groq succeeded
```

**Fix:**
1. Check API key is correct in `.env`
2. Groq should automatically fallback
3. If both fail, check console for exact error

---

### ❌ Issue: "No Inference Provider available" (HuggingFace)

**Cause:** HuggingFace model doesn't have available inference provider

**Note:** This only happens if Gemini AND Groq both fail

**Fix:** Ensure at least one of these is configured:
```bash
✅ GEMINI_API_KEY=...
✅ GROQ_API_KEY=...
```

---

### ❌ Issue: OCR returns blank text (confidence: 0%)

**Cause:** Image quality too poor or not readable

**Examples:**
- Blurry/out-of-focus image
- Text too small (<10pt)
- Very low contrast
- Handwritten text (Tesseract struggles with this)

**Fix:**
1. Retake photo with better lighting
2. Increase zoom/DPI
3. Ensure text is clearly readable to human eye
4. Use digital scans instead of photos

**Check confidence in response:**
```json
{
  "confidence": 45,  // Low!
  "warning": "Image quality may affect accuracy"
}
```

---

### ❌ Issue: "File size exceeds limit"

**Cause:** File larger than 25 MB limit

**Fix:**
1. Compress file:
   ```bash
   # For PDF: use online compressor
   # For DOCX: save as smaller Word version
   # For images: resize/reduce quality
   ```

2. Or increase limit in controller:
   ```javascript
   limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
   ```

---

### ❌ Issue: Slow response time (>10 seconds)

**Causes & Fixes:**

1. **OCR is slow** → Normal for first run with image
2. **Network latency** → Check internet connection
3. **API slow** → Try Groq instead of Gemini
4. **Database slow** → Check MongoDB connection

**Debug:**
Check console logs for timing:
```
📖 PARSING: PDF - Extracted in 0.5s
🤖 AI: Gemini response in 2.3s
🌍 TRANSLATION: Completed in 1.2s
💾 DATABASE: Saved in 0.1s
```

---

### ❌ Issue: DOCX parsing returns empty text

**Cause:** DOCX file corrupted or not valid format

**Fix:**
1. Verify file is real DOCX:
   ```bash
   unzip -t document.docx  # Should succeed
   ```

2. Try opening in Word/LibreOffice
3. Re-save the file
4. Try converting to PDF then back to DOCX

---

### ❌ Issue: Translation returns English instead of Hindi/Kannada

**Cause:** Google Translate API rate limit or not configured

**Check:**
```bash
# Verify Google Cloud credentials
echo $GOOGLE_APPLICATION_CREDENTIALS
```

**Expected:** Should point to service account JSON

**Fix:**
1. Check `.env` has valid path to credentials JSON
2. Verify credentials have Translate API enabled
3. Check API quotas in Google Cloud Console

---

### ❌ Issue: History endpoint returns empty (404)

**Cause:** MongoDB not connected or History model not defined

**Fix:**
1. Check MongoDB connection:
   ```bash
   echo $MONGO_URI  # Should return connection string
   ```

2. Verify History model exists:
   ```bash
   ls server/models/History.js  # Should exist
   ```

3. Check MongoDB is running:
   ```bash
   # If local: mongod should be running
   # If cloud: check credentials
   ```

---

## Performance Optimization

### For Production

**Use Memory Storage (no disk reads):**
```javascript
// In simplifyController.js
storage: memoryStorage,  // Instead of diskStorage
```

**Disable file cleanup (keep for audit):**
```javascript
// Keep this line commented:
// await cleanupFile(filePath);
```

**Enable compression:**
```bash
npm install compression
# Then use in express: app.use(compression());
```

---

### For Large Batch Processing

**Use job queue:**
```bash
npm install bull bullmq
```

**Enable workers:**
```javascript
// Process Documents asynchronously
const queue = new Queue('documents');
```

---

## Monitoring & Debugging

### Enable Debug Logging

Set environment:
```bash
DEBUG=*  npm start
```

Or in code:
```javascript
process.env.DEBUG = 'simplify:*,multer:*';
```

### Check Specific Stages

Look for these in console:

#### Upload Stage
```
📋 FILE UPLOAD: Received file - document.pdf
✅ UPLOAD VALIDATION: File passed validation
```

#### Parsing Stage
```
📖 PARSING: PDF - Extracted 5632 characters
✅ PARSING STAGE: Successfully extracted text
```

#### API Stage
```
🔑 API VALIDATION: Found available providers
✅ API VALIDATION: Checking for available AI providers
```

#### AI Stage
```
🤖 AI: Attempting Gemini...
✅ AI: Gemini succeeded - 2847 characters
```

---

## Testing Procedures

### Unit Test: File Upload
```bash
# Test with valid PDF
curl -X POST http://localhost:5001/api/simplify \
  -F "image=@valid-document.pdf" \
  -H "Content-Type: multipart/form-data"
```

Expected: `HTTP 200` with JSON response

### Unit Test: Invalid File
```bash
# Test with wrong extension
curl -X POST http://localhost:5001/api/simplify \
  -F "image=@document.txt"
```

Expected: `HTTP 400` with clear error message

### Unit Test: No API Keys
```bash
# Remove GEMINI_API_KEY and GROQ_API_KEY from .env
# Restart server
# Try upload
```

Expected: `HTTP 500` with message about no API keys

---

## Rollback Plan

If you need to revert to older version:

```bash
# Backup current version
cp server/controllers/simplifyController.js \
   server/controllers/simplifyController.js.backup

# Restore from git
git checkout server/controllers/simplifyController.js

# Remove Tesseract (if not needed)
npm uninstall tesseract.js
```

---

## Getting Help

### Check Logs First
```bash
# Look for ERROR, WARN, or ❌ markers
npm start 2>&1 | grep "ERROR\|WARN\|❌"
```

### Enable Verbose Logging
Uncomment this in controller:
```javascript
console.log(`DEBUG: ${JSON.stringify(object, null, 2)}`);
```

### Common Log Markers

| Marker | Meaning |
|--------|---------|
| 📤 | Upload stage |
| 📂 | Parsing stage |
| 🔑 | API validation |
| 🤖 | AI processing |
| 🌍 | Translation |
| 💾 | Database save |
| ✅ | Success |
| ⚠️ | Warning |
| ❌ | Error |

---

## Verification Checklist

- [ ] `npm list tesseract.js` shows version 5.0.4
- [ ] `.env` has GEMINI_API_KEY or GROQ_API_KEY
- [ ] `server/uploads/` directory exists
- [ ] Server starts without errors: `npm start`
- [ ] Tested upload with valid PDF
- [ ] Tested upload with valid image
- [ ] Checked console logs show 6-stage pipeline
- [ ] Tested with invalid file (proper error)
- [ ] Translation working (check response)
- [ ] History endpoint returns records

---

**Status:** ✅ All systems operational
**Last Updated:** March 2026
