import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { modelOptions } from '../lib/modelOptions.js';
import TutorialLauncher from '../components/TutorialLauncher.jsx';

const templateAgents = [
  { name: 'Marketing Advisor', desc: 'Provides marketing strategy advice', tags: ['Web Search', 'Research'], status: 'Template' },
  { name: 'Product Designer', desc: 'Generates user flow and design ideas', tags: ['Creative', 'UX'], status: 'Template' },
  { name: 'HR Assistant', desc: 'Helps with candidate screening and hiring', tags: ['Screening', 'Forms'], status: 'Template' },
  { name: 'Tutor Assistant', desc: 'Explains concepts and generates lessons', tags: ['Education'], status: 'Template' },
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
    const { data, error } = await supabase
      .from('agent_personas')
      .select('id, name, status, description, created_at, tools, guardrails, model_label, model_provider, model_id, system_prompt, sliders, model_env_key, collection')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showBanner(`Unable to load agents: ${error.message}`, 'error');
      setAgents([]);
    } else {
      showBanner(null);
      setAgents(data ?? []);
    }
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
      uiStatus: STATUS_LABELS[agent.status] || 'Draft',
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
