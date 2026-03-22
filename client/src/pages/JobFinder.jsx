import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { ArrowRight, ChevronRight, Briefcase, Calendar, MapPin, Sparkles } from "lucide-react";

const API_BASE = "";

const LANGUAGES = [
  { label: "English", value: "English" },
  { label: "ಕನ್ನಡ (Kannada)", value: "Kannada" },
  { label: "हिन्दी (Hindi)", value: "Hindi" },
];

const LOCATIONS = [
  { label: "Global (India-wide)", value: "Global" },
  { label: "Karnataka (State)", value: "Karnataka" },
  { label: "Dakshina Kannada", value: "Dakshina Kannada" },
  { label: "Udupi", value: "Udupi" },
  { label: "Bangalore", value: "Bangalore" },
];

const SPRING_TRANSITION = { type: "spring", stiffness: 100, damping: 12 };

const SCORE_COLOR = (score) => {
  if (score >= 80) return "#39ff14"; // Cyber Green
  if (score >= 50) return "#ffaa00"; // Neon Amber
  return "#f87171"; // Red
};

const SCORE_LABEL = (score) => {
  if (score >= 80) return "High Match";
  if (score >= 50) return "Moderate";
  return "Low Match";
};

const CardSkeleton = () => (
  <div className="flex flex-col gap-6 w-full">
    {[...Array(3)].map((_, i) => (
      <div 
        key={i} 
        className="relative rounded-2xl p-6 md:p-8 overflow-hidden bg-[#060b17]/60 backdrop-blur-2xl border border-white/5 shadow-2xl"
      >
        {/* Shimmer overlay mimicking glass background */}
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear", delay: i * 0.15 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg]"
        />
        <div className="flex justify-between items-start mb-6 gap-4">
          <div className="flex-1 space-y-3">
            <div className="w-3/4 h-8 bg-white/10 rounded-lg backdrop-blur-sm" />
            <div className="flex gap-2">
              <div className="w-24 h-6 bg-white/5 rounded-full" />
              <div className="w-32 h-6 bg-white/5 rounded-full" />
            </div>
          </div>
          <div className="w-16 h-16 rounded-full bg-white/5 backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.05)]" />
        </div>
        <div className="w-full h-4 bg-white/5 rounded-md mb-4 backdrop-blur-sm" />
        <div className="w-4/5 h-4 bg-white/5 rounded-md mb-8 backdrop-blur-sm" />
        <div className="w-36 h-12 bg-[#00d4ff]/10 rounded-xl backdrop-blur-sm" />
      </div>
    ))}
  </div>
);

