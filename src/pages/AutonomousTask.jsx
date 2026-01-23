import React, { useState } from 'react';
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

  const handleSubmitTask = async () => {
    if (!taskDescription.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setIntermediateSteps([]);

    try {
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

      setResult(data);
      if (data.result.intermediateSteps) {
        setIntermediateSteps(data.result.intermediateSteps);
      }
    } catch (err) {
      setError(err.message);
      console.error('Task execution error:', err);
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
          <p>Describe what you want done, the system will figure out how</p>
        </div>
      </div>

      <div className="task-container">
        {!result ? (
          <div className="task-input-section">
            <div className="input-group">
              <label>What would you like the AI to do?</label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="E.g., Create a fitness plan for someone who wants to lose weight, generate a resume, write a research paper about AI, etc."
                rows={6}
                disabled={loading}
              />
            </div>

            <div className="input-group">
              <label>Output Format</label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                disabled={loading}
              >
                <option value="document">Document (Word)</option>
                <option value="html">HTML Page</option>
                <option value="markdown">Markdown</option>
                <option value="json">JSON Data</option>
                <option value="text">Plain Text</option>
                <option value="none">No Document (Display Only)</option>
              </select>
            </div>

            {error && (
              <div className="error-message">
                <span>❌ {error}</span>
              </div>
            )}

            <button
              className="submit-btn"
              onClick={handleSubmitTask}
              disabled={!taskDescription.trim() || loading}
            >
              {loading ? '⏳ Processing...' : '▶️ Execute Task'}
            </button>
          </div>
        ) : (
          <div className="task-result-section">
            <div className="result-header">
              <h2>✅ Task Completed!</h2>
              <button
                className="reset-btn"
                onClick={() => {
                  setResult(null);
                  setTaskDescription('');
                  setIntermediateSteps([]);
                  setError(null);
                }}
              >
                New Task
              </button>
            </div>

            {result.result.taskAnalysis && (
              <div className="analysis-box">
                <h3>📊 Task Analysis</h3>
                <div className="analysis-details">
                  <p>
                    <strong>Pattern Detected:</strong>{' '}
                    {result.result.taskAnalysis.description}
                  </p>
                  <p>
                    <strong>Confidence:</strong>{' '}
                    {result.result.taskAnalysis.confidence.toFixed(1)}%
                  </p>
                  <p>
                    <strong>Capabilities Used:</strong>{' '}
                    {result.result.taskAnalysis.requiredCapabilities.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {intermediateSteps.length > 0 && (
              <div className="steps-box">
                <h3>🔄 Execution Steps</h3>
                <div className="steps-list">
                  {intermediateSteps.map((step, index) => (
                    <div key={index} className="step-item">
                      <div className="step-header">
                        <span className="step-number">{step.stepNumber}</span>
                        <span className="step-agent">{step.agent}</span>
                        <span className="step-capability">{step.capability}</span>
                      </div>
                      <div className="step-content">
                        <details>
                          <summary>View Details</summary>
                          <div className="step-details">
                            <p>
                              <strong>Input:</strong> {step.input}
                            </p>
                            <p>
                              <strong>Output:</strong> {step.output.substring(0, 500)}
                              {step.output.length > 500 ? '...' : ''}
                            </p>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="result-box">
              <h3>📄 Final Result</h3>
              <div className="result-content">
                <p>{result.result.finalResult}</p>
              </div>
            </div>

            {result.document?.success && (
              <div className="document-box">
                <h3>💾 Generated Document</h3>
                <div className="document-info">
                  <p>
                    <strong>File:</strong> {result.document.filename}
                  </p>
                  <p>
                    <strong>Type:</strong> {result.document.type.toUpperCase()}
                  </p>
                  <p>
                    <strong>Size:</strong>{' '}
                    {(result.document.size / 1024).toFixed(2)} KB
                  </p>
                  <button
                    className="download-btn"
                    onClick={handleDownloadFile}
                  >
                    📥 Download File
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .autonomous-task-page {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
          color: var(--text);
        }

        .task-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-secondary);
        }

        .back-btn {
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
          cursor: pointer;
          font-size: 14px;
        }

        .back-btn:hover {
          background: var(--border);
        }

        .task-title h1 {
          margin: 0;
          font-size: 24px;
        }

        .task-title p {
          margin: 4px 0 0 0;
          font-size: 14px;
          color: var(--muted);
        }

        .task-container {
          flex: 1;
          overflow: auto;
          padding: 20px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }

        .task-input-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group label {
          font-weight: 600;
          font-size: 14px;
        }

        .input-group textarea,
        .input-group select {
          padding: 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg);
          color: var(--text);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 14px;
          resize: vertical;
        }

        .input-group textarea:focus,
        .input-group select:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .submit-btn,
        .download-btn,
        .reset-btn {
          padding: 12px 24px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 16px;
          transition: background 0.2s;
        }

        .submit-btn:hover:not(:disabled),
        .download-btn:hover,
        .reset-btn:hover {
          background: #0056b3;
        }

        .submit-btn:disabled {
          background: var(--muted);
          cursor: not-allowed;
          opacity: 0.6;
        }

        .reset-btn {
          background: var(--bg-tertiary);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .error-message {
          padding: 12px;
          background: rgba(220, 53, 69, 0.1);
          border: 1px solid #dc3545;
          border-radius: 6px;
          color: #dc3545;
        }

        .task-result-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 6px;
        }

        .result-header h2 {
          margin: 0;
        }

        .analysis-box,
        .steps-box,
        .result-box,
        .document-box {
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: 6px;
        }

        .analysis-box h3,
        .steps-box h3,
        .result-box h3,
        .document-box h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
        }

        .analysis-details p {
          margin: 8px 0;
          font-size: 14px;
        }

        .steps-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .step-item {
          padding: 12px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 4px;
        }

        .step-header {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 8px;
        }

        .step-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: #007bff;
          color: white;
          border-radius: 50%;
          font-weight: 600;
          font-size: 12px;
        }

        .step-agent {
          font-weight: 600;
          flex: 1;
        }

        .step-capability {
          font-size: 12px;
          background: var(--bg-tertiary);
          padding: 4px 8px;
          border-radius: 4px;
          color: var(--muted);
        }

        .step-details {
          margin-top: 8px;
          padding: 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          font-size: 13px;
          max-height: 200px;
          overflow: auto;
        }

        .step-details p {
          margin: 4px 0;
        }

        .result-content {
          padding: 12px;
          background: var(--bg);
          border-radius: 4px;
          max-height: 300px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .document-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .document-info p {
          margin: 0;
          font-size: 14px;
        }

        .download-btn {
          align-self: flex-start;
        }

        details {
          cursor: pointer;
        }

        summary {
          font-weight: 600;
          color: #007bff;
          user-select: none;
        }

        summary:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
