import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getModelMeta } from '../lib/modelOptions.js';
import DashboardLayout from '../components/DashboardLayout.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function FusionLab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [agentA, setAgentA] = useState(null);
  const [agentB, setAgentB] = useState(null);
  const [fusionRatio, setFusionRatio] = useState(50);
  const [fusedName, setFusedName] = useState('');
  const [isFusing, setIsFusing] = useState(false);
  const [fusionPreview, setFusionPreview] = useState(null);
  const [status, setStatus] = useState('');

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

  // Generate fusion preview when agents or ratio change
  useEffect(() => {
    if (agentA && agentB) {
      generateFusionPreview();
    } else {
      setFusionPreview(null);
    }
  }, [agentA, agentB, fusionRatio]);

  const generateFusionPreview = () => {
    if (!agentA || !agentB) return;

    const ratioA = fusionRatio / 100;
    const ratioB = 1 - ratioA;

    // Merge system prompts
    const fusedPrompt = `${agentA.system_prompt}\n\n[FUSION POINT]\n\n${agentB.system_prompt}`;

    // Merge descriptions
    const fusedDescription = ratioA >= 0.5
      ? `${agentA.description} with elements of ${agentB.description}`
      : `${agentB.description} with elements of ${agentA.description}`;

    // Merge sliders
    const fusedSliders = {
      formality: Math.round((agentA.sliders?.formality || 50) * ratioA + (agentB.sliders?.formality || 50) * ratioB),
      creativity: Math.round((agentA.sliders?.creativity || 50) * ratioA + (agentB.sliders?.creativity || 50) * ratioB),
    };

    // Merge tools (union of both agents' tools)
    const fusedTools = {
      ...(agentA.tools || {}),
      ...(agentB.tools || {}),
    };

    // Pick model based on ratio (prefer agent A's model if ratio >= 50)
    const fusedModel = ratioA >= 0.5 ? agentA.model_id : agentB.model_id;

    // Generate default name if not set
    const defaultName = `${agentA.name.split(' ')[0]}-${agentB.name.split(' ')[0]} Fusion`;

    setFusionPreview({
      name: fusedName || defaultName,
      description: fusedDescription,
      system_prompt: fusedPrompt,
      sliders: fusedSliders,
      tools: fusedTools,
      model_id: fusedModel,
      ratioA,
      ratioB,
    });
  };

  const handleCreateFusion = async () => {
    if (!fusionPreview || !user?.id) return;

    setIsFusing(true);
    setStatus('Creating fusion...');

    try {
      // Get model metadata for the fused agent
      const modelMeta = getModelMeta(fusionPreview.model_id);
      
      const { data, error } = await supabase
        .from('agent_personas')
        .insert({
          user_id: user.id,
          name: fusionPreview.name,
          description: fusionPreview.description,
          system_prompt: fusionPreview.system_prompt,
          sliders: fusionPreview.sliders,
          tools: fusionPreview.tools,
          model_id: fusionPreview.model_id,
          model_label: modelMeta.label,
          model_provider: modelMeta.provider,
          model_env_key: modelMeta.envKey,
          guardrails: agentA.guardrails || { factual: true, opinions: true },
          status: 'published',
        })
        .select()
        .single();

      if (error) throw error;

      setStatus('✨ Fusion created successfully!');
      setTimeout(() => {
        navigate('/home');
      }, 1500);
    } catch (err) {
      console.error('Fusion error:', err);
      setStatus(`❌ Failed to create fusion: ${err.message}`);
      setTimeout(() => setStatus(''), 3000);
    } finally {
      setIsFusing(false);
    }
  };

  const getRatioLabel = () => {
    if (fusionRatio >= 80) return `Mostly ${agentA?.name}`;
    if (fusionRatio >= 60) return `${agentA?.name} Dominant`;
    if (fusionRatio === 50) return 'Perfect Balance';
    if (fusionRatio >= 40) return `${agentB?.name} Dominant`;
    return `Mostly ${agentB?.name}`;
  };

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Experimentation</p>
      <h1>Fusion Lab</h1>
      <p className="dashboard-sub">Combine two existing agents into a tuned hybrid with blended prompts, sliders, and tools.</p>
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
      <div className="fusion-lab-container">
        <header className="fusion-header">
          <div className="fusion-title-section">
            <h1>⚗️ Agent Fusion Lab</h1>
            <p>Combine two agents to create a hybrid with merged capabilities</p>
          </div>
        </header>

        {status && <div className="fusion-status">{status}</div>}

        <div className="fusion-workspace">
        {/* Left: Agent Selection */}
        <div className="fusion-panel agent-selection-panel">
          <h2>Select Agents to Fuse</h2>
          
          <div className="agent-selector">
            <label>Agent A (Base)</label>
            <select
              value={agentA?.id || ''}
              onChange={(e) => {
                const selected = agents.find(a => a.id === e.target.value);
                setAgentA(selected);
              }}
              disabled={isLoading}
            >
              <option value="">Choose first agent...</option>
              {agents.filter(a => a.id !== agentB?.id).map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({getModelMeta(agent.model_id).label})
                </option>
              ))}
            </select>
          </div>

          {agentA && (
            <div className="agent-card-mini">
              <h3>{agentA.name}</h3>
              <p className="agent-desc">{agentA.description}</p>
              <div className="mini-stats">
                <span>🎯 Formality: {agentA.sliders?.formality || 50}%</span>
                <span>✨ Creativity: {agentA.sliders?.creativity || 50}%</span>
                <span>🤖 {getModelMeta(agentA.model_id).label}</span>
              </div>
            </div>
          )}

          <div className="fusion-symbol">⚡</div>

          <div className="agent-selector">
            <label>Agent B (Merge)</label>
            <select
              value={agentB?.id || ''}
              onChange={(e) => {
                const selected = agents.find(a => a.id === e.target.value);
                setAgentB(selected);
              }}
              disabled={isLoading}
            >
              <option value="">Choose second agent...</option>
              {agents.filter(a => a.id !== agentA?.id).map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({getModelMeta(agent.model_id).label})
                </option>
              ))}
            </select>
          </div>

          {agentB && (
            <div className="agent-card-mini">
              <h3>{agentB.name}</h3>
              <p className="agent-desc">{agentB.description}</p>
              <div className="mini-stats">
                <span>🎯 Formality: {agentB.sliders?.formality || 50}%</span>
                <span>✨ Creativity: {agentB.sliders?.creativity || 50}%</span>
                <span>🤖 {getModelMeta(agentB.model_id).label}</span>
              </div>
            </div>
          )}
        </div>

        {/* Middle: Fusion Controls */}
        {agentA && agentB && (
          <div className="fusion-panel fusion-controls-panel">
            <h2>Fusion Ratio</h2>
            <p className="ratio-label">{getRatioLabel()}</p>
            
            <div className="fusion-slider-container">
              <span className="slider-label">{agentA.name}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={fusionRatio}
                onChange={(e) => setFusionRatio(Number(e.target.value))}
                className="fusion-slider"
              />
              <span className="slider-label">{agentB.name}</span>
            </div>

            <div className="ratio-display">
              <div className="ratio-bar">
                <div
                  className="ratio-fill-a"
                  style={{ width: `${fusionRatio}%` }}
                />
                <div
                  className="ratio-fill-b"
                  style={{ width: `${100 - fusionRatio}%` }}
                />
              </div>
              <div className="ratio-percentages">
                <span>{fusionRatio}%</span>
                <span>{100 - fusionRatio}%</span>
              </div>
            </div>

            <div className="fusion-name-input">
              <label>Fusion Name</label>
              <input
                type="text"
                placeholder={fusionPreview?.name || 'Enter fusion name...'}
                value={fusedName}
                onChange={(e) => setFusedName(e.target.value)}
              />
            </div>

            <button
              className="btn primary fusion-btn"
              onClick={handleCreateFusion}
              disabled={isFusing || !fusionPreview}
            >
              {isFusing ? '⚡ Fusing...' : '✨ Create Fusion'}
            </button>
          </div>
        )}

        {/* Right: Preview */}
        {fusionPreview && (
          <div className="fusion-panel preview-panel">
            <h2>Fusion Preview</h2>
            
            <div className="fusion-preview-card">
              <div className="preview-header">
                <h3>{fusionPreview.name}</h3>
                <span className="preview-badge">Hybrid Agent</span>
              </div>

              <div className="preview-section">
                <label>Description</label>
                <p>{fusionPreview.description}</p>
              </div>

              <div className="preview-section">
                <label>Personality</label>
                <div className="preview-stats">
                  <div className="stat-item">
                    <span>🎯 Formality</span>
                    <div className="stat-bar">
                      <div
                        className="stat-fill"
                        style={{ width: `${fusionPreview.sliders.formality}%` }}
                      />
                    </div>
                    <span className="stat-value">{fusionPreview.sliders.formality}%</span>
                  </div>
                  <div className="stat-item">
                    <span>✨ Creativity</span>
                    <div className="stat-bar">
                      <div
                        className="stat-fill"
                        style={{ width: `${fusionPreview.sliders.creativity}%` }}
                      />
                    </div>
                    <span className="stat-value">{fusionPreview.sliders.creativity}%</span>
                  </div>
                </div>
              </div>

              <div className="preview-section">
                <label>Model</label>
                <p className="preview-model">🤖 {getModelMeta(fusionPreview.model_id).label}</p>
              </div>

              <div className="preview-section">
                <label>Merged Tools</label>
                <div className="preview-tools">
                  {Object.entries(fusionPreview.tools)
                    .filter(([, enabled]) => enabled)
                    .map(([tool]) => (
                      <span key={tool} className="tool-badge">
                        {tool}
                      </span>
                    ))}
                </div>
              </div>

              <div className="preview-section">
                <label>Fusion Composition</label>
                <div className="composition-viz">
                  <div className="composition-item">
                    <span>{agentA.name}</span>
                    <span className="composition-percent">{Math.round(fusionPreview.ratioA * 100)}%</span>
                  </div>
                  <div className="composition-item">
                    <span>{agentB.name}</span>
                    <span className="composition-percent">{Math.round(fusionPreview.ratioB * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!agentA && !agentB && (
          <div className="fusion-empty-state">
            <div className="empty-icon">⚗️</div>
            <h3>Ready to Create Something New?</h3>
            <p>Select two agents from the left to begin the fusion process.</p>
            <p className="empty-hint">Mix their personalities, prompts, and tools to create a unique hybrid agent!</p>
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