const ScoreOrb = ({ score }) => {
  const color = SCORE_COLOR(score);
  return (
    <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
      <svg viewBox="0 0 52 52" width="64" height="64" className="absolute drop-shadow-2xl">
        <circle cx="26" cy="26" r="22" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="none" />
        <motion.circle 
          cx="26" cy="26" r="22" stroke={color} strokeWidth="4.5" fill="none"
          strokeLinecap="round" transform="rotate(-90 26 26)"
          initial={{ strokeDasharray: "0 138" }}
          animate={{ strokeDasharray: `${(score / 100) * 138} 138` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color}80)` }} // Glowing effect
        />
      </svg>
      <div className="flex flex-col items-center justify-center z-10">
        <span className="text-sm font-black tracking-tight" style={{ color, textShadow: `0 0 15px ${color}` }}>
          {score}
        </span>
      </div>
    </div>
  );
};

const JobCard = ({ job, index, currentLanguage }) => {
  let displaySummary = job.summary_english || job.simplified_summary_local;
  if (currentLanguage === "Kannada") displaySummary = job.summary_kannada || job.simplified_summary_local;
  if (currentLanguage === "Hindi") displaySummary = job.summary_hindi || job.simplified_summary_local;

  return (
    <motion.div 
      layoutId={`job-${job.apply_link || index}`}
      initial={{ opacity: 0, y: 30 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ ...SPRING_TRANSITION, delay: index * 0.05 }}
      whileHover={{ y: -6, scale: 1.02 }}
      className="relative rounded-2xl p-[1px] mb-8 overflow-hidden group shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-15px_rgba(0,212,255,0.2)] transition-shadow duration-500"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#060b17]/95 to-[#040711]/95 backdrop-blur-3xl rounded-2xl" />
      
      {/* ── Inner Content wrapper with precise corner matching ── */}
      <div className="relative z-10 p-6 md:p-8 flex flex-col h-full bg-transparent rounded-[15px] transition-colors duration-500">
        
        {/* Header Section */}
        <div className="flex justify-between items-start gap-5 mb-6">
          <div className="flex-1">
            <h3 className="text-2xl font-extrabold text-white mb-3 tracking-tight group-hover:text-[#00d4ff] transition-colors duration-300">
              {job.title}
            </h3>
            
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${job.sector === 'Government' ? 'bg-[#ffaa00]/10 border-[#ffaa00]/20 text-[#ffaa00]' : 'bg-[#39ff14]/10 border-[#39ff14]/20 text-[#39ff14]'}`}>
                <Briefcase size={14} />
                {job.sector || 'Private'}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 text-white/80">
                <MapPin size={14} />
                {job.source}
              </span>
              {job.last_date && job.last_date !== "Not Specified" && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-[#00d4ff]/10 border-[#00d4ff]/20 text-[#00d4ff]">
                  <Calendar size={14} />
                  {job.last_date}
                </span>
              )}
            </div>
          </div>
          <ScoreOrb score={job.eligibility_score ?? 0} />
        </div>
        
        {/* Progress Bar Section */}
        <div className="flex items-center gap-4 mb-6 bg-black/20 p-3 rounded-xl border border-white/5">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              className="h-full rounded-full shadow-[0_0_10px_currentColor]" 
              style={{ background: SCORE_COLOR(job.eligibility_score ?? 0), color: SCORE_COLOR(job.eligibility_score ?? 0) }} 
              initial={{ width: 0 }} 
              animate={{ width: `${job.eligibility_score ?? 0}%` }} 
              transition={{ duration: 1, delay: index * 0.05 + 0.2, ease: "easeOut" }} 
            />
          </div>
          <span className="text-xs font-black uppercase tracking-wider min-w-[80px] text-right" style={{ color: SCORE_COLOR(job.eligibility_score ?? 0) }}>
            {SCORE_LABEL(job.eligibility_score ?? 0)}
          </span>
        </div>

        {/* Local Advantage Box */}
        {job.local_advantage && (
          <div className="flex items-start gap-2 text-sm font-semibold text-[#ffaa00] mb-5 bg-[#ffaa00]/10 border border-[#ffaa00]/20 p-4 rounded-xl shadow-[inset_0_0_20px_rgba(255,170,0,0.05)]">
            <Sparkles size={18} className="shrink-0 mt-0.5" />
            <span className="leading-relaxed">Local Advantage: {job.local_advantage}</span>
          </div>
        )}

        {/* Job Summary Description */}
        <div className="mb-7 pl-4 border-l-2 border-white/10 group-hover:border-[#00d4ff]/40 transition-colors duration-300">
          <p className="text-[15px] text-white/70 leading-relaxed font-medium">
            {displaySummary}
          </p>
        </div>

        {/* Action Button */}
        {job.apply_link && (
          <motion.a 
            href={job.apply_link} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="group/btn inline-flex items-center justify-center gap-3 self-start bg-gradient-to-r from-[#ec4899] via-[#d946ef] to-[#8b5cf6] text-white font-black text-lg uppercase tracking-wider px-10 py-4 rounded-xl transition-all shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:shadow-[0_0_50px_rgba(236,72,153,0.7)] border border-white/20"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <span>Apply Opportunity</span>
            <ChevronRight size={18} className="text-white group-hover/btn:translate-x-1 transition-transform" />
          </motion.a>
        )}
      </div>
    </motion.div>
  );
};

