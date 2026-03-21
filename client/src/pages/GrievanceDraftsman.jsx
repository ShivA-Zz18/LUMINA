import { useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { PenLine, Copy, Download, Lightbulb, AlertTriangle, Check, Send } from "lucide-react";
import GlassCard from "../components/GlassCard";
import LoadingOrb from "../components/LoadingOrb";

const INTENTS = [
  { id: "reply", label: "Formal Reply", icon: "✉️", desc: "Draft a formal response letter" },
  { id: "grievance", label: "Grievance Letter", icon: "📝", desc: "File a complaint or grievance" },
  { id: "rti", label: "RTI Request", icon: "📋", desc: "Right to Information application" },
];

export default function GrievanceDraftsman() {
  const location = useLocation();
  const [context, setContext] = useState(location.state?.context || "");
  const [intent, setIntent] = useState("grievance");
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [editedDraft, setEditedDraft] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!context.trim()) return alert("Please enter the document context");
    setLoading(true);
    try {
      const { data } = await axios.post("/api/ai/grievance", {
        documentContext: context,
        userIntent: intent,
        language,
      });
      // Endpoint returns either { data: {...} } or {...} depending on caller
      const result = data.data || data;
      setResult(result);
      setEditedDraft(result.draft_content || result.draftLetter || "");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to generate draft");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([editedDraft], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lingo-bridge-${intent}-draft.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold mb-1">
          <span className="gradient-text">Grievance Draftsman</span>
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          AI-powered drafting of formal replies, grievance letters, and RTI requests
        </p>

        {/* Intent Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {INTENTS.map((i) => (
            <button
              key={i.id}
              onClick={() => setIntent(i.id)}
              className={`p-4 rounded-xl text-left cursor-pointer transition-all duration-300 border
                ${intent === i.id
                  ? "glass border-purple-500/30 shadow-lg shadow-purple-500/5"
                  : "glass-subtle border-transparent hover:border-white/10"}`}
            >
              <span className="text-2xl block mb-2">{i.icon}</span>
              <p className="text-sm font-bold text-[var(--text-primary)]">{i.label}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{i.desc}</p>
            </button>
          ))}
        </div>

        {/* Context Input */}
        <GlassCard hover={false} className="mb-4">
          <label>Document Context / Situation</label>
          <textarea
            id="grievance-context"
            rows={5}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste the simplified document text, or describe your situation in detail…"
            className="mt-1"
          />
        </GlassCard>

        {/* Language & Generate */}
        <div className="flex items-end gap-4 flex-wrap mb-2">
          <div className="w-48">
            <label>Output Language</label>
            <select id="grievance-language" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>
          <button
            id="generate-grievance"
            onClick={handleGenerate}
            disabled={loading || !context.trim()}
            className="btn-primary flex items-center gap-2"
          >
            <Send size={18} /> Generate Draft
          </button>
        </div>

        {loading && <LoadingOrb text="Nyay Lekhak is composing your letter…" />}

        {/* Result */}
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 space-y-5"
          >
            {/* Draft Editor */}
            <GlassCard hover={false}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <PenLine size={16} className="text-purple-400" />
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {(result.document_type || result.formatType || result.letterType || "DOCUMENT")?.toUpperCase()} Draft
                  </h3>
                  <span className="badge bg-purple-500/10 text-purple-400 border border-purple-500/15">Editable</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={handleDownload} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                    <Download size={14} /> Download
                  </button>
                </div>
              </div>
              <textarea
                id="draft-editor"
                value={editedDraft}
                onChange={(e) => setEditedDraft(e.target.value)}
                rows={16}
                className="w-full text-sm leading-relaxed"
                style={{ minHeight: "300px", fontFamily: "var(--font-body)" }}
              />
            </GlassCard>

            {/* Legal Citations */}
            {result.key_sections_cited?.length > 0 && (
              <GlassCard hover={false}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400/80 flex items-center gap-2 mb-3">
                  <Lightbulb size={14} /> Relevant Legal Sections
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.key_sections_cited.map((section, i) => (
                    <span key={i} className="badge bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs">
                      {section}
                    </span>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Next Steps / Tips */}
            {(result.next_steps || result.tips)?.length > 0 && (
              <GlassCard hover={false}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/80 flex items-center gap-2 mb-3">
                  <Lightbulb size={14} /> Next Steps
                </h3>
                <ul className="space-y-2">
                  {(result.next_steps || result.tips).map((tip, i) => (
                    <li key={i} className="text-sm text-[var(--text-secondary)] flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}

            {/* Disclaimer */}
            {result.disclaimer && (
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-500/6 border border-red-500/12">
                <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300/80">{result.disclaimer}</p>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
