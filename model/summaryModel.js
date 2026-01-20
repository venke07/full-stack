const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getChatHistoryByPersonaId(personaId) {
  const { data, error } = await supabase
    .from("agent_personas")
    .select("chat_history")
    .eq("id", personaId)
    .single(); // gives single row result no {} wrapper

  if (error) throw error;
  return data?.chat_history || [];
}

function toGeminiMessages(chatHistory) {
  const trimmed = chatHistory.slice(-50);

  return trimmed
    .filter((m) => m && typeof m.text === "string" && m.text.trim() !== "")
    .map((m) => ({
      role: m.role === "agent" ? "assistant" : "user",
      content: m.text,
    }));
}


async function updateChatHistoryAndCounter(personaId, newChatHistory, newCount) {
  const { error } = await supabase
    .from("agent_personas")
    .update({
      chat_history: newChatHistory,
      unsummarized_user_count: newCount,
    })
    .eq("id", personaId);

  if (error) throw error;
}


async function saveConversationSummary(personaId, summary) {
  const { error } = await supabase
    .from("agent_personas")
    .update({
      conversation_summary: summary,
      conversation_summary_time: new Date().toISOString(),
      unsummarized_user_count: 0, // reset after summarizing
    })
    .eq("id", personaId);

  if (error) throw error;
}

async function saveChatSummary(personaId, summary) {
  const { error } = await supabase
    .from("agent_personas")
    .update({
      conversation_summary: summary,
      conversation_summary_time: new Date().toISOString(),
    })
    .eq("id", personaId);

  if (error) throw error;
}

async function getAllPersonaSummaries() {
  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, name, description, conversation_summary, conversation_summary_time");

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name || "Unnamed Agent",
    description: row.description,
    summary: row.conversation_summary || "No summary yet.",
    summary_time: row.conversation_summary_time
      ? new Date(row.conversation_summary_time).toLocaleString()
      : "",
    highlights: [],
    tags: [],
  }));
}

async function getPersonaMetaById(personaId) {
  const { data, error } = await supabase
    .from("agent_personas")
    .select(
      "id, description, chat_history, unsummarized_user_count"
    )
    .eq("id", personaId)
    .single();

  if (error) throw error;
  return data;
}

module.exports = {
  getChatHistoryByPersonaId,
  toGeminiMessages,
  saveChatSummary,
  saveConversationSummary,
  updateChatHistoryAndCounter,
  getAllPersonaSummaries,
  getPersonaMetaById
};
