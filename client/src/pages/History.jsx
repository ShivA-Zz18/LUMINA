import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Clock, FileText, Trash2, Eye, ChevronDown } from "lucide-react";
import GlassCard from "../components/GlassCard";
import LoadingOrb from "../components/LoadingOrb";

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data } = await axios.get("/api/simplify/history");
      setHistory(data.data || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this history item?")) return;
    try {
      await axios.delete(`/api/simplify/history/${id}`);
      setHistory(prev => prev.filter((item) => item._id !== id));
    } catch (err) {
      alert("Failed to delete history item: " + (err.response?.data?.error || err.message));
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Are you sure you want to delete ALL your history? This will free up database storage and cannot be undone.")) return;
    try {
      await axios.delete("/api/simplify/history");
      setHistory([]);
    } catch (err) {
      alert("Failed to clear history: " + (err.response?.data?.error || err.message));
    }
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncate = (text, len = 120) =>
    text?.length > len ? text.slice(0, len) + "…" : text || "";

  if (loading) return <div className="page-container"><LoadingOrb text="Loading history…" /></div>;

  return (
    <div className="page-container max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold mb-1">
          <span className="gradient-text">Scan History</span>
        </h1>
        <div className="flex items-center justify-between mb-8">
          <p className="text-sm text-[var(--text-secondary)]">
            Your previously simplified documents
          </p>
          {history.length > 0 && (
            <button 
              onClick={clearAll} 
              className="text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 border border-red-500/20 cursor-pointer"
            >
              <Trash2 size={14} /> Clear All
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center text-4xl mb-5 animate-float">
              📭
            </div>
            <h2 className="text-lg font-bold mb-1">No History Yet</h2>
            <p className="text-sm text-[var(--text-secondary)] text-center max-w-sm">
              Documents you scan and simplify will appear here. Head to the
              <a href="/scanner" className="text-purple-400 mx-1">Document Scanner</a>
              to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item, i) => {
              const isOpen = expanded === i;
              return (
                <motion.div
                  key={item._id || i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <GlassCard hover={false}>
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      {item.imageUrl && (
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-white/5 hidden sm:block">
                          <img
                            src={item.imageUrl}
                            alt="Document"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="badge bg-purple-500/10 text-purple-400 border border-purple-500/15">
                            {item.language?.toUpperCase() || "EN"}
                          </span>
                          {item.dialect && item.dialect !== "standard" && (
                            <span className="badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/15">
                              {item.dialect}
                            </span>
                          )}
                          <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 ml-auto">
                            <Clock size={11} /> {formatDate(item.createdAt)}
                          </span>
                          <button
                            onClick={(e) => deleteItem(item._id, e)}
                            className="text-red-400/70 hover:text-red-400 ml-2 p-1.5 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer border-none bg-transparent"
                            title="Delete this record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          {truncate(item.simplifiedText)}
                        </p>

                        <button
                          onClick={() => setExpanded(isOpen ? null : i)}
                          className="flex items-center gap-1 mt-2 text-xs text-purple-400 font-medium cursor-pointer bg-transparent border-none hover:text-purple-300 transition-colors"
                        >
                          {isOpen ? "Hide full text" : "View full text"}
                          <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded view */}
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        className="overflow-hidden"
                      >
                        <div className="section-divider" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-2">Original</p>
                            <div className="glass-subtle p-3 rounded-xl max-h-48 overflow-y-auto">
                              <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap">{item.originalText}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-2">Simplified</p>
                            <div className="glass-subtle p-3 rounded-xl max-h-48 overflow-y-auto">
                              <p className="text-xs text-[var(--text-primary)] whitespace-pre-wrap">{item.simplifiedText}</p>
                            </div>
                          </div>
                        </div>

                        {item.jargonTerms?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-2">Jargon Glossary</p>
                            <div className="flex flex-wrap gap-2">
                              {item.jargonTerms.map((j, k) => (
                                <span key={k} className="badge glass-subtle text-[var(--text-secondary)]">
                                  <strong className="text-purple-300 mr-1">{j.term}:</strong> {j.meaning}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
