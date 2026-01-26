// model/messagesModel.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Search messages by keyword (case-insensitive)
async function searchMessages(keyword) {
  const q = keyword.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('messages')
    .select(`
      id,
      content,
      date_created,
      conversation_id,
      conversations (
        id,
        title,
        date_created,
        agent_id,
        agents (
          id,
          name,
          avatar_url
        )
      )
    `)
    .ilike('content', `%${q}%`)
    .order('date_created', { ascending: false });

  if (error) {
    console.error("searchMessages error:", error);
    throw error;
  }

  return data;
}

module.exports = {
  searchMessages
};
