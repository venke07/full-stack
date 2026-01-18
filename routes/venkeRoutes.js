// routes/venkeRoutes.js
const express = require("express");
const {
  getAgentDataController,
  updateDescController,
  updateAllDescController,
  getAgentsGroupedController,
  getChatHistoryController,
  searchPersonaChatHistoryController
} = require("../controller/venkeController.js");
    
const router = express.Router();

router.get("/venke-data", getAgentDataController);
router.get("/venke-descriptions", getAgentsGroupedController);
router.get("/search-chat", searchPersonaChatHistoryController);
router.get("/chat-history/:id", getChatHistoryController);

router.put("/descriptions/clear-all", updateAllDescController);
router.put("/:id", updateDescController);



module.exports = router;
