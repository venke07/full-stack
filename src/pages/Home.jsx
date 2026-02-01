import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { modelOptions } from '../lib/modelOptions.js';
import TutorialLauncher from '../components/TutorialLauncher.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

const defaultTemplatePayload = (template, selectedModel = null) => {
  // Use provided model, or default to GPT-4o mini (index 1) instead of Gemini (index 0)
  const defaultModel = selectedModel || modelOptions[1] || modelOptions[0];
  const derivedTools = { web: true, rfd: false, deep: false };
  Object.entries(TOOL_LABELS).forEach(([key, label]) => {
    if (template.tags?.some((tag) => tag.toLowerCase().includes(label.toLowerCase()))) {
      derivedTools[key] = true;
    }
  });

  return {
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

const mergeAgentLists = (primary = [], secondary = []) => {
  const merged = new Map();

  const upsert = (agent, origin = 'primary') => {
    if (!agent) {
      return;
    }
    const key = agent.id || agent.share_id || `${origin}-${agent.name || 'agent'}`;
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, ...agent } : agent);
  };

  (primary || []).forEach((agent) => upsert(agent, 'primary'));
  (secondary || []).forEach((agent) => upsert(agent, 'secondary'));

  return Array.from(merged.values());
};

export default function HomePage() {
  console.log('[DEBUG] HomePage rendering');
  const { user, session } = useAuth();
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [shareInput, setShareInput] = useState('');
  const [sharePermission, setSharePermission] = useState('view');
  const [shareList, setShareList] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSubmitting, setShareSubmitting] = useState(false);

  const [shareLinks, setShareLinks] = useState([]);
  const [shareLinkPermission, setShareLinkPermission] = useState('view');
  const [shareLinkIsPublic, setShareLinkIsPublic] = useState(false);
  const [shareLinkExpiresAt, setShareLinkExpiresAt] = useState('');
  const [shareLinksLoading, setShareLinksLoading] = useState(false);


  const showBanner = useCallback((text, type = 'info') => {
    if (!text) {
      setBanner(null);
      return;
    }
    setBanner({ text, type });
  }, []);

  const authHeaders = useMemo(() => {
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session?.access_token]);

  const requireSession = useCallback(() => {
    if (!session?.access_token) {
      showBanner('Sign in to manage your agents.', 'error');
      return false;
    }
    return true;
  }, [session?.access_token, showBanner]);

  const loadSharedAgents = useCallback(async () => {
    if (!session?.access_token) {
      return [];
    }
    try {
      console.log('[DEBUG] Fetching shared agents from:', `${API_URL}/api/agents/shared`);
      const res = await fetch(`${API_URL}/api/agents/shared`, {
        headers: {
          ...authHeaders,
        },
      });
      console.log('[DEBUG] Shared agents response status:', res.status);
      const data = await res.json();
      if (!res.ok || !data.success) {
        return [];
      }
      return data.agents || [];
    } catch (error) {
      console.error('Failed to load shared agents:', error);
      return [];
    }
  }, [API_URL, authHeaders, session?.access_token]);

  const loadAgents = useCallback(async () => {
    if (!session?.access_token) {
      setAgents([]);
      setIsLoading(false);
      return;
    }

    console.log('[DEBUG] loadAgents called. Session token exists:', !!session?.access_token);
    setIsLoading(true);
    try {
      console.log('[DEBUG] Fetching agents from:', `${API_URL}/api/agents`);
      const response = await fetch(`${API_URL}/api/agents`, {
        headers: {
          ...authHeaders,
        },
      });
      console.log('[DEBUG] Agents response status:', response.status);
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload?.error || 'Failed to load agents.');
      }

      showBanner(null);
      const baseAgents = payload.agents ?? [];
      setAgents(baseAgents);

      loadSharedAgents()
        .then((sharedAgents) => {
          if (!Array.isArray(sharedAgents) || sharedAgents.length === 0) {
            return;
          }
          setAgents((prev) => mergeAgentLists(prev, sharedAgents));
        })
        .catch((sharedError) => {
          console.error('Failed to merge shared agents:', sharedError);
        });
    } catch (error) {
      console.error('Failed to load agents:', error);
      showBanner(`Unable to load agents: ${error.message}`, 'error');
      setAgents([]);
    } finally {
      console.log('[DEBUG] loadAgents finally block reached, setting isLoading to false');
      setIsLoading(false);
    }
  }, [API_URL, authHeaders, loadSharedAgents, session?.access_token, showBanner]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const displayAgents = useMemo(() => {
    if (filter === 'Templates') {
      return templateAgents;
    }

    let list = agents.map((agent) => {
      const isShared = !!agent.shared_permission;
      const tags = deriveTagsFromAgent(agent);
      if (isShared) {
        tags.push(`Shared · ${agent.shared_permission}`);
      }
      return {
        ...agent,
        isShared,
        uiStatus: isShared ? 'Shared' : STATUS_LABELS[agent.status] || 'Draft',
        tags,
        lastUsed: formatRelative(agent.created_at),
      };
    });

    if (filter === 'Active') {
      list = list.filter((agent) => agent.status === 'published');
    } else if (filter === 'Draft') {
      list = list.filter((agent) => agent.status !== 'published');
    }

    // Enhanced search: name, description, tags, and model
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      list = list.filter((agent) => {
        const nameValue = typeof agent.name === 'string' ? agent.name.toLowerCase() : '';
        const descValue = typeof agent.description === 'string' ? agent.description.toLowerCase() : '';
        const modelValue = typeof agent.model_label === 'string' ? agent.model_label.toLowerCase() : '';
        const nameMatch = nameValue.includes(query);
        const descMatch = descValue.includes(query);
        const tagsMatch = Array.isArray(agent.tags)
          ? agent.tags.some((tag) => typeof tag === 'string' && tag.toLowerCase().includes(query))
          : false;
        const modelMatch = modelValue.includes(query);
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
    if (filter === 'Templates' || !requireSession()) {
      return;
    }
    const nextStatus = agent.status === 'published' ? 'draft' : 'published';
    setMutatingId(agent.id);
    try {
      const res = await fetch(`${API_URL}/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to update status.');
      }
      loadAgents();
    } catch (error) {
      showBanner(`Unable to update status: ${error.message}`, 'error');
    } finally {
      setMutatingId(null);
    }
  };

  const handleDelete = async (agent) => {
    if (filter === 'Templates' || !requireSession()) {
      return;
    }
    const confirmDelete = window.confirm(`Delete ${agent.name || 'this agent'}?`);
    if (!confirmDelete) {
      return;
    }
    setMutatingId(agent.id);
    try {
      const res = await fetch(`${API_URL}/api/agents/${agent.id}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      });
      const data = res.status === 204 ? { success: true } : await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to delete agent.');
      }
      loadAgents();
    } catch (error) {
      showBanner(`Unable to delete agent: ${error.message}`, 'error');
    } finally {
      setMutatingId(null);
    }
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
    if (!requireSession()) {
      event.target.value = '';
      return;
    }

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
      };

      const res = await fetch(`${API_URL}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to import agent.');
      }
      showBanner(`Agent "${importData.name}" imported successfully!`, 'success');
      loadAgents();
    } catch (err) {
      showBanner(`Import failed: ${err.message}`, 'error');
    }
    event.target.value = '';
  };

  const permissionRank = {
    view: 1,
    clone: 2,
    edit: 3,
  };

  const refreshShareList = async (agentId) => {
    if (!session?.access_token) {
      return;
    }
    setShareLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/agents/${agentId}/shares`, {
        headers: {
          ...authHeaders,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShareList(data.shares || []);
      } else {
        setShareList([]);
      }
    } catch (error) {
      console.error('Failed to load shares:', error);
      setShareList([]);
    } finally {
      setShareLoading(false);
    }
  };


  const openShareModal = async (agent) => {
    setShareTarget(agent);
    setSharePermission('view');
    setShareLinkPermission('view');
    setShareLinkIsPublic(false);
    setShareInput('');
    setShareModalOpen(true);
    await Promise.all([
      refreshShareList(agent.id),
      refreshShareLinks(agent.id),
    ]);
  };



  const refreshShareLinks = async (agentId) => {
    if (!session?.access_token) return;
    setShareLinksLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/agents/${agentId}/share-links`, {
        headers: {
          ...authHeaders,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShareLinks(data.links || []);
      } else {
        setShareLinks([]);
      }
    } catch (error) {
      setShareLinks([]);
    } finally {
      setShareLinksLoading(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!shareTarget || !session?.access_token) return;
    if (shareLinkIsPublic && shareLinkPermission === 'edit') {
      showBanner('Public links cannot grant edit access.', 'error');
      return;
    }
    try {
      const payload = {
        permission: shareLinkPermission,
        isPublic: shareLinkIsPublic,
        expiresAt: shareLinkExpiresAt || null,
      };
      const res = await fetch(`${API_URL}/api/agents/${shareTarget.id}/share-links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showBanner('Share link created.', 'success');
        setShareLinkExpiresAt('');
        await refreshShareLinks(shareTarget.id);
      } else {
        showBanner(data.error || 'Failed to create share link.', 'error');
      }
    } catch (error) {
      showBanner('Failed to create share link.', 'error');
    }
  };

  const handleRevokeShareLink = async (linkId) => {
    if (!shareTarget || !session?.access_token) return;
    try {
      const res = await fetch(`${API_URL}/api/agents/${shareTarget.id}/share-links/${linkId}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      });
      if (res.ok) {
        showBanner('Share link revoked.', 'success');
        await refreshShareLinks(shareTarget.id);
      } else {
        showBanner('Failed to revoke share link.', 'error');
      }
    } catch (error) {
      showBanner('Failed to revoke share link.', 'error');
    }
  };

  const handleUpdateShareLink = async (linkId, updates) => {
    if (!shareTarget || !session?.access_token) return;
    try {
      const res = await fetch(`${API_URL}/api/agents/${shareTarget.id}/share-links/${linkId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showBanner(data.error || 'Failed to update share link.', 'error');
      } else {
        await refreshShareLinks(shareTarget.id);
      }
    } catch (error) {
      showBanner('Failed to update share link.', 'error');
    }
  };

  const handleCopyShareLink = (token, isPublic) => {
    const path = isPublic ? `/public/agent?token=${token}` : `/builder?shareToken=${token}`;
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(() => {
      showBanner('Share link copied.', 'success');
    }).catch(() => {
      showBanner('Failed to copy link.', 'error');
    });
  };

  const handleShareSubmit = async () => {
    if (!shareTarget || !session?.access_token) {
      return;
    }
    const trimmed = shareInput.trim();
    if (!trimmed) {
      showBanner('Enter a user ID or email to share.', 'error');
      return;
    }
    setShareSubmitting(true);
    try {
      const payload = trimmed.includes('@')
        ? { sharedWithEmail: trimmed, permission: sharePermission }
        : { sharedWithUserId: trimmed, permission: sharePermission };

      const res = await fetch(`${API_URL}/api/agents/${shareTarget.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showBanner(data.error || 'Failed to share agent.', 'error');
      } else {
        showBanner('Agent shared successfully.', 'success');
        setShareInput('');
        await refreshShareList(shareTarget.id);
      }
    } catch (error) {
      showBanner('Failed to share agent.', 'error');
    } finally {
      setShareSubmitting(false);
    }
  };


  const handleUpdateSharePermission = async (shareId, permission) => {
    if (!shareTarget || !session?.access_token) return;
    try {
      const res = await fetch(`${API_URL}/api/agents/${shareTarget.id}/shares/${shareId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ permission }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showBanner(data.error || 'Failed to update permission.', 'error');
      } else {
        showBanner('Permission updated.', 'success');
        await refreshShareList(shareTarget.id);
      }
    } catch (error) {
      showBanner('Failed to update permission.', 'error');
    }
  };

  const handleRevokeShare = async (shareId) => {
    if (!shareTarget || !session?.access_token) return;
    try {
      const res = await fetch(`${API_URL}/api/agents/${shareTarget.id}/shares/${shareId}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders,
        },
      });
      if (res.ok) {
        showBanner('Share revoked.', 'success');
        await refreshShareList(shareTarget.id);
      } else {
        showBanner('Failed to revoke share.', 'error');
      }
    } catch (error) {
      showBanner('Failed to revoke share.', 'error');
    }
  };

  const handleCloneShared = async (agent) => {
    if (!session?.access_token) {
      showBanner('Sign in to clone shared agents.', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/agents/${agent.id}/clone`, {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showBanner('Agent cloned to your workspace.', 'success');
        loadAgents();
      } else {
        showBanner(data.error || 'Failed to clone agent.', 'error');
      }
    } catch (error) {
      showBanner('Failed to clone agent.', 'error');
    }
  };

  const handleUpdateCollection = async (agent, newCollection) => {
    if (!requireSession()) {
      return;
    }
    setMutatingId(agent.id);
    try {
      const res = await fetch(`${API_URL}/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ collection: newCollection }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to update collection.');
      }
      loadAgents();
      showBanner(`Moved to ${newCollection || 'No Collection'}`, 'success');
    } catch (error) {
      showBanner(`Unable to update collection: ${error.message}`, 'error');
    } finally {
      setMutatingId(null);
    }
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
    if (!requireSession()) {
      return;
    }
    setIsTemplateAction(true);
    try {
      const payload = defaultTemplatePayload(template);
      const res = await fetch(`${API_URL}/api/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to add template.');
      }
      showBanner(`${template.name} added to drafts.`, 'success');
      setFilter('All');
      loadAgents();
    } catch (error) {
      showBanner(`Unable to add template: ${error.message}`, 'error');
    } finally {
      setIsTemplateAction(false);
    }
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
            const isShared = !!agent.isShared;
            const permissionLevel = permissionRank[agent.shared_permission] || 0;
            const canClone = isShared && permissionLevel >= permissionRank.clone;
            const canEdit = isShared && permissionLevel >= permissionRank.edit;
            const statusClass = isTemplate
              ? 'template'
              : isShared
                ? 'shared'
                : agent.status === 'published'
                  ? 'active'
                  : 'draft';
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
                    <span className={`status-chip ${statusClass}`}>
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
                    {!isTemplate && !isShared && (
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
                    ) : isShared ? (
                      <div className="agent-card-actions">
                        <button type="button" onClick={() => navigate(`/chat?agentId=${agent.id}`)}>
                          Open chat
                        </button>
                        <button type="button" onClick={() => navigate(`/testing?agentId=${agent.id}`)}>
                          Testing view
                        </button>
                        {canEdit ? (
                          <button type="button" onClick={() => navigate(`/builder?agentId=${agent.id}&shared=1`)}>
                            Edit shared
                          </button>
                        ) : (
                          <button type="button" className="ghost" disabled>
                            View only
                          </button>
                        )}
                        {canClone && (
                          <button type="button" onClick={() => handleCloneShared(agent)}>
                            Clone agent
                          </button>
                        )}
                      </div>
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
                        <button type="button" onClick={() => openShareModal(agent)}>
                          Share
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

      {shareModalOpen && shareTarget && (
        <div className="modal-overlay" onClick={() => setShareModalOpen(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Share {shareTarget.name || 'agent'}</h2>
              <button className="modal-close" type="button" onClick={() => setShareModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="share-form">
                <label>Invite by user ID or email</label>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="user-id or email@domain.com"
                    value={shareInput}
                    onChange={(event) => setShareInput(event.target.value)}
                  />
                  <select value={sharePermission} onChange={(event) => setSharePermission(event.target.value)}>
                    <option value="view">View only</option>
                    <option value="clone">Clone only</option>
                    <option value="edit">Edit access</option>
                  </select>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleShareSubmit}
                    disabled={shareSubmitting}
                  >
                    Share
                  </button>
                </div>
              </div>


              <div className="share-links">
                <h3>Share links</h3>
                <div className="input-group">
                  <select
                    value={shareLinkPermission}
                    onChange={(event) => setShareLinkPermission(event.target.value)}
                  >
                    <option value="view">View only</option>
                    <option value="clone">Clone only</option>
                    <option value="edit" disabled={shareLinkIsPublic}>Edit access</option>
                  </select>
                  <input
                    type="date"
                    value={shareLinkExpiresAt}
                    onChange={(event) => setShareLinkExpiresAt(event.target.value)}
                  />
                  <label className="share-public-toggle">
                    <input
                      type="checkbox"
                      checked={shareLinkIsPublic}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setShareLinkIsPublic(checked);
                        if (checked && shareLinkPermission === 'edit') {
                          setShareLinkPermission('view');
                        }
                      }}
                    />
                    Public view
                  </label>
                  <button type="button" className="btn secondary" onClick={handleCreateShareLink}>
                    Create link
                  </button>
                </div>
                {shareLinksLoading ? (
                  <p className="muted">Loading links...</p>
                ) : shareLinks.length === 0 ? (
                  <p className="muted">No share links created.</p>
                ) : (
                  shareLinks.map((link) => (
                    <div key={link.id} className="share-row">
                      <div>
                        <p className="share-user">{link.permission} link</p>
                        <span className="muted">
                          {link.is_public ? 'Public' : 'Private'} - {link.expires_at ? `Expires ${formatDateShort(link.expires_at)}` : 'No expiry'}
                        </span>
                      </div>
                      <div className="share-link-actions">
                        <select
                          className="share-permission-select"
                          value={link.permission}
                          onChange={(event) => handleUpdateShareLink(link.id, { permission: event.target.value })}
                        >
                          <option value="view">View</option>
                          <option value="clone">Clone</option>
                          <option value="edit" disabled={link.is_public}>Edit</option>
                        </select>
                        <label className="share-public-toggle">
                          <input
                            type="checkbox"
                            checked={!!link.is_public}
                            onChange={(event) =>
                              handleUpdateShareLink(link.id, {
                                isPublic: event.target.checked,
                                permission: event.target.checked && link.permission === 'edit' ? 'view' : link.permission,
                              })
                            }
                          />
                          Public
                        </label>
                        <button type="button" onClick={() => handleCopyShareLink(link.token, link.is_public)}>
                          Copy
                        </button>
                        <button type="button" className="link-danger" onClick={() => handleRevokeShareLink(link.id)}>
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="share-list">

                <h3>Shared with</h3>
                {shareLoading ? (
                  <p className="muted">Loading share list...</p>
                ) : shareList.length === 0 ? (
                  <p className="muted">No shares yet.</p>
                ) : (
                  shareList.map((share) => (
                    <div key={share.id} className="share-row">
                      <div>
                        <p className="share-user">{share.shared_with_email || share.shared_with_user_id}</p>
                        <span className="muted">Permission</span>
                      </div>
                      <div className="share-link-actions">
                        <select
                          className="share-permission-select"
                          value={share.permission}
                          onChange={(event) => handleUpdateSharePermission(share.id, event.target.value)}
                        >
                          <option value="view">View</option>
                          <option value="clone">Clone</option>
                          <option value="edit">Edit</option>
                        </select>
                        <button type="button" className="link-danger" onClick={() => handleRevokeShare(share.id)}>
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
