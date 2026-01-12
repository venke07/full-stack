import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const paletteBlocks = [
  {
    type: 'trigger',
    title: 'Form submission',
    description: 'Start a flow whenever a request form is submitted.',
    icon: '⚡',
  },
  {
    type: 'agent',
    title: 'AI Agent',
    description: 'Chat-enabled tool agent with memory + connectors.',
    icon: '🤖',
  },
  {
    type: 'decision',
    title: 'Decision check',
    description: 'Branch the path based on a boolean expression.',
    icon: '🧭',
  },
  {
    type: 'memory',
    title: 'Postgres memory',
    description: 'Store transcripts or hand-offs in a vector store.',
    icon: '🧠',
  },
  {
    type: 'action',
    title: 'Slack action',
    description: 'Send invites, update profiles, or notify channels.',
    icon: '💬',
  },
];

const lenses = [
  { title: 'IT Ops can', body: '⚡ On-board new employees' },
  { title: 'Sec Ops can', body: '⚡ Enrich incident tickets' },
  { title: 'Dev Ops can', body: '⚡ Convert natural language into API calls' },
  { title: 'Sales can', body: '⚡ Generate insights from reviews' },
  { title: 'You can', body: '▶️ Watch this video to hear our pitch' },
];

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultPersona = {
  name: 'AI Tools Agent',
  mission: 'Automate onboarding while enforcing safety controls.',
  prompt: 'Use warm, confident language. Explain decisions transparently.',
  sliders: {
    formality: 40,
    creativity: 55,
  },
  guardrails: {
    factual: true,
    opinions: true,
  },
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 130;

const starterFlow = [
  {
    id: makeId(),
    type: 'trigger',
    title: 'On "Create User" form submission',
    description: 'Kick off the workflow when an intake form is completed.',
    icon: '⚡',
    badges: ['Trigger'],
    x: 60,
    y: 120,
  },
  {
    id: makeId(),
    type: 'agent',
    title: 'AI Agent',
    description: 'Tools Agent orchestrates chat model + memory calls.',
    icon: '🤖',
    badges: ['Chat Model', 'Memory', 'Tools'],
    x: 360,
    y: 120,
  },
  {
    id: makeId(),
    type: 'decision',
    title: 'Is manager?',
    description: 'Route managers to a private Slack invite.',
    icon: '🧭',
    badges: ['Decision'],
    x: 660,
    y: 120,
  },
  {
    id: makeId(),
    type: 'action',
    title: 'Add to channel',
    description: 'Invite user to onboarding channel.',
    icon: '💬',
    badges: ['Slack'],
    x: 930,
    y: 60,
  },
  {
    id: makeId(),
    type: 'action',
    title: 'Update profile',
    description: 'Sync org chart metadata + Jira account.',
    icon: '💬',
    badges: ['Slack'],
    x: 930,
    y: 210,
  },
];

export default function CanvasPage() {
  const [canvasBlocks, setCanvasBlocks] = useState(starterFlow);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [persona, setPersona] = useState(() => {
    try {
      const stored = localStorage.getItem('canvasPersona');
      return stored ? { ...defaultPersona, ...JSON.parse(stored) } : defaultPersona;
    } catch (error) {
      console.error('Failed to parse stored persona', error);
      return defaultPersona;
    }
  });
  const navigate = useNavigate();
  const boardRef = useRef(null);
  const dragStateRef = useRef(null);

  const selectedNode = useMemo(
    () => canvasBlocks.find((block) => block.id === selectedNodeId) ?? null,
    [canvasBlocks, selectedNodeId],
  );

  const connections = useMemo(() => {
    const lines = [];
    for (let i = 0; i < canvasBlocks.length - 1; i += 1) {
      lines.push({ from: canvasBlocks[i], to: canvasBlocks[i + 1] });
    }
    return lines;
  }, [canvasBlocks]);

  useEffect(() => {
    try {
      localStorage.setItem('canvasPersona', JSON.stringify(persona));
    } catch (error) {
      console.warn('Failed to persist canvas persona', error);
    }
  }, [persona]);

  const handleDragStart = (event, block) => {
    event.dataTransfer.setData('application/json', JSON.stringify(block));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData('application/json');
    if (!payload) return;
    try {
      const block = JSON.parse(payload);
      const boardRect = boardRef.current?.getBoundingClientRect();
      const x = boardRect ? event.clientX - boardRect.left - NODE_WIDTH / 2 : 0;
      const y = boardRect ? event.clientY - boardRect.top - NODE_HEIGHT / 2 : 0;
      setCanvasBlocks((prev) => [
        ...prev,
        {
          id: makeId(),
          ...block,
          x,
          y,
          badges:
            block.badges ||
            (block.type === 'agent'
              ? ['Chat Model', 'Memory', 'Tools']
              : block.type === 'action'
                ? ['Action']
                : block.type === 'decision'
                  ? ['Decision']
                  : block.type === 'memory'
                    ? ['Memory']
                    : ['Trigger']),
        },
      ]);
      setSelectedNodeId(null);
    } catch (error) {
      console.error('Drag payload parse error', error);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleClear = () => {
    setCanvasBlocks([]);
    setSelectedNodeId(null);
  };

  const handleRemove = (id) => {
    setCanvasBlocks((prev) => prev.filter((block) => block.id !== id));
    setSelectedNodeId((prev) => (prev === id ? null : prev));
  };

  const handleNodePointerDown = (event, node) => {
    event.preventDefault();
    event.stopPropagation();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    dragStateRef.current = {
      id: node.id,
      offsetX: event.clientX - boardRect.left - node.x,
      offsetY: event.clientY - boardRect.top - node.y,
    };
    setSelectedNodeId(node.id);
  };

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragStateRef.current || !boardRef.current) return;
      const boardRect = boardRef.current.getBoundingClientRect();
      const { id, offsetX, offsetY } = dragStateRef.current;
      const x = event.clientX - boardRect.left - offsetX;
      const y = event.clientY - boardRect.top - offsetY;
      setCanvasBlocks((prev) =>
        prev.map((block) => (block.id === id ? { ...block, x, y } : block)),
      );
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const updatePersonaField = (field, value) => {
    setPersona((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updatePersonaGuardrail = (field) => {
    setPersona((prev) => ({
      ...prev,
      guardrails: {
        ...prev.guardrails,
        [field]: !prev.guardrails[field],
      },
    }));
  };

  const updatePersonaSlider = (field, value) => {
    setPersona((prev) => ({
      ...prev,
      sliders: {
        ...prev.sliders,
        [field]: value,
      },
    }));
  };

  const applyPersonaToBuilder = () => {
    try {
      sessionStorage.setItem('builderPrefill', JSON.stringify(persona));
    } catch (error) {
      console.warn('Unable to stage persona for builder', error);
    }
    navigate('/builder');
  };

  return (
    <div className="app canvas-page">
      <header>
        <div className="brand">
          <div className="logo">AI</div>
          <div>
            <h1>Flow Canvas</h1>
            <div className="sub">Drag, drop, and narrate each automation step.</div>
          </div>
        </div>
        <div className="header-actions">
          <Link className="btn ghost compact" to="/builder">
            ← Form Builder
          </Link>
          <Link className="btn ghost compact" to="/home">
            Dashboard
          </Link>
        </div>
      </header>

      <div className="canvas-lenses">
        {lenses.map((lens) => (
          <div key={lens.title} className="lens-card">
            <p className="eyebrow">{lens.title}</p>
            <p className="muted">{lens.body}</p>
          </div>
        ))}
      </div>

      <div className="canvas-workbench">
        <div className="board-shell">
          <div className="board-toolbar">
            <div>
              <h3>Cutting Mat</h3>
              <p className="muted">Free-drop the flow exactly where you want nodes to live.</p>
            </div>
            <button className="btn secondary" type="button" onClick={handleClear} disabled={!canvasBlocks.length}>
              Clear canvas
            </button>
          </div>
          <section className="canvas-board cutting-mat">
            <div className="board-surface" ref={boardRef} onDrop={handleDrop} onDragOver={handleDragOver}>
              <svg className="connection-layer" width="100%" height="100%">
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#5af8ff" />
                  </marker>
                </defs>
                {connections.map(({ from, to }) => (
                  <line
                    key={`${from.id}-${to.id}`}
                    x1={from.x + NODE_WIDTH}
                    y1={from.y + NODE_HEIGHT / 2}
                    x2={to.x}
                    y2={to.y + NODE_HEIGHT / 2}
                    stroke="#5af8ff"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                ))}
              </svg>
              {canvasBlocks.length === 0 && (
                <div className="empty-state board-empty">
                  <h3>Drop blocks here</h3>
                  <p className="muted">
                    Describe triggers, agents, decision gates, and downstream tools.
                  </p>
                </div>
              )}
              {canvasBlocks.map((block, index) => (
                <div
                  key={block.id}
                  className={`canvas-node floating ${selectedNodeId === block.id ? 'selected' : ''}`}
                  style={{
                    width: `${NODE_WIDTH}px`,
                    transform: `translate(${block.x}px, ${block.y}px)`,
                  }}
                >
                  <button
                    className="node-body"
                    type="button"
                    onPointerDown={(event) => handleNodePointerDown(event, block)}
                  >
                    <div className="node-icon">{block.icon}</div>
                    <div>
                      <b>{block.title}</b>
                      <p className="muted">{block.description}</p>
                      <div className="badge-row">
                        {block.badges?.map((badge) => (
                          <span key={badge} className="chip ghost">
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                  <div className="node-actions">
                    <span className="muted">Step {index + 1}</span>
                    <button className="btn ghost compact" type="button" onClick={() => handleRemove(block.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="palette-tray">
            <span className="tray-label">Blocks</span>
            <div className="tray-scroll">
              {paletteBlocks.map((block) => (
                <div
                  key={block.title}
                  className="palette-chip"
                  draggable
                  onDragStart={(event) => handleDragStart(event, block)}
                >
                  <span className="node-icon">{block.icon}</span>
                  <div>
                    <b>{block.title}</b>
                    <p className="muted">{block.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="canvas-panel side">
          <div className="panel-header">
            <h3>Details</h3>
            <p className="muted">
              Select a node to describe success criteria, safety checks, or integration parameters.
            </p>
          </div>
          {selectedNode ? (
            <div className="detail-card">
              <div className="node-icon large">{selectedNode.icon}</div>
              <h4>{selectedNode.title}</h4>
              <p className="muted">{selectedNode.description}</p>
              <div className="badge-row">
                {selectedNode.badges?.map((badge) => (
                  <span key={badge} className="chip ghost">
                    {badge}
                  </span>
                ))}
              </div>
              <textarea
                className="detail-notes"
                placeholder="Add implementation notes..."
                rows={4}
                onChange={() => {}}
                defaultValue=""
              />
              <p className="hint">Notes sync coming soon.</p>
            </div>
          ) : (
            <div className="empty-state">
              <p>Select a node to see its context.</p>
            </div>
          )}

          <div className="panel-header" style={{ marginTop: '20px' }}>
            <h3>Agent Personality</h3>
            <p className="muted">Tune tone + guardrails, then push to the form builder.</p>
          </div>
          <div className="persona-card">
            <label>Name</label>
            <input
              type="text"
              value={persona.name}
              onChange={(event) => updatePersonaField('name', event.target.value)}
              placeholder="e.g., Ops Copilot"
            />
            <label>Mission</label>
            <textarea
              rows={3}
              value={persona.mission}
              onChange={(event) => updatePersonaField('mission', event.target.value)}
              placeholder="What does this agent solve?"
            />
            <label>Prompt</label>
            <textarea
              rows={3}
              value={persona.prompt}
              onChange={(event) => updatePersonaField('prompt', event.target.value)}
              placeholder="Add extra instruction or voice guidance"
            />
            <div className="persona-sliders">
              <div>
                <div className="metric">
                  <b>Formality</b>
                  <span>{persona.sliders.formality}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={persona.sliders.formality}
                  onChange={(event) => updatePersonaSlider('formality', Number(event.target.value))}
                />
              </div>
              <div>
                <div className="metric">
                  <b>Creativity</b>
                  <span>{persona.sliders.creativity}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={persona.sliders.creativity}
                  onChange={(event) => updatePersonaSlider('creativity', Number(event.target.value))}
                />
              </div>
            </div>
            <div className="guardrail-row">
              <label>
                <input
                  type="checkbox"
                  checked={persona.guardrails.factual}
                  onChange={() => updatePersonaGuardrail('factual')}
                />
                Stay factual
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={persona.guardrails.opinions}
                  onChange={() => updatePersonaGuardrail('opinions')}
                />
                Avoid opinions
              </label>
            </div>
            <button className="btn primary" type="button" onClick={applyPersonaToBuilder}>
              Apply to Builder
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
