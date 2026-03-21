const speech = require("@google-cloud/speech");
const fs = require("fs");

/**
 * Google Speech-to-Text API Wrapper
 * Returns transcribed text from an audio file.
 */

const getSpeechClient = () => {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return new speech.SpeechClient();
    }
  } catch (error) {
    console.warn("Google Cloud Speech client init failed:", error.message);
  }
  return null;
};

const transcribeAudio = async (filePath, languageCode = "en-IN") => {
  const client = getSpeechClient();
  
  if (!client) {
    throw new Error("Google Cloud credentials not found.");
  }

  const audioBytes = fs.readFileSync(filePath).toString("base64");

  const audio = {
    content: audioBytes,
  };
  
  const config = {
    encoding: "WEBM_OPUS", // Most browsers record in WebM
    sampleRateHertz: 48000,
    languageCode: languageCode,
    alternativeLanguageCodes: ["hi-IN", "kn-IN", "en-IN"].filter(code => code !== languageCode),
  };

  const request = {
    audio: audio,
    config: config,
  };

  try {
    const [response] = await client.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join("\n");
    return transcription;
  } catch (error) {
    console.error("Google STT Error:", error.message);
    throw error;
  }
};

module.exports = { transcribeAudio };
