import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getModelMeta } from '../lib/modelOptions.js';
import TutorialLauncher from '../components/TutorialLauncher.jsx';
import '../styles/VoiceChat.css';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

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
        setAgents(data || []);
        if (data && data.length > 0) {
          setSelectedAgent(data[0]);
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
    setConversation((prev) => [...prev, { role: 'user', text: userMessage }]);

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
          modelId: selectedAgent.model_id || 'gemini-2.5-flash',
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
      setConversation((prev) => [...prev, { role: 'agent', text: agentMessage }]);
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

  const clearConversation = () => {
    setConversation([]);
    setTranscript('');
    setStatus('Conversation cleared');
  };

  if (isLoadingAgents) {
    return (
      <div className="app voice-chat-page">
        <header>
          <div className="brand">
            <div className="logo">🎤</div>
            <div>
              <h1>Voice Chat</h1>
              <div className="sub">Real-time conversation with AI agents</div>
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
          <div className="logo">🎤</div>
          <div>
            <h1>Voice Chat</h1>
            <div className="sub">Real-time conversation with AI agents</div>
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
                <button
                  key={agent.id}
                  className={`agent-option ${selectedAgent?.id === agent.id ? 'active' : ''}`}
                  onClick={() => setSelectedAgent(agent)}
                  disabled={isListening || isSpeaking}
                >
                  <div className="agent-pill">{agent.name?.slice(0, 2)?.toUpperCase() || 'AI'}</div>
                  <div className="agent-info">
                    <strong>{agent.name}</strong>
                    <p className="muted">{agent.description}</p>
                  </div>
                </button>
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
                <p>No messages yet</p>
                <p className="muted">Click the microphone to start speaking</p>
              </div>
            ) : (
              conversation.map((msg, idx) => (
                <div key={idx} className={`conversation-bubble ${msg.role}`}>
                  {msg.text}
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
                <div className="waveform-bars">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="bar"
                      style={{
                        height: `${Math.sin(i * 0.5 + Date.now() / 200) * audioLevel * 100 + 30}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {transcript && (
              <div className="transcript-box">
                <p className="transcript-label">Transcript:</p>
                <p className="transcript-text">{transcript}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="voice-controls">
            <button
              className={`btn control-btn ${isListening ? 'listening' : ''}`}
              onClick={isListening ? stopListening : startListening}
              disabled={!selectedAgent || isSpeaking}
            >
              {isListening ? '⏹️ Stop' : '🎤 Start Listening'}
            </button>

            <button
              className="btn primary control-btn"
              onClick={handleSendMessage}
              disabled={!transcript.trim() || !selectedAgent || isSpeaking || isListening}
            >
              Send Message
            </button>

            <button className="btn ghost control-btn" onClick={clearConversation} disabled={isListening || isSpeaking}>
              Clear Chat
            </button>
          </div>
        </section>

        {/* Info Sidebar */}
        <aside className="voice-sidebar info-panel">
          <h3>Info</h3>
          <div className="info-card">
            <p className="label">Supported Features:</p>
            <ul className="feature-list">
              <li>🎙️ Real-time speech recognition</li>
              <li>🔊 AI voice responses</li>
              <li>💬 Full conversation history</li>
              <li>🤖 Multi-agent support</li>
            </ul>
          </div>
          <div className="info-card">
            <p className="label">Tips:</p>
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
