// controllers/venkeController.js
const venkeModel = require("../model/venkeModel.js");

async function getAgentDataController(req, res) {
  try {
    const data = await venkeModel.getAgentData();
    res.json({ success: true, length: data.length, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving venke data",
      error: err.message
    });
  }
}

async function getAgentsGroupedController(req, res) {
  try {
    const data = await venkeModel.getAgentsGroupedByExactName();
    res.json({ success: true, length: data.length, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving grouped agents",
      error: err.message
    });
  }
}



async function updateDescController(req, res) {
  try {
    const { id } = req.params;
    const { description } = req.body;

    if (typeof description !== "string") {
      return res.status(400).json({ success: false, message: "description must be a string" });
    }

    await venkeModel.updateDesc(id, description);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error updating description", error: err.message });
  }
}

async function updateAllDescController(req, res) {
  try {
    await venkeModel.updateAllDesc();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error clearing all descriptions", error: err.message });
  }
}

async function getChatHistoryController(req, res) {
  try {
    const { id } = req.params;
    const data = await venkeModel.getChatHistoryByPersonaId(id);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error retrieving chat history",
      error: err.message
    });
  }
}


async function searchPersonaChatHistoryController(req, res) {
  try {
    const { name, query } = req.query;

    if (!name || !query) {
      return res.status(400).json({
        success: false,
        message: "Missing required query params: name and query"
      });
    }

    const data = await venkeModel.searchPersonaChatHistoryByAgentName(name, query);

    res.json({
      success: true,
      length: data.length,
      data
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error searching persona chat history",
      error: err.message
    });
  }
}


module.exports = {
  getAgentDataController,
  getAgentsGroupedController,
  updateDescController,
  updateAllDescController,
  getChatHistoryController,
  searchPersonaChatHistoryController
};
