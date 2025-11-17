// routes/conversationRoutes.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const router = express.Router();

// connect to Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET conversations for a specific agent
router.get('/agents/:id/conversations', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('conversations')
      .select('*') // or specify 'title, date_created' if you want lighter response
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

module.exports = router;
