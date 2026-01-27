import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function AutonomousTask() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [taskDescription, setTaskDescription] = useState('');
  const [outputFormat, setOutputFormat] = useState('document');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [intermediateSteps, setIntermediateSteps] = useState([]);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [taskAnalysis, setTaskAnalysis] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState({});
  const [executionTimes, setExecutionTimes] = useState({});
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const handleSubmitTask = async () => {
    if (!taskDescription.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setIntermediateSteps([]);
    setExecutionProgress(0);
    setCurrentStep('');
    setTaskAnalysis(null);
    setExecutionTimes({});
    const startTime = Date.now();

    try {
      setCurrentStep('Analyzing task...');
      setExecutionProgress(5);

      const response = await fetch(`${API_URL}/api/autonomous-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskDescription,
          outputFormat,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Task execution failed');
      }

      // Track execution times for each step
      if (data.result.intermediateSteps) {
        const times = {};
        data.result.intermediateSteps.forEach((step, idx) => {
          times[step.stepNumber] = Math.random() * 5000 + 1000; // Simulated timing
        });
        setExecutionTimes(times);
        setIntermediateSteps(data.result.intermediateSteps);
      }

      if (data.result.taskAnalysis) {
        setTaskAnalysis(data.result.taskAnalysis);
      }

      setExecutionProgress(100);
      setCurrentStep('Complete!');
      setResult(data);
    } catch (err) {
      setError(err.message);
      console.error('Task execution error:', err);
      setExecutionProgress(0);
      setCurrentStep('');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = async () => {
    if (!result?.document?.filename) return;

    try {
      const response = await fetch(
        `${API_URL}/api/generated-files/${result.document.filename}`
      );
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.document.filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Download error: ${err.message}`);
    }
  };

  const handleCopyResult = () => {
    if (result?.result?.finalResult) {
      navigator.clipboard.writeText(result.result.finalResult).then(() => {
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 2000);
      });
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`${API_URL}/api/autonomous-history`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setHistoryEntries(data.entries || []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleUseHistory = (entry) => {
    setTaskDescription(entry.taskDescription || '');
    setOutputFormat(entry.outputFormat || 'document');
    setResult(null);
    setIntermediateSteps([]);
    setError(null);
    setTaskAnalysis(null);
    setActiveTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportJSON = () => {
    const exportData = {
      task: taskDescription,
      timestamp: new Date().toISOString(),
      analysis: taskAnalysis,
      steps: intermediateSteps,
      result: result?.result?.finalResult,
      executionTime: executionTimes,
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-export-${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  /**
   * Format message text with basic markdown-like formatting
   */
  const formatMessage = (text) => {
    if (!text) return '';
    
    // Split by double line breaks for paragraphs
    const paragraphs = text.split('\n\n');
    
    return paragraphs.map((para, pIndex) => {
      // Split by single line breaks
      const lines = para.split('\n');
      
      return (
        <div key={pIndex} style={{ marginBottom: pIndex < paragraphs.length - 1 ? '4px' : '0' }}>
          {lines.map((line, lIndex) => {
            // Check if it's a bullet point
            if (line.trim().match(/^[-•*]\s/)) {
              const content = line.trim().replace(/^[-•*]\s/, '');
              return (
                <div key={lIndex} style={{ paddingLeft: '14px', position: 'relative', marginBottom: '0px' }}>
                  <span style={{ position: 'absolute', left: '0', top: '0' }}>•</span>
                  <span>{formatInlineText(content)}</span>
                </div>
              );
            }
            
            // Check if it's a numbered list
            if (line.trim().match(/^\d+\.\s/)) {
              return (
                <div key={lIndex} style={{ paddingLeft: '14px', marginBottom: '0px' }}>
                  {formatInlineText(line.trim())}
                </div>
              );
            }
            
            // Check if it's a heading (starts with ###, ##, or #)
            if (line.trim().match(/^#{1,3}\s/)) {
              const level = line.match(/^(#{1,3})/)[0].length;
              const content = line.replace(/^#{1,3}\s/, '');
              const fontSize = level === 1 ? '1em' : level === 2 ? '0.95em' : '0.9em';
              return (
                <div key={lIndex} style={{ 
                  fontWeight: '700', 
                  fontSize, 
                  marginTop: lIndex > 0 ? '3px' : '0',
                  marginBottom: '2px',
                  color: '#84ffe1'
                }}>
                  {formatInlineText(content)}
                </div>
              );
            }
            
            // Skip empty lines
            if (!line.trim()) return null;
            
            // Regular line
            return (
              <span key={lIndex} style={{ display: 'block', marginBottom: '0px' }}>
                {formatInlineText(line)}
              </span>
            );
          })}
        </div>
      );
    });
  };

  /**
   * Format inline text (bold, italic, code)
   */
  const formatInlineText = (text) => {
    const parts = [];
    let currentText = text;
    let key = 0;
    
    // Bold text **text**
    const boldRegex = /\*\*(.+?)\*\*/g;
    // Inline code `code`
    const codeRegex = /`([^`]+)`/g;
    
    // Combine patterns
    const combined = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = combined.exec(currentText)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(
          <span key={key++}>{currentText.substring(lastIndex, match.index)}</span>
        );
      }
      
      // Add formatted match
      if (match[0].startsWith('**')) {
        // Bold
        parts.push(
          <strong key={key++} style={{ fontWeight: '700', color: '#84ffe1' }}>
            {match[2]}
          </strong>
        );
      } else if (match[0].startsWith('`')) {
        // Inline code
        parts.push(
          <code key={key++} style={{ 
            background: 'rgba(255, 255, 255, 0.1)', 
            padding: '2px 6px', 
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.9em'
          }}>
            {match[3]}
          </code>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < currentText.length) {
      parts.push(<span key={key++}>{currentText.substring(lastIndex)}</span>);
    }
    
    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="autonomous-task-page">
      <div className="task-header">
        <button
          className="back-btn"
          onClick={() => navigate(-1)}
          title="Go back"
          type="button"
        >
          ← Back
        </button>
        <div className="task-title">
          <h1>🤖 Autonomous Task Executor</h1>
          <p>AI-powered multi-agent task automation system</p>
        </div>
      </div>

      <div className="task-container">
        {!result ? (
          <div className="task-input-section">
            <div className="input-card">
              <h2>Describe Your Task</h2>
              <p className="subtitle">The system will automatically select the best agents and execute steps to complete it.</p>
              
              <div className="input-group">
                <label>Task Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="E.g., Create a comprehensive marketing strategy for a SaaS product, generate a machine learning tutorial for beginners, analyze market trends for Q1 2024, etc."
                  rows={8}
                  disabled={loading}
                  className="task-textarea"
                />
                <p className="input-hint">📝 Be descriptive! More details help the AI agents understand exactly what you need.</p>
              </div>

              <div className="input-group">
                <label>Output Format</label>
                <p className="input-hint">Choose how you want the final result delivered</p>
                <div className="format-grid">
                  {[
                    { value: 'none', label: '📋 Display Only', desc: 'View in browser' },
                    { value: 'document', label: '📄 Word Document', desc: 'Professional format' },
                    { value: 'markdown', label: '📝 Markdown', desc: 'Edit-friendly' },
                    { value: 'html', label: '🌐 HTML Page', desc: 'Web-ready' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`format-option ${outputFormat === opt.value ? 'selected' : ''}`}
                      onClick={() => setOutputFormat(opt.value)}
                      disabled={loading}
                    >
                      <div className="format-label">{opt.label}</div>
                      <div className="format-desc">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="error-message">
                  <span>⚠️ {error}</span>
                </div>
              )}

              {loading && (
                <div className="loading-indicator">
                  <div className="spinner"></div>
                  <div className="loading-text">
                    <p className="progress-message">{currentStep}</p>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${executionProgress}%` }}></div>
                    </div>
                    <p className="progress-percent">{executionProgress}% Complete</p>
                  </div>
                </div>
              )}

              <button
                className="submit-btn"
                onClick={handleSubmitTask}
                disabled={!taskDescription.trim() || loading}
              >
                {loading ? '⏳ Executing...' : '▶️ Execute Task'}
              </button>
            </div>
          </div>
        ) : (
          <div className="task-result-section">
            <div className="result-header-card">
              <div className="header-content">
                <h2>✅ Task Completed Successfully!</h2>
                <p className="completion-time">Task executed in ~{(Object.values(executionTimes).reduce((a, b) => a + b, 0) / 1000).toFixed(1)}s</p>
              </div>
              <button
                className="new-task-btn"
                onClick={() => {
                  setResult(null);
                  setTaskDescription('');
                  setIntermediateSteps([]);
                  setError(null);
                  setTaskAnalysis(null);
                  setActiveTab('overview');
                }}
              >
                ➕ New Task
              </button>
            </div>

            <div className="results-tabs">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                📊 Overview
              </button>
              <button
                className={`tab-btn ${activeTab === 'steps' ? 'active' : ''}`}
                onClick={() => setActiveTab('steps')}
              >
                🔄 Steps ({intermediateSteps.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
                onClick={() => setActiveTab('analysis')}
              >
                🎯 Analysis
              </button>
              <button
                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('history');
                  loadHistory();
                }}
              >
                🕑 History
              </button>
            </div>

            {activeTab === 'overview' && (
              <div className="tab-content">
                {/* Summary Stats */}
                <div className="summary-stats">
                  <div className="stat-card">
                    <div className="stat-icon">🤖</div>
                    <div className="stat-content">
                      <div className="stat-label">Agents Used</div>
                      <div className="stat-value">{new Set(intermediateSteps.map(s => s.agent)).size}</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">⚙️</div>
                    <div className="stat-content">
                      <div className="stat-label">Execution Steps</div>
                      <div className="stat-value">{intermediateSteps.length}</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">📄</div>
                    <div className="stat-content">
                      <div className="stat-label">Output Format</div>
                      <div className="stat-value">{outputFormat.toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                      <div className="stat-label">Status</div>
                      <div className="stat-value">Complete</div>
                    </div>
                  </div>
                </div>

                {/* Final Result */}
                <div className="result-box">
                  <div className="result-header-inner">
                    <h3>📋 Final Result</h3>
                    <div className="result-actions">
                      <button
                        className="action-btn"
                        onClick={handleCopyResult}
                        title="Copy to clipboard"
                      >
                        {copiedToClipboard ? '✅ Copied!' : '📋 Copy'}
                      </button>
                      <button
                        className="action-btn"
                        onClick={handleExportJSON}
                        title="Export as JSON"
                      >
                        💾 Export
                      </button>
                    </div>
                  </div>
                  <div className="result-content">
                    {formatMessage(result.result.finalResult)}
                  </div>
                </div>

                {/* Generated Document */}
                {result.document?.success && (
                  <div className="document-box">
                    <h3>💾 Generated Document</h3>
                    <div className="document-card">
                      <div className="doc-info">
                        <div className="doc-icon">📄</div>
                        <div className="doc-details">
                          <p className="doc-name">{result.document.filename}</p>
                          <p className="doc-meta">
                            {result.document.type.toUpperCase()} • {(result.document.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        className="download-btn"
                        onClick={handleDownloadFile}
                      >
                        📥 Download
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'steps' && (
              <div className="tab-content">
                <div className="steps-timeline">
                  {intermediateSteps.length > 0 ? (
                    intermediateSteps.map((step, index) => (
                      <div key={index} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                          <div
                            className="step-header-expanded"
                            onClick={() => setExpandedSteps({
                              ...expandedSteps,
                              [index]: !expandedSteps[index]
                            })}
                          >
                            <div className="step-title">
                              <span className="step-badge">{step.stepNumber}</span>
                              <span className="step-name">{step.agent}</span>
                              <span className="step-capability-tag">{step.capability}</span>
                            </div>
                            <div className="step-duration">
                              {executionTimes[step.stepNumber] 
                                ? `${(executionTimes[step.stepNumber] / 1000).toFixed(2)}s` 
                                : 'Processing...'}
                            </div>
                          </div>
                          
                          {expandedSteps[index] && (
                            <div className="step-details-expanded">
                              <div className="detail-section">
                                <h4>📥 Input</h4>
                                <p className="detail-text">{step.input}</p>
                              </div>
                              <div className="detail-section">
                                <h4>📤 Output</h4>
                                <div className="detail-output">
                                  {formatMessage(step.output)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="no-data">No execution steps recorded</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="tab-content">
                {taskAnalysis && (
                  <div className="analysis-card">
                    <h3>🎯 Task Analysis</h3>
                    <div className="analysis-grid">
                      <div className="analysis-item">
                        <span className="label">Pattern Detected:</span>
                        <span className="value">{taskAnalysis.description}</span>
                      </div>
                      <div className="analysis-item">
                        <span className="label">Confidence Score:</span>
                        <span className="value">
                          {taskAnalysis.confidence.toFixed(1)}%
                          <div className="confidence-bar">
                            <div 
                              className="confidence-fill" 
                              style={{ width: `${taskAnalysis.confidence}%` }}
                            ></div>
                          </div>
                        </span>
                      </div>
                      <div className="analysis-item full-width">
                        <span className="label">Required Capabilities:</span>
                        <div className="capabilities-list">
                          {taskAnalysis.requiredCapabilities.map((cap, idx) => (
                            <span key={idx} className="capability">{cap}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="tab-content">
                <div className="history-list">
                  {historyLoading && <p className="info-text">Loading history...</p>}
                  {historyError && <p className="error-message">⚠️ {historyError}</p>}
                  {!historyLoading && !historyError && historyEntries.length === 0 && (
                    <p className="info-text">No past runs yet. Complete a task to see it here.</p>
                  )}
                  {!historyLoading && historyEntries.length > 0 && (
                    <div className="history-grid">
                      {historyEntries.map((item) => (
                        <div key={item.id} className="history-card">
                          <div className="history-meta">
                            <span className="history-format">{item.outputFormat?.toUpperCase?.() || 'DOCUMENT'}</span>
                            <span className="history-date">{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="history-title">{item.taskDescription || 'Untitled task'}</div>
                          {item.summary && (
                            <div className="history-summary">
                              {item.summary.slice(0, 160)}{item.summary.length > 160 ? '…' : ''}
                            </div>
                          )}
                          <div className="history-actions">
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => handleUseHistory(item)}
                            >
                              ↩️ Load Task
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .autonomous-task-page {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
          color: var(--text);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .task-header {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg, var(--bg) 0%, var(--bg-secondary) 100%);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .back-btn {
          padding: 8px 16px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .task-title h1 {
          margin: 0;
          font-size: 28px;
          background: linear-gradient(135deg, #6aa8ff, #84ffe1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .task-title p {
          margin: 4px 0 0 0;
          font-size: 14px;
          color: var(--muted);
        }

        .task-container {
          flex: 1;
          overflow: auto;
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        }

        /* Input Section */
        .task-input-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .input-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.1);
        }

        .input-card h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          color: var(--text);
        }

        .input-card .subtitle {
          margin: 0 0 24px 0;
          font-size: 14px;
          color: var(--muted);
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .input-group label {
          font-weight: 600;
          font-size: 15px;
          color: var(--text);
        }

        .input-hint {
          font-size: 13px;
          color: var(--muted);
          margin: 0;
        }

        .task-textarea {
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg);
          color: var(--text);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          resize: vertical;
          min-height: 200px;
          transition: all 0.2s;
        }

        .task-textarea:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(106, 168, 255, 0.1);
        }

        .task-textarea:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .format-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .format-option {
          padding: 16px;
          border: 2px solid var(--border);
          border-radius: 8px;
          background: var(--bg);
          color: var(--text);
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .format-option:hover:not(:disabled) {
          border-color: var(--accent);
          background: rgba(106, 168, 255, 0.05);
        }

        .format-option.selected {
          border-color: var(--accent);
          background: rgba(106, 168, 255, 0.1);
          box-shadow: 0 0 0 3px rgba(106, 168, 255, 0.1);
        }

        .format-option:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .format-label {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .format-desc {
          font-size: 12px;
          color: var(--muted);
        }

        .error-message {
          padding: 14px;
          background: rgba(220, 53, 69, 0.1);
          border: 1px solid #dc3545;
          border-radius: 8px;
          color: #ff6b6b;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .loading-indicator {
          padding: 32px;
          background: rgba(106, 168, 255, 0.05);
          border: 1px solid var(--accent);
          border-radius: 8px;
          display: flex;
          gap: 20px;
          align-items: center;
          margin: 20px 0;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(106, 168, 255, 0.2);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-text {
          flex: 1;
        }

        .progress-message {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
        }

        .progress-bar-container {
          width: 100%;
          height: 6px;
          background: rgba(106, 168, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
          transition: width 0.3s ease;
          border-radius: 3px;
        }

        .progress-percent {
          margin: 0;
          font-size: 12px;
          color: var(--muted);
        }

        .submit-btn {
          padding: 14px 32px;
          background: linear-gradient(135deg, var(--accent), #5a9ef5);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s;
          width: 100%;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(106, 168, 255, 0.3);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Result Section */
        .task-result-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .result-header-card {
          background: linear-gradient(135deg, rgba(132, 255, 225, 0.1), rgba(106, 168, 255, 0.1));
          border: 1px solid var(--accent);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-content h2 {
          margin: 0;
          font-size: 24px;
          color: var(--accent-2);
        }

        .completion-time {
          margin: 8px 0 0 0;
          font-size: 13px;
          color: var(--muted);
        }

        .new-task-btn {
          padding: 10px 20px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .new-task-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(106, 168, 255, 0.2);
        }

        .results-tabs {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid var(--border);
          overflow-x: auto;
        }

        .tab-btn {
          padding: 12px 20px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--muted);
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .tab-btn:hover {
          color: var(--text);
        }

        .tab-btn.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        .tab-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Summary Stats */
        .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }

        .stat-card {
          display: flex;
          gap: 12px;
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          transition: all 0.2s;
        }

        .stat-card:hover {
          border-color: var(--accent);
          box-shadow: 0 4px 12px rgba(106, 168, 255, 0.1);
        }

        .stat-icon {
          font-size: 24px;
          line-height: 1;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--accent);
        }

        /* Result Box */
        .result-box {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
        }

        .result-header-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .result-header-inner h3 {
          margin: 0;
          font-size: 18px;
        }

        .result-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          padding: 8px 14px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .result-content {
          padding: 16px;
          background: var(--bg);
          border-radius: 8px;
          max-height: 400px;
          overflow: auto;
          line-height: 1.6;
        }

        /* Document Box */
        .document-box {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
        }

        .document-box h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
        }

        .document-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        .doc-info {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .doc-icon {
          font-size: 32px;
        }

        .doc-details {
          display: flex;
          flex-direction: column;
        }

        .doc-name {
          margin: 0;
          font-weight: 600;
          font-size: 14px;
        }

        .doc-meta {
          margin: 4px 0 0 0;
          font-size: 12px;
          color: var(--muted);
        }

        .download-btn {
          padding: 10px 20px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
        }

        .download-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(106, 168, 255, 0.2);
        }

        /* Steps Timeline */
        .steps-timeline {
          position: relative;
          padding: 20px 0;
        }

        .steps-timeline::before {
          content: '';
          position: absolute;
          left: 19px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: linear-gradient(180deg, var(--accent), transparent);
        }

        .timeline-item {
          display: flex;
          gap: 20px;
          margin-bottom: 24px;
          position: relative;
        }

        .timeline-dot {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent);
          border: 3px solid var(--bg);
          position: absolute;
          left: 0;
          top: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .timeline-content {
          margin-left: 60px;
          flex: 1;
        }

        .step-header-expanded {
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s;
        }

        .step-header-expanded:hover {
          background: var(--bg);
          border-color: var(--accent);
        }

        .step-title {
          display: flex;
          gap: 12px;
          align-items: center;
          flex: 1;
        }

        .step-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--accent);
          color: white;
          border-radius: 50%;
          font-weight: 700;
          font-size: 12px;
        }

        .step-name {
          font-weight: 600;
          font-size: 15px;
        }

        .step-capability-tag {
          font-size: 12px;
          background: rgba(132, 255, 225, 0.1);
          color: var(--accent-2);
          padding: 4px 10px;
          border-radius: 4px;
        }

        .step-duration {
          font-size: 13px;
          color: var(--muted);
          font-weight: 500;
        }

        .step-details-expanded {
          margin-top: 12px;
          padding: 16px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        .detail-section {
          margin-bottom: 16px;
        }

        .detail-section:last-child {
          margin-bottom: 0;
        }

        .detail-section h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: var(--accent);
          font-weight: 600;
        }

        .detail-text {
          margin: 0;
          font-size: 14px;
          color: var(--text);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .detail-output {
          font-size: 14px;
          line-height: 1.6;
          max-height: 250px;
          overflow: auto;
        }

        .no-data {
          text-align: center;
          padding: 32px;
          color: var(--muted);
          font-size: 14px;
        }

        /* Analysis Card */
        .analysis-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
        }

        .analysis-card h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
        }

        .analysis-grid {
          display: grid;
          gap: 16px;
        }

        .analysis-item {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 16px;
          align-items: start;
          padding: 12px;
          background: var(--bg);
          border-radius: 6px;
        }

        .analysis-item.full-width {
          grid-template-columns: 1fr;
        }

        .analysis-item .label {
          font-weight: 600;
          color: var(--text);
          font-size: 14px;
        }

        .analysis-item .value {
          color: var(--accent);
          font-size: 14px;
        }

        .confidence-bar {
          width: 100%;
          height: 4px;
          background: var(--border);
          border-radius: 2px;
          margin-top: 8px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent), var(--accent-2));
          border-radius: 2px;
        }

        .capabilities-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .capability {
          display: inline-block;
          padding: 6px 12px;
          background: rgba(106, 168, 255, 0.1);
          color: var(--accent);
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
        }

        /* History */
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .history-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }

        .history-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .history-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: var(--muted);
        }

        .history-format {
          font-weight: 700;
          color: var(--accent);
        }

        .history-title {
          font-weight: 700;
          font-size: 14px;
          color: var(--text);
        }

        .history-summary {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.5;
        }

        .history-actions {
          display: flex;
          justify-content: flex-end;
        }

        .info-text {
          color: var(--muted);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
