// model/usageDashboardModel.js
const { createClient } = require("@supabase/supabase-js");

const {
  generateUsageLabel,
  summarizeConversation,
  generateIntentBreakdown,
} = require("../services/geminiSummaryService.js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


function normalizeChatHistory(chat_history) {
  const arr = Array.isArray(chat_history) ? chat_history : [];

  return arr
    .map((m) => {
      const roleRaw = (m.role || "").toLowerCase();
      const text = (m.content ?? m.text ?? "").toString().trim();
      if (!text) return null;

      const role =
        roleRaw === "assistant" || roleRaw === "agent" ? "assistant" : "user";

      return { role, content: text };
    })
    .filter(Boolean);
}

// keep cost down: only send the most recent N user+agent messages
function takeRecentMessages(msgs, max = 30) {
  if (!Array.isArray(msgs)) return [];
  return msgs.slice(-max);
}

function extractExamplePrompts(chat_history, limit = 2) {
  let arr = chat_history;

  if (!arr) return [];
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];

  const prompts = arr
    .filter((m) => m && m.role === "user" && typeof m.text === "string")
    .map((m) => m.text.trim())
    .filter(Boolean);

  return prompts.slice(-limit);
}

function countUserMessages(chat_history) {
  let arr = chat_history;

  if (!arr) return 0;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch {
      return 0;
    }
  }
  if (!Array.isArray(arr)) return 0;

  return arr.filter(
    (m) =>
      m &&
      m.role === "user" &&
      typeof m.text === "string" &&
      m.text.trim().length > 0
  ).length;
}

function computeUsageStatus({ usageLabel, totalUserMessages }) {
  if (!usageLabel || usageLabel.trim() === "" || usageLabel === "Unclear usage") {
    return { status: "Underutilized", color: "yellow", reason: "Not enough signal" };
  }
  if (totalUserMessages < 3) {
    return { status: "Underutilized", color: "yellow", reason: "Low usage volume" };
  }
  return { status: "Healthy", color: "green", reason: "Clear purpose, consistent usage" };
}

function computeAlignment({ description, usageLabel }) {
  const d = (description || "").toLowerCase();
  const u = (usageLabel || "").toLowerCase();

  if (!d || !u) return { alignment: "Unknown", score: 0 };

  const dWords = new Set(d.split(/\W+/).filter((w) => w.length >= 4));
  const uWords = new Set(u.split(/\W+/).filter((w) => w.length >= 4));

  let overlap = 0;
  for (const w of uWords) if (dWords.has(w)) overlap++;

  const score = Math.min(
    100,
    Math.round((overlap / Math.max(1, uWords.size)) * 100)
  );

  let alignment = "Low";
  if (score >= 60) alignment = "High";
  else if (score >= 30) alignment = "Medium";

  return { alignment, score };
}

