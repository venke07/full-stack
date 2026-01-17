import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { modelOptions } from '../lib/modelOptions.js';
import TutorialLauncher from '../components/TutorialLauncher.jsx';

const templateAgents = [
  { name: 'Marketing Advisor', desc: 'Provides marketing strategy advice', tags: ['Web Search', 'Research'], status: 'Template' },
  { name: 'Product Designer', desc: 'Generates user flow and design ideas', tags: ['Creative', 'UX'], status: 'Template' },
  { name: 'HR Assistant', desc: 'Helps with candidate screening and hiring', tags: ['Screening', 'Forms'], status: 'Template' },
  { name: 'Tutor Assistant', desc: 'Explains concepts and generates lessons', tags: ['Education'], status: 'Template' },
];

const FILTERS = ['All', 'Active', 'Draft', 'Templates'];
const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Active',
};

const TOOL_LABELS = {
  web: 'Web Search',
  rfd: 'RFD',
  deep: 'Deep Research',
};

const defaultTemplatePayload = (userId, template) => {
  const defaultModel = modelOptions[0];
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
      .select('id, name, status, description, created_at, tools, guardrails, model_label, model_provider, model_id')
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

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter((agent) => agent.name?.toLowerCase().includes(query));
    }

    if (sortMode === 'az') {
      list = list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return list;
  }, [agents, filter, searchTerm, sortMode]);

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
          <div className="search-box">
            <input
              type="text"
              placeholder="Search agents…"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <TutorialLauncher />
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

      <section className="dashboard-grid">
        {isLoading ? (
          <div className="dashboard-empty">Loading your agents…</div>
        ) : displayAgents.length === 0 ? (
          <div className="dashboard-empty">No agents found.</div>
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
                  <span className={`status ${agent.status === 'published' ? 'active' : 'draft'}`}>
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
                <button
                  type="button"
                  className="template-add-btn"
                  disabled={isTemplateAction}
                  onClick={() => handleAddTemplate(agent)}
                >
                  ➕ Use Template
                </button>
              ) : (
                <>
                  <p className="last-used">Last updated: {agent.lastUsed}</p>
                  <div className="card-actions">
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
                      className="delete-btn"
                      disabled={mutatingId === agent.id}
                      onClick={() => handleDelete(agent)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
