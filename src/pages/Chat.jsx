import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getModelMeta } from '../lib/modelOptions.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * Randomly pick between version A and B for the test
 */
const pickRandomVersion = (versionAId, versionBId) => {
  return Math.random() < 0.5 ? versionAId : versionBId;
};

const fallbackChat = [
  {
    id: 'fallback-agent',
    role: 'agent',
    text: "Hello! I'm ready to help with planning and analytics.",
  },
  {
    id: 'fallback-user',
    role: 'user',
    text: 'Show me latest onboarding metrics.',
  },
];

const introForAgent = (agent) => {
  if (!agent) return fallbackChat[0].text;
  const intro = agent.name ? `Hello! I'm ${agent.name}.` : "Hello! I'm your assistant.";
  const desc = agent.description ? ` ${agent.description}` : '';
  return `${intro}${desc}`.trim();
};

const normalizeHistory = (agent) => {
  if (!agent) return fallbackChat;
  if (Array.isArray(agent.chat_history) && agent.chat_history.length > 0) {
    return agent.chat_history;
  }
  return [
    {
      id: `intro-${agent.id}`,
      role: 'agent',
      text: introForAgent(agent),
    },
    fallbackChat[1],
  ];
};

export default function ChatPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [chatLog, setChatLog] = useState(fallbackChat);
  const [chatInput, setChatInput] = useState('');
  const [status, setStatus] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [activeTestSession, setActiveTestSession] = useState(null);
  const [testedVersionId, setTestedVersionId] = useState(null);
  const [ratedMessages, setRatedMessages] = useState({});

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  useEffect(() => {
    const fetchAgents = async () => {
      if (!supabase || !user?.id) {
        setAgents([]);
        return;
      }
      setIsLoadingAgents(true);
      const { data, error } = await supabase
        .from('agent_personas')
        .select(
          'id, name, description, system_prompt, guardrails, sliders, tools, model_id, chat_history, status, created_at',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setStatus(`Failed to load agents: ${error.message}`);
        setAgents([]);
      } else {
        setAgents(data ?? []);
        if (!selectedAgentId && data?.length) {
          setSelectedAgentId(data[0].id);
        }
      }
      setIsLoadingAgents(false);
    };

    fetchAgents();
  }, [user?.id]);

  useEffect(() => {
    if (!selectedAgent) return;
    setChatLog(normalizeHistory(selectedAgent));
    setStatus('');
    loadActiveABTest(selectedAgent.id);
  }, [selectedAgent]);

  /**
   * Load active A/B test sessions for the agent
   */
  const loadActiveABTest = async (agentId) => {
    try {
      const res = await fetch(`${API_URL}/api/agents/${agentId}/a-b-tests`);
      const data = await res.json();
      
      let sessions = [];
      if (data.sessions) {
        sessions = data.sessions;
      } else if (Array.isArray(data)) {
        sessions = data;
      }

      // Find first active test session
      const activeTest = sessions.find(s => s.status === 'active');
      
      if (activeTest) {
        // Randomly pick version A or B
        const versionId = pickRandomVersion(activeTest.version_a_id, activeTest.version_b_id);
        setActiveTestSession(activeTest);
        setTestedVersionId(versionId);
        setStatus(`📊 A/B Test Active: "${activeTest.test_name}"`);
      } else {
        setActiveTestSession(null);
        setTestedVersionId(null);
      }
    } catch (error) {
      console.error('Error loading A/B tests:', error);
      setActiveTestSession(null);
      setTestedVersionId(null);
    }
  };

  const compileSystemPrompt = useMemo(() => {
    if (!selectedAgent) return '';
    const sections = [];
    if (selectedAgent.name) {
      sections.push(`Identity: You are ${selectedAgent.name}.`);
    }
    if (selectedAgent.description) {
      sections.push(`Focus: ${selectedAgent.description}`);
    }
    if (selectedAgent.guardrails) {
      const rules = [];
      if (selectedAgent.guardrails.factual) {
        rules.push('• Stay factual and cite sources when possible.');
      }
      if (selectedAgent.guardrails.opinions) {
        rules.push('• Avoid personal opinions; stay objective.');
      }
      if (rules.length) {
        sections.push(['Guardrails:', ...rules].join('\n'));
      }
    }
    if (selectedAgent.sliders) {
      sections.push(
        `Personality: Formality ${selectedAgent.sliders.formality ?? 50}/100, Creativity ${selectedAgent.sliders.creativity ?? 50}/100.`,
      );
    }
    if (selectedAgent.system_prompt) {
      sections.push(`Primary instructions: ${selectedAgent.system_prompt}`);
    }
    return sections.join('\n\n');
  }, [selectedAgent]);

  const buildMessages = (latestUserMessage) => {
    const history = [...chatLog, { role: 'user', text: latestUserMessage }];
    const formatted = history.map((entry) => ({
      role: entry.role === 'user' ? 'user' : 'assistant',
      content: entry.text,
    }));
    const system = compileSystemPrompt
      ? [
          {
            role: 'system',
            content: compileSystemPrompt,
          },
        ]
      : [];
    return [...system, ...formatted];
  };

  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isResponding) return;
    if (!selectedAgent) {
      setStatus('Select an agent before chatting.');
      return;
    }

    const requestStartTime = Date.now();
    const timestamp = Date.now();
    const userEntry = { id: `user-${timestamp}`, role: 'user', text: trimmed };
    setChatLog((prev) => [...prev, userEntry]);
    setChatInput('');
    setIsResponding(true);

    try {
      const modelMeta = getModelMeta(selectedAgent.model_id);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: modelMeta.id,
          messages: buildMessages(trimmed),
          temperature: 0.35,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Provider call failed');
      }

      const data = await response.json();
      const agentResponse = data.reply;
      const responseTimeMs = Date.now() - requestStartTime;
      
      setChatLog((prev) => [...prev, { id: `agent-${timestamp}`, role: 'agent', text: agentResponse }]);
      
      // Record test result if there's an active test
      if (activeTestSession && testedVersionId) {
        recordTestResult(trimmed, agentResponse, responseTimeMs);
      }
    } catch (error) {
      const errorText = `⚠️ ${error?.message || 'Provider error.'}`;
      setChatLog((prev) => [
        ...prev,
        { id: `agent-${timestamp}`, role: 'agent', text: errorText },
      ]);
    } finally {
      setIsResponding(false);
    }
  };

  /**
   * Record test result to the A/B test database
   */
  const recordTestResult = async (userPrompt, agentResponse, responseTimeMs) => {
    try {
      const res = await fetch(`${API_URL}/api/a-b-tests/${activeTestSession.id}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          versionId: testedVersionId,
          userPrompt,
          agentResponse,
          responseTimeMs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error('Error recording test result:', data);
      } else {
        console.log('✓ Test result recorded');
      }
    } catch (error) {
      console.error('Error recording test result:', error);
    }
  };

  /**
   * Rate a response (thumbs up/down)
   */
  const handleRateResponse = async (messageId, liked) => {
    try {
      if (!selectedAgent) return;

      const rating = liked ? 5 : 1;
      const qualityScore = liked ? 90 : 30;
      const relevanceScore = liked ? 85 : 35;
      const helpfulnessScore = liked ? 88 : 32;

      const res = await fetch(`${API_URL}/api/agents/${selectedAgent.id}/rate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: messageId,
          test_result_id: activeTestSession ? messageId : null,
          rating,
          quality_score: qualityScore,
          relevance_score: relevanceScore,
          helpfulness_score: helpfulnessScore,
          feedback_text: liked ? 'Helpful response' : 'Not helpful',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error('Error rating response:', data);
      } else {
        console.log('✓ Response rated');
        setRatedMessages((prev) => ({
          ...prev,
          [messageId]: liked ? 'thumbs-up' : 'thumbs-down',
        }));
      }
    } catch (error) {
      console.error('Error rating response:', error);
    }
  };

  return (
    <div className="app chat-page">
      <header>
        <div className="brand">
          <div className="logo">AI</div>
          <div>
            <h1>Chat Surface</h1>
            <div className="sub">Test the agent experience before shipping.</div>
          </div>
        </div>
        <div className="header-actions">
          <Link className="btn ghost compact" to="/builder">
            ← Back to Builder
          </Link>
          <Link className="btn ghost compact" to="/home">
            Dashboard
          </Link>
        </div>
      </header>

      {status && <div className="status-bar">{status}</div>}

      <div className="chat-shell">
        <aside className="chat-rail">
          <p className="rail-label">Current Agent</p>
          {isLoadingAgents ? (
            <p className="muted">Loading agents…</p>
          ) : agents.length === 0 ? (
            <div className="rail-empty">
              <p>No agents yet.</p>
              <Link className="btn primary" to="/builder">
                Create one
              </Link>
            </div>
          ) : (
            <ul className="rail-list">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <button
                    type="button"
                    className={`rail-item ${selectedAgentId === agent.id ? 'active' : ''}`}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="rail-pill">{agent.name?.slice(0, 2)?.toUpperCase() || 'AI'}</div>
                    <div>
                      <b>{agent.name || 'Untitled agent'}</b>
                      <p className="muted">{agent.description || 'Add a description in Builder.'}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link className="btn gradient" to="/builder">
            ← Back to builder
          </Link>
        </aside>

        <section className="chat-stage">
          <div className="stage-header">
            <div>
              <h2>{selectedAgent?.name || 'Pick an agent'}</h2>
              <p className="muted">{selectedAgent?.description || 'Choose an agent on the left to start chatting.'}</p>
            </div>
            {selectedAgent && <span className="badge live">Active and Ready</span>}
          </div>
          <div className="stage-window">
            {chatLog.map((bubble) => (
              <div key={bubble.id} className={`chat-bubble ${bubble.role === 'user' ? 'me' : ''}`}>
                {bubble.text}
              </div>
            ))}
          </div>
          <div className="stage-input">
            <input
              type="text"
              placeholder="Type your message…"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleChatSend();
                }
              }}
            />
            <button className="btn primary" type="button" onClick={handleChatSend} disabled={isResponding || !selectedAgent}>
              {isResponding ? 'Thinking…' : 'Send'}
            </button>
          </div>
        </section>

        <aside className="chat-sidebar">
          <p className="rail-label">Capabilities</p>
          {selectedAgent ? (
            <div className="capabilities">
              <div className="cap-card">
                <span className="cap-label">Model</span>
                <b>{getModelMeta(selectedAgent.model_id).label}</b>
              </div>
              <div className="cap-card">
                <span className="cap-label">Formality</span>
                <b>{selectedAgent.sliders?.formality ?? 50}%</b>
              </div>
              <div className="cap-card">
                <span className="cap-label">Creativity</span>
                <b>{selectedAgent.sliders?.creativity ?? 50}%</b>
              </div>
              <div className="cap-card">
                <span className="cap-label">Tools</span>
                <b>
                  {selectedAgent.tools
                    ? Object.entries(selectedAgent.tools)
                        .filter(([, enabled]) => enabled)
                        .map(([key]) => key.toUpperCase())
                        .join(', ') || 'None'
                    : 'None'}
                </b>
              </div>

              {activeTestSession && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <p className="rail-label">📊 A/B Test</p>
                  <div className="cap-card">
                    <span className="cap-label">Test Name</span>
                    <b>{activeTestSession.test_name}</b>
                  </div>
                  <div className="cap-card">
                    <span className="cap-label">Testing Version</span>
                    <b style={{ color: '#10b981' }}>
                      {testedVersionId === activeTestSession.version_a_id ? 'A' : 'B'}
                    </b>
                  </div>
                  <div className="cap-card">
                    <span className="cap-label">Progress</span>
                    <b>Recording responses…</b>
                  </div>
                </div>
              )}

              {chatLog.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <p className="rail-label">⭐ Rate Response</p>
                  {(() => {
                    const lastAgentMessage = [...chatLog].reverse().find((m) => m.role === 'agent');
                    if (!lastAgentMessage) return <p className="muted">No response yet</p>;
                    if (ratedMessages[lastAgentMessage.id]) {
                      return (
                        <p className="muted">
                          {ratedMessages[lastAgentMessage.id] === 'thumbs-up' ? '👍 Marked helpful' : '👎 Marked unhelpful'}
                        </p>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRateResponse(lastAgentMessage.id, true)}
                          style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            fontSize: '24px',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'var(--success-light)';
                            e.target.style.borderColor = '#10b981';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'none';
                            e.target.style.borderColor = 'var(--border)';
                          }}
                          title="Helpful"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRateResponse(lastAgentMessage.id, false)}
                          style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            fontSize: '24px',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'var(--error-light)';
                            e.target.style.borderColor = '#ef4444';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'none';
                            e.target.style.borderColor = 'var(--border)';
                          }}
                          title="Not helpful"
                        >
                          👎
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <p className="muted">Select an agent to view its configuration.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
