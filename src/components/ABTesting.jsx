import React, { useState, useEffect } from 'react';
import './ABTesting.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const ABTesting = ({ agentId }) => {
  const [testSessions, setTestSessions] = useState([]);
  const [showNewTest, setShowNewTest] = useState(false);
  const [versions, setVersions] = useState([]);
  const [selectedVersionA, setSelectedVersionA] = useState('');
  const [selectedVersionB, setSelectedVersionB] = useState('');
  const [testName, setTestName] = useState('');
  const [sampleSize, setSampleSize] = useState(20);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (agentId) {
      loadVersions();
      loadTestSessions();
    }
  }, [agentId]);

  const loadVersions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents/${agentId}/prompt-versions`);
      const data = await res.json();
      if (data.versions) {
        setVersions(data.versions);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    }
  };

  const loadTestSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/agents/${agentId}/a-b-tests`);
      const data = await res.json();
      if (data.sessions) {
        setTestSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error loading test sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTest = async () => {
    if (!testName.trim() || !selectedVersionA || !selectedVersionB) {
      alert('Please fill in all fields');
      return;
    }

    if (selectedVersionA === selectedVersionB) {
      alert('Version A and B must be different');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/agents/${agentId}/a-b-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_a_id: selectedVersionA,
          version_b_id: selectedVersionB,
          test_name: testName,
          sample_size: sampleSize,
        }),
      });

      const data = await res.json();
      if (data.session) {
        setTestSessions([data.session, ...testSessions]);
        setTestName('');
        setSelectedVersionA('');
        setSelectedVersionB('');
        setSampleSize(20);
        setShowNewTest(false);
      }
    } catch (error) {
      console.error('Error creating test:', error);
      alert('Failed to create test');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (sessionId) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/a-b-tests/${sessionId}/statistics`);
      const data = await res.json();
      setSessionStats(data);
      setSelectedSession(sessionId);
    } catch (error) {
      console.error('Error loading test details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndTest = async (sessionId) => {
    if (!confirm('End this test? Results will be finalized.')) return;

    try {
      setLoading(true);
      await fetch(`${API_URL}/api/a-b-tests/${sessionId}/end`, {
        method: 'POST',
      });
      
      // Reload sessions
      await loadTestSessions();
      setSelectedSession(null);
      setSessionStats(null);
    } catch (error) {
      console.error('Error ending test:', error);
      alert('Failed to end test');
    } finally {
      setLoading(false);
    }
  };

  const renderStatistics = () => {
    if (!sessionStats) return null;

    const { version_a_stats, version_b_stats, winner } = sessionStats;

    return (
      <div className="test-statistics">
        <h3>📊 Test Results</h3>
        <div className="stats-comparison">
          <div className="stat-column">
            <h4>Version A</h4>
            <div className="stat-item">
              <span>Tests Completed:</span>
              <strong>{version_a_stats?.totalTests || 0}</strong>
            </div>
            <div className="stat-item">
              <span>Avg Rating:</span>
              <strong>{version_a_stats?.avgRating || 0} / 5</strong>
            </div>
            <div className="stat-item">
              <span>Quality Score:</span>
              <strong>{(version_a_stats?.avgQuality || 0).toFixed(2)}</strong>
            </div>
            <div className="stat-item">
              <span>Relevance:</span>
              <strong>{(version_a_stats?.avgRelevance || 0).toFixed(2)}</strong>
            </div>
            <div className="stat-item">
              <span>Avg Response Time:</span>
              <strong>{version_a_stats?.avgResponseTime?.toFixed(0) || 0}ms</strong>
            </div>
          </div>

          <div className="stat-divider"></div>

          <div className="stat-column">
            <h4>Version B</h4>
            <div className="stat-item">
              <span>Tests Completed:</span>
              <strong>{version_b_stats?.totalTests || 0}</strong>
            </div>
            <div className="stat-item">
              <span>Avg Rating:</span>
              <strong>{version_b_stats?.avgRating || 0} / 5</strong>
            </div>
            <div className="stat-item">
              <span>Quality Score:</span>
              <strong>{(version_b_stats?.avgQuality || 0).toFixed(2)}</strong>
            </div>
            <div className="stat-item">
              <span>Relevance:</span>
              <strong>{(version_b_stats?.avgRelevance || 0).toFixed(2)}</strong>
            </div>
            <div className="stat-item">
              <span>Avg Response Time:</span>
              <strong>{version_b_stats?.avgResponseTime?.toFixed(0) || 0}ms</strong>
            </div>
          </div>
        </div>

        {winner !== 'tie' && (
          <div className={`winner-badge winner-${winner}`}>
            🏆 Version {winner} is winning!
          </div>
        )}

        {winner === 'tie' && (
          <div className="winner-badge winner-tie">
            ⚖️ Results are tied - more data needed
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="a-b-testing">
      <div className="testing-header">
        <h3>⚔️ A/B Testing</h3>
        <button
          className="btn-primary btn-small"
          onClick={() => setShowNewTest(!showNewTest)}
          disabled={loading}
        >
          {showNewTest ? '✕ Cancel' : '+ New Test'}
        </button>
      </div>

      {showNewTest && (
        <div className="new-test-form">
          <input
            type="text"
            placeholder="Test name (e.g., 'Conciseness vs Detail')"
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            className="test-input"
          />

          <div className="form-row">
            <div className="form-group">
              <label>Version A</label>
              <select
                value={selectedVersionA}
                onChange={(e) => setSelectedVersionA(e.target.value)}
                className="test-select"
              >
                <option value="">Select version A</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_name} (v{v.version_number})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Version B</label>
              <select
                value={selectedVersionB}
                onChange={(e) => setSelectedVersionB(e.target.value)}
                className="test-select"
              >
                <option value="">Select version B</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.version_name} (v{v.version_number})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Sample Size</label>
            <input
              type="number"
              min="5"
              max="1000"
              value={sampleSize}
              onChange={(e) => setSampleSize(parseInt(e.target.value))}
              className="test-input"
            />
            <small>Number of tests before auto-completion</small>
          </div>

          <button
            className="btn-primary"
            onClick={handleCreateTest}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Start A/B Test'}
          </button>
        </div>
      )}

      <div className="tests-list">
        {testSessions.length === 0 ? (
          <p className="empty-message">No A/B tests yet. Create your first test above.</p>
        ) : (
          testSessions.map((session) => (
            <div key={session.id} className="test-session-card">
              <div className="session-header">
                <h4>{session.test_name}</h4>
                <span className={`status-badge status-${session.status}`}>
                  {session.status === 'completed' ? '✓' : '⏱'} {session.status}
                </span>
              </div>

              <div className="session-details">
                <div className="detail-item">
                  <span>Version A:</span>
                  <strong>{session.version_a?.version_name}</strong>
                </div>
                <div className="detail-item">
                  <span>Version B:</span>
                  <strong>{session.version_b?.version_name}</strong>
                </div>
                <div className="detail-item">
                  <span>Progress:</span>
                  <strong>{session.completed_tests || 0} / {session.sample_size}</strong>
                </div>
              </div>

              {selectedSession === session.id && sessionStats && renderStatistics()}

              <div className="session-actions">
                {selectedSession !== session.id && (
                  <button
                    className="btn-secondary btn-small"
                    onClick={() => handleViewDetails(session.id)}
                    disabled={loading}
                  >
                    View Results
                  </button>
                )}
                {selectedSession === session.id && (
                  <button
                    className="btn-secondary btn-small"
                    onClick={() => setSelectedSession(null)}
                  >
                    Hide Results
                  </button>
                )}
                {session.status === 'active' && (
                  <button
                    className="btn-danger btn-small"
                    onClick={() => handleEndTest(session.id)}
                    disabled={loading}
                  >
                    End Test
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ABTesting;
