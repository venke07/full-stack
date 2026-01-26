import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

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
  const navigate = useNavigate();
  const [chatMode, setChatMode] = useState('independent'); // 'independent', 'orchestrated', 'auto'
  const [workflowMode, setWorkflowMode] = useState('sequential'); // 'sequential' or 'parallel'
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [intermediateSteps, setIntermediateSteps] = useState([]);
  const [intentAnalysis, setIntentAnalysis] = useState(null);

  // Load user's agents from database
  useEffect(() => {
    const loadAgents = async () => {
      if (!supabase || !user?.id) return;

      const { data, error } = await supabase
        .from('agent_personas')
        .select('id, name, description, system_prompt, model_id, status')
        .eq('user_id', user.id)
        .eq('status', 'published');

      if (error) {
        console.error('Error loading agents:', error);
      } else {
        setAllAgents(data || []);
        // Auto-select first 2 agents
        if (data && data.length > 0) {
          setSelectedAgents([data[0].id, data[1]?.id].filter(Boolean));
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
    if (!input.trim() || selectedAgents.length === 0) return;

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

    try {
      if (chatMode === 'auto') {
        await handleAutoChat(input);
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

  if (agentsLoading) {
    return (
      <div className="multi-agent-chat">
        <div className="chat-header-bar">
          <div className="chat-title">
            <h2>Multi-Agent Conversation</h2>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <p>Loading your agents...</p>
        </div>
      </div>
    );
  }

  if (allAgents.length === 0) {
    return (
      <div className="multi-agent-chat">
        <div className="chat-header-bar">
          <div className="chat-title">
            <h2>Multi-Agent Conversation</h2>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', textAlign: 'center' }}>
          <p>No active agents found. Create and publish agents first!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="multi-agent-chat">
      <div className="chat-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            className="back-btn"
            onClick={() => navigate(-1)}
            title="Go back"
            type="button"
          >
            ← Back
          </button>
          <div className="chat-title">
            <h2>Multi-Agent Conversation</h2>
            <p>{selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''} active</p>
          </div>
        </div>
        <div className="chat-controls">
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
              title="Auto-detect agents & stream results"
            >
              Auto
            </button>
          </div>
          
          {(chatMode === 'orchestrated' || chatMode === 'auto') && (
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
      </div>

      <div className="chat-container">
        {/* Agent Selector */}
        {chatMode !== 'auto' && (
          <div className="agent-selector">
            <div className="selector-header">Select Agents ({selectedAgents.length})</div>
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
            {chatMode === 'orchestrated' ? '🔗 Workflow Info' : '👥 Active Agents'} ({selectedAgents.length})
          </div>
          {selectedAgents.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
              Select agents to get started
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
                    <span className="response-metric">Model: {agent?.model_id || 'gpt-4o-mini'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}