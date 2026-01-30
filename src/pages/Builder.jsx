import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { modelOptions } from '../lib/modelOptions.js';
import TutorialLauncher from '../components/TutorialLauncher.jsx';
import PromptVersioning from '../components/PromptVersioning.jsx';
import ABTesting from '../components/ABTesting.jsx';
import ModelComparison from '../components/ModelComparison.jsx';

const sliderLabels = {
  formality: ['Casual', 'Balanced', 'Professional'],
  creativity: ['Factual', 'Balanced', 'Imaginative'],
};

const sliderDisplayNames = {
  formality: 'Formality',
  creativity: 'Creativity',
};

const personalityPresets = [
  {
    name: 'Professional',
    emoji: 'PR',
    formality: 85,
    creativity: 25,
    description: 'Formal, factual, business-focused',
  },
  {
    name: 'Friendly',
    emoji: 'FR',
    formality: 40,
    creativity: 60,
    description: 'Approachable, engaging, conversational',
  },
  {
    name: 'Creative',
    emoji: 'CR',
    formality: 30,
    creativity: 85,
    description: 'Imaginative, innovative, outside-the-box',
  },
  {
    name: 'Balanced',
    emoji: 'BL',
    formality: 50,
    creativity: 50,
    description: 'Neutral, versatile, adaptable',
  },
];

const systemPromptTemplates = {
  'customer-support': {
    name: 'Customer Support',
    emoji: 'CS',
    prompt: `You are a professional customer support specialist. Your role is to:
- Listen carefully to customer concerns with genuine empathy
- Provide clear, step-by-step solutions
- Maintain a friendly yet professional tone
- Ask clarifying questions when needed
- Offer proactive solutions
- Always end by asking if there's anything else you can help with
- Escalate complex issues appropriately

Focus on customer satisfaction and building long-term relationships.`,
  },
  'business-analyst': {
    name: 'Business Analyst',
    emoji: 'BA',
    prompt: `You are a strategic business analyst specializing in insights and reporting. Your expertise includes:
- Financial analysis and performance metrics
- Market research and competitive analysis
- Data visualization and trend identification
- Business strategy recommendations
- Risk assessment and mitigation
- Executive reporting and presentations

Always support recommendations with data and provide actionable insights.`,
  },
  'creative-writer': {
    name: 'Creative Writer',
    emoji: 'CW',
    prompt: `You are a talented creative writer skilled in multiple formats. Your strengths include:
- Engaging storytelling and narrative structure
- Content creation (blogs, social media, marketing copy)
- Adapting tone for different audiences
- Creative problem-solving through writing
- SEO optimization
- Compelling headlines and hooks

Ask about the target audience and goals before creating content.`,
  },
  'technical-expert': {
    name: 'Technical Expert',
    emoji: 'TE',
    prompt: `You are a highly skilled technical expert with deep knowledge across multiple domains. You provide:
- Clear explanations of complex technical concepts
- Code reviews and best practices
- Architecture design and optimization
- Troubleshooting and debugging assistance
- Best practices and industry standards
- Performance optimization recommendations

Always explain your reasoning and provide examples when helpful.`,
  },
  'research-analyst': {
    name: 'Research Analyst',
    emoji: 'RA',
    prompt: `You are a thorough research analyst specializing in gathering and synthesizing information. Your approach includes:
- Identifying credible sources and cross-referencing
- Analyzing trends and patterns in data
- Distinguishing facts from opinions
- Presenting findings with proper citations
- Highlighting limitations and uncertainties
- Providing actionable insights and recommendations

Structure findings clearly with methodology and conclusions.`,
  },
  'educational-tutor': {
    name: 'Educational Tutor',
    emoji: 'ET',
    prompt: `You are an effective educational tutor who makes learning engaging and accessible. Your teaching style includes:
- Breaking down complex topics into digestible parts
- Using relatable examples and analogies
- Asking questions to check understanding
- Encouraging critical thinking
- Adapting explanations to different learning styles
- Building confidence and motivation
- Providing constructive feedback

Always be patient, supportive, and enthusiastic about learning.`,
  },
};

const defaultChat = [
  {
    id: 'seed-agent',
    role: 'agent',
    text: "Hello! I'm your Business Analyst agent. I specialize in financial insights, market analysis, and business reporting. How can I assist you today?",
  },
  {
    id: 'seed-user',
    role: 'user',
    text: 'Summarize Q3 performance by product with key risks.',
  },
];

