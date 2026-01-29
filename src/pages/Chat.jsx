import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getModelMeta } from '../lib/modelOptions.js';
import { buildUsageEvent, logUsageEvent } from '../lib/analytics.js';

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
  const [searchParams] = useSearchParams();
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [chatLog, setChatLog] = useState(fallbackChat);
  const [chatInput, setChatInput] = useState('');
  const [status, setStatus] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);

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
      const ownedResponse = await supabase
        .from('agent_personas')
        .select(
          'id, name, description, system_prompt, guardrails, sliders, tools, model_id, chat_history, status, created_at',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const accessResponse = await supabase
        .from('agent_access')
        .select('agent_id, role')
        .eq('user_id', user.id);

      let sharedAgents = [];
      if (!accessResponse.error && accessResponse.data?.length) {
        const sharedIds = accessResponse.data.map((row) => row.agent_id);
        const { data: sharedData, error: sharedError } = await supabase
          .from('agent_personas')
          .select(
            'id, name, description, system_prompt, guardrails, sliders, tools, model_id, chat_history, status, created_at',
          )
          .in('id', sharedIds);
        if (!sharedError) {
          sharedAgents = sharedData ?? [];
        }
      }

      if (ownedResponse.error) {
        setStatus(`Failed to load agents: ${ownedResponse.error.message}`);
        setAgents([]);
      } else {
        const combined = [...(ownedResponse.data ?? []), ...sharedAgents];
        setAgents(combined);
        const requestedId = searchParams.get('agent');
        const preferred = combined.find((agent) => agent.id === requestedId) || combined[0];
        if (!selectedAgentId && preferred) {
          setSelectedAgentId(preferred.id);
        }
      }
      setIsLoadingAgents(false);
    };

    fetchAgents();
  }, [user?.id, searchParams, selectedAgentId]);

  useEffect(() => {
    if (!selectedAgent) return;
    setChatLog(normalizeHistory(selectedAgent));
    setStatus('');
  }, [selectedAgent]);

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

    const timestamp = Date.now();
    const userEntry = { id: `user-${timestamp}`, role: 'user', text: trimmed };
    setChatLog((prev) => [...prev, userEntry]);
    setChatInput('');
    setIsResponding(true);

    try {
      const modelMeta = getModelMeta(selectedAgent.model_id);
      const promptMessages = buildMessages(trimmed);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: modelMeta.id,
          messages: promptMessages,
          temperature: 0.35,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Provider call failed');
      }

      const data = await response.json();
      setChatLog((prev) => [...prev, { id: `agent-${timestamp}`, role: 'agent', text: data.reply }]);
      const usagePayload = buildUsageEvent({
        userId: user?.id,
        agentId: selectedAgent.id,
        modelId: modelMeta.id,
        promptMessages,
        responseText: data.reply,
        source: 'single-chat',
        messageCount: 2,
      });
      void logUsageEvent({ supabaseClient: supabase, payload: usagePayload });
    } catch (error) {
      setChatLog((prev) => [
        ...prev,
        { id: `agent-${timestamp}`, role: 'agent', text: `⚠️ ${error?.message || 'Provider error.'}` },
      ]);
    } finally {
      setIsResponding(false);
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
            </div>
          ) : (
            <p className="muted">Select an agent to view its configuration.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
