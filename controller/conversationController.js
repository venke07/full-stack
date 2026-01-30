// controller/conversationController.js
import * as conversationModel from '../model/conversationModel.js';

export async function getAgentConversations(req, res) {
  try {
    const { id } = req.params; 
    const data = await conversationModel.getAgentConversations(id);
    res.json(data);
  } catch (err) {
    console.error('Error fetching conversations:', err.message);
    res.status(500).json({ error: err.message });
  }
}


export async function deleteAllConversations(req, res) {
  try {
    await deleteAllConversations();

    res.json({
      success: true,
      message: "All conversations and messages deleted successfully."
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to delete conversations",
      error: err.message
    });
  }
}