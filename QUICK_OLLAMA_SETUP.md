# ⚡ Quick Ollama Setup (5 Minutes)

## Download & Install
1. Go to **https://ollama.ai/download/windows**
2. Run `OllamaSetup.exe`
3. Do NOT restart yet

## Download Model (While Installing)
Open PowerShell and run:
```powershell
ollama pull neural-chat
```
(Takes 5-15 minutes, downloads ~4.5GB)

## Start Ollama Server
```powershell
ollama serve
```

Keep this terminal open! Should show:
```
*  Listening on 127.0.0.1:11434
```

## Test Your Setup
Open another PowerShell:
```powershell
ollama list
```

Should show:
```
NAME                  ID              SIZE      MODIFIED
neural-chat:latest    2d4d0a8597ce    4.5GB     About a minute ago
```

## Restart the Servers
```powershell
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend  
cd client && npm run dev
```

## Test
1. Open http://localhost:5174
2. Go to Document Scanner
3. Upload a PDF
4. Click "Analyze Document"
5. Watch the magic! ✨

---

## Expected Logs in Backend Console

```
✅ OLLAMA: Server is running at http://127.0.0.1:11434
🤖 AI PROCESSING STAGE: Starting Ollama local processing...
🧠 OLLAMA: Using local LLM for processing (no API costs)...
✅ OLLAMA: Successfully processed with local model
```

---

## Troubleshooting

**Still seeing Gemini errors?**
- Make sure `ollama serve` is running in separate terminal
- Check backend console for "✅ OLLAMA:" message

**Hanging on "AI PROCESSING"?**
- First time takes 30-60 seconds (model warming up)
- After first time: 10-20 seconds

**"Model not found"?**
- Run: `ollama pull neural-chat` again
- Wait for completion

---

## Benefits Now Active

✅ **100% FREE** - No API costs ever
✅ **No Rate Limits** - Process unlimited docs
✅ **Data Privacy** - Never leaves your computer
✅ **No Downtime** - Works offline
✅ **No API Keys** - No config headaches
✅ **Self-Hosted** - You control everything

---

## That's it! You're done 🎉

Your document scanner now has free, powerful AI that'll never charge you a penny!
