const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Groq } = require("groq-sdk");
const Scheme = require("../models/Scheme");

// Helper to reliably parse JSON
function extractJSON(text) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(text.substring(start, end + 1));
  } catch {
    return null;
  }
}

const SCHEME_PROMPT = `### SYSTEM ROLE
You are an expert Indian Government Policy Advisor and Social Welfare Officer. Your goal is to match users with eligible government schemes (Central & State) with 100% accuracy.

### ELIGIBILITY ENGINE RULES:
1. PROFILE ANALYSIS: Analyze the User Profile. Determine if they are Below Poverty Line (BPL) based on API Setu verification.
2. DATABASE RAG: Actively evaluate the provided MongoDB results. If they match the user's profile, you MUST include them.
3. SCHEME MATCHING: Search for schemes in categories: Education, Social Security, Financial Aid, Health, Agriculture, Housing, Welfare. You MUST suggest at least 3 to 5 highly relevant schemes by utilizing your extensive internal knowledge of Indian government schemes, even if the database matches are too few or empty.
4. SMART FILTERING: 
   - If Income < 1.5 Lakh, prioritize BPL/EBC schemes.
   - If Occupation is 'Student' or 'student', prioritize NSP (National Scholarship Portal) and State Post-Matric schemes.
   - If Location is Karnataka (default for this app), include 'SSP' (State Scholarship Portal) and 'Arivu' loan schemes.
   - If User is BPL Verified via API Setu: Highlight BPL schemes (like Anna Bhagya) and explicitly mark them in your reasoning.
5. OUTPUT FORMAT (JSON ONLY): Return ONLY a valid JSON object. Do not include any conversational text like "Here are the schemes".
{
  "matches_found": number,
  "is_bpl_verified": boolean,
  "schemes": [
    {
      "name": "Scheme Name",
      "category": "education | health | finance | agriculture | welfare",
      "authority": "State/Central Ministry",
      "benefit": "What the user gets (e.g., ₹25,000 per year)",
      "link": "Official URL (e.g., scholarships.gov.in)",
      "match_reason": "Why this user qualifies based on their income/occupation",
      "match_percent": number
    }
  ],
  "disclaimer": "Verify on official portals."
}`;

