// controllers/usageDashboardController.js
const venkeModel = require("../model/usageDashboardModel.js");

async function getAllAgentDataController(req, res) {
    try {
        const data = await venkeModel.getAllAgentData();
        res.json({ success: true, length: data.length, data });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error retrieving agent data",
            error: err.message
        });
    }
}

async function bulkComputeUsageLabels(req, res) { 
  try {
    const force = req.query.force === "true";
    const result = await venkeModel.computeUsageLabelsForAllAgents({ force });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
    getAllAgentDataController,
    bulkComputeUsageLabels
};
