
const express = require("express");
const {
  getAllAgentDataController,
  bulkComputeUsageLabels 
} = require("../controller/usageDashboardController.js");

const router = express.Router();

router.get("/agent-data", getAllAgentDataController);

router.post("/labels/bulk", bulkComputeUsageLabels);

module.exports = router;
