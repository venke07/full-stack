import React, { useState } from 'react';
import './ModelComparison.css';
import { getModelMeta } from '../lib/modelOptions.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const AVAILABLE_MODELS = [
  'gpt-4o-mini',
  'gemini-2.5-flash',
  'deepseek-chat',
];

const MODEL_COSTS = {
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 }, // per 1K tokens
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
  'deepseek-chat': { input: 0.00014, output: 0.00028 },
};

const ModelComparison = ({ agentId, systemPrompt }) => {
  const [selectedModels, setSelectedModels] = useState({});
  const [testPrompt, setTestPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [modelRatings, setModelRatings] = useState({});

  const handleModelToggle = (modelId) => {
    setSelectedModels((prev) => ({
      ...prev,
      [modelId]: !prev[modelId],
    }));
  };

  const handleRunComparison = async () => {
    const chosen = Object.keys(selectedModels).filter((m) => selectedModels[m]);
    if (chosen.length === 0) {
      alert('Select at least one model');
      return;
    }
    if (!testPrompt.trim()) {
      alert('Enter a test prompt');
      return;
    }

    setIsRunning(true);
    setResults([]);
    const comparisonResults = [];

    for (const modelId of chosen) {
      try {
        const startTime = Date.now();
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId,
            messages: [
              systemPrompt && {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: testPrompt,
              },
            ].filter(Boolean),
            temperature: 0.35,
          }),
        });

        const responseTimeMs = Date.now() - startTime;

        if (!response.ok) {
          comparisonResults.push({
            modelId,
            modelName: getModelMeta(modelId).label,
            response: '❌ Error getting response',
            responseTimeMs: 0,
            tokensEstimate: 0,
            cost: 0,
          });
          continue;
        }

        const data = await response.json();
        const outputTokens = Math.ceil((data.reply?.length || 0) / 4); // rough estimate
        const inputTokens = Math.ceil((testPrompt.length + (systemPrompt?.length || 0)) / 4);
        const costs = MODEL_COSTS[modelId] || { input: 0, output: 0 };
        const estimatedCost =
          ((inputTokens * costs.input + outputTokens * costs.output) / 1000).toFixed(4);

        comparisonResults.push({
          modelId,
          modelName: getModelMeta(modelId).label,
          response: data.reply,
          responseTimeMs,
          tokensEstimate: inputTokens + outputTokens,
          cost: estimatedCost,
        });
      } catch (error) {
        comparisonResults.push({
          modelId,
          modelName: getModelMeta(modelId).label,
          response: `❌ Error: ${error.message}`,
          responseTimeMs: 0,
          tokensEstimate: 0,
          cost: 0,
        });
      }
    }

    setResults(comparisonResults);
    setIsRunning(false);
  };

  const handleRateModel = (modelId, liked) => {
    setModelRatings((prev) => ({
      ...prev,
      [modelId]: liked ? 'thumbs-up' : 'thumbs-down',
    }));
  };

  const getWinner = () => {
    if (results.length === 0) return null;
    const withRatings = results.filter((r) => modelRatings[r.modelId]);
    if (withRatings.length === 0) return null;
    const topRated = withRatings.filter((r) => modelRatings[r.modelId] === 'thumbs-up');
    if (topRated.length === 0) return null;
    return topRated.reduce((best, current) =>
      current.responseTimeMs < best.responseTimeMs ? current : best
    );
  };

  const winner = getWinner();

  return (
    <div className="model-comparison">
      <div className="comparison-header">
        <h3>🏆 Model Comparison</h3>
        <p className="subtitle">Test and compare different AI models side-by-side</p>
      </div>

      <div className="comparison-setup">
        <div className="model-selector">
          <h4>Select Models</h4>
          <div className="model-checkboxes">
            {AVAILABLE_MODELS.map((modelId) => (
              <label key={modelId} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedModels[modelId] || false}
                  onChange={() => handleModelToggle(modelId)}
                  disabled={isRunning}
                />
                <span>{getModelMeta(modelId).label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="prompt-input">
          <h4>Test Prompt</h4>
          <textarea
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            placeholder="Enter a test prompt or question..."
            disabled={isRunning}
            rows="4"
          />
          <button
            className="btn-primary"
            onClick={handleRunComparison}
            disabled={isRunning || Object.values(selectedModels).every((v) => !v)}
          >
            {isRunning ? '⏳ Running...' : '▶ Run Comparison'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="comparison-results">
          <h4>Results</h4>
          {winner && (
            <div className="winner-badge">
              🎉 Best performing: <b>{winner.modelName}</b>
            </div>
          )}

          <div className="results-container">
            {results.map((result) => (
              <div
                key={result.modelId}
                className={`result-card ${winner?.modelId === result.modelId ? 'winner' : ''}`}
              >
                <div className="result-header">
                  <h5>{result.modelName}</h5>
                  <div className="result-metrics">
                    <span className="metric">⏱️ {result.responseTimeMs}ms</span>
                    <span className="metric">💰 ${result.cost}</span>
                  </div>
                </div>

                <div className="result-response">
                  <p>{result.response}</p>
                </div>

                <div className="result-footer">
                  <div className="rating-buttons">
                    <button
                      type="button"
                      onClick={() => handleRateModel(result.modelId, true)}
                      disabled={modelRatings[result.modelId] !== undefined}
                      title="Helpful"
                      style={{
                        background: modelRatings[result.modelId] === 'thumbs-up' ? '#10b981' : 'none',
                        color: modelRatings[result.modelId] === 'thumbs-up' ? 'white' : 'inherit',
                        border: `1px solid ${modelRatings[result.modelId] === 'thumbs-up' ? '#10b981' : '#ddd'}`,
                      }}
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRateModel(result.modelId, false)}
                      disabled={modelRatings[result.modelId] !== undefined}
                      title="Not helpful"
                      style={{
                        background: modelRatings[result.modelId] === 'thumbs-down' ? '#ef4444' : 'none',
                        color: modelRatings[result.modelId] === 'thumbs-down' ? 'white' : 'inherit',
                        border: `1px solid ${modelRatings[result.modelId] === 'thumbs-down' ? '#ef4444' : '#ddd'}`,
                      }}
                    >
                      👎
                    </button>
                  </div>
                  <div className="tokens-info">
                    ~{result.tokensEstimate} tokens
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="comparison-table">
            <h4>Quick Comparison</h4>
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Response Time</th>
                  <th>Est. Cost</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.modelId} className={winner?.modelId === result.modelId ? 'winner' : ''}>
                    <td>
                      <b>{result.modelName}</b>
                    </td>
                    <td>{result.responseTimeMs}ms</td>
                    <td>${result.cost}</td>
                    <td>
                      {modelRatings[result.modelId] === 'thumbs-up'
                        ? '👍 Good'
                        : modelRatings[result.modelId] === 'thumbs-down'
                        ? '👎 Poor'
                        : '⭐ Rate it'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelComparison;
