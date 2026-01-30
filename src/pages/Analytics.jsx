import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardLayout from '../components/DashboardLayout.jsx';
import '../styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Analytics() {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d, all

  useEffect(() => {
    fetchAgents();
  }, [user]);

  useEffect(() => {
    if (selectedAgentId) {
      fetchAnalytics(selectedAgentId, timeRange);
    }
  }, [selectedAgentId, timeRange]);

  const fetchAgents = async () => {
    if (!user?.id) return;
    
    const { data, error } = await supabase
      .from('agent_personas')
      .select('id, name, description, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAgents(data);
      if (data.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data[0].id);
      }
    }
  };

  const fetchAnalytics = async (agentId, range) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/agents/${agentId}/analytics?timeRange=${range}&userId=${user?.id}`);
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

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Intelligence Hub</p>
      <h1>Analytics Dashboard</h1>
      <p className="dashboard-sub">Track performance, usage, and quality metrics for your AI agents.</p>
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
        <div className="analytics-controls">
          <div className="agent-selector">
            <label>Select Agent</label>
            <select value={selectedAgentId || ''} onChange={(e) => setSelectedAgentId(e.target.value)}>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || 'Untitled Agent'}
                </option>
              ))}
            </select>
          </div>

          <div className="time-range-selector">
            <label>Time Range</label>
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
        </div>

        {loading ? (
          <div className="analytics-loading">
            <p>Loading analytics...</p>
          </div>
        ) : analytics ? (
          <div className="analytics-grid">
            {/* Overview Cards */}
            <div className="analytics-section">
              <h2>📊 Overview</h2>
              <div className="stats-cards">
                <div className="stat-card">
                  <span className="stat-label">Total Conversations</span>
                  <span className="stat-value">{analytics.totalConversations || 0}</span>
                  <span className="stat-trend">
                    {analytics.conversationGrowth > 0 ? '↗' : '↘'} {Math.abs(analytics.conversationGrowth || 0)}%
                  </span>
                </div>

                <div className="stat-card">
                  <span className="stat-label">Total Messages</span>
                  <span className="stat-value">{analytics.totalMessages || 0}</span>
                  <span className="stat-helper">{analytics.avgMessagesPerConvo?.toFixed(1) || 0} per conversation</span>
                </div>

                <div className="stat-card">
                  <span className="stat-label">Avg Response Time</span>
                  <span className="stat-value">{analytics.avgResponseTime ? `${(analytics.avgResponseTime / 1000).toFixed(2)}s` : 'N/A'}</span>
                  <span className="stat-helper">Last {timeRange}</span>
                </div>

                <div className="stat-card">
                  <span className="stat-label">User Satisfaction</span>
                  <span className="stat-value">{analytics.satisfactionRate ? `${analytics.satisfactionRate}%` : 'N/A'}</span>
                  <span className="stat-helper">Based on ratings</span>
                </div>
              </div>
            </div>

            {/* Quality Metrics */}
            <div className="analytics-section">
              <h2>⭐ Quality Metrics</h2>
              <div className="quality-grid">
                <div className="quality-card">
                  <span className="quality-label">Positive Ratings</span>
                  <div className="quality-bar">
                    <div 
                      className="quality-fill positive" 
                      style={{ width: `${analytics.positiveRatings || 0}%` }}
                    />
                  </div>
                  <span className="quality-value">{analytics.positiveRatings || 0}%</span>
                </div>

                <div className="quality-card">
                  <span className="quality-label">Negative Ratings</span>
                  <div className="quality-bar">
                    <div 
                      className="quality-fill negative" 
                      style={{ width: `${analytics.negativeRatings || 0}%` }}
                    />
                  </div>
                  <span className="quality-value">{analytics.negativeRatings || 0}%</span>
                </div>

                <div className="quality-card">
                  <span className="quality-label">Avg Quality Score</span>
                  <div className="quality-bar">
                    <div 
                      className="quality-fill neutral" 
                      style={{ width: `${(analytics.avgQualityScore || 0)}%` }}
                    />
                  </div>
                  <span className="quality-value">{analytics.avgQualityScore?.toFixed(1) || 0}/100</span>
                </div>

                <div className="quality-card">
                  <span className="quality-label">Relevance Score</span>
                  <div className="quality-bar">
                    <div 
                      className="quality-fill neutral" 
                      style={{ width: `${(analytics.avgRelevanceScore || 0)}%` }}
                    />
                  </div>
                  <span className="quality-value">{analytics.avgRelevanceScore?.toFixed(1) || 0}/100</span>
                </div>
              </div>
            </div>

            {/* Engagement Metrics */}
            <div className="analytics-section">
              <h2>🎯 Engagement</h2>
              <div className="engagement-grid">
                <div className="engagement-card">
                  <span className="engagement-icon">🔄</span>
                  <span className="engagement-value">{analytics.followUpRate || 0}%</span>
                  <span className="engagement-label">Follow-up Rate</span>
                </div>

                <div className="engagement-card">
                  <span className="engagement-icon">⏱️</span>
                  <span className="engagement-value">{analytics.avgEngagementTime ? `${(analytics.avgEngagementTime / 1000).toFixed(1)}s` : 'N/A'}</span>
                  <span className="engagement-label">Avg Engagement Time</span>
                </div>

                <div className="engagement-card">
                  <span className="engagement-icon">💬</span>
                  <span className="engagement-value">{analytics.conversationContinuationRate || 0}%</span>
                  <span className="engagement-label">Continuation Rate</span>
                </div>

                <div className="engagement-card">
                  <span className="engagement-icon">🔁</span>
                  <span className="engagement-value">{analytics.rephrasedQuestionRate || 0}%</span>
                  <span className="engagement-label">Rephrased Questions</span>
                </div>
              </div>
            </div>

            {/* A/B Test Results */}
            {analytics.abTestResults && analytics.abTestResults.length > 0 && (
              <div className="analytics-section">
                <h2>🧪 A/B Test Results</h2>
                <div className="ab-test-list">
                  {analytics.abTestResults.map((test, idx) => (
                    <div key={idx} className="ab-test-card">
                      <h3>{test.testName}</h3>
                      <div className="ab-comparison">
                        <div className="ab-version">
                          <span className="version-label">Version A</span>
                          <span className="version-score">{test.versionAScore?.toFixed(1) || 0}</span>
                          <span className="version-count">{test.versionACount} tests</span>
                        </div>
                        <div className="ab-divider">vs</div>
                        <div className="ab-version">
                          <span className="version-label">Version B</span>
                          <span className="version-score">{test.versionBScore?.toFixed(1) || 0}</span>
                          <span className="version-count">{test.versionBCount} tests</span>
                        </div>
                      </div>
                      <div className="ab-winner">
                        {test.winner === 'A' && <span className="winner-badge">🏆 Version A Leading</span>}
                        {test.winner === 'B' && <span className="winner-badge">🏆 Version B Leading</span>}
                        {test.winner === 'tie' && <span className="winner-badge">🤝 Statistical Tie</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Patterns */}
            <div className="analytics-section">
              <h2>📈 Usage Patterns</h2>
              <div className="usage-list">
                <div className="usage-item">
                  <span className="usage-label">Peak Usage Hours</span>
                  <span className="usage-value">{analytics.peakHours || 'N/A'}</span>
                </div>
                <div className="usage-item">
                  <span className="usage-label">Most Active Day</span>
                  <span className="usage-value">{analytics.mostActiveDay || 'N/A'}</span>
                </div>
                <div className="usage-item">
                  <span className="usage-label">Average Session Length</span>
                  <span className="usage-value">{analytics.avgSessionLength ? `${analytics.avgSessionLength.toFixed(1)} min` : 'N/A'}</span>
                </div>
                <div className="usage-item">
                  <span className="usage-label">Total Active Users</span>
                  <span className="usage-value">{analytics.totalUsers || 0}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="analytics-empty">
            <p>No analytics data available yet.</p>
            <p className="muted">Start chatting with your agent to generate analytics.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}