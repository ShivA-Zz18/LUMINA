import { useMemo } from "react";
import { motion } from "framer-motion";

const FloatingParticles = () => {
  const particles = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.8,
      duration: Math.random() * 10 + 8,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.25 + 0.05,
      color: i % 5 === 0 ? "bg-secondary" : i % 7 === 0 ? "bg-neon-pink" : "bg-neon-cyan",
    })),
  []);

  const lines = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      angle: Math.random() * 360,
      duration: Math.random() * 12 + 10,
      delay: Math.random() * 6,
    })),
  []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full ${p.color}`}
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -50, 0],
            x: [0, Math.random() * 30 - 15, 0],
            opacity: [p.opacity, p.opacity * 2.5, p.opacity],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
      {lines.map((l) => (
        <motion.div
          key={`line-${l.id}`}
          className="absolute bg-gradient-to-r from-transparent via-neon-cyan/20 to-transparent"
          style={{
            width: 60 + Math.random() * 60,
            height: 1,
            left: `${l.x}%`,
            top: `${l.y}%`,
            transform: `rotate(${l.angle}deg)`,
          }}
          animate={{
            opacity: [0, 0.3, 0],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: l.duration,
            delay: l.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export default FloatingParticles;
