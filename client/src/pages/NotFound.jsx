import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="page-container flex flex-col items-center justify-center text-center" style={{ minHeight: "calc(100vh - 72px)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <div className="text-8xl mb-6 animate-float">🌌</div>
        <h1 className="text-5xl font-extrabold gradient-text mb-3">404</h1>
        <p className="text-lg text-[var(--text-secondary)] mb-8 max-w-md">
          This page got lost in the cosmos. Let&apos;s navigate you back to safety.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-secondary flex items-center gap-2">
            <ArrowLeft size={16} /> Go Back
          </button>
          <button onClick={() => navigate("/")} className="btn-primary flex items-center gap-2">
            <Home size={16} /> Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
