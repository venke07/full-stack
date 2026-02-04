import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TOOL_LABELS = {
  web: 'Web Search',
  rfd: 'RFD',
  deep: 'Deep Research',
};

const deriveTagsFromAgent = (agent) => {
  if (!agent) return [];
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
    tags.push('Objective');
  }
  if (agent.model_label) {
    tags.push(agent.model_label);
  }
  return [...new Set(tags)];
};

export default function PublicAgent() {
  const { user } = useAuth();
  const [agent, setAgent] = useState(null);
  const [permission, setPermission] = useState('view');
  const [status, setStatus] = useState('loading');
  const [banner, setBanner] = useState(null);

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setStatus('error');
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/public/agents/${token}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setStatus('error');
          return;
        }
        setAgent(data.agent);
        setPermission(data.permission || 'view');
        setStatus('ready');
      } catch (error) {
        setStatus('error');
      }
    };

    load();
  }, [token]);

  const canEdit = permission === 'edit';

  if (status === 'loading') {
    return (
      <div className="public-agent">
        <div className="public-card">
          <h1>Loading agent…</h1>
          <p className="muted">Fetching public profile.</p>
        </div>
      </div>
    );
  }

  if (status === 'error' || !agent) {
    return (
      <div className="public-agent">
        <div className="public-card">
          <h1>Agent not found</h1>
          <p className="muted">This public link is invalid or expired.</p>
          <Link className="btn secondary" to="/login">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="public-agent">
      <div className="public-card">
        <p className="eyebrow">Public agent</p>
        <h1>{agent.name || 'Untitled Agent'}</h1>
        <p className="public-desc">{agent.description || 'No description provided.'}</p>
        <div className="tag-deck">
          {deriveTagsFromAgent(agent).map((tag) => (
            <span key={tag} className="tag-pill">
              {tag}
            </span>
          ))}
        </div>
        {banner && <div className="dashboard-status info" style={{ marginTop: '12px' }}>{banner}</div>}
        <div className="public-actions">
          {canEdit && (
            <span className="badge">Edit access granted</span>
          )}
          {!user && (
            <Link className="btn secondary" to="/login">
              Sign in
            </Link>
          )}
          <Link className="btn ghost" to="/home">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
