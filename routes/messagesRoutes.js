// routes/messagesRoutes.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const messagesModel = require('../model/messagesModel.js');
require('dotenv').config();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ====================================
   Get all messages for a conversation
   URL: GET /api/message/:conversationId/messages
==================================== */
router.get('/:conversationId/messages', async (req, res) => {
  try {
    const conversationId = Number(req.params.conversationId);

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    const messages = await messagesModel.getConversationMessages(conversationId);

    res.json({
      success: true,
      length: messages.length,
      messages
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving messages',
      error: err.message
    });
  }
});

module.exports = router;
