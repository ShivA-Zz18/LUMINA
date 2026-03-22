const translations = {
  "app.title": { en: "LUMINA", hi: "लुमिना", kn: "ಲುಮಿನಾ" },
  "app.subtitle": { en: "AI-powered accessibility for every citizen. The most advanced digital bridge.", hi: "हर नागरिक के लिए AI-संचालित पहुंच। सबसे उन्नत डिजिटल ब्रिज।", kn: "ಪ್ರತಿ ನಾಗರಿಕರಿಗೆ AI-ಚಾಲಿತ ಪ್ರವೇಶ. ಅತ್ಯಂತ ಮುಂದುವರಿದ ಡಿಜಿಟಲ್ ಸೇತುವೆ." },
  "nav.home": { en: "Home", hi: "होम", kn: "ಮುಖಪುಟ" },
  "nav.scanner": { en: "Scanner", hi: "स्कैनर", kn: "ಸ್ಕ್ಯಾನರ್" },
  "nav.schemes": { en: "Schemes", hi: "योजनाएं", kn: "ಯೋಜನೆಗಳು" },
  "nav.grievance": { en: "Grievance", hi: "शिकायत", kn: "ದೂರು" },
  "nav.voice": { en: "Voice", hi: "आवाज़", kn: "ಧ್ವನಿ" },
  "nav.jobs": { en: "Jobs", hi: "नौकरियां", kn: "ಉದ್ಯೋಗಗಳು" },
  "nav.history": { en: "History", hi: "इतिहास", kn: "ಇತಿಹಾಸ" },
  "card.scanner": { en: "Multimodal Scanner", hi: "मल्टीमोडल स्कैनर", kn: "ಮಲ್ಟಿಮೋಡಲ್ ಸ್ಕ್ಯಾನರ್" },
  "card.scanner.desc": { en: "Upload images, PDFs or capture physical documents via camera. Our deep learning AI automatically simplifies dense jargon.", hi: "छवियां, PDF अपलोड करें या कैमरे से दस्तावेज़ कैप्चर करें। हमारा AI जटिल भाषा को सरल करता है।", kn: "ಚಿತ್ರಗಳನ್ನು, PDF ಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ ಅಥವಾ ಕ್ಯಾಮರಾ ಮೂಲಕ ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳನ್ನು ಸೆರೆಹಿಡಿಯಿರಿ." },
  "card.scanner.cta": { en: "INITIATE SCAN", hi: "स्कैन शुरू करें", kn: "ಸ್ಕ್ಯಾನ್ ಪ್ರಾರಂಭಿಸಿ" },
  "card.jobs": { en: "Job Finder", hi: "नौकरी खोजक", kn: "ಉದ್ಯೋಗ ಹುಡುಕುವವರು" },
  "card.jobs.desc": { en: "AI-matched employment roles", hi: "AI-मिलान रोजगार भूमिकाएं", kn: "AI-ಹೊಂದಾಣಿಕೆಯ ಉದ್ಯೋಗ ಪಾತ್ರಗಳು" },
  "card.voice": { en: "Voice AI", hi: "वॉइस AI", kn: "ವಾಯ್ಸ್ AI" },
  "card.voice.desc": { en: "Speak in native dialects", hi: "मूल बोलियों में बोलें", kn: "ಸ್ಥಳೀಯ ಉಪಭಾಷೆಗಳಲ್ಲಿ ಮಾತನಾಡಿ" },
  "card.schemes": { en: "Scheme Finder", hi: "योजना खोजक", kn: "ಯೋಜನೆ ಹುಡುಕುವವರು" },
  "card.schemes.desc": { en: "Find eligible govt benefits", hi: "पात्र सरकारी लाभ खोजें", kn: "ಅರ್ಹ ಸರ್ಕಾರಿ ಪ್ರಯೋಜನಗಳನ್ನು ಹುಡುಕಿ" },
};

export function t(key, lang) {
  return translations[key]?.[lang] ?? key;
}

export const languageNames = {
  en: "EN",
  hi: "हिं",
  kn: "ಕ",
};
