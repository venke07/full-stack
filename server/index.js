import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import multer from 'multer';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';
import agentManager from './agentManager.js';
import intentClassifier from './intentClassifier.js';
import agentRegistry from './agentRegistry.js';
import taskPlanner from './taskPlanner.js';
import outputGenerators from './outputGenerators.js';
import promptVersioning from './promptVersioning.js';
import conversationMemory from './conversationMemory.js';
import toolExecutor from './toolExecutor.js';
import toolRegistry from './toolRegistry.js';
import historyStore from './historyStore.js';

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
  'llama-3.3-70b-versatile': {
    envKey: 'GROQ_API_KEY',
    handler: callOpenAICompatible,
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
  },
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const storageEndpoint = process.env.SUPABASE_STORAGE_ENDPOINT;
const storageRegion = process.env.SUPABASE_STORAGE_REGION || 'ap-south-1';
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET;
const storageAccessKey = process.env.SUPABASE_STORAGE_ACCESS_KEY;
const storageSecretKey = process.env.SUPABASE_STORAGE_SECRET_KEY;
const storageBaseUrl = storageEndpoint?.replace('/storage/v1/s3', '') ?? '';
const hasStorageConfig =
  !!storageEndpoint &&
  !!storageBucket &&
  !!storageAccessKey &&
  !!storageSecretKey;
const MAX_ATTACHMENT_COUNT = 3;
const MAX_ATTACHMENT_BYTES = 200 * 1024; // 200 KB per document sent to the model

const s3Client = hasStorageConfig
  ? new S3Client({
      region: storageRegion,
      endpoint: storageEndpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: storageAccessKey,
        secretAccessKey: storageSecretKey,
      },
    })
  : null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/storage/files', upload.single('file'), async (req, res) => {
  if (!hasStorageConfig || !s3Client) {
    return res.status(500).json({ error: 'Supabase storage is not configured on the server.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Missing file payload.' });
  }

  const ownerId = req.body?.userId?.toString() || 'anonymous';
  const safeOwnerId = ownerId.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 64) || 'anonymous';
  const key = `${safeOwnerId}/${Date.now()}-${sanitizeFilename(req.file.originalname)}`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: storageBucket,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'application/octet-stream',
      }),
    );

    const publicUrl = storageBaseUrl
      ? `${storageBaseUrl}/storage/v1/object/public/${storageBucket}/${key}`
      : null;

    res.json({
      bucket: storageBucket,
      path: key,
      url: publicUrl,
      size: req.file.size,
      contentType: req.file.mimetype,
    });
  } catch (error) {
    console.error('[STORAGE_UPLOAD_ERROR]', error);
    res.status(500).json({
      error: `Upload failed: ${error.message || 'Unknown error'}`,
      details: error,
    });
  }
});

app.get('/api/storage/files', async (req, res) => {
  if (!hasStorageConfig || !s3Client) {
    return res.status(500).json({ error: 'Supabase storage is not configured on the server.' });
  }

  const key = req.query?.path;
  if (!key) {
    return res.status(400).json({ error: 'Query parameter "path" is required.' });
  }

  try {
    const item = await s3Client.send(
      new GetObjectCommand({
        Bucket: storageBucket,
        Key: key,
      }),
    );

    if (item.ContentType) {
      res.setHeader('Content-Type', item.ContentType);
    }
    if (item.ContentLength) {
      res.setHeader('Content-Length', item.ContentLength.toString());
    }

    item.Body.pipe(res);
  } catch (error) {
    console.error('[STORAGE_FETCH_ERROR]', error);
    res.status(404).json({ error: 'File not found.', details: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { modelId, messages, temperature = 0.3, attachments = [] } = req.body || {};

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
    const docMessages = await buildAttachmentMessages(attachments);
    const finalMessages = docMessages.length ? [...docMessages, ...messages] : messages;
    const reply = await modelConfig.handler({
      modelId,
      apiKey,
      temperature,
      messages: finalMessages,
      baseUrl: modelConfig.baseUrl,
    });
    res.json({ reply });
  } catch (error) {
    console.error('[LLM_ERROR]', error);
    res.status(500).json({ error: error.message || 'Model call failed.' });
  }
});

/**
 * Get Available Tools for Agents
 */
app.get('/api/tools', (req, res) => {
  try {
    const tools = toolExecutor.getAvailableTools();
    res.json({
      success: true,
      tools,
      count: tools.length,
    });
  } catch (error) {
    console.error('[GET_TOOLS_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get tools',
    });
  }
});

/**
 * Execute Agent Tool Manually
 */
app.post('/api/tools/execute', async (req, res) => {
  const { toolId, params } = req.body || {};

  if (!toolId) {
    return res.status(400).json({ error: 'toolId is required' });
  }

  try {
    const result = await toolRegistry.executeTool(toolId, params || {});
    res.json(result);
  } catch (error) {
    console.error('[TOOL_EXECUTION_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Tool execution failed',
    });
  }
});

