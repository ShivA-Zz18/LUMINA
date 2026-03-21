const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Chat Controller — Powers the Voice Assistant
 * Uses Gemini to answer user questions about schemes, documents, and rights.
 */

const SYSTEM_PROMPT = `You are "Lingo-Bridge Assistant" – a friendly, knowledgeable AI helper for rural Indian citizens.

Your role:
- Help people understand government schemes, documents, and their rights
- Answer in simple, clear language a village Elder would understand
- When asked about documents, explain what they mean in practical terms
- When asked about schemes, describe eligibility, benefits, and how to apply
- When asked about rights, explain them with real-world examples
- You can respond in English, Hindi, or Kannada depending on user's language

Rules:
- Keep answers concise (2-3 paragraphs max)
- Use bullet points for steps or lists
- Always be empathetic and encouraging
- If you don't know something, say so honestly
- Never give legal advice – suggest visiting the nearest Jan Seva Kendra
- Include relevant scheme names or document references when applicable`;

const chatHistory = new Map(); // sessionId -> messages[]

const chat = async (req, res) => {
  try {
    const { message, language, sessionId } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build conversation history
    const sid = sessionId || "default";
    if (!chatHistory.has(sid)) {
      chatHistory.set(sid, []);
    }
    const history = chatHistory.get(sid);

    const langInstruction = language === "hi" 
      ? "Respond in Hindi (हिन्दी)."
      : language === "kn" 
      ? "Respond in Kannada (ಕನ್ನಡ)."
      : "Respond in English.";

    const contextMessages = history.slice(-10).map(m => 
      `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`
    ).join("\n");

    const fullPrompt = [
      { text: SYSTEM_PROMPT },
      { text: langInstruction },
      ...(contextMessages ? [{ text: `Previous conversation:\n${contextMessages}` }] : []),
      { text: `User: ${message}` },
    ];

    const result = await model.generateContent(fullPrompt);
    const reply = result.response.text();

    // Save to history (keep last 20 messages per session)
    history.push({ role: "user", text: message });
    history.push({ role: "bot", text: reply });
    if (history.length > 40) history.splice(0, history.length - 40);

    res.json({ success: true, reply, language });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message || "Failed to get response" });
  }
};

module.exports = { chat };
