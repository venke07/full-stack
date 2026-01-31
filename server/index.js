import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import multer from 'multer';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
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
import knowledgeRoutes from './routes/knowledgeRoutes.js';

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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const analyticsSupabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
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
 * Flow Canvas prompt-to-workflow endpoint
 */
app.post('/api/flow-canvas/generate', async (req, res) => {
  const { prompt, maxNodes = 6 } = req.body || {};
  const userPrompt = typeof prompt === 'string' ? prompt.trim() : '';

  if (!userPrompt) {
    return res.status(400).json({ success: false, error: 'Prompt is required.' });
  }

  const safeMax = Number.isFinite(Number(maxNodes))
    ? Math.min(Math.max(Math.floor(Number(maxNodes)), 3), 10)
    : 6;

  try {
    const result = await generateFlowCanvasWorkflow(userPrompt, safeMax);
    res.json({
      success: true,
      workflow: result.workflow,
      source: result.source,
      warning: result.warning || null,
    });
  } catch (error) {
    console.error('[FLOW_CANVAS_ROUTE_ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to build workflow from prompt.',
    });
  }
});

app.post('/api/flow-canvas/replace-step', async (req, res) => {
  const { prompt, stepIndex, workflow } = req.body || {};
  const instruction = typeof prompt === 'string' ? prompt.trim() : '';
  const steps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  const index = Number(stepIndex);

  if (!instruction) {
    return res.status(400).json({ error: 'Replacement prompt is required.' });
  }
  if (!Number.isInteger(index) || index < 0 || index >= steps.length) {
    return res.status(400).json({ error: 'stepIndex is out of range.' });
  }

  try {
    const stepPlan = await attemptFlowCanvasStep(instruction, workflow, index);
    const normalized = normalizeFlowNode(stepPlan, index, steps.length);
    res.json({ success: true, step: normalized });
  } catch (error) {
    console.error('[FLOW_CANVAS_REPLACE_STEP_ERROR]', error);
    res.status(500).json({ error: error.message || 'Unable to replace step.' });
  }
});

app.post('/api/flow-canvas/explain', async (req, res) => {
  const { workflow } = req.body || {};
  const steps = Array.isArray(workflow?.steps) ? workflow.steps : [];

  if (!steps.length) {
    return res.status(400).json({ error: 'workflow with steps is required.' });
  }

  try {
    const explanation = await attemptFlowCanvasExplain(workflow);
    res.json({ success: true, explanation });
  } catch (error) {
    console.warn('[FLOW_CANVAS_EXPLAIN_FALLBACK]', error?.message || error);
    res.json({ success: true, explanation: buildFlowExplanation(workflow) });
  }
});

app.post('/api/flow-canvas/explain-step', async (req, res) => {
  const { step, index = 0, workflow } = req.body || {};
  if (!step || !step.title) {
    return res.status(400).json({ error: 'step is required.' });
  }

  try {
    const explanation = await attemptFlowCanvasExplainStep(step, index, workflow);
    res.json({ success: true, explanation });
  } catch (error) {
    console.warn('[FLOW_CANVAS_EXPLAIN_STEP_FALLBACK]', error?.message || error);
    res.json({
      success: true,
      explanation: `Step ${index + 1} (${step.kind || 'step'}) focuses on ${step.title}. ${step.detail || ''}`,
    });
  }
});

app.get('/api/marketplace/agents', async (req, res) => {
  if (!analyticsSupabase) {
    return res.status(500).json({ error: 'Supabase not configured.' });
  }

  const search = (req.query?.search || '').toString().trim().toLowerCase();
  const tagsRaw = (req.query?.tags || '').toString();
  const sort = (req.query?.sort || 'downloads').toString();
  const tagList = tagsRaw
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  try {
    const { data, error } = await analyticsSupabase
      .from('agent_personas')
      .select('*')
      .eq('status', 'published');

    if (error) {
      throw error;
    }

    let agents = Array.isArray(data) ? data : [];
    if (search) {
      agents = agents.filter((agent) => {
        const name = (agent.name || '').toString().toLowerCase();
        const description = (agent.description || '').toString().toLowerCase();
        return name.includes(search) || description.includes(search);
      });
    }
    if (tagList.length) {
      agents = agents.filter((agent) => {
        const tags = Array.isArray(agent.tags) ? agent.tags.map((t) => t.toString().toLowerCase()) : [];
        return tagList.every((tag) => tags.includes(tag));
      });
    }

    const normalized = agents.map((agent) => ({
      id: agent.id,
      name: agent.name || 'Untitled agent',
      description: agent.description || '',
      tags: Array.isArray(agent.tags) ? agent.tags : [],
      downloads: Number(agent.downloads || 0),
      fork_count: Number(agent.fork_count || 0),
      average_rating: Number(agent.average_rating || 0),
      ratings: Array.isArray(agent.ratings) ? agent.ratings : [],
      created_at: agent.created_at,
    }));

    normalized.sort((a, b) => {
      if (sort === 'rating') {
        return b.average_rating - a.average_rating;
      }
      if (sort === 'newest') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return b.downloads - a.downloads;
    });

    res.json({ success: true, agents: normalized });
  } catch (error) {
    console.error('[MARKETPLACE_AGENTS_ERROR]', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load marketplace agents.' });
  }
});

app.post('/api/marketplace/publish/:agentId', async (req, res) => {
  if (!analyticsSupabase) {
    return res.status(500).json({ error: 'Supabase not configured.' });
  }
  const { agentId } = req.params;
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.filter(Boolean) : [];

  try {
    const { data, error } = await analyticsSupabase
      .from('agent_personas')
      .update({ status: 'published', tags })
      .eq('id', agentId)
      .select('id')
      .single();

    if (error) throw error;
    res.json({ success: true, agentId: data?.id || agentId });
  } catch (error) {
    console.error('[MARKETPLACE_PUBLISH_ERROR]', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to publish agent.' });
  }
});

app.post('/api/marketplace/fork/:agentId', async (req, res) => {
  if (!analyticsSupabase) {
    return res.status(500).json({ error: 'Supabase not configured.' });
  }
  const { agentId } = req.params;
  const userId = req.body?.userId;
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required to fork.' });
  }

  try {
    const { data: source, error: sourceError } = await analyticsSupabase
      .from('agent_personas')
      .select('*')
      .eq('id', agentId)
      .single();

    if (sourceError) throw sourceError;
    if (!source) {
      return res.status(404).json({ success: false, error: 'Agent not found.' });
    }

    const forkPayload = {
      user_id: userId,
      name: `${source.name || 'Agent'} (fork)` ,
      description: source.description || '',
      system_prompt: source.system_prompt || '',
      guardrails: source.guardrails || null,
      sliders: source.sliders || null,
      tools: source.tools || null,
      files: source.files || null,
      model_id: source.model_id || null,
      model_label: source.model_label || null,
      model_provider: source.model_provider || null,
      model_env_key: source.model_env_key || null,
      status: 'draft',
      forked_from: agentId,
      collection: source.collection || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await analyticsSupabase
      .from('agent_personas')
      .insert(forkPayload)
      .select('id')
      .single();

    if (error) throw error;
    res.json({ success: true, forkedAgentId: data?.id });
  } catch (error) {
    console.error('[MARKETPLACE_FORK_ERROR]', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fork agent.' });
  }
});

app.post('/api/marketplace/rate/:agentId', async (req, res) => {
  if (!analyticsSupabase) {
    return res.status(500).json({ error: 'Supabase not configured.' });
  }
  const { agentId } = req.params;
  const rating = Number(req.body?.rating || 0);
  const review = (req.body?.review || '').toString();
  const userId = req.body?.userId;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required to rate.' });
  }

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: 'rating must be between 1 and 5.' });
  }

  try {
    const { data: agent, error: agentError } = await analyticsSupabase
      .from('agent_personas')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError) throw agentError;

    const existing = Array.isArray(agent?.ratings) ? agent.ratings : [];
    if (existing.some((entry) => entry?.user_id === userId)) {
      return res.status(409).json({ success: false, error: 'You already reviewed this agent.' });
    }
    const updated = [
      ...existing,
      { rating, review, user_id: userId, created_at: new Date().toISOString() },
    ];
    const average = updated.reduce((sum, item) => sum + Number(item.rating || 0), 0) / updated.length;

    const { error } = await analyticsSupabase
      .from('agent_personas')
      .update({ ratings: updated, average_rating: average })
      .eq('id', agentId);

    if (error) {
      return res.json({ success: true, warning: 'Ratings stored locally only.' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[MARKETPLACE_RATE_ERROR]', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to rate agent.' });
  }
});

