// usageDashboard.js
import React from "react";
import { useNavigate } from "react-router-dom";
import "./usageDashboard.css";


export default function UsageDashboard() {
  const navigate = useNavigate();

  const [loadingAgentData, setloadingAgentData] = React.useState(true);
  const [agentData, setAgentData] = React.useState(null);
  const [activeAgentId, setActiveAgentId] = React.useState(null);
  const [expandedAgentId, setExpandedAgentId] = React.useState(null);   

  const groupedAgents = React.useMemo(() => {
  const raw = Array.isArray(agentData) ? agentData : [];

  const map = new Map();
  for (const a of raw) {
    const key = a.name.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        nameKey: key,
        displayName: a.name,
        items: [],
      });
    }
    map.get(key).items.push(a);
  }

  return Array.from(map.values());
}, [agentData]);

function countUserMessages(chat_history) {
  if (!chat_history) return 0;

  let arr = chat_history;
  if (typeof chat_history === "string") {
    try {
      arr = JSON.parse(chat_history);
    } catch {
      return 0;
    }
  }

  if (!Array.isArray(arr)) return 0;

  return arr.filter(
    (m) =>
      m &&
      m.role === "user" &&
      typeof m.text === "string" &&
      m.text.trim().length > 0
  ).length;
}
 

const cleanedAgents = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => ({
      ...a,
      name: (a.name ?? "").trim(),
      description: (a.description ?? "").trim(),
    }))
    .filter((a) => a.name.length > 0); // remove blank names
};

function timeAgo(isoString) {
 if (!isoString) return "Never";

  const t = new Date(isoString);
  if (Number.isNaN(t.getTime())) return "Never";

  const now = new Date();
  let diffMs = now - t;

  // future timestamps (clock skew) -> treat as "Just now"
  if (diffMs < 0) diffMs = 0;

  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} Min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} Day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

React.useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/usage-dashboard/agent-data");
      const json = await response.json();

      const agents = cleanedAgents(json.data); // keep ALL rows
      setAgentData(agents);

      // set a default selected row
      if (agents.length > 0) setActiveAgentId(agents[0].id);

      setloadingAgentData(false);
    } catch (error) {
      console.error("Error fetching agent data:", error);
      setloadingAgentData(false);
    }
  };

  fetchData();
}, []);

