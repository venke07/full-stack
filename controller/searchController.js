// controllers/messageController.js
import { searchMessages } from '../model/searchModel.js';

export async function searchMessagesController(req, res) {
  try {
    const { query } = req.query;  // /api/search/messages?query=ana

    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Query cannot be empty' });
    }

    const results = await searchMessages(query);

    return res.json({
      query,
      count: results.length,
      messages: results
    });
  } catch (err) {
    console.error('searchMessagesController error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
