import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Camera,
  X,
  Copy,
  Eye,
  EyeOff,
  Download,
  AlertCircle,
} from "lucide-react";
import GlassCard from "../components/GlassCard";
import DialectToggle from "../components/DialectToggle";
import ErrorBoundary from "../components/ErrorBoundary";

export default function DocumentScanner() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(""); // OCR progress
  const [result, setResult] = useState(null);
  const [lang, setLang] = useState(localStorage.getItem("lingo_lang") || "en");

  useEffect(() => {
    const handleLangChange = (e) => setLang(e.detail);
    window.addEventListener("lingo_lang_change", handleLangChange);
    return () => window.removeEventListener("lingo_lang_change", handleLangChange);
  }, []);
  const [dragActive, setDragActive] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [textInput, setTextInput] = useState(""); // For manual text entry
  const [useTextMode, setUseTextMode] = useState(false); // Toggle between file and text

  const fileRef = useRef();
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef();

  const detectFileType = (f) => {
    const ext = f.name.split(".").pop().toLowerCase();
    if (["pdf"].includes(ext)) return "pdf";
    if (["docx", "doc"].includes(ext)) return "docx";
    return "image";
  };

  const handleFile = (f) => {
    if (!f) return;
    setError(""); // Clear error when new file selected
    setFile(f);
    setResult(null);

    if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(
      f.name.split(".").pop().toLowerCase()
    )) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type !== "dragleave");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      setError("Camera access denied. Please allow permissions.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      const f = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      handleFile(f);
      closeCamera();
    }, "image/jpeg", 0.92);
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setShowCamera(false);
  };

  const handleSubmit = async () => {
    if (!useTextMode && !file) {
      setError("Please select a file or switch to text mode");
      return;
    }

    if (useTextMode && !textInput.trim()) {
      setError("Please paste or type document text");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // For text input mode, use the chat endpoint with document context
      if (useTextMode) {
        const response = await axios.post("/api/ai/process", {
          type: "chat",
          text: `Simplify and explain this document in plain, village-level language. Provide the answer in the selected language (${lang}). After explaining, list any jargon terms with simple meanings.\n\nDocument Text:\n${textInput}`,
          language: lang,
        });

        if (response.data.success) {
          // Format response to match document scanner format
          setResult({
            originalText: textInput,
            simplifiedText: response.data.reply,
            simplifiedKannada: lang === "kn" ? response.data.reply : "See English version",
            simplifiedHindi: lang === "hi" ? response.data.reply : "See English version",
            documentType: "User Input Text",
            confidence: "medium",
            warnings: "Manual text processing - results may vary",
          });
        } else {
          setError(response.data.error || "Processing failed");
        }
      } else {
        // ═══════════════════════════════════════════════════════════
        // FILE UPLOAD MODE: Send to backend via FormData (multipart)
        // ═══════════════════════════════════════════════════════════
        
        if (!file) {
          setError("Please select a file");
          setLoading(false);
          return;
        }

        setLoadingStatus("📤 Uploading file to server...");

        // Create FormData with file object (NOT just filename)
        const formData = new FormData();
        formData.append("image", file); // ← File object, not string
        formData.append("language", lang);

        try {
          // Send to /api/simplify endpoint (backend handles everything)
          // Content-Type is set automatically by browser when using FormData
          const response = await axios.post("/api/simplify", formData, {
            headers: {
              // Don't set Content-Type - let browser set it with boundary
              // "Content-Type": "multipart/form-data" is set automatically
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setLoadingStatus(`📤 Uploading: ${percentCompleted}%`);
            },
          });

          setLoadingStatus('');
          setLoading(false);

          if (response.data.success) {

            setResult({
              originalText: response.data.data.originalText,
              simplifiedText: response.data.data.simplifiedText,
              simplifiedKannada: response.data.data.simplifiedKannada,
              simplifiedHindi: response.data.data.simplifiedHindi,
              jargonTerms: response.data.data.jargonTerms || [],
              documentType: response.data.data.fileType || response.data.data.documentType,
              confidence: response.data.data.confidence || "medium",
              warnings: response.data.data.warnings || null,
              imageUrl: response.data.data.imageUrl,
              processingStages: response.data.data.processingStages,
              provider: response.data.provider || "Unknown",
            });
          } else {
            setError(response.data.error || "Backend processing failed");
          }
        } catch (err) {
          setLoadingStatus('');
          setLoading(false);

          // Better error messages
          let errorMsg = "Error processing document";
          
          if (err.response?.status === 400) {
            errorMsg = err.response.data.error || "Invalid file - please check format";
          } else if (err.response?.status === 413) {
            errorMsg = "File too large - max 25 MB";
          } else if (err.response?.status === 500) {
            errorMsg = err.response.data.error || "Server error - check backend logs";
          } else if (err.code === "ECONNABORTED") {
            errorMsg = "Upload timeout - file too large or slow connection";
          } else if (err.message?.includes("Network")) {
            errorMsg = "Network error - check your connection";
          }

          setError(`❌ ${errorMsg}`);
        }
      }
    } catch (err) {
      setError(err.message || 'Error processing document');
      setLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const downloadAsText = (text, filename) => {
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const LANG_TABS = [
    { id: "en", label: "English", icon: "🇬🇧" },
    { id: "kn", label: "ಕನ್ನಡ", icon: "🇮🇳" },
    { id: "hi", label: "हिन्दी", icon: "🇮🇳" },
  ];

  const getDisplayText = () => {
    if (lang === "kn") return result?.simplifiedKannada || "Translation unavailable";
    if (lang === "hi") return result?.simplifiedHindi || "Translation unavailable";
    return result?.simplifiedText || "";
  };

  return (
    <ErrorBoundary>
      <div className="page-container max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl md:text-4xl font-bold mb-2">
            <span className="gradient-text">📄 Document Scanner</span>
          </h1>
          <p className="text-purple-300">
            Upload, snap, or drag a document — AI simplifies it and translates to your language
          </p>
        </motion.div>

        {/* Error Alert */}
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

        {/* Camera Modal */}
        <AnimatePresence>
          {showCamera && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
            >
              <div className="relative w-full max-w-2xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-2xl bg-black"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex justify-center gap-4 mt-4">
                  <motion.button
                    onClick={closeCamera}
                    whileTap={{ scale: 0.9 }}
                    className="px-6 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-400/30 hover:bg-red-500/30 transition-all"
                  >
                    <X size={18} className="inline mr-2" />
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={capturePhoto}
                    whileTap={{ scale: 0.9 }}
                    className="px-6 py-3 rounded-lg bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/30"
                  >
                    <Camera size={18} className="inline mr-2" />
                    Capture
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!result ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Mode Toggle */}
            <div className="md:col-span-2 flex gap-2 justify-center mb-4">
              <motion.button
                onClick={() => setUseTextMode(false)}
                whileTap={{ scale: 0.95 }}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  !useTextMode
                    ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                    : "bg-purple-600/20 text-purple-300 border border-purple-400/30 hover:bg-purple-600/30"
                }`}
              >
                📤 File Upload
              </motion.button>
              <motion.button
                onClick={() => setUseTextMode(true)}
                whileTap={{ scale: 0.95 }}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  useTextMode
                    ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                    : "bg-purple-600/20 text-purple-300 border border-purple-400/30 hover:bg-purple-600/30"
                }`}
              >
                ✏️ Paste Text
              </motion.button>
            </div>

            {/* Upload Zone or Text Input */}
            {!useTextMode ? (
              <>
                {/* File Upload */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                    dragActive
                      ? "border-cyan-400 bg-cyan-400/10"
                      : "border-purple-400/20 bg-purple-600/5 hover:border-purple-400/40"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="text-center">
                    <Upload size={40} className="mx-auto mb-3 text-cyan-400" />
                    <h3 className="font-semibold text-lg mb-1">Upload Document</h3>
                    <p className="text-sm text-purple-300 mb-4">
                      Drag & drop or click to browse
                    </p>
                    <p className="text-xs text-purple-400">
                      Supports: Images, PDF, Word documents
                    </p>

                    {file && (
                      <div className="mt-4 p-3 bg-green-500/10 border border-green-400/30 rounded-lg">
                        <p className="text-sm text-green-300">✓ {file.name}</p>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf,.docx,.doc"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files[0])}
                  />
                </motion.div>

                {/* Preview & Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col gap-4"
                >
                  {preview && (
                <div className="rounded-2xl overflow-hidden border border-purple-400/20">
                  <img src={preview} alt="Preview" className="w-full h-64 object-cover" />
                </div>
              )}

              <div className="flex gap-2">
                <motion.button
                  onClick={openCamera}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-lg bg-purple-600/20 text-purple-300 border border-purple-400/20 hover:border-purple-400/40 transition-all font-medium"
                >
                  <Camera size={18} className="inline mr-2" />
                  Capture Photo
                </motion.button>

                <motion.button
                  onClick={handleSubmit}
                  disabled={!file || loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="text-lg"
                      >
                        🔄
                      </motion.div>
                      <span>{loadingStatus || "Processing..."}</span>
                    </div>
                  ) : (
                    "Analyze Document"
                  )}
                </motion.button>
              </div>
            </motion.div>
              </>
            ) : (
              <>
                {/* Text Input */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="md:col-span-2 p-6 rounded-2xl border border-purple-400/20 bg-purple-600/5"
                >
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-cyan-400" />
                    Paste Document Text
                  </h3>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste your document text here... (You can copy text from PDFs, images, or word documents and paste it here for simplification)"
                    className="w-full h-64 p-4 bg-purple-900/20 border border-purple-400/20 rounded-lg text-purple-100 placeholder-purple-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 resize-none"
                  />
                  <div className="mt-4 text-sm text-purple-300 flex justify-between items-center">
                    <span>{textInput.length} characters</span>
                    <motion.button
                      onClick={handleSubmit}
                      disabled={!textInput.trim() || loading}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1 }}
                          >
                            🔄
                          </motion.span>
                          {loadingStatus || "Processing..."}
                        </div>
                      ) : (
                        "Simplify Text"
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Language Tabs */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2 mb-6 flex-wrap"
            >
              {LANG_TABS.map((tab) => (
                <motion.button
                  key={tab.id}
                  onClick={() => setLang(tab.id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all border ${
                    lang === tab.id
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/30"
                      : "bg-purple-600/10 text-purple-300 border-purple-400/20 hover:border-purple-400/40"
                  }`}
                >
                  {tab.icon} {tab.label}
                </motion.button>
              ))}

              <motion.button
                onClick={() => setResult(null)}
                whileTap={{ scale: 0.95 }}
                className="ml-auto px-4 py-2 rounded-lg bg-red-500/10 text-red-300 border border-red-400/20 hover:bg-red-500/20 transition-all"
              >
                ← New Document
              </motion.button>
            </motion.div>

            {/* Results Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Original Text */}
              <GlassCard>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    📋 Original Text
                  </h3>
                  <motion.button
                    onClick={() => copyToClipboard(result.originalText, "original")}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-lg hover:bg-purple-500/20 transition-all"
                  >
                    <Copy
                      size={16}
                      className={`${
                        copied === "original" ? "text-green-400" : "text-purple-300"
                      }`}
                    />
                  </motion.button>
                </div>
                <div className="bg-black/20 rounded-lg p-4 max-h-96 overflow-y-auto text-sm text-purple-100 whitespace-pre-wrap leading-relaxed">
                  {result.originalText || "No text extracted"}
                </div>
                {result.confidence && (
                  <p className="mt-3 text-xs text-purple-400">
                    Confidence: <span className="font-semibold">{result.confidence}</span>
                  </p>
                )}
              </GlassCard>

              {/* Simplified Text */}
              <GlassCard>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    ✨ Simplified ({LANG_TABS.find((t) => t.id === lang)?.label})
                  </h3>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => copyToClipboard(getDisplayText(), "simplified")}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-lg hover:bg-purple-500/20 transition-all"
                    >
                      <Copy
                        size={16}
                        className={`${
                          copied === "simplified" ? "text-green-400" : "text-cyan-300"
                        }`}
                      />
                    </motion.button>
                    <motion.button
                      onClick={() => downloadAsText(getDisplayText(), "simplified.txt")}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 rounded-lg hover:bg-purple-500/20 transition-all"
                    >
                      <Download size={16} className="text-cyan-300" />
                    </motion.button>
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-4 max-h-96 overflow-y-auto text-sm text-cyan-100 whitespace-pre-wrap leading-relaxed">
                  {getDisplayText()}
                </div>
              </GlassCard>
            </motion.div>

            {/* Jargon Terms */}
            {result.jargonTerms && result.jargonTerms.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6"
              >
                <GlassCard>
                  <h3 className="text-lg font-semibold mb-4">📚 Key Terms Explained</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {result.jargonTerms.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-3 bg-purple-600/10 rounded-lg border border-purple-400/10"
                      >
                        <p className="font-semibold text-purple-300 text-sm">{item.term}</p>
                        <p className="text-xs text-purple-200 mt-1">{item.meaning}</p>
                      </motion.div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {/* Metadata */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 grid md:grid-cols-3 gap-4"
            >
              {result.documentType && (
                <GlassCard>
                  <p className="text-xs text-purple-400 mb-1">Document Type</p>
                  <p className="font-semibold text-cyan-300">{result.documentType}</p>
                </GlassCard>
              )}
              {result.department && (
                <GlassCard>
                  <p className="text-xs text-purple-400 mb-1">Department</p>
                  <p className="font-semibold text-cyan-300">{result.department}</p>
                </GlassCard>
              )}
              {result.warnings && (
                <GlassCard>
                  <p className="text-xs text-purple-400 mb-1">⚠️ Important Notes</p>
                  <p className="font-semibold text-yellow-300 text-sm">{result.warnings}</p>
                </GlassCard>
              )}
            </motion.div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
