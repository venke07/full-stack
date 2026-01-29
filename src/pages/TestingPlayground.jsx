import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardLayout from '../components/DashboardLayout.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function TestingPlayground() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentIdParam = searchParams.get('agentId');

  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [testPrompt, setTestPrompt] = useState('');
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [numRuns, setNumRuns] = useState(3);
  const [ratingFilter, setRatingFilter] = useState('all');

  // Load agents
  useEffect(() => {
    loadAgents();
  }, [user]);

  // Pre-select agent if passed as param
  useEffect(() => {
    if (agentIdParam && agents.length > 0) {
      const agent = agents.find((a) => a.id === agentIdParam);
      if (agent) {
        setSelectedAgent(agent);
      }
    }
  }, [agentIdParam, agents]);

  const loadAgents = async () => {
    if (!supabase || !user?.id) return;
    try {
      const { data, error } = await supabase
        .from('agent_personas')
        .select('id, name, description, status, system_prompt, model_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const runTest = async () => {
    if (!selectedAgent || !testPrompt.trim()) {
      alert('Select an agent and enter a test prompt');
      return;
    }

    setIsRunning(true);
    const newResults = [];

    for (let i = 0; i < numRuns; i++) {
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: selectedAgent.model_id,
            messages: [
              {
                role: 'system',
                content: selectedAgent.system_prompt || '',
              },
              {
                role: 'user',
                content: testPrompt,
              },
            ],
            temperature: 0.7,
          }),
        });

        if (!response.ok) throw new Error('Chat request failed');
        const data = await response.json();

        newResults.push({
          id: `test-${Date.now()}-${i}`,
          runNumber: i + 1,
          prompt: testPrompt,
          response: data.reply || 'No response',
          timestamp: new Date(),
          helpfulness: 0,
          accuracy: 0,
          tone: 0,
          notes: '',
        });
      } catch (error) {
        console.error(`Test run ${i + 1} failed:`, error);
        newResults.push({
          id: `test-${Date.now()}-${i}`,
          runNumber: i + 1,
          prompt: testPrompt,
          response: `❌ Error: ${error.message}`,
          timestamp: new Date(),
          helpfulness: 0,
          accuracy: 0,
          tone: 0,
          notes: 'Test failed',
        });
      }
    }

    setTestResults([...newResults, ...testResults]);
    setIsRunning(false);
  };

  const updateTestResult = (resultId, field, value) => {
    setTestResults((prev) =>
      prev.map((result) =>
        result.id === resultId ? { ...result, [field]: value } : result
      )
    );
  };

  const deleteTestResult = (resultId) => {
    setTestResults((prev) => prev.filter((r) => r.id !== resultId));
  };

  const getAverageRating = (field) => {
    if (testResults.length === 0) return 0;
    const sum = testResults.reduce((acc, r) => acc + (r[field] || 0), 0);
    return (sum / testResults.length).toFixed(1);
  };

  const getConsistencyScore = () => {
    if (testResults.length < 2) return '-';
    const helpfulness = testResults.map((r) => r.helpfulness);
    const accuracy = testResults.map((r) => r.accuracy);
    const tone = testResults.map((r) => r.tone);

    const stdDev = (values) => {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / values.length;
      return Math.sqrt(variance);
    };

    const avgStdDev = (stdDev(helpfulness) + stdDev(accuracy) + stdDev(tone)) / 3;
    const consistency = Math.max(0, 100 - avgStdDev * 10);
    return consistency.toFixed(0);
  };

  const filteredResults = testResults.filter((result) => {
    if (ratingFilter === 'rated') return result.helpfulness > 0 || result.accuracy > 0;
    if (ratingFilter === 'unrated') return result.helpfulness === 0 && result.accuracy === 0;
    return true;
  });

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Quality Lab</p>
      <h1>Testing Playground</h1>
      <p className="dashboard-sub">Run consistency sweeps, capture subjective ratings, and benchmark agents before launch.</p>
    </div>
  );

  const headerActions = (
    <div className="page-actions">
      <button type="button" className="btn secondary" onClick={() => navigate('/builder')}>
        Open builder
      </button>
      <Link className="btn secondary" to="/home">
        Back to overview
      </Link>
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent} actions={headerActions}>
      <div className="app testing-playground">
        <main className="container" style={{ maxWidth: '1200px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginTop: '24px' }}>
          {/* Left Panel: Test Setup */}
          <div>
            <div className="card">
              <div className="inner">
                <h3>Test Setup</h3>

                {/* Agent Selection */}
                <label>Select Agent</label>
                <select
                  value={selectedAgent?.id || ''}
                  onChange={(e) => {
                    const agent = agents.find((a) => a.id === e.target.value);
                    setSelectedAgent(agent);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'inherit',
                    marginBottom: '20px',
                  }}
                >
                  <option value="">Choose an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>

                <div className="spacer" />

                {/* Test Prompt */}
                <label>Test Prompt</label>
                <textarea
                  placeholder="Enter a test prompt to send to the agent..."
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: 'inherit',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    marginBottom: '20px',
                    resize: 'vertical',
                  }}
                />

                <div className="spacer" />

                {/* Number of Runs */}
                <label>Number of Runs</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px' }}>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={numRuns}
                    onChange={(e) => setNumRuns(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    style={{
                      width: '60px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'inherit',
                    }}
                  />
                  <span className="help">runs to test consistency</span>
                </div>

                {/* Run Tests Button */}
                <button
                  onClick={runTest}
                  disabled={isRunning || !selectedAgent}
                  className="btn primary"
                  style={{ width: '100%', marginBottom: '20px' }}
                >
                  {isRunning ? '⏳ Running Tests...' : '▶️ Run Tests'}
                </button>

                {/* Stats */}
                {testResults.length > 0 && (
                  <>
                    <div className="divider" />
                    <h4 style={{ marginBottom: '16px' }}>Statistics</h4>

                    <div style={{ marginBottom: '12px' }}>
                      <div className="metric">
                        <span>Total Tests</span>
                        <b>{testResults.length}</b>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div className="metric">
                        <span>Avg Helpfulness</span>
                        <b>{getAverageRating('helpfulness')}/5</b>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div className="metric">
                        <span>Avg Accuracy</span>
                        <b>{getAverageRating('accuracy')}/5</b>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div className="metric">
                        <span>Avg Tone Quality</span>
                        <b>{getAverageRating('tone')}/5</b>
                      </div>
                    </div>

                    <div style={{ padding: '12px', background: 'rgba(122, 240, 213, 0.1)', borderRadius: '8px' }}>
                      <div className="metric">
                        <span>Consistency Score</span>
                        <b style={{ color: '#7af0d5' }}>{getConsistencyScore()}%</b>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
                        How similar responses are across runs
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Test Results */}
          <div>
            <div className="card">
              <div className="inner">
                <h3>Test Results</h3>

                {testResults.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {['all', 'rated', 'unrated'].map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setRatingFilter(filter)}
                          className={`btn ${ratingFilter === filter ? 'primary' : 'secondary'}`}
                          style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                          {filter === 'all' && `All (${testResults.length})`}
                          {filter === 'rated' && `Rated (${testResults.filter((r) => r.helpfulness > 0 || r.accuracy > 0).length})`}
                          {filter === 'unrated' && `Unrated (${testResults.filter((r) => r.helpfulness === 0 && r.accuracy === 0).length})`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {filteredResults.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                    {testResults.length === 0 ? (
                      <>
                        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🧪</div>
                        <p>No tests run yet. Create a test prompt and run it to see results.</p>
                      </>
                    ) : (
                      <p>No results match this filter.</p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '800px', overflowY: 'auto' }}>
                    {filteredResults.map((result) => (
                      <div
                        key={result.id}
                        style={{
                          padding: '16px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          background: 'rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                          <div>
                            <b style={{ fontSize: '13px' }}>Run #{result.runNumber}</b>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                              {result.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteTestResult(result.id)}
                            className="btn ghost compact"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                          >
                            ✕ Delete
                          </button>
                        </div>

                        {/* Response */}
                        <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>Response:</div>
                          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>{result.response}</div>
                        </div>

                        {/* Ratings */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                          {[
                            { key: 'helpfulness', label: 'Helpful' },
                            { key: 'accuracy', label: 'Accurate' },
                            { key: 'tone', label: 'Good Tone' },
                          ].map(({ key, label }) => (
                            <div key={key}>
                              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{label}</div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3, 4, 5].map((rating) => (
                                  <button
                                    key={rating}
                                    onClick={() => updateTestResult(result.id, key, rating)}
                                    style={{
                                      flex: 1,
                                      padding: '6px',
                                      borderRadius: '6px',
                                      border: '1px solid rgba(255, 255, 255, 0.12)',
                                      background:
                                        result[key] >= rating
                                          ? 'rgba(122, 240, 213, 0.3)'
                                          : 'rgba(255, 255, 255, 0.03)',
                                      color: 'inherit',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: result[key] >= rating ? '600' : '400',
                                      transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (result[key] < rating) {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (result[key] < rating) {
                                        e.target.style.background = 'rgba(255, 255, 255, 0.03)';
                                      }
                                    }}
                                  >
                                    {rating}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Notes */}
                        <textarea
                          placeholder="Add notes about this test..."
                          value={result.notes}
                          onChange={(e) => updateTestResult(result.id, 'notes', e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            color: 'inherit',
                            fontFamily: 'inherit',
                            fontSize: '12px',
                            resize: 'vertical',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        </main>

        <style>{`
        .container {
          margin: 0 auto;
          padding: 0 20px;
        }

        .card {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.4);
          overflow: hidden;
        }

        .inner {
          padding: 24px;
        }

        .inner h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
        }

        .inner h4 {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: 0.05em;
        }

        label {
          display: block;
          font-weight: 500;
          font-size: 13px;
          margin-bottom: 8px;
          color: inherit;
        }

        textarea {
          font-family: 'Monaco', 'Courier New', monospace;
        }

        .spacer {
          height: 20px;
        }

        .divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 20px 0;
        }

        .metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }

        .metric span {
          color: var(--muted);
        }

        .metric b {
          font-weight: 600;
          color: inherit;
        }

        .btn {
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
          color: inherit;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .btn.primary {
          background: rgba(122, 240, 213, 0.2);
          border-color: rgba(122, 240, 213, 0.5);
          color: rgba(122, 240, 213, 1);
        }

        .btn.primary:hover:not(:disabled) {
          background: rgba(122, 240, 213, 0.3);
          border-color: rgba(122, 240, 213, 0.6);
        }

        .btn.secondary {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .btn.secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .btn.ghost {
          background: transparent;
          border: none;
          color: var(--muted);
        }

        .btn.ghost:hover {
          color: inherit;
          background: transparent;
        }

        .btn.compact {
          padding: 6px 12px;
          font-size: 12px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .help {
          font-size: 12px;
          color: var(--muted);
          margin-top: 6px;
        }

        @media (max-width: 900px) {
          main {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      </div>
    </DashboardLayout>
  );
}
