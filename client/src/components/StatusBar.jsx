import { motion } from "framer-motion";
import { Activity, Shield, Zap } from "lucide-react";

const StatusBar = ({ lang }) => {
  const stats = [
    { icon: Activity, label: "System", value: "ONLINE", color: "text-neon-green", dotColor: "bg-neon-green" },
    { icon: Shield, label: "Security", value: "ENCRYPTED", color: "text-neon-cyan", dotColor: "bg-neon-cyan" },
    { icon: Zap, label: "AI Engine", value: "ACTIVE", color: "text-neon-amber", dotColor: "bg-neon-amber" },
  ];

  return (
    <motion.div
      className="mt-16 max-w-2xl mx-auto glass-ultra rounded-full px-6 py-3 flex items-center justify-between gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.4, duration: 0.6 }}
    >
      {stats.map((stat, i) => (
        <div key={i} className="flex items-center gap-2">
          <stat.icon size={13} className={`${stat.color} opacity-70`} />
          <span className="text-muted-60 text-[10px] uppercase tracking-widest font-medium hidden sm:inline">{stat.label}</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1 h-1 rounded-full ${stat.dotColor} animate-pulse`} />
            <span className={`text-[10px] font-bold ${stat.color} tracking-wider`}>{stat.value}</span>
          </div>
          {i < stats.length - 1 && (
            <div className="w-[1px] h-3 bg-border/50 ml-3 hidden sm:block" />
          )}
        </div>
      ))}
    </motion.div>
  );
};

export default StatusBar;
