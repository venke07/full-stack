const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getChatHistoryByPersonaId(personaId, userId) {
  if (!userId) throw new Error("userId is required");

  const { data, error } = await supabase
    .from("agent_personas")
    .select("chat_history")
    .eq("id", personaId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data?.chat_history || [];
}

function toGeminiMessages(chatHistory) {
  const trimmed = Array.isArray(chatHistory) ? chatHistory.slice(-50) : [];

  return trimmed
    .filter((m) => m && typeof m.text === "string" && m.text.trim() !== "")
    .map((m) => ({
      role: m.role === "agent" ? "assistant" : "user",
      content: m.text,
    }));
}

async function updateChatHistoryAndCounter(personaId, userId, newChatHistory, newCount) {
  if (!userId) throw new Error("userId is required");

  const { error } = await supabase
    .from("agent_personas")
    .update({
      chat_history: newChatHistory,
      unsummarized_user_count: newCount,
      last_used: new Date().toISOString(),
    })
    .eq("id", personaId)
    .eq("user_id", userId);

  if (error) throw error;
}

async function saveConversationSummary(personaId, userId, summary) {
  if (!userId) throw new Error("userId is required");

  const { error } = await supabase
    .from("agent_personas")
    .update({
      conversation_summary: summary,
      conversation_summary_time: new Date().toISOString(),
      unsummarized_user_count: 0, // reset after summarizing
    })
    .eq("id", personaId)
    .eq("user_id", userId);

  if (error) throw error;
}

async function saveChatSummary(personaId, userId, summary) {
  if (!userId) throw new Error("userId is required");

  // your controller expects this to reset count after threshold
  const { error } = await supabase
    .from("agent_personas")
    .update({
      conversation_summary: summary,
      conversation_summary_time: new Date().toISOString(),
      unsummarized_user_count: 0,
    })
    .eq("id", personaId)
    .eq("user_id", userId);

  if (error) throw error;
}

async function getAllPersonaSummaries(userId) {
  if (!userId) throw new Error("userId is required");

  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, name, description, conversation_summary, conversation_summary_time")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

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

async function getPersonaMetaById(personaId, userId) {
  if (!userId) throw new Error("userId is required");

  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, description, chat_history, unsummarized_user_count")
    .eq("id", personaId)
    .eq("user_id", userId)
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
  getPersonaMetaById,
};
