const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);


async function getAgentData() {
  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, name, description")
    .not("name", "is", null)
    .neq("name", "");

  if (error) throw new Error(error.message);
  return data || [];
}


async function getAgentsGroupedByExactName() {
  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, name, description")
    .not("name", "is", null)
    .neq("name", "");

  if (error) throw new Error(error.message);

  const grouped = new Map();

  for (const row of data || []) {
    const name = (row.name || "").trim();
    const desc = (row.description || "").trim();

    if (!grouped.has(name)) {
      grouped.set(name, {
        id: row.id,              // ✅ keep sidebar working (agent.id exists)
        name,
        descriptions: []         // ✅ array of {id, text}
      });
    }

    if (desc) {
      const bucket = grouped.get(name);
      const exists = bucket.descriptions.some(d => d.text === desc);
      if (!exists) bucket.descriptions.push({ id: row.id, text: desc });
    }
  }

  return Array.from(grouped.values());
}

async function updateDesc(id, description) {

  const { data, error } = await supabase
    .from('agent_personas')
    .update({ description })
    .eq('id', id)
    .select(); 

  if (error) throw error;
  return data;
}

async function updateAllDesc() {
  const { data, error } = await supabase
    .from('agent_personas')
    .update({ description: "" })
    .neq('description', ''); // only update non-empty descriptions

  if (error) throw error;
  return data;
}

async function getChatHistoryByPersonaId(id) {
  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, name, description, chat_history, chat_summary, created_at")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

function safeParseChatHistory(value) {
  if (!value) return [];
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return [];
  }
}

// Search inside agent_personas.chat_history for ONE selected agent name
async function searchPersonaChatHistoryByAgentName(agentName, query) {
  const q = (query || "").toLowerCase().trim();
  const name = (agentName || "").trim();

  if (!name || !q) return [];

  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, name, description, chat_history, chat_summary")
    .eq("name", name);

  if (error) throw new Error(error.message);

  const results = [];

  for (const row of data || []) {
    const history = safeParseChatHistory(row.chat_history);

    // If chat_history is empty but chat_summary contains the keyword, still return it
    const summaryText = (row.chat_summary || "").toLowerCase();
    if (history.length === 0 && summaryText.includes(q)) {
      results.push({
        persona_id: row.id,
        agent_name: row.name,
        description: row.description || "",
        role: "summary",
        text: row.chat_summary,
        message_index: null
      });
      continue;
    }

    history.forEach((m, idx) => {
      const text = (m?.text || "").toLowerCase();
      if (text.includes(q)) {
        results.push({
          persona_id: row.id,
          agent_name: row.name,
          description: row.description || "",
          role: m.role || "unknown",
          text: m.text || "",
          message_index: idx
        });
      }
    });
  }

  return results;
}


module.exports = { 
  getAgentData, 
  getAgentsGroupedByExactName,
  updateDesc,
  updateAllDesc,
  getChatHistoryByPersonaId,
  searchPersonaChatHistoryByAgentName
};
