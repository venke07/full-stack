const {
  getAllAgentData,
  computeUsageLabelsForAllAgents,
  getAgentPersonaById,
  updateAgentUsageLabel,
  updateUsageAnalytics,
  getAgentNotesById, 
  updateAgentNotesById,
  computeAndSaveAnalyticsIfNeeded
} = require("../model/usageDashboardModel");


async function getAllAgentDataController(req, res) {
  try {
    const userId = req.user?.userId;
    const data = await getAllAgentData(userId);
    res.json({ success: true, length: data.length, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving agent data",
      error: err.message,
    });
  }
}

async function bulkComputeUsageLabels(req, res) {
  try {
    const userId = req.user?.userId;
    const force = req.query.force === "true";
    const result = await computeUsageLabelsForAllAgents(userId, { force });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getAgentNotesController(req, res) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    await getAgentPersonaById(id, userId);

    const notes = await getAgentNotesById(id, userId);
    res.json({ data: { agent_notes: notes } });
  } catch (err) {
    console.error("getAgentNotesController error:", err);
    res.status(500).json({ message: "Failed to load agent notes" });
  }
}

async function updateAgentNotesController(req, res) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { agent_notes } = req.body;

    if (typeof agent_notes !== "string") {
      return res.status(400).json({ message: "agent_notes must be a string" });
    }
    if (agent_notes.length > 2000) { 
      return res.status(400).json({ message: "agent_notes too long (max 2000 chars)" });
    }

    await getAgentPersonaById(id, userId);

    await updateAgentNotesById(id, userId, agent_notes.trim());

    res.json({ message: "Notes updated" });
  } catch (err) {
    console.error("updateAgentNotesController error:", err);
    res.status(500).json({ message: "Failed to update agent notes" });
  }
}

async function computeAgentAnalyticsController(req, res) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await computeAndSaveAnalyticsIfNeeded(id, userId);
    res.json({ success: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to compute analytics" });
  }
}

module.exports = {
  getAllAgentDataController,
  bulkComputeUsageLabels,
  getAgentNotesController,
  updateAgentNotesController,
  computeAgentAnalyticsController
};
