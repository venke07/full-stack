const express = require("express");
const requireAuth = require("../middleware/requireAuth.js"); 

const {
  getAllAgentDataController,
  bulkComputeUsageLabels,
  getAgentNotesController,
  updateAgentNotesController,
  computeAgentAnalyticsController
} = require("../controller/usageDashboardController.js");

const router = express.Router();

router.use(requireAuth);

router.get("/agent-data", getAllAgentDataController);
router.post("/labels/bulk", bulkComputeUsageLabels);
router.get("/agents/:id/notes", getAgentNotesController);
router.put("/agents/:id/notes", updateAgentNotesController);
router.post("/agents/:id/analytics/compute", computeAgentAnalyticsController);

module.exports = router;
