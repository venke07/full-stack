import React, { useEffect, useState } from 'react';
import aiAvatar from "./imported_img/ai.png";
import userAvatar from "./imported_img/user.png";
import { useNavigate } from "react-router-dom";

import './history.css';

export default function HistoryPage() {

  const navigate = useNavigate();
  
  const [activeAgent, setActiveAgent] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  
  const [loading, setLoading] = useState(true); // for agents
  const [agents, setAgents] = useState([]);

  const [venkeLoading, setVenkeLoading] = useState(true);
  const [venkeData, setVenkeData] = useState([]);
  
  const [convLoading, setConvLoading] = useState(false); // for conversations
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);

  const [activeDescriptionId, setActiveDescriptionId] = useState(null);

  const [msgLoading, setMsgLoading] = useState(false); // for messages
  const [messages, setMessages] = useState([]);
  
  const [chatPreviewLoading, setChatPreviewLoading] = useState(false);
  const [chatPreviewMessages, setChatPreviewMessages] = useState([]);

  const [searchQuery, setSearchQuery] = useState(""); // for search input
  const [isSearching, setIsSearching] = useState(false);

  const [deleteMode, setDeleteMode] = useState("single"); 

  const [personaSearchResults, setPersonaSearchResults] = useState([]);
  const [personaSearchLoading, setPersonaSearchLoading] = useState(false);


  const deleteDialogRef = React.useRef();
  
  const handleSearch = async (value) => {
  setSearchQuery(value);

  // empty input -> reset search state
  if (value.trim() === "") {
    setIsSearching(false);
    setPersonaSearchResults([]);
    return;
  }

  // must have an active agent selected
  if (!selectedVenkeAgent?.name) {
    setIsSearching(true);
    setPersonaSearchResults([]);
    return;
  }

  setIsSearching(true);
  setPersonaSearchLoading(true);

  try {
    const res = await fetch(
      `http://localhost:3000/api/venke/search-chat?name=${encodeURIComponent(
        selectedVenkeAgent.name
      )}&query=${encodeURIComponent(value)}`
    );

    const json = await res.json();

    if (!json.success) {
      setPersonaSearchResults([]);
      return;
    }

    setPersonaSearchResults(json.data || []);
  } catch (err) {
    console.error("Persona search error:", err);
    setPersonaSearchResults([]);
  } finally {
    setPersonaSearchLoading(false);
  }
};


  const highlightText = (text, keyword) => {
    if (!keyword) return text;

    const regex = new RegExp(`(${keyword})`, "gi");
    
    return text.replace(regex, `<span class="highlight">$1</span>`);
  };

  const presentPast_difference = (last_accessed) => {
    if (!last_accessed) return;
    
  const now = new Date();
  const past = new Date(last_accessed);
  const dateDiff = now - past;

  const diffSeconds = Math.floor(dateDiff / 1000);
  const diffMinutes = Math.floor(dateDiff / (1000 * 60));
  const diffHours = Math.floor(dateDiff / (1000 * 60 * 60));
  const diffDays = Math.floor(dateDiff / (1000 * 60 * 60 * 24));
  


  // Return the largest time unit difference
  if (diffDays >= 1) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } 
  else if (diffHours >= 1) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } 
  else if (diffMinutes >= 1) {
    return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
  } 
  else {
    return `${diffSeconds} second${diffSeconds > 1 ? "s" : ""} ago`;
  }
};