const totalConversations = React.useMemo(() => {
  if (!activeAgentId || !agentData) return 0;

  const agent = agentData.find((a) => a.id === activeAgentId);
  if (!agent) return 0;

  return countUserMessages(agent.chat_history);
}, [activeAgentId, agentData]);


  return (
    <div className="ud-page">
      <div className="ud-shell">
        {/* Left Sidebar */}
        <aside className="ud-sidebar">
          <div className="ud-sidebarHeader">
            <div className="ud-sidebarTitle">Agents</div>
          </div>

          <div className="ud-searchWrap">
            <input
              className="ud-searchInput"
              placeholder="Search agents..."
              onChange={() => {}}
            />
            <span className="ud-searchIcon">🔍</span>
          </div>

          {/* Load agent list */}
          <div className="ud-agentList">
            {loadingAgentData && (
                <div className="ud-agentLoading">Loading agents...</div>
            )}
            
            {!loadingAgentData && groupedAgents.length === 0 && (
                <div className="ud-agentEmpty">No agents found.</div>
            )}

           {!loadingAgentData &&
    groupedAgents.map((group) => {

    const isExpanded = expandedAgentId === group.nameKey;
    console.log("ITS A GROUP member: " + JSON.stringify(group));

    return (
      <div key={group.nameKey} className="ud-agentBlock">
        <button
          type="button"
          className="ud-agentItem"
          onClick={() => {
            // optional: pick first row under this group as active
            if (group.items.length > 0) setActiveAgentId(group.items[0].id);
          }}
        >
          <span
            className="ud-agentChevron"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedAgentId(isExpanded ? null : group.nameKey);
            }}
          >
            {isExpanded ? "▼" : "▶"}
          </span>

          <span className="ud-agentName">
            {group.displayName || "(Untitled Agent)"}
          </span>
        </button>

        {/* Expanded content = list of rows (each row has its own description & data) */}
        {isExpanded && (
            <div className="ud-agentExpand">
                {group.items.map((row, idx) => (
                <React.Fragment key={row.id}>
                    <button
                    type="button"
                    className={
                        "ud-agentDescBtn" +
                        (row.id === activeAgentId ? " ud-agentDescBtn--active" : "")
                    }
                    onClick={() => setActiveAgentId(row.id)}
                    >
                    {row.description && row.description.trim()
                        ? row.description
                        : "No purpose / description provided."}
                    </button>

                    {/* horizontal line between descriptions (not after last) */}
                    {idx !== group.items.length - 1 && <div className="ud-agentDescDivider" />}
                </React.Fragment>
                ))}
            </div>
        )}
            </div>
            );
        })}

            </div>
        </aside>
        
        {/* Right Main */}
        <main className="ud-main">
            {loadingAgentData ? (
              <div>Loading agent data...</div>
            ) : !agentData || agentData.length === 0 ? (
              <div>No agent selected.</div>
            ) : ( () => {
                const agent = (Array.isArray(agentData) ? agentData : []).find(
                (a) => a.id === activeAgentId
                ) || (Array.isArray(agentData) ? agentData[0] : null);
                if (!agent) {
                    return <div>No agent selected.</div>;
                }

                return (
                <>
                {/* Header */}
                <div className="ud-topHeader">
                    <div className="ud-topHeaderTitle">
                      {agent.name} | {agent.description}
                    </div>
                </div>
                
                {/* Agent title + meta (backend will inject text) */}
                <div className="ud-section">
                    <div className="ud-metaRow">
                    <span className="ud-metaLabel">Status: </span>
                    <span className="ud-metaValue">{agent.status || "Unknown"}</span>

                    <span className="ud-metaSep">|</span>

                    <span className="ud-metaLabel">Model: </span>
                    <span className="ud-metaValue">{agent.model_label || "Unknown"}</span>

                    <span className="ud-metaSep">|</span>

                    <span className="ud-metaLabel">Last Used:</span>{" "}
                    <span className="ud-metaValue">{agent.last_used ? new Date(agent.last_used).toLocaleString() : "Never"}</span>
                    </div>
                </div>

                {/* KPI row (backend will inject numbers) */}
                <div className="ud-kpiRow">
                    <div className="ud-kpiCard">
                    <div className="ud-kpiLabel">Total Conversations</div>
                    <div className="ud-kpiValue">{totalConversations}</div>
                    </div>

                    <div className="ud-kpiCard">
                    <div className="ud-kpiLabel">Unsummarized Messages</div>
                    <div className="ud-kpiValue">{agent.unsummarized_user_count || 0}</div>
                    </div>

                    <div className="ud-kpiCard">
                    <div className="ud-kpiLabel">Last Active</div>
                    <div className="ud-kpiValue-activeAgo">
                        {timeAgo(agent.last_used)}
                    </div>
                    </div>
                </div>

                <div className="ud-divider" />

                {/* Key usage patterns (backend will inject list items) */}
                <div className="ud-section">
                  <div className="ud-h2">Key Usage Patterns</div>
                  <div className="ud-subtitle">What Users Ask This Agent</div>

                  {/* Primary usage label */}
                  <div className="ud-patternBox">
                    <ul className="ud-bullets">
                      <li>{agent.usage_label || "Unclear usage"}</li>
                    </ul>
                  </div>

                  
                </div>
            </>
                ); })()}
        </main>
      </div>

      <button className="ud-backBtn" type="button" onClick={() => navigate(-1)}>
        ← Back
      </button>
    </div>
  );
}
