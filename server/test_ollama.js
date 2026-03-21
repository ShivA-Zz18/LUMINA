const { scanDocument, getOllamaHealth } = require('./controllers/ollamaController');
const fs = require('fs');

const req = {
  body: {
    ocrText: "Govt of India AADHAAR 1234 5678 9012 Raju Sharma DOB: 12/05/1990 Address: 14 Gandhi Nagar, Kamataka - 560001"
  }
};

const res = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    fs.appendFileSync('test_output.txt', `STATUS: ${this.statusCode}\n`);
    fs.appendFileSync('test_output.txt', `JSON RESPONSE: ${JSON.stringify(data, null, 2)}\n`);
    return this;
  }
};

async function test() {
  fs.writeFileSync('test_output.txt', "--- TESTING HEALTH ---\n");
  const health = await getOllamaHealth();
  fs.appendFileSync('test_output.txt', JSON.stringify(health) + "\n");
  
  fs.appendFileSync('test_output.txt', "\n--- TESTING SCAN DOCUMENT ---\n");
  await scanDocument(req, res);
}

test();