const handleDeleteDescription = async (agentId) => {
  const confirmed = await openDeleteDialog("single");
  if (!confirmed) return;

  try {
    const res = await fetch(`http://localhost:3000/api/venke/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "" }) // clear description
    });

    const data = await res.json();

    if (!data.success) {
      alert("Error deleting description: " + (data.message || "Unknown error"));
      return;
    }

    // update local cache
   setVenkeData(prev =>
      prev.map(agent => ({
        ...agent,
        descriptions: agent.descriptions.filter(d => String(d.id) !== String(agentId))
      }))
    );


  } catch (err) {
    console.error("Delete failed:", err);
    alert("Failed to delete description.");
  }
};

function openDeleteDialog(mode = "single") {
  return new Promise((resolve) => {
    setDeleteMode(mode);

    const dialog = deleteDialogRef.current;
    dialog.showModal();

    const handleClose = () => {
      resolve(dialog.returnValue === "yes");
      dialog.removeEventListener("close", handleClose);
    };

    dialog.addEventListener("close", handleClose);
  });
}

const handleDeleteAllConversations = async () => {

  const confirmed = await openDeleteDialog("all");
  if (!confirmed) return;

  try {
    const res = await fetch("http://localhost:3000/api/conversations", {
      method: "DELETE",
    });

    const data = await res.json();

    if (!data.success) {
      alert("Could not delete all conversations");
      return;
    }

    setConversations([]);
    setMessages([]);
    setActiveConversation(null);

  } catch (err) {
    console.error(err);
    alert("Error deleting all conversations.");
  }
};



const safeParseChatHistory = (value) => {
  if (!value) return [];
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (e) {
    console.error("chat_history parse error:", e);
    return [];
  }
};

const fetchChatHistoryById = async (id) => {
    setChatPreviewLoading(true);
    setChatPreviewMessages([]);

    try {
      const res = await fetch(`http://localhost:3000/api/venke/chat-history/${id}`);
      const json = await res.json();

      if (!json.success) return;

      const history = safeParseChatHistory(json.data?.chat_history);
      setChatPreviewMessages(history);
    } catch (err) {
      console.error("Fetch chat history failed:", err);
    } finally {
      setChatPreviewLoading(false);
    }
  };

 // Fetch normal agents
  useEffect(() => {
    async function getAgents() {
      try {
        const response = await fetch('http://localhost:3000/api/agents');
        const data = await response.json();
        setAgents(data.agents || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching agents:', error);
        setLoading(false);
      }
    }
    getAgents();
  }, []);


 // Fetch Venke agents
  useEffect(() => {
    async function getVenkeAgentsData() {
      setVenkeLoading(true);
      try {
        const response = await fetch('http://localhost:3000/api/venke/venke-descriptions');
        const data = await response.json();
        setVenkeData(data.data || []);
        setVenkeLoading(false);
      } catch (error) {
        console.error('Error fetching venke agents:', error);
        setVenkeLoading(false);
      }
    }
    getVenkeAgentsData();
  }, []);


  //  Handle agent click, then retrieve the conversations associated with the agent
  const handleAgentClick = async (agentId) => {
  // toggle off if same agent clicked
  if (activeAgent === agentId) {
    setSearchQuery("");
    setIsSearching(false);
    setPersonaSearchResults([]);

    setActiveAgent(null);          // deselect agent
    setConversations([]);          // clear conversations
    setMessages([]);      
    
    setSearchQuery("");
    setIsSearching(false);
    setPersonaSearchResults([]);// clear messages

    setActiveDescriptionId(null);
    setChatPreviewMessages([]);

    return;
  }

  setActiveAgent(agentId);
  setShowSearch(false);            // hide search panel when switching agents
  setConvLoading(true);            // start loading conversations

  setMessages([]);                 // clear messages when switching agents

  // ✅ clear old preview when switching agents
  setActiveDescriptionId(null);
  setChatPreviewMessages([]);

  try {
    const response = await fetch(`http://localhost:3000/api/conversations/agent/${agentId}`);
    const data = await response.json();
    setConversations(data.conversations || []);
  } catch (error) {
    console.error("Error fetching conversations:", error);
  } finally {
    setConvLoading(false);
  }
};

  const handleConversationClicked = async (conversationId) => {
    setActiveConversation(conversationId);
    setMsgLoading(true); // start loading messages
    try {
      const response = await fetch(`http://localhost:3000/api/message/${conversationId}/messages`);
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setMsgLoading(false);
    } 
  }

  const selectedVenkeAgent = venkeData.find(a => a.id === activeAgent);

  return (
    <div className="history-page">
      {/* Sidebar with agents */}
      <div className="sidebar">
        <div className="chat-title">
          <h2>Chat History</h2>
          <h3>Agents</h3>
        </div>

        {venkeLoading ? (
          <div className="loading-agent">Loading agents...</div>
        ) : venkeData.length === 0 ? (
          <div className="no-agent">No agents found.</div>
        ) : (
          venkeData.map((agent) => (
            <div
              key={agent.id}
              className={`agent-item ${activeAgent === agent.id ? 'active' : ''}`}
              onClick={() => handleAgentClick(agent.id)}
            >
              <div className="agent-avatar" />
              <div
                className="agent-name"
                dangerouslySetInnerHTML={{ __html: agent.name.replace(' ', '<br>') }}
              />
            </div>
          ))
        )}
      </div>

      {/* Main panel */}
      <div className="main-content">
        {!activeAgent && ( // checks if agent is selected, if not show prompt
          <div className="empty-agent-prompt">Choose an agent to view chat history</div>
        )}

        {activeAgent && (
          <div className={`conversation-panel ${showSearch ? 'shrunk' : ''}`}>
            <div className="conversation-search">
              <div className="conversations-header">
                <h2>Conversations</h2>
              </div>
              <div className="search-box">
                <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>

                {/* Search input */}
                <input type="text"
                  className="search-input" 
                  placeholder="Search" 
                  value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                 />

                 <button
                    type="button"
                    className="addSummary"
                    onClick={() => navigate("/chat-summary")}
                  >
                    <span className="addSummaryIcon" aria-hidden="true">📄</span>
                    <span className="addSummaryText">Chat Summary</span>
                  </button>

              </div>
              <div className='delete-all-container'>
                <div className='delete-all'onClick={handleDeleteAllConversations} >Delete all</div>
              </div>
            </div>


         <div className="conversation-list">
            {venkeLoading ? (
              <div className="loading-agent">Loading conversations...</div>
            ) : !selectedVenkeAgent ? (
              <div className="no-agent">No conversations</div>
            ) : !selectedVenkeAgent.descriptions || selectedVenkeAgent.descriptions.length === 0 ? (
              <div className="no-agent">No conversations</div>
            ) : (
              selectedVenkeAgent.descriptions.map((item) => (
                <div
                  key={item.id}
                   className={`conversation-item ${activeDescriptionId === item.id ? 'active' : ''}`}
                    onClick={() => {

                      if (activeDescriptionId === item.id) {
                        setActiveDescriptionId(item.id);
                        fetchChatHistoryById(item.id);
                        return;
                      }

                      setActiveDescriptionId(item.id);
                      fetchChatHistoryById(item.id);
                    }}
                >
                  <div className="conversation-date">
                    {selectedVenkeAgent.name}
                  </div>

                  <div className="conversation-title-delete">
                    <div className="conversation-title">
                      {item.text}
                    </div>

                    <div>
                      <button
                        className="delete-conversation"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDescription(item.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          </div>
        )}

        <dialog ref={deleteDialogRef} className="delete-confirmation-prompt">
          <form method="dialog" className="delete-dialog-form">
            
            <h3 className="delete-dialog-title">
              {deleteMode === "all" ? "Delete ALL conversations?" : "Delete conversation?"}
            </h3>

            <p className="delete-dialog-subtitle">
              {deleteMode === "all"
                ? "This will permanently delete every conversation for this agent. This action cannot be undone."
                : "This action cannot be undone."
              }
            </p>

            <div className="delete-dialog-buttons">
              <button className="delete-dialog-cancel" value="no">Cancel</button>
              <button className="delete-dialog-confirm" value="yes">Delete</button>
            </div>

          </form>
        </dialog>


        {showSearch && (
          <div className="search-panel">
            <div className="search-container">
              <button onClick={() => setShowSearch(false)} className="close-search-btn">
                ×
              </button>
              <h2 className="results-header">3 similar search results</h2>
            </div>
          </div>
        )}

        <div className="message-panel">
            {isSearching && (
              <>
                <div className="search-results">Showing results for "{searchQuery}"</div>
                <div className="search-result-count">{personaSearchResults.length} results</div>
              </>
            )}

            {/* 1) SEARCH MODE (highest priority) */}
            {isSearching ? (
              personaSearchLoading ? (
                <div className="loading-agent">Loading messages...</div>
              ) : personaSearchResults.length === 0 ? (
                <div>No messages found for this search.</div>
              ) : (
                personaSearchResults.map((r, idx) => {
                  const isAI = r.role === "agent";
                  const avatar = isAI ? aiAvatar : userAvatar;

                  return (
                    <div key={`${r.persona_id}-${idx}`} className="message-item">
                      <img src={avatar} alt="avatar" className="message-avatar" />

                      <div className="message-header stack-sans-headline">
                        {isAI ? (r.agent_name || "Unknown agent") : "User"} ⋅ {r.description || "No description"}
                      </div>

                      <div className="search-date-info inter">
                        Match in {r.role}
                      </div>

                      <div
                        className="message-content"
                        dangerouslySetInnerHTML={{
                          __html: `"${highlightText(r.text || "", searchQuery)}"`
                        }}
                      ></div>
                    </div>
                  );
                })
              )
            ) : activeDescriptionId ? (
              /* 2) PREVIEW MODE */
              chatPreviewLoading ? (
                <div className="loading-agent">Loading messages...</div>
              ) : chatPreviewMessages.length === 0 ? (
                <div>No messages found for this conversation.</div>
              ) : (
                chatPreviewMessages.map((m, idx) => {
                  const isAI = m.role === "agent";
                  const avatar = isAI ? aiAvatar : userAvatar;

                  return (
                    <div key={`${activeDescriptionId}-${idx}`} className="message-item">
                      <img src={avatar} alt="avatar" className="message-avatar" />

                      <div className="message-header stack-sans-headline">
                        {isAI ? (selectedVenkeAgent?.name || "Unknown agent") : "User"}
                      </div>

                      <div className="search-date-info inter">
                        Preview chat
                      </div>

                      <div
                        className="message-content"
                        dangerouslySetInnerHTML={{
                          __html: `"${highlightText(m.text || "", searchQuery)}"`
                        }}
                      ></div>
                    </div>
                  );
                })
              )
            ) : (
              /* 3) NORMAL MODE (your existing messages) */
              msgLoading ? (
                <div className="loading-agent">Loading messages...</div>
              ) : (
                messages.map((msg) => {
                  const agent = agents.find((agent) => agent.id === msg.conversations.agent_id);

                  if (!msg.conversations) {
                    return (<div>No messages found for this conversation.</div>);
                  }

                  const isAI = agent && msg.sender !== "user";
                  const avatar = isAI ? aiAvatar : userAvatar;

                  return (
                    <div key={msg.id} className="message-item">
                      <img src={avatar} alt="avatar" className="message-avatar" />
                      <div className='message-header stack-sans-headline'>
                        {agent ? agent.name : "Unknown agent"} ⋅ {msg.conversations.title}
                      </div>
                      <div className="search-date-info inter">
                        Used in {messages.length} search  ⋅ last accessed {presentPast_difference(msg.last_accessed)}
                      </div>
                      <div
                        className="message-content"
                        dangerouslySetInnerHTML={{
                          __html: `"${highlightText(msg.content, searchQuery)}"`
                        }}
                      ></div>
                    </div>
                  );
                })
              )
            )}
          </div>

        </div>
    </div>
  );
}
