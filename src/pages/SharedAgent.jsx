import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const permissionCopy = {
  view: {
    title: 'View-only access',
    subtitle: 'You can view and chat with this agent.',
  },
  clone: {
    title: 'Clone-only access',
    subtitle: 'You can clone this agent into your workspace.',
  },
  edit: {
    title: 'Editor access',
    subtitle: 'You can edit this agent and publish updates.',
  },
};

export default function SharedAgentPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [share, setShare] = useState(null);
  const [agent, setAgent] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const loadShare = async () => {
      if (!supabase || !token) {
        setStatus('Supabase not configured.');
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('agent_share_links')
        .select('id, agent_id, permission, created_by, active, created_at')
        .eq('token', token)
        .eq('active', true)
        .maybeSingle();

      if (error || !data) {
        setStatus('Share link not found or disabled.');
        setShare(null);
        setLoading(false);
        return;
      }

      setShare(data);
      setLoading(false);
    };

    loadShare();
  }, [token]);

  useEffect(() => {
    const loadAgent = async () => {
      if (!share?.agent_id || !supabase || !user?.id) {
        return;
      }

      const accessResponse = await supabase
        .from('agent_access')
        .select('id, role')
        .eq('agent_id', share.agent_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (accessResponse.data) {
        setHasAccess(true);
        const { data, error } = await supabase
          .from('agent_personas')
          .select(
            'id, name, description, status, tools, guardrails, model_label, model_id, model_provider, created_at',
          )
          .eq('id', share.agent_id)
          .single();

        if (!error) {
          setAgent(data);
        }
      }
    };

    loadAgent();
  }, [share?.agent_id, user?.id]);

  const permissionMeta = permissionCopy[share?.permission] || permissionCopy.view;

  const handleAccept = async () => {
    if (!supabase || !user?.id || !share?.agent_id) {
      setStatus('Sign in to accept access.');
      return;
    }

    setIsAccepting(true);
    const { error } = await supabase
      .from('agent_access')
      .insert([
        {
          agent_id: share.agent_id,
          user_id: user.id,
          role: share.permission === 'edit' ? 'editor' : share.permission === 'clone' ? 'cloner' : 'viewer',
          created_at: new Date().toISOString(),
        },
      ]);

    if (error && !error.message?.includes('duplicate')) {
      setStatus(`Unable to accept access: ${error.message}`);
    } else {
      setStatus('Access granted. This agent is now in your dashboard.');
      setHasAccess(true);
      const { data } = await supabase
        .from('agent_personas')
        .select(
          'id, name, description, status, tools, guardrails, model_label, model_id, model_provider, created_at',
        )
        .eq('id', share.agent_id)
        .single();
      setAgent(data || null);
    }
    setIsAccepting(false);
  };

  const handleClone = async () => {
    if (!supabase || !user?.id || !share?.agent_id) {
      setStatus('Sign in to clone this agent.');
      return;
    }

    if (!agent) {
      setStatus('Load the agent first.');
      return;
    }

    const payload = {
      user_id: user.id,
      name: `${agent.name || 'Shared agent'} (Clone)`,
      description: agent.description,
      status: 'draft',
      tools: agent.tools,
      guardrails: agent.guardrails,
      model_id: agent.model_id,
      model_label: agent.model_label,
      model_provider: agent.model_provider,
      created_at: new Date().toISOString(),
      shared_source_id: agent.id,
    };

    const { error } = await supabase.from('agent_personas').insert([payload]);
    if (error) {
      setStatus(`Clone failed: ${error.message}`);
      return;
    }

    navigate('/home');
  };

  const actionLabel = useMemo(() => {
    if (!share) return 'Add to workspace';
    if (share.permission === 'edit') return 'Add to workspace (Editor)';
    if (share.permission === 'clone') return 'Add to workspace (Cloner)';
    return 'Add to workspace (Viewer)';
  }, [share]);

  if (loading) {
    return (
      <div className="share-page">
        <div className="share-card">
          <h2>Loading shared agent…</h2>
        </div>
      </div>
    );
  }

  if (!share) {
    return (
      <div className="share-page">
        <div className="share-card">
          <h2>Share link unavailable</h2>
          <p className="muted">This link is invalid or has been disabled.</p>
          <Link className="btn ghost compact" to="/login">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="share-page">
      <div className="share-card">
        <p className="eyebrow">Shared Agent</p>
        <h2>{permissionMeta.title}</h2>
        <p className="muted">{permissionMeta.subtitle}</p>
        {status && <div className="status-bar">{status}</div>}
        {!user && (
          <div className="share-actions">
            <Link className="btn primary" to="/login">
              Sign in to accept
            </Link>
            <Link className="btn ghost compact" to="/signup">
              Create account
            </Link>
          </div>
        )}
        {user && !hasAccess && (
          <div className="share-actions">
            <button className="btn primary" type="button" onClick={handleAccept} disabled={isAccepting}>
              {isAccepting ? 'Granting…' : actionLabel}
            </button>
            <Link className="btn ghost compact" to="/home">
              Go to dashboard
            </Link>
          </div>
        )}
        {user && hasAccess && (
          <div className="share-summary">
            <div>
              <b>{agent?.name || 'Shared agent'}</b>
              <p className="muted">{agent?.description || 'No description provided.'}</p>
            </div>
            <div className="share-actions">
              {share.permission === 'clone' && (
                <button className="btn secondary" type="button" onClick={handleClone}>
                  Clone to workspace
                </button>
              )}
              <Link className="btn primary" to="/home">
                Open in dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
