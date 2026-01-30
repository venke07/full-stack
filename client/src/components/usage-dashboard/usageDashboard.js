// usageDashboard.js
import React from "react";
import { useNavigate } from "react-router-dom";
import "./usageDashboard.css";

const API_BASE = "http://localhost:3000";


async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token");

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    console.error("401 Unauthorized. Token missing/expired.");
  }

  return res;
}


export default function UsageDashboard() {
  const navigate = useNavigate();

  const [loadingAgentData, setloadingAgentData] = React.useState(true);
  const [agentData, setAgentData] = React.useState(null);
  const [activeAgentId, setActiveAgentId] = React.useState(null);
  const [expandedAgentId, setExpandedAgentId] = React.useState(null);   

  const [notes, setNotes] = React.useState("");
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  
 const [isComputing, setIsComputing] = React.useState(false);

  function parseIntentBreakdown(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  async function computeAnalyticsForActiveAgent() {
    if (!activeAgentId) return;

    try {
      setIsComputing(true);

      const res = await apiFetch(
        `/api/usage-dashboard/agents/${activeAgentId}/analytics/compute`,
        { method: "POST" }
      );

      const json = await res.json();
      if (!res.ok) {
        console.error("Compute analytics failed:", res.status, json);
        return;
      }

      const { usageLabel, intents } = json?.result || {};

      setAgentData((prev) =>
        (Array.isArray(prev) ? prev : []).map((a) =>
          a.id === activeAgentId
            ? {
                ...a,
                usage_label: usageLabel ?? a.usage_label,
                intent_breakdown: intents ?? a.intent_breakdown,
              }
            : a
        )
      );
    } catch (err) {
      console.error("computeAnalyticsForActiveAgent error:", err);
    } finally {
      setIsComputing(false);
    }
  }

    const groupedAgents = React.useMemo(() => {
    const raw = Array.isArray(agentData) ? agentData : [];

    const map = new Map();
    for (const a of raw) {
      const key = (a.name || "").toLowerCase();

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
    
  const filteredGroups = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groupedAgents;

    return groupedAgents
      .map((g) => {
        const matchedItems = g.items.filter((a) => {
          const hay = `${a.name || ""} ${a.description || ""} ${a.usage_label || ""}`.toLowerCase();
          return hay.includes(q);
        });

        return matchedItems.length ? { ...g, items: matchedItems } : null;
      })
      .filter(Boolean);
  }, [groupedAgents, searchQuery]);

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

      const response = await apiFetch("/api/usage-dashboard/agent-data");
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

// Load Notes
React.useEffect(() => {
  if (!activeAgentId) return;

  (async () => {
    const res = await apiFetch(`/api/usage-dashboard/agents/${activeAgentId}/notes`);
    const json = await res.json();
    const n = json?.data?.agent_notes || "";
    setNotes(n);
    setNotesDraft(n);
    setIsEditingNotes(false);
  })();
}, [activeAgentId]);


// Save notes
async function saveNotes() {
  try {
    console.log("Saving notes for:", activeAgentId, notesDraft);

    const res = await apiFetch(`/api/usage-dashboard/agents/${activeAgentId}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_notes: notesDraft }),
    });

    const text = await res.text(); // read response even if error
    console.log("Save response:", res.status, text);

    if (!res.ok) {
      console.error("Failed to save notes:", res.status, text);
      return;
    }

    setNotes(notesDraft);
    setIsEditingNotes(false);
  } catch (err) {
    console.error("Save notes error:", err);
  }
}


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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Load agent list */}
          <div className="ud-agentList">
            {loadingAgentData && (
                <div className="ud-agentLoading">Loading agents...</div>
            )}
            
            {!loadingAgentData && filteredGroups.length === 0 && (
              <div className="ud-agentEmpty">No agents found.</div>
            )}

         {!loadingAgentData &&
            filteredGroups.map((group) => {

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

                const intents = parseIntentBreakdown(agent.intent_breakdown);

                return (
                <>
                <div className="ud-topHeader">
                    <div className="ud-topHeaderTitle">
                      {agent.name} | {agent.description} | Dashboard
                    </div>
                </div>
                
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

                <div className="ud-section">
                  <div className="ud-h2">Key Usage Patterns</div>
                    <div className="ud-bigPanel">
                      {/* LEFT side */}
                      <div className="ud-bigLeft">
                        {/* header row */}
                        <div className="ud-panelTitleRow">
                          <div className="ud-panelTitle">Intent Breakdown</div>

                          <button
                            type="button"
                            className="ud-notesBtn"
                            onClick={computeAnalyticsForActiveAgent}
                            disabled={isComputing}
                            style={{ marginLeft: "auto" }}
                          >
                            {isComputing ? "Computing..." : "Refresh"}
                          </button>
                        </div>

                        {intents.length === 0 ? (
                          <div className="ud-notesBox" style={{ marginTop: 10 }}>
                            No intent breakdown yet. Click Refresh to generate.
                          </div>
                        ) : (
                          <div style={{ marginTop: 12 }}>
                            {intents.map((it, idx) => {
                              const label = it?.label ?? "Unknown";
                              const percent = Number(it?.percent ?? 0);

                              return (
                                <div key={`${label}-${idx}`} style={{ marginBottom: 12 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={{ fontWeight: 700 }}>{label}</span>
                                    <span>{percent}%</span>
                                  </div>

                                  <div
                                    style={{
                                      height: 10,
                                      borderRadius: 999,
                                      background: "rgba(255,255,255,0.12)",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${Math.max(0, Math.min(100, percent))}%`,
                                        height: "100%",
                                        background: "rgba(134, 221, 250, 0.9)",
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                     
                      </div>

                      {/* RIGHT side */}
                      <div className="ud-bigRight">
                        <div className="ud-miniCard">
                          <div className="ud-miniTitle">Agent Notes</div>

                          {!isEditingNotes ? (
                            <>
                              <div className="ud-notesBox">
                                {notes?.trim() ? notes : "No notes yet. Click Edit to add a purpose / usage note."}
                              </div>

                              <button type="button" className="ud-notesBtn" onClick={() => setIsEditingNotes(true)}>
                                ✏️ Edit
                              </button>
                            </>
                          ) : (
                            <>
                              <textarea
                                className="ud-notesTextarea"
                                value={notesDraft}
                                onChange={(e) => setNotesDraft(e.target.value)}
                                placeholder="Write what this agent is meant to do..."
                              />

                              <div className="ud-notesActions">
                                <button type="button" className="ud-notesBtn" onClick={saveNotes}>Save</button>
                                <button
                                  type="button"
                                  className="ud-notesBtn ud-notesBtnSecondary"
                                  onClick={() => {
                                    setNotesDraft(notes);
                                    setIsEditingNotes(false);
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="ud-miniCard">
                            <div className="ud-miniCard-title">What users ask this agent</div>
                            <div className="ud-miniCard-usagelabel"> {agent.usage_label || "Unclear usage"}</div>
                        </div>
                      </div>
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
