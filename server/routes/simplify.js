const router = require("express").Router();
const { upload, simplifyDocument, getHistory, deleteHistory, clearHistory } = require("../controllers/simplifyController");

router.post("/", upload.single("image"), simplifyDocument);
router.get("/history", getHistory);
router.delete("/history/:id", deleteHistory);
router.delete("/history", clearHistory);

module.exports = router;
