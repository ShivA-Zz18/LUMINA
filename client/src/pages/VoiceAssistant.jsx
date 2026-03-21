import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, Volume2, User, Bot, AudioLines, AlertCircle } from "lucide-react";
import ErrorBoundary from "../components/ErrorBoundary";

export default function VoiceAssistant() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "🙏 Namaste! I'm your Lingo-Bridge Voice Assistant.\n\nAsk me about:\n• Government schemes & eligibility\n• Document meanings & procedures\n• Your rights as a citizen\n• How to file RTI or grievances\n\nChoose your language and speak or type!",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [lang, setLang] = useState("en-IN");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [systemVoices, setSystemVoices] = useState([]);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const sessionIdRef = useRef(`session-${Date.now()}`);

  const LANGUAGES = [
    { code: "en-IN", label: "🇬🇧 English", langCode: "en" },
    { code: "hi-IN", label: "🇮🇳 हिन्दी", langCode: "hi" },
    { code: "kn-IN", label: "🇮🇳 ಕನ್ನಡ", langCode: "kn" },
  ];

  const getLangCode = () => {
    const lang_config = LANGUAGES.find((l) => l.code === lang);
    return lang_config?.langCode || "en";
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    
    const loadVoices = () => {
      setSystemVoices(window.speechSynthesis.getVoices());
    };
    
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setError("⚠️ Speech Recognition not supported. Please type your questions.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setListening(true);
      setTranscript("🎙️ Listening...");
      setError("");
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + " ";
        } else {
          interimTranscript += t;
        }
      }

      setTranscript(finalTranscript || interimTranscript || "Listening...");

      if (finalTranscript) {
        setTimeout(() => {
          handleSend(finalTranscript.trim());
        }, 300);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      setListening(false);
      setTranscript("");

      const errorMessages = {
        "no-speech": "No speech detected. Please try again.",
        "audio-capture": "Microphone access denied. Check permissions.",
        "network": "Network error. Check internet connection.",
        "aborted": "Listening cancelled.",
      };

      setError(`⚠️ ${errorMessages[event.error] || "Speech error. Try again."}`);
    };

    recognition.onend = () => {
      setListening(false);
      setTranscript("");
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [lang]);

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      setError("Speech recognition not available");
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleSend = async (textToSend) => {
    const message = (textToSend || inputText).trim();

    if (!message) return;

    const userMessage = {
      role: "user",
      text: message,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setTranscript("");
    setIsLoading(true);
    setError("");

    try {
      const response = await axios.post("/api/ai/process", {
        type: "chat",
        text: message,
        language: getLangCode(),
        sessionId: sessionIdRef.current,
      });

      if (response.data.success) {
        const botMessage = {
          role: "bot",
          text: response.data.reply,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error(response.data.error || "No response from AI");
      }
    } catch (err) {
      console.error("Chat Error:", err);

      const errorMsg = err.response?.data?.error || err.message || "Connection failed";
      const botError = {
        role: "bot",
        text: `⚠️ Error: ${errorMsg}\n\nPlease check your connection and try again.`,
        timestamp: Date.now(),
        isError: true,
      };
      setMessages((prev) => [...prev, botError]);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const getBestVoice = (langCode) => {
    const langVoices = systemVoices.filter((v) => v.lang.startsWith(langCode) || v.lang.startsWith(langCode.split("-")[0]));
    
    // Keywords indicating high-quality neural/online voices
    const premiumMarkers = ["natural", "online", "google", "premium", "neural"];
    
    for (const marker of premiumMarkers) {
      const premiumVoice = langVoices.find((v) => v.name.toLowerCase().includes(marker));
      if (premiumVoice) return premiumVoice;
    }
    
    return langVoices[0] || null;
  };

  const speakText = (text) => {
    if (!("speechSynthesis" in window)) {
      setError("⚠️ Text-to-speech not supported in this browser");
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const bestVoice = getBestVoice(lang);
    
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.lang = lang;
    utterance.rate = 0.95; // Slightly slower for more natural, relaxed pacing
    utterance.pitch = 0.98; // Slightly lower pitch for a realistic conversational tone

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error("TTS Error:", e);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  return (
    <ErrorBoundary>
      <div className="page-container flex flex-col max-w-3xl h-full">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 shrink-0"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                <span className="gradient-text">🎤 Voice Assistant</span>
              </h1>
              <p className="text-sm text-purple-300 mt-1">
                Ask in your language • Real-time speech recognition
              </p>
            </div>

            <motion.div className="flex gap-1 p-1 glass-subtle rounded-lg backdrop-blur-md border border-cyan-400/10">
              {LANGUAGES.map((l) => (
                <motion.button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border-none cursor-pointer ${
                    lang === l.code
                      ? "bg-cyan-400/20 text-cyan-300 shadow-lg shadow-cyan-400/10"
                      : "text-purple-400 hover:text-cyan-300 bg-transparent"
                  }`}
                >
                  {l.label}
                </motion.button>
              ))}
            </motion.div>
          </div>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex gap-2 items-start text-sm text-red-300"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 overflow-y-auto glass-subtle rounded-2xl p-4 mb-4 space-y-3 min-h-0"
        >
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              layout
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "bot" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-purple-500/20">
                  <Bot size={14} className="text-white" />
                </div>
              )}

              <div
                className={`max-w-xs md:max-w-sm px-4 py-3 text-sm leading-relaxed rounded-2xl ${
                  msg.role === "user"
                    ? "bg-cyan-400/15 text-cyan-100 rounded-br-sm border border-cyan-400/20"
                    : msg.isError
                    ? "bg-red-500/10 text-red-100 rounded-bl-sm border border-red-400/20"
                    : "glass rounded-bl-sm border border-purple-400/10"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {msg.role === "bot" && !msg.isError && (
                  <motion.button
                    onClick={() => speakText(msg.text)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`mt-2 flex items-center gap-1 text-xs transition-colors border-none cursor-pointer bg-transparent ${
                      isSpeaking
                        ? "text-cyan-300"
                        : "text-purple-400 hover:text-cyan-400"
                    }`}
                  >
                    <Volume2 size={12} />
                    {isSpeaking ? "Playing..." : "Listen"}
                  </motion.button>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-cyan-500/20">
                  <User size={14} className="text-white" />
                </div>
              )}
            </motion.div>
          ))}

          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex gap-2.5"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="glass rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  <motion.span
                    animate={{ scale: [0.8, 1.2, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}
                    className="w-2 h-2 rounded-full bg-purple-400"
                  />
                  <motion.span
                    animate={{ scale: [0.8, 1.2, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
                    className="w-2 h-2 rounded-full bg-purple-400"
                  />
                  <motion.span
                    animate={{ scale: [0.8, 1.2, 0.8] }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
                    className="w-2 h-2 rounded-full bg-purple-400"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={chatEndRef} />
        </motion.div>

        <AnimatePresence>
          {(listening || transcript) && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="text-center mb-3"
            >
              <span className="px-4 py-2 glass-subtle rounded-full text-xs md:text-sm text-cyan-300 inline-flex items-center gap-2 border border-cyan-400/20">
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }}>
                  <AudioLines size={14} />
                </motion.span>
                {transcript || "Listening..."}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 items-end shrink-0"
        >
          <motion.button
            onClick={handleMicClick}
            disabled={isLoading}
            whileHover={{ scale: listening ? 0.95 : 1.05 }}
            whileTap={{ scale: 0.9 }}
            className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer border-none transition-all ${
              listening
                ? "bg-red-500/30 text-red-300 shadow-lg shadow-red-500/20 animate-pulse"
                : "bg-cyan-400/20 text-cyan-300 hover:bg-cyan-400/30 shadow-lg shadow-cyan-500/10"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </motion.button>

          <input
            type="text"
            placeholder="Or type your question..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isLoading}
            className="flex-1 bg-purple-600/10 text-white placeholder-purple-400 px-4 py-3 rounded-xl border border-purple-400/10 focus:border-purple-400/30 focus:outline-none focus:ring-2 focus:ring-purple-400/20 transition-all disabled:opacity-50"
          />

          <motion.button
            onClick={() => handleSend()}
            disabled={isLoading || !inputText.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer border-none bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </motion.button>
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
