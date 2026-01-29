const TOKEN_CHAR_RATIO = 4;

const clampPositive = (value, fallback = 0) => {
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
};

export const estimateTokens = (text = '') => {
  if (!text) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / TOKEN_CHAR_RATIO));
};

export const estimateTokensForMessages = (messages = []) =>
  messages.reduce((total, message) => total + estimateTokens(message?.content || ''), 0);

export const buildUsageEvent = ({
  userId,
  agentId,
  modelId,
  promptMessages = [],
  responseText = '',
  source = 'chat',
  timestamp = new Date().toISOString(),
  messageCount,
}) => {
  const promptTokens = estimateTokensForMessages(promptMessages);
  const completionTokens = estimateTokens(responseText);
  const totalTokens = promptTokens + completionTokens;

  return {
    user_id: userId,
    agent_id: agentId,
    model_id: modelId,
    source,
    message_count: clampPositive(messageCount ?? promptMessages.length, 1),
    prompt_tokens_est: promptTokens,
    completion_tokens_est: completionTokens,
    total_tokens_est: totalTokens,
    created_at: timestamp,
  };
};

export const logUsageEvent = async ({ supabaseClient, payload }) => {
  if (!supabaseClient || !payload?.user_id) {
    return { error: new Error('Supabase is not configured.') };
  }

  const { error } = await supabaseClient.from('agent_usage_events').insert([payload]);
  return { error };
};
