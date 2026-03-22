# Lingo-Bridge (Aetherion'26)

An AI-powered Accessibility Platform bridging the digital divide for rural India. Built for the Aetherion'26 hackathon.

## Tech Stack
- Frontend: React (Vite), Tailwind CSS, Framer Motion
- Backend: Node.js, Express, MongoDB
- AI APIs: Google Gemini 1.5 Flash (Core capabilities / Vision)
- Cloud APIs: Google Cloud Translation, Google Cloud Speech-to-Text (with local Web Speech fallbacks)

## Key Features
1. **Multimodal Document Scanner:** Upload Images, PDFs, and Word documents. The system extracts text and legal jargon, then simplifies it into easy-to-understand language.
2. **Seamless Translation:** Translates simplified legal documents into Kannada and Hindi using Google Cloud Translation (with automatic fallback to Gemini).
3. **Voice Assistant:** Real-time conversational AI designed to help villagers understand schemes and rights. Uses Google Cloud STT (with fallback to local browser Web Speech API).
4. **DigiLocker Hub:** Securely access government-issued documents directly from the dashboard (running in Sandbox Demo Mode if keys are not provided).
5. **Grievance Draftsman:** Generates professional replies and complaints automatically from context.
6. **Scheme Finder:** Matches users to relevant government schemes based on age, income, and occupation.

## Environment Variables (.env)
Create a `.env` file in the `server/` directory:

```env
PORT=5001
MONGO_URI=mongodb://localhost:27017/lingo-bridge

# Required (Powers Document Scanner, Chat Bot, Grievance Drafter, Scheme Finder)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional — Google Cloud (STT and Translation APIs)
# GOOGLE_APPLICATION_CREDENTIALS should be an absolute path to your service account JSON key file
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_CLOUD_PROJECT_ID=

# Optional — DigiLocker Sandbox (demo mode if missing)
DIGILOCKER_CLIENT_ID=
DIGILOCKER_CLIENT_SECRET=
DIGILOCKER_REDIRECT_URI=http://localhost:5001/api/digilocker/callback
```

*Note: The platform is designed to run flawlessly even if the Optional keys are omitted! Real-time fallbacks and demo sandbox modes are engaged automatically.*

## How to Run

1. Open two terminals.
2. **Terminal 1 (Backend):**
   ```bash
   cd server
   npm install
   npm start
   ```
3. **Terminal 2 (Frontend):**
   ```bash
   cd client
   npm install
   npm run dev
   ```

## Seed Data
To populate the Scheme Finder with mock schemes, run:
```bash
cd server
npm run seed
```