// ── Match schemes using AI Policy Advisor ────────────────────
const matchSchemes = async (req, res) => {
  try {
    const { age, income, occupation, documentNumber } = req.body;

    if (!age || !income || !occupation) {
      return res.status(400).json({ error: "Please provide age, income, and occupation" });
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: API SETU INTEGRATION (Mock)
    // ─────────────────────────────────────────────────────────────
    // If a document number > 5 chars is provided, mock "Verified BPL" status
    const isVerifiedBpl = documentNumber && documentNumber.trim().length >= 5;
    console.log(`[API Setu Mock] Document: ${documentNumber || "None"} -> Verified BPL: ${isVerifiedBpl}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 1: DATABASE RAG (Retrieve)
    // ─────────────────────────────────────────────────────────────
    // Query MongoDB for schemes matching the basic criteria (occupation)
    let dbSchemes = await Scheme.find({ isActive: true }).lean();
    
    // Filter by occupation
    dbSchemes = dbSchemes.filter((s) => {
      const occ = s.eligibility?.occupations || [];
      return occ.length === 0 || occ.includes("all") || occ.includes(occupation.toLowerCase());
    });

    // Score and sort to take top 10
    dbSchemes.forEach(s => {
      s.tempScore = 0;
      if (Number(income) <= (s.eligibility?.incomeMax || Infinity)) s.tempScore += 10;
      if (Number(age) >= (s.eligibility?.ageMin || 0) && Number(age) <= (s.eligibility?.ageMax || 120)) s.tempScore += 10;
    });
    
    dbSchemes.sort((a, b) => b.tempScore - a.tempScore);
    const topDatabaseMatches = dbSchemes.slice(0, 8); // Top 8 matches

    // ─────────────────────────────────────────────────────────
    // PRO FEATURE: FRESHNESS RAG (Live Internet Mock)
    // ─────────────────────────────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let requiresFreshnessFetch = false;
    for (const s of topDatabaseMatches) {
      if (!s.lastUpdated || new Date(s.lastUpdated) < thirtyDaysAgo) {
        requiresFreshnessFetch = true;
        break;
      }
    }

    if (requiresFreshnessFetch || topDatabaseMatches.length < 3) {
      console.log("🔄 [Freshness RAG] DB schemes are stale (>30 days) or sparse. Simulating Live Web Fetch...");
      const liveTrendingSchemes = [
        {
          name: "PM Vidyalaxmi Scheme (2026 Live Update)",
          category: "Education",
          description: "[LIVE FETCH] Recently announced financial support for higher education students globally.",
          benefits: "Collateral-free, guarantor-free loans up to ₹7.5 Lakhs.",
        },
        {
          name: "State Digital Empowerment Grant (Trending)",
          category: "Technology",
          description: "[LIVE FETCH] Active grant for rural youth bridging the digital divide.",
          benefits: "Direct subsidy of ₹15,000 for verified students.",
        }
      ];
      topDatabaseMatches.push(...liveTrendingSchemes);
    }

    const databaseMatchesJson = JSON.stringify(topDatabaseMatches.map(s => ({
      name: s.name,
      category: s.category,
      description: s.description,
      benefits: s.benefits
    })));

    // ─────────────────────────────────────────────────────────────
    // ASSEMBLE PROMPT
    // ─────────────────────────────────────────────────────────────
    const userMessage = `### USER DATA:\nAge: ${age}\nIncome: ₹${income}\nOccupation: ${occupation}\nLocation: Karnataka/India\nAPI Setu BPL Verified: ${isVerifiedBpl}\n\n### ${"$"}{databaseMatches}:\n${databaseMatchesJson}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    let rawReply = null;

    // TRY 1: GEMINI
    if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([{ text: SCHEME_PROMPT }, { text: userMessage }]);
        rawReply = result.response.text();
        console.log("✅ SchemeFinder: Using Gemini 2.0 Flash");
      } catch (err) {
        console.warn("⚠️ SchemeFinder Gemini failed, trying Groq...", err.message);
      }
    }

    // TRY 2: GROQ FALLBACK
    if (!rawReply && groqKey && groqKey !== "your_groq_key_here") {
      try {
        const groq = new Groq({ apiKey: groqKey });
        const groqReply = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SCHEME_PROMPT },
            { role: "user", content: userMessage }
          ],
          max_tokens: 3000,
          temperature: 0.3
        });
        rawReply = groqReply.choices[0].message.content;
        console.log("✅ SchemeFinder: Using Groq API Fallback");
      } catch (err) {
        console.warn("⚠️ SchemeFinder Groq failed:", err.message);
      }
    }

    if (!rawReply) {
      return res.status(500).json({ error: "AI matching failed. Please verify API keys." });
    }

    const parsed = extractJSON(rawReply);
    if (!parsed || !parsed.schemes) {
      return res.status(500).json({ error: "AI returned invalid format." });
    }

    // Map AI output to match the Frontend UI expectations
    const formattedResults = parsed.schemes.map((s) => {
      const isActuallyVerified = isVerifiedBpl && (s.name.toLowerCase().includes('bhagya') || s.name.toLowerCase().includes('bpl') || s.name.toLowerCase().includes('anna') || s.name.toLowerCase().includes('ration'));
      
      return {
        name: s.name,
        category: s.category || "welfare",
        description: s.match_reason,
        verifiedSource: s.authority,
        verifiedBPL: isActuallyVerified, // For Green Tick in UI
        matchPercent: s.match_percent || 90,
        benefits: s.benefit,
        applicationUrl: s.link?.startsWith('http') ? s.link : (s.link ? 'https://' + s.link : null),
        nextSteps: ["Visit the official portal to apply", "Prepare necessary background documents", "Submit within the application deadline"]
      };
    });

    res.json({
      success: true,
      total: formattedResults.length,
      profile: { age, income, occupation },
      apiSetuVerified: isVerifiedBpl,
      data: formattedResults,
      disclaimer: parsed.disclaimer
    });
  } catch (error) {
    console.error("Scheme match error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ── Get all schemes ────────────────────────────────────────
const getAllSchemes = async (_req, res) => {
  try {
    const schemes = await Scheme.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: schemes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { matchSchemes, getAllSchemes };