/**
 * Process Tool Calls from Agent Response
 */
app.post('/api/tools/process-response', async (req, res) => {
  const { responseText } = req.body || {};

  if (!responseText) {
    return res.status(400).json({ error: 'responseText is required' });
  }

  try {
    const result = await toolExecutor.executeToolCalls(responseText);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[PROCESS_RESPONSE_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process response',
    });
  }
});

/**
 * Orchestrated Multi-Agent Chat Endpoint
 * Agents work together in a coordinated workflow to complete complex tasks
 */
app.post('/api/orchestrated-chat', async (req, res) => {
  const { agentIds, userPrompt, mode = 'sequential', autoMode = false } = req.body || {};

  if (!autoMode && (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0)) {
    return res.status(400).json({ error: 'agentIds array is required (unless autoMode is true)' });
  }

  if (!userPrompt || typeof userPrompt !== 'string') {
    return res.status(400).json({ error: 'userPrompt is required' });
  }

  try {
    let selectedAgentIds = agentIds || [];

    // Auto-mode: detect agents needed
    if (autoMode) {
      // Register default agents if not already registered
      if (agentRegistry.getAllAgents().length === 0) {
        const defaultAgents = [
          {
            id: 'research-agent',
            name: 'Research Agent',
            description: 'Gathers and analyzes data',
            systemPrompt: `You are a research specialist. Gather comprehensive information on topics.

You have access to tools to help complete tasks:
- readFile: Read files from the outputs directory
- writeFile: Save findings to files
- analyzeData: Analyze CSV/JSON data and compute statistics
- listFiles: See what files are available
- generateReport: Create formatted reports

Use [TOOL_CALL: toolName({"param": "value"})] syntax to call tools.`,
            modelId: 'gpt-4o-mini',
            capabilities: ['data_research', 'analysis'],
            outputFormat: 'text',
          },
          {
            id: 'planning-agent',
            name: 'Planning Agent',
            description: 'Creates plans and strategies',
            systemPrompt: `You are a planning expert. Create detailed, actionable plans.

You have access to tools:
- writeFile: Document plans and strategies
- generateReport: Create formatted plans
- readFile: Reference existing documents

Use [TOOL_CALL: toolName({"param": "value"})] syntax to call tools.`,
            modelId: 'gpt-4o-mini',
            capabilities: ['planning', 'analysis'],
            outputFormat: 'text',
          },
          {
            id: 'document-agent',
            name: 'Document Agent',
            description: 'Formats and creates documents',
            systemPrompt: `You are a document creation specialist. Generate clear, well-structured, ready-to-save document content.

You have access to tools:
- writeFile: Save documents to outputs
- generateReport: Create formatted HTML or Markdown reports
- readFile: Reference existing documents

Use [TOOL_CALL: toolName({"param": "value"})] syntax to call tools.

Rules:
- Include a short title
- Separate paragraphs with blank lines
- Keep content professional and organized
- Use writeFile to save your work`,
            modelId: 'gpt-4o-mini',
            capabilities: ['document_generation', 'creative_writing'],
            outputFormat: 'document',
          },
          {
            id: 'data-processor',
            name: 'Data Processor',
            description: 'Processes and transforms data',
            systemPrompt: `You are a data processing specialist. Process data accurately and efficiently.

You have access to tools:
- readFile: Load CSV and JSON files
- analyzeData: Compute statistics and analysis
- writeFile: Save processed data
- listFiles: See available data files

Use [TOOL_CALL: toolName({"param": "value"})] syntax to call tools.`,
            modelId: 'gpt-4o-mini',
            capabilities: ['data_processing', 'analysis'],
            outputFormat: 'json',
          },
          {
            id: 'code-agent',
            name: 'Code Agent',
            description: 'Writes and generates code',
            systemPrompt: `You are a code generation specialist. Write clean, well-documented code.

You have access to tools:
- executeCode: Run JavaScript code and see results
- writeFile: Save code to files
- readFile: Reference existing code

Use [TOOL_CALL: toolName({"param": "value"})] syntax to call tools.`,
            modelId: 'gpt-4o-mini',
            capabilities: ['code_generation'],
            outputFormat: 'code',
          },
          {
            id: 'qa-agent',
            name: 'QA Agent',
            description: 'Reviews and validates output',
            systemPrompt: `You are a quality assurance specialist. Review and validate the output quality.

You have access to tools:
- readFile: Review generated content
- writeFile: Save QA reports
- analyzeData: Validate data integrity
- generateReport: Create quality assessments

Use [TOOL_CALL: toolName({"param": "value"})] syntax to call tools.`,
            modelId: 'gpt-4o-mini',
            capabilities: ['quality_assurance', 'analysis'],
            outputFormat: 'text',
          },
        ];

        for (const agent of defaultAgents) {
          agentRegistry.registerAgent(agent.id, agent);
        }
      }

      // Get agents for this task
      const agentsForTask = agentRegistry.getAgentsForTask(userPrompt);
      selectedAgentIds = agentsForTask.map(a => a.id);

      if (selectedAgentIds.length === 0) {
        selectedAgentIds = ['research-agent', 'planning-agent', 'document-agent'];
      }
    }

    // Register agents if not already registered
    for (const agentId of selectedAgentIds) {
      if (!agentManager.getAgent(agentId)) {
        const registeredAgent = agentRegistry.getAgent(agentId);
        if (registeredAgent) {
          agentManager.registerAgent(agentId, registeredAgent);
        } else {
          agentManager.registerAgent(agentId, {
            name: agentId,
            modelId: 'gpt-4o-mini',
            role: 'specialist',
          });
        }
      }
    }

    // Classify intent
    const intentAnalysis = intentClassifier.classify(userPrompt);

    // Create workflow
    const workflowId = `workflow-${Date.now()}`;
    agentManager.createWorkflow(workflowId, selectedAgentIds, mode);

    // Helper function to call LLM
    const callAgentHandler = async (config) => {
      const modelConfig = MODEL_HANDLERS[config.modelId];
      if (!modelConfig) {
        throw new Error(`Unknown model: ${config.modelId}`);
      }
      const apiKey = process.env[modelConfig.envKey];
      if (!apiKey) {
        throw new Error(`Missing API key for ${config.modelId}`);
      }

      const baseUrl = config.baseUrl || modelConfig.baseUrl || 'https://api.openai.com/v1/chat/completions';

      return await modelConfig.handler({
        ...config,
        apiKey,
        baseUrl,
      });
    };

    let result;

    if (mode === 'parallel') {
      // Execute all agents in parallel
      result = await agentManager.orchestrateParallel(
        selectedAgentIds,
        userPrompt,
        callAgentHandler
      );
    } else {
      // Sequential mode (default)
      result = await agentManager.executeWorkflow(
        workflowId,
        userPrompt,
        { sessionId: workflowId },
        callAgentHandler
      );
    }

    res.json({
      success: true,
      intentAnalysis,
      workflow: {
        id: workflowId,
        mode,
        autoMode,
      },
      result,
    });
  } catch (error) {
    console.error('[ORCHESTRATION_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Orchestration failed',
    });
  }
});

