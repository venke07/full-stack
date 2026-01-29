import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardLayout from '../components/DashboardLayout.jsx';
import { getModelMeta, modelOptions } from '../lib/modelOptions.js';

const DATA_TRANSFER_TYPE = 'application/canvas-node';
const AGENT_ACCENTS = ['#5da9ff', '#3dd6c5', '#ff9b6a', '#b58dff', '#ffd166', '#f472b6'];

const paletteBlocks = [
  {
    type: 'trigger',
    title: 'Salesforce Trigger',
    description: 'When a new lead updates their status.',
    accent: 'var(--accent)',
    modelId: null,
  },
  {
    type: 'action',
    title: 'Slack Notify',
    description: 'Send approvals or alerts into any channel.',
    accent: '#5da9ff',
    modelId: null,
  },
  {
    type: 'data',
    title: 'Vector Search',
    description: 'Query embeddings or turn docs into context.',
    accent: '#ff9b6a',
    modelId: null,
  },
  {
    type: 'logic',
    title: 'Branching Rule',
    description: 'Split traffic with filters or guardrails.',
    accent: '#b58dff',
    modelId: null,
  },
  {
    type: 'llm',
    title: 'LLM Agent',
    description: 'Let the agent call tools with guardrails.',
    accent: '#3dd6c5',
    modelId: modelOptions[0].id,
  },
];

const NODE_DIMENSIONS = { width: 240, height: 140 };

const starterNodes = [
  {
    id: 'node-1',
    type: 'trigger',
    title: 'CRM Trigger',
    description: 'Lead status becomes Qualified',
    accent: 'var(--accent)',
    x: 80,
    y: 80,
    modelId: null,
  },
  {
    id: 'node-2',
    type: 'llm',
    title: 'Reason over notes',
    description: 'Summarize discovery call highlights',
    accent: '#3dd6c5',
    x: 380,
    y: 180,
    modelId: modelOptions[0].id,
  },
  {
    id: 'node-3',
    type: 'action',
    title: 'Post to Slack',
    description: 'Notify account team for follow-up',
    accent: '#5da9ff',
    x: 700,
    y: 120,
    modelId: null,
  },
];

const starterConnections = [
  { id: 'conn-1', fromId: 'node-1', toId: 'node-2' },
  { id: 'conn-2', fromId: 'node-2', toId: 'node-3' },
];

const agentAccent = (seed = '') => {
  if (!seed) {
    return AGENT_ACCENTS[0];
  }
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AGENT_ACCENTS[hash % AGENT_ACCENTS.length];
};

