import * as messagesModel from '../model/messagesModel.js';

export async function getConversationMessages(req, res) {
    try {
        const conversationId = Number(req.params.conversationId);

        if (isNaN(conversationId)) {
            return res.status(400).json({ error: "Invalid conversation ID" });
        }

        const data = await messagesModel.getConversationMessages(conversationId);

        return res.json(data);

    } catch (err) {
        console.error('Error fetching messages:', err.message);
        return res.status(500).json({ error: err.message });
    }
}


