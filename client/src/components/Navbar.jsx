import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/scanner", label: "Scanner", icon: "📄" },
  { to: "/schemes", label: "Schemes", icon: "🎯" },
  { to: "/grievance", label: "Grievance", icon: "🖊️" },
  { to: "/voice", label: "Voice", icon: "🎤" },
  { to: "/jobs", label: "Jobs", icon: "💼" },
  { to: "/history", label: "History", icon: "📜" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 glass-strong" style={{ borderRadius: 0, borderTop: "none", borderLeft: "none", borderRight: "none" }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3 md:px-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 no-underline group">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-violet-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:shadow-purple-500/40 transition-shadow">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-400 opacity-0 group-hover:opacity-20 blur-md transition-opacity" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-[var(--text-primary)] leading-none" style={{ fontFamily: "var(--font-heading)" }}>
              Lingo<span className="gradient-text">-Bridge</span>
            </span>
            <span className="text-[0.6rem] text-[var(--text-tertiary)] font-medium tracking-wider uppercase">
              Aetherion &apos;26
            </span>
          </div>
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-0.5">
          {NAV_LINKS.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-2 rounded-lg text-sm font-medium no-underline transition-all duration-300
                  ${active ? "text-white" : "text-[var(--text-secondary)] hover:text-white"}`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-purple-500/15 border border-purple-500/20"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-1.5">
                  <span className="text-xs">{link.icon}</span>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Mobile Hamburger */}
        <button
          id="mobile-menu-toggle"
          className="md:hidden text-[var(--text-primary)] cursor-pointer bg-transparent border-none p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden overflow-hidden border-t border-white/5"
          >
            <div className="px-4 py-3 flex flex-col gap-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-colors
                    ${location.pathname === link.to
                      ? "bg-purple-500/15 text-white"
                      : "text-[var(--text-secondary)] hover:text-white hover:bg-white/3"}`}
                >
                  <span>{link.icon}</span> {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
