// test_karnataka_jobs.js
const { getJobs } = require('./controllers/jobController');

const mockReq = { 
  query: { keyword: 'Software Developer', language: 'Telugu', location: 'Udupi' } 
};

const mockRes = {
  status: (code) => ({
    json: (data) => console.log(`Response Status: ${code}\nData:`, JSON.stringify(data, null, 2))
  })
};

(async () => {
    console.log('Testing Universal Job Engine pipeline (Karnataka Local Feature)...');
    await getJobs(mockReq, mockRes);
})();
