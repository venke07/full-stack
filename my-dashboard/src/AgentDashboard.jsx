import React, { useState, useMemo } from "react";
import "./dashboard.css";
import { useNavigate } from "react-router-dom";


const initialAgents = [
  { name: "Business Analyst", status: "Active", desc: "Provides market insights", tags: ["Web Search", "RFD", "Deep Research"], lastUsed: "2 hours ago" },
  { name: "Researcher", status: "Draft", desc: "Conducts in-depth research", tags: [], lastUsed: "1 day ago" },
  { name: "Content Writer", status: "Draft", desc: "Creative writing assistant", tags: [], lastUsed: "4 hours ago" },
  { name: "Wellness Coach", status: "Draft", desc: "Provides tips on motivation", tags: [], lastUsed: "5 hours ago" },
  { name: "Sales Representative", status: "Active", desc: "Provides sales strategies", tags: ["Web Search", "RFD", "Deep Research"], lastUsed: "3 hours ago" },
];

// ⭐ NEW — Templates List
const templateAgents = [
  { name: "Marketing Advisor", desc: "Provides marketing strategy advice", tags: ["Research", "Web Search"], status: "Template" },
  { name: "Product Designer", desc: "Generates user flow and design ideas", tags: ["Creative", "UX"], status: "Template" },
  { name: "HR Assistant", desc: "Helps with candidate screening and hiring", tags: ["Screening", "Forms"], status: "Template" },
  { name: "Tutor Assistant", desc: "Explains concepts and generates lessons", tags: ["Education"], status: "Template" },
];


export default function AgentDashboard() {
  const [agents, setAgents] = useState(initialAgents);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortMode, setSortMode] = useState("recent");
  const navigate = useNavigate();

  // Add from template
  const addTemplate = (template) => {
    const newAgent = {
      ...template,
      status: "Draft",
      lastUsed: "Never",
    };
    setAgents((prev) => [...prev, newAgent]);
    setFilter("All"); // return to main list
  };

  const filteredAgents = useMemo(() => {
    if (filter === "Templates") return templateAgents;

    let list = [...agents];

    if (filter !== "All") list = list.filter((a) => a.status === filter);

    list = list.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );

    if (sortMode === "az") list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [agents, filter, search, sortMode]);

  const deleteAgent = (name) => {
    setAgents((prev) => prev.filter((a) => a.name !== name));
  };

  const toggleStatus = (name) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.name === name
          ? { ...a, status: a.status === "Active" ? "Draft" : "Active" }
          : a
      )
    );
  };

  return (
    <div className="dashboard-container">
      <header>
        <div>
          <h1>Agent Dashboard</h1>
          <p>Manage and monitor every AI agent linked to your account.</p>
        </div>

        <div className="header-actions">
          <button className="new-agent-btn">+ New Agent</button>
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search agents..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Chat Icon Button */}
          <button 
            className="chat-icon-btn"
            onClick={() => navigate('/multi-chat')}
            title="Open Multi-Agent Chat"
            type="button"
          >
            💬
          </button>
          <button className="signout-btn">Sign out</button>
        </div>
      </header>

      {/* FILTERS */}
      <div className="toolbar">
        <div className="filters">
          {["All", "Active", "Draft", "Templates"].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active-filter" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Hide sorting inside Template mode */}
        {filter !== "Templates" && (
          <select
            className="sort-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
          >
            <option value="recent">Recently Used</option>
            <option value="az">A – Z</option>
          </select>
        )}
      </div>

      {/* MAIN GRID */}
      <main className="grid">
        {filteredAgents.length === 0 ? (
          <div className="empty">No agents found.</div>
        ) : (
          filteredAgents.map((agent) => (
            <div
              className={`card ${filter === "Templates" ? "template-card" : ""}`}
              key={agent.name}
            >
              <div className="card-header">
                <span className="card-title">{agent.name}</span>
                {filter !== "Templates" ? (
                  <span
                    className={`status ${
                      agent.status === "Active" ? "active" : "draft"
                    }`}
                  >
                    {agent.status}
                  </span>
                ) : (
                  <span className="status template-tag">Template</span>
                )}
              </div>

              <p>{agent.desc}</p>

              <div className="tags">
                {agent.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>

              {filter === "Templates" ? (
                <button
                  className="template-add-btn"
                  onClick={() => addTemplate(agent)}
                >
                  ➕ Use Template
                </button>
              ) : (
                <>
                  <p className="last-used">Last used: {agent.lastUsed}</p>

                  <div className="card-actions">
                    <button
                      className="toggle-btn"
                      onClick={() => toggleStatus(agent.name)}
                    >
                      {agent.status === "Active" ? "Deactivate" : "Activate"}
                    </button>

                    <button className="manage-btn">Manage</button>

                    <button
                      className="delete-btn"
                      onClick={() => deleteAgent(agent.name)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
