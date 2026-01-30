import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { modelOptions } from '../lib/modelOptions.js';
import { buildShareUrl, generateShareToken } from '../lib/sharing.js';
import TutorialLauncher from '../components/TutorialLauncher.jsx';

const templateAgents = [
  {
    name: 'Study Coach',
    desc: 'Explains concepts simply, builds study plans, and creates quick quizzes.',
    prompt:
      'You are a study coach for students. Focus on exams: break topics into small steps, suggest a weekly plan, and use spaced repetition. After explanations, give 3-5 quick practice questions and a simple checklist for what to review next.',
    tags: ['Education', 'Factual'],
    status: 'Template',
  },
  {
    name: 'Career Resume Coach',
    desc: 'Improves resumes and cover letters and prepares interview Q&A.',
    prompt:
      'You help users improve resumes and cover letters. Ask for missing details, rewrite bullets with action + impact, and keep ATS-friendly formatting. For interviews, suggest STAR-style answers and 3 tailored questions to practice.',
    tags: ['Writing', 'Factual'],
    status: 'Template',
  },
  {
    name: 'Wellness Buddy',
    desc: 'Supports healthy routines with gentle habits and daily check-ins.',
    prompt:
      'You are a wellness buddy. Offer gentle, non-medical lifestyle tips, daily check-ins, and small habit ideas. Encourage consistency, rest, and hydration. Avoid medical advice and suggest seeing a professional for health concerns.',
    tags: ['Lifestyle'],
    status: 'Template',
  },
  {
    name: 'Budget Helper',
    desc: 'Creates simple budgets and savings plans without investment advice.',
    prompt:
      'You help with basic budgeting. Build a simple monthly budget, track bills, and suggest weekly cash flow check-ins. Avoid investment advice. Provide 3 easy ways to reduce spending based on categories.',
    tags: ['Factual'],
    status: 'Template',
  },
  {
    name: 'Parenting Helper',
    desc: 'Gives age-appropriate activity ideas and calm response scripts.',
    prompt:
      'You help caregivers with age-appropriate activities and calm, respectful response scripts. Ask the child age, suggest 2-3 activities, and provide a short “say this” script for tricky moments.',
    tags: ['Family'],
    status: 'Template',
  },
  {
    name: 'Elder-Friendly Assistant',
    desc: 'Uses short sentences and clear steps for everyday tasks.',
    prompt:
      'You assist older adults with clear, slow-paced explanations. Use short sentences, one step at a time, and ask one question at the end to confirm understanding. Avoid jargon.',
    tags: ['Accessibility'],
    status: 'Template',
  },
  {
    name: 'Small Business Planner',
    desc: 'Builds simple plans, task lists, and customer reply drafts.',
    prompt:
      'You help small business owners plan the week, draft short customer replies, and organize tasks. Provide a simple priority list and a 3-step next action plan.',
    tags: ['Web Search', 'Planning'],
    status: 'Template',
  },
  {
    name: 'Travel Planner',
    desc: 'Creates simple itineraries, packing lists, and travel checklists.',
    prompt:
      'You help plan trips with simple itineraries, packing lists, and checklist reminders. Ask about budget, dates, and pace. Provide a day-by-day outline and a compact packing list.',
    tags: ['Web Search'],
    status: 'Template',
  },
];

const FILTERS = ['All', 'Active', 'Draft', 'Templates'];
const DEFAULT_COLLECTIONS = ['Personal', 'Work', 'Experiments', 'Archive'];
const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Active',
};

const TOOL_LABELS = {
  web: 'Web Search',
  rfd: 'RFD',
  deep: 'Deep Research',
};

