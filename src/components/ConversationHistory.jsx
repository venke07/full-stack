import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function ConversationHistory({ agentId, onLoadConversation, isOpen, onClose }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [viewingDetails, setViewingDetails] = useState(false);

  useEffect(() => {
    if (isOpen && agentId && user) {
      loadConversations();
    }
  }, [isOpen, agentId, user]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/conversations?userId=${user.id}&agentId=${agentId}&limit=20`
      );
      const data = await res.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadConversation = async (conversation) => {
    try {
      const res = await fetch(`${API_URL}/api/conversations/${conversation.id}`);
      const data = await res.json();
      if (data.conversation) {
        onLoadConversation(data.conversation);
        onClose();
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const handleDeleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await fetch(`${API_URL}/api/conversations/${conversationId}`, { method: 'DELETE' });
      setConversations(conversations.filter(c => c.id !== conversationId));
      setSelectedConversation(null);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="conversation-history-modal">
      <div className="conversation-history-overlay" onClick={onClose}></div>
      <div className="conversation-history-panel">
        <div className="history-header">
          <h2>💬 Conversation Memory</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="history-search">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="history-list">
          {loading ? (
            <div className="history-loading">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="history-empty">
              {conversations.length === 0 
                ? '📭 No conversations yet. Start chatting to build memory!' 
                : '🔍 No matching conversations found'}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={`history-item ${selectedConversation?.id === conv.id ? 'selected' : ''}`}
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="item-content">
                  <div className="item-summary">{conv.summary}</div>
                  <div className="item-meta">
                    <span className="item-date">
                      {new Date(conv.created_at).toLocaleDateString()} 
                      {new Date(conv.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="item-count">{conv.message_count} messages</span>
                  </div>
                  {conv.tags && conv.tags.length > 0 && (
                    <div className="item-tags">
                      {conv.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="item-actions">
                  <button
                    className="load-btn"
                    onClick={() => handleLoadConversation(conv)}
                    title="Load this conversation"
                  >
                    📂 Load
                  </button>
                  <button
                    className="delete-btn"
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    title="Delete conversation"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedConversation && (
          <div className="history-preview">
            <h3>Preview</h3>
            <div className="preview-content">
              <p><strong>Summary:</strong> {selectedConversation.summary}</p>
              <p><strong>Messages:</strong> {selectedConversation.message_count}</p>
              <p><strong>Date:</strong> {new Date(selectedConversation.created_at).toLocaleString()}</p>
              {selectedConversation.tags?.length > 0 && (
                <p><strong>Tags:</strong> {selectedConversation.tags.join(', ')}</p>
              )}
            </div>
            <button
              className="load-full-btn"
              onClick={() => handleLoadConversation(selectedConversation)}
            >
              📂 Load Full Conversation
            </button>
          </div>
        )}
      </div>

      <style>{`
        .conversation-history-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: flex-end;
          z-index: 1000;
        }

        .conversation-history-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          cursor: pointer;
        }

        .conversation-history-panel {
          position: relative;
          width: 100%;
          max-width: 400px;
          height: 80vh;
          background: var(--bg);
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
          border: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
        }

        .history-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text);
          cursor: pointer;
          font-size: 20px;
          padding: 4px;
        }

        .history-search {
          padding: 12px;
          border-bottom: 1px solid var(--border);
        }

        .search-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg-tertiary);
          color: var(--text);
          font-size: 14px;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .history-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .history-loading,
        .history-empty {
          padding: 24px;
          text-align: center;
          color: var(--muted);
          font-size: 14px;
        }

        .history-item {
          padding: 12px;
          margin-bottom: 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          transition: all 0.2s;
        }

        .history-item:hover {
          border-color: var(--accent);
          background: rgba(106, 168, 255, 0.05);
        }

        .history-item.selected {
          border-color: var(--accent);
          background: rgba(106, 168, 255, 0.1);
        }

        .item-content {
          flex: 1;
          min-width: 0;
        }

        .item-summary {
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--text);
        }

        .item-meta {
          display: flex;
          gap: 8px;
          font-size: 12px;
          color: var(--muted);
        }

        .item-date {
          white-space: nowrap;
        }

        .item-count {
          white-space: nowrap;
        }

        .item-tags {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .tag {
          font-size: 10px;
          background: rgba(132, 255, 225, 0.2);
          color: var(--accent-2);
          padding: 2px 6px;
          border-radius: 3px;
        }

        .item-actions {
          display: flex;
          gap: 6px;
        }

        .load-btn,
        .delete-btn {
          padding: 4px 8px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--text);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .load-btn:hover {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .delete-btn:hover {
          background: #dc3545;
          border-color: #dc3545;
        }

        .history-preview {
          padding: 12px;
          border-top: 1px solid var(--border);
          background: var(--bg-secondary);
          max-height: 200px;
          overflow-y: auto;
        }

        .history-preview h3 {
          margin: 0 0 8px 0;
          font-size: 14px;
        }

        .preview-content {
          font-size: 12px;
          margin-bottom: 12px;
        }

        .preview-content p {
          margin: 6px 0;
        }

        .preview-content strong {
          color: var(--accent);
        }

        .load-full-btn {
          width: 100%;
          padding: 8px;
          background: linear-gradient(135deg, var(--accent), #5a9ef5);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
        }

        .load-full-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(106, 168, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
