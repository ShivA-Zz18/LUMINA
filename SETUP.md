# 🚀 LINGO-BRIDGE — Complete Setup & Deployment Guide

## ✨ What's New (v2.0.0)

This is a **completely rewritten, production-ready version** of Lingo-Bridge featuring:

### Backend Improvements
- ✅ **Unified AI Endpoint**: Single `/api/ai/process` route handling both document vision & chat
- ✅ **Gemini 1.5 Flash Integration**: Direct integration (no Bhashini dependency)
- ✅ **Village-Level Translations**: Automatic Kannada & Hindi translations in simple language
- ✅ **Grievance Drafting Engine**: Professional formal letter generation
- ✅ **Enhanced Error Handling**: Graceful fallbacks & detailed error messages

### Frontend Enhancements
- ✅ **Real Web Speech API**: Native speech-to-text in Kannada, Hindi, English
- ✅ **Live Text-to-Speech**: window.speechSynthesis bot responses
- ✅ **Document Scanner Overhaul**: Base64 image upload, side-by-side comparison
- ✅ **Cosmic UI Theme**: Space-Tech colors (#1a1a2e, #00f2ff), glassmorphism effects
- ✅ **Full PWA Support**: Service worker for offline History & Schemes
- ✅ **Framer Motion Transitions**: Smooth page animations
- ✅ **Error Boundaries**: Every page wrapped with error handling

---

## 📋 Prerequisites

### Required
- **Node.js** 18.x or higher
- **npm** or **yarn**
- **Gemini API Key** (FREE - [Get it here](https://makersuite.google.com/app/apikey))
- **MongoDB** (local or [Atlas](https://www.mongodb.com/cloud/atlas))

### Optional
- Docker (for containerized deployment)
- PM2 (for production process management)

---

## ⚙️ Installation & Setup

### 1. Clone & Install Dependencies

```bash
# Navigate to project root
cd "c:\Users\shiva\OneDrive\Documents\Desktop\Docx Lang_Converter"

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

```bash
# In server directory, create .env file
cd server
cp .env.example .env
```

**Edit `server/.env`:**
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/lingo-bridge
```

**Get your FREE Gemini API Key:**
1. Visit: https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copy and paste into `.env` file

### 3. Setup MongoDB (if using local)

```bash
# Windows: MongoDB should be running as service
# Verify connection:
mongosh
# Type: exit

# If not running, start MongoDB:
# Windows: 
net start MongoDB
# or via Services app
```

### 4. Start Development Servers

**Terminal 1 - Backend (port 5001):**
```bash
cd server
npm run dev
# Output: 🚀 LINGO-BRIDGE SERVER STARTED
#         📡 Running on http://localhost:5001
```

**Terminal 2 - Frontend (port 5173):**
```bash
cd client
npm run dev
# Output: VITE v6.0.0  ready in xxx ms
#         ➜  Local: http://localhost:5173/
```

**Visit:** http://localhost:5173

---

## 🧪 Testing the Implementation

### Test Voice Assistant
1. **Go to:** `/voice` route
2. **Select Language:** Hindi (हिन्दी) or Kannada (ಕನ್ನಡ)
3. **Click Mic Icon:** Grant microphone permission
4. **Speak:** "Government schemes in my area"
5. **Verify:**
   - ✓ Speech captured & transcribed
   - ✓ Bot responds in selected language
   - ✓ Click "Listen" to hear voice response

### Test Document Scanner
1. **Go to:** `/scanner` route
2. **Upload:** Any government document image (Ration Card, Aadhar, etc.)
3. **Click:** "Analyze Document"
4. **Verify:**
   - ✓ Original text extracted
   - ✓ Simplified English version displayed
   - ✓ Kannada & Hindi translations available
   - ✓ Key terms explained
   - ✓ Document type identified

### Test Chat (Text Mode)
1. **Go to:** `/voice` route
2. **Type:** "What is an RTI?"
3. **Send:** Press Enter or click Send
4. **Verify:**
   - ✓ Bot responds with simple explanation
   - ✓ Response in selected language

### Test API Health
```bash
# Check backend status
curl http://localhost:5001/api/health

# Expected response:
# {
#   "status": "ok",
#   "name": "Lingo-Bridge API",
#   "version": "2.0.0",
#   "timestamp": "2026-03-17T...",
#   "gemini": "✓ Configured"
# }
```

---

## 📁 Project Structure (What Changed)

```
server/
  ├── controllers/
  │   ├── aiController.js          ✨ NEW - Unified AI endpoint
  │   ├── chatController.js        (kept for backward compat)
  │   ├── simplifyController.js    (kept for backward compat)
  │   └── grievanceController.js   (enhanced)
  ├── routes/
  │   └── (all legacy routes kept working)
  ├── server.js                    ✅ Updated - new routes
  └── .env.example                 (updated)

client/
  ├── src/
  │   ├── pages/
  │   │   ├── VoiceAssistant.jsx   ✅ REWRITTEN - Real Web Speech API
  │   │   ├── DocumentScanner.jsx  ✅ REWRITTEN - Base64 upload
  │   │   ├── App.jsx             ✅ Updated routing
  │   │   └── (other pages)
  │   ├── index.css                ✅ Cosmic theme (enhanced)
  │   └── main.jsx                 (SW registration ready)
  ├── public/
  │   ├── sw.js                    ✅ UPDATED - Better offline support
  │   └── manifest.json            (PWA ready)
  ├── tailwind.config.js           ✨ NEW - Theme configuration
  └── vite.config.js              (proxy to 5001)
```

---

## 🔌 API Endpoints

### New Unified Endpoints

#### 1. Document Vision Processing
```bash
POST /api/ai/process
Content-Type: application/json

{
  "type": "document",
  "imageFile": "data:image/jpeg;base64,/9j/4AAQSkZJ...",
  "language": "en"
}

# Response:
{
  "success": true,
  "data": {
    "originalText": "...",
    "simplifiedText": "...",
    "simplifiedKannada": "...",
    "simplifiedHindi": "...",
    "jargonTerms": [...],
    "documentType": "Ration Card",
    "department": "Food & Civil Supplies",
    "confidence": "high",
    "warnings": "..."
  }
}
```

#### 2. Chat Processing
```bash
POST /api/ai/process
Content-Type: application/json

{
  "type": "chat",
  "text": "What is a government scheme?",
  "language": "en",
  "sessionId": "session-123"
}

# Response:
{
  "success": true,
  "reply": "A government scheme is...",
  "language": "en",
  "sessionId": "session-123"
}
```

#### 3. Grievance Drafting
```bash
POST /api/ai/grievance
Content-Type: application/json

{
  "documentContext": "Ration card was not issued",
  "userIntent": "complaint_letter",
  "language": "en",
  "authority": "Food & Civil Supplies Dept"
}

# Response:
{
  "success": true,
  "data": {
    "draftLetter": "Dear Sir/Madam...",
    "letterType": "complaint_letter",
    "tips": [...],
    "submitTo": "Food & Civil Supplies Dept"
  }
}
```

---

## 🎨 UI Features

### Cosmic Theme Colors
- **Deep Purple**: `#1a1a2e` (backgrounds)
- **Neon Cyan**: `#00f2ff` (accents, buttons)
- **Glassmorphism**: Blur + transparency effects
- **Responsive Design**: Mobile-first, tested on all screen sizes

### Components
- **GlassCard**: Glassmorphic card component
- **LoadingOrb**: Spinning cosmic loader
- **ErrorBoundary**: Catches React errors gracefully
- **Page Transitions**: Framer Motion animations (0.3s)

---

## 🚢 Production Deployment

### Free Deployment Options

#### Option 1: Vercel (Frontend)
```bash
npm install -g vercel
vercel

# Configure:
# - Build: npm run build
# - Output: dist
# - Env: VITE_API_URL=https://your-backend.com
```

#### Option 2: Railway / Render (Backend)
1. Push code to GitHub
2. Connect repository to Railway/Render
3. Set env variables:
   - `GEMINI_API_KEY`: Your API key
   - `MONGODB_URI`: Atlas connection string
   - `PORT`: 5001
4. Deploy!

#### Option 3: Docker (Any hosting)
```bash
# Create Dockerfile in server/
docker build -t lingo-bridge .
docker run -e GEMINI_API_KEY=xxx -p 5001:5001 lingo-bridge
```

### Environment Variables for Production
```env
GEMINI_API_KEY=your_key
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/lingo-bridge
FRONTEND_URL=https://yourdomain.com
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Windows: Kill process on port 5001
netstat -ano | findstr :5001
taskkill /PID <PID> /F

# Or change PORT in .env
```

### Microphone Permission Blocked
- **Chrome**: Settings → Privacy → Microphone → https://localhost:5173
- **Firefox**: Allow temporarily in prompt
- **Mobile**: Grant in app permissions

### Gemini API Rate Limit (429 Error)
- Wait 60 seconds
- Check quota at: https://console.cloud.google.com/
- Upgrade to paid plan if needed

### MongoDB Connection Failed
```bash
# Windows - Start MongoDB service
net start MongoDB

# Or use MongoDB Atlas (cloud)
# Get connection string: https://www.mongodb.com/cloud/atlas
```

### Service Worker Not Updating
```javascript
// In DevTools Console:
navigator.serviceWorker.getRegistrations()
  .then(registrations => registrations.forEach(r => r.unregister()))

// Then reload page
```

---

## 📊 Performance Optimizations

### Frontend (Client)
- ✅ Code splitting with Vite
- ✅ Image lazy loading
- ✅ CSS-in-JS (Tailwind)
- ✅ Memoization with React
- ✅ PWA offline support

### Backend (Server)
- ✅ Gemini 1.5 Flash (faster model)
- ✅ Request caching
- ✅ Error handling with retry logic
- ✅ Session management

### Recommended CDN
- Vercel Edge Network (frontend)
- Cloudflare Workers (API proxy)

---

## 📝 API Key Best Practices

### ❌ DON'T
- Commit `.env` to Git
- Share API keys in public repos
- Use keys in frontend code

### ✅ DO
- Keep `.env` in `.gitignore` (already done)
- Use environment variables
- Rotate keys monthly
- Monitor usage at: https://console.cloud.google.com/

---

## 📞 Support & Resources

### Gemini AI Documentation
- https://ai.google.dev/docs
- https://makersuite.google.com/app/apikey

### MongoDB
- https://docs.mongodb.com
- https://www.mongodb.com/cloud/atlas

### React & Framer Motion
- https://react.dev
- https://www.framer.com/motion

### Tailwind CSS
- https://tailwindcss.com
- https://v4.tailwindcss.com

---

## ✅ Checklist for 10/10 Implementation

- [x] Unified AI endpoint
- [x] Gemini 1.5 integration
- [x] Real Web Speech API
- [x] Document vision processing
- [x] Multi-language support (EN/HI/KN)
- [x] Grievance drafting
- [x] Cosmic UI theme
- [x] PWA offline support
- [x] Error boundaries
- [x] Framer Motion transitions
- [x] Modular, clean code
- [x] Comprehensive error handling
- [x] Production-ready

---

## 🎉 You're All Set!

**Lingo-Bridge v2.0 is production-ready!**

Start with:
```bash
cd server && npm run dev    # Terminal 1
cd client && npm run dev    # Terminal 2
```

Visit: http://localhost:5173

---

*Created for Aetherion'26 Hackathon*  
*Last Updated: March 17, 2026*