export default function JobFinder() {
  const [keyword, setKeyword] = useState("");
  const getFullLangName = (shortCode) => {
    if (shortCode === "hi") return "Hindi";
    if (shortCode === "kn") return "Kannada";
    return "English";
  };
  const [language, setLanguage] = useState(getFullLangName(localStorage.getItem("lingo_lang") || "en"));

  useEffect(() => {
    const handleLangChange = (e) => setLanguage(getFullLangName(e.detail));
    window.addEventListener("lingo_lang_change", handleLangChange);
    return () => window.removeEventListener("lingo_lang_change", handleLangChange);
  }, []);
  const [location, setLocation] = useState("Global");
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cacheHit, setCacheHit] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchJobs = async (kw = keyword, loc = location) => {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await axios.get(`${API_BASE}/api/jobs`, { 
        params: { keyword: kw, location: loc } 
      });
      setJobs(res.data.data || []);
      setCacheHit(res.data.source === "cache");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch jobs. Please try again.");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };


  const handleSearch = (e) => {
    e.preventDefault();
    fetchJobs();
  };

  return (
    <main className="relative w-full min-h-screen bg-[#04060c] overflow-hidden text-white pt-10 pb-20 px-4 flex flex-col items-center">
      <style>{`
        select option { background: #0a0f1e; color: white; border: none; padding: 10px; }
      `}</style>
      
      {/* ── Immersive Ambient Galaxy Background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
        <div className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-[#00d4ff] opacity-10 blur-[150px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-[#39ff14] opacity-[0.06] blur-[150px] mix-blend-screen" />
        <div className="absolute top-[30%] left-[30%] w-[40vw] h-[40vw] rounded-full bg-purple-600 opacity-[0.05] blur-[120px] mix-blend-screen" />
      </div>

      <div className="relative z-10 w-full max-w-[1200px] pt-4">
        
        {/* Hero Section */}
        <div className="text-center mb-12">
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={SPRING_TRANSITION}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00d4ff]/10 to-[#39ff14]/10 border border-[#00d4ff]/20 text-[#00d4ff] text-[11px] font-black tracking-[0.2em] uppercase px-5 py-2 rounded-full mb-6 shadow-[0_0_20px_rgba(0,212,255,0.1)]"
          >
            <Sparkles size={14} className="text-[#39ff14]" />
            AI-Powered Discovery
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ ...SPRING_TRANSITION, delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/40 mb-4 tracking-tight"
          >
            Universal Job Portal
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ ...SPRING_TRANSITION, delay: 0.2 }}
            className="text-white/50 text-base md:text-lg font-medium max-w-2xl mx-auto"
          >
            Govt & Private jobs perfectly tailored for your profile, skills, and exact location.
          </motion.p>
        </div>

        {/* Search Bar Block */}
        <motion.form 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ ...SPRING_TRANSITION, delay: 0.3 }}
          className="relative rounded-2xl p-[1px] mb-12 z-20 group shadow-2xl"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 100%)" }}
          onSubmit={handleSearch}
        >
          <div className="relative z-10 flex flex-col sm:flex-row gap-3 bg-[#060b17]/80 backdrop-blur-3xl rounded-[15px] p-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Enter Keywords or 'Trending Jobs'"
              className="flex-1 min-w-[200px] bg-transparent border-none px-5 py-4 text-white placeholder-white/30 text-[15px] font-medium focus:outline-none"
            />
            <div className="w-[1px] bg-white/10 hidden sm:block my-2" />
            <select 
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              className="sm:w-[180px] bg-transparent border-none px-4 py-4 text-white/80 focus:text-white font-medium focus:outline-none appearance-none cursor-pointer"
            >
              {LOCATIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <div className="w-[1px] bg-white/10 hidden sm:block my-2" />
            <select 
              value={language} 
              onChange={(e) => {
                setLanguage(e.target.value);
                const shortCode = e.target.value === "Hindi" ? "hi" : e.target.value === "Kannada" ? "kn" : "en";
                localStorage.setItem("lingo_lang", shortCode);
                window.dispatchEvent(new CustomEvent("lingo_lang_change", { detail: shortCode }));
              }}
              className="sm:w-[150px] bg-transparent border-none px-4 py-4 text-white/80 focus:text-white font-medium focus:outline-none appearance-none cursor-pointer"
            >
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            
            <motion.button 
              type="submit" 
              disabled={loading}
              className="md:w-auto w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#39ff14] to-[#00d4ff] text-[#04060c] font-black rounded-xl px-12 py-5 sm:ml-2 shadow-[0_0_30px_rgba(57,255,20,0.5)] hover:shadow-[0_0_50px_rgba(0,212,255,0.8)] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-base sm:text-lg"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-xl">🔍</span>
              {loading ? "Discovering..." : "Scan"}
            </motion.button>
          </div>
        </motion.form>

        {/* Notices */}
        {cacheHit && (
          <p className="text-xs font-bold text-[#00d4ff] text-right mt-[-1.5rem] mb-6 tracking-wide drop-shadow-[0_0_10px_rgba(0,212,255,0.5)]">
            ⚡ Lighting Fast Cache
          </p>
        )}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 rounded-2xl text-center mb-8 font-semibold shadow-lg">
            ⚠️ {error}
          </motion.div>
        )}
        
        {loading && <CardSkeleton />}

        {/* Results Stream */}
        {!loading && searched && !error && (
          <div className="z-10 relative">
            {jobs.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 mb-8 px-2 border-b border-white/5 pb-4">
                <span className="flex items-center justify-center bg-[#00d4ff]/20 text-[#00d4ff] font-black text-xl w-10 h-10 rounded-xl shadow-[0_0_15px_rgba(0,212,255,0.2)]">
                  {jobs.length}
                </span>
                <span className="font-medium text-white/60 text-[15px]">
                  matches for <strong className="text-white">"{keyword || 'Trending Roles'}"</strong> based in <strong className="text-[#39ff14] border-b border-[#39ff14]/30">{location}</strong>
                </span>
              </motion.div>
            )}

            {jobs.length === 0 ? (
              <AnimatePresence>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }}
                  transition={SPRING_TRANSITION}
                  className="bg-white/5 border border-white/10 rounded-3xl p-16 text-center shadow-xl backdrop-blur-md"
                >
                  <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
                    🛸
                  </div>
                  <h3 className="text-2xl font-bold mb-2">No missions found</h3>
                  <p className="text-white/50">Expand your search parameters to discover more localized roles.</p>
                </motion.div>
              </AnimatePresence>
            ) : (
              <AnimatePresence>
                {jobs.map((job, i) => (
                  <JobCard key={job.apply_link || i} job={job} index={i} currentLanguage={language} />
                ))}
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
