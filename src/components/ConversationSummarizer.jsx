import { useState, useEffect } from 'react';
import '../styles.css';
import './ConversationSummarizer.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const MIN_SUMMARY_MESSAGES = 6;

export default function ConversationSummarizer({ conversationId, messages, agentId, isOpen, onClose }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && messages && messages.length > 0) {
      if (messages.length < MIN_SUMMARY_MESSAGES) {
        setSummary(null);
        setError(`Add a few more messages to summarize (need ${MIN_SUMMARY_MESSAGES}).`);
        return;
      }
      generateSummary();
    }
  }, [isOpen, messages]);

  const generateSummary = async () => {
    if (!messages || messages.length < MIN_SUMMARY_MESSAGES) {
      setError(`Add a few more messages to summarize (need ${MIN_SUMMARY_MESSAGES}).`);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/conversations/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          messages: messages.map(m => ({
            role: m.role,
            content: m.text || m.content,
          })),
          agentId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSummary(data.summary);
      } else {
        setError(data.error || 'Failed to generate summary');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="summarizer-overlay" onClick={onClose}>
      <div className="summarizer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="summarizer-header">
          <h2>📝 Conversation Summary</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="summarizer-content">
          {loading ? (
            <div className="summarizer-loading">
              <div className="loading-spinner"></div>
              <p>Analyzing conversation...</p>
            </div>
          ) : error ? (
            <div className="summarizer-error">
              <p>⚠️ {error}</p>
              <button className="btn ghost compact" onClick={generateSummary}>
                Try Again
              </button>
            </div>
          ) : summary ? (
            <div className="summary-results">
              <div className="summary-section">
                <h3>📌 Key Points</h3>
                <ul className="key-points-list">
                  {summary.keyPoints?.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  )) || <li>No key points identified</li>}
                </ul>
              </div>

              <div className="summary-section">
                <h3>💬 Summary</h3>
                <p className="summary-text">{summary.summary || 'No summary available'}</p>
              </div>

              <div className="summary-section">
                <h3>🎯 Main Topics</h3>
                <div className="topics-list">
                  {summary.topics?.map((topic, idx) => (
                    <span key={idx} className="topic-tag">{topic}</span>
                  )) || <span className="topic-tag">General</span>}
                </div>
              </div>

              <div className="summary-section">
                <h3>✅ Action Items</h3>
                <ul className="action-items-list">
                  {summary.actionItems?.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  )) || <li>No action items identified</li>}
                </ul>
              </div>

              <div className="summary-section">
                <h3>😊 Sentiment</h3>
                <div className="sentiment-indicator">
                  <span className={`sentiment-badge ${summary.sentiment?.toLowerCase() || 'neutral'}`}>
                    {summary.sentiment === 'Positive' && '😊 Positive'}
                    {summary.sentiment === 'Negative' && '😟 Negative'}
                    {summary.sentiment === 'Neutral' && '😐 Neutral'}
                    {!summary.sentiment && '😐 Neutral'}
                  </span>
                </div>
              </div>

              <div className="summary-stats">
                <div className="stat-item">
                  <span className="stat-label">Messages</span>
                  <span className="stat-value">{messages.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">User Messages</span>
                  <span className="stat-value">{messages.filter(m => m.role === 'user').length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Agent Responses</span>
                  <span className="stat-value">{messages.filter(m => m.role === 'agent').length}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="summarizer-footer">
          <button className="btn ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn primary" onClick={generateSummary} disabled={loading}>
            Regenerate Summary
          </button>
        </div>
      </div>
    </div>
  );
}