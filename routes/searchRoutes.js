// routes/searchRoutes.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const messagesModel = require('../model/searchModel.js');
require('dotenv').config();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* =========================================
   Search messages
   URL: GET /api/search/messages?query=hello
========================================= */
router.get('/messages', async (req, res) => {
  try {
    const query = req.query.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Query cannot be empty'
      });
    }

    const results = await messagesModel.searchMessages(query);

    res.json({
      success: true,
      query,
      length: results.length,
      messages: results
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving search results',
      error: err.message
    });
  }
});

module.exports = router;
