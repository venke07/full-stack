import React, { useEffect, useMemo, useState } from "react";
import "./chat-summary.css";

function BotAvatar() {
  return (
    <div className="avatar" aria-hidden="true">
      <span className="avatar-face">🤖</span>
    </div>
  );
}

export default function ChatSummaryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeAgentId, setActiveAgentId] = useState(null);

  // backend data state
  const [agents, setAgents] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  const API_URL = "http://localhost:3000/api/summary/list";


  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const res = await fetch(API_URL);
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const data = await res.json();

        // { id, name, summary, highlights, tags, summary_time }
        setAgents(Array.isArray(data) ? data : []);
      } catch (err) {
        setErrorMsg(err.message || "Failed to load summaries.");
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  // Frontend filter (on fetched data)
  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return agents;

    return agents.filter((a) => {
      const hay = [
        a.name,
        a.summary,
        ...(a.highlights || []),
        ...(a.tags || []),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [agents, searchQuery]);

  const toggleAgent = (id) => {
    setActiveAgentId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="cs-page">
      {/* Header */}
      <header className="cs-header">
        <button className="icon-btn" aria-label="Open menu">
          Back
        </button>

        <h1 className="cs-title">Chat Summary</h1>

        <button className="icon-btn" aria-label="Open settings">
          ⚙
        </button>
      </header>

      {/* Search */}
      <div className="cs-search-wrap">
        <div className="cs-search">
          <span className="cs-search-icon" aria-hidden="true">
            🔎
          </span>
          <input
            className="cs-search-input"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search summaries"
          />
        </div>
      </div>

      {/* List */}
      <main className="cs-list" role="list">
        {loading ? (
          <div className="cs-empty">
            <div className="cs-empty-title">Loading…</div>
            <div className="cs-empty-sub">Fetching chat summaries from server.</div>
          </div>
        ) : errorMsg ? (
          <div className="cs-empty">
            <div className="cs-empty-title">Error</div>
            <div className="cs-empty-sub">{errorMsg}</div>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="cs-empty">
            <div className="cs-empty-title">No results</div>
            <div className="cs-empty-sub">
              Try searching by agent name, tag, or topic.
            </div>
          </div>
        ) : (
          filteredAgents.map((agent) => {
            const isOpen = activeAgentId === agent.id;

            return (
              <section
                key={agent.id}
                className={`cs-card ${isOpen ? "active" : ""}`}
                role="listitem"
              >
                <button
                  className="cs-card-head"
                  onClick={() => toggleAgent(agent.id)}
                  aria-expanded={isOpen}
                >
                  <BotAvatar />

                  <div className="cs-card-head-text">
                    <div className="cs-card-title-row">
                      <div className="cs-card-title">{agent.name}</div>
                      <div className="cs-card-meta">Last updated: {agent.summary_time || "None"}</div>
                    </div>
                    <div className="cs-card-subtitle">{agent.description}</div>
                  </div>

                  <span className="cs-chevron" aria-hidden="true">
                    {isOpen ? "▴" : "▾"}
                  </span>
                </button>

              {isOpen && (
                  <div className="cs-card-body">
                    <div className="cs-summary-text">
                      {agent.summary}
                    </div>

                    <div className="cs-note">
                      This is an AI-generated summary of recent conversations.
                    </div>
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
