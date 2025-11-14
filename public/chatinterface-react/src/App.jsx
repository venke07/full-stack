import React, { useState, useRef, useEffect } from "react";
import "./chat.css";

export default function App() {
  const [messages, setMessages] = useState([
    {
      text: "Hello! I'm your Business Analyst agent. I specialize in financial insights, market analysis, and business reporting. How can I assist you today?",
      sender: "ai",
    },
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef(null);

  // Scroll to bottom whenever new message added
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() === "") return;
    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Fake AI response
    const responses = [
      "That's an interesting point. Let me analyze that for you.",
      "I understand. I can help you with forecasting on that.",
      "Great question! This relates to financial analysis.",
      "I see what you're looking for. Let me process that.",
      "Excellent! Let's dive deeper into this insight.",
    ];

    const randomReply = responses[Math.floor(Math.random() * responses.length)];
    setTimeout(() => {
      setMessages((prev) => [...prev, { text: randomReply, sender: "ai" }]);
    }, 900);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="main-container">
      {/* Left Sidebar */}
      <aside className="agents-sidebar">
        <h2 className="sidebar-title">Your Agents</h2>
        <div className="agents-list">
          <div className="agent-card active">
            <div className="agent-badge">BA</div>
            <div className="agent-label">Business Analyst</div>
            <div className="agent-desc">Financial reports and analysis</div>
          </div>
          <div className="agent-card">
            <div className="agent-badge">RA</div>
            <div className="agent-label">Research Assistant</div>
            <div className="agent-desc">Academic Research and Support</div>
          </div>
          <div className="agent-card">
            <div className="agent-badge">CM</div>
            <div className="agent-label">Code Mentor</div>
            <div className="agent-desc">Programming Help and Debugging</div>
          </div>
          <div className="agent-card">
            <div className="agent-badge">CW</div>
            <div className="agent-label">Content Writer</div>
            <div className="agent-desc">Creative Writing & Copywriting</div>
          </div>
        </div>
        <button className="new-agent-btn">+ New Agent Chat</button>
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
              <div className="agent-name">Business Analyst</div>
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
                    alt="BA"
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
          />
          <button onClick={handleSend} disabled={!input.trim()}>
            Send
          </button>
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="capabilities-sidebar">
        <h2 className="sidebar-title">Capabilities</h2>
        <div className="capabilities-list">
          <div className="capability-tag">Forecasting</div>
          <div className="capability-tag">Financial</div>
          <div className="capability-tag">Agent Settings</div>
          <div className="capability-tag">Comprehensive</div>
          <div className="capability-tag">GPT-4</div>
        </div>
      </aside>
    </div>
  );
}
