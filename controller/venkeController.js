// controllers/venkeController.js
const venkeModel = require("../model/venkeModel.js");

async function getAgentDataController(req, res) {
  try {
    const userId = req.user.userId;
    const data = await venkeModel.getAgentData(userId);
    res.json({ success: true, length: data.length, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving venke data",
      error: err.message,
    });
  }
}

async function getAgentsGroupedController(req, res) {
  try {
    const userId = req.user.userId;
    const data = await venkeModel.getAgentsGroupedByExactName(userId);
    res.json({ success: true, length: data.length, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving grouped agents",
      error: err.message,
    });
  }
}

async function updateDescController(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { description } = req.body;

    if (typeof description !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "description must be a string" });
    }

    const updated = await venkeModel.updateDesc(userId, id, description);

    // If no row updated, it might be "wrong id" OR "not owned by this user"
    if (!updated || updated.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Persona not found for this user",
      });
    }

    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error updating description", error: err.message });
  }
}

async function updateAllDescController(req, res) {
  try {
    const userId = req.user.userId;
    await venkeModel.updateAllDesc(userId);
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error clearing all descriptions", error: err.message });
  }
}

async function getChatHistoryController(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const data = await venkeModel.getChatHistoryByPersonaId(userId, id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving chat history",
      error: err.message,
    });
  }
}

async function searchPersonaChatHistoryController(req, res) {
  try {
    const userId = req.user.userId;
    const { name, query } = req.query;

    if (!name || !query) {
      return res.status(400).json({
        success: false,
        message: "Missing required query params: name and query",
      });
    }

    const data = await venkeModel.searchPersonaChatHistoryByAgentName(userId, name, query);

    res.json({
      success: true,
      length: data.length,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error searching persona chat history",
      error: err.message,
    });
  }
}

module.exports = {
  getAgentDataController,
  getAgentsGroupedController,
  updateDescController,
  updateAllDescController,
  getChatHistoryController,
  searchPersonaChatHistoryController,
};
