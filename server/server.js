/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║         LINGO-BRIDGE SERVER — AETHERION'26              ║
 * ║    Unified AI Platform for Rural Accessibility          ║
 * ╚═══════════════════════════════════════════════════════════╝
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const cron = require("node-cron");
const connectDB = require("./config/db");
const Alert = require("./models/Alert");

const app = express();

// ─────────────────────────────────────────────────────────
// MIDDLEWARE SETUP
// ─────────────────────────────────────────────────────────

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "50mb" })); // Increased for base64 images
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─────────────────────────────────────────────────────────
// UNIFIED AI ROUTES (NEW)
// ─────────────────────────────────────────────────────────

const { aiProcess, draftGrievance } = require("./controllers/aiController");
const { scanDocument, getOllamaHealth } = require("./controllers/ollamaController");

// Unified AI Processing: Handles document vision & chat
app.post("/api/ai/process", aiProcess);

// Unified Grievance Drafting: Formal letter generation
app.post("/api/ai/grievance", draftGrievance);

// ─────────────────────────────────────────────────────────
// OLLAMA — Local Indian Document Scanner
// ─────────────────────────────────────────────────────────
// POST /api/ai/scan-document
// Body: { ocrText: string }  — raw OCR text from the client
// Returns: { doc_type, extracted_data, confidence_score, validation_notes, provider }
app.post("/api/ai/scan-document", scanDocument);

// ─────────────────────────────────────────────────────────
// DOCUMENT PROCESSING ROUTES
// ─────────────────────────────────────────────────────────

app.use("/api/simplify", require("./routes/simplify")); // Document upload & processing
app.use("/api/schemes", require("./routes/schemes"));
app.use("/api/grievance", require("./routes/grievance")); // OLD endpoint
app.use("/api/jobs", require("./routes/jobs"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/speech", require("./routes/speech"));

// ─────────────────────────────────────────────────────────
// HEALTH CHECK & DIAGNOSTICS
// ─────────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  // Live check: is Ollama running and is llama3.2 pulled?
  const ollamaHealth = await getOllamaHealth();

  res.json({
    status: "ok",
    name: "Lingo-Bridge API",
    version: "2.1.0",
    timestamp: new Date().toISOString(),
    gemini: process.env.GEMINI_API_KEY ? "✓ Configured" : "✗ Missing",
    ollama: ollamaHealth.status,           // "ready" | "model_missing" | "offline"
    ollama_details: ollamaHealth.details,  // human-readable setup hint
    features: [
      "ai/process (unified)",
      "ai/grievance",
      "ai/scan-document (ollama/llama3.2)",
      "jobs (BCA hybrid engine)",
      "legacy routes (backward compat)",
    ],
  });
});

// ─────────────────────────────────────────────────────────
// ERROR HANDLING MIDDLEWARE
// ─────────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error("Global Error Handler:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
    availableRoutes: [
      "POST /api/ai/process",
      "POST /api/ai/grievance",
      "POST /api/ai/scan-document",
      "GET /api/health",
    ],
  });
});

// ─────────────────────────────────────────────────────────
// PROACTIVE EXPIRY ALERTS (BACKGROUND CRON)
// ─────────────────────────────────────────────────────────

// Run every day at 8:00 AM
cron.schedule("0 8 * * *", async () => {
  try {
    console.log("⏰ Running daily document expiry check...");
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const approachingExpiries = await Alert.find({
      isActive: true,
      notificationSent: false,
      expiryDate: { $lte: thirtyDaysFromNow }
    });

    for (const alert of approachingExpiries) {
      alert.message = `Shiva, your ${alert.documentType} is expiring next month. Want me to draft a renewal request?`;
      alert.notificationSent = true;
      await alert.save();

      // SIMULATE PUSH NOTIFICATION / EMAIL
      console.log(`\n🔔 [PROACTIVE NOTIFICATION TRIGGERED]`);
      console.log(`📧 To: Shiva | Subject: Action Required: ${alert.documentName} Expiry`);
      console.log(`💬 Message: ${alert.message}\n`);
    }

    if (approachingExpiries.length === 0) {
      console.log("✅ All documents up to date. No alerts sent.");
    }
  } catch (error) {
    console.error("Cron Job Error:", error);
  }
});

// ─────────────────────────────────────────────────────────
// SERVER STARTUP
// ─────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log("\n╔════════════════════════════════════════════════════════════╗");
      console.log("║  🚀 LINGO-BRIDGE SERVER STARTED                          ║");
      console.log(`║  📡 Running on http://localhost:${PORT}`);
      console.log("║  🌍 Unified AI Processing: /api/ai/process                ║");
      console.log("║  ⚖️  Grievance Drafting: /api/ai/grievance               ║");
      console.log("║  🪄 Ollama Scanner: /api/ai/scan-document                 ║");
      console.log("║  💼 Job Engine: /api/jobs                                 ║");
      console.log("║  💚 Status: http://localhost:" + PORT + "/api/health            ║");
      console.log("╚════════════════════════════════════════════════════════════╝\n");
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
