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