const initialForm = {
  name: '',
  description: '',
  prompt: '',
  guardrails: {
    factual: true,
    opinions: true,
  },
  sliders: {
    formality: 30,
    creativity: 45,
  },
  tools: {
    web: true,
    rfd: true,
    deep: false,
  },
  model: modelOptions[0].id,
  files: [],
};

const fileIconLookup = [
  { match: ['pdf', 'application/pdf'], icon: 'PDF' },
  { match: ['doc', 'docx', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], icon: 'DOC' },
  { match: ['ppt', 'pptx', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'], icon: 'PPT' },
  { match: ['xls', 'xlsx', 'csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'], icon: 'XLS' },
  { match: ['txt', 'md', 'text/plain', 'text/markdown'], icon: 'TXT' },
  { match: ['json', 'application/json'], icon: 'JSON' },
];

const resolveFileIcon = (name = '', contentType = '') => {
  const normalizedName = name.toLowerCase();
  const normalizedType = contentType.toLowerCase();
  const ext = normalizedName.includes('.') ? normalizedName.split('.').pop() : '';
  const hit = fileIconLookup.find(({ match }) =>
    match.some((token) => token === ext || normalizedType.includes(token)),
  );
  return hit?.icon || 'FILE';
};

const truncateFileLabel = (label = '') => {
  if (!label) return 'Attachment';
  return label.length > 30 ? `${label.slice(0, 27)}...` : label;
};

function Switch({ active, onToggle, label }) {
  return (
    <button
      type="button"
      className={`switch ${active ? 'active' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={label}
    />
  );
}

export default function BuilderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(initialForm);
  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [status, setStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [myAgents, setMyAgents] = useState([]);
  const [isFetchingAgents, setIsFetchingAgents] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(() => {
    // Restore selected agent from sessionStorage on mount
    return sessionStorage.getItem('selectedAgentId') || null;
  });
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const [supportsChatHistory, setSupportsChatHistory] = useState(true);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [agentAccessMap, setAgentAccessMap] = useState(new Map());
  const [builderTab, setBuilderTab] = useState('config'); // 'config', 'versions', 'testing', 'comparison'

  const descCount = form.description.length;

  const selectedModel = useMemo(
    () => modelOptions.find((option) => option.id === form.model) ?? modelOptions[0],
    [form.model],
  );

  const sliderBadge = (key) => {
    const value = form.sliders[key];
    if (value < 34) return sliderLabels[key][0];
    if (value < 67) return sliderLabels[key][1];
    return sliderLabels[key][2];
  };

  const personalitySnapshot = useMemo(
    () => ({
      formality: {
        value: form.sliders.formality,
        label: sliderBadge('formality'),
      },
      creativity: {
        value: form.sliders.creativity,
        label: sliderBadge('creativity'),
      },
    }),
    [form.sliders],
  );

  const compiledSystemPrompt = useMemo(() => {
    const sections = [];
    const trimmedName = form.name.trim();
    const trimmedDescription = form.description.trim();
    const trimmedPrompt = form.prompt.trim();

    if (trimmedName) {
      sections.push(`Identity: You are ${trimmedName}.`);
    }

    if (trimmedDescription) {
      sections.push(`Focus: ${trimmedDescription}`);
    }

    const guardrailLines = [];
    if (form.guardrails.factual) {
      guardrailLines.push('- Stay factual and avoid hallucinated data.');
    }
    if (form.guardrails.opinions) {
      guardrailLines.push('- Avoid personal opinions; remain objective.');
    }
    if (guardrailLines.length > 0) {
      sections.push(['Guardrails:', ...guardrailLines].join('\n'));
    }

    const personalityLines = Object.entries(personalitySnapshot).map(([key, snapshot]) =>
      `- ${sliderDisplayNames[key] || key}: ${snapshot.label} (${snapshot.value}/100)`,
    );
    sections.push(['Personality alignment:', ...personalityLines].join('\n'));

    const toolLines = [];
    if (form.tools.web) {
      toolLines.push('- Web Search: consult the web for fresher facts when needed.');
    }
    if (form.tools.rfd && form.files.length > 0) {
      toolLines.push(`- Retrieve-from-Documents: ground answers in ${form.files.length} uploaded source(s). Reference them when relevant.`);
    }
    if (form.tools.deep) {
      toolLines.push('- Deep Research: take multi-step reasoning when tasks are complex.');
    }
    if (toolLines.length > 0) {
      sections.push(['Available tools:', ...toolLines].join('\n'));
    }

    const fallbackInstruction = trimmedPrompt
      ? trimmedPrompt
      : trimmedDescription
        ? `Your core mission: ${trimmedDescription}`
        : 'Provide concise, accurate, and helpful answers.';

    sections.push(`Primary instructions: ${fallbackInstruction}`);

    return sections.join('\n\n').trim();
  }, [
    form.name,
    form.description,
    form.guardrails,
    form.prompt,
    form.tools,
    form.files,
    personalitySnapshot.formality,
    personalitySnapshot.creativity,
  ]);

  const dynamicIntro = useMemo(() => {
    if (!form.name && !form.description) {
      return 'Fill out the details to craft a bespoke greeting for your agent.';
    }
    const introName = form.name ? `I am ${form.name}.` : '';
    const introDesc = form.description ? `I focus on ${form.description.trim()}.` : '';
    return `${introName} ${introDesc}`.trim();
  }, [form.name, form.description]);

  const fullChat = useMemo(
    () => [
      ...defaultChat,
      { id: 'dynamic-intro', role: 'agent', text: dynamicIntro },
      ...chatLog,
    ],
    [dynamicIntro, chatLog],
  );

  const chatSummary = useMemo(() => {
    const recent = fullChat.slice(-4);
    return recent
      .map((bubble) => `${bubble.role === 'user' ? 'User' : 'Agent'}: ${bubble.text}`)
      .join(' | ');
  }, [fullChat]);

  const getMessagesForProvider = (latestUserMessage) => {
    const history = [...chatLog, { role: 'user', text: latestUserMessage }];
    const formattedHistory = history.map((entry) => ({
      role: entry.role === 'user' ? 'user' : 'assistant',
      content: entry.text,
    }));
    const systemBlock = compiledSystemPrompt
      ? [
          {
            role: 'system',
            content: compiledSystemPrompt,
          },
        ]
      : [];
    return [...systemBlock, ...formattedHistory];
  };

  const updateForm = (path, value) => {
    setForm((prev) => {
      if (path === 'files') {
        return { ...prev, files: value };
      }
      if (path.startsWith('guardrails.')) {
        const key = path.split('.')[1];
        return { ...prev, guardrails: { ...prev.guardrails, [key]: value } };
      }
      if (path.startsWith('sliders.')) {
        const key = path.split('.')[1];
        return { ...prev, sliders: { ...prev.sliders, [key]: value } };
      }
      if (path.startsWith('tools.')) {
        const key = path.split('.')[1];
        return { ...prev, tools: { ...prev.tools, [key]: value } };
      }
      return { ...prev, [path]: value };
    });
  };

  const handleFileUpload = async (event) => {
    const pickedFiles = Array.from(event.target.files || []);
    if (!pickedFiles.length) return;
    if (!user) {
      setStatus('Sign in to upload sources.');
      return;
    }

    setIsUploadingFile(true);
    const uploaded = [];

    for (const file of pickedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      try {
        const response = await fetch('/api/storage/files', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message = body.error || body.details || 'Upload failed.';
          throw new Error(message);
        }

        const payload = await response.json();
        uploaded.push({
          name: file.name,
          path: payload.path,
          bucket: payload.bucket,
          url: payload.url || null,
          size: payload.size,
          contentType: payload.contentType,
        });
      } catch (error) {
        console.error('File upload failed', error);
        setStatus(`Upload error for ${file.name}: ${error.message}`);
      }
    }

    if (uploaded.length) {
      setForm((prev) => ({ ...prev, files: [...prev.files, ...uploaded] }));
      setStatus(`Uploaded ${uploaded.length} file${uploaded.length > 1 ? 's' : ''}.`);
    }

    event.target.value = '';
    setIsUploadingFile(false);
  };

  const hydrateFormFromAgent = (record) => {
    setForm({
      name: record.name ?? '',
      description: record.description ?? '',
      prompt: record.system_prompt ?? '',
      guardrails: record.guardrails && typeof record.guardrails === 'object'
        ? record.guardrails
        : initialForm.guardrails,
      sliders: record.sliders && typeof record.sliders === 'object'
        ? record.sliders
        : initialForm.sliders,
      tools: record.tools && typeof record.tools === 'object' ? record.tools : initialForm.tools,
      files: Array.isArray(record.files)
        ? record.files.map((file) =>
            typeof file === 'string'
              ? { name: file, path: file }
              : file,
          )
        : [],
      model: record.model_id ?? initialForm.model,
    });
    const history = Array.isArray(record.chat_history) ? record.chat_history : [];
    setChatLog(history);
    setChatInput('');
  };

  const loadAgentsForUser = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMyAgents([]);
      setIsFetchingAgents(false);
      return;
    }

    setIsFetchingAgents(true);
    const ownedResponse = await supabase
      .from('agent_personas')
      .select('id, name, status, created_at, description, user_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const accessResponse = await supabase
      .from('agent_access')
      .select('agent_id, role')
      .eq('user_id', user.id);

    if (ownedResponse.error) {
      setStatus(`Load agents failed: ${ownedResponse.error.message}`);
      setMyAgents([]);
      setIsFetchingAgents(false);
      return;
    }

    const ownedAgents = (ownedResponse.data ?? []).map((agent) => ({
      ...agent,
      isShared: false,
      accessRole: 'owner',
    }));

    let sharedAgents = [];
    const accessMap = new Map();
    if (!accessResponse.error && accessResponse.data?.length) {
      accessResponse.data.forEach((row) => accessMap.set(row.agent_id, row.role));
      const sharedIds = accessResponse.data.map((row) => row.agent_id);
      const { data: sharedData, error: sharedError } = await supabase
        .from('agent_personas')
        .select('id, name, status, created_at, description, user_id')
        .in('id', sharedIds);

      if (!sharedError) {
        sharedAgents = (sharedData ?? [])
          .map((agent) => ({
            ...agent,
            isShared: true,
            accessRole: accessMap.get(agent.id) || 'viewer',
          }))
          .filter((agent) => agent.accessRole === 'editor');
      }
    }

    setAgentAccessMap(accessMap);
    setMyAgents([...ownedAgents, ...sharedAgents]);
    setIsFetchingAgents(false);
  }, [user?.id]);

  useEffect(() => {
    loadAgentsForUser();
  }, [loadAgentsForUser]);

  useEffect(() => {
    const preselectId = searchParams.get('agent');
    if (!preselectId || !myAgents.length) {
      return;
    }
    if (selectedAgentId === preselectId) {
      return;
    }
    const exists = myAgents.some((agent) => agent.id === preselectId);
    if (exists) {
      handleSelectAgent(preselectId);
    }
  }, [myAgents, searchParams, selectedAgentId]);

  useEffect(() => {
    try {
      const staged = sessionStorage.getItem('builderPrefill');
      if (!staged) {
        return;
      }
      const persona = JSON.parse(staged);
      setForm((prev) => ({
        ...prev,
        name: persona.name ?? prev.name,
        description: persona.mission ?? prev.description,
        prompt: persona.prompt ?? prev.prompt,
        guardrails: persona.guardrails
          ? { ...prev.guardrails, ...persona.guardrails }
          : prev.guardrails,
        sliders: persona.sliders ? { ...prev.sliders, ...persona.sliders } : prev.sliders,
      }));
      setStatus('Imported persona from Flow Canvas.');
    } catch (error) {
      console.warn('Failed to import persona from canvas', error);
    } finally {
      sessionStorage.removeItem('builderPrefill');
    }
  }, []);

  // Persist selectedAgentId to sessionStorage
  useEffect(() => {
    if (selectedAgentId) {
      sessionStorage.setItem('selectedAgentId', selectedAgentId);
    } else {
      sessionStorage.removeItem('selectedAgentId');
    }
  }, [selectedAgentId]);

  const agentSelectBase =
    'id, name, description, system_prompt, guardrails, sliders, tools, files, model_id';

  const handleSelectAgent = async (agentId) => {
    if (!supabase || !user?.id) {
      setStatus('Sign in to load agents.');
      return;
    }
    setIsLoadingAgent(true);
    setStatus('Loading agent…');
    const isSharedAgent = agentAccessMap.has(agentId);
    setStatus('Loading agent...');
    try {
      const selectFields = supportsChatHistory ? `${agentSelectBase}, chat_history` : agentSelectBase;
      let query = supabase
        .from('agent_personas')
        .select(selectFields)
        .eq('id', agentId);
      if (!isSharedAgent) {
        query = query.eq('user_id', user.id);
      }
      const { data, error } = await query.single();

      if (error) {
        if (supportsChatHistory && error.message?.toLowerCase().includes('chat_history')) {
          setSupportsChatHistory(false);
          setStatus('Chat history column missing. Loading without transcript…');
          let retryQuery = supabase
          setStatus('Chat history column missing. Loading without transcript...');
          const retry = await supabase
            .from('agent_personas')
            .select(agentSelectBase)
            .eq('id', agentId);
          if (!isSharedAgent) {
            retryQuery = retryQuery.eq('user_id', user.id);
          }
          const retry = await retryQuery.single();

          if (retry.error) {
            setStatus(`Load failed: ${retry.error.message}`);
          } else if (retry.data) {
            hydrateFormFromAgent(retry.data);
            setSelectedAgentId(agentId);
            setStatus(`Loaded ${retry.data.name || 'agent'}.`);
          }
        } else {
          setStatus(`Load failed: ${error.message}`);
        }
      } else if (data) {
        hydrateFormFromAgent(data);
        setSelectedAgentId(agentId);
        setStatus(`Loaded ${data.name || 'agent'}.`);
      }
    } catch (error) {
      setStatus(`Load failed: ${error.message}`);
    } finally {
      setIsLoadingAgent(false);
    }
  };

  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isResponding) return;

    const timestamp = Date.now();
    const messagesForProvider = getMessagesForProvider(trimmed);
    const userEntry = { id: `user-${timestamp}`, role: 'user', text: trimmed };
    setChatLog((prev) => [...prev, userEntry]);
    setChatInput('');
    setIsResponding(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.id,
          messages: messagesForProvider,
          temperature: 0.35,
          attachments: form.files,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Provider call failed');
      }

      const data = await response.json();
      setChatLog((prev) => [
        ...prev,
        { id: `agent-${timestamp}`, role: 'agent', text: data.reply },
      ]);
    } catch (error) {
      const fallback = error?.message || 'Provider error.';
      setChatLog((prev) => [
        ...prev,
        {
          id: `agent-${timestamp}`,
          role: 'agent',
          text: `Warning: ${fallback}`,
        },
      ]);
    } finally {
      setIsResponding(false);
    }
  };

  const payloadFromForm = (
    statusValue,
    { includeChatHistory = supportsChatHistory, includeOwnership = true } = {},
  ) => {
    const payload = {
      status: statusValue,
      name: form.name,
      description: form.description,
      system_prompt: form.prompt,
      guardrails: form.guardrails,
      sliders: form.sliders,
      personality: personalitySnapshot,
      tools: form.tools,
      files: form.files, // Now includes URLs and metadata
      model_id: selectedModel.id,
      model_label: selectedModel.label,
      model_provider: selectedModel.provider,
      model_env_key: selectedModel.envKey,
      chat_summary: chatSummary,
    };

    if (includeOwnership) {
      payload.user_id = user?.id ?? null;
      payload.created_at = new Date().toISOString();
    }

    if (includeChatHistory) {
      payload.chat_history = chatLog;
    }

    return payload;
  };

  const handleSave = async (statusValue) => {
    if (!supabase) {
      setStatus('Missing Supabase credentials. Add VITE_SUPABASE_ANON_KEY in .env.');
      return;
    }
    if (!user) {
      setStatus('Sign in before saving your agent.');
      return;
    }
    setIsSaving(true);
    setStatus('Saving...');
    try {
      const accessRole = selectedAgentId ? agentAccessMap.get(selectedAgentId) : null;
      const shouldUpdate = !!selectedAgentId && (!accessRole || accessRole === 'editor');

      const upsertWithConfig = (includeChatHistory) => {
        const payload = payloadFromForm(statusValue, {
          includeChatHistory,
          includeOwnership: !shouldUpdate,
        });

        if (shouldUpdate) {
          return supabase
            .from('agent_personas')
            .update(payload)
            .eq('id', selectedAgentId)
            .select()
            .single();
        }

        return supabase
          .from('agent_personas')
          .insert([payload])
          .select()
          .single();
      };

      let includeHistory = supportsChatHistory;
      let { data, error } = await upsertWithConfig(includeHistory);

      if (error && includeHistory && error.message?.toLowerCase().includes('chat_history')) {
        setSupportsChatHistory(false);
        setStatus('Chat history column missing. Saved without transcript.');
        ({ data, error } = await upsertWithConfig(false));
      }

      if (error) {
        setStatus(`Supabase error: ${error.message}`);
      } else {
        setStatus(
          shouldUpdate
            ? 'Agent updated successfully.'
            : `${statusValue === 'published' ? 'Published' : 'Draft saved'} successfully.`,
        );
        loadAgentsForUser();
        if (data?.id) {
          setSelectedAgentId(data.id);
        }
      }
    } catch (err) {
      setStatus(`Unexpected error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm(initialForm);
    setChatLog([]);
    setChatInput('');
    setStatus('Draft reset.');
  };

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Design Studio</p>
      <h1>Agent Builder</h1>
      <p className="dashboard-sub">Shape prompts, behaviours, and tooling before publishing.</p>
    </div>
  );

  const headerActions = (
    <div className="page-actions compact">
      <div className="chip-tray">
        <span className="status-chip subtle">Autosave enabled</span>
        <span className="status-chip subtle">{selectedAgentId ? 'Editing existing agent' : 'New draft'}</span>
      </div>
      <Link className="btn secondary" to="/canvas">
        Flow canvas
      </Link>
      <Link className="btn secondary" to="/chat">
        Launch chat
      </Link>
      <Link className="btn secondary" to="/home">
        Back to overview
      </Link>
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent} actions={headerActions}>
      {status && <div className="status-bar">{status}</div>}

      <div className="grid builder-grid">
        <div className="config-column">
          {/* Builder Tabs */}
          <div className="builder-tabs">
            <button
              className={`tab ${builderTab === 'config' ? 'active' : ''}`}
              onClick={() => setBuilderTab('config')}
            >
              Configuration
            </button>
            {selectedAgentId && (
              <>
                <button
                  className={`tab ${builderTab === 'versions' ? 'active' : ''}`}
                  onClick={() => setBuilderTab('versions')}
                >
                  Prompt Versions
                </button>
                <button
                  className={`tab ${builderTab === 'testing' ? 'active' : ''}`}
                  onClick={() => setBuilderTab('testing')}
                >
                  A/B Testing
                </button>
                <button
                  className={`tab ${builderTab === 'comparison' ? 'active' : ''}`}
                  onClick={() => setBuilderTab('comparison')}
                >
                  Model Comparison
                </button>
              </>
            )}
          </div>

          {/* Configuration Tab */}
          {builderTab === 'config' && (
            <>
          <section className="card">
            <div className="inner">
              <h3>Details</h3>
              <label htmlFor="agentName">Name</label>
              <input
                id="agentName"
                type="text"
                placeholder="e.g., Business Analyst"
                value={form.name}
                onChange={(e) => updateForm('name', e.target.value)}
              />

              <div className="spacer" />
              <label htmlFor="agentDesc">Description</label>
              <textarea
                id="agentDesc"
                maxLength={280}
                placeholder="What does this agent do? Who is it for?"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
              />
              <div className="hint row-split">
                <span>{descCount}/280</span>
                <span>Keep it concise.</span>
              </div>

              <div className="spacer" />
              <label htmlFor="agentPrompt">System Prompt</label>
              
              {/* System Prompt Templates */}
              <div style={{ marginBottom: '12px' }}>
                <select
                  onChange={(e) => {
                    if (e.target.value && systemPromptTemplates[e.target.value]) {
                      updateForm('prompt', systemPromptTemplates[e.target.value].prompt);
                      e.target.value = '';
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'inherit',
                    fontSize: '13px',
                    cursor: 'pointer',
                    marginBottom: '10px',
                  }}
                >
                  <option value="">Choose a template...</option>
                  {Object.entries(systemPromptTemplates).map(([key, template]) => (
                    <option key={key} value={key}>
                      {template.emoji} {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                id="agentPrompt"
                placeholder="Give high-level instructions that shape the agent's behaviour."
                value={form.prompt}
                onChange={(e) => updateForm('prompt', e.target.value)}
              />

              <div className="spacer" />
              <h3>Guardrails</h3>
              <div className="toggle">
                <span>Stay factual</span>
                <Switch
                  label="Stay factual"
                  active={form.guardrails.factual}
                  onToggle={() => updateForm('guardrails.factual', !form.guardrails.factual)}
                />
              </div>
              <div className="toggle">
                <span>Avoid personal opinions</span>
                <Switch
                  label="Avoid personal opinions"
                  active={form.guardrails.opinions}
                  onToggle={() => updateForm('guardrails.opinions', !form.guardrails.opinions)}
                />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="inner">
              <h3>Personality</h3>
              
              {/* Personality Presets */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--muted)', marginBottom: '10px', textTransform: 'uppercase' }}>Quick Presets</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
                  {personalityPresets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        updateForm('sliders.formality', preset.formality);
                        updateForm('sliders.creativity', preset.creativity);
                      }}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        color: 'inherit',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255, 255, 255, 0.03)';
                        e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                      }}
                    >
                      <span style={{ fontSize: '24px' }}>{preset.emoji}</span>
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divider" style={{ margin: '20px 0' }} />

              {/* Formality Slider */}
              <div className="metric">
                <b>Formality</b>
                <span className="badge" id="formalityBadge">
                  {sliderBadge('formality')} ({form.sliders.formality}/100)
                </span>
              </div>
              <input
                className="slider"
                id="formality"
                type="range"
                min="0"
                max="100"
                value={form.sliders.formality}
                onChange={(e) => updateForm('sliders.formality', Number(e.target.value))}
              />
              <div className="help">Casual to Professional</div>

              <div className="spacer" />

              {/* Creativity Slider */}
              <div className="metric">
                <b>Creativity</b>
                <span className="badge" id="creativityBadge">
                  {sliderBadge('creativity')} ({form.sliders.creativity}/100)
                </span>
              </div>
              <input
                className="slider"
                id="creativity"
                type="range"
                min="0"
                max="100"
                value={form.sliders.creativity}
                onChange={(e) => updateForm('sliders.creativity', Number(e.target.value))}
              />
              <div className="help">Factual to Imaginative</div>

              <div className="divider" />
              <h3>Tools</h3>
              <div className="tool">
                <div>
                  <b>Web Search</b>
                  <br />
                  <small>Let the agent search the web when needed.</small>
                </div>
                <Switch
                  label="Web search"
                  active={form.tools.web}
                  onToggle={() => updateForm('tools.web', !form.tools.web)}
                />
              </div>
              <div className="tool">
                <div>
                  <b>RFD (Retrieve from Documents)</b>
                  <br />
                  <small>Index PDFs/Docs you upload and ground answers in them.</small>
                </div>
                <div className="row file-chip-row">
                  <label className="chip ghost file-upload-trigger" htmlFor="fileUp">
                    Add source
                  </label>
                  <input id="fileUp" type="file" multiple hidden onChange={handleFileUpload} />
                  {form.files.length > 0 ? (
                    <div className="file-chip-track">
                      {form.files.map((file) => {
                        const normalized =
                          typeof file === 'string'
                            ? { name: file, path: file }
                            : file;
                        const key = normalized.path || normalized.name || normalized.url;
                        if (!key) {
                          return null;
                        }
                        const href = normalized.url
                          || (normalized.path
                            ? `/api/storage/files?path=${encodeURIComponent(normalized.path)}`
                            : '#');
                        const label = normalized.name || normalized.path;
                        const icon = resolveFileIcon(label, normalized.contentType || '');
                        return (
                          <a
                            key={key}
                            className="file-chip"
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            title={label}
                          >
                            <span className="file-chip-icon" aria-hidden="true">
                              {icon}
                            </span>
                            <span className="file-chip-name">{truncateFileLabel(label)}</span>
                          </a>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="file-chip-placeholder">No sources added yet.</div>
                  )}
                </div>
                <div className="help">Uploads are always enabled for this agent.</div>
                {isUploadingFile && <div className="help">Uploading...</div>}
              </div>
              
              <div className="tool">
                <div>
                  <b>Custom GPT Model</b>
                  <br />
                  <small>Choose a tuned model for this agent.</small>
                </div>
                <div style={{ minWidth: '170px' }}>
                  <select value={form.model} onChange={(e) => updateForm('model', e.target.value)}>
                    {modelOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="help">{selectedModel.helper}</div>
              <div className="tool">
                <div>
                  <b>Deep Research</b>
                  <br />
                  <small>Runs multi-step research with citations.</small>
                </div>
                <Switch
                  label="Deep research"
                  active={form.tools.deep}
                  onToggle={() => updateForm('tools.deep', !form.tools.deep)}
                />
              </div>
            </div>
          </section>

          <section className="card agents-card">
            <div className="inner">
              <div className="row-split">
                <h3>My agents</h3>
                <div className="help">Neural ID linked</div>
              </div>
              {isFetchingAgents ? (
                <div className="help">Loading agents...</div>
              ) : myAgents.length === 0 ? (
                <div className="help">No agents yet. Save one to see it here.</div>
              ) : (
                <ul className="agent-list">
                  {myAgents.map((agent) => (
                    <li
                      key={agent.id}
                      className={selectedAgentId === agent.id ? 'active' : ''}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectAgent(agent.id)}
                        disabled={isLoadingAgent && selectedAgentId === agent.id}
                      >
                        <div>
                          <b>{agent.name || 'Untitled agent'}</b>
                          <div className="help">{agent.description || 'No description provided.'}</div>
                        </div>
                        <span className="chip ghost">
                          {agent.isShared ? `Shared · ${agent.accessRole}` : agent.status}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
            </>
          )}

          {/* Prompt Versions Tab */}
          {builderTab === 'versions' && selectedAgentId && (
            <div style={{ padding: '20px', background: 'var(--card)', borderRadius: '8px', marginTop: '20px' }}>
              <PromptVersioning 
                agentId={selectedAgentId}
                currentPrompt={form.prompt}
                onVersionSelect={(version) => {
                  updateForm('prompt', version.prompt_text);
                  setStatus('Switched to version: ' + version.version_name);
                }}
              />
            </div>
          )}

          {/* A/B Testing Tab */}
          {builderTab === 'testing' && selectedAgentId && (
            <div style={{ padding: '20px', background: 'var(--card)', borderRadius: '8px', marginTop: '20px' }}>
              <ABTesting agentId={selectedAgentId} />
            </div>
          )}

          {/* Model Comparison Tab */}
          {builderTab === 'comparison' && selectedAgentId && (
            <div style={{ padding: '20px', background: 'var(--card)', borderRadius: '8px', marginTop: '20px' }}>
              <ModelComparison 
                agentId={selectedAgentId} 
                systemPrompt={form.prompt}
                onSelectModel={(modelId) => setForm((prev) => ({ ...prev, model: modelId }))}
              />
            </div>
          )}
        </div>

        <section className="card preview">
          <div className="inner" style={{ paddingBottom: 0 }}>
            <h3>Preview of your agent</h3>
          </div>
          <div className="chat" id="chat">
            {fullChat.map((bubble) => (
              <div key={bubble.id} className={`bubble ${bubble.role === 'user' ? 'me' : ''}`}>
                {bubble.text}
              </div>
            ))}
          </div>
          <div className="chatbar">
            <input
              id="chatInput"
              type="text"
              placeholder="Type here to chat with your agent..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleChatSend();
                }
              }}
            />
            <button
              className="btn secondary"
              id="sendBtn"
              onClick={handleChatSend}
              disabled={isResponding}
            >
              {isResponding ? 'Thinking...' : 'Send'}
            </button>
          </div>
        </section>

      <div className="footer">
        <div className="wrap">
          <button className="btn danger" id="discard" onClick={handleDiscard} disabled={isSaving}>
            Discard
          </button>
          <button
            className="btn secondary"
            id="saveDraft"
            onClick={() => handleSave('draft')}
            disabled={isSaving || !user}
          >
            Save
          </button>
          {selectedAgentId && (
            <button
              className="btn secondary"
              onClick={() => navigate(`/testing?agentId=${selectedAgentId}`)}
            >
              Open testing view
            </button>
          )}
          <button
            className="btn primary"
            id="publish"
            onClick={() => handleSave('published')}
            disabled={isSaving || !user}
          >
            Publish
          </button>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