/**
 * Orchestrated Multi-Agent Chat Endpoint
 * Agents work together in a coordinated workflow to complete complex tasks
 */
app.post('/api/orchestrated-chat', async (req, res) => {
  const { agentIds, agents = [], userPrompt, mode = 'sequential', autoMode = false } = req.body || {};

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
        // Try to get agent from provided agents array first
        const providedAgent = agents.find(a => a.id === agentId);
        if (providedAgent) {
          agentManager.registerAgent(agentId, {
            name: providedAgent.name,
            modelId: providedAgent.model_id || 'llama-3.3-70b-versatile',
            role: 'specialist',
            systemPrompt: providedAgent.system_prompt || '',
          });
        } else {
          const registeredAgent = agentRegistry.getAgent(agentId);
          if (registeredAgent) {
            agentManager.registerAgent(agentId, registeredAgent);
          } else {
            agentManager.registerAgent(agentId, {
              name: agentId,
              modelId: 'llama-3.3-70b-versatile',
              role: 'specialist',
            });
          }
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

    // Generate a single consolidated document from all agent outputs
    const generatedDocuments = [];
    if (result.agentOutputs && Object.keys(result.agentOutputs).length > 0) {
      try {
        // Combine all agent outputs into one document
        let consolidatedContent = '';
        for (const [agentName, output] of Object.entries(result.agentOutputs)) {
          consolidatedContent += `\n\n=== ${agentName} ===\n\n${output}`;
        }
        
        const docFilename = `${workflowId}-consolidated-report.docx`;
        const docResult = await outputGenerators.generateDocument(
          consolidatedContent.trim(), 
          'document', 
          docFilename
        );
        
        generatedDocuments.push({
          agent: 'All Agents',
          filename: docResult.filename,
          type: 'docx',
          downloadUrl: `/api/orchestrated-output/${docResult.filename}`,
        });
      } catch (err) {
        console.warn(`Failed to generate consolidated document:`, err.message);
      }
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
      documents: generatedDocuments,
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
 * Download orchestrated chat output document
 */
app.get('/api/orchestrated-output/:filename', (req, res) => {
  try {
    const file = outputGenerators.getFile(req.params.filename);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.download(file.filepath, file.filename);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
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

/**
 * Smart Agent Routing
 * Analyzes user query and ranks agents by relevance
 */
app.post('/api/smart-routing', async (req, res) => {
  const { userPrompt, availableAgents = [] } = req.body || {};

  if (!userPrompt || !Array.isArray(availableAgents)) {
    return res.status(400).json({ error: 'userPrompt and availableAgents array are required' });
  }

  try {
    const analysisPrompt = `You are an AI that intelligently routes queries to specialized agents.

Available agents:
${availableAgents.map((a, i) => `${i + 1}. ${a.name}: ${a.description}`).join('\n')}

User query: "${userPrompt}"

Analyze this query and rank the agents by relevance (1 = most relevant).
For each relevant agent, provide:
- agentId: the exact ID from the list
- relevance: 0-100% match score
- reason: brief explanation why this agent is good for this task

Return ONLY valid JSON with this format:
{
  "analysis": "Brief description of what the user is asking",
  "topAgents": [
    { "agentId": "id1", "relevance": 95, "reason": "explanation" },
    { "agentId": "id2", "relevance": 80, "reason": "explanation" }
  ]
}`;

    // Use Groq for routing analysis (fast and free) to avoid OpenAI quota issues
    const routingModelId = 'llama-3.3-70b-versatile';
    const routingConfig = MODEL_HANDLERS[routingModelId];
    if (!routingConfig) {
      throw new Error(`Unknown model: ${routingModelId}`);
    }
    const routingApiKey = process.env[routingConfig.envKey];
    if (!routingApiKey) {
      throw new Error(`Missing API key for ${routingModelId}`);
    }

    const response = await routingConfig.handler({
      modelId: routingModelId,
      apiKey: routingApiKey,
      temperature: 0.3,
      messages: [{ role: 'user', content: analysisPrompt }],
      baseUrl: routingConfig.baseUrl,
    });

    let parsedResult;
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      parsedResult = JSON.parse(jsonMatch ? jsonMatch[0] : response);
    } catch (e) {
      parsedResult = {
        analysis: response,
        topAgents: availableAgents.slice(0, 3).map((a, idx) => ({
          agentId: a.id,
          relevance: 100 - idx * 10,
          reason: 'General purpose agent',
        })),
      };
    }

    res.json({
      success: true,
      ...parsedResult,
    });
  } catch (error) {
    console.error('[SMART_ROUTING_ERROR]', error);
    res.status(500).json({ error: error.message || 'Smart routing failed' });
  }
});

/**
 * Debate Mode Orchestration
 * Agents discuss a topic, present arguments, and reach consensus
 */
app.post('/api/debate-mode', async (req, res) => {
  const { userPrompt, agentIds = [], agents = [] } = req.body || {};

  if (!userPrompt || agentIds.length < 2) {
    return res.status(400).json({ error: 'userPrompt and at least 2 agentIds are required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    // Step 1: Send analysis
    sendEvent('debate-start', {
      topic: userPrompt,
      agentCount: agentIds.length,
    });

    // Store agent positions
    const agentPositions = {};
    const agentResponses = {};

    // Step 2: Get initial positions from each agent
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agent = agents.find(a => a.id === agentId);
      
      if (!agent) continue;

      const positionPrompt = `${agent.system_prompt || `You are ${agent.name}.`}

The topic for discussion is: "${userPrompt}"

Please provide your initial position/argument on this topic. Be clear, concise, and compelling. Your response should be 2-3 paragraphs.`;

      try {
        const modelId = agent.model_id || 'gpt-4o-mini';
        const modelConfig = MODEL_HANDLERS[modelId];
        if (!modelConfig) {
          throw new Error(`Unknown model: ${modelId}`);
        }
        const apiKey = process.env[modelConfig.envKey];
        if (!apiKey) {
          throw new Error(`Missing API key for ${modelId}`);
        }

        const response = await modelConfig.handler({
          modelId,
          apiKey,
          temperature: 0.7,
          messages: [{ role: 'user', content: positionPrompt }],
          baseUrl: modelConfig.baseUrl,
        });

        agentResponses[agentId] = response;
        agentPositions[agentId] = 'initial';

        sendEvent('agent-position', {
          agentId,
          agentName: agent.name,
          position: response,
          stance: 'initial',
          step: i + 1,
          totalAgents: agentIds.length,
        });
      } catch (error) {
        sendEvent('agent-error', {
          agentId,
          agentName: agent.name || 'Unknown Agent',
          error: error.message,
        });
      }
    }

    // Step 3: Get rebuttals
    for (let i = 0; i < agentIds.length; i++) {
      const agentId = agentIds[i];
      const agent = agents.find(a => a.id === agentId);
      
      if (!agent) continue;

      // Build rebuttal context from other agents' positions
      const otherPositions = agentIds
        .filter(id => id !== agentId)
        .map(id => {
          const otherAgent = agents.find(a => a.id === id);
          return `**${otherAgent?.name || 'Agent'}:** ${agentResponses[id] || 'No response'}`;
        })
        .join('\n\n');

      const rebuttalPrompt = `${agent.system_prompt || `You are ${agent.name}.`}

The topic for discussion is: "${userPrompt}"

Your initial position was:
${agentResponses[agentId] || 'No initial response'}

Other agents have presented these views:
${otherPositions}

Now, please provide a rebuttal to at least one other agent's position. Do you agree with parts of their argument? Disagree? What additional points can you make? Keep it to 2-3 paragraphs.`;

      try {
        const modelId = agent.model_id || 'gpt-4o-mini';
        const modelConfig = MODEL_HANDLERS[modelId];
        if (!modelConfig) {
          throw new Error(`Unknown model: ${modelId}`);
        }
        const apiKey = process.env[modelConfig.envKey];
        if (!apiKey) {
          throw new Error(`Missing API key for ${modelId}`);
        }

        const rebuttal = await modelConfig.handler({
          modelId,
          apiKey,
          temperature: 0.7,
          messages: [{ role: 'user', content: rebuttalPrompt }],
          baseUrl: modelConfig.baseUrl,
        });

        agentResponses[`${agentId}-rebuttal`] = rebuttal;

        sendEvent('agent-rebuttal', {
          agentId,
          agentName: agent.name,
          rebuttal,
          step: agentIds.length + i + 1,
          totalSteps: agentIds.length * 2,
        });
      } catch (error) {
        sendEvent('agent-error', {
          agentId,
          agentName: agent.name || 'Unknown Agent',
          error: error.message,
        });
      }
    }

    // Step 4: Consensus analysis
    const consensusPrompt = `You are a neutral mediator analyzing a discussion on: "${userPrompt}"

Here are the positions presented:
${agentIds
  .map(id => {
    const agent = agents.find(a => a.id === id);
    return `**${agent?.name || 'Agent'}:**
Initial: ${agentResponses[id] || 'No response'}
Rebuttal: ${agentResponses[`${id}-rebuttal`] || 'No rebuttal'}`;
  })
  .join('\n\n')}

Analyze this discussion and provide:
1. Areas of agreement between agents (consensus points)
2. Remaining disagreements
3. A balanced conclusion or recommendation
4. Which agent made the strongest argument (and why)

Format your response as JSON:
{
  "consensusPoints": ["point1", "point2"],
  "disagreements": ["disagree1"],
  "conclusion": "balanced summary",
  "strongestArgument": { "agent": "agent name", "reason": "why" }
}`;

    // Use Groq for consensus (fast and free) to avoid OpenAI quota issues
    const consensusModelId = 'llama-3.3-70b-versatile';
    const consensusConfig = MODEL_HANDLERS[consensusModelId];
    if (!consensusConfig) {
      throw new Error(`Unknown model: ${consensusModelId}`);
    }
    const consensusApiKey = process.env[consensusConfig.envKey];
    if (!consensusApiKey) {
      throw new Error(`Missing API key for ${consensusModelId}`);
    }

    const consensusResult = await consensusConfig.handler({
      modelId: consensusModelId,
      apiKey: consensusApiKey,
      temperature: 0.5,
      messages: [{ role: 'user', content: consensusPrompt }],
      baseUrl: consensusConfig.baseUrl,
    });

    let consensus;
    try {
      const jsonMatch = consensusResult.match(/\{[\s\S]*\}/);
      consensus = JSON.parse(jsonMatch ? jsonMatch[0] : consensusResult);
    } catch (e) {
      consensus = {
        consensusPoints: ['Discussion completed'],
        disagreements: [],
        conclusion: consensusResult,
        strongestArgument: { agent: 'Multiple perspectives', reason: 'All agents contributed valuable insights' },
      };
    }

    sendEvent('consensus-reached', {
      ...consensus,
      agentsInvolved: agentIds.length,
    });

    sendEvent('debate-complete', {
      success: true,
      totalAgents: agentIds.length,
      consensus,
    });

    res.end();
  } catch (error) {
    console.error('[DEBATE_MODE_ERROR]', error);
    sendEvent('error', { error: error.message });
    res.end();
  }
});

// Register knowledge base routes
app.use('/api/knowledge', knowledgeRoutes);

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

const MIN_SUMMARY_MESSAGES = 6;
const SUMMARY_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'was', 'were', 'have', 'has',
  'had', 'not', 'but', 'can', 'could', 'should', 'would', 'will', 'just', 'into', 'about', 'what', 'when',
  'where', 'how', 'who', 'why', 'to', 'of', 'in', 'on', 'as', 'it', 'is', 'be', 'by', 'or', 'an', 'a',
]);
const POSITIVE_WORDS = ['great', 'good', 'helpful', 'thanks', 'thank', 'love', 'nice', 'awesome', 'perfect'];
const NEGATIVE_WORDS = ['bad', 'issue', 'problem', 'broken', 'error', 'fail', 'failed', 'sad', 'angry'];

function summarizeMessages(messages = []) {
  const cleaned = messages
    .map((m) => (m.content || m.text || '').toString().trim())
    .filter(Boolean);
  const allText = cleaned.join(' ');

  const userMessages = messages
    .filter((m) => m.role === 'user')
    .map((m) => (m.content || m.text || '').toString().trim())
    .filter(Boolean);

  const agentMessages = messages
    .filter((m) => m.role === 'agent' || m.role === 'assistant')
    .map((m) => (m.content || m.text || '').toString().trim())
    .filter(Boolean);

  const keyPoints = agentMessages
    .filter((msg) => !/^\s*(hello|hi|thanks|thank you|great question|i'm|i am)\b/i.test(msg))
    .filter((msg) => !/\?\s*$/.test(msg))
    .map((msg) => msg.replace(/\s+/g, ' ').trim())
    .filter((msg) => msg.length > 40)
    .slice(-3)
    .map((msg) => msg.slice(0, 160));
  const summaryText = (agentMessages[agentMessages.length - 1] || '')
    .slice(0, 220) || conversationMemory.generateSummary(messages);

  const wordCounts = {};
  allText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !SUMMARY_STOP_WORDS.has(w))
    .forEach((word) => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
  const topics = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  const actionItems = agentMessages
    .filter((msg) => /you should|please|next step|we should|recommended/i.test(msg))
    .slice(-3)
    .map((msg) => msg.slice(0, 140));

  const positiveHits = POSITIVE_WORDS.reduce((count, word) => count + (allText.toLowerCase().includes(word) ? 1 : 0), 0);
  const negativeHits = NEGATIVE_WORDS.reduce((count, word) => count + (allText.toLowerCase().includes(word) ? 1 : 0), 0);
  const sentiment = positiveHits > negativeHits ? 'Positive' : negativeHits > positiveHits ? 'Negative' : 'Neutral';

  return {
    keyPoints: keyPoints.length ? keyPoints : ['No key points identified'],
    summary: summaryText || 'No summary available',
    topics: topics.length ? topics : ['General'],
    actionItems: actionItems.length ? actionItems : ['No action items identified'],
    sentiment,
  };
}

const parseRangeStart = (range) => {
  if (!range || range === 'all') return null;
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : null;
  if (!days) return null;
  const start = new Date(now);
  start.setDate(now.getDate() - days);
  return start;
};

const safeNumber = (value) => (Number.isFinite(value) ? value : 0);

/**
 * Basic analytics aggregation from conversation history.
 */
async function buildAgentAnalytics({ userId, agentId, timeRange }) {
  const allConversations = await conversationMemory.getConversations(userId, agentId, 500);
  const rangeStart = parseRangeStart(timeRange);

  const current = rangeStart
    ? allConversations.filter((conv) => new Date(conv.created_at) >= rangeStart)
    : allConversations;

  const totalConversations = current.length;
  const totalMessages = current.reduce((sum, conv) => {
    const count = conv.message_count || (Array.isArray(conv.messages) ? conv.messages.length : 0);
    return sum + count;
  }, 0);
  const avgMessagesPerConvo = totalConversations ? totalMessages / totalConversations : 0;

  const hourCounts = {};
  const dayCounts = {};
  current.forEach((conv) => {
    const created = new Date(conv.created_at);
    if (Number.isNaN(created.getTime())) return;
    const hour = created.getHours();
    const day = created.toLocaleDateString('en-US', { weekday: 'long' });
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  const peakHours = Object.keys(hourCounts).length
    ? `${Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0]}:00`
    : 'N/A';
  const mostActiveDay = Object.keys(dayCounts).length
    ? Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]
    : 'N/A';

  let conversationGrowth = 0;
  if (rangeStart) {
    const prevStart = new Date(rangeStart);
    const prevEnd = new Date(rangeStart);
    const daysSpan = Math.max(1, Math.round((Date.now() - rangeStart.getTime()) / (24 * 3600 * 1000)));
    prevStart.setDate(prevStart.getDate() - daysSpan);
    const previous = allConversations.filter((conv) => {
      const created = new Date(conv.created_at);
      return created >= prevStart && created < prevEnd;
    });
    const prevCount = previous.length || 0;
    conversationGrowth = prevCount ? ((totalConversations - prevCount) / prevCount) * 100 : totalConversations ? 100 : 0;
  }

  let ratings = [];
  let testResults = [];
  if (analyticsSupabase) {
    const ratingQuery = analyticsSupabase
      .from('response_ratings')
      .select('rating, quality_score, relevance_score, helpfulness_score, created_at')
      .eq('agent_id', agentId);

    const testQuery = analyticsSupabase
      .from('a_b_test_results')
      .select('response_time_ms, created_at')
      .eq('agent_id', agentId);

    if (rangeStart) {
      ratingQuery.gte('created_at', rangeStart.toISOString());
      testQuery.gte('created_at', rangeStart.toISOString());
    }

    const ratingsRes = await ratingQuery;
    const testsRes = await testQuery;
    ratings = ratingsRes.data || [];
    testResults = testsRes.data || [];
  }

  const ratingCount = ratings.length;
  const avgRating = ratingCount
    ? ratings.reduce((sum, r) => sum + safeNumber(r.rating), 0) / ratingCount
    : null;
  const satisfactionRate = avgRating ? Math.round((avgRating / 5) * 100) : null;
  const positiveRatings = ratingCount
    ? Math.round((ratings.filter((r) => safeNumber(r.rating) >= 4).length / ratingCount) * 100)
    : 0;
  const negativeRatings = ratingCount
    ? Math.round((ratings.filter((r) => safeNumber(r.rating) <= 2).length / ratingCount) * 100)
    : 0;

  const qualityScores = ratings.map((r) => safeNumber(r.quality_score)).filter((v) => v > 0);
  const relevanceScores = ratings.map((r) => safeNumber(r.relevance_score)).filter((v) => v > 0);
  const helpfulnessScores = ratings.map((r) => safeNumber(r.helpfulness_score)).filter((v) => v > 0);

  const avgQualityScore = qualityScores.length
    ? qualityScores.reduce((sum, v) => sum + v, 0) / qualityScores.length
    : 0;
  const avgRelevanceScore = relevanceScores.length
    ? relevanceScores.reduce((sum, v) => sum + v, 0) / relevanceScores.length
    : 0;
  const avgHelpfulnessScore = helpfulnessScores.length
    ? helpfulnessScores.reduce((sum, v) => sum + v, 0) / helpfulnessScores.length
    : 0;

  const responseTimes = testResults.map((r) => safeNumber(r.response_time_ms)).filter((v) => v > 0);
  const avgResponseTime = responseTimes.length
    ? responseTimes.reduce((sum, v) => sum + v, 0) / responseTimes.length
    : null;

  return {
    totalConversations,
    conversationGrowth: Math.round(conversationGrowth),
    totalMessages,
    avgMessagesPerConvo,
    avgResponseTime,
    satisfactionRate,
    positiveRatings,
    negativeRatings,
    avgQualityScore,
    avgRelevanceScore,
    avgHelpfulnessScore,
    followUpRate: 0,
    avgEngagementTime: null,
    conversationContinuationRate: 0,
    rephrasedQuestionRate: 0,
    abTestResults: [],
    peakHours,
    mostActiveDay,
    avgSessionLength: null,
    totalUsers: 1,
  };
}

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
 * Summarize a conversation
 */
app.post('/api/conversations/summarize', async (req, res) => {
  try {
    const { messages, conversationId } = req.body;
    let resolvedMessages = messages;

    if (conversationId) {
      const stored = await conversationMemory.getConversation(conversationId);
      if (stored?.conversation_messages?.length) {
        resolvedMessages = stored.conversation_messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));
      } else if (Array.isArray(stored?.messages)) {
        resolvedMessages = stored.messages;
      }
    }

    if (!resolvedMessages || !Array.isArray(resolvedMessages)) {
      return res.status(400).json({ success: false, error: 'messages array is required' });
    }

    if (resolvedMessages.length < MIN_SUMMARY_MESSAGES) {
      return res.json({
        success: false,
        error: `Not enough messages to summarize (need at least ${MIN_SUMMARY_MESSAGES}).`,
      });
    }

    const summary = summarizeMessages(resolvedMessages);
    res.json({ success: true, summary });
  } catch (error) {
    console.error('[SUMMARIZE_CONVERSATION_ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Agent analytics
 */
app.get('/api/agents/:agentId/analytics', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { timeRange = '7d', userId } = req.query;

    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId is required' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const analytics = await buildAgentAnalytics({
      userId,
      agentId,
      timeRange,
    });

    res.json({ success: true, analytics });
  } catch (error) {
    console.error('[AGENT_ANALYTICS_ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
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

/**
 * Evolve agent - Generate improved version based on feedback
 */
app.post('/api/evolve-agent', async (req, res) => {
  try {
    const { agentId, currentPrompt, description, improvements, generation } = req.body;

    if (!currentPrompt || !improvements) {
      return res.status(400).json({ error: 'currentPrompt and improvements are required' });
    }

    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    
    // Function to generate mock evolution
    const generateMockEvolution = () => {
      const improvementSummary = improvements.substring(0, 60);
      return {
        system_prompt: `${currentPrompt}\n\n[EVOLVED v${generation}]\nImprovement applied: ${improvements}`,
        description: `${description} (Enhanced with: ${improvementSummary}...)`,
        sliders: {
          formality: Math.max(0, Math.min(100, 45 + (generation * 3))),
          creativity: Math.max(0, Math.min(100, 55 + (generation * 2))),
        },
        tools: {
          web: true,
          rfd: generation > 1,
          deep: generation > 2,
        },
      };
    };

    // If no API key, use mock evolution
    if (!apiKey) {
      console.log('[EVOLVE_AGENT] No OpenAI key configured, using mock evolution');
      return res.json(generateMockEvolution());
    }

    // Create evolution prompt
    const evolutionPrompt = `You are an AI agent architect. Your task is to evolve and improve an AI agent's system prompt based on user feedback.

Current System Prompt:
${currentPrompt}

Current Description:
${description}

Generation: ${generation}

User's Desired Improvements:
${improvements}

Please provide:
1. An improved system prompt that incorporates the requested improvements
2. A refined description (1-2 sentences)
3. Suggested slider values (formality: 0-100, creativity: 0-100)
4. Recommended tools (as a JSON object with boolean values)

Format your response as JSON with keys: system_prompt, description, sliders (object with formality and creativity), tools (object with web, rfd, deep boolean values)`;

    console.log('[EVOLVE_AGENT] Calling OpenAI API...');
    
    try {
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert AI agent architect. Respond with valid JSON only, no markdown formatting.',
            },
            {
              role: 'user',
              content: evolutionPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.error?.message || response.statusText;
        console.warn('[EVOLVE_AGENT] OpenAI API error, falling back to mock:', errorMsg);
        
        // Fall back to mock evolution on any API error
        return res.json(generateMockEvolution());
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      console.log('[EVOLVE_AGENT] OpenAI Response received');

      // Parse the JSON response
      let evolvedData;
      try {
        evolvedData = JSON.parse(content);
      } catch (e) {
        console.warn('[EVOLVE_AGENT] JSON parse failed, trying regex extraction');
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          evolvedData = JSON.parse(jsonMatch[0]);
        } else {
          console.warn('[EVOLVE_AGENT] Could not parse JSON response, using mock evolution');
          return res.json(generateMockEvolution());
        }
      }

      // Validate and sanitize the response
      const result = {
        system_prompt: evolvedData.system_prompt || currentPrompt,
        description: evolvedData.description || description,
        sliders: {
          formality: Math.max(0, Math.min(100, parseInt(evolvedData.sliders?.formality) || 50)),
          creativity: Math.max(0, Math.min(100, parseInt(evolvedData.sliders?.creativity) || 50)),
        },
        tools: {
          web: Boolean(evolvedData.tools?.web),
          rfd: Boolean(evolvedData.tools?.rfd),
          deep: Boolean(evolvedData.tools?.deep),
        },
      };

      console.log('[EVOLVE_AGENT] Evolution successful');
      res.json(result);
    } catch (apiError) {
      console.warn('[EVOLVE_AGENT] API call failed, using mock evolution:', apiError.message);
      // Fall back to mock evolution on any network/fetch error
      res.json(generateMockEvolution());
    }
  } catch (error) {
    console.error('[EVOLVE_AGENT_ERROR]', error.message);
    res.status(500).json({ error: error.message || 'Failed to evolve agent' });
  }
});

async function generateFlowCanvasWorkflow(prompt, maxNodes = 6) {
  try {
    const modelPlan = await attemptFlowCanvasModel(prompt, maxNodes);
    return {
      workflow: normalizeModelPlan(modelPlan, prompt, maxNodes),
      source: 'model',
    };
  } catch (error) {
    console.warn('[FLOW_CANVAS_MODEL_FALLBACK]', error.message || error);
    return {
      workflow: buildFallbackFlowPlan(prompt, maxNodes),
      source: 'fallback',
      warning: error.message || 'Model unavailable. Using heuristic workflow.',
    };
  }
}

async function attemptFlowCanvasModel(prompt, maxNodes = 6) {
  const messages = [
    {
      role: 'system',
      content: FLOW_CANVAS_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `User instructions:\n${prompt}\n\nGenerate between 3 and ${maxNodes} ordered nodes. Return JSON only.`,
    },
  ];

  const priority = FLOW_CANVAS_MODEL_PRIORITY;
  let lastError;

  for (const modelId of priority) {
    const handlerConfig = MODEL_HANDLERS[modelId];
    if (!handlerConfig) {
      continue;
    }

    const apiKey = process.env[handlerConfig.envKey];
    if (!apiKey) {
      continue;
    }

    try {
      const response = await handlerConfig.handler({
        modelId,
        apiKey,
        temperature: 0.2,
        messages,
        baseUrl: handlerConfig.baseUrl,
      });
      const text = (response?.reply || response || '').toString().trim();
      return extractFlowCanvasJson(text);
    } catch (error) {
      lastError = error;
      const message = error?.message?.toLowerCase?.() || '';
      const quotaIssue = message.includes('quota') || message.includes('rate limit') || message.includes('429');
      if (!quotaIssue) {
        throw error;
      }
    }
  }

  throw lastError || new Error('No model available for Flow Canvas generation.');
}

async function attemptFlowCanvasStep(prompt, workflow, stepIndex) {
  const stepLines = Array.isArray(workflow?.steps)
    ? workflow.steps.map((step, index) => `${index + 1}. ${step.title} (${step.kind}) - ${step.detail}`)
    : [];
  const messages = [
    { role: 'system', content: FLOW_CANVAS_STEP_PROMPT },
    {
      role: 'user',
      content: `Current workflow steps:\n${stepLines.join('\n') || 'No steps available.'}\n\nReplace step ${
        stepIndex + 1
      } with: ${prompt}\nReturn JSON only.`,
    },
  ];

  let lastError;
  for (const modelId of FLOW_CANVAS_MODEL_PRIORITY) {
    const handlerConfig = MODEL_HANDLERS[modelId];
    if (!handlerConfig) continue;
    const apiKey = process.env[handlerConfig.envKey];
    if (!apiKey) continue;

    try {
      const response = await handlerConfig.handler({
        modelId,
        apiKey,
        temperature: 0.3,
        messages,
        baseUrl: handlerConfig.baseUrl,
      });
      const text = (response?.reply || response || '').toString().trim();
      return extractFlowCanvasJson(text);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No model available to replace step.');
}

async function attemptFlowCanvasExplain(workflow) {
  const stepLines = Array.isArray(workflow?.steps)
    ? workflow.steps.map((step, index) => `${index + 1}. ${step.title} (${step.kind}) - ${step.detail}`)
    : [];
  const messages = [
    { role: 'system', content: FLOW_CANVAS_EXPLAIN_PROMPT },
    {
      role: 'user',
      content: `Prompt: ${workflow.prompt || 'N/A'}\nIntent: ${workflow.intentLabel || 'General'}\n\nSteps:\n${
        stepLines.join('\n') || 'No steps available.'
      }`,
    },
  ];

  let lastError;
  for (const modelId of FLOW_CANVAS_MODEL_PRIORITY) {
    const handlerConfig = MODEL_HANDLERS[modelId];
    if (!handlerConfig) continue;
    const apiKey = process.env[handlerConfig.envKey];
    if (!apiKey) continue;

    try {
      const response = await handlerConfig.handler({
        modelId,
        apiKey,
        temperature: 0.2,
        messages,
        baseUrl: handlerConfig.baseUrl,
      });
      const text = (response?.reply || response || '').toString().trim();
      if (text) {
        return text;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No model available to explain flow.');
}

async function attemptFlowCanvasExplainStep(step, index, workflow) {
  const flowIntent = workflow?.intentLabel || 'General';
  const messages = [
    { role: 'system', content: FLOW_CANVAS_EXPLAIN_STEP_PROMPT },
    {
      role: 'user',
      content: `Flow intent: ${flowIntent}\nStep ${index + 1}: ${step.title} (${step.kind || 'step'})\nDetails: ${
        step.detail || 'No detail'
      }`,
    },
  ];

  let lastError;
  for (const modelId of FLOW_CANVAS_MODEL_PRIORITY) {
    const handlerConfig = MODEL_HANDLERS[modelId];
    if (!handlerConfig) continue;
    const apiKey = process.env[handlerConfig.envKey];
    if (!apiKey) continue;

    try {
      const response = await handlerConfig.handler({
        modelId,
        apiKey,
        temperature: 0.2,
        messages,
        baseUrl: handlerConfig.baseUrl,
      });
      const text = (response?.reply || response || '').toString().trim();
      if (text) {
        return text;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No model available to explain node.');
}

function buildFlowExplanation(workflow) {
  const steps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  if (!steps.length) {
    return 'This flow has no steps yet.';
  }
  const titles = steps.map((step, index) => `Step ${index + 1}: ${step.title}`).join('. ');
  return `This workflow starts with ${steps[0].title}, routes through ${steps.length} total steps, and ends with ${
    steps[steps.length - 1].title
  }. ${titles}.`;
}

function extractFlowCanvasJson(rawText = '') {
  if (!rawText.trim()) {
    throw new Error('Model returned an empty response.');
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Model response did not include valid JSON.');
  }
}

function normalizeModelPlan(plan, prompt, maxNodes = 6) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Model response missing plan payload.');
  }

  const normalizedSteps = Array.isArray(plan.steps)
    ? plan.steps
        .filter(Boolean)
        .map((step, index, arr) => normalizeFlowNode(step, index, arr.length))
    : [];

  if (!normalizedSteps.length) {
    throw new Error('Model response did not include steps.');
  }

  const keywords = normalizeKeywords(plan.keywords, prompt);
  const paletteInfo = inferPaletteDetails(prompt, plan.palette, plan.intentLabel);
  const summary = Array.isArray(plan.summary) && plan.summary.length
    ? plan.summary.slice(0, 6).map((line) => line.toString().trim()).filter(Boolean)
    : buildSummaryFromSteps(prompt, normalizedSteps, paletteInfo.intentLabel, keywords);

  const withGuards = ensureEssentialNodes([...normalizedSteps], prompt);
  const limited = enforceStepBounds(withGuards, maxNodes);

  return finalizeWorkflowResponse({
    prompt,
    steps: limited,
    keywords,
    intentLabel: paletteInfo.intentLabel,
    palette: paletteInfo.palette,
    summary,
    segmentReference: normalizedSteps,
  });
}

function buildFallbackFlowPlan(prompt, maxNodes = 6) {
  const segments = parseSegments(prompt);
  const baseSegments = segments.length ? segments : [prompt || 'Listen for operator instructions and act.'];
  const trimmedSegments = baseSegments.slice(0, Math.max(maxNodes - 1, 3));
  const baseNodes = trimmedSegments.map((segment, index, arr) =>
    buildFlowNode(inferKind(segment, index, arr.length), segment, index),
  );
  const withGuards = ensureEssentialNodes(baseNodes, prompt);
  const limited = enforceStepBounds(withGuards, maxNodes);
  const keywords = normalizeKeywords(null, prompt);
  const paletteInfo = inferPaletteDetails(prompt);
  const summary = buildSummaryFromSegments(prompt, trimmedSegments, keywords, paletteInfo.intentLabel);

  return finalizeWorkflowResponse({
    prompt,
    steps: limited,
    keywords,
    intentLabel: paletteInfo.intentLabel,
    palette: paletteInfo.palette,
    summary,
    segmentReference: trimmedSegments,
  });
}

function finalizeWorkflowResponse({
  prompt,
  steps,
  keywords,
  intentLabel,
  palette,
  summary,
  segmentReference,
}) {
  return {
    prompt,
    palette,
    intentLabel,
    summary,
    steps,
    keywords,
    segmentCount: Array.isArray(segmentReference) ? segmentReference.length : steps.length,
    generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

function normalizeFlowNode(step = {}, index = 0, total = 1) {
  const segmentText = [step.detail, step.description, step.summary, step.title]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find((value) => value.length) || 'Process this instruction intelligently.';
  const inferredKind = inferKind(segmentText, index, total);
  const normalizedKind = normalizeKind(step.kind, inferredKind);
  const config = FLOW_KIND_CONFIG[normalizedKind];

  return {
    id: step.id || makeNodeId(normalizedKind, index),
    icon: step.icon || config.icon,
    title: truncateText(step.title || step.name || config.fallbackTitle, 80),
    detail: truncateText(step.detail || step.description || segmentText, 220),
    meta: step.meta || config.meta,
    kind: normalizedKind,
  };
}

function ensureEssentialNodes(steps = [], prompt = '') {
  const hasTrigger = steps.some((step) => step.kind === 'trigger');
  const hasAgent = steps.some((step) => step.kind === 'agent');
  const hasNotify = steps.some((step) => step.kind === 'notify');

  if (!hasTrigger) {
    steps.unshift(buildFlowNode('trigger', `Kick off when ${truncateText(prompt, 80)}`, steps.length));
  }
  if (!hasAgent) {
    steps.splice(1, 0, buildFlowNode('agent', 'Plan the workflow, pick tools, and enforce guardrails.', steps.length + 1));
  }
  if (!hasNotify) {
    steps.push(buildFlowNode('notify', 'Publish the outcome to stakeholders and log telemetry.', steps.length + 2));
  }

  return steps;
}

function enforceStepBounds(steps = [], maxNodes = 6) {
  const limit = Math.max(3, maxNodes);
  while (steps.length > limit) {
    const removableTool = steps.findIndex((step, index) => step.kind === 'tool' && index > 0 && index < steps.length - 1);
    if (removableTool > -1) {
      steps.splice(removableTool, 1);
      continue;
    }
    const removableAgent = steps.findIndex((step, index) => step.kind === 'agent' && index > 1 && index < steps.length - 1);
    if (removableAgent > -1) {
      steps.splice(removableAgent, 1);
      continue;
    }
    steps.pop();
  }
  return steps;
}

function buildFlowNode(kind, segment, seed) {
  const normalizedKind = normalizeKind(kind, typeof kind === 'string' ? kind : 'agent');
  const config = FLOW_KIND_CONFIG[normalizedKind];
  return {
    id: makeNodeId(normalizedKind, seed),
    icon: config.icon,
    title: truncateText(toTitleCase(segment).slice(0, 80) || config.fallbackTitle, 80),
    detail: truncateText(segment, 220),
    meta: config.meta,
    kind: normalizedKind,
  };
}

function normalizeKeywords(rawKeywords, prompt) {
  const bucket = [];

  if (Array.isArray(rawKeywords)) {
    for (const entry of rawKeywords) {
      if (typeof entry === 'string') {
        const label = entry.trim();
        if (label) {
          bucket.push({ id: slugifyLabel(label), label });
        }
        continue;
      }
      if (entry && typeof entry === 'object' && entry.label) {
        bucket.push({
          id: entry.id || slugifyLabel(entry.label),
          label: entry.label,
          reason: entry.reason || entry.context || '',
        });
      }
    }
  }

  const inferred = detectKeywords(prompt).map((entry) => ({ id: entry.id, label: entry.label }));
  const combined = [...bucket, ...inferred];

  const seen = new Set();
  return combined.filter((item) => {
    const key = (item.label || '').toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildSummaryFromSteps(prompt, steps, intentLabel, keywords) {
  const lines = steps.slice(0, 3).map((step, index) => `Step ${index + 1}: ${step.title} (${step.kind}).`);
  if (steps.length > 3) {
    lines.push(`+${steps.length - 3} more routed nodes auto-generated.`);
  }
  lines.push(`Intent detected: ${intentLabel}.`);
  lines.push(
    keywords.length
      ? `Channels/tools spotted: ${keywords.map((keyword) => keyword.label).join(', ')}.`
      : 'No explicit tools mentioned, default stack selected.',
  );
  lines.push(`Prompt focus: "${truncateText(prompt, 90)}"`);
  return lines;
}

function buildSummaryFromSegments(prompt, segments, keywords, intentLabel) {
  if (!segments.length) {
    return SUMMARY_FALLBACK;
  }

  const lines = segments.slice(0, 3).map((segment, index) => `Step ${index + 1}: ${segment}`);
  if (segments.length > 3) {
    lines.push(`+${segments.length - 3} more auto-generated actions derived from your prompt.`);
  }
  lines.push(`Intent detected: ${intentLabel}.`);
  lines.push(
    keywords.length
      ? `Channels/tools spotted: ${keywords.map((keyword) => keyword.label).join(', ')}.`
      : 'No explicit tools mentioned, default stack selected.',
  );
  lines.push(`Prompt focus: "${truncateText(prompt, 90)}"`);
  return lines;
}

function inferPaletteDetails(prompt, paletteHint, intentHint) {
  const normalized = (paletteHint || '').toString().toLowerCase();
  const intent = (intentHint || '').toString().trim();
  const paletteRuleFromHint = FLOW_PALETTE_RULES.find((rule) => rule.palette === normalized);
  if (paletteRuleFromHint) {
    return {
      palette: paletteRuleFromHint.palette,
      intentLabel: intent || paletteRuleFromHint.intent,
    };
  }

  const lowerPrompt = prompt.toLowerCase();
  const matchedRule = FLOW_PALETTE_RULES.find((rule) => rule.keywords.some((keyword) => lowerPrompt.includes(keyword)));
  if (matchedRule) {
    return {
      palette: matchedRule.palette,
      intentLabel: intent || matchedRule.intent,
    };
  }

  return {
    palette: 'slate',
    intentLabel: intent || 'General automation',
  };
}

function detectKeywords(prompt = '') {
  const lower = prompt.toLowerCase();
  return FLOW_KEYWORD_DICTIONARY.filter((entry) =>
    entry.tokens.some((token) => lower.includes(token)),
  );
}

function parseSegments(prompt = '') {
  return prompt
    .replace(/[\n\r]+/g, ' ')
    .split(/(?:\band then\b|\bthen\b|->|=>|\.|,|;|\band\b)/gi)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 2);
}

function inferKind(segment = '', index = 0, total = 1) {
  const lower = segment.toLowerCase();
  if (FLOW_TRIGGER_WORDS.some((word) => lower.startsWith(word) || lower.includes(` ${word}`)) || (index === 0 && total > 1)) {
    return 'trigger';
  }
  if (FLOW_OUTPUT_WORDS.some((word) => lower.includes(word)) || index === total - 1) {
    return 'notify';
  }
  if (FLOW_TOOL_WORDS.some((word) => lower.includes(word))) {
    return 'tool';
  }
  if (FLOW_AGENT_WORDS.some((word) => lower.includes(word))) {
    return 'agent';
  }
  return total <= 2 ? 'agent' : 'tool';
}

function normalizeKind(candidate, fallbackKind) {
  const normalized = (candidate || '').toString().toLowerCase();
  if (FLOW_KIND_CONFIG[normalized]) {
    return normalized;
  }
  const fallbackNormalized = (fallbackKind || '').toString().toLowerCase();
  if (FLOW_KIND_CONFIG[fallbackNormalized]) {
    return fallbackNormalized;
  }
  return 'agent';
}

function toTitleCase(text = '') {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function truncateText(value = '', limit = 120) {
  if (!value) {
    return '';
  }
  return value.length > limit ? `${value.slice(0, limit).trim()}…` : value;
}

function makeNodeId(kind, seed) {
  return `${kind}-${seed}-${Math.random().toString(16).slice(2)}`;
}

function slugifyLabel(label = '') {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'keyword';
}

const FLOW_TRIGGER_WORDS = ['when', 'whenever', 'if', 'upon', 'every', 'on ', 'after', 'once'];
const FLOW_AGENT_WORDS = ['analyze', 'plan', 'decide', 'triage', 'score', 'reason', 'diagnose', 'assess', 'brainstorm', 'research'];
const FLOW_TOOL_WORDS = ['call', 'run', 'execute', 'query', 'fetch', 'sync', 'api', 'request', 'webhook', 'lookup'];
const FLOW_OUTPUT_WORDS = ['send', 'notify', 'email', 'post', 'publish', 'share', 'update', 'broadcast', 'alert'];

const FLOW_KEYWORD_DICTIONARY = [
  { id: 'slack', label: 'Slack', tokens: ['slack', '#'] },
  { id: 'notion', label: 'Notion', tokens: ['notion'] },
  { id: 'pagerduty', label: 'PagerDuty', tokens: ['pagerduty', 'pd ', 'pager duty'] },
  { id: 'stripe', label: 'Stripe', tokens: ['stripe', 'payment', 'invoice', 'refund', 'charge'] },
  { id: 'email', label: 'Email', tokens: ['email', 'gmail', 'outlook'] },
  { id: 'statuspage', label: 'Statuspage', tokens: ['statuspage', 'status page'] },
  { id: 'jira', label: 'Jira', tokens: ['jira'] },
  { id: 'zendesk', label: 'Zendesk', tokens: ['zendesk', 'ticket'] },
  { id: 'github', label: 'GitHub', tokens: ['github', 'pull request', 'repo'] },
  { id: 'linear', label: 'Linear', tokens: ['linear', 'issue'] },
  { id: 'crm', label: 'CRM', tokens: ['hubspot', 'salesforce', 'crm'] },
];

const FLOW_PALETTE_RULES = [
  { palette: 'amber', keywords: ['refund', 'invoice', 'billing', 'payment', 'finance'], intent: 'Finance operations' },
  { palette: 'violet', keywords: ['incident', 'pagerduty', 'outage', 'uptime', 'statuspage', 'alert'], intent: 'Incident response' },
  { palette: 'teal', keywords: ['growth', 'newsletter', 'campaign', 'marketing', 'leads', 'email'], intent: 'Growth automation' },
  { palette: 'emerald', keywords: ['support', 'ticket', 'zendesk', 'customer', 'csat'], intent: 'Customer support' },
  { palette: 'rose', keywords: ['security', 'compliance', 'auth', 'risk'], intent: 'Security orchestration' },
  { palette: 'slate', keywords: [], intent: 'General automation' },
];

const FLOW_KIND_CONFIG = {
  trigger: { icon: '⚡', meta: 'Trigger', fallbackTitle: 'Signal Capture' },
  agent: { icon: '🤖', meta: 'Reasoner', fallbackTitle: 'Reasoning Agent' },
  tool: { icon: '🛠️', meta: 'Tool Chain', fallbackTitle: 'Tool Invocation' },
  notify: { icon: '📣', meta: 'Broadcast', fallbackTitle: 'Output & Telemetry' },
};

const SUMMARY_FALLBACK = [
  'Example: "Handle refunds over $500 and ping finance."',
  'Canvas stays empty until you generate nodes.',
  'AI wires triggers -> agents -> tools instantly.',
];

const FLOW_CANVAS_MODEL_PRIORITY = ['gemini-2.5-flash', 'gpt-4o-mini', 'llama-3.3-70b-versatile', 'deepseek-chat'];

const FLOW_CANVAS_SYSTEM_PROMPT = `You are a workflow architect who designs multi-node automations for operations teams.

Output ONLY valid JSON with the following shape:
{
  "intentLabel": "short label",
  "palette": "amber|violet|teal|emerald|rose|slate",
  "summary": ["sentence", ... up to 5],
  "keywords": [{"label": "Slack", "reason": "for updates"}],
  "steps": [
    {
      "kind": "trigger|agent|tool|notify",
      "title": "3-6 words",
      "detail": "specific one-sentence description",
      "meta": "Trigger" (etc),
      "icon": "emoji"
    }
  ]
}

Rules:
- Always include at least one trigger, one reasoning agent, and one notify/output node.
- Keep 3-7 steps total. Maintain logical order from left to right.
- Favor concrete tool descriptions when the user names systems.
- Never wrap the JSON in markdown fences.`;

const FLOW_CANVAS_STEP_PROMPT = `You are a workflow editor. Replace a single step in an automation flow.

Output ONLY valid JSON for a single step with the shape:
{
  "kind": "trigger|agent|tool|notify",
  "title": "3-6 words",
  "detail": "specific one-sentence description",
  "meta": "Trigger" (etc),
  "icon": "emoji"
}

Rules:
- Return only one step object, no arrays.
- Keep wording concise.
- Prefer tool/agent steps when the instruction mentions systems or actions.
- Never wrap the JSON in markdown fences.`;

const FLOW_CANVAS_EXPLAIN_PROMPT = `You explain a workflow to a product manager in 3-5 short sentences.
Mention how the flow starts, the key reasoning/tool steps, and how it ends. Keep it concise.`;

const FLOW_CANVAS_EXPLAIN_STEP_PROMPT = `You explain a single workflow node in 2-3 short sentences.
Describe what the step does, why it exists, and any tools/systems it touches. Keep it concise.`;

