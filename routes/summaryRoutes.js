const express = require("express");
const {
  getChatHistoryController,
  generateSummaryController,
  listSummariesController,
  appendUserMessageController
} = require("../controller/summaryController.js");

const router = express.Router();

router.get("/chat-history/:id", getChatHistoryController);

router.post("/generate/:id", generateSummaryController);

router.get("/list", listSummariesController);   

router.post("/append-user/:id", appendUserMessageController);

module.exports = router;
