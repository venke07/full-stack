import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';

const DAYS = 7;

const formatNumber = (value) => new Intl.NumberFormat().format(value || 0);
const formatCompact = (value) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);

const toDateKey = (date) => date.toISOString().slice(0, 10);
const toShortLabel = (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [usageEvents, setUsageEvents] = useState([]);
  const [agents, setAgents] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUsage = async () => {
      if (!supabase || !user?.id) {
        setStatus('Supabase is not configured. Add VITE_SUPABASE_ANON_KEY to enable analytics.');
        setUsageEvents([]);
        setAgents([]);
        return;
      }

      setLoading(true);
      setStatus('');

      const [usageResponse, agentResponse] = await Promise.all([
        supabase
          .from('agent_usage_events')
          .select('id, agent_id, model_id, created_at, message_count, total_tokens_est, source')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('agent_personas')
          .select('id, name')
          .eq('user_id', user.id),
      ]);

      if (usageResponse.error) {
        setStatus(`Unable to load analytics: ${usageResponse.error.message}`);
        setUsageEvents([]);
      } else {
        setUsageEvents(usageResponse.data ?? []);
      }

      if (agentResponse.error) {
        setAgents([]);
      } else {
        setAgents(agentResponse.data ?? []);
      }

      setLoading(false);
    };

    loadUsage();
  }, [user?.id]);

  const agentNameMap = useMemo(() => {
    const map = new Map();
    agents.forEach((agent) => {
      map.set(agent.id, agent.name || 'Unnamed agent');
    });
    return map;
  }, [agents]);

  const summary = useMemo(() => {
    const totalConversations = usageEvents.length;
    const totalTokens = usageEvents.reduce((sum, event) => sum + (event.total_tokens_est || 0), 0);
    const totalMessages = usageEvents.reduce((sum, event) => sum + (event.message_count || 0), 0);
    const uniqueAgents = new Set(usageEvents.map((event) => event.agent_id)).size;
    const avgMessages = totalConversations ? totalMessages / totalConversations : 0;

    return {
      totalConversations,
      totalTokens,
      uniqueAgents,
      avgMessages,
    };
  }, [usageEvents]);

  const activity = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: DAYS }).map((_, idx) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (DAYS - 1 - idx));
      return { key: toDateKey(date), label: toShortLabel(date), count: 0 };
    });

    const dayMap = new Map(days.map((entry) => [entry.key, entry]));
    usageEvents.forEach((event) => {
      if (!event.created_at) return;
      const key = toDateKey(new Date(event.created_at));
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.count += 1;
      }
    });

    const max = Math.max(1, ...days.map((entry) => entry.count));
    return {
      max,
      points: days.map((entry) => ({ ...entry, height: Math.round((entry.count / max) * 100) })),
    };
  }, [usageEvents]);

  const agentUsage = useMemo(() => {
    const usageMap = new Map();
    usageEvents.forEach((event) => {
      const entry = usageMap.get(event.agent_id) || {
        agentId: event.agent_id,
        name: agentNameMap.get(event.agent_id) || 'Unknown agent',
        conversations: 0,
        tokens: 0,
        lastActive: null,
      };
      entry.conversations += 1;
      entry.tokens += event.total_tokens_est || 0;
      const current = event.created_at ? new Date(event.created_at) : null;
      if (current && (!entry.lastActive || current > entry.lastActive)) {
        entry.lastActive = current;
      }
      usageMap.set(event.agent_id, entry);
    });

    return Array.from(usageMap.values()).sort((a, b) => b.conversations - a.conversations);
  }, [usageEvents, agentNameMap]);

  const recentActivity = useMemo(() => usageEvents.slice(0, 8), [usageEvents]);

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <div>
          <p className="eyebrow">Usage Intelligence</p>
          <h1>Analytics Dashboard</h1>
          <p className="dashboard-sub">Track agent usage trends, token estimates, and response activity.</p>
        </div>
        <div className="header-actions">
          <Link className="btn ghost compact" to="/home">
            Back to Dashboard
          </Link>
        </div>
      </header>

      {status && <div className="dashboard-status error">{status}</div>}

      <section className="analytics-summary">
        <div className="summary-card">
          <p>Total Conversations</p>
          <h3>{formatNumber(summary.totalConversations)}</h3>
          <span className="summary-foot">Captured across all agents</span>
        </div>
        <div className="summary-card">
          <p>Token Estimate</p>
          <h3>{formatCompact(summary.totalTokens)}</h3>
          <span className="summary-foot">Prompt + response tokens</span>
        </div>
        <div className="summary-card">
          <p>Active Agents</p>
          <h3>{formatNumber(summary.uniqueAgents)}</h3>
          <span className="summary-foot">Agents with activity</span>
        </div>
        <div className="summary-card">
          <p>Avg. Messages</p>
          <h3>{summary.avgMessages.toFixed(1)}</h3>
          <span className="summary-foot">Per conversation</span>
        </div>
      </section>

      <section className="analytics-grid">
        <div className="analytics-card">
          <div className="card-header">
            <h3>Response Activity</h3>
            <span className="muted">Last {DAYS} days</span>
          </div>
          <div className="activity-chart">
            {activity.points.map((point) => (
              <div key={point.key} className="activity-bar">
                <div className="bar-fill" style={{ height: `${point.height}%` }} />
                <span>{point.label}</span>
              </div>
            ))}
          </div>
          <div className="activity-meta">
            <span>Peak: {activity.max}</span>
            <span>Total: {summary.totalConversations}</span>
          </div>
        </div>

        <div className="analytics-card">
          <div className="card-header">
            <h3>Agent Usage</h3>
            <span className="muted">By conversations</span>
          </div>
          {agentUsage.length === 0 ? (
            <p className="muted">No usage events yet.</p>
          ) : (
            <div className="usage-table">
              <div className="usage-row usage-head">
                <span>Agent</span>
                <span>Conversations</span>
                <span>Tokens</span>
                <span>Last Active</span>
              </div>
              {agentUsage.slice(0, 6).map((entry) => (
                <div key={entry.agentId} className="usage-row">
                  <span>{entry.name}</span>
                  <span>{formatNumber(entry.conversations)}</span>
                  <span>{formatCompact(entry.tokens)}</span>
                  <span>{entry.lastActive ? entry.lastActive.toLocaleDateString() : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="analytics-card">
          <div className="card-header">
            <h3>Recent Activity</h3>
            <span className="muted">Latest events</span>
          </div>
          {recentActivity.length === 0 ? (
            <p className="muted">Waiting for new conversations.</p>
          ) : (
            <ul className="activity-list">
              {recentActivity.map((event) => (
                <li key={event.id}>
                  <div>
                    <b>{agentNameMap.get(event.agent_id) || 'Unknown agent'}</b>
                    <p className="muted">{event.model_id || 'Model'}</p>
                  </div>
                  <div className="activity-right">
                    <span>{formatCompact(event.total_tokens_est)}</span>
                    <span>{event.created_at ? new Date(event.created_at).toLocaleTimeString() : ''}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {loading && <div className="dashboard-status info">Loading analytics...</div>}
    </div>
  );
}
