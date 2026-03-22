import { motion } from "framer-motion";

const HeroOrb = () => {
  return (
    <div className="relative inline-flex items-center justify-center mb-10">
      {/* Outermost morphing blob */}
      <div className="absolute w-40 h-40 bg-primary/[0.04] animate-morph blur-[40px]" />

      {/* Outer ring 1 — slow clockwise */}
      <motion.div
        className="absolute w-36 h-36 rounded-3xl border border-primary/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />

      {/* Outer ring 2 — dashed, counter-clockwise */}
      <motion.div
        className="absolute w-32 h-32 rounded-2xl border border-dashed border-secondary/15"
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />

      {/* Outer ring 3 — fast small */}
      <motion.div
        className="absolute w-28 h-28 rounded-2xl border border-neon-pink/10"
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />

      {/* Orbiting dots */}
      <div className="absolute w-36 h-36">
        <motion.div
          className="absolute"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%" }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-neon-cyan shadow-[0_0_12px_hsl(186_100%_50%/0.8)]" />
        </motion.div>
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 50%" }}
        >
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_10px_hsl(270_80%_60%/0.7)]" />
        </motion.div>
      </div>

      {/* Inner glow */}
      <div className="absolute w-24 h-24 rounded-2xl bg-primary/10 blur-xl" />

      {/* Core badge */}
      <motion.div
        className="relative inline-flex items-center justify-center w-22 h-22 rounded-2xl bg-primary/10 border border-primary/30 shadow-[0_0_50px_hsl(186_100%_50%/0.25),inset_0_0_30px_hsl(186_100%_50%/0.05)]"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
        style={{ width: 88, height: 88 }}
      >
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 88 88">
          <pattern id="hex" width="20" height="17.32" patternUnits="userSpaceOnUse" patternTransform="scale(0.6)">
            <polygon points="10,0 20,5.77 20,17.32 10,23.09 0,17.32 0,5.77" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#hex)" />
        </svg>
        <span className="text-3xl font-extrabold font-display text-primary neon-text-cyan relative z-10">LU</span>
      </motion.div>
    </div>
  );
};

export default HeroOrb;
