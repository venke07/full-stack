// routes/conversationRoutes.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ============================
   GET conversations for agent
   URL: GET /api/conversations/agent/:id
============================ */
router.get('/agent/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('agent_id', id)
      .order('date_created', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      count: data.length,
      conversations: data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving conversations',
      error: err.message
    });
  }
});


/* ============================
   DELETE ALL conversations
   URL: DELETE /api/conversations
============================ */
router.delete('/', async (req, res) => {
  try {
    const { error: msgError } = await supabase
      .from('messages')
      .delete()
      .neq('id', 0);

    if (msgError) throw msgError;

    const { error: convError } = await supabase
      .from('conversations')
      .delete()
      .neq('id', 0);

    if (convError) throw convError;

    res.json({
      success: true,
      message: "All conversations deleted successfully."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to delete all conversations",
      error: err.message
    });
  }
});


/* ============================
   DELETE one conversation
   URL: DELETE /api/conversations/:conversationId
============================ */
router.delete('/:conversationId', async (req, res) => {
  const { conversationId } = req.params;

  try {
    const { error: msgError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (msgError) throw msgError;

    const { error: convError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (convError) throw convError;

    res.json({
      success: true,
      message: "Conversation deleted successfully."
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error deleting conversation',
      error: err.message
    });
  }
});

module.exports = router;
