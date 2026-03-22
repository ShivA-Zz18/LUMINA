import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner.jsx";
import { Toaster } from "@/components/ui/toaster.jsx";
import { TooltipProvider } from "@/components/ui/tooltip.jsx";

// Pages
import Navbar from "./components/Navbar.jsx";
import Index from "./pages/Index.jsx";
import NotFound from "./pages/NotFound.jsx";
import DocumentScanner from "./pages/DocumentScanner.jsx";
import SchemeFinder from "./pages/SchemeFinder.jsx";
import GrievanceDraftsman from "./pages/GrievanceDraftsman.jsx";
import VoiceAssistant from "./pages/VoiceAssistant.jsx";
import JobFinder from "./pages/JobFinder.jsx";
import History from "./pages/History.jsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/scanner" element={<DocumentScanner />} />
          <Route path="/schemes" element={<SchemeFinder />} />
          <Route path="/grievance" element={<GrievanceDraftsman />} />
          <Route path="/voice" element={<VoiceAssistant />} />
          <Route path="/jobs" element={<JobFinder />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
