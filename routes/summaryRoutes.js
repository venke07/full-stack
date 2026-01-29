// routes/summaryRoutes.js
const express = require("express");
const requireAuth = require("../middleware/requireAuth.js"); 

const {
  getChatHistoryController,
  generateSummaryController,
  listSummariesController,
  appendUserMessageController,
} = require("../controller/summaryController.js");

const router = express.Router();

// Protect all summary endpoints
router.use(requireAuth);

router.get("/chat-history/:id", getChatHistoryController);
router.post("/generate/:id", generateSummaryController);
router.get("/list", listSummariesController);
router.post("/append-user/:id", appendUserMessageController);

module.exports = router;
