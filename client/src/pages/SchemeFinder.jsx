import { useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, MapPin, ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import GlassCard from "../components/GlassCard";
import VerifiedBadge from "../components/VerifiedBadge";
import UpiPayButton from "../components/UpiPayButton";
import LoadingOrb from "../components/LoadingOrb";

const OCCUPATIONS = [
  "farmer", "agricultural_worker", "self_employed", "shopkeeper",
  "artisan", "vendor", "labourer", "student", "homemaker", "other",
];

const CATEGORY_COLORS = {
  agriculture: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/15" },
  housing: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/15" },
  health: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/15" },
  education: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/15" },
  finance: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/15" },
  welfare: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/15" },
};

export default function SchemeFinder() {
  const [form, setForm] = useState({ age: "", income: "", occupation: "", documentNumber: "" });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!form.age || !form.income || !form.occupation) return;
    setLoading(true);
    try {
      const { data } = await axios.post("/api/schemes/match", form);
      setResults(data);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to search schemes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-bold mb-1">
          <span className="gradient-text">Scheme Finder</span>
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-8">
          Enter your details — AI matches you with eligible government schemes
        </p>

        {/* Profile Form */}
        <GlassCard hover={false} className="mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label>Age</label>
                <input
                  id="scheme-age"
                  type="number"
                  min="0"
                  max="120"
                  placeholder="e.g. 35"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                />
              </div>
              <div>
                <label>Annual Income (₹)</label>
                <input
                  id="scheme-income"
                  type="number"
                  min="0"
                  placeholder="e.g. 150000"
                  value={form.income}
                  onChange={(e) => setForm({ ...form, income: e.target.value })}
                />
              </div>
              <div>
                <label>Occupation</label>
                <select
                  id="scheme-occupation"
                  value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                >
                  <option value="">Select occupation…</option>
                  {OCCUPATIONS.map((o) => (
                    <option key={o} value={o}>
                      {o.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>API Setu Check (Optional)</label>
                <input
                  id="scheme-document"
                  type="text"
                  placeholder="Ration/Aadhaar No."
                  value={form.documentNumber}
                  onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
                <Search size={18} /> Find My Schemes
              </button>
            </div>
          </form>
        </GlassCard>

        {loading && <LoadingOrb text="Matching you with government schemes…" />}

        {/* Results */}
        <AnimatePresence>
          {results && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--text-secondary)]">
                  Found <span className="text-purple-400 font-bold">{results.total}</span> eligible scheme{results.total !== 1 ? "s" : ""}
                </p>
                <div className="flex gap-2">
                  {["Age: " + results.profile.age, "₹" + Number(results.profile.income).toLocaleString()].map((t) => (
                    <span key={t} className="badge bg-white/5 text-[var(--text-tertiary)] border border-white/5">{t}</span>
                  ))}
                  {results.apiSetuVerified && (
                     <span className="badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 flex items-center gap-1">
                       ✅ BPL Verified
                     </span>
                  )}
                </div>
              </div>

              {results.data.map((scheme, i) => {
                const cat = CATEGORY_COLORS[scheme.category] || CATEGORY_COLORS.welfare;
                const isOpen = expanded === i;
                return (
                  <motion.div
                    key={scheme._id || i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <GlassCard hover={false} className="overflow-hidden">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <h3 className="text-base font-bold text-[var(--text-primary)]">{scheme.name}</h3>
                            {scheme.verifiedBPL && (
                                <span title="Verified by API Setu" className="text-xl">✅</span>
                            )}
                            <span className={`badge ${cat.bg} ${cat.text} border ${cat.border} capitalize`}>
                              {scheme.category}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{scheme.description}</p>
                        </div>
                        {scheme.verifiedSource && <VerifiedBadge source={scheme.verifiedSource} />}
                      </div>

                      {/* Match Bar */}
                      <div className="flex items-center gap-3 mt-4">
                        <TrendingUp size={14} className="text-emerald-400 shrink-0" />
                        <div className="flex-1 progress-bar">
                          <motion.div
                            className="progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${scheme.matchPercent}%` }}
                            transition={{ duration: 1, delay: i * 0.08 }}
                          />
                        </div>
                        <span className="text-xs font-bold text-emerald-400 min-w-[3rem] text-right">
                          {scheme.matchPercent}% match
                        </span>
                      </div>

                      {/* Expand Toggle */}
                      <button
                        onClick={() => setExpanded(isOpen ? null : i)}
                        className="flex items-center gap-1.5 mt-3 text-xs text-purple-400 font-medium cursor-pointer bg-transparent border-none hover:text-purple-300 transition-colors"
                      >
                        {isOpen ? "Hide details" : "View details & apply"}
                        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="section-divider" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                <div>
                                  <p className="text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-1">💰 Benefits</p>
                                  <p className="text-sm text-[var(--text-primary)]">{scheme.benefits}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <MapPin size={12} /> Nearest Center
                                  </p>
                                  <p className="text-sm text-[var(--text-primary)]">{scheme.nearestCenter}</p>
                                </div>
                                {scheme.nextSteps?.length > 0 && (
                                  <div>
                                    <p className="text-xs text-[var(--text-tertiary)] font-bold uppercase tracking-wider mb-2">📋 Next Steps</p>
                                    <ol className="space-y-1.5">
                                      {scheme.nextSteps.map((s, j) => (
                                        <li key={j} className="text-sm text-[var(--text-secondary)] flex gap-2">
                                          <span className="text-purple-400 font-bold shrink-0">{j + 1}.</span>{s}
                                        </li>
                                      ))}
                                    </ol>
                                  </div>
                                )}
                                {scheme.applicationUrl && (
                                  <a
                                    href={scheme.applicationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-secondary inline-flex items-center gap-2 text-sm no-underline mt-2"
                                  >
                                    <ExternalLink size={14} /> Apply Online
                                  </a>
                                )}
                              </div>
                              <div>
                                <UpiPayButton
                                  payeeName={scheme.name}
                                  payeeVPA="ministry@sbi"
                                  amount={scheme.applicationFee || 0}
                                  note={`${scheme.name} application fee`}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
