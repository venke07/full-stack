import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { modelOptions } from '../lib/modelOptions.js';

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
  const { user, signOut } = useAuth();
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
          <Link className="btn secondary compact" to="/templates" style={{ textDecoration: 'none' }}>
            📚 Templates
          </Link>
          <Link className="btn secondary compact" to="/testing" style={{ textDecoration: 'none' }}>
            🧪 Test
          </Link>
          <label className="import-agent-btn" title="Import Agent">
            📥 Import
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportAgent} 
              style={{ display: 'none' }}
            />
          </label>
          <button 
            className="btn secondary compact"
            onClick={() => setShowCollectionModal(true)}
            title="Manage Collections"
          >
            📁 Collections
          </button>
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
          {/* Fusion Lab Button */}
          <button 
            className="fusion-lab-icon-btn"
            onClick={() => navigate('/fusion-lab')}
            title="Agent Fusion Lab"
            type="button"
          >
            ⚗️✨
          </button>
          {/* Autonomous Task Button */}
          <button 
            className="autonomous-icon-btn"
            onClick={() => navigate('/autonomous')}
            title="Autonomous Task Executor"
            type="button"
          >
            🤖⚡
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
        <div className="toolbar-controls">
          {filter !== 'Templates' && (
            <>
              <select 
                className="collection-filter-select" 
                value={collectionFilter} 
                onChange={(event) => setCollectionFilter(event.target.value)}
              >
                <option value="All Collections">All Collections</option>
                {collections.map((col) => (
                  <option key={col} value={col}>📁 {col}</option>
                ))}
              </select>
              <select 
                className="provider-filter-select" 
                value={providerFilter} 
                onChange={(event) => setProviderFilter(event.target.value)}
              >
                <option value="All Providers">All Providers</option>
                <option value="openai">🟢 OpenAI</option>
                <option value="google">🔵 Google</option>
                <option value="groq">🟣 Groq</option>
                <option value="deepseek">🟠 DeepSeek</option>
              </select>
              <select className="sort-select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                <option value="recent">Recently Added</option>
                <option value="az">A – Z</option>
              </select>
            </>
          )}
          {filter !== 'Templates' && displayAgents.length > 0 && (
            <div className="results-count">
              {displayAgents.length} agent{displayAgents.length !== 1 ? 's' : ''}
            </div>
          )}
          {(searchTerm || providerFilter !== 'All Providers' || collectionFilter !== 'All Collections') && filter !== 'Templates' && (
            <button 
              className="clear-filters-btn" 
              onClick={() => {
                setSearchTerm('');
                setProviderFilter('All Providers');
                setCollectionFilter('All Collections');
              }}
              title="Clear search and filters"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {banner?.text && <div className={`dashboard-status ${banner.type}`}>{banner.text}</div>}

      <section className="dashboard-grid">
        {isLoading ? (
          <div className="dashboard-empty">Loading your agents…</div>
        ) : displayAgents.length === 0 ? (
          <div className="dashboard-empty">No agents found.</div>
        ) : (
          displayAgents.map((agent) => (
            <div
              key={agent.id || agent.name}
              className={`dashboard-card-enhanced ${filter === 'Templates' ? 'template-card' : ''}`}
            >
              {/* Card Header with Status Indicator */}
              <div className="card-header-enhanced">
                <div className="card-title-row">
                  <div className="health-indicator-wrapper">
                    {agent.status === 'published' ? (
                      <span className="health-indicator green" title="Active">🟢</span>
                    ) : (
                      <span className="health-indicator gray" title="Draft">⚪</span>
                    )}
                    <span className="card-title-enhanced">{agent.name}</span>
                  </div>
                  {filter === 'Templates' ? (
                    <span className="status-badge template">Template</span>
                  ) : (
                    <span className={`status-badge ${agent.status === 'published' ? 'active' : 'draft'}`}>
                      {agent.uiStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="card-body-enhanced">
                <p className="card-description">{agent.description || agent.desc || 'No description provided'}</p>
                
                {/* Quick Stats */}
                {!filter.includes('Templates') && (
                  <div className="quick-stats">
                    <div className="stat-item">
                      <span className="stat-icon">🔧</span>
                      <span className="stat-label">Model:</span>
                      <span className="stat-value">{agent.model_label || agent.model_id || 'N/A'}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-icon">📅</span>
                      <span className="stat-label">Updated:</span>
                      <span className="stat-value">{agent.lastUsed}</span>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {(agent.tags || []).length > 0 && (
                  <div className="tags-enhanced">
                    {(agent.tags || []).slice(0, 3).map((tag) => (
                      <span key={tag} className="tag-enhanced">
                        #{tag}
                      </span>
                    ))}
                    {(agent.tags || []).length > 3 && (
                      <span className="tag-enhanced more">+{(agent.tags || []).length - 3}</span>
                    )}
                  </div>
                )}

                {/* Collection Selector */}
                {!filter.includes('Templates') && (
                  <div className="collection-selector">
                    <label className="collection-label">Collection:</label>
                    <select 
                      className="collection-dropdown"
                      value={agent.collection || ''}
                      onChange={(e) => handleUpdateCollection(agent, e.target.value || null)}
                      disabled={mutatingId === agent.id}
                    >
                      <option value="">No Collection</option>
                      {collections.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Card Actions */}
              <div className="card-footer-enhanced">
                {filter === 'Templates' ? (
                  <button
                    type="button"
                    className="btn-primary-enhanced full-width"
                    disabled={isTemplateAction}
                    onClick={() => handleAddTemplate(agent)}
                  >
                    <span className="btn-icon">➕</span>
                    Use Template
                  </button>
                ) : (
                  <div className="quick-actions">
                    <button
                      type="button"
                      className="action-btn primary"
                      onClick={() => navigate(`/chat?agentId=${agent.id}`)}
                      title="Start Chat"
                    >
                      <span className="action-icon">💬</span>
                      Chat
                    </button>
                    <button
                      type="button"
                      className="action-btn secondary"
                      onClick={() => navigate(`/testing?agentId=${agent.id}`)}
                      title="Test Agent"
                    >
                      <span className="action-icon">🧪</span>
                      Test
                    </button>
                    <button
                      type="button"
                      className="action-btn secondary"
                      onClick={() => handleExportAgent(agent)}
                      title="Export Agent"
                    >
                      <span className="action-icon">📤</span>
                      Export
                    </button>
                    <button
                      type="button"
                      className="action-btn secondary"
                      onClick={() => navigate('/builder')}
                      title="Edit Agent"
                    >
                      <span className="action-icon">✏️</span>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`action-btn ${agent.status === 'published' ? 'warning' : 'success'}`}
                      disabled={mutatingId === agent.id}
                      onClick={() => handleToggleStatus(agent)}
                      title={agent.status === 'published' ? 'Deactivate' : 'Activate'}
                    >
                      <span className="action-icon">{agent.status === 'published' ? '⏸️' : '▶️'}</span>
                      {agent.status === 'published' ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="action-btn danger"
                      disabled={mutatingId === agent.id}
                      onClick={() => handleDelete(agent)}
                      title="Delete Agent"
                    >
                      <span className="action-icon">🗑️</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Collection Management Modal */}
      {showCollectionModal && (
        <div className="modal-overlay" onClick={() => setShowCollectionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Collections</h2>
              <button className="modal-close" onClick={() => setShowCollectionModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="collection-list">
                <h3>Existing Collections</h3>
                {collections.map((col) => (
                  <div key={col} className="collection-item">
                    <span className="collection-icon">📁</span>
                    <span className="collection-name">{col}</span>
                    <span className="collection-count">
                      {agents.filter(a => a.collection === col).length} agents
                    </span>
                  </div>
                ))}
              </div>
              <div className="add-collection-form">
                <h3>Create New Collection</h3>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Collection name..."
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCollection()}
                  />
                  <button 
                    className="btn-primary" 
                    onClick={handleAddCollection}
                    disabled={!newCollectionName.trim()}
                  >
                    Add Collection
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
