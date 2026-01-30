import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getModelMeta } from '../lib/modelOptions.js';
import DashboardLayout from '../components/DashboardLayout.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function EvolutionLab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [evolutionHistory, setEvolutionHistory] = useState([]);
  const [improvements, setImprovements] = useState('');
  const [isEvolving, setIsEvolving] = useState(false);
  const [status, setStatus] = useState('');
  const [generationCount, setGenerationCount] = useState(0);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparingVersion, setComparingVersion] = useState(null);

  useEffect(() => {
    fetchAgents();
  }, [user?.id]);

  const fetchAgents = async () => {
    if (!supabase || !user?.id) {
      setAgents([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('agent_personas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load agents:', error);
      setAgents([]);
    } else {
      setAgents(data ?? []);
    }
    setIsLoading(false);
  };

  const handleSelectAgent = async (agent) => {
    setSelectedAgent(agent);
    
    // Load evolution history from database
    let historyData = [
      {
        generation: 0,
        timestamp: new Date(agent.created_at),
        name: agent.name,
        description: agent.description,
        system_prompt: agent.system_prompt,
        sliders: agent.sliders,
        tools: agent.tools,
        improvements: 'Original version',
      }
    ];

    // Try to load saved evolution history from agent's evolution_history field
    if (agent.evolution_history && Array.isArray(agent.evolution_history)) {
      historyData = [historyData[0], ...agent.evolution_history];
    }

    setEvolutionHistory(historyData);
    setGenerationCount(historyData.length - 1);
    setSelectedVersion(0);
    setStatus('');
  };

  const generateEvolution = async () => {
    if (!selectedAgent || !improvements.trim()) {
      setStatus('⚠️ Please describe the improvements you want');
      return;
    }

    setIsEvolving(true);
    setStatus('🧬 Evolving agent...');

    try {
      const response = await fetch(`${API_URL}/api/evolve-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          currentPrompt: selectedAgent.system_prompt,
          description: selectedAgent.description,
          improvements: improvements,
          generation: generationCount + 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Evolution failed: ${response.statusText}`);
      }

      const evolvedData = await response.json();

      const newVersion = {
        generation: generationCount + 1,
        timestamp: new Date(),
        name: `${selectedAgent.name} v${generationCount + 1}`,
        description: evolvedData.description || selectedAgent.description,
        system_prompt: evolvedData.system_prompt,
        sliders: evolvedData.sliders || selectedAgent.sliders,
        tools: evolvedData.tools || selectedAgent.tools,
        improvements: improvements,
      };

      const updatedHistory = [...evolutionHistory, newVersion];
      setEvolutionHistory(updatedHistory);
      
      // Save evolution history to database
      const { error } = await supabase
        .from('agent_personas')
        .update({
          evolution_history: updatedHistory.slice(1), // Save all generations except original
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedAgent.id)
        .eq('user_id', user.id);

      if (error) {
        console.warn('Failed to save evolution history:', error);
        // Continue anyway - history is still in memory
      }

      setGenerationCount(generationCount + 1);
      setSelectedVersion(generationCount + 1);
      setImprovements('');
      setStatus('✨ Evolution created! Review and apply the changes.');
    } catch (err) {
      console.error('Evolution error:', err);
      setStatus(`❌ Evolution failed: ${err.message}`);
      setTimeout(() => setStatus(''), 3000);
    } finally {
      setIsEvolving(false);
    }
  };

  const handleApplyEvolution = async () => {
    if (!selectedVersion || selectedVersion === 0) return;

    const versionToApply = evolutionHistory[selectedVersion];
    if (!versionToApply) return;

    try {
      setStatus('💾 Applying evolution...');
      
      const { error } = await supabase
        .from('agent_personas')
        .update({
          name: versionToApply.name,
          description: versionToApply.description,
          system_prompt: versionToApply.system_prompt,
          sliders: versionToApply.sliders,
          tools: versionToApply.tools,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedAgent.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setStatus('✅ Evolution applied successfully!');
      setTimeout(() => {
        navigate('/home');
      }, 1500);
    } catch (err) {
      console.error('Apply error:', err);
      setStatus(`❌ Failed to apply: ${err.message}`);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Experimentation</p>
      <h1>Evolution Lab</h1>
      <p className="dashboard-sub">Iteratively improve an agent through progressive refinement cycles. Track every generation and compare versions.</p>
    </div>
  );

  const headerActions = (
    <div className="page-actions">
      <Link className="btn secondary" to="/builder">
        Open builder
      </Link>
      <Link className="btn secondary" to="/home">
        Back to overview
      </Link>
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent} actions={headerActions}>
      <div className="evolution-lab-container">
        <header className="evolution-header">
          <div className="evolution-title-section">
            <h1>🧬 Agent Evolution Lab</h1>
            <p>Iteratively refine and improve your agents through progressive generations</p>
          </div>
        </header>

        {status && <div className="evolution-status">{status}</div>}

        <div className="evolution-workspace">
          {/* Left: Agent Selection */}
          {!selectedAgent ? (
            <div className="evolution-panel agent-selection-panel">
              <h2>Select an Agent to Evolve</h2>
              <div className="agent-list">
                {isLoading ? (
                  <p className="empty-state">Loading agents...</p>
                ) : agents.length === 0 ? (
                  <p className="empty-state">No agents found. Create one first in the Builder.</p>
                ) : (
                  agents.map(agent => (
                    <button
                      key={agent.id}
                      className="agent-list-item"
                      onClick={() => handleSelectAgent(agent)}
                    >
                      <div className="item-header">
                        <h3>{agent.name}</h3>
                        <span className="model-badge">{getModelMeta(agent.model_id).label}</span>
                      </div>
                      <p className="item-desc">{agent.description}</p>
                      <div className="item-meta">
                        <span>📅 {new Date(agent.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Left: Evolution Timeline */}
              <div className="evolution-panel evolution-timeline-panel">
                <button
                  className="back-button"
                  onClick={() => {
                    setSelectedAgent(null);
                    setEvolutionHistory([]);
                    setGenerationCount(0);
                    setSelectedVersion(null);
                  }}
                >
                  ← Back to agents
                </button>

                <h2>Evolution Timeline</h2>
                <div className="timeline">
                  {evolutionHistory.map((version, idx) => (
                    <button
                      key={idx}
                      className={`timeline-item ${selectedVersion === idx ? 'is-active' : ''}`}
                      onClick={() => setSelectedVersion(idx)}
                    >
                      <div className="timeline-marker">
                        {idx === 0 ? '🌱' : '✨'}
                      </div>
                      <div className="timeline-content">
                        <p className="timeline-label">
                          {idx === 0 ? 'Original' : `Generation ${version.generation}`}
                        </p>
                        <span className="timeline-time">
                          {version.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {generationCount > 0 && (
                  <div className="evolution-actions">
                    <button
                      className="btn primary"
                      onClick={handleApplyEvolution}
                      disabled={selectedVersion === 0}
                    >
                      📤 Apply Selected Version
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => setComparisonMode(!comparisonMode)}
                    >
                      🔄 Compare Versions
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Evolution Details */}
              <div className="evolution-panel evolution-details-panel">
                {selectedVersion !== null && evolutionHistory[selectedVersion] && (
                  <>
                    <div className="version-header">
                      <h2>{evolutionHistory[selectedVersion].name}</h2>
                      <span className="generation-badge">
                        {selectedVersion === 0 ? 'Original' : `v${evolutionHistory[selectedVersion].generation}`}
                      </span>
                    </div>

                    <div className="version-details">
                      <div className="detail-section">
                        <label>Description</label>
                        <p>{evolutionHistory[selectedVersion].description}</p>
                      </div>

                      {selectedVersion > 0 && (
                        <div className="detail-section">
                          <label>Improvements Applied</label>
                          <p className="improvement-note">{evolutionHistory[selectedVersion].improvements}</p>
                        </div>
                      )}

                      <div className="detail-section">
                        <label>Characteristics</label>
                        <div className="characteristics">
                          <div className="char-item">
                            <span>🎯 Formality</span>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${evolutionHistory[selectedVersion].sliders?.formality || 50}%` }}
                              />
                            </div>
                            <span>{evolutionHistory[selectedVersion].sliders?.formality || 50}%</span>
                          </div>
                          <div className="char-item">
                            <span>✨ Creativity</span>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${evolutionHistory[selectedVersion].sliders?.creativity || 50}%` }}
                              />
                            </div>
                            <span>{evolutionHistory[selectedVersion].sliders?.creativity || 50}%</span>
                          </div>
                        </div>
                      </div>

                      {selectedVersion > 0 && (
                        <div className="detail-section">
                          <label>Prompt Preview</label>
                          <pre className="prompt-preview">
                            {evolutionHistory[selectedVersion].system_prompt?.substring(0, 200)}...
                          </pre>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Evolution Input */}
                {selectedVersion === generationCount && (
                  <div className="evolution-input-section">
                    <h3>🔬 Create Next Generation</h3>
                    <div className="input-group">
                      <label htmlFor="improvements">Describe improvements for the next generation:</label>
                      <textarea
                        id="improvements"
                        value={improvements}
                        onChange={(e) => setImprovements(e.target.value)}
                        placeholder="E.g., 'Make responses more conversational', 'Add more structured output', 'Improve factual accuracy'"
                        disabled={isEvolving}
                      />
                    </div>
                    <button
                      className="btn primary full"
                      onClick={generateEvolution}
                      disabled={isEvolving || !improvements.trim()}
                    >
                      {isEvolving ? '🧬 Evolving...' : '🧬 Generate Next Generation'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
