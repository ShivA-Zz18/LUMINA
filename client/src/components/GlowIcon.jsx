import { motion } from "framer-motion";

const colorMap = {
  cyan: {
    bg: "bg-neon-cyan/10",
    ring: "ring-neon-cyan/25",
    text: "text-neon-cyan",
    glow: "shadow-[0_0_25px_hsl(186_100%_50%/0.3)]",
    pulse: "bg-neon-cyan/5",
    inner: "bg-neon-cyan/5",
  },
  pink: {
    bg: "bg-neon-pink/10",
    ring: "ring-neon-pink/25",
    text: "text-neon-pink",
    glow: "shadow-[0_0_25px_hsl(338_100%_50%/0.3)]",
    pulse: "bg-neon-pink/5",
    inner: "bg-neon-pink/5",
  },
  green: {
    bg: "bg-neon-green/10",
    ring: "ring-neon-green/25",
    text: "text-neon-green",
    glow: "shadow-[0_0_25px_hsl(110_100%_55%/0.3)]",
    pulse: "bg-neon-green/5",
    inner: "bg-neon-green/5",
  },
  amber: {
    bg: "bg-neon-amber/10",
    ring: "ring-neon-amber/25",
    text: "text-neon-amber",
    glow: "shadow-[0_0_25px_hsl(40_100%_50%/0.3)]",
    pulse: "bg-neon-amber/5",
    inner: "bg-neon-amber/5",
  },
  purple: {
    bg: "bg-secondary/10",
    ring: "ring-secondary/25",
    text: "text-secondary",
    glow: "shadow-[0_0_25px_hsl(270_80%_60%/0.3)]",
    pulse: "bg-secondary/5",
    inner: "bg-secondary/5",
  },
};

const GlowIcon = ({ icon: Icon, color = "cyan", size = 24 }) => {
  const c = colorMap[color];
  return (
    <motion.div
      className="relative inline-flex"
      whileHover={{ scale: 1.2, rotate: 8 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 12 }}
    >
      {/* Outer pulse ring */}
      <div className={`absolute -inset-3 rounded-full ${c.pulse} animate-pulse-ring`} />
      {/* Mid glow */}
      <div className={`absolute -inset-1 rounded-full ${c.inner} blur-md opacity-60`} />
      {/* Glow layer */}
      <div className={`absolute inset-0 rounded-full ${c.bg} blur-xl opacity-70`} />
      {/* Main icon container */}
      <div className={`relative flex items-center justify-center rounded-full ${c.bg} ring-2 ${c.ring} ${c.glow} p-3.5 backdrop-blur-sm`}>
        <Icon className={`relative z-10 ${c.text} drop-shadow-sm`} size={size} strokeWidth={1.8} />
      </div>
    </motion.div>
  );
};

export default GlowIcon;
