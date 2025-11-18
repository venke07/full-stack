import React, { useEffect, useState } from 'react';
import aiAvatar from "./imported_img/ai.png";
import userAvatar from "./imported_img/user.png";

import './history.css';


export default function HistoryPage() {
  
  const [activeAgent, setActiveAgent] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  
  const [loading, setLoading] = useState(true); // for agents
  const [agents, setAgents] = useState([]);
  
  const [convLoading, setConvLoading] = useState(false); // for conversations
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  
  const [msgLoading, setMsgLoading] = useState(false); // for messages
  const [messages, setMessages] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState(""); // for search input
  const [isSearching, setIsSearching] = useState(false);

  const [deleteMode, setDeleteMode] = useState("single"); 

  const deleteDialogRef = React.useRef();
  
  const handleSearch = async (value) => {
    setSearchQuery(value);

    if (value.trim() === "") {
      setIsSearching(false);     // stop search mode
      setMessages([]);           // clear results
      return;
    }

    // If search is NOT empty:
    setIsSearching(true);
    setMsgLoading(true);

    try {
      const res = await fetch(
        `http://localhost:3000/api/search/messages?query=${value}`
      );
      const data = await res.json();
      setMessages(data.messages || []);
      
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setMsgLoading(false);
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

const handleDeleteConversation = async (conversationId) => {

  const confirmed = await openDeleteDialog("single");
  if (!confirmed) return;


  try {
    const res = await fetch(
      `http://localhost:3000/api/conversations/${conversationId}`,
      { method: "DELETE" }
    );

    const data = await res.json();

    if (!data.success) {
      alert("Error deleting conversation: " + data.message);
      return;
    }

    setConversations((prev) =>
      prev.filter((c) => c.id !== conversationId)
    );

    if (activeConversation === conversationId) {
      setActiveConversation(null);
      setMessages([]);
    }

  } catch (err) {
    console.error("Delete failed:", err);
    alert("Failed to delete conversation.");
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

  //  Handle agent click, then retrieve the conversations associated with the agent
  const handleAgentClick = async (agentId) => {
    // toggle off if same agent clicked
    if (activeAgent === agentId) {
      setActiveAgent(null); // deselect agent
      setConversations([]); // clear conversations
      setMessages([]); // clear messages
      return;
    }

    setActiveAgent(agentId);
    setShowSearch(false); //  hide search panel when switching agents
    setConvLoading(true); // start loading conversations

    setMessages([]); // clear messages when switching agents

    try {
      const response = await fetch(`http://localhost:3000/api/conversations/agent/${agentId}`);
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
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

  return (
    <div className="history-page">
      {/* Sidebar with agents */}
      <div className="sidebar">
        <div className="chat-title">
          <h2>Chat History</h2>
          <h3>Agents</h3>
        </div>

        {loading ? (
          <div className="loading-agent">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="no-agent">No agents found.</div>
        ) : (
          agents.map((agent) => (
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
              </div>
              <div className='delete-all'onClick={handleDeleteAllConversations} >Delete all</div>
            </div>

            <div className="conversation-list">
              {convLoading ? (
                <div className="loading-agent">Loading conversations...</div>
              ) : conversations.length === 0 ? (
                <div className="no-agent">No conversations found.</div>
              ) : (
                conversations.map((c) => (
                  <div key={c.id} 
                  className={`conversation-item ${activeConversation === c.id ? 'active' : ''}`}
                   onClick={() => handleConversationClicked(c.id)}
                   convLoading={convLoading.toString()}
                   >
                    <div className="conversation-date">
                      {new Date(c.date_created).toLocaleDateString()} -
                    </div>

                   <div className="conversation-title-delete">
                      <div className="conversation-title">{c.title}</div>
                      <div className="delete-conversation" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(c.id);}}>
                          Delete</div>
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
          {isSearching && !msgLoading && (
          <>
            <div className="search-results">Showing results for "{searchQuery}"</div>
            <div className="search-result-count">{messages.length} results</div>
          </>
        )}

          {msgLoading ? (
            <div className="loading-agent">Loading messages...</div>
          )  : (
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
                      {agent ? agent.name : "Unknown agent" } ⋅ {msg.conversations.title}
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
          )}
          </div>
        </div>
    </div>
  );
}
