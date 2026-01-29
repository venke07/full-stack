const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({});

async function summarizeConversation({ geminiMessages, agentDescription }) {
  const transcript = geminiMessages
    .map((m) => `${m.role === "assistant" ? "Agent" : "User"}: ${m.content}`)
    .join("\n");

  const prompt =
    "(IMPORTANT) Summarize the conversation in 2 to 4 sentences. " +
    "Generalize what the user is mainly asking about and what the agent is helping with. " +
    "Ignore greetings, setup messages, and incomplete exchanges. " +
    "If the topic is unclear, say so briefly. Do not invent topics.\n\n" +
    `Agent description: ${agentDescription || "N/A"}\n\n` +
    "Conversation:\n" +
    transcript;

  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return (resp.text || "").trim();
}

// geminiMessages: [{ role: "user"|"assistant", content: "..." }, ...]
async function generateUsageLabel({ geminiMessages, agentDescription }) {
  const transcript = geminiMessages
    .map((m) => `${m.role === "assistant" ? "Agent" : "User"}: ${m.content}`)
    .join("\n");

  const prompt =
    "(IMPORTANT) Write a short usage label (3 to 7 words). " +
    "Describe what the user uses this agent for. " +
    "No punctuation. No full sentence. " +
    "Be specific but generalize across messages. " +
    "If unclear, output: Unclear usage.\n\n" +
    `Agent description: ${agentDescription || "N/A"}\n\n` +
    "Conversation:\n" +
    transcript;

  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return (resp.text || "").trim();
}

async function generateIntentBreakdown({ geminiMessages, agentDescription }) {
  const transcript = geminiMessages
    .map((m) => `${m.role === "assistant" ? "Agent" : "User"}: ${m.content}`)
    .join("\n");

  const prompt =
    "(IMPORTANT) Categorize what the user is asking about into 3 to 6 intent categories. " +
    "Return ONLY valid JSON array, no markdown, no extra text. " +
    'Format: [{"label":"Business Analysis","percent":65}, ...]. ' +
    "Percent must sum to 100. Use short labels (2-3 words). " +
    "If unclear, return: " +
    '[{"label":"Unclear","percent":100}].\n\n' +
    `Agent description: ${agentDescription || "N/A"}\n\n` +
    "Conversation:\n" +
    transcript;

  const resp = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  const text = (resp.text || "").trim();

  // Safe parse
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Not array");
    return parsed;
  } catch (e) {
    // fallback if Gemini returns something weird
    return [{ label: "Unclear", percent: 100 }];
  }
}

module.exports = {
   summarizeConversation,
   generateUsageLabel, 
   generateIntentBreakdown
};
