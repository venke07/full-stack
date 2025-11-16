import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import "./chat.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export default function App() {
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get("agentId");

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadedAgent, setLoadedAgent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  // ONLY THIS ONE - Fetch agent from Supabase
  useEffect(() => {
    if (!agentId) {
      console.log("⚠️ No agentId in URL");
      return;
    }

    console.log("🔍 Looking for agent with ID:", agentId);
    console.log("SUPABASE_URL:", SUPABASE_URL);
    console.log("SUPABASE_KEY:", SUPABASE_KEY ? "✅ Set" : "❌ Missing");

    const fetchAgent = async () => {
      setIsLoading(true);
      try {
        const url = `${SUPABASE_URL}/rest/v1/agentdetails?id=eq.${agentId}&select=*`;
        console.log("📡 Fetching from:", url);

        const response = await fetch(url, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        });

        console.log("Response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Fetched data:", data);

        if (!data || data.length === 0) {
          throw new Error("Agent not found in database");
        }

        const agent = data[0];
        setLoadedAgent(agent);

        setMessages([
          { text: `Hello! I'm ${agent.name}. ${agent.description}`, sender: "ai" },
          { text: "What can I help you with today?", sender: "ai" },
        ]);
      } catch (err) {
        console.error("❌ Error:", err);
        setMessages([
          { text: `Error loading agent: ${err.message}`, sender: "ai" },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgent();
  }, [agentId]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !loadedAgent || isSending) return;

    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { text: userText, sender: "user" }]);

    try {
      setIsSending(true);

      const systemPrompt = loadedAgent.system_prompt || "You are a helpful agent.";
      const model = loadedAgent.model || "openai";

      const res = await fetch(`${BACKEND_URL}/api/model-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${systemPrompt}\n\nUser: ${userText}`,
          streaming: false,
          provider: model,
        }),
      });

      if (!res.ok) throw new Error("Failed to get response from agent");

      const data = await res.json();
      const reply = formatBotReply(data);

      setMessages((prev) => [...prev, { text: reply, sender: "ai" }]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { text: `Error: ${err.message}`, sender: "ai" },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const formatBotReply = (result) => {
    if (!result) return "I wasn't able to craft a response.";
    const payload = result.data ?? result;
    if (typeof payload === "string") return payload;
    if (payload.summary) return payload.summary;
    if (Array.isArray(payload.recommendations)) {
      return payload.recommendations
        .map((item, idx) => `${idx + 1}. ${item.title || item.name || "Item"}\n${item.description || ""}`)
        .join("\n\n");
    }
    return JSON.stringify(payload, null, 2);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="main-container">
        <main className="chat-section" style={{ textAlign: "center", marginTop: "50px" }}>
          <p>Loading agent...</p>
        </main>
      </div>
    );
  }

  if (!loadedAgent) {
    return (
      <div className="main-container">
        <main className="chat-section" style={{ textAlign: "center", marginTop: "50px" }}>
          <p>No agent found. Please use the agent builder to create one.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="main-container">
      {/* Left Sidebar */}
      <aside className="agents-sidebar">
        <h2 className="sidebar-title">Current Agent</h2>
        <div className="agents-list">
          <div className="agent-card active">
            <div className="agent-badge">{loadedAgent.name.substring(0, 2).toUpperCase()}</div>
            <div className="agent-label">{loadedAgent.name}</div>
            <div className="agent-desc">{loadedAgent.description}</div>
          </div>
        </div>
        <button 
          className="new-agent-btn" 
          onClick={() => window.location.href = "http://localhost:3000/"}
        >
          ← Back to Builder
        </button>
      </aside>

      {/* Center Chat Section */}
      <main className="chat-section">
        <header className="chat-header">
          <div className="agent-info">
            <img
              src="https://cdn-icons-png.flaticon.com/512/4712/4712101.png"
              alt="Agent Avatar"
              className="agent-avatar"
            />
            <div className="agent-meta">
              <div className="agent-name">{loadedAgent.name}</div>
              <div className="agent-status">
                <span className="status-dot"></span>
                Active and Ready
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button className="icon-btn">⋯</button>
          </div>
        </header>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`message-row ${msg.sender === "user" ? "user" : "ai"}`}
            >
              {msg.sender === "ai" && (
                <div className="avatar">
                  <img
                    src="https://cdn-icons-png.flaticon.com/512/4712/4712101.png"
                    alt="Agent"
                  />
                </div>
              )}
              <div
                className={`bubble ${
                  msg.sender === "user" ? "user-bubble" : "ai-bubble"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            rows={1}
            disabled={isSending}
          />
          <button onClick={handleSend} disabled={!input.trim() || isSending}>
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="capabilities-sidebar">
        <h2 className="sidebar-title">Capabilities</h2>
        <div className="capabilities-list">
          {loadedAgent.tools && Object.entries(loadedAgent.tools).map(([key, enabled]) =>
            enabled ? (
              <div key={key} className="capability-tag">
                {key.toUpperCase()}
              </div>
            ) : null
          )}
          <div className="capability-tag">{loadedAgent.model}</div>
          <div className="capability-tag">Formality: {loadedAgent.formality}%</div>
          <div className="capability-tag">Creativity: {loadedAgent.creativity}%</div>
        </div>
      </aside>
    </div>
  );
}