const defaultTemplatePayload = (userId, template, selectedModel = null) => {
  // Use provided model, or default to GPT-4o mini (index 1) instead of Gemini (index 0)
  const defaultModel = selectedModel || modelOptions[1] || modelOptions[0];
  const derivedTools = { web: true, rfd: false, deep: false };
  Object.entries(TOOL_LABELS).forEach(([key, label]) => {
    if (template.tags?.some((tag) => tag.toLowerCase().includes(label.toLowerCase()))) {
      derivedTools[key] = true;
    }
  });

  return {
    user_id: userId,
    name: template.name,
    description: template.desc,
    system_prompt: template.prompt || '',
    status: 'draft',
    guardrails: { factual: true, opinions: true },
    sliders: { formality: 50, creativity: 50 },
    tools: derivedTools,
    model_id: defaultModel.id,
    model_label: defaultModel.label,
    model_provider: defaultModel.provider,
    model_env_key: defaultModel.envKey,
    created_at: new Date().toISOString(),
  };
};

const formatRelative = (dateString) => {
  if (!dateString) {
    return 'Never';
  }
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
};

const deriveTagsFromAgent = (agent) => {
  const tags = [];
  if (agent.tools) {
    Object.entries(agent.tools).forEach(([key, enabled]) => {
      if (enabled && TOOL_LABELS[key]) {
        tags.push(TOOL_LABELS[key]);
      }
    });
  }
  if (agent.guardrails?.factual) {
    tags.push('Factual');
  }
  if (agent.guardrails?.opinions === false) {
    tags.push('Opinionated');
  }
  if (agent.model_label) {
    tags.push(agent.model_label);
  }
  return [...new Set(tags)];
};

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [banner, setBanner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState('All Providers');
  const [collectionFilter, setCollectionFilter] = useState('All Collections');
  const [collections, setCollections] = useState(DEFAULT_COLLECTIONS);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [sortMode, setSortMode] = useState('recent');
  const [mutatingId, setMutatingId] = useState(null);
  const [isTemplateAction, setIsTemplateAction] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [sharePermission, setSharePermission] = useState('view');
  const [shareLink, setShareLink] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [expandedAgentId, setExpandedAgentId] = useState(null);

  const showBanner = useCallback((text, type = 'info') => {
    if (!text) {
      setBanner(null);
      return;
    }
    setBanner({ text, type });
  }, []);

  const loadAgents = useCallback(async () => {
    if (!supabase || !user?.id) {
      setAgents([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const ownedResponse = await supabase
      .from('agent_personas')
      .select('id, name, status, description, created_at, tools, guardrails, model_label, model_provider, model_id, user_id')
      .select('id, name, status, description, created_at, tools, guardrails, model_label, model_provider, model_id, system_prompt, sliders, model_env_key, collection')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const accessResponse = await supabase
      .from('agent_access')
      .select('agent_id, role')
      .eq('user_id', user.id);

    if (ownedResponse.error) {
      showBanner(`Unable to load agents: ${ownedResponse.error.message}`, 'error');
      setAgents([]);
      setIsLoading(false);
      return;
    }

    const ownedAgents = (ownedResponse.data ?? []).map((agent) => ({
      ...agent,
      isShared: false,
      accessRole: 'owner',
    }));

    let sharedAgents = [];
    if (!accessResponse.error && accessResponse.data?.length) {
      const sharedIds = accessResponse.data.map((row) => row.agent_id);
      const { data: sharedData, error: sharedError } = await supabase
        .from('agent_personas')
        .select('id, name, status, description, created_at, tools, guardrails, model_label, model_provider, model_id, user_id')
        .in('id', sharedIds);

      if (!sharedError) {
        const roleMap = new Map(accessResponse.data.map((row) => [row.agent_id, row.role]));
        sharedAgents = (sharedData ?? []).map((agent) => ({
          ...agent,
          isShared: true,
          accessRole: roleMap.get(agent.id) || 'viewer',
        }));
      }
    }

    showBanner(null);
    setAgents([...ownedAgents, ...sharedAgents]);
    setIsLoading(false);
  }, [showBanner, user?.id]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const displayAgents = useMemo(() => {
    if (filter === 'Templates') {
      return templateAgents;
    }

    let list = agents.map((agent) => ({
      ...agent,
      uiStatus: agent.isShared ? `Shared · ${agent.accessRole}` : (STATUS_LABELS[agent.status] || 'Draft'),
      tags: deriveTagsFromAgent(agent),
      lastUsed: formatRelative(agent.created_at),
    }));

    if (filter === 'Active') {
      list = list.filter((agent) => agent.status === 'published');
    } else if (filter === 'Draft') {
      list = list.filter((agent) => agent.status !== 'published');
    }

    // Enhanced search: name, description, tags, and model
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter((agent) => {
        const nameMatch = agent.name?.toLowerCase().includes(query);
        const descMatch = agent.description?.toLowerCase().includes(query);
        const tagsMatch = agent.tags?.some(tag => tag.toLowerCase().includes(query));
        const modelMatch = agent.model_label?.toLowerCase().includes(query);
        return nameMatch || descMatch || tagsMatch || modelMatch;
      });
    }

    // Filter by provider
    if (providerFilter !== 'All Providers') {
      list = list.filter((agent) => agent.model_provider === providerFilter);
    }

    // Filter by collection (only if collection data is available)
    if (collectionFilter !== 'All Collections') {
      list = list.filter((agent) => (agent.collection || null) === collectionFilter);
    }

    if (sortMode === 'az') {
      list = list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [agents, filter, searchTerm, providerFilter, collectionFilter, sortMode]);

  const handleToggleStatus = async (agent) => {
    if (!supabase || !user?.id || filter === 'Templates') {
      return;
    }
    const nextStatus = agent.status === 'published' ? 'draft' : 'published';
    setMutatingId(agent.id);
    const { error } = await supabase
      .from('agent_personas')
      .update({ status: nextStatus })
      .eq('id', agent.id)
      .eq('user_id', user.id);

    if (error) {
      showBanner(`Unable to update status: ${error.message}`, 'error');
    } else {
      loadAgents();
    }
    setMutatingId(null);
  };

  const handleDelete = async (agent) => {
    if (!supabase || !user?.id || filter === 'Templates') {
      return;
    }
    const confirmDelete = window.confirm(`Delete ${agent.name || 'this agent'}?`);
    if (!confirmDelete) {
      return;
    }
    setMutatingId(agent.id);
    const { error } = await supabase
      .from('agent_personas')
      .delete()
      .eq('id', agent.id)
      .eq('user_id', user.id);

    if (error) {
      showBanner(`Unable to delete agent: ${error.message}`, 'error');
    } else {
      loadAgents();
    }
    setMutatingId(null);
  };

  const handleExportAgent = (agent) => {
    const exportData = {
      name: agent.name,
      description: agent.description,
      system_prompt: agent.system_prompt,
      model_id: agent.model_id,
      model_label: agent.model_label,
      model_provider: agent.model_provider,
      model_env_key: agent.model_env_key,
      sliders: agent.sliders,
      guardrails: agent.guardrails,
      tools: agent.tools,
      collection: agent.collection,
      exported_at: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_agent.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showBanner(`Agent "${agent.name}" exported successfully!`, 'success');
  };

  const handleImportAgent = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate required fields
      if (!importData.name || !importData.model_id) {
        showBanner('Invalid agent file: missing required fields', 'error');
        return;
      }

      // Create payload for import
      const payload = {
        user_id: user.id,
        name: `${importData.name} (Imported)`,
        description: importData.description || '',
        system_prompt: importData.system_prompt || '',
        model_id: importData.model_id,
        model_label: importData.model_label || '',
        model_provider: importData.model_provider || '',
        model_env_key: importData.model_env_key || '',
        sliders: importData.sliders || { formality: 50, creativity: 50 },
        guardrails: importData.guardrails || { factual: true, opinions: true },
        tools: importData.tools || { web: false, rfd: false, deep: false },
        collection: importData.collection || null,
        status: 'draft',
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('agent_personas').insert([payload]);

      if (error) {
        showBanner(`Import failed: ${error.message}`, 'error');
      } else {
        showBanner(`Agent "${importData.name}" imported successfully!`, 'success');
        loadAgents();
      }
    } catch (err) {
      showBanner(`Import failed: ${err.message}`, 'error');
    }
    event.target.value = '';
  };

  const handleUpdateCollection = async (agent, newCollection) => {
    setMutatingId(agent.id);
    
    const { error } = await supabase
      .from('agent_personas')
      .update({ collection: newCollection })
      .eq('id', agent.id)
      .eq('user_id', user.id);

    if (error) {
      showBanner(`Unable to update collection: ${error.message}`, 'error');
    } else {
      loadAgents();
      showBanner(`Moved to ${newCollection || 'No Collection'}`, 'success');
    }
    setMutatingId(null);
  };

  const handleAddCollection = () => {
    if (!newCollectionName.trim()) return;
    if (collections.includes(newCollectionName)) {
      showBanner('Collection already exists', 'error');
      return;
    }
    setCollections([...collections, newCollectionName]);
    showBanner(`Collection "${newCollectionName}" created!`, 'success');
    setNewCollectionName('');
    setShowCollectionModal(false);
  };

  const handleAddTemplate = async (template) => {
    if (!supabase) {
      showBanner('Supabase is not configured.', 'error');
      return;
    }
    if (!user?.id) {
      showBanner('Sign in to use templates.', 'error');
      return;
    }
    setIsTemplateAction(true);
    const payload = defaultTemplatePayload(user.id, template);
    const { error } = await supabase.from('agent_personas').insert([payload]);
    if (error) {
      showBanner(`Unable to add template: ${error.message}`, 'error');
    } else {
      showBanner(`${template.name} added to drafts.`, 'success');
      setFilter('All');
      loadAgents();
    }
    setIsTemplateAction(false);
  };

  const openSharePanel = (agent) => {
    if (!agent || agent.isShared) {
      return;
    }
    setShareTarget(agent);
    setSharePermission('view');
    setShareLink('');
    setShareStatus('');
  };

  const closeSharePanel = () => {
    setShareTarget(null);
    setShareLink('');
    setShareStatus('');
  };

  const handleCreateShare = async () => {
    if (!supabase || !user?.id || !shareTarget) {
      setShareStatus('Sign in to create share links.');
      return;
    }
    setShareStatus('Generating link…');
    const token = generateShareToken();
    const { error } = await supabase
      .from('agent_share_links')
      .insert([
        {
          agent_id: shareTarget.id,
          permission: sharePermission,
          token,
          created_by: user.id,
          active: true,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      setShareStatus(`Share failed: ${error.message}`);
      return;
    }

    const url = buildShareUrl(token);
    setShareLink(url);
    setShareStatus('Share link created.');
  };

  const handleCopyShare = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareStatus('Link copied to clipboard.');
    } catch (error) {
      setShareStatus('Copy failed. You can manually copy the link.');
    }
  };

  const handleCloneAgent = async (agent) => {
    if (!supabase || !user?.id || !agent?.id) {
      showBanner('Sign in to clone agents.', 'error');
      return;
    }
    setMutatingId(agent.id);
    const { data, error } = await supabase
      .from('agent_personas')
      .select(
        'name, description, system_prompt, guardrails, sliders, tools, files, model_id, model_label, model_provider, model_env_key',
      )
      .eq('id', agent.id)
      .single();

    if (error) {
      showBanner(`Clone failed: ${error.message}`, 'error');
      setMutatingId(null);
      return;
    }

    const payload = {
      user_id: user.id,
      name: `${data.name || 'Shared agent'} (Clone)`,
      description: data.description,
      system_prompt: data.system_prompt,
      guardrails: data.guardrails,
      sliders: data.sliders,
      tools: data.tools,
      files: data.files,
      model_id: data.model_id,
      model_label: data.model_label,
      model_provider: data.model_provider,
      model_env_key: data.model_env_key,
      status: 'draft',
      created_at: new Date().toISOString(),
      shared_source_id: agent.id,
    };

    const { error: insertError } = await supabase.from('agent_personas').insert([payload]);
    if (insertError) {
      showBanner(`Clone failed: ${insertError.message}`, 'error');
    } else {
      showBanner('Agent cloned to your drafts.', 'success');
      loadAgents();
    }
    setMutatingId(null);
  };

  return (
    <div className="agent-dashboard">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Agent Command Center</p>
          <h1>Agent Dashboard</h1>
          <p className="dashboard-sub">Manage and monitor every AI agent linked to {user?.email || 'your account'}.</p>
        </div>
        <div className="dashboard-header-actions">
          <Link className="new-agent-btn" to="/builder">
            ➕ New Agent
          </Link>
          <Link className="analytics-btn" to="/analytics">
            Analytics
          </Link>
          <div className="search-box">
            <input
              type="text"
              placeholder="Search agents…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          {/* Multi-Agent Chat Button */}
          <button 
            className="multi-chat-icon-btn"
            onClick={() => navigate('/multi-chat')}
            title="Multi-Agent Chat"
            type="button"
          >
            🤖💬
          </button>
          {/* Single Chat Button */}
          <button 
            className="chat-icon-btn"
            onClick={() => navigate('/chat')}
            title="Single Agent Chat"
            type="button"
          >
            💬
          </button>
          <button className="signout-btn" type="button" onClick={signOut}>
            Sign out
          </button>
          <button 
            className="profile-btn"
            onClick={() => navigate('/profile')}
            title="View Profile"
            type="button"
          >
            👤
          </button>
        </div>
      </div>
  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Agent Command Center</p>
      <h1>Agent Portfolio</h1>
      <p className="dashboard-sub">
        Manage and monitor every AI agent linked to {user?.email || 'this workspace'}.
      </p>
    </div>
  );

  const headerActions = (
    <div className="page-actions">
      <Link className="btn primary" to="/builder">
        Create agent
      </Link>
      <Link className="btn secondary" to="/templates">
        Templates
      </Link>
      <Link className="btn secondary" to="/testing">
        Testing lab
      </Link>
      <button
        type="button"
        className="btn secondary"
        onClick={() => setShowCollectionModal(true)}
      >
        Collections
      </button>
      <label className="btn secondary import-control" title="Import agent JSON">
        Import
        <input
          type="file"
          accept=".json"
          onChange={handleImportAgent}
        />
      </label>
      <TutorialLauncher />
    </div>
  );

  const toggleAgentRow = (agentKey) => {
    setExpandedAgentId((prev) => (prev === agentKey ? null : agentKey));
  };

  const shouldShowReset = (
    (searchTerm || providerFilter !== 'All Providers' || collectionFilter !== 'All Collections')
    && filter !== 'Templates'
  );

  return (
    <DashboardLayout headerContent={headerContent} actions={headerActions}>
      <div className="dashboard-toolbar">
        <div className="filters">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={`filter-btn ${filter === option ? 'active-filter' : ''}`}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {filter !== 'Templates' && (
          <select className="sort-select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="recent">Recently Added</option>
            <option value="az">A – Z</option>
          </select>
        )}
      </div>

      {banner?.text && <div className={`dashboard-status ${banner.type}`}>{banner.text}</div>}

      <div className="agent-grid">
        {isLoading ? (
          <div className="dashboard-empty">Loading your agents…</div>
        ) : displayAgents.length === 0 ? (
          <div className="dashboard-empty">No entries match the current view.</div>
        ) : (
          displayAgents.map((agent) => (
            <div
              key={agent.id || agent.name}
              className={`dashboard-card ${filter === 'Templates' ? 'template-card' : ''}`}
            >
              <div className="card-header">
                <span className="card-title">{agent.name}</span>
                {filter === 'Templates' ? (
                  <span className="status template-tag">Template</span>
                ) : (
                  <span
                    className={`status ${
                      agent.isShared ? 'shared' : agent.status === 'published' ? 'active' : 'draft'
                    }`}
                  >
                    {agent.uiStatus}
                  </span>
                )}
              </div>
              <p>{agent.description || agent.desc}</p>
              <div className="tags">
                {(agent.tags || []).map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              {filter === 'Templates' ? (
          displayAgents.map((agent) => {
            const cardKey = agent.id ? `agent-${agent.id}` : `template-${agent.name}`;
            const isExpanded = expandedAgentId === cardKey;
            const isTemplate = filter === 'Templates';
            return (
              <article
                key={cardKey}
                className={`agent-card ${isExpanded ? 'is-open' : ''} ${isTemplate ? 'is-template' : ''}`}
              >
                <button
                  type="button"
                  className="agent-card-toggle"
                  onClick={() => toggleAgentRow(cardKey)}
                  aria-expanded={isExpanded}
                >
                  <div>
                    <p className="agent-card-subtitle">{agent.collection || 'Unsorted'}</p>
                    <h3>{agent.name || agent.desc || 'Untitled agent'}</h3>
                  </div>
                  <div className="agent-card-meta">
                    <span className={`status-chip ${isTemplate ? 'template' : agent.status === 'published' ? 'active' : 'draft'}`}>
                      {isTemplate ? 'Template' : agent.uiStatus}
                    </span>
                    <span className="chevron" aria-hidden="true" />
                  </div>
                </button>
              ) : (
                <>
                  <p className="last-used">Last updated: {agent.lastUsed}</p>
                  <div className="card-actions">
                    {agent.isShared ? (
                      <>
                        <button
                          type="button"
                          className="manage-btn"
                          onClick={() => navigate(`/chat?agent=${agent.id}`)}
                        >
                          Open
                        </button>
                        {agent.accessRole === 'editor' && (
                          <button
                            type="button"
                            className="toggle-btn"
                            onClick={() => navigate(`/builder?agent=${agent.id}`)}
                          >
                            Edit
                          </button>
                        )}
                        {agent.accessRole === 'cloner' && (
                          <button
                            type="button"
                            className="toggle-btn"
                            disabled={mutatingId === agent.id}
                            onClick={() => handleCloneAgent(agent)}
                          >
                            Clone
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="toggle-btn"
                          disabled={mutatingId === agent.id}
                          onClick={() => handleToggleStatus(agent)}
                        >
                          {agent.status === 'published' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" className="manage-btn" onClick={() => navigate('/builder')}>
                          Manage
                        </button>
                        <button
                          type="button"
                          className="manage-btn"
                          onClick={() => openSharePanel(agent)}
                        >
                          Share
                        </button>
                        <button
                          type="button"
                          className="delete-btn"
                          disabled={mutatingId === agent.id}
                          onClick={() => handleDelete(agent)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                <div className="agent-card-summary">
                  <div>
                    <p className="label">Model</p>
                    <p className="value">{agent.model_label || agent.model_id || 'Not assigned'}</p>
                  </div>
                  {!isTemplate && (
                    <div>
                      <p className="label">Updated</p>
                      <p className="value">{agent.lastUsed}</p>
                    </div>
                  )}
                  <div>
                    <p className="label">Tags</p>
                    <p className="value">{(agent.tags || []).slice(0, 3).join(', ') || '—'}</p>
                  </div>
                </div>
                <p className="agent-card-description">{agent.description || agent.desc || 'No description provided yet.'}</p>
                {isExpanded && (
                  <div className="agent-card-details">
                    {!isTemplate && (
                      <div className="collection-selector">
                        <label htmlFor={`collection-${cardKey}`}>Collection</label>
                        <select
                          id={`collection-${cardKey}`}
                          value={agent.collection || ''}
                          onChange={(event) => handleUpdateCollection(agent, event.target.value || null)}
                          disabled={mutatingId === agent.id}
                        >
                          <option value="">None</option>
                          {collections.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(agent.tags || []).length > 0 && (
                      <div className="tag-deck">
                        {(agent.tags || []).map((tag) => (
                          <span key={tag} className="tag-pill">{tag}</span>
                        ))}
                      </div>
                    )}

                    {isTemplate ? (
                      <button
                        type="button"
                        className="btn primary full-width"
                        disabled={isTemplateAction}
                        onClick={() => handleAddTemplate(agent)}
                      >
                        Add to drafts
                      </button>
                    ) : (
                      <div className="agent-card-actions">
                        <button type="button" onClick={() => navigate(`/chat?agentId=${agent.id}`)}>
                          Open chat
                        </button>
                        <button type="button" onClick={() => navigate(`/testing?agentId=${agent.id}`)}>
                          Testing view
                        </button>
                        <button type="button" onClick={() => navigate('/builder')}>
                          Edit
                        </button>
                        <button type="button" onClick={() => handleExportAgent(agent)}>
                          Export JSON
                        </button>
                        <button
                          type="button"
                          className="link-danger"
                          disabled={mutatingId === agent.id}
                          onClick={() => handleToggleStatus(agent)}
                        >
                          {agent.status === 'published' ? 'Pause agent' : 'Activate agent'}
                        </button>
                        <button
                          type="button"
                          className="link-danger"
                          disabled={mutatingId === agent.id}
                          onClick={() => handleDelete(agent)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
      {shareTarget && (
        <div className="share-modal">
          <div className="share-modal-card">
            <div className="share-modal-header">
              <h3>Share {shareTarget.name || 'agent'}</h3>
              <button type="button" className="icon-btn" onClick={closeSharePanel}>
                ×
              </button>
            </div>
            <p className="muted">Choose the access level for this agent.</p>
            <div className="share-options">
              {['view', 'clone', 'edit'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`share-option ${sharePermission === option ? 'active' : ''}`}
                  onClick={() => setSharePermission(option)}
                >
                  <b>{option === 'view' ? 'View only' : option === 'clone' ? 'Clone only' : 'Editor'}</b>
                  <span>
                    {option === 'view'
                      ? 'Allow others to view and chat.'
                      : option === 'clone'
                        ? 'Allow cloning into their workspace.'
                        : 'Allow editing and publishing changes.'}
                  </span>
                </button>
              ))}
            </div>
            <div className="share-actions">
              <button className="btn primary" type="button" onClick={handleCreateShare}>
                Generate link
              </button>
              {shareLink && (
                <button className="btn secondary" type="button" onClick={handleCopyShare}>
                  Copy link
                </button>
              )}
            </div>
            {shareLink && (
              <div className="share-link">
                <input type="text" readOnly value={shareLink} />
              </div>
            )}
            {shareStatus && <div className="status-bar">{shareStatus}</div>}
          </div>
        </div>
      )}
    </div>
      </div>

      {showCollectionModal && (
        <div className="modal-overlay" onClick={() => setShowCollectionModal(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Collections</h2>
              <button className="modal-close" type="button" onClick={() => setShowCollectionModal(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="collection-list">
                <h3>Existing collections</h3>
                {collections.map((col) => (
                  <div key={col} className="collection-item">
                    <span className="collection-dot" aria-hidden="true" />
                    <span className="collection-name">{col}</span>
                    <span className="collection-count">
                      {agents.filter((agent) => agent.collection === col).length} agents
                    </span>
                  </div>
                ))}
              </div>
              <div className="add-collection-form">
                <h3>Create new collection</h3>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Collection name"
                    value={newCollectionName}
                    onChange={(event) => setNewCollectionName(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleAddCollection()}
                  />
                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleAddCollection}
                    disabled={!newCollectionName.trim()}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
