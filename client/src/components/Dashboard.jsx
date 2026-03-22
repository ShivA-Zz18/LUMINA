import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, ScanLine, ScrollText, MessageSquareWarning,
  Mic, Briefcase, Clock, ArrowRight, ScanSearch, Building2, CircleDot,
  Sparkles, Fingerprint, Radio
} from "lucide-react";
import GlowIcon from "./GlowIcon.jsx";
import BentoCard from "./BentoCard.jsx";
import FloatingParticles from "./FloatingParticles.jsx";
import HeroOrb from "./HeroOrb.jsx";
import StatusBar from "./StatusBar.jsx";
import { t, languageNames } from "@/lib/i18n.js";

const spring = { type: "spring", stiffness: 260, damping: 20 };

const navItems = [
  { key: "nav.home", icon: Home, emoji: "🏠", path: "/" },
  { key: "nav.scanner", icon: ScanLine, emoji: "📸", path: "/scanner" },
  { key: "nav.schemes", icon: ScrollText, emoji: "📋", path: "/schemes" },
  { key: "nav.grievance", icon: MessageSquareWarning, emoji: "⚡", path: "/grievance" },
  { key: "nav.voice", icon: Mic, emoji: "🎙", path: "/voice" },
  { key: "nav.jobs", icon: Briefcase, emoji: "💼", path: "/jobs" },
  { key: "nav.history", icon: Clock, emoji: "🕐", path: "/history" },
];

