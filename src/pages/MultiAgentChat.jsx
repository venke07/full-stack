import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { buildUsageEvent, logUsageEvent } from '../lib/analytics.js';
import TutorialLauncher from '../components/TutorialLauncher.jsx';
import { getModelMeta } from '../lib/modelOptions.js';
import DashboardLayout from '../components/DashboardLayout.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Generate reasonably unique ids for message keys
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Download generated file
 */
const downloadFile = (url, filename) => {
  const link = document.createElement('a');
  link.href = `${API_URL}${url}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function MultiAgentChat() {
  const { user } = useAuth();
  const [chatMode, setChatMode] = useState('independent'); // 'independent', 'orchestrated', 'auto', 'debate'
  const [workflowMode, setWorkflowMode] = useState('sequential'); // 'sequential' or 'parallel'
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [intermediateSteps, setIntermediateSteps] = useState([]);
  const [intentAnalysis, setIntentAnalysis] = useState(null);
  const [suggestedAgents, setSuggestedAgents] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load user's agents from database
  useEffect(() => {
    const loadAgents = async () => {
      if (!supabase || !user?.id) return;

      const ownedResponse = await supabase
        .from('agent_personas')
        .select('id, name, description, system_prompt, model_id, model_label, status')
        .eq('user_id', user.id)
        .eq('status', 'published');

      const accessResponse = await supabase
        .from('agent_access')
        .select('agent_id, role')
        .eq('user_id', user.id);

      let sharedAgents = [];
      if (!accessResponse.error && accessResponse.data?.length) {
        const sharedIds = accessResponse.data.map((row) => row.agent_id);
        const { data: sharedData, error: sharedError } = await supabase
          .from('agent_personas')
          .select('id, name, description, system_prompt, model_id, status')
          .in('id', sharedIds)
          .eq('status', 'published');
        if (!sharedError) {
          sharedAgents = sharedData ?? [];
        }
      }

      if (ownedResponse.error) {
        console.error('Error loading agents:', ownedResponse.error);
      } else {
        const combined = [...(ownedResponse.data || []), ...sharedAgents];
        setAllAgents(combined);
        // Auto-select first 2 agents
        if (combined.length > 0) {
          setSelectedAgents([combined[0].id, combined[1]?.id].filter(Boolean));
        }
      }
      setAgentsLoading(false);
    };

    loadAgents();
  }, [user?.id]);

  const toggleAgent = (agentId) => {
    setSelectedAgents(prev =>
      prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );
  };

  const handleSendMessage = async () => {
    if (!input.trim() || (selectedAgents.length === 0 && chatMode !== 'auto')) return;

    const userMessage = {
      id: makeId(),
      sender: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setIntermediateSteps([]);
    setIntentAnalysis(null);
    setSuggestedAgents(null);
    setShowSuggestions(false);

    try {
      if (chatMode === 'debate') {
        await handleDebateMode(input);
      } else if (chatMode === 'auto') {
        await handleSmartRoutingChat(input);
      } else if (chatMode === 'orchestrated') {
        await handleOrchestratedChat(input);
      } else {
        await handleIndependentChat(input);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: makeId(),
        sender: 'system',
        senderName: '❌ Error',
        content: error.message,
        timestamp: new Date(),
        type: 'error',
      }]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Smart Routing - analyze query and suggest best agents
   */
  const handleSmartRoutingChat = async (prompt) => {
    try {
      const routingResponse = await fetch(`${API_URL}/api/smart-routing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: prompt,
          availableAgents: allAgents,
        }),
      });

      if (!routingResponse.ok) {
        throw new Error(`Routing failed: ${routingResponse.status}`);
      }

      const routing = await routingResponse.json();
      setSuggestedAgents(routing.topAgents);
      setShowSuggestions(true);

      setMessages(prev => [...prev, {
        id: makeId(),
        sender: 'system',
        senderName: '🎯 Smart Routing',
        content: `Analysis: ${routing.analysis}\n\nSelected ${routing.topAgents.length} agents for this task`,
        timestamp: new Date(),
        type: 'routing',
        suggestions: routing.topAgents,
      }]);

      const suggestedAgentIds = routing.topAgents.map(a => a.agentId);
      const suggestedAgents = suggestedAgentIds
        .map(id => allAgents.find(a => a.id === id))
        .filter(Boolean);
      
      const orchestrationResponse = await fetch(`${API_URL}/api/orchestrated-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentIds: suggestedAgentIds,
          agents: suggestedAgents,
          userPrompt: prompt,
          mode: workflowMode,
        }),
      });

      if (!orchestrationResponse.ok) {
        throw new Error(`Orchestration failed: ${orchestrationResponse.status}`);
      }

      const data = await orchestrationResponse.json();

      if (data.result?.finalResult) {
        setMessages(prev => [...prev, {
          id: makeId(),
          sender: 'system',
          senderName: '✅ Result',
          content: data.result.finalResult,
          timestamp: new Date(),
          type: 'final',
          documents: data.documents || [],
        }]);
      }
    } catch (error) {
      console.error('Smart routing error:', error);
      throw error;
    }
  };

  /**
   * Debate Mode - agents discuss and reach consensus
   */
  const handleDebateMode = async (prompt) => {
    if (selectedAgents.length < 2) {
      throw new Error('Debate mode requires at least 2 agents');
    }

    try {
      const response = await fetch(`${API_URL}/api/debate-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: prompt,
          agentIds: selectedAgents,
          agents: allAgents.filter(a => selectedAgents.includes(a.id)),
        }),
      });

      if (!response.body) {
        throw new Error('No response stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'debate-start') {
              setMessages(prev => [...prev, {
                id: makeId(),
                sender: 'system',
                senderName: '🎬 Debate Starting',
                content: `Topic: ${data.data.topic}\n${data.data.agentCount} agents ready to discuss`,
                timestamp: new Date(),
                type: 'debate-start',
              }]);
            }

            if (data.type === 'agent-position') {
              setMessages(prev => [...prev, {
                id: makeId(),
                sender: data.data.agentId,
                senderName: `💬 ${data.data.agentName} (Position)`,
                content: data.data.position,
                timestamp: new Date(),
                type: 'debate-position',
              }]);
            }

            if (data.type === 'agent-rebuttal') {
              setMessages(prev => [...prev, {
                id: makeId(),
                sender: data.data.agentId,
                senderName: `🔄 ${data.data.agentName} (Rebuttal)`,
                content: data.data.rebuttal,
                timestamp: new Date(),
                type: 'debate-rebuttal',
              }]);
            }

            if (data.type === 'consensus-reached') {
              const consensusText = `Agreement Points:\n${data.data.consensusPoints.map(p => `• ${p}`).join('\n')}\n\nConclusion:\n${data.data.conclusion}\n\nStrongest Argument: ${data.data.strongestArgument.agent}`;
              setMessages(prev => [...prev, {
                id: makeId(),
                sender: 'system',
                senderName: '🤝 Consensus',
                content: consensusText,
                timestamp: new Date(),
                type: 'consensus',
              }]);
            }

            if (data.type === 'error') {
              setMessages(prev => [...prev, {
                id: makeId(),
                sender: 'system',
                senderName: '❌ Error',
                content: data.data.error,
                timestamp: new Date(),
                type: 'error',
              }]);
            }
          } catch (parseError) {
            console.error('Parse error:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('Debate mode error:', error);
      throw error;
    }
  };

  /**
   * Handle auto mode - system-driven orchestration with real-time streaming
   */
  const handleAutoChat = async (prompt) => {
    try {
      const eventSource = new EventSource(
        `${API_URL}/api/orchestrated-chat-stream?${new URLSearchParams({
          userPrompt: prompt,
          autoMode: 'true',
          mode: workflowMode,
        }).toString()}`
      );

      let isFirstEvent = true;

      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'task-analysis') {
            setIntentAnalysis(data.data);
            setMessages(prev => [...prev, {
              id: makeId(),
              sender: 'system',
              senderName: '🔍 Task Analysis',
              content: `Detected: ${data.data.description}\nConfidence: ${(data.data.confidence).toFixed(1)}%`,
              timestamp: new Date(),
              type: 'intent',
            }]);
          }

          if (data.type === 'agent-start') {
            setMessages(prev => [...prev, {
              id: makeId(),
              sender: 'system',
              senderName: `📍 Step ${data.data.step}: ${data.data.agent}`,
              content: 'Processing...',
              timestamp: new Date(),
              type: 'step-start',
            }]);
          }

          // Add agent response
          setMessages(prev => [...prev, {
            id: Date.now() + Math.random(),
            sender: agentId,
            senderName: agent.name,
            content: data.reply || 'Unable to get response',
            timestamp: new Date(),
          }]);
          const usagePayload = buildUsageEvent({
            userId: user?.id,
            agentId,
            modelId: agent.model_id || 'gemini-2.5-flash',
            promptMessages: messageArray,
            responseText: data.reply || '',
            source: mode === 'multi' ? 'multi-chat' : 'multi-chat-single',
            messageCount: 2,
          });
          void logUsageEvent({ supabaseClient: supabase, payload: usagePayload });
        } catch (error) {
          console.error(`Error getting response from ${agent.name}:`, error);
          if (data.type === 'agent-response') {
            setMessages(prev => [...prev, {
              id: makeId(),
              sender: data.data.agentId,
              senderName: `✅ ${data.data.agent}`,
              content: data.data.output,
              timestamp: new Date(data.data.timestamp),
              type: 'agent-response',
            }]);
          }

          if (data.type === 'agent-error') {
            setMessages(prev => [...prev, {
              id: makeId(),
              sender: 'system',
              senderName: `❌ ${data.data.agent}`,
              content: `Error: ${data.data.error}`,
              timestamp: new Date(),
              type: 'error',
            }]);
          }

          if (data.type === 'workflow-complete') {
            setMessages(prev => [...prev, {
              id: makeId(),
              sender: 'system',
              senderName: '🎉 Workflow Complete',
              content: data.data.finalResult,
              timestamp: new Date(),
              type: 'final',
            }]);
            eventSource.close();
          }

          if (data.type === 'error') {
            setMessages(prev => [...prev, {
              id: makeId(),
              sender: 'system',
              senderName: '❌ Error',
              content: data.data.error,
              timestamp: new Date(),
              type: 'error',
            }]);
            eventSource.close();
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
        }
      });

      eventSource.addEventListener('error', (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        setMessages(prev => [...prev, {
          id: makeId(),
          sender: 'system',
          senderName: '❌ Connection Error',
          content: 'Lost connection to server',
          timestamp: new Date(),
          type: 'error',
        }]);
      });
    } catch (error) {
      console.error('Auto chat error:', error);
      setMessages(prev => [...prev, {
        id: makeId(),
        sender: 'system',
        senderName: '❌ Error',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
        type: 'error',
      }]);
    }
  };

  /**
   * Handle independent chat - each agent responds separately
   */
  const handleIndependentChat = async (prompt) => {
    for (const agentId of selectedAgents) {
      const agent = allAgents.find(a => a.id === agentId);
      if (!agent) continue;

      const messageArray = [
        {
          role: 'system',
          content: agent.system_prompt || `You are a helpful assistant named ${agent.name}.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ];

      try {
        const response = await fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: agent.model_id || 'gpt-4o-mini',
            messages: messageArray,
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        setMessages(prev => [...prev, {
          id: makeId(),
          sender: agentId,
          senderName: agent.name,
          content: data.reply || 'Unable to get response',
          timestamp: new Date(),
          type: 'independent',
        }]);
      } catch (error) {
        console.error(`Error getting response from ${agent.name}:`, error);
        setMessages(prev => [...prev, {
          id: makeId(),
          sender: agentId,
          senderName: agent.name,
          content: `Error: ${error.message}`,
          timestamp: new Date(),
          type: 'error',
        }]);
      }
    }
  };

  /**
   * Handle orchestrated chat - agents work together
   */
  const handleOrchestratedChat = async (prompt) => {
    try {
      const response = await fetch(`${API_URL}/api/orchestrated-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentIds: selectedAgents,
          userPrompt: prompt,
          mode: workflowMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Orchestration failed');
      }

      // Store intent analysis
      if (data.intentAnalysis) {
        setIntentAnalysis(data.intentAnalysis);
        setMessages(prev => [...prev, {
          id: makeId(),
          sender: 'system',
          senderName: '🔍 Intent Analysis',
          content: `Detected: ${data.intentAnalysis.description}\nConfidence: ${(data.intentAnalysis.confidence * 100).toFixed(0)}%`,
          timestamp: new Date(),
          type: 'intent',
        }]);
      }

      // Display intermediate steps if sequential mode
      if (workflowMode === 'sequential' && data.result.intermediateSteps) {
        setIntermediateSteps(data.result.intermediateSteps);
        
        data.result.intermediateSteps.forEach((step, index) => {
          setMessages(prev => [...prev, {
            id: makeId(),
            sender: 'system',
            senderName: `📊 Step ${step.stepNumber}: ${step.agent}`,
            content: `Input: ${step.input.substring(0, 100)}...\n\nOutput: ${step.output.substring(0, 200)}...`,
            timestamp: step.timestamp || new Date(),
            type: 'step',
          }]);
        });
      }

      // Add final result
      setMessages(prev => [...prev, {
        id: makeId(),
        sender: 'system',
        senderName: '✅ Final Result',
        content: data.result.finalResult || data.result.agentResponses,
        timestamp: new Date(),
        type: 'final',
        documents: data.documents || [],
      }]);

    } catch (error) {
      console.error('Orchestration error:', error);
      setMessages(prev => [...prev, {
        id: makeId(),
        sender: 'system',
        senderName: '❌ Error',
        content: `Orchestration failed: ${error.message}`,
        timestamp: new Date(),
        type: 'error',
      }]);
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
    let currentText = text;
    let key = 0;
    
    // Bold text **text**
    const boldRegex = /\*\*(.+?)\*\*/g;
    // Inline code `code`
    const codeRegex = /`([^`]+)`/g;
    
    // Combine patterns
    const combined = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = combined.exec(currentText)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(
          <span key={key++}>{currentText.substring(lastIndex, match.index)}</span>
        );
      }
      
      // Add formatted match
      if (match[0].startsWith('**')) {
        // Bold
        parts.push(
          <strong key={key++} style={{ fontWeight: '700', color: '#84ffe1' }}>
            {match[2]}
          </strong>
        );
      } else if (match[0].startsWith('`')) {
        // Inline code
        parts.push(
          <code key={key++} style={{ 
            background: 'rgba(255, 255, 255, 0.1)', 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.9em'
          }}>
            {match[3]}
          </code>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < currentText.length) {
      parts.push(<span key={key++}>{currentText.substring(lastIndex)}</span>);
    }
    
    return parts.length > 0 ? parts : text;
  };

  const modeHelper = {
    independent: 'Agents respond independently',
    orchestrated: 'Workflow orchestration',
    auto: 'Smart routing',
    debate: 'Structured debate',
  }[chatMode];

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Swarm Collaboration</p>
      <h1>Multi-Agent Conversation</h1>
      <p className="dashboard-sub">
        {modeHelper} · {selectedAgents.length}{' '}
        active agent{selectedAgents.length === 1 ? '' : 's'}
      </p>
    </div>
  );

  const headerActions = (
    <div className="page-actions">
      <Link className="btn secondary" to="/builder">
        Open builder
      </Link>
      <Link className="btn secondary" to="/home">
        Back to overview
      </Link>
    </div>
  );

  if (agentsLoading) {
    return (
      <DashboardLayout headerContent={headerContent} actions={headerActions}>
        <div
          className="multi-agent-chat"
          style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <p>Loading your agents...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (allAgents.length === 0) {
    return (
      <DashboardLayout headerContent={headerContent} actions={headerActions}>
        <div
          className="multi-agent-chat"
          style={{
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <p>No active agents found. Create and publish agents first!</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout headerContent={headerContent} actions={headerActions}>
      <div className="multi-agent-chat">
        <div className="chat-header-bar">
          <div className="chat-title">
            <h3>Mode: {modeHelper}</h3>
            <p>
              {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''} active
            </p>
          </div>
        </div>
        <div className="chat-controls">
          <TutorialLauncher />
          <div className="mode-toggle">
            <button
              className={`mode-btn ${chatMode === 'independent' ? 'active' : ''}`}
              onClick={() => setChatMode('independent')}
              title="Agents respond independently"
            >
              Independent
            </button>
            <button
              className={`mode-btn ${chatMode === 'orchestrated' ? 'active' : ''}`}
              onClick={() => setChatMode('orchestrated')}
              title="Agents collaborate in a workflow"
            >
              Orchestrated
            </button>
            <button
              className={`mode-btn ${chatMode === 'auto' ? 'active' : ''}`}
              onClick={() => setChatMode('auto')}
              title="Smart routing & auto-selection"
            >
              Smart Routing
            </button>
            <button
              className={`mode-btn ${chatMode === 'debate' ? 'active' : ''}`}
              onClick={() => setChatMode('debate')}
              title="Agents debate and reach consensus"
            >
              Debate
            </button>
          </div>

          {(chatMode === 'orchestrated' || chatMode === 'auto') && chatMode !== 'debate' && (
            <div className="workflow-toggle">
              <button
                className={`mode-btn ${workflowMode === 'sequential' ? 'active' : ''}`}
                onClick={() => setWorkflowMode('sequential')}
                title="Agents work in sequence"
              >
                Sequential
              </button>
              <button
                className={`mode-btn ${workflowMode === 'parallel' ? 'active' : ''}`}
                onClick={() => setWorkflowMode('parallel')}
                title="Agents work in parallel"
              >
                Parallel
              </button>
            </div>
          )}
        </div>

        <div className={`chat-container chat-mode-${chatMode}`}>
        {/* Agent Selector */}
        {chatMode !== 'auto' && (
          <div className="agent-selector">
            <div className="selector-header">
              {chatMode === 'debate' ? 'Select Agents for Debate' : 'Select Agents'} ({selectedAgents.length})
            </div>
            <ul className="agent-list-selector">
              {allAgents.map((agent, idx) => (
                <li key={agent.id} className="agent-option">
                  <input
                    type="checkbox"
                    id={agent.id}
                    checked={selectedAgents.includes(agent.id)}
                    onChange={() => toggleAgent(agent.id)}
                  />
                  <label htmlFor={agent.id} style={{ flex: 1, cursor: 'pointer', margin: 0 }}>
                    <div className="agent-info">
                      <span className="agent-name">{agent.name}</span>
                      <span className="agent-desc">{agent.description}</span>
                    </div>
                  </label>
                  <span className="agent-status-dot" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Chat Area */}
        <div className="chat-area">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <div className="empty-icon">💬</div>
                <div className="empty-text">
                  <p>
                    {chatMode === 'auto' 
                      ? 'Describe what you need, the system will auto-detect agents'
                      : `Start a conversation with ${selectedAgents.length} agent${selectedAgents.length !== 1 ? 's' : ''}`
                    }
                  </p>
                  <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                    {chatMode === 'independent' 
                      ? 'Each agent will provide their perspective'
                      : chatMode === 'auto'
                      ? 'Real-time step-by-step agent communication'
                      : 'Agents will collaborate to complete the task'}
                  </p>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`message-group ${msg.sender === 'user' ? 'user' : ''} ${msg.type || ''}`}>
                  {msg.sender !== 'user' && (
                    <span className="agent-badge">
                      {msg.senderName || 'Agent'}
                    </span>
                  )}
                  <div className="message">
                    {msg.sender === 'user' ? msg.content : formatMessage(msg.content)}
                    {msg.documents && msg.documents.length > 0 && (
                      <div className="document-downloads">
                        <div style={{ fontSize: '0.85rem', fontWeight: '500', marginTop: '12px', marginBottom: '8px', color: '#666' }}>
                          📄 Download Report:
                        </div>
                        {msg.documents.map((doc, idx) => (
                          <a
                            key={idx}
                            href={doc.downloadUrl}
                            download={doc.filename}
                            className="document-download-btn"
                            title={`Download ${doc.filename}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginRight: '8px',
                              marginBottom: '4px',
                              padding: '8px 16px',
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontSize: '0.9rem',
                              fontWeight: '500',
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#45a049';
                              e.target.style.transform = 'translateY(-1px)';
                              e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#4CAF50';
                              e.target.style.transform = 'translateY(0)';
                              e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                            }}
                          >
                            <span>📥</span>
                            <span>Consolidated Report.docx</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="message-time">
                    {(msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
            {loading && (
              <div className="message-group">
                <span className="agent-badge">Processing...</span>
                <div className="message">
                  {chatMode === 'auto'
                    ? '🤖 Auto-orchestrating agents...'
                    : chatMode === 'orchestrated' 
                    ? '🔗 Orchestrating agents workflow...'
                    : `⏳ Waiting for responses from ${selectedAgents.length} agent${selectedAgents.length !== 1 ? 's' : ''}...`
                  }
                </div>
              </div>
            )}
          </div>

          <div className="input-area">
            <input
              type="text"
              placeholder={chatMode === 'auto' 
                ? 'Describe what you need...'
                : selectedAgents.length === 0 ? 'Select agents first...' : 
                chatMode === 'orchestrated' ? 'Describe the task for agents to collaborate on...' : 'Ask something to all agents...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={(chatMode !== 'auto' && selectedAgents.length === 0) || loading}
            />
            <button 
              className="send-btn" 
              onClick={handleSendMessage} 
              disabled={!input.trim() || selectedAgents.length === 0 || loading}
            >
              {loading ? '⏳' : 'Send'}
            </button>
          </div>
        </div>

        {/* Info Panel */}
        <div className="comparison-panel">
          <div className="comparison-header">
            {chatMode === 'orchestrated' ? '🔗 Workflow Info' : chatMode === 'auto' ? '🎯 Suggested Agents' : '👥 Active Agents'} ({chatMode === 'auto' && suggestedAgents ? suggestedAgents.length : selectedAgents.length})
          </div>
          {chatMode === 'auto' && suggestedAgents ? (
            suggestedAgents.map((suggestion, idx) => {
              const agent = allAgents.find(a => a.id === suggestion.agentId);
              return (
                <div key={suggestion.agentId} className="agent-response">
                  <div className="response-header">
                    <span className="response-badge" style={{
                      backgroundColor: ['#6aa8ff', '#7af0d5', '#fbbf24', '#f97316'][idx % 4]
                    }} />
                    {agent?.name}
                  </div>
                  <div className="response-text">
                    {agent?.description}
                  </div>
                  <div className="response-footer">
                    <span className="response-metric">Match: {suggestion.relevance}%</span>
                    <span className="response-metric">{suggestion.reason}</span>
                  </div>
                </div>
              );
            })
          ) : selectedAgents.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
              {chatMode === 'auto' ? 'Send a message to see suggestions' : 'Select agents to get started'}
            </p>
          ) : chatMode === 'orchestrated' && intentAnalysis ? (
            <div className="workflow-info">
              <div className="info-section">
                <span className="info-label">Intent</span>
                <span className="info-value">{intentAnalysis.description}</span>
              </div>
              <div className="info-section">
                <span className="info-label">Confidence</span>
                <span className="info-value">{(intentAnalysis.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="info-section">
                <span className="info-label">Workflow</span>
                <span className="info-value">{workflowMode}</span>
              </div>
              <div className="info-section">
                <span className="info-label">Steps</span>
                <span className="info-value">{intermediateSteps.length}</span>
              </div>
            </div>
          ) : (
            selectedAgents.map((agentId, idx) => {
              const agent = allAgents.find(a => a.id === agentId);
              return (
                <div key={agentId} className="agent-response">
                  <div className="response-header">
                    <span className="response-badge" style={{
                      backgroundColor: ['#6aa8ff', '#7af0d5', '#fbbf24'][idx % 3]
                    }} />
                    {agent?.name}
                  </div>
                  <div className="response-text">
                    {agent?.description}
                  </div>
                  <div className="response-footer">
                    <span className="response-metric">Model: {getModelMeta(agent?.model_id).label}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <div/>
    </div>
    </DashboardLayout>
  );
}
