import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";

const springTransition = { type: "spring", stiffness: 260, damping: 20 };

const BentoCard = ({ children, className = "", colSpan = 1, rowSpan = 1, hasAurora = false, delay = 0, onClick }) => {
  const cardRef = useRef(null);
  const [spotlightPos, setSpotlightPos] = useState({ x: "50%", y: "50%" });

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setSpotlightPos({ x: `${x}%`, y: `${y}%` });
  }, []);

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      initial={{ opacity: 0, y: 40, scale: 0.94, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ ...springTransition, delay }}
      whileHover={{ scale: 1.025, y: -8 }}
      className={`
        relative overflow-hidden rounded-bento glass-ultra holo-border neon-border-hover gpu-accelerated cursor-pointer group
        ${colSpan === 2 ? "col-span-2" : "col-span-1"}
        ${rowSpan === 2 ? "row-span-2" : "row-span-1"}
        ${className}
      `}
    >
      {/* Interactive spotlight */}
      <div
        className="absolute inset-0 pointer-events-none z-[2] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(500px circle at ${spotlightPos.x} ${spotlightPos.y}, hsl(186 100% 50% / 0.07), transparent 60%)`,
        }}
      />

      {/* Top shimmer line */}
      <div className="absolute top-0 left-0 w-[40%] h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/60 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-scanline-h pointer-events-none z-[3]" />

      {/* Bottom accent line */}
      <div className="absolute bottom-0 right-0 w-[30%] h-[1px] bg-gradient-to-l from-transparent via-secondary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {hasAurora && (
        <div
          className="absolute inset-0 opacity-[0.12] animate-aurora-swirl pointer-events-none"
          style={{
            background: "linear-gradient(135deg, hsl(270 80% 60%), hsl(186 100% 50% / 0.3), hsl(228 60% 20%), hsl(330 100% 50% / 0.2))",
            backgroundSize: "400% 400%",
          }}
        />
      )}

      {/* Corner accents */}
      <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-neon-cyan/30 group-hover:bg-neon-cyan/70 transition-all duration-500 group-hover:shadow-[0_0_8px_hsl(186_100%_50%/0.5)]" />
      <div className="absolute bottom-3 left-3 w-1 h-1 rounded-full bg-secondary/30 group-hover:bg-secondary/70 transition-all duration-500 group-hover:shadow-[0_0_6px_hsl(270_80%_60%/0.5)]" />
      <div className="absolute top-3 left-3 w-0.5 h-4 rounded-full bg-neon-cyan/0 group-hover:bg-neon-cyan/20 transition-all duration-700" />
      <div className="absolute top-3 left-3 w-4 h-0.5 rounded-full bg-neon-cyan/0 group-hover:bg-neon-cyan/20 transition-all duration-700" />
      <div className="absolute bottom-3 right-3 w-0.5 h-4 rounded-full bg-secondary/0 group-hover:bg-secondary/20 transition-all duration-700" />
      <div className="absolute bottom-3 right-3 w-4 h-0.5 rounded-full bg-secondary/0 group-hover:bg-secondary/20 transition-all duration-700" />

      <div className="relative z-10 h-full p-6">{children}</div>
    </motion.div>
  );
};

export default BentoCard;
