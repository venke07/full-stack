import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getModelMeta } from '../lib/modelOptions.js';
import ConversationHistory from '../components/ConversationHistory.jsx';
import DashboardLayout from '../components/DashboardLayout.jsx';

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
  const [testedVersionData, setTestedVersionData] = useState(null);
  const [ratedMessages, setRatedMessages] = useState({});
  const [resultIdsByMessage, setResultIdsByMessage] = useState({});
  const [messageMetadata, setMessageMetadata] = useState({}); // Track version, timestamp per message
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  
  // Voice Chat States
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [synthesis, setSynthesis] = useState(null);
  const [voiceSupported, setVoiceSupported] = useState(false);

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

  // Initialize Web Speech API
  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
        setIsListening(false);
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setStatus(`Voice error: ${event.error}`);
        setTimeout(() => setStatus(''), 3000);
        setIsListening(false);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
      setVoiceSupported(true);
    }
    
    // Check if browser supports Speech Synthesis
    if (window.speechSynthesis) {
      setSynthesis(window.speechSynthesis);
    }
  }, []);
  
  // Voice control functions
  const startListening = () => {
    if (!recognition || isListening) return;
    
    try {
      recognition.start();
      setIsListening(true);
      setStatus('🎤 Listening...');
    } catch (err) {
      console.error('Error starting recognition:', err);
      setStatus('Could not start voice input');
      setTimeout(() => setStatus(''), 3000);
    }
  };
  
  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
      setStatus('');
    }
  };
  
  const speakText = (text) => {
    if (!synthesis || !voiceEnabled || !text) return;
    
    // Cancel any ongoing speech
    synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => {
      setIsPlaying(true);
    };
    
    utterance.onend = () => {
      setIsPlaying(false);
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsPlaying(false);
    };
    
    synthesis.speak(utterance);
  };
  
  const stopSpeaking = () => {
    if (synthesis) {
      synthesis.cancel();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (!selectedAgent) return;
    
    // Try to load the most recent conversation from database first
    loadMostRecentConversation(selectedAgent.id);
    setStatus('');
    loadActiveABTest(selectedAgent.id);
  }, [selectedAgent]);

  /**
   * Load the most recent saved conversation for this agent from database
   */
  const loadMostRecentConversation = async (agentId) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations?userId=${user?.id}&agentId=${agentId}&limit=1`);
      const data = await res.json();
      
      if (data.success && data.conversations && data.conversations.length > 0) {
        const recentConversation = data.conversations[0];
        // Load the full conversation with all messages
        const fullRes = await fetch(`${API_URL}/api/conversations/${recentConversation.id}`);
        const fullData = await fullRes.json();
        
        if (fullData.success && fullData.conversation) {
          handleLoadConversation(fullData.conversation);
          return; // Successfully loaded from database
        }
      }
    } catch (err) {
      console.warn('Could not load recent conversation:', err);
    }
    
    // Fallback: Use agent's default chat history if no saved conversation
    setChatLog(normalizeHistory(selectedAgent));
  };

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
      // Normalize session id for mapping results later
      sessions = sessions.map((s) => ({ ...s, id: s.id ?? s.session_id ?? s.sessionId }));

      // Find first active test session
      const activeTest = sessions.find(s => s.status === 'active');
      
      if (activeTest) {
        setActiveTestSession(activeTest);
        setStatus(`📊 A/B Test Active: "${activeTest.test_name}"`);
      } else {
        setActiveTestSession(null);
        setTestedVersionId(null);
        setTestedVersionData(null);
      }
    } catch (error) {
      console.error('Error loading A/B tests:', error);
      setActiveTestSession(null);
      setTestedVersionId(null);
      setTestedVersionData(null);
    }
  };

  /**
   * Fetch a specific version's data
   */
  const fetchVersionData = async (versionId) => {
    try {
      const res = await fetch(`${API_URL}/api/prompt-versions/${versionId}`);
      const data = await res.json();
      if (data.version) {
        return data.version;
      }
      return null;
    } catch (error) {
      console.error('Error fetching version data:', error);
      return null;
    }
  };

  const compileSystemPrompt = useMemo(() => {
    if (!selectedAgent) return '';
    
    // If we're in an A/B test and have version data, use the version's prompt
    if (testedVersionData?.prompt_text) {
      return testedVersionData.prompt_text;
    }
    
    // Otherwise use the agent's default prompt compilation
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
  }, [selectedAgent, testedVersionData]);

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

  /**
   * Auto-save conversation to database (after each exchange)
   */
  /**
   * Save current conversation to database (manual save)
   */
  const saveConversation = async () => {
    if (!user || !selectedAgent || chatLog.length < 2) {
      setStatus('Nothing to save yet!');
      setTimeout(() => setStatus(''), 2000);
      return;
    }

    try {
      // Format messages for storage
      const messages = chatLog.map(m => ({
        role: m.role,
        content: m.text,
      }));

      const res = await fetch(`${API_URL}/api/conversations/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          agentId: selectedAgent.id,
          messages: messages,
          summary: chatLog.find(m => m.role === 'user')?.text || 'Conversation',
        }),
      });

      const data = await res.json();
      if (data.success && data.conversation) {
        setCurrentConversationId(data.conversation.id);
        setStatus('✅ Conversation saved to memory!');
        setTimeout(() => setStatus(''), 3000);
      }
    } catch (err) {
      setStatus('❌ Failed to save conversation');
      console.error(err);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  /**
   * Load a conversation from history
   */
  const handleLoadConversation = (conversation) => {
    // Convert stored messages to chat log format
    const messages = conversation.messages || conversation.conversation_messages || [];
    const formattedMessages = messages.map((msg, idx) => ({
      id: `${msg.role}-${idx}`,
      role: msg.role,
      text: msg.content || msg.text,
    }));

    setChatLog(formattedMessages);
    setCurrentConversationId(conversation.id);
    setStatus('📂 Conversation loaded!');
    setTimeout(() => setStatus(''), 2000);
  };

  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || isResponding) return;
    if (!selectedAgent) {
      setStatus('Select an agent before chatting.');
      return;
    }

    // Pick a new random version for THIS message if A/B test is active
    let currentVersionId = testedVersionId;
    let versionPrompt = null;
    
    if (activeTestSession) {
      currentVersionId = pickRandomVersion(
        activeTestSession.version_a_id, 
        activeTestSession.version_b_id
      );
      setTestedVersionId(currentVersionId);
      
      // Fetch the version's prompt
      const versionData = await fetchVersionData(currentVersionId);
      setTestedVersionData(versionData);
      versionPrompt = versionData?.prompt_text || null;
      
      console.log(`📊 Using Version ${currentVersionId === activeTestSession.version_a_id ? 'A' : 'B'} for this message`);
    }

    const requestStartTime = Date.now();
    const timestamp = Date.now();
    const userEntry = { id: `user-${timestamp}`, role: 'user', text: trimmed };
    setChatLog((prev) => [...prev, userEntry]);
    setChatInput('');
    setIsResponding(true);

    try {
      const modelMeta = getModelMeta(selectedAgent.model_id);
      
      // Build messages with the correct system prompt
      const history = [...chatLog, userEntry];
      const formatted = history.map((entry) => ({
        role: entry.role === 'user' ? 'user' : 'assistant',
        content: entry.text,
      }));
      
      // Use version prompt if A/B testing, otherwise use compiled prompt
      const systemPromptToUse = versionPrompt || compileSystemPrompt;
      const messagesWithSystem = systemPromptToUse
        ? [{ role: 'system', content: systemPromptToUse }, ...formatted]
        : formatted;
      
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: modelMeta.id,
          messages: messagesWithSystem,
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
      
      const agentMessageId = `agent-${timestamp}`;
      setChatLog((prev) => [...prev, { id: agentMessageId, role: 'agent', text: agentResponse }]);
      
      // Auto-play agent response if voice is enabled
      if (voiceEnabled && agentResponse) {
        speakText(agentResponse);
      }
      
      // Store message metadata for implicit tracking
      if (activeTestSession && currentVersionId) {
        setMessageMetadata((prev) => ({
          ...prev,
          [agentMessageId]: {
            versionId: currentVersionId,
            timestamp: Date.now(),
            isVersionA: currentVersionId === activeTestSession.version_a_id,
          },
        }));
      }
      
      // Record test result if there's an active test
      if (activeTestSession && currentVersionId) {
        recordTestResult(trimmed, agentResponse, responseTimeMs, agentMessageId);
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
  const recordTestResult = async (userPrompt, agentResponse, responseTimeMs, messageId) => {
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

      const data = await res.json();
      if (!res.ok) {
        console.error('Error recording test result:', data);
      } else {
        const resultId = data?.result?.id;
        if (resultId && messageId) {
          setResultIdsByMessage((prev) => ({ ...prev, [messageId]: resultId }));
        }
        console.log(`✓ Test result recorded for Version ${testedVersionId === activeTestSession.version_a_id ? 'A' : 'B'}`);
      }
    } catch (error) {
      console.error('Error recording test result:', error);
    }
  };

  /**
   * Calculate implicit quality signals
   */
  const calculateImplicitSignals = (messageId) => {
    const messageIndex = chatLog.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return {};

    const nextMessage = chatLog[messageIndex + 1];
    const hasFollowUp = !!nextMessage && nextMessage.role === 'user';
    
    // Check if user repeated/rephrased the same question
    const previousUserMessage = chatLog
      .slice(0, messageIndex)
      .reverse()
      .find((m) => m.role === 'user');
    const isRephrased = previousUserMessage && nextMessage && 
      nextMessage.text.toLowerCase().includes(previousUserMessage.text.toLowerCase().slice(0, 20));

    // Calculate engagement time if there's a follow-up
    const metadata = messageMetadata[messageId];
    const nextMessageTimestamp = messageMetadata[nextMessage?.id]?.timestamp;
    const engagementTime = metadata && nextMessageTimestamp 
      ? nextMessageTimestamp - metadata.timestamp 
      : null;

    return {
      has_follow_up: hasFollowUp,
      is_rephrased_question: isRephrased,
      engagement_time_ms: engagementTime,
      conversation_continued: hasFollowUp && !isRephrased,
      implicit_positive: hasFollowUp && !isRephrased && (engagementTime ? engagementTime > 3000 : true),
      implicit_negative: isRephrased || (engagementTime ? engagementTime < 1000 : false),
    };
  };

  /**
   * Rate a response (thumbs up/down) with implicit signals
   */
  const handleRateResponse = async (messageId, liked) => {
    try {
      if (!selectedAgent) return;

      const rating = liked ? 5 : 1;
      const qualityScore = liked ? 90 : 30;
      const relevanceScore = liked ? 85 : 35;
      const helpfulnessScore = liked ? 88 : 32;
      const testResultId = activeTestSession ? resultIdsByMessage[messageId] ?? null : null;
      const implicitSignals = calculateImplicitSignals(messageId);

      const res = await fetch(`${API_URL}/api/agents/${selectedAgent.id}/rate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: messageId,
          test_result_id: testResultId,
          rating,
          quality_score: qualityScore,
          relevance_score: relevanceScore,
          helpfulness_score: helpfulnessScore,
          feedback_text: liked ? 'Helpful response' : 'Not helpful',
          ...implicitSignals, // Include implicit tracking data
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error('Error rating response:', data);
      } else {
        console.log('✓ Response rated with implicit signals');
        setRatedMessages((prev) => ({
          ...prev,
          [messageId]: liked ? 'thumbs-up' : 'thumbs-down',
        }));
      }
    } catch (error) {
      console.error('Error rating response:', error);
    }
  };

  /**
   * Format message text with basic markdown-like formatting
   */
  const formatMessage = (text) => {
    if (!text) return '';
    
    // Split by double line breaks for paragraphs
    const paragraphs = text.split('\n\n');
    
    return paragraphs.map((para, pIndex) => {
      // Split by single line breaks
      const lines = para.split('\n');
      
      return (
        <div key={pIndex} style={{ marginBottom: pIndex < paragraphs.length - 1 ? '4px' : '0' }}>
          {lines.map((line, lIndex) => {
            // Check if it's a bullet point
            if (line.trim().match(/^[-•*]\s/)) {
              const content = line.trim().replace(/^[-•*]\s/, '');
              return (
                <div key={lIndex} style={{ paddingLeft: '14px', position: 'relative', marginBottom: '0px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0' }}>•</span>
                  <span>{formatInlineText(content)}</span>
                </div>
              );
            }
            
            // Check if it's a numbered list
            if (line.trim().match(/^\d+\.\s/)) {
              return (
                <div key={lIndex} style={{ paddingLeft: '14px', marginBottom: '0px' }}>
                  {formatInlineText(line.trim())}
                </div>
              );
            }
            
            // Check if it's a heading (starts with ###, ##, or #)
            if (line.trim().match(/^#{1,3}\s/)) {
              const level = line.match(/^(#{1,3})/)[0].length;
              const content = line.replace(/^#{1,3}\s/, '');
              const fontSize = level === 1 ? '1em' : level === 2 ? '0.95em' : '0.9em';
              return (
                <div key={lIndex} style={{ 
                  fontWeight: '700', 
                  fontSize, 
                  marginTop: lIndex > 0 ? '3px' : '0',
                  marginBottom: '2px',
                  color: '#84ffe1'
                }}>
                  {formatInlineText(content)}
                </div>
              );
            }
            
            // Skip empty lines
            if (!line.trim()) return null;
            
            // Regular line
            return (
              <span key={lIndex} style={{ display: 'block', marginBottom: '0px' }}>
                {formatInlineText(line)}
              </span>
            );
          })}
        </div>
      );
    });
  };

  /**
   * Format inline text (bold, italic, code)
   */
  const formatInlineText = (text) => {
    const parts = [];
    let key = 0;
    const combined = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = combined.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{text.substring(lastIndex, match.index)}</span>);
      }

      if (match[0].startsWith('**')) {
        parts.push(
          <strong key={key++} style={{ fontWeight: '700', color: '#84ffe1' }}>
            {match[2]}
          </strong>,
        );
      } else {
        parts.push(
          <code
            key={key++}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.9em',
            }}
          >
            {match[3]}
          </code>,
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={key++}>{text.substring(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : text;
  };

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Conversation Lab</p>
      <h1>Chat Surface</h1>
      <p className="dashboard-sub">Test the agent experience before shipping.</p>
    </div>
  );

  const headerActions = (
    <div className="page-actions">
      <Link className="btn secondary" to="/builder">
        Back to builder
      </Link>
      <Link className="btn secondary" to="/home">
        Back to overview
      </Link>
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent} actions={headerActions}>
      <div className="chat-page">
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, lineHeight: '1.3' }}>
                      {formatMessage(bubble.text)}
                      {bubble.role === 'agent' && messageMetadata[bubble.id] && (
                        <div
                          style={{
                            marginTop: '8px',
                            fontSize: '11px',
                            color: 'var(--muted)',
                            fontWeight: '500',
                          }}
                        >
                          Version {messageMetadata[bubble.id].isVersionA ? 'A' : 'B'}
                        </div>
                      )}
                    </div>
                    {bubble.role === 'agent' && activeTestSession && !bubble.id.includes('fallback') && !bubble.id.includes('intro') && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {!ratedMessages[bubble.id] ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRateResponse(bubble.id, true)}
                              style={{
                                background: 'none',
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                padding: '4px 6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#10b98120';
                                e.currentTarget.style.borderColor = '#10b981';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'none';
                                e.currentTarget.style.borderColor = 'var(--border)';
                              }}
                              title="Helpful"
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRateResponse(bubble.id, false)}
                              style={{
                                background: 'none',
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                padding: '4px 6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#ef444420';
                                e.currentTarget.style.borderColor = '#ef4444';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'none';
                                e.currentTarget.style.borderColor = 'var(--border)';
                              }}
                              title="Not helpful"
                            >
                              👎
                            </button>
                          </>
                        ) : (
                          <span
                            style={{
                              fontSize: '14px',
                              color: ratedMessages[bubble.id] === 'thumbs-up' ? '#10b981' : '#ef4444',
                            }}
                          >
                            {ratedMessages[bubble.id] === 'thumbs-up' ? '👍' : '👎'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="stage-input">
              <input
                type="text"
                placeholder={isListening ? 'Listening...' : 'Type your message…'}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleChatSend();
                  }
                }}
              />
              {voiceSupported && (
                <button
                  className={`btn voice-btn ${isListening ? 'listening' : ''}`}
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  disabled={isResponding}
                  title={isListening ? 'Stop listening' : 'Click to speak'}
                >
                  {isListening ? '⏹️' : '🎤'}
                </button>
              )}
              <button className="btn primary" type="button" onClick={handleChatSend} disabled={isResponding || !selectedAgent}>
                {isResponding ? 'Thinking…' : 'Send'}
              </button>
              <button className="btn ghost compact" type="button" onClick={saveConversation} title="Save this conversation to memory">
                💾 Save
              </button>
              <button
                className="btn ghost compact"
                type="button"
                onClick={() => setShowHistoryPanel(true)}
                title="View conversation history"
              >
                📂 History
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

                {voiceSupported && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    <p className="rail-label">🎤 Voice Chat</p>
                    <div className="voice-controls">
                      <div className="voice-toggle">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={voiceEnabled}
                            onChange={(e) => {
                              setVoiceEnabled(e.target.checked);
                              if (!e.target.checked) {
                                stopSpeaking();
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>Auto-play responses</span>
                        </label>
                      </div>
                      {isPlaying && (
                        <button className="btn ghost compact" onClick={stopSpeaking} style={{ marginTop: '8px', width: '100%' }}>
                          🔇 Stop Speaking
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {activeTestSession && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                    <p className="rail-label">📊 A/B Test Active</p>
                    <div className="cap-card">
                      <span className="cap-label">Test Name</span>
                      <b>{activeTestSession.test_name}</b>
                    </div>
                    <div className="cap-card">
                      <span className="cap-label">Current Version</span>
                      <b style={{ color: '#10b981' }}>{testedVersionId === activeTestSession.version_a_id ? 'A' : 'B'}</b>
                    </div>
                    <div className="cap-card">
                      <span className="cap-label">Tracking</span>
                      <b>Implicit + Manual Ratings</b>
                    </div>
                    <p className="muted" style={{ marginTop: '12px', fontSize: '12px' }}>
                      💡 Rate responses inline with 👍👎 buttons. We also track engagement automatically.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="muted">Select an agent to view its configuration.</p>
            )}
          </aside>
        </div>

        <ConversationHistory
          agentId={selectedAgentId}
          onLoadConversation={handleLoadConversation}
          isOpen={showHistoryPanel}
          onClose={() => setShowHistoryPanel(false)}
        />
      </div>
    </DashboardLayout>
  );
}
