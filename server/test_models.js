const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('.env'));
const apiKey = envConfig.GEMINI_API_KEY;

async function run() {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    console.log("Status:", res.status);
    if (data.models) {
      console.log("MODELS:", data.models.map(m => m.name).filter(n => n.includes('gemini') || n.includes('gemini-1.5')));
    } else {
      console.log("No models:", data);
    }
  } catch(e) {
    console.log("Fetch error:", e);
  }
}
run();
