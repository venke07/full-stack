// routes/agentRoutes.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const router = express.Router();

// connect to Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// GET all agents
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('*');

    if (error) throw error;

    res.json({
      success: true,
      count: data.length,
      agents: data
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving agents',
      error: err.message
    });
  }
});

module.exports = router;
