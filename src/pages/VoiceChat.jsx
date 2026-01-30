import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getModelMeta } from '../lib/modelOptions.js';
import TutorialLauncher from '../components/TutorialLauncher.jsx';
import '../styles/VoiceChat.css';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Simple markdown formatter - converts markdown to clean text
const formatMessage = (text) => {
  if (!text) return '';
  
  return text
    // Remove ** bold markers but keep content
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove * italic markers but keep content
    .replace(/\*([^*]+)\*/g, '$1')
    // Convert markdown lists to bullet points
    .replace(/^\s*[-*]\s+/gm, '• ')
    // Convert numbered lists
    .replace(/^\s*\d+\.\s+/gm, (match) => match.trim() + ' ')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export default function VoiceChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [conversation, setConversation] = useState([]);
  const [status, setStatus] = useState('Ready to chat');
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Edit agent state
  const [editingAgentId, setEditingAgentId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!SpeechRecognition) {
      setStatus('Speech Recognition not supported in your browser');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setTranscript('');
      setStatus('Listening...');
      initializeAudioVisualization();
    };

    recognitionRef.current.onresult = (event) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcriptSegment + ' ';
        } else {
          interim += transcriptSegment + ' ';
        }
      }
      setTranscript(final || interim);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      setAudioLevel(0);
      cancelAnimationFrame(animationRef.current);
    };

    recognitionRef.current.onerror = (event) => {
      setStatus(`Error: ${event.error}`);
      setIsListening(false);
    };

    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      window.speechSynthesis.cancel();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Load agents
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
        setStatus('Failed to load agents');
      } else {
        // Filter to only Gemini agents
        const geminiAgents = (data || []).filter(a => 
          a.model_id && a.model_id.startsWith('gemini')
        );
        setAgents(geminiAgents);
        if (geminiAgents.length > 0) {
          setSelectedAgent(geminiAgents[0]);
        }
      }
      setIsLoadingAgents(false);
    };

    loadAgents();
  }, [user?.id]);

  // Initialize audio visualization
  const initializeAudioVisualization = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      source.connect(analyserRef.current);

      const updateLevel = () => {
        if (isListening && analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(Math.min(average / 255, 1));
          animationRef.current = requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();
    } catch (error) {
      console.error('Audio access error:', error);
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handleSendMessage = async () => {
    if (!transcript.trim() || !selectedAgent || isSpeaking) {
      return;
    }

    const userMessage = transcript;
    setTranscript('');
    setStatus('Processing...');

    // Add user message to conversation
    setConversation((prev) => [...prev, { 
      role: 'user', 
      text: userMessage,
      timestamp: new Date()
    }]);

    try {
      // Build system prompt
      const systemPrompt = selectedAgent.system_prompt || `You are ${selectedAgent.name}. ${selectedAgent.description}`;

      const messages = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...conversation.map((msg) => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: userMessage },
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          modelId: selectedAgent.model_id || 'gemini-2.0-flash-exp',  // Use Gemini instead
          messages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const agentMessage = data.reply;

      // Add agent message to conversation
      setConversation((prev) => [...prev, { 
        role: 'agent', 
        text: agentMessage,
        timestamp: new Date(),
        agentName: selectedAgent?.name
      }]);
      setStatus('Speaking...');

      // Speak the response
      speakText(agentMessage);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error('Chat error:', error);
    }
  };

  const speakText = (text) => {
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = () => {
      setIsSpeaking(false);
      setStatus('Ready to chat');
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setStatus('Speech error');
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setStatus('Ready to chat');
  };

  const clearConversation = () => {
    setConversation([]);
    setTranscript('');
    setStatus('Conversation cleared');
  };

  const handleSelectAgent = (agent) => {
    if (agent.id !== selectedAgent?.id) {
      setSelectedAgent(agent);
      setConversation([]);
      setTranscript('');
      setStatus('Ready to chat');
    }
  };

  // Start editing an agent
  const startEditingAgent = (e, agent) => {
    e.stopPropagation();
    setEditingAgentId(agent.id);
    setEditName(agent.name || '');
    setEditDescription(agent.description || '');
  };

  // Cancel editing
  const cancelEditing = (e) => {
    if (e) e.stopPropagation();
    setEditingAgentId(null);
    setEditName('');
    setEditDescription('');
  };

  // Save agent changes
  const saveAgentChanges = async (e) => {
    e.stopPropagation();
    if (!editName.trim()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('agent_personas')
        .update({ 
          name: editName.trim(),
          description: editDescription.trim()
        })
        .eq('id', editingAgentId);

      if (error) throw error;

      // Update local state
      setAgents(prev => prev.map(a => 
        a.id === editingAgentId 
          ? { ...a, name: editName.trim(), description: editDescription.trim() }
          : a
      ));

      // Update selected agent if it was edited
      if (selectedAgent?.id === editingAgentId) {
        setSelectedAgent(prev => ({ 
          ...prev, 
          name: editName.trim(), 
          description: editDescription.trim() 
        }));
      }

      setEditingAgentId(null);
      setEditName('');
      setEditDescription('');
    } catch (error) {
      console.error('Failed to update agent:', error);
      setStatus('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingAgents) {
    return (
      <div className="app voice-chat-page">
        <header>
          <div className="brand">
            <div className="logo">�️</div>
            <div>
              <h1>Voice Chat</h1>
              <div className="sub">Real-time AI conversation</div>
            </div>
          </div>
          <div className="header-actions">
            <Link className="btn ghost compact" to="/chat">
              ← Back to Chat
            </Link>
            <Link className="btn ghost compact" to="/home">
              Dashboard
            </Link>
          </div>
        </header>
        <div className="loading">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="app voice-chat-page">
      <header>
        <div className="brand">
          <div className="logo">�️</div>
          <div>
            <h1>Voice Chat</h1>
            <div className="sub">Real-time AI conversation</div>
          </div>
        </div>
        <div className="header-actions">
          <TutorialLauncher />
          <Link className="btn ghost compact" to="/chat">
            ← Back to Chat
          </Link>
          <Link className="btn ghost compact" to="/home">
            Dashboard
          </Link>
        </div>
      </header>

      <div className="voice-chat-container">
        {/* Agent Selector */}
        <aside className="voice-sidebar agent-selector">
          <h3>Select Agent</h3>
          <div className="agent-list">
            {agents.length === 0 ? (
              <p className="muted">No published agents found</p>
            ) : (
              agents.map((agent) => (
                <div key={agent.id} className="agent-option-wrapper">
                  {editingAgentId === agent.id ? (
                    <div className="agent-edit-form">
                      <input
                        type="text"
                        className="agent-edit-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Agent name"
                        autoFocus
                      />
                      <input
                        type="text"
                        className="agent-edit-input small"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description"
                      />
                      <div className="agent-edit-actions">
                        <button 
                          className="edit-btn save" 
                          onClick={saveAgentChanges}
                          disabled={isSaving || !editName.trim()}
                        >
                          {isSaving ? '...' : '✓'}
                        </button>
                        <button 
                          className="edit-btn cancel" 
                          onClick={cancelEditing}
                          disabled={isSaving}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className={`agent-option ${selectedAgent?.id === agent.id ? 'active' : ''}`}
                      onClick={() => handleSelectAgent(agent)}
                      disabled={isListening || isSpeaking}
                    >
                      <div className="agent-pill">{agent.name?.slice(0, 2)?.toUpperCase() || 'AI'}</div>
                      <div className="agent-info">
                        <strong>{agent.name}</strong>
                        <p className="muted">{agent.description}</p>
                      </div>
                      <div
                        className="agent-edit-btn"
                        onClick={(e) => startEditingAgent(e, agent)}
                        title="Edit agent"
                      >
                        ✏️
                      </div>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Voice Chat Area */}
        <section className="voice-stage">
          <div className="voice-header">
            {selectedAgent ? (
              <>
                <h2>{selectedAgent.name}</h2>
                <p className="muted">{selectedAgent.description}</p>
              </>
            ) : (
              <p className="muted">Select an agent to start chatting</p>
            )}
          </div>

          {/* Conversation History */}
          <div className="conversation-display">
            {conversation.length === 0 ? (
              <div className="conversation-empty">
                <div className="empty-icon">💬</div>
                <p>No messages yet</p>
                <p className="hint">Click the microphone to start speaking</p>
              </div>
            ) : (
              conversation.map((msg, idx) => (
                <div key={idx} className={`message-group ${msg.role === 'user' ? 'user' : ''}`}>
                  {msg.role === 'agent' && (
                    <span className="agent-badge">{msg.agentName || 'Agent'}</span>
                  )}
                  <div className={`conversation-bubble ${msg.role}`}>
                    {formatMessage(msg.text)}
                  </div>
                  {msg.timestamp && (
                    <span className="message-time">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Status and Transcript */}
          <div className="voice-feedback">
            <div className="status-line">
              <span className={`status-badge ${isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle'}`}>
                {isListening ? '🎙️ Listening' : isSpeaking ? '🔊 Speaking' : '✓ Ready'}
              </span>
              <span className="status-text">{status}</span>
            </div>

            {isListening && (
              <div className="audio-visualization">
                <div className="voice-orb">
                  <div className="orb-ring"></div>
                  <div className="orb-ring"></div>
                  <div className="orb-ring"></div>
                  <div className="orb-core"></div>
                </div>
              </div>
            )}

            {isSpeaking && (
              <div className="audio-visualization">
                <div className="waveform-bars">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="bar"
                      style={{
                        height: `${Math.random() * 80 + 20}%`,
                        animationDelay: `${i * 0.05}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {transcript && (
              <div className="transcript-box">
                <p className="transcript-label">Transcript</p>
                <p className="transcript-text">{transcript}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="voice-controls">
            <button
              className="control-btn clear"
              onClick={clearConversation}
              disabled={isListening || isSpeaking || conversation.length === 0}
            >
              🗑️ Clear
            </button>

            {isSpeaking ? (
              <button
                className="mic-button stop-speaking"
                onClick={stopSpeaking}
                title="Stop speaking"
              >
                ⏹️
              </button>
            ) : (
              <button
                className={`mic-button ${isListening ? 'listening' : ''}`}
                onClick={isListening ? stopListening : startListening}
                disabled={!selectedAgent}
                title={isListening ? 'Stop listening' : 'Start listening'}
              >
                {isListening ? '⏹️' : '🎤'}
              </button>
            )}

            <button
              className="control-btn send"
              onClick={handleSendMessage}
              disabled={!transcript.trim() || !selectedAgent || isSpeaking || isListening}
            >
              Send ➤
            </button>
          </div>
        </section>

        {/* Info Sidebar */}
        <aside className="voice-sidebar info-panel">
          <h3>Features</h3>
          <div className="info-card">
            <ul className="feature-list">
              <li>Real-time speech recognition</li>
              <li>Natural AI voice responses</li>
              <li>Full conversation history</li>
              <li>Multi-agent support</li>
            </ul>
          </div>
          <h3>Tips</h3>
          <div className="info-card">
            <ul className="tips-list">
              <li>Speak clearly and naturally</li>
              <li>Wait for the response to finish</li>
              <li>You can interrupt anytime</li>
              <li>Works best in quiet environments</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
