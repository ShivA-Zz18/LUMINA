// test_job_engine.js
const { getJobs } = require('./controllers/jobController');

const mockReq = { 
  query: { keyword: 'BCA', language: 'Kannada' } 
};

const mockRes = {
  status: (code) => ({
    json: (data) => console.log(`Response Status: ${code}\nData:`, JSON.stringify(data, null, 2))
  })
};

(async () => {
    console.log('Testing final Job Engine pipeline...');
    await getJobs(mockReq, mockRes);
})();
