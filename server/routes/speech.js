const router = require("express").Router();
const multer = require("multer");
const { transcribe } = require("../controllers/speechController");

// Use a temporary folder or memory storage for STT
const upload = multer({ dest: "uploads/audio/" });

router.post("/", upload.single("audio"), transcribe);

module.exports = router;