export default function CanvasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState(starterNodes);
  const [connections, setConnections] = useState(starterConnections);
  const [selectedNodeId, setSelectedNodeId] = useState(starterNodes[0].id);
  const [linkSourceId, setLinkSourceId] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agentStatus, setAgentStatus] = useState('');
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const boardRef = useRef(null);
  const dragStateRef = useRef(null);
  const boardMetricsRef = useRef({ width: 0, height: 0 });
  const cascadeOffsetRef = useRef(0);

  const nodeLookup = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selectedNodeId ? nodeLookup[selectedNodeId] : null;
  const selectedAgent = useMemo(() => {
    if (!selectedNode?.agentId) {
      return null;
    }
    return agents.find((agent) => agent.id === selectedNode.agentId) ?? null;
  }, [agents, selectedNode?.agentId]);

  const clampPosition = (x, y) => {
    const { width, height } = boardMetricsRef.current;
    if (!width || !height) {
      return {
        x: Math.max(x, 0),
        y: Math.max(y, 0),
      };
    }
    const maxX = Math.max(width - NODE_DIMENSIONS.width, 0);
    const maxY = Math.max(height - NODE_DIMENSIONS.height, 0);
    return {
      x: Math.min(Math.max(x, 0), maxX),
      y: Math.min(Math.max(y, 0), maxY),
    };
  };

  const nextCascadePosition = () => {
    const offset = cascadeOffsetRef.current;
    cascadeOffsetRef.current = (offset + 36) % 180;
    return { x: 48 + offset, y: 48 + offset * 0.5 };
  };

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!dragStateRef.current || !boardRef.current) {
        return;
      }
      event.preventDefault();
      const boardRect = boardRef.current.getBoundingClientRect();
      const { nodeId, offsetX, offsetY } = dragStateRef.current;
      const x = event.clientX - boardRect.left - offsetX;
      const y = event.clientY - boardRect.top - offsetY;
      const clamped = clampPosition(x, y);
      setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, x: clamped.x, y: clamped.y } : node)));
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const element = boardRef.current;
    if (!element) {
      return () => {};
    }
    const updateMetrics = () => {
      const rect = element.getBoundingClientRect();
      boardMetricsRef.current = { width: rect.width, height: rect.height };
    };
    updateMetrics();
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateMetrics);
      resizeObserver.observe(element);
    }
    window.addEventListener('resize', updateMetrics);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateMetrics);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchAgents = async () => {
      if (!supabase || !user?.id) {
        setAgents([]);
        setAgentStatus('Sign in to sync your AI models.');
        return;
      }
      setIsLoadingAgents(true);
      const { data, error } = await supabase
        .from('agent_personas')
        .select('id, name, description, model_id, guardrails, sliders')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!isMounted) {
        return;
      }

      if (error) {
        setAgentStatus(`Failed to load agents: ${error.message}`);
        setAgents([]);
      } else {
        setAgentStatus(data?.length ? '' : 'No agents yet. Create one in Builder.');
        setAgents(data ?? []);
      }
      setIsLoadingAgents(false);
    };

    fetchAgents();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const spawnNodeFromBlock = (block, position) => {
    const id = `node-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fallbackPosition = position ?? nextCascadePosition();
    const clamped = clampPosition(fallbackPosition.x, fallbackPosition.y);
    const newNode = {
      id,
      type: block.type,
      title: block.title,
      description: block.description,
      accent: block.accent,
      x: clamped.x,
      y: clamped.y,
      modelId: block.modelId ?? null,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
    return newNode;
  };

  const spawnAgentNode = (agent, position) => {
    if (!agent) {
      return null;
    }
    const label = agent.name || 'Untitled agent';
    const fallbackPosition = position ?? nextCascadePosition();
    const clamped = clampPosition(fallbackPosition.x, fallbackPosition.y);
    const id = `agent-node-${agent.id}-${Date.now()}`;
    const newNode = {
      id,
      type: 'agent',
      title: label,
      description: agent.description || 'Open Builder to add more context.',
      accent: agentAccent(agent.id || label),
      x: clamped.x,
      y: clamped.y,
      modelId: agent.model_id || modelOptions[0].id,
      agentId: agent.id,
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
    return newNode;
  };

  const handlePaletteDragStart = (event, payload) => {
    event.dataTransfer.setData(DATA_TRANSFER_TYPE, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleBoardDrop = (event) => {
    event.preventDefault();
    if (!boardRef.current) {
      return;
    }
    const payloadRaw = event.dataTransfer.getData(DATA_TRANSFER_TYPE);
    if (!payloadRaw) {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(payloadRaw);
    } catch (error) {
      return;
    }
    const boardRect = boardRef.current.getBoundingClientRect();
    const tentativeX = event.clientX - boardRect.left - NODE_DIMENSIONS.width / 2;
    const tentativeY = event.clientY - boardRect.top - NODE_DIMENSIONS.height / 2;
    if (parsed.variant === 'agent') {
      spawnAgentNode(parsed.agent, { x: tentativeX, y: tentativeY });
    } else {
      spawnNodeFromBlock(parsed.block, { x: tentativeX, y: tentativeY });
    }
  };

  const handleNodePointerDown = (event, nodeId) => {
    if (event.button !== 0) {
      return;
    }
    if (event.target.closest?.('button')) {
      return;
    }
    event.stopPropagation();
    setSelectedNodeId(nodeId);
    if (!boardRef.current) {
      return;
    }
    const boardRect = boardRef.current.getBoundingClientRect();
    const node = nodeLookup[nodeId];
    dragStateRef.current = {
      nodeId,
      offsetX: event.clientX - boardRect.left - node.x,
      offsetY: event.clientY - boardRect.top - node.y,
    };
  };

  const handleBoardClick = () => {
    setSelectedNodeId(null);
    setLinkSourceId(null);
  };

  const handleConnectionClick = (nodeId) => {
    if (!linkSourceId) {
      setLinkSourceId(nodeId);
      return;
    }
    if (linkSourceId === nodeId) {
      setLinkSourceId(null);
      return;
    }
    const exists = connections.some((connection) => connection.fromId === linkSourceId && connection.toId === nodeId);
    if (!exists) {
      setConnections((prev) => [
        ...prev,
        {
          id: `conn-${linkSourceId}-${nodeId}-${Date.now()}`,
          fromId: linkSourceId,
          toId: nodeId,
        },
      ]);
    }
    setLinkSourceId(null);
  };

  const handleRemoveNode = (event, nodeId) => {
    event.stopPropagation();
    setNodes((prev) => prev.filter((node) => node.id !== nodeId));
    setConnections((prev) => prev.filter((connection) => connection.fromId !== nodeId && connection.toId !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  const handleNodeModelChange = (nodeId, modelId) => {
    setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, modelId: modelId || null } : node)));
  };

  const generateSystemPromptFromWorkflow = () => {
    // Build a system prompt from the workflow nodes
    const llmNodes = nodes.filter((n) => n.type === 'llm' || n.type === 'agent');
    const triggerNodes = nodes.filter((n) => n.type === 'trigger');
    const actionNodes = nodes.filter((n) => n.type === 'action');

    let prompt = `You are an AI agent designed to process workflows.\n\n`;

    if (triggerNodes.length > 0) {
      prompt += `TRIGGERS:\n`;
      triggerNodes.forEach((n) => {
        prompt += `- ${n.title}: ${n.description}\n`;
      });
      prompt += '\n';
    }

    if (llmNodes.length > 0) {
      prompt += `PRIMARY TASKS:\n`;
      llmNodes.forEach((n) => {
        prompt += `- ${n.title}: ${n.description}\n`;
      });
      prompt += '\n';
    }

    if (actionNodes.length > 0) {
      prompt += `ACTIONS:\n`;
      actionNodes.forEach((n) => {
        prompt += `- ${n.title}: ${n.description}\n`;
      });
      prompt += '\n';
    }

    prompt += `Process the workflow steps in sequence and provide clear outputs.`;
    return prompt;
  };

  const handleCreateAgentFromWorkflow = async () => {
    if (!agentName.trim()) {
      alert('Agent name is required');
      return;
    }

    if (nodes.length === 0) {
      alert('Add at least one node to your workflow');
      return;
    }

    setIsSaving(true);

    try {
      const systemPrompt = generateSystemPromptFromWorkflow();
      const workflowData = {
        nodes,
        connections,
      };

      // Determine primary model from LLM nodes
      const llmNode = nodes.find((n) => n.type === 'llm' || n.type === 'agent');
      const modelId = llmNode?.modelId || modelOptions[0].id;

      const { data, error } = await supabase
        .from('agent_personas')
        .insert([
          {
            user_id: user.id,
            name: agentName.trim(),
            description: agentDescription.trim() || `Agent created from workflow with ${nodes.length} nodes`,
            system_prompt: systemPrompt,
            model_id: modelId,
            status: 'draft',
            workflow_data: workflowData,
            guardrails: [],
            sliders: {},
          },
        ])
        .select();

      if (error) {
        alert(`Failed to create agent: ${error.message}`);
        setIsSaving(false);
        return;
      }

      const newAgent = data[0];
      alert(`Agent "${newAgent.name}" created successfully.`);

      // Pass workflow data to Builder via state
      navigate(`/builder?agentId=${newAgent.id}`, {
        state: {
          fromWorkflow: true,
          workflowData: workflowData,
          systemPrompt: systemPrompt,
        },
      });
    } catch (error) {
      console.error('Error creating agent:', error);
      alert('Failed to create agent from workflow');
      setIsSaving(false);
    }
  };

  const renderConnections = () => {
    if (!boardRef.current) {
      return null;
    }
    return connections.map((connection) => {
      const fromNode = nodeLookup[connection.fromId];
      const toNode = nodeLookup[connection.toId];
      if (!fromNode || !toNode) {
        return null;
      }
      const startX = fromNode.x + NODE_DIMENSIONS.width / 2;
      const startY = fromNode.y + NODE_DIMENSIONS.height / 2;
      const endX = toNode.x + NODE_DIMENSIONS.width / 2;
      const endY = toNode.y + NODE_DIMENSIONS.height / 2;
      return (
        <g key={connection.id} className="canvas-connection">
          <path
            stroke={fromNode.accent}
            d={`M ${startX} ${startY} C ${(startX + endX) / 2} ${startY}, ${(startX + endX) / 2} ${endY}, ${endX} ${endY}`}
          />
        </g>
      );
    });
  };

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Workflow Studio</p>
      <h1>Flow Canvas</h1>
      <p className="dashboard-sub">Orchestrate triggers, reasoning blocks, and actions before creating an agent.</p>
    </div>
  );

  const headerActions = (
    <div className="page-actions compact">
      <button
        type="button"
        className="btn primary"
        onClick={() => setShowCreateModal(true)}
        disabled={nodes.length === 0}
      >
        Save as agent
      </button>
      <Link className="btn secondary" to="/builder">
        Builder
      </Link>
      <Link className="btn secondary" to="/home">
        Overview
      </Link>
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent} actions={headerActions}>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create Agent from Workflow</h2>
            <p className="muted small">Convert your workflow into a reusable AI agent</p>

            <div className="form-group">
              <label htmlFor="agent-name">Agent Name *</label>
              <input
                id="agent-name"
                type="text"
                placeholder="e.g., Lead Qualification Agent"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                disabled={isSaving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="agent-desc">Description</label>
              <textarea
                id="agent-desc"
                placeholder="What does this agent do?"
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                disabled={isSaving}
                rows="3"
              />
            </div>

            <div className="modal-info">
              <p className="muted small">
                <strong>Workflow Summary:</strong>
                <br />
                {nodes.length} node{nodes.length !== 1 ? 's' : ''} • {connections.length} connection{connections.length !== 1 ? 's' : ''}
              </p>
              <p className="muted small">
                <strong>Primary Model:</strong>
                <br />
                {getModelMeta((nodes.find((n) => n.type === 'llm' || n.type === 'agent')?.modelId) || modelOptions[0].id).label}
              </p>
            </div>

            <div className="modal-actions">
              <button
                className="btn secondary"
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={handleCreateAgentFromWorkflow}
                disabled={isSaving || !agentName.trim()}
              >
                {isSaving ? 'Creating…' : 'Create agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="canvas-toolbar">
        <div>
          <p className="summary">
            {nodes.length}
            {' '}
            node{nodes.length === 1 ? '' : 's'} •
            {' '}
            {connections.length}
            {' '}
            connection{connections.length === 1 ? '' : 's'}
          </p>
          <p>Drag blocks from the palette or drop saved agents to expand your flow.</p>
        </div>
      </div>

      <section className="canvas-shell">
        <aside className="canvas-sidebar palette">
          <p className="eyebrow">Palette</p>
          <p className="muted small">Drag any block onto the board to expand your workflow.</p>
          <div className="palette-list">
            {paletteBlocks.map((block) => (
              <button
                key={block.type}
                className="palette-chip"
                type="button"
                draggable
                onDragStart={(event) => handlePaletteDragStart(event, { variant: 'block', block })}
                onClick={() => spawnNodeFromBlock(block)}
              >
                <span className="chip" style={{ background: block.accent }} />
                <div>
                  <strong>{block.title}</strong>
                  <p>{block.description}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="palette-section">
            <div className="palette-section-head">
              <p className="eyebrow">My AI models</p>
              {isLoadingAgents && <span className="muted small">Loading…</span>}
            </div>
            {agentStatus && <p className="muted small">{agentStatus}</p>}
            {!isLoadingAgents && agents.length === 0 ? (
              <div className="palette-empty">
                <p>No canvas-ready agents yet.</p>
                <Link className="btn ghost mini" to="/builder">
                  Create in Builder
                </Link>
              </div>
            ) : (
              <div className="agent-palette">
                {agents.map((agent) => {
                  const meta = getModelMeta(agent.model_id);
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      className="palette-chip agent-chip"
                      draggable
                      onDragStart={(event) =>
                        handlePaletteDragStart(event, {
                          variant: 'agent',
                          agent: {
                            id: agent.id,
                            name: agent.name,
                            description: agent.description,
                            model_id: agent.model_id,
                          },
                        })
                      }
                      onClick={() => spawnAgentNode(agent)}
                    >
                      <span className="agent-pill">{agent.name?.slice(0, 2)?.toUpperCase() || 'AI'}</span>
                      <div>
                        <strong>{agent.name || 'Untitled agent'}</strong>
                        <p>
                          {meta.label} • {agent.description || 'No description yet.'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="canvas-stage">
          <div
            className="canvas-board"
            ref={boardRef}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleBoardDrop}
            onClick={handleBoardClick}
          >
            <svg className="canvas-lines">{renderConnections()}</svg>
            {nodes.length === 0 && <div className="board-empty">Drag a block or agent to get started</div>}
            {nodes.map((node) => {
              const modelMeta = node.modelId ? getModelMeta(node.modelId) : null;
              const isSelected = selectedNodeId === node.id;
              const isLinkSource = linkSourceId === node.id;
              return (
                <div
                  key={node.id}
                  className={`canvas-node ${isSelected ? 'is-selected' : ''} ${isLinkSource ? 'is-link-source' : ''}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    borderColor: isSelected || isLinkSource ? node.accent : 'rgba(255, 255, 255, 0.08)',
                  }}
                  onMouseDown={(event) => handleNodePointerDown(event, node.id)}
                >
                  <div className="node-head" style={{ color: node.accent }}>
                    <span className="node-handle" />
                    <span className="node-type">{node.type}</span>
                    {node.agentId && <span className="node-agent-pill">Linked agent</span>}
                  </div>
                  <h4>{node.title}</h4>
                  <p>{node.description}</p>
                  {modelMeta && (
                    <div className="node-foot">
                      <span className="node-model-chip">{modelMeta.label}</span>
                      <span className="node-provider">{modelMeta.provider}</span>
                    </div>
                  )}
                  <div className="node-actions">
                    <button
                      type="button"
                      className={`chip ghost mini ${linkSourceId === node.id ? 'active' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleConnectionClick(node.id);
                      }}
                    >
                      {linkSourceId === node.id ? 'Select target' : 'Connect'}
                    </button>
                    <button type="button" className="chip ghost mini" onClick={(event) => handleRemoveNode(event, node.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="canvas-sidebar inspector">
          <p className="eyebrow">Inspector</p>
          {selectedNode ? (
            <>
              <div className="inspector-card">
                <p className="muted small">{selectedNode.type.toUpperCase()}</p>
                <h3>{selectedNode.title}</h3>
                <p>{selectedNode.description}</p>
                <div className="inspector-meta">
                  <span>Position</span>
                  <strong>
                    {Math.round(selectedNode.x)}px × {Math.round(selectedNode.y)}px
                  </strong>
                </div>
                <div className="inspector-meta">
                  <span>Connections</span>
                  <strong>
                    {connections.filter((connection) => connection.fromId === selectedNode.id).length} out /
                    {' '}
                    {connections.filter((connection) => connection.toId === selectedNode.id).length} in
                  </strong>
                </div>
                {selectedNode.modelId && (
                  <div className="inspector-meta">
                    <span>Model</span>
                    <strong>{getModelMeta(selectedNode.modelId).label}</strong>
                  </div>
                )}
              </div>

              <div className="inspector-control">
                <label htmlFor="model-select">Model binding</label>
                <select
                  id="model-select"
                  value={selectedNode.modelId ?? ''}
                  onChange={(event) => handleNodeModelChange(selectedNode.id, event.target.value)}
                >
                  <option value="">Unassigned</option>
                  {modelOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} — {option.provider}
                    </option>
                  ))}
                </select>
                {selectedNode.modelId && <p className="muted small">{getModelMeta(selectedNode.modelId).helper}</p>}
              </div>

              {selectedAgent && (
                <div className="inspector-card">
                  <p className="muted small">Linked agent</p>
                  <h4>{selectedAgent.name || 'Untitled agent'}</h4>
                  <p>{selectedAgent.description || 'Open Builder to add more context.'}</p>
                  <div className="inspector-meta">
                    <span>Model</span>
                    <strong>{getModelMeta(selectedAgent.model_id).label}</strong>
                  </div>
                  <Link className="btn ghost mini" to="/builder">
                    Edit in Builder
                  </Link>
                </div>
              )}
            </>
          ) : (
            <p className="muted small">Tap any node to see its details.</p>
          )}
        </aside>
      </section>
    </DashboardLayout>
  );
}
