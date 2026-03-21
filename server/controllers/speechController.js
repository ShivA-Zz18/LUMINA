const { transcribeAudio } = require("../utils/googleStt");
const fs = require("fs");

/**
 * Speech Controller — Handles audio file uploads and returns transcription
 */
const transcribe = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const { language = "en-IN" } = req.body;
    
    // Attempt Google Cloud STT
    try {
      const transcript = await transcribeAudio(req.file.path, language);
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      if (!transcript) {
        return res.status(400).json({ error: "Could not transcribe audio. It was either silent or unclear." });
      }

      return res.json({ success: true, transcript, source: "google-cloud" });
    } catch (sttError) {
      // Clean up uploaded file on error
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      
      console.error("STT endpoint error:", sttError.message);
      
      // If Google STT fails (e.g., no keys), return a specific error code
      // so the frontend knows to gracefully fall back to the browser's Web Speech API
      return res.status(503).json({ 
        error: "Server-side speech recognition unavailable", 
        fallbackRequired: true 
      });
    }
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("Speech route error:", error);
    res.status(500).json({ error: "Failed to process audio" });
  }
};

module.exports = { transcribe };
