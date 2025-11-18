import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import 'dotenv/config';

const PORT = process.env.PORT || 4000;

const MODEL_HANDLERS = {
  'gemini-2.5-flash': {
    envKey: 'GEMINI_API_KEY',
    handler: callGemini,
  },
  'gpt-4o-mini': {
    envKey: 'OPENAI_API_KEY',
    handler: callOpenAICompatible,
    baseUrl: 'https://api.openai.com/v1/chat/completions',
  },
  'deepseek-chat': {
    envKey: 'DEEPSEEK_API_KEY',
    handler: callOpenAICompatible,
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
  },
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/chat', async (req, res) => {
  const { modelId, messages, temperature = 0.3 } = req.body || {};

  if (!modelId || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'modelId and messages are required.' });
  }

  const modelConfig = MODEL_HANDLERS[modelId];
  if (!modelConfig) {
    return res.status(400).json({ error: `Unknown model: ${modelId}` });
  }

  const apiKey = process.env[modelConfig.envKey];
  if (!apiKey) {
    return res.status(500).json({ error: `Missing API key for ${modelId}. Check ${modelConfig.envKey} in .env.` });
  }

  try {
    const reply = await modelConfig.handler({
      modelId,
      apiKey,
      temperature,
      messages,
      baseUrl: modelConfig.baseUrl,
    });
    res.json({ reply });
  } catch (error) {
    console.error('[LLM_ERROR]', error);
    res.status(500).json({ error: error.message || 'Model call failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`Agent Builder API running on http://localhost:${PORT}`);
});

function separateSystem(messages = []) {
  const systemMessages = messages.filter((msg) => msg.role === 'system');
  const conversation = messages.filter((msg) => msg.role !== 'system');
  const systemPrompt = systemMessages.map((msg) => msg.content).join('\n');
  return { systemPrompt, conversation };
}

async function callGemini({ apiKey, modelId, temperature, messages }) {
  const { systemPrompt, conversation } = separateSystem(messages);

  const body = {
    contents: conversation.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
    generationConfig: {
      temperature,
    },
  };

  if (systemPrompt) {
    body.systemInstruction = {
      role: 'system',
      parts: [{ text: systemPrompt }],
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(formatProviderError('Gemini', errorText));
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    ?.trim();

  if (!text) {
    throw new Error('Gemini returned no text.');
  }

  return text;
}

async function callOpenAICompatible({ apiKey, modelId, temperature, messages, baseUrl }) {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(formatProviderError(baseUrl.includes('deepseek') ? 'DeepSeek' : 'OpenAI', errorText));
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('Provider returned no text.');
  }

  return text;
}

function formatProviderError(providerName, errorText) {
  let parsed;
  try {
    parsed = JSON.parse(errorText);
  } catch (err) {
    // keep text as-is
  }

  const baseMessage = `${providerName} request failed`;

  if (!parsed) {
    return `${baseMessage}: ${errorText}`;
  }

  const message = parsed?.error?.message || parsed?.message;
  const status = parsed?.error?.status || parsed?.error?.code;

  if (providerName === 'Gemini' && status === 'NOT_FOUND') {
    return 'Gemini model not found. Use a supported model id (check ListModels or try gemini-1.5-pro-latest).';
  }

  if (providerName === 'DeepSeek' && message?.toLowerCase().includes('insufficient')) {
    return 'DeepSeek request failed: account lacks sufficient balance. Top up credits or switch providers.';
  }

  return `${baseMessage}: ${message || errorText}`;
}
