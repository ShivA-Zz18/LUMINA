import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./components/Navbar";
import ErrorBoundary from "./components/ErrorBoundary";
import Dashboard from "./pages/Dashboard";
import DocumentScanner from "./pages/DocumentScanner";
import GrievanceDraftsman from "./pages/GrievanceDraftsman";
import SchemeFinder from "./pages/SchemeFinder";
import VoiceAssistant from "./pages/VoiceAssistant";
import JobFinder from "./pages/JobFinder";
import History from "./pages/History";
import NotFound from "./pages/NotFound";

const pageTransition = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.3, ease: "easeInOut" },
};

function AnimatedPage({ children }) {
  return <motion.div {...pageTransition}>{children}</motion.div>;
}

export default function App() {
  const location = useLocation();

  return (
    <ErrorBoundary>
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<AnimatedPage><Dashboard /></AnimatedPage>} />
          <Route path="/scanner" element={<AnimatedPage><DocumentScanner /></AnimatedPage>} />
          <Route path="/grievance" element={<AnimatedPage><GrievanceDraftsman /></AnimatedPage>} />
          <Route path="/schemes" element={<AnimatedPage><SchemeFinder /></AnimatedPage>} />
          <Route path="/voice" element={<AnimatedPage><VoiceAssistant /></AnimatedPage>} />
          <Route path="/jobs" element={<AnimatedPage><JobFinder /></AnimatedPage>} />
          <Route path="/history" element={<AnimatedPage><History /></AnimatedPage>} />
          <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
        </Routes>
      </AnimatePresence>
    </ErrorBoundary>
  );
}
