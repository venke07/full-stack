
const {
  getChatHistoryByPersonaId,
  toGeminiMessages,
  saveChatSummary,
  getAllPersonaSummaries, 
  updateChatHistoryAndCounter,
  getPersonaMetaById
} = require("../model/summaryModel");

const { summarizeConversation } = require("../services/geminiSummaryService");

exports.getChatHistoryController = async (req, res) => {
  try {
    const { id } = req.params;
    const chatHistory = await getChatHistoryByPersonaId(id);
    res.json({ id, chat_history: chatHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch chat history." });
  }
};

exports.generateSummaryController = async (req, res) => {
  try {
    const { id } = req.params;

    const chatHistory = await getChatHistoryByPersonaId(id);
    if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
      return res.status(400).json({ message: "No chat history found." });
    }

    const geminiMessages = toGeminiMessages(chatHistory);
    const persona = await getPersonaMetaById(id);

    const summary = await summarizeConversation({
      geminiMessages,
      agentDescription: persona.description,
    });

    await saveChatSummary(id, summary);

    return res.json({ persona_id: id, summary, saved: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to generate summary." });
  }
};


exports.listSummariesController = async (req, res) => {
  try {
    const summaries = await getAllPersonaSummaries();
    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load chat summaries." });
  }
};



exports.appendUserMessageController = async (req, res) => {
  try {
    const { id } = req.params; // persona id
    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ message: "text is required" });
    }

    const persona = await getPersonaMetaById(id);
    const chatHistory = Array.isArray(persona.chat_history)
      ? persona.chat_history
      : [];

    // append user message
    const now = Date.now();
    chatHistory.push({
      id: `user-${now}`,
      role: "user",
      text: text.trim(),
    });

    const prevCount = persona.unsummarized_user_count || 0;
    const newCount = prevCount + 1;

    // save history + count
    await updateChatHistoryAndCounter(id, chatHistory, newCount);

    // summarize when threshold reached
    if (newCount >= 5) {
      const geminiMessages = toGeminiMessages(chatHistory);

      const summary = await summarizeConversation({
        geminiMessages,
        agentDescription: persona.description,
      });

      await saveChatSummary(id, summary); // should reset count to 0 in model

      return res.json({
        ok: true,
        summarized: true,
        summary,
        unsummarized_user_count: 0,
      });
    }

    return res.json({
      ok: true,
      summarized: false,
      unsummarized_user_count: newCount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to append user message." });
  }
};
