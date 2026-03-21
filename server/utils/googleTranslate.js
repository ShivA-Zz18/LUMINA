const { TranslationServiceClient } = require("@google-cloud/translate");
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Google Translation API Wrapper with Graceful Fallback to Gemini
 */

const getTranslationClient = () => {
  try {
    // Requires GOOGLE_APPLICATION_CREDENTIALS in env to point to a service account key JSON
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return new TranslationServiceClient();
    }
  } catch (error) {
    console.warn("Google Cloud Translation client init failed:", error.message);
  }
  return null;
};

const translateText = async (text, targetLanguageCode) => {
  // 1. Try Google Cloud Translation
  const translationClient = getTranslationClient();
  if (translationClient && process.env.GOOGLE_CLOUD_PROJECT_ID) {
    try {
      const request = {
        parent: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/global`,
        contents: [text],
        mimeType: "text/plain",
        sourceLanguageCode: "en",
        targetLanguageCode: targetLanguageCode,
      };

      const [response] = await translationClient.translateText(request);
      return response.translations[0].translatedText;
    } catch (error) {
      console.error("Google Cloud Translation failed, falling back to Gemini.", error.message);
    }
  } else {
     console.warn("Google Google Cloud credentials not found, falling back to Gemini.");
  }

  // 2. Fallback to Gemini 1.5 Flash
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      throw new Error("GEMINI_API_KEY is missing for translation fallback.");
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const langName = targetLanguageCode === "kn" ? "Kannada" : targetLanguageCode === "hi" ? "Hindi" : targetLanguageCode;
    
    const result = await model.generateContent([
       { text: `Translate the following English text to ${langName}. Return ONLY the translated text, no markdown syntax.` },
       { text: text }
    ]);
    
    return result.response.text().trim();
  } catch (geminiError) {
    console.error("Gemini translation fallback also failed:", geminiError.message);
    return "Translation failed. " + text; // Return original text if everything fails
  }
};

module.exports = { translateText };
