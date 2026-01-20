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

module.exports = { summarizeConversation };
