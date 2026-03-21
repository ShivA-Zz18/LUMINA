# Ollama Setup Guide - Free Document Processing

## What is Ollama?
- **100% Free**: No API costs, ever
- **Self-Hosted**: Runs on your local machine
- **Private**: Your data never leaves your computer
- **Models**: Llama 2, Mistral, Neural Chat, and more
- **No Rate Limits**: Process unlimited documents

## Installation Steps

### Step 1: Download Ollama
1. Go to **https://ollama.ai**
2. Click "Download" 
3. Select **Windows** 
4. Run the installer (OllamaSetup.exe)
5. Follow the installation wizard
6. Restart your computer

**Download Link:** https://ollama.ai/download/windows

### Step 2: Verify Installation
Once installed, open PowerShell and run:
```powershell
ollama --version
```

Should output: `ollama version X.X.X`

### Step 3: Pull a Model
Choose one of these models based on your PC:

**For Best Quality (Requires 8GB+ RAM):**
```powershell
ollama pull mistral
```

**For Balanced (Requires 6GB+ RAM):**
```powershell
ollama pull neural-chat
```

**For Small Devices (Requires 4GB+ RAM):**
```powershell
ollama pull phi
```

**For Document Processing Specifically:**
```powershell
ollama pull neural-chat
```

### Step 4: Verify Model Works
```powershell
ollama run neural-chat "Hello, test this"
```

Should return a response.

### Step 5: Install Backend Dependencies
```powershell
cd server
npm install axios
```

### Step 6: Start Ollama Server (Keep Running)
```powershell
ollama serve
```

Output should show:
```
*  Listening on 127.0.0.1:11434
```

**Leave this terminal open while testing!**

---

## Backend Configuration

The backend will be updated to use Ollama instead of Gemini:

### Updated Processing Pipeline:
```
User uploads PDF
    ↓
Backend receives file
    ↓
Extract text (pdf-parse)
    ↓
Send to Ollama (Local LLM)
    ↓
Get simplified response
    ↓
Translate to regional languages
    ↓
Save to database
```

### Key Changes:
- **Remove dependency**: No GEMINI_API_KEY needed
- **Use local inference**: Ollama on http://127.0.0.1:11434
- **No API costs**: Ever
- **Faster processing**: Some models are optimized for speed
- **Private data**: Never leaves your computer

---

## Model Comparison

| Model | Size | Speed | Quality | RAM Needed |
|-------|------|-------|---------|-----------|
| **Phi** | 2.7B | ⚡⚡⚡ Fast | ⭐⭐ | 4GB |
| **Neural Chat** | 7B | ⚡⚡ Good | ⭐⭐⭐ | 6GB |
| **Mistral** | 7B | ⚡⭐ Better | ⭐⭐⭐⭐ | 8GB |
| **Llama 2** | 7B/13B | ⚡ | ⭐⭐⭐⭐ | 8GB+ |

**Recommendation**: Start with `neural-chat` (best balance)

---

## Ollama REST API

Once running, you can query Ollama:

### Generate Text:
```bash
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "neural-chat",
  "prompt": "Simplify this document: ...",
  "stream": false
}'
```

### Response:
```json
{
  "response": "Simplified text here...",
  "done": true
}
```

---

## Troubleshooting

**Q: Ollama not found after install?**
- A: Restart your computer after installation

**Q: Port 11434 already in use?**
- A: Change port in server config or kill existing process

**Q: Model pulling is slow?**
- A: First time download takes time. Be patient.

**Q: Out of memory error?**
- A: Use smaller model (phi) or close other apps

**Q: Need more languages?**
- A: Mistral or Llama 2 support 80+ languages

---

## Next Steps

1. ✅ Download & install Ollama
2. ✅ Pull neural-chat model
3. ✅ Start ollama serve
4. ✅ I'll update the backend to use Ollama
5. ✅ Test document processing

---

## Free Alternatives if Ollama Doesn't Work

1. **Claude API** (Anthropic): 50k tokens/month free
2. **Mistral API**: Free tier available
3. **LM Studio**: Another self-hosted option
4. **GPT4All**: Desktop app with local models

---

**Status**: Follow these steps, then let me know when:
- [ ] Ollama is installed
- [ ] Neural-chat model is downloaded
- [ ] `ollama serve` is running
- [ ] You see "Listening on 127.0.0.1:11434"

I'll then update the backend! 🚀
