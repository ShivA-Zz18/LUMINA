import { motion } from "framer-motion";
import { Shield, Briefcase, Mic, ArrowRight, ScanLine, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SPRING_TRANSITION = { type: "spring", stiffness: 100, damping: 12 };

// Card Component with 1px Gradient Border & True Glassmorphism
const BentoCard = ({ children, className, layoutId, onClick, delay = 0 }) => (
  <motion.div
    layoutId={layoutId}
    onClick={onClick}
    initial={{ opacity: 0, scale: 0.95, y: 30 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ ...SPRING_TRANSITION, delay }}
    whileHover={{ y: -8, scale: 1.02 }}
    className={`relative rounded-2xl p-[1px] cursor-pointer overflow-hidden group shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] hover:shadow-[0_20px_50px_-15px_rgba(0,212,255,0.25)] transition-all duration-500 ${className}`}
    style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 100%)",
    }}
  >
    {/* Inner Glass Layer */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#060b17]/95 to-[#040711]/95 backdrop-blur-3xl rounded-2xl" />
    <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
    
    <div className="relative h-full w-full rounded-[15px] p-6 md:p-8 flex flex-col justify-between z-10 transition-colors duration-500">
      {children}
    </div>
  </motion.div>
);

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen bg-[#02040a] overflow-hidden text-white pt-10 pb-20 px-4 md:px-8 flex flex-col items-center">
      
      {/* ── Immersive Ambient Galaxy Background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
        <div className="absolute top-[-10%] left-[-20%] w-[80vw] h-[80vw] rounded-full bg-[#00d4ff] opacity-10 blur-[150px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-[#39ff14] opacity-[0.08] blur-[150px] mix-blend-screen" />
        <div className="absolute top-[30%] left-[30%] w-[40vw] h-[40vw] rounded-full bg-purple-600 opacity-[0.05] blur-[120px] mix-blend-screen" />
      </div>

      {/* ── Hero ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_TRANSITION}
        className="relative z-10 flex flex-col items-center text-center max-w-4xl mb-14 mt-6"
      >
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-[#00d4ff] to-[#39ff14] rounded-[24px] blur-xl opacity-30 animate-pulse" />
          <div className="w-24 h-24 rounded-[24px] bg-[#060b17] border border-white/10 flex items-center justify-center relative z-10 shadow-[inset_0_0_30px_rgba(255,255,255,0.05)]">
            <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#00d4ff] to-[#39ff14] drop-shadow-[0_0_10px_rgba(0,212,255,0.4)]">
              LB
            </span>
          </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-5 tracking-tighter leading-[1.1]">
          Aether <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#00d4ff] via-[#00a3ff] to-[#39ff14]">Glass</span>
        </h1>
        <p className="text-white/60 text-lg md:text-2xl max-w-2xl font-medium leading-relaxed">
          AI-powered accessibility for every citizen. The most advanced digital bridge.
        </p>
      </motion.div>

      {/* ── 4-Column Bento Grid ─────────────────────────── */}
      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-[250px]">
        
        {/* Scanner: Feature Hero (Span 2) */}
        <BentoCard 
          layoutId="scanner-card" 
          className="md:col-span-2 md:row-span-2"
          onClick={() => navigate('/scanner')}
          delay={0.1}
        >
          {/* Subtle background glow specific to Scanner */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00d4ff] opacity-5 blur-[100px] rounded-full pointer-events-none" />

          <div className="flex flex-col h-full z-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00d4ff]/10 to-transparent border border-[#00d4ff]/20 flex items-center justify-center text-[#00d4ff] mb-6 shadow-[inset_0_0_20px_rgba(0,212,255,0.1)] group-hover:scale-110 transition-transform duration-500">
              <ScanLine size={36} strokeWidth={1.5} />
            </div>
            
            <div className="mt-auto">
              <h2 className="text-4xl font-extrabold mb-3 tracking-tight group-hover:text-[#00d4ff]/90 transition-colors">Multimodal Scanner</h2>
              <p className="text-white/60 text-[17px] leading-relaxed max-w-[95%] mb-8 font-medium">
                Upload images, PDFs or capture physical documents via camera. Our deep learning AI automatically simplifies dense jargon.
              </p>
              
              <div className="inline-flex items-center gap-2 bg-[#00d4ff]/10 text-[#00d4ff] px-5 py-2.5 rounded-xl font-bold uppercase tracking-wide text-sm border border-[#00d4ff]/20 group-hover:bg-[#00d4ff]/20 transition-colors">
                Initiate Scan <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </BentoCard>

        {/* Job Finder (Span 1) */}
        <BentoCard 
          layoutId="jobs-card" 
          className="md:col-span-1 md:row-span-1"
          onClick={() => navigate('/jobs')}
          delay={0.2}
        >
          <div className="flex flex-col h-full">
            <div className="w-14 h-14 rounded-2xl bg-[#ffaa00]/10 border border-[#ffaa00]/20 flex items-center justify-center text-[#ffaa00] mb-auto group-hover:scale-110 transition-transform duration-500">
              <Briefcase size={26} strokeWidth={1.5} />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold mb-1.5">Job Finder</h3>
              <p className="text-white/50 text-[15px] font-medium leading-relaxed">AI-matched employment roles</p>
            </div>
          </div>
        </BentoCard>

        {/* Voice Assistant (Span 1) */}
        <BentoCard 
          layoutId="voice-card" 
          className="md:col-span-1 md:row-span-1"
          onClick={() => navigate('/voice')}
          delay={0.3}
        >
          <div className="flex flex-col h-full">
            <div className="w-14 h-14 rounded-2xl bg-[#39ff14]/10 border border-[#39ff14]/20 flex items-center justify-center text-[#39ff14] shadow-[0_0_15px_rgba(57,255,20,0.1)] mb-auto group-hover:scale-110 transition-transform duration-500">
              <Mic size={26} strokeWidth={1.5} />
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-bold mb-1.5">Voice AI</h3>
              <p className="text-white/50 text-[15px] font-medium leading-relaxed">Speak in native dialects</p>
            </div>
          </div>
        </BentoCard>

        {/* Scheme Finder (Span 2 var) */}
        <BentoCard 
          layoutId="schemes-card" 
          className="md:col-span-2 md:row-span-1"
          onClick={() => navigate('/schemes')}
          delay={0.4}
        >
          <div className="flex items-center justify-between h-full bg-gradient-to-r from-purple-500/0 to-purple-500/5 hover:to-purple-500/10 transition-colors absolute inset-0 p-6 md:p-8">
            <div className="flex flex-col h-full justify-between z-10 w-full">
              <div className="w-14 h-14 rounded-2xl bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center text-[#a855f7] mb-auto group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                <Shield size={26} strokeWidth={1.5} />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-3xl font-extrabold mb-1.5">Scheme Finder</h3>
                  <p className="text-white/50 text-[15px] font-medium">Find eligible govt benefits</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center group-hover:bg-[#a855f7]/20 group-hover:border-[#a855f7]/40 transition-all duration-300">
                  <ArrowRight size={20} className="text-white group-hover:text-[#a855f7]" />
                </div>
              </div>
            </div>
          </div>
        </BentoCard>

      </div>
    </div>
  );
}
