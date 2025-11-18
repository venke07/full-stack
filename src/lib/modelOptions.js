export const modelOptions = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'google-ai-studio',
    envKey: 'GEMINI_API_KEY',
    helper: 'Backed by Google AI Studio',
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openai',
    envKey: 'OPENAI_API_KEY',
    helper: 'Runs via OpenAI Platform',
  },
  {
    id: 'deepseek-chat',
    label: 'DeepSeek Chat',
    provider: 'deepseek',
    envKey: 'DEEPSEEK_API_KEY',
    helper: 'Cost-optimized DeepSeek endpoint',
  },
];

export const getModelMeta = (modelId) =>
  modelOptions.find((option) => option.id === modelId) ?? modelOptions[0];
