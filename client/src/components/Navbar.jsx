import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, ScanLine, ScrollText, MessageSquareWarning,
  Mic, Briefcase, Clock, ScanSearch, Menu, X
} from "lucide-react";
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

export default function Navbar() {
  const [lang, setLang] = useState(localStorage.getItem("lingo_lang") || "en");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Find active nav item based on current path
  const activeNavItem = navItems.find((item) => 
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
  ) || navItems[0];

  const handleLangChange = (l) => {
    setLang(l);
    localStorage.setItem("lingo_lang", l);
    // Dispatch custom event so Dashboard and other pages can sync their language
    window.dispatchEvent(new CustomEvent("lingo_lang_change", { detail: l }));
  };

  const handleNavClick = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.05 }}
      className="sticky top-0 z-50 glass-ultra border-b border-border/30 w-full"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={() => handleNavClick("/")}
        >
          <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-10 h-10 rounded-xl overflow-hidden shadow-[0_0_20px_hsl(186_100%_50%/0.4)] relative border border-cyan-400/30"
            >
               <img src="/lumina_logo.png" alt="Lumina Logo" className="w-full h-full object-cover" />
            </motion.div>
            <div className="hidden sm:flex flex-col ml-1">
              <span className="font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-[22px] tracking-[0.08em] drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] leading-none mb-1">
                LUMINA
              </span>
              <span className="text-[8.5px] text-purple-300/90 uppercase tracking-[0.35em] font-bold leading-none drop-shadow-md">
                Beyond Accessibility
              </span>
            </div>
        </div>

        {/* Desktop Nav Items */}
        <div className="hidden md:flex items-center gap-0.5 ml-4">
          {navItems.map((item) => (
            <motion.button
              key={item.key}
              onClick={() => handleNavClick(item.path)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-300 ${
                activeNavItem.key === item.key
                  ? "text-neon-cyan"
                  : "text-muted-60 hover:text-foreground"
              }`}
            >
              {activeNavItem.key === item.key && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-full bg-neon-cyan/[0.08] border border-neon-cyan/20 shadow-[0_0_15px_hsl(186_100%_50%/0.1)]"
                  transition={spring}
                />
              )}
              <span className="relative text-xs">{item.emoji}</span>
              <span className="relative whitespace-nowrap">{t(item.key, lang)}</span>
            </motion.button>
          ))}
        </div>

        {/* Right side: Language + Mobile Toggle */}
        <div className="flex items-center gap-3">
          {/* Language Selector */}
          <div className="hidden sm:flex items-center gap-0.5 glass-ultra rounded-full px-1.5 py-1">
            {["en", "hi", "kn"].map((l) => (
              <motion.button
                key={l}
                onClick={() => handleLangChange(l)}
                whileTap={{ scale: 0.85 }}
                whileHover={{ scale: 1.05 }}
                className={`relative px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-300 ${
                  lang === l
                    ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(186_100%_50%/0.5)]"
                    : "text-muted-60 hover:text-foreground"
                }`}
              >
                {lang === l && (
                  <motion.div
                    layoutId="lang-active"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={spring}
                  />
                )}
                <span className="relative z-10">{languageNames[l]}</span>
              </motion.button>
            ))}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden flex items-center justify-center p-2 rounded-lg text-muted-60 hover:text-foreground bg-white/5 border border-white/10"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-white/5 bg-background/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.path)}
                  className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    activeNavItem.key === item.key
                      ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20"
                      : "text-muted-60 hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <span className="text-lg">{item.emoji}</span>
                  {t(item.key, lang)}
                </button>
              ))}

              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-2">
                {["en", "hi", "kn"].map((l) => (
                  <button
                    key={l}
                    onClick={() => handleLangChange(l)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold ${
                      lang === l
                        ? "bg-primary text-primary-foreground shadow-[0_0_10px_hsl(186_100%_50%/0.3)]"
                        : "bg-white/5 text-muted-60 border border-white/10"
                    }`}
                  >
                    {languageNames[l]}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