async function getAllAgentData(userId) {
  if (!userId) throw new Error("userId is required");

  const { data, error } = await supabase
    .from("agent_personas")
    .select(
      "*"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data || [];

  return rows.map((a) => {
    const totalUserMessages = countUserMessages(a.chat_history);
    const examplePrompts = extractExamplePrompts(a.chat_history, 2);

    const { alignment, score } = computeAlignment({
      description: a.description,
      usageLabel: a.usage_label,
    });

    const { status: usageStatus, reason: usageReason } = computeUsageStatus({
      usageLabel: a.usage_label,
      totalUserMessages,
    });

    return {
      ...a,
      total_user_messages: totalUserMessages,
      example_prompts: examplePrompts,
      alignment,
      alignment_score: score,
      usage_status: usageStatus,
      usage_recommendation:
        usageStatus === "Healthy"
          ? "Clear purpose and consistent usage."
          : "Not enough usage yet. Encourage more interactions or refine the description.",
      intended_use: a.description || "N/A",
      actual_use: a.usage_label || "Unclear usage",
      usage_reason: usageReason,
    };
  });
}

async function getAgentPersonaById(agentId, userId) {
  if (!userId) throw new Error("userId is required");

  const { data, error } = await supabase
    .from("agent_personas")
    .select("*")
    .eq("id", agentId)
    .eq("user_id", userId)
    .single();

  if (error) throw error; 
  return data;
}

async function updateAgentUsageLabel(agentId, userId, usageLabel) {
  if (!userId) throw new Error("userId is required");

  await getAgentPersonaById(agentId, userId);

  const { error } = await supabase
    .from("agent_personas")
    .update({
      usage_label: usageLabel,
      usage_label_updated_at: new Date().toISOString(),
    })
    .eq("id", agentId)
    .eq("user_id", userId);

  if (error) throw error;
}

async function computeUsageLabelsForAllAgents(userId, { force = false } = {}) {
  if (!userId) throw new Error("userId is required");

  const { data, error } = await supabase
    .from("agent_personas")
    .select("id, user_id, name, description, chat_history, usage_label")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const agents = data || [];
  const results = [];

  for (const a of agents) {
    const alreadyHas = a.usage_label && a.usage_label.trim() !== "";

    if (!force && alreadyHas) {
      results.push({ id: a.id, usageLabel: a.usage_label, cached: true });
      continue;
    }

    const normalized = normalizeChatHistory(a.chat_history);
    const recent = takeRecentMessages(normalized, 30);

    let usageLabel = "Unclear usage";
    if (recent.length >= 4) {
      usageLabel = await generateUsageLabel({
        geminiMessages: recent,
        agentDescription: a.description,
      });
    }

    await updateAgentUsageLabel(a.id, userId, usageLabel);

    results.push({ id: a.id, usageLabel, cached: false });
  }

  return {
    total: agents.length,
    updated: results.filter((r) => !r.cached).length,
    results,
  };
}

async function updateUsageAnalytics(personaId, {
  usage_label,
  conversation_summary,
  usage_insights,
  unsummarized_user_count,
  last_used,
}) {
  const payload = {};

  if (usage_label !== undefined) payload.usage_label = usage_label;
  if (conversation_summary !== undefined) payload.conversation_summary = conversation_summary;
  if (usage_insights !== undefined) payload.usage_insights = usage_insights;
  if (unsummarized_user_count !== undefined) payload.unsummarized_user_count = unsummarized_user_count;
  if (last_used !== undefined) payload.last_used = last_used;

  const { error } = await supabase
    .from("agent_personas")
    .update(payload)
    .eq("id", personaId);

  if (error) throw error;
}

async function getAgentNotesById(personaId, userId) {
  const { data, error } = await supabase
    .from("agent_personas")
    .select("agent_notes")
    .eq("id", personaId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data?.agent_notes || "";
}

async function updateAgentNotesById(personaId, userId, agentNotes) {
  const { error } = await supabase
    .from("agent_personas")
    .update({ agent_notes: agentNotes })
    .eq("id", personaId)
    .eq("user_id", userId);
  if (error) throw error;
}

function toDate(x) {
  const d = x ? new Date(x) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

async function computeAndSaveAnalyticsIfNeeded(agentId, userId) {
  const agent = await getAgentPersonaById(agentId, userId);

  const lastUsed = toDate(agent.last_used);
  const lastAnalytics = toDate(agent.usage_label_updated_at);

  const needsCompute =
    !agent.intent_breakdown ||
    !lastAnalytics ||
    (lastUsed && lastAnalytics && lastUsed > lastAnalytics);

  if (!needsCompute) {
    return { skipped: true, reason: "Analytics already up to date" };
  }

  const normalized = normalizeChatHistory(agent.chat_history);
  const recent = takeRecentMessages(normalized, 30);

  if (recent.length < 4) {
    return { skipped: true, reason: "Not enough chat content" };
  }

  const [usageLabel, intents] = await Promise.all([
    generateUsageLabel({ geminiMessages: recent, agentDescription: agent.description }),
    generateIntentBreakdown({ geminiMessages: recent, agentDescription: agent.description }),
  ]);

  const { error } = await supabase
    .from("agent_personas")
    .update({
      usage_label: usageLabel,
      usage_label_updated_at: new Date().toISOString(),
      intent_breakdown: intents,
    })
    .eq("id", agentId)
    .eq("user_id", userId);

  if (error) throw error;

  return { skipped: false, usageLabel, intents };
}

module.exports = {
  getAllAgentData,
  computeUsageLabelsForAllAgents,
  getAgentPersonaById,
  updateAgentUsageLabel,
  updateUsageAnalytics,
  getAgentNotesById, 
  updateAgentNotesById,
  computeAndSaveAnalyticsIfNeeded
};
