import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function MultiAgentChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('multi');
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(true);

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
      id: Date.now(),
      sender: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Send message to each selected agent
      for (const agentId of selectedAgents) {
        const agent = allAgents.find(a => a.id === agentId);
        if (!agent) continue;

        // Build message array with system prompt
        const messageArray = [
          {
            role: 'system',
            content: agent.system_prompt || `You are a helpful assistant named ${agent.name}.`,
          },
          {
            role: 'user',
            content: input,
          },
        ];

        try {
          const response = await fetch(`${API_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              modelId: agent.model_id || 'gemini-2.5-flash',
              messages: messageArray,
              temperature: 0.3,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();

          // Add agent response
          setMessages(prev => [...prev, {
            id: Date.now() + Math.random(),
            sender: agentId,
            senderName: agent.name,
            content: data.reply || 'Unable to get response',
            timestamp: new Date(),
          }]);
        } catch (error) {
          console.error(`Error getting response from ${agent.name}:`, error);
          setMessages(prev => [...prev, {
            id: Date.now() + Math.random(),
            sender: agentId,
            senderName: agent.name,
            content: `Error: ${error.message}`,
            timestamp: new Date(),
          }]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
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
    <div className={`multi-agent-chat ${mode === 'single' ? 'single-agent-mode' : ''}`}>
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
              className={`mode-btn ${mode === 'multi' ? 'active' : ''}`}
              onClick={() => setMode('multi')}
            >
              Multi
            </button>
            <button
              className={`mode-btn ${mode === 'single' ? 'active' : ''}`}
              onClick={() => setMode('single')}
            >
              Single
            </button>
          </div>
        </div>
      </div>

      <div className="chat-container">
        {/* Agent Selector */}
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

        {/* Chat Area */}
        <div className="chat-area">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <div className="empty-icon">💬</div>
                <div className="empty-text">
                  <p>Start a conversation with {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''}</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>Each agent will provide their perspective</p>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`message-group ${msg.sender === 'user' ? 'user' : ''}`}>
                  {msg.sender !== 'user' && (
                    <span className="agent-badge">
                      {msg.senderName || 'Agent'}
                    </span>
                  )}
                  <div className="message">{msg.content}</div>
                  <span className="message-time">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            
            )}
            {loading && (
              <div className="message-group">
                <span className="agent-badge">Processing...</span>
                <div className="message">⏳ Waiting for responses from {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''}...</div>
              </div>
            )}
          </div>

          <div className="input-area">
            <input
              type="text"
              placeholder={selectedAgents.length === 0 ? 'Select agents first...' : 'Ask something to all agents...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={selectedAgents.length === 0 || loading}
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

        {/* Comparison Panel */}
        <div className="comparison-panel">
          <div className="comparison-header">Active Agents ({selectedAgents.length})</div>
          {selectedAgents.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>
              Select agents to compare responses
            </p>
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
                    <span className="response-metric">Model: {agent?.model_id || 'gemini-2.5-flash'}</span>
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