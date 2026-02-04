import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardLayout from '../components/DashboardLayout.jsx';
import '../styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Analytics() {
  const { user, session } = useAuth();
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usageSummary, setUsageSummary] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('7d');

  const authHeaders = useMemo(() => {
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session?.access_token]);

  useEffect(() => {
    fetchAgents();
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (user?.id) {
      fetchUsageSummary(timeRange);
    } else {
      setUsageSummary(null);
    }
  }, [user?.id, timeRange]);

  useEffect(() => {
    if (selectedAgentId) {
      fetchAnalytics(selectedAgentId, timeRange);
    }
  }, [selectedAgentId, timeRange]);

  const fetchAgents = async () => {
    if (!user?.id || !session?.access_token) {
      setAgents([]);
      setSelectedAgentId(null);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/agents`, {
        headers: {
          ...authHeaders,
        },
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload?.error || 'Failed to load agents.');
      }

      const data = Array.isArray(payload.agents) ? payload.agents : [];
      setAgents(data);
      if (data.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
      setSelectedAgentId(null);
    }
  };

  const fetchAnalytics = async (agentId, range) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/agents/${agentId}/analytics?timeRange=${range}&userId=${user?.id}`,
      );
      const data = await res.json();

      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageSummary = async (range) => {
    setUsageLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/analytics/usage-summary?timeRange=${range}&userId=${user?.id}`);
      const data = await res.json();
      if (data.success) {
        setUsageSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching usage summary:', error);
    } finally {
      setUsageLoading(false);
    }
  };

  const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value || 0);
  const formatDateShort = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const activitySeries = analytics?.activitySeries || [];
  const summarySeries = usageSummary?.activitySeries || [];
  const activeSeries = summarySeries.length ? summarySeries : activitySeries;
  const activeMax = activeSeries.length
    ? Math.max(...activeSeries.map((point) => point.responses || point.messages || 0))
    : 0;

  const ringValue = Math.min(100, Math.max(0, analytics?.satisfactionRate ?? analytics?.positiveRatings ?? 0));
  const ringLabel = analytics?.satisfactionRate ? 'Satisfaction' : 'Positive ratings';

  const chartPoints = useMemo(() => {
    if (!activeSeries.length) return '';
    const max = activeMax || 1;
    return activeSeries
      .map((point, index) => {
        const value = point.responses || point.messages || 0;
        const x = activeSeries.length === 1 ? 50 : (index / (activeSeries.length - 1)) * 100;
        const y = 100 - Math.min(100, (value / max) * 100);
        return `${x},${y}`;
      })
      .join(' ');
  }, [activeSeries, activeMax]);

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Analytics</p>
      <h1>Usage Dashboard</h1>
      <p className="dashboard-sub">A live view of sessions, tokens, and agent engagement.</p>
    </div>
  );

  const headerActions = (
    <div className="page-actions">
      <Link className="btn secondary" to="/home">
        Back to overview
      </Link>
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent} actions={headerActions}>
      <div className="analytics-page">
        <div className="analytics-toolbar">
          <div>
            <p className="analytics-breadcrumb">Analytics / Dashboard</p>
            <h2 className="analytics-title">AI Usage Control Room</h2>
          </div>
          <div className="analytics-toolbar-actions">
            <div className="agent-selector">
              <label>Agent</label>
              <select value={selectedAgentId || ''} onChange={(event) => setSelectedAgentId(event.target.value)}>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || 'Untitled Agent'}
                  </option>
                ))}
              </select>
            </div>
            <div className="time-range-selector">
              <label>Time range</label>
              <div className="time-range-buttons">
                <button
                  className={`btn ${timeRange === '7d' ? 'primary' : 'ghost'} compact`}
                  onClick={() => setTimeRange('7d')}
                >
                  7 Days
                </button>
                <button
                  className={`btn ${timeRange === '30d' ? 'primary' : 'ghost'} compact`}
                  onClick={() => setTimeRange('30d')}
                >
                  30 Days
                </button>
                <button
                  className={`btn ${timeRange === '90d' ? 'primary' : 'ghost'} compact`}
                  onClick={() => setTimeRange('90d')}
                >
                  90 Days
                </button>
                <button
                  className={`btn ${timeRange === 'all' ? 'primary' : 'ghost'} compact`}
                  onClick={() => setTimeRange('all')}
                >
                  All Time
                </button>
              </div>
            </div>
            <button className="btn secondary compact" type="button" onClick={() => fetchUsageSummary(timeRange)}>
              Refresh
            </button>
          </div>
        </div>

        {(loading || usageLoading) && (
          <div className="analytics-loading">
            <p>Loading analytics...</p>
          </div>
        )}

        <div className="analytics-tiles">
          <div className="tile-card">
            <div className="tile-label">Sessions</div>
            <div className="tile-value">{formatNumber(usageSummary?.totals?.totalConversations)}</div>
            <div className="tile-sub">Across all agents</div>
          </div>
          <div className="tile-card">
            <div className="tile-label">Messages</div>
            <div className="tile-value">{formatNumber(usageSummary?.totals?.totalMessages)}</div>
            <div className="tile-sub">User + assistant</div>
          </div>
          <div className="tile-card">
            <div className="tile-label">Tokens</div>
            <div className="tile-value">{formatNumber(usageSummary?.totals?.totalTokensEstimate)}</div>
            <div className="tile-sub">Estimated usage</div>
          </div>
          <div className="tile-card highlight">
            <div className="tile-label">Active agents</div>
            <div className="tile-value">{formatNumber(usageSummary?.totals?.activeAgents)}</div>
            <div className="tile-sub">Last activity {formatDateShort(usageSummary?.totals?.lastActive)}</div>
          </div>
        </div>

        <div className="analytics-panels">
          <div className="panel panel-wide">
            <div className="panel-header">
              <div>
                <h3>Token usage trend</h3>
                <p>Responses per day with token volume proxy.</p>
              </div>
              <span className="panel-meta">{timeRange === 'all' ? 'All time' : `Last ${timeRange}`}</span>
            </div>
            {activeSeries.length ? (
              <div className="line-chart">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline className="line-chart-path" points={chartPoints} />
                </svg>
                <div className="line-chart-grid">
                  {activeSeries.map((point) => (
                    <div key={point.date} className="line-point">
                      <span className="line-label">{formatDateShort(point.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="analytics-empty">
                <p>No activity yet.</p>
                <p className="muted">Start chatting with your agents to generate charts.</p>
              </div>
            )}
          </div>
          <div className="panel panel-narrow">
            <div className="panel-header">
              <div>
                <h3>Quality status</h3>
                <p>{ringLabel}</p>
              </div>
              <span className="panel-meta">Agent view</span>
            </div>
            <div className="ring-wrapper">
              <div className="ring-chart" style={{ '--ring-value': `${ringValue}%` }}>
                <span>{ringValue}%</span>
              </div>
              <div className="ring-details">
                <div>
                  <p>Positive ratings</p>
                  <strong>{analytics?.positiveRatings || 0}%</strong>
                </div>
                <div>
                  <p>Negative ratings</p>
                  <strong>{analytics?.negativeRatings || 0}%</strong>
                </div>
                <div>
                  <p>Avg response</p>
                  <strong>{analytics?.avgResponseTime ? `${(analytics.avgResponseTime / 1000).toFixed(2)}s` : 'N/A'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="analytics-panels">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>{selectedAgent?.name || 'Agent'} snapshot</h3>
                <p>Per-agent usage and response health.</p>
              </div>
            </div>
            <div className="panel-metrics">
              <div>
                <p>Conversations</p>
                <strong>{formatNumber(analytics?.totalConversations)}</strong>
              </div>
              <div>
                <p>Messages per conversation</p>
                <strong>{analytics?.avgMessagesPerConvo?.toFixed(1) || 0}</strong>
              </div>
              <div>
                <p>Tokens estimated</p>
                <strong>{formatNumber(analytics?.totalTokensEstimate)}</strong>
              </div>
              <div>
                <p>Usage frequency</p>
                <strong>{analytics?.usageFrequencyPerDay || 0}/day</strong>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Usage patterns</h3>
                <p>Temporal signals from conversations.</p>
              </div>
            </div>
            <div className="panel-list">
              <div>
                <span>Peak hours</span>
                <strong>{analytics?.peakHours || 'N/A'}</strong>
              </div>
              <div>
                <span>Most active day</span>
                <strong>{analytics?.mostActiveDay || 'N/A'}</strong>
              </div>
              <div>
                <span>Session length</span>
                <strong>{analytics?.avgSessionLength ? `${analytics.avgSessionLength.toFixed(1)} min` : 'N/A'}</strong>
              </div>
              <div>
                <span>Active users</span>
                <strong>{analytics?.totalUsers || 0}</strong>
              </div>
            </div>
          </div>
        </div>

        {usageSummary?.perAgent?.length > 0 && (
          <div className="analytics-table">
            <div className="panel-header">
              <div>
                <h3>Agent usage table</h3>
                <p>Conversation volume and token estimates by agent.</p>
              </div>
            </div>
            <div className="usage-table">
              <div className="usage-table-header">
                <span>Agent</span>
                <span>Conversations</span>
                <span>Messages</span>
                <span>Tokens (est.)</span>
                <span>Usage / day</span>
                <span>Last active</span>
              </div>
              {usageSummary.perAgent.map((agent) => (
                <div key={agent.agentId} className="usage-table-row">
                  <span className="usage-agent">{agent.name}</span>
                  <span>{formatNumber(agent.conversations)}</span>
                  <span>{formatNumber(agent.messages)}</span>
                  <span>{formatNumber(agent.tokens)}</span>
                  <span>{agent.usageFrequencyPerDay || 0}</span>
                  <span>{formatDateShort(agent.lastActive)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