/**
 * Streaming Orchestrated Chat Endpoint
 * Real-time agent communication as messages appear
 * Uses GET with query parameters for EventSource compatibility
 */
app.get('/api/orchestrated-chat-stream', async (req, res) => {
  const { agentIds, userPrompt, mode = 'sequential', autoMode = 'false' } = req.query || {};
  
  const isModeAutoTrue = autoMode === 'true';
  const parsedAgentIds = agentIds ? JSON.parse(agentIds) : [];

  if (!isModeAutoTrue && (!parsedAgentIds || !Array.isArray(parsedAgentIds) || parsedAgentIds.length === 0)) {
    return res.status(400).json({ error: 'agentIds array is required (unless autoMode is true)' });
  }

  if (!userPrompt || typeof userPrompt !== 'string') {
    return res.status(400).json({ error: 'userPrompt is required' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let selectedAgentIds = parsedAgentIds || [];

    // Auto-mode: detect agents needed
    if (isModeAutoTrue) {
      // Register default agents if not already registered
      if (agentRegistry.getAllAgents().length === 0) {
        const defaultAgents = [
          {
            id: 'research-agent',
            name: 'Research Agent',
            description: 'Gathers and analyzes data',
            systemPrompt: `You are a research specialist. Gather comprehensive information on topics.

You have access to tools to help complete tasks:
- readFile: Read files from the outputs directory
- writeFile: Save findings to files
- analyzeData: Analyze CSV/JSON data and compute statistics
- listFiles: See what files are available
- generateReport: Create formatted reports

Use [TOOL_CALL: toolName({"param": "value"})] syntax to call tools.`,
            modelId: 'gpt-4o-mini',
            capabilities: ['data_research', 'analysis'],
            outputFormat: 'text',
          },
          {
            id: 'planning-agent',
            name: 'Planning Agent',
            description: 'Creates plans and strategies',
            systemPrompt: `You are a planning expert. Create detailed, actionable plans.

You have access to tools:
- writeFile: Document plans and strategies
- generateReport: Create formatted plans
- readFile: Reference existing documents

Use [TOOL_CALL: toolName({"param": "value"})] syntax to call tools.`,
            modelId: 'gpt-4o-mini',
            capabilities: ['planning', 'analysis'],
            outputFormat: 'text',
          },
          {
            id: 'document-agent',
            name: 'Document Agent',
            description: 'Formats and creates documents',
            systemPrompt: `You are a document creation specialist. Generate clear, well-structured, ready-to-save document content.

You have access to tools:
- writeFile: Save documents to outputs
- generateReport: Create formatted HTML or Markdown reports
- readFile: Reference existing documents

Use [TOOL_CALL: toolName({"param": "value"})] syntax to call tools.

Rules:
- Include a short title
- Separate paragraphs with blank lines
- Keep content professional and organized
- Use writeFile to save your work`,
            modelId: 'gpt-4o-mini',
            capabilities: ['document_generation', 'creative_writing'],
            outputFormat: 'document',
          },
        ];

        for (const agent of defaultAgents) {
          agentRegistry.registerAgent(agent.id, agent);
        }
      }

      // Get agents for this task
      const agentsForTask = agentRegistry.getAgentsForTask(userPrompt);
      selectedAgentIds = agentsForTask.map(a => a.id);

      if (selectedAgentIds.length === 0) {
        selectedAgentIds = ['research-agent', 'planning-agent', 'document-agent'];
      }
    }

    // Register agents if not already registered
    for (const agentId of selectedAgentIds) {
      if (!agentManager.getAgent(agentId)) {
        const registeredAgent = agentRegistry.getAgent(agentId);
        if (registeredAgent) {
          agentManager.registerAgent(agentId, registeredAgent);
        } else {
          agentManager.registerAgent(agentId, {
            name: agentId,
            modelId: 'gpt-4o-mini',
            role: 'specialist',
          });
        }
      }
    }

    // Analyze task
    const taskAnalysis = taskPlanner.analyzTask(userPrompt);
    sendEvent({
      type: 'task-analysis',
      data: taskAnalysis,
    });

    // Create workflow
    const workflowId = `workflow-${Date.now()}`;
    const workflow = agentManager.createWorkflow(workflowId, selectedAgentIds, mode);
    
    sendEvent({
      type: 'workflow-created',
      data: {
        workflowId,
        totalSteps: workflow.steps.length,
        agents: workflow.agents.map(a => ({ id: a.id, name: a.name })),
      },
    });

    // Helper function to call LLM with graceful fallbacks when quota is exceeded
    const callAgentHandler = async (config) => {
      const fallbackPriority = [
        config.modelId,
        'llama-3.3-70b-versatile',
        'deepseek-chat',
        'gemini-2.5-flash',
      ];

      const tried = [];
      let lastError;

      for (const candidate of [...new Set(fallbackPriority)]) {
        const modelConfig = MODEL_HANDLERS[candidate];
        if (!modelConfig) {
          continue;
        }

        const apiKey = process.env[modelConfig.envKey];
        if (!apiKey) {
          continue;
        }

        tried.push(candidate);

        try {
          return await modelConfig.handler({
            ...config,
            modelId: candidate,
            apiKey,
            baseUrl: modelConfig.baseUrl,
          });
        } catch (err) {
          lastError = err;
          const msg = err?.message?.toLowerCase?.() || '';
          const isQuotaOrRateLimit =
            msg.includes('quota') || msg.includes('insufficient_quota') || msg.includes('rate limit') || msg.includes('429');

          if (!isQuotaOrRateLimit) {
            // Non-quota errors should bubble up immediately
            throw err;
          }
        }
      }

      const triedStr = tried.length ? ` Tried: ${tried.join(', ')}` : '';
      throw lastError || new Error(`No available model or API key.${triedStr}`);
    };

    // Execute agents sequentially and stream results
    let currentInput = userPrompt;

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const agent = agentManager.getAgent(step.agentId);

      sendEvent({
        type: 'agent-start',
        data: {
          step: step.stepNumber,
          agent: agent.name,
          agentId: agent.id,
        },
      });

      try {
        // Build messages for this agent
        const messages = [
          {
            role: 'system',
            content: agent.systemPrompt ||
              `You are a ${agent.role} specialized in helping with tasks. Your role: ${step.agentName}`,
          },
          {
            role: 'user',
            content: currentInput,
          },
        ];

        // Call the agent
        const response = await callAgentHandler({
          modelId: agent.modelId,
          temperature: 0.3,
          messages,
        });

        // Normalize output shape (LLM handlers may return { reply })
        const output = response?.reply ?? response;

        if (typeof output !== 'string') {
          throw new Error('Document agent returned non-text output');
        }

        // Send agent response
        sendEvent({
          type: 'agent-response',
          data: {
            step: step.stepNumber,
            agent: agent.name,
            agentId: agent.id,
            output: output,
            timestamp: new Date().toISOString(),
          },
        });

        currentInput = output;
      } catch (error) {
        sendEvent({
          type: 'agent-error',
          data: {
            step: step.stepNumber,
            agent: agent.name,
            error: error.message,
          },
        });

        currentInput = `Previous agent failed. Continuing with: ${currentInput}`;
      }
    }

    // Send final result
    sendEvent({
      type: 'workflow-complete',
      data: {
        finalResult: currentInput,
        workflowId,
      },
    });

    // Check if output should be saved as a file
    const generatedFile = await detectAndGenerateFile(currentInput, userPrompt);
    if (generatedFile && generatedFile.success) {
      sendEvent({
        type: 'file-generated',
        data: {
          filename: generatedFile.filename,
          filepath: generatedFile.filepath,
          type: generatedFile.type,
          downloadUrl: `/api/generated-files/${generatedFile.filename}`,
          size: generatedFile.size,
        },
      });
    }

    res.end();
  } catch (error) {
    console.error('[STREAM_ORCHESTRATION_ERROR]', error);
    try {
      sendEvent({
        type: 'error',
        data: {
          error: error.message || 'Orchestration failed',
        },
      });
    } catch (sendError) {
      console.error('[SEND_EVENT_ERROR]', sendError);
    }
    res.end();
  }
});

/**
 * PROMPT VERSIONING & A/B TESTING ENDPOINTS
 */

// Create a new prompt version for an agent
app.post('/api/agents/:agentId/prompt-versions', async (req, res) => {
  try {
    const { agentId } = req.params;
    const version = await promptVersioning.createPromptVersion(agentId, req.body);
    res.json({ success: true, version });
  } catch (error) {
    console.error('[PROMPT_VERSION_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Get all prompt versions for an agent
app.get('/api/agents/:agentId/prompt-versions', async (req, res) => {
  try {
    const { agentId } = req.params;
    const versions = await promptVersioning.getPromptVersions(agentId);
    res.json({ success: true, versions });
  } catch (error) {
    console.error('[GET_VERSIONS_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Get a specific prompt version
app.get('/api/prompt-versions/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    const version = await promptVersioning.getPromptVersion(versionId);
    res.json({ success: true, version });
  } catch (error) {
    console.error('[GET_VERSION_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Update a prompt version
app.put('/api/prompt-versions/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    const updated = await promptVersioning.updatePromptVersion(versionId, req.body);
    res.json({ success: true, version: updated });
  } catch (error) {
    console.error('[UPDATE_VERSION_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete a prompt version
app.delete('/api/prompt-versions/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    await promptVersioning.deletePromptVersion(versionId);
    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE_VERSION_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Create an A/B test session
app.post('/api/agents/:agentId/a-b-tests', async (req, res) => {
  try {
    const { agentId } = req.params;
    const session = await promptVersioning.createABTestSession(agentId, req.body);
    res.json({ success: true, session });
  } catch (error) {
    console.error('[CREATE_AB_TEST_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Get A/B test sessions for an agent
app.get('/api/agents/:agentId/a-b-tests', async (req, res) => {
  try {
    const { agentId } = req.params;
    const sessions = await promptVersioning.getABTestSessions(agentId);
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('[GET_AB_TESTS_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Get A/B test details
app.get('/api/a-b-tests/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await promptVersioning.getABTestSessionDetails(sessionId);
    res.json({ success: true, session });
  } catch (error) {
    console.error('[GET_AB_TEST_DETAILS_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Record A/B test result
app.post('/api/a-b-tests/:sessionId/results', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { agentId, versionId, userPrompt, agentResponse, responseTimeMs } = req.body;
    
    const result = await promptVersioning.recordTestResult(
      sessionId,
      agentId,
      versionId,
      {
        user_prompt: userPrompt,
        agent_response: agentResponse,
        response_time_ms: responseTimeMs,
      }
    );
    res.json({ success: true, result });
  } catch (error) {
    console.error('[RECORD_TEST_RESULT_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Rate a response
app.post('/api/agents/:agentId/rate-response', async (req, res) => {
  try {
    const { agentId } = req.params;
    const rating = await promptVersioning.rateResponse(agentId, req.body);
    res.json({ success: true, rating });
  } catch (error) {
    console.error('[RATE_RESPONSE_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Get A/B test statistics
app.get('/api/a-b-tests/:sessionId/statistics', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = await promptVersioning.getTestStatistics(sessionId);
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error('[GET_STATS_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// End an A/B test
app.post('/api/a-b-tests/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await promptVersioning.endABTest(sessionId);
    res.json({ success: true, session });
  } catch (error) {
    console.error('[END_AB_TEST_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Generate improvement suggestions
app.post('/api/prompt-versions/:versionId/suggestions', async (req, res) => {
  try {
    const { versionId } = req.params;
    const suggestions = await promptVersioning.generateImprovementSuggestions(versionId);
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('[GENERATE_SUGGESTIONS_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

// Get improvement suggestions
app.get('/api/prompt-versions/:versionId/suggestions', async (req, res) => {
  try {
    const { versionId } = req.params;
    const suggestions = await promptVersioning.getImprovementSuggestions(versionId);
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('[GET_SUGGESTIONS_ERROR]', error);
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Agent Builder API running on http://localhost:${PORT}`);
});

/**
 * Autonomous Task Execution Endpoint
 * System automatically determines needed agents and generates output
 */
app.post('/api/autonomous-task', async (req, res) => {
  const { taskDescription, outputFormat = 'document', userId = null } = req.body || {};

  if (!taskDescription || typeof taskDescription !== 'string') {
    return res.status(400).json({ error: 'taskDescription is required' });
  }

  try {
    // Step 1: Register default agents if not already registered
    if (agentRegistry.getAllAgents().length === 0) {
      const defaultAgents = [
        {
          id: 'research-agent',
          name: 'Research Agent',
          description: 'Gathers and analyzes data',
          systemPrompt: 'You are a research specialist. Gather comprehensive information on topics.',
          modelId: 'gpt-4o-mini',
          capabilities: ['data_research', 'analysis'],
          outputFormat: 'text',
        },
        {
          id: 'planning-agent',
          name: 'Planning Agent',
          description: 'Creates plans and strategies',
          systemPrompt: 'You are a planning expert. Create detailed, actionable plans.',
          modelId: 'gpt-4o-mini',
          capabilities: ['planning', 'analysis'],
          outputFormat: 'text',
        },
        {
          id: 'document-agent',
          name: 'Document Agent',
          description: 'Formats and creates documents',
          systemPrompt: `You are a document creation specialist. Generate clear, well-structured, ready-to-save document content.

Rules:
- Output only document body text (no markdown fences or JSON).
- Include a short title on the first line.
- Separate paragraphs with blank lines.
- If user implies a filename, mention it as: filename: <safe_name>.
- Avoid links to non-existent URLs. If unsure, omit links.
- Keep it concise and professional.
`,
          modelId: 'gpt-4o-mini',
          capabilities: ['document_generation', 'creative_writing'],
          outputFormat: 'document',
        },
        {
          id: 'data-processor',
          name: 'Data Processor',
          description: 'Processes and transforms data',
          systemPrompt: 'You are a data processing specialist. Process data accurately and efficiently.',
          modelId: 'gpt-4o-mini',
          capabilities: ['data_processing', 'analysis'],
          outputFormat: 'json',
        },
        {
          id: 'code-agent',
          name: 'Code Agent',
          description: 'Writes and generates code',
          systemPrompt: 'You are a code generation specialist. Write clean, well-documented code.',
          modelId: 'gpt-4o-mini',
          capabilities: ['code_generation'],
          outputFormat: 'code',
        },
        {
          id: 'qa-agent',
          name: 'QA Agent',
          description: 'Reviews and validates output',
          systemPrompt: 'You are a quality assurance specialist. Review and validate the output quality.',
          modelId: 'gpt-4o-mini',
          capabilities: ['quality_assurance', 'analysis'],
          outputFormat: 'text',
        },
      ];

      for (const agent of defaultAgents) {
        agentRegistry.registerAgent(agent.id, agent);
      }
    }

    // Helper function to call LLM with graceful fallbacks when quota is exceeded
    const callAgentHandler = async (config) => {
      const fallbackPriority = [
        config.modelId,
        'llama-3.3-70b-versatile',
        'deepseek-chat',
        'gemini-2.5-flash',
      ];

      const tried = [];
      let lastError;

      for (const candidate of [...new Set(fallbackPriority)]) {
        const modelConfig = MODEL_HANDLERS[candidate];
        if (!modelConfig) {
          continue;
        }

        const apiKey = process.env[modelConfig.envKey];
        if (!apiKey) {
          continue;
        }

        tried.push(candidate);

        try {
          return await modelConfig.handler({
            ...config,
            modelId: candidate,
            apiKey,
            baseUrl: modelConfig.baseUrl,
          });
        } catch (err) {
          lastError = err;
          const msg = err?.message?.toLowerCase?.() || '';
          const isQuotaOrRateLimit =
            msg.includes('quota') || msg.includes('insufficient_quota') || msg.includes('rate limit') || msg.includes('429');

          if (!isQuotaOrRateLimit) {
            // Non-quota errors should bubble up immediately
            throw err;
          }
        }
      }

      const triedStr = tried.length ? ` Tried: ${tried.join(', ')}` : '';
      throw lastError || new Error(`No available model or API key.${triedStr}`);
    };

    // Execute the autonomous task
    const result = await agentManager.executeAutonomousTask(
      taskDescription,
      callAgentHandler
    );

    // Generate output document if requested
    let documentResult = null;
    if (result.finalResult && outputFormat && outputFormat !== 'none') {
      try {
        const docFilename = `task-output-${result.taskId}.${getFileExtension(outputFormat)}`;
        documentResult = await outputGenerators.generateDocument(
          result.finalResult,
          outputFormat,
          docFilename
        );
      } catch (docError) {
        console.warn('Document generation failed:', docError.message);
      }
    }

    res.json({
      success: true,
      result,
      document: documentResult,
    });

    // Persist lightweight history entry for quick reuse
    const safeSummary = result?.finalResult
      ? result.finalResult.slice(0, 600)
      : null;

    historyStore.addEntry({
      id: result?.taskId,
      taskDescription,
      outputFormat,
      summary: safeSummary,
      document: documentResult?.filename || null,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('[AUTONOMOUS_TASK_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Autonomous task execution failed',
    });
  }
});

// Autonomous task history - list
app.get('/api/autonomous-history', (_req, res) => {
  const entries = historyStore.listEntries(20);
  res.json({ entries });
});

// Autonomous task history - single entry
app.get('/api/autonomous-history/:id', (req, res) => {
  const entry = historyStore.getEntry(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'History item not found' });
  }
  res.json({ entry });
});

/**
 * Get generated file
 */
app.get('/api/generated-files/:filename', async (req, res) => {
  try {
    const file = outputGenerators.getFile(req.params.filename);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', getContentType(file.filename));
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.content);
  } catch (error) {
    console.error('[FILE_DOWNLOAD_ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * List generated files
 */
app.get('/api/generated-files', async (req, res) => {
  try {
    const files = outputGenerators.listFiles();
    res.json({ files });
  } catch (error) {
    console.error('[LIST_FILES_ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate file on demand from AI output
 */
app.post('/api/generate-file', async (req, res) => {
  try {
    const { content, format = 'text', filename } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await outputGenerators.generateDocument(content, format, filename);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      file: result,
      downloadUrl: `/api/generated-files/${result.filename}`,
    });
  } catch (error) {
    console.error('[GENERATE_FILE_ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Detect if output should be saved as a file and generate it
 */
async function detectAndGenerateFile(agentOutput, userPrompt) {
  try {
    // Keywords to detect file generation requests
    const fileKeywords = {
      word: [
        'word document',
        'create document',
        'write document',
        'document',
        'doc',
        'report',
        '.docx',
        'word doc',
      ],
      image: ['generate image', 'create image', 'draw image', 'image of', 'picture of', 'png', 'jpg'],
      pdf: ['pdf document', 'create pdf', 'pdf file', '.pdf'],
      csv: ['csv file', 'spreadsheet', 'data file', 'export data', '.csv'],
      html: ['html page', 'web page', 'html file', '.html'],
      json: ['json data', 'json file', 'json format', '.json'],
      markdown: ['markdown', 'readme', '.md'],
    };

    const lowerPrompt = userPrompt.toLowerCase();
    const lowerOutput = agentOutput.toLowerCase();

    let detectedFormat = null;

    // Check prompt for file type hints
    for (const [format, keywords] of Object.entries(fileKeywords)) {
      if (keywords.some(kw => lowerPrompt.includes(kw))) {
        detectedFormat = format;
        break;
      }
    }

    // If no format detected in prompt, check output
    if (!detectedFormat) {
      for (const [format, keywords] of Object.entries(fileKeywords)) {
        if (keywords.some(kw => lowerOutput.includes(kw))) {
          detectedFormat = format;
          break;
        }
      }
    }

    // Generate file if format detected
    if (detectedFormat) {
      let filename = null;

      // Try to extract filename from output
      const filenameMatch = agentOutput.match(/filename[:\s]+([^\n]+)/i) ||
                           agentOutput.match(/name[:\s]+([^\n]+)/i);
      if (filenameMatch) {
        filename = filenameMatch[1].trim().replace(/[^a-zA-Z0-9._-]/g, '');
      }

      return await outputGenerators.generateDocument(agentOutput, detectedFormat, filename);
    }

    return null;
  } catch (error) {
    console.error('[DETECT_FILE_ERROR]', error);
    return null;
  }
}

/**
 * Helper: Get file extension from format
 */
function getFileExtension(format) {
  const extensions = {
    word: 'docx',
    docx: 'docx',
    pdf: 'pdf',
    html: 'html',
    markdown: 'md',
    md: 'md',
    json: 'json',
    text: 'txt',
    txt: 'txt',
  };
  return extensions[format.toLowerCase()] || 'txt';
}

/**
 * Helper: Get content type from filename
 */
function getContentType(filename) {
  const types = {
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pdf': 'application/pdf',
    '.html': 'text/html',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.txt': 'text/plain',
  };
  const ext = filename.substring(filename.lastIndexOf('.'));
  return types[ext] || 'application/octet-stream';
}

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

function sanitizeFilename(filename = 'file.bin') {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'file.bin';
}

async function buildAttachmentMessages(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return [];
  }

  const limited = attachments.slice(0, MAX_ATTACHMENT_COUNT);
  const docMessages = [];

  for (const raw of limited) {
    const attachment = normalizeAttachmentRecord(raw);
    if (!attachment) {
      continue;
    }

    try {
      const text = await fetchAttachmentContent(attachment);
      if (!text) {
        continue;
      }
      const label = attachment.name || attachment.path || attachment.url || 'reference document';
      docMessages.push({
        role: 'system',
        content: `Reference document "${label}":\n${text}`,
      });
    } catch (error) {
      console.warn('[ATTACHMENT_SKIP]', error.message);
    }
  }

  return docMessages;
}

function normalizeAttachmentRecord(record) {
  if (!record) {
    return null;
  }
  if (typeof record === 'string') {
    return { name: record, path: record };
  }

  return {
    name: record.name || record.originalName || record.path || record.url || 'attachment',
    path: record.path || null,
    bucket: record.bucket || null,
    url: record.url || null,
  };
}

async function fetchAttachmentContent(attachment) {
  if (attachment.path && s3Client && hasStorageConfig) {
    const bucket = attachment.bucket || storageBucket;
    const object = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: attachment.path,
      }),
    );
    const { text, truncated } = await streamToText(object.Body, MAX_ATTACHMENT_BYTES);
    if (!text) {
      return null;
    }
    return truncated ? `${text}\n\n[Truncated for model input]` : text;
  }

  if (attachment.url) {
    const response = await fetch(attachment.url);
    if (!response.ok) {
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const truncated = buffer.length > MAX_ATTACHMENT_BYTES;
    const slice = truncated ? buffer.subarray(0, MAX_ATTACHMENT_BYTES) : buffer;
    const text = slice.toString('utf8');
    return truncated ? `${text}\n\n[Truncated for model input]` : text;
  }

  return null;
}

async function streamToText(body, limitBytes) {
  if (!body) {
    return { text: '', truncated: false };
  }

  const chunks = [];
  let total = 0;
  let truncated = false;

  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limitBytes) {
      const available = limitBytes - (total - buffer.length);
      if (available > 0) {
        chunks.push(buffer.subarray(0, available));
      }
      truncated = true;
      break;
    }
    chunks.push(buffer);
  }

  return {
    text: Buffer.concat(chunks).toString('utf8'),
    truncated,
  };
}

/**
 * CONVERSATION MEMORY ENDPOINTS
 */

/**
 * Save a conversation
 */
app.post('/api/conversations/save', async (req, res) => {
  try {
    const { userId, agentId, messages, summary, tags } = req.body;

    if (!userId || !agentId || !messages) {
      return res.status(400).json({ error: 'userId, agentId, and messages are required' });
    }

    const result = await conversationMemory.saveConversation(userId, agentId, messages, {
      summary,
      tags,
    });

    if (!result) {
      return res.status(500).json({ error: 'Failed to save conversation' });
    }

    res.json({ success: true, conversation: result });
  } catch (error) {
    console.error('[SAVE_CONVERSATION_ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get conversations for a user/agent
 */
app.get('/api/conversations', async (req, res) => {
  try {
    const { userId, agentId, limit = 50 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const conversations = await conversationMemory.getConversations(userId, agentId, parseInt(limit));

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('[GET_CONVERSATIONS_ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific conversation with all messages
 */
app.get('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    const conversation = await conversationMemory.getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true, conversation });
  } catch (error) {
    console.error('[GET_CONVERSATION_ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent context for agent memory
 */
app.get('/api/conversations/context/:userId/:agentId', async (req, res) => {
  try {
    const { userId, agentId } = req.params;
    const { limit = 10 } = req.query;

    if (!userId || !agentId) {
      return res.status(400).json({ error: 'userId and agentId are required' });
    }

    const context = await conversationMemory.getRecentContext(userId, agentId, parseInt(limit));

    res.json({ success: true, context });
  } catch (error) {
    console.error('[GET_CONTEXT_ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a conversation
 */
app.delete('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    const success = await conversationMemory.deleteConversation(conversationId);

    if (!success) {
      return res.status(500).json({ error: 'Failed to delete conversation' });
    }

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    console.error('[DELETE_CONVERSATION_ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search conversations
 */
app.get('/api/conversations/search/:userId/:agentId', async (req, res) => {
  try {
    const { userId, agentId } = req.params;
    const { keyword } = req.query;

    if (!userId || !agentId || !keyword) {
      return res.status(400).json({ error: 'userId, agentId, and keyword are required' });
    }

    const results = await conversationMemory.searchConversations(userId, agentId, keyword);

    res.json({ success: true, results });
  } catch (error) {
    console.error('[SEARCH_CONVERSATIONS_ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