const Dashboard = () => {
  const [lang, setLang] = useState(localStorage.getItem("lingo_lang") || "en");
  const [activeNav, setActiveNav] = useState("nav.home");
  const navigate = useNavigate();

  useEffect(() => {
    const handleLangChange = (e) => setLang(e.detail);
    window.addEventListener("lingo_lang_change", handleLangChange);
    return () => window.removeEventListener("lingo_lang_change", handleLangChange);
  }, []);

  const handleNavClick = (item) => {
    setActiveNav(item.key);
    if (item.path !== "/") {
      navigate(item.path);
    }
  };

  return (
    <div className="min-h-screen mesh-gradient-bg relative overflow-hidden noise-overlay">
      <FloatingParticles />
      <div className="fixed inset-0 grid-pattern pointer-events-none z-0" />

      {/* Mesh gradient orbs - enhanced */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-[800px] h-[800px] rounded-full bg-neon-cyan/[0.05] blur-[180px] animate-glow-pulse" />
        <div className="absolute -bottom-40 -left-40 w-[800px] h-[800px] rounded-full bg-neon-pink/[0.05] blur-[180px] animate-glow-pulse" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-secondary/[0.03] blur-[140px]" />
        <div className="absolute top-2/3 right-1/4 w-[300px] h-[300px] rounded-full bg-neon-amber/[0.02] blur-[100px] animate-glow-pulse" style={{ animationDelay: "3s" }} />
      </div>

      {/* Orbiting particles */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
        <div className="animate-orbit">
          <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan/40 shadow-[0_0_10px_hsl(186_100%_50%/0.7)]" />
        </div>
        <div className="animate-orbit-reverse">
          <div className="w-1 h-1 rounded-full bg-secondary/30 shadow-[0_0_8px_hsl(270_80%_60%/0.5)]" />
        </div>
      </div>



      <div className="relative z-10 max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
        >
          <HeroOrb />

          <AnimatePresence mode="wait">
            <motion.div
              key={lang}
              initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -15, filter: "blur(4px)" }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold font-display text-foreground mb-5 tracking-tight">
                {lang === "en" ? (
                  <>LUMI<span className="text-gradient-cyber">NA</span></>
                ) : (
                  <span className="text-gradient-cyber">{t("app.title", lang)}</span>
                )}
              </h1>
              <p className="text-muted-60 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                {t("app.subtitle", lang)}
                <span className="inline-block w-[2px] h-4 bg-primary ml-1.5 align-middle animate-typing-cursor" />
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Decorative line */}
          <motion.div
            className="mt-8 mx-auto h-[1px] max-w-sm"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            style={{
              background: "linear-gradient(90deg, transparent, hsl(186 100% 50% / 0.5), hsl(270 80% 60% / 0.3), transparent)",
            }}
          />
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-5xl mx-auto">
          {/* Multimodal Scanner — large card */}
          <div className="lg:col-span-6 lg:row-span-2">
            <BentoCard hasAurora delay={0.2} className="h-full min-h-[420px]" onClick={() => navigate("/scanner")}>
              <div className="flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center gap-3">
                    <GlowIcon icon={ScanSearch} color="cyan" />
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/20">
                      <Radio size={10} className="text-neon-cyan animate-pulse" />
                      <span className="text-[9px] text-neon-cyan font-bold uppercase tracking-widest">Active</span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold font-display text-foreground mt-5 mb-2">{t("card.scanner", lang)}</h3>
                  <p className="text-muted-60 text-sm leading-relaxed">{t("card.scanner.desc", lang)}</p>
                  <motion.button
                    onClick={(e) => { e.stopPropagation(); navigate("/scanner"); }}
                    whileHover={{ x: 8, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 mt-5 text-primary text-sm font-bold uppercase tracking-widest group/btn"
                  >
                    <Sparkles size={14} className="animate-glow-pulse" />
                    {t("card.scanner.cta", lang)}
                    <ArrowRight size={16} className="transition-transform group-hover/btn:translate-x-1.5" />
                  </motion.button>
                </div>
                {/* Scanner preview */}
                <div className="relative mt-6 rounded-xl border border-border/50 overflow-hidden h-40 bg-muted/5">
                  <div className="absolute inset-0" style={{
                    backgroundImage: "linear-gradient(hsl(186 100% 50% / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(186 100% 50% / 0.04) 1px, transparent 1px)",
                    backgroundSize: "16px 16px",
                  }} />
                  {/* Laser line with glow */}
                  <div className="absolute left-0 right-0 h-[2px] bg-neon-cyan shadow-[0_0_15px_hsl(186_100%_50%/0.9),0_0_40px_hsl(186_100%_50%/0.4),0_0_60px_hsl(186_100%_50%/0.2)] animate-laser-scan" />
                  {/* Corner brackets */}
                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-neon-cyan/40 rounded-tl-sm" />
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-neon-cyan/40 rounded-tr-sm" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-neon-cyan/40 rounded-bl-sm" />
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-neon-cyan/40 rounded-br-sm" />
                  {/* Document lines */}
                  <div className="absolute inset-6 flex flex-col gap-2.5 pt-4">
                    {[100, 65, 85, 55, 75, 45].map((w, i) => (
                      <motion.div
                        key={i}
                        className="h-1.5 rounded-full bg-foreground/[0.06]"
                        style={{ width: `${w}%` }}
                        initial={{ scaleX: 0, originX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.8 + i * 0.12, duration: 0.5 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </BentoCard>
          </div>

          {/* Job Finder */}
          <div className="lg:col-span-3">
            <BentoCard delay={0.3} className="h-full min-h-[200px]" onClick={() => navigate("/jobs")}>
              <div className="flex flex-col gap-3 h-full">
                <GlowIcon icon={Building2} color="amber" />
                <div className="mt-auto">
                  <h3 className="text-lg font-bold font-display text-foreground">{t("card.jobs", lang)}</h3>
                  <p className="text-muted-60 text-xs mt-1">{t("card.jobs.desc", lang)}</p>
                </div>
                {/* Animated progress bar */}
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 rounded-full bg-muted/20 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, hsl(40 100% 50%), hsl(40 100% 65%))" }}
                      initial={{ width: 0 }}
                      animate={{ width: "72%" }}
                      transition={{ delay: 1, duration: 1.2, ease: "easeOut" }}
                    />
                  </div>
                  <motion.span
                    className="text-[10px] text-neon-amber font-bold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                  >
                    24 new
                  </motion.span>
                </div>
              </div>
            </BentoCard>
          </div>

          {/* Voice AI */}
          <div className="lg:col-span-3">
            <BentoCard delay={0.35} className="h-full min-h-[200px]" onClick={() => navigate("/voice")}>
              <div className="flex flex-col gap-3 h-full">
                <GlowIcon icon={Mic} color="green" />
                <div className="mt-auto">
                  <h3 className="text-lg font-bold font-display text-foreground">{t("card.voice", lang)}</h3>
                  <p className="text-muted-60 text-xs mt-1">{t("card.voice.desc", lang)}</p>
                </div>
                {/* Voice wave visualization */}
                <div className="flex items-end gap-[3px] h-7 mt-1">
                  {Array.from({ length: 16 }, (_, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-full"
                      style={{
                        background: `linear-gradient(to top, hsl(110 100% 55% / 0.3), hsl(110 100% 55% / 0.7))`,
                      }}
                      animate={{
                        height: [3, Math.random() * 24 + 3, 3],
                      }}
                      transition={{
                        duration: 1 + Math.random() * 0.5,
                        delay: i * 0.06,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>
              </div>
            </BentoCard>
          </div>

          {/* Grievance Portal */}
          <div className="lg:col-span-3">
            <BentoCard delay={0.42} className="h-full min-h-[190px]" onClick={() => navigate("/grievance")}>
              <div className="flex flex-col gap-3 h-full">
                <GlowIcon icon={Fingerprint} color="pink" />
                <div className="mt-auto">
                  <h3 className="text-lg font-bold font-display text-foreground">{t("nav.grievance", lang)}</h3>
                  <p className="text-muted-60 text-xs mt-1">Secure complaint filing</p>
                </div>
                {/* Fingerprint scan animation */}
                <div className="flex items-center gap-2 mt-1">
                  <motion.div
                    className="w-6 h-6 rounded-full border-2 border-neon-pink/40 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1], borderColor: ["hsl(338 100% 50% / 0.4)", "hsl(338 100% 50% / 0.8)", "hsl(338 100% 50% / 0.4)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="w-2 h-2 rounded-full bg-neon-pink/60" />
                  </motion.div>
                  <span className="text-[10px] text-neon-pink font-semibold">Identity Verified</span>
                </div>
              </div>
            </BentoCard>
          </div>

          {/* Scheme Finder */}
          <div className="lg:col-span-3">
            <BentoCard hasAurora delay={0.45} className="h-full min-h-[190px]" onClick={() => navigate("/schemes")}>
              <div className="flex flex-col justify-between h-full">
                <div className="flex items-start justify-between">
                  <GlowIcon icon={CircleDot} color="purple" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                    <span className="text-[10px] text-secondary font-semibold uppercase tracking-wider">Live</span>
                  </div>
                </div>
                <div className="mt-auto">
                  <h3 className="text-lg font-bold font-display text-foreground">{t("card.schemes", lang)}</h3>
                  <p className="text-muted-60 text-xs mt-1">{t("card.schemes.desc", lang)}</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex -space-x-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-5 h-5 rounded-full border border-border/50 bg-muted/30 flex items-center justify-center text-[8px] text-muted-60"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.2 + i * 0.1 }}
                      >
                        {["PM", "CM", "SC"][i]}
                      </motion.div>
                    ))}
                    <motion.div
                      className="w-5 h-5 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center text-[8px] text-primary font-bold"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.5 }}
                    >
                      +5
                    </motion.div>
                  </div>
                  <motion.div
                    whileHover={{ scale: 1.2, rotate: 45 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-9 h-9 rounded-full border border-border/50 flex items-center justify-center cursor-pointer bg-muted/5 hover:bg-primary/10 hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_15px_hsl(186_100%_50%/0.2)]"
                  >
                    <ArrowRight size={15} className="text-muted-60" />
                  </motion.div>
                </div>
              </div>
            </BentoCard>
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar lang={lang} />

        {/* Footer */}
        <motion.p
          className="text-center text-muted-60 text-[10px] mt-8 tracking-[0.3em] uppercase font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          Powered by Advanced AI · Breaking Language Barriers · v4.2
        </motion.p>
      </div>
    </div>
  );
};

export default Dashboard;
