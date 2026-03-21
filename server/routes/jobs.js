const express = require('express');
const router = express.Router();
const { getJobs } = require('../controllers/jobController');

// GET /api/jobs?keyword=BCA&language=Kannada
router.get('/', getJobs);

module.exports = router;
