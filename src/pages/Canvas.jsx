import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout.jsx';

const NODE_TYPES = {
  persona: { label: 'Persona', accent: '#6aa8ff', description: 'Voice, tone, and framing blocks.' },
  gate: { label: 'Gate', accent: '#ff7b7b', description: 'Safety, routing, or decision checks.' },
  tool: { label: 'Tool', accent: '#f5a524', description: 'APIs, connectors, or scripted steps.' },
  summary: { label: 'Summary', accent: '#c084fc', description: 'Synthesis, scoring, or coaching output.' },
  action: { label: 'Action', accent: '#7af0d5', description: 'Generic processing or fallback stage.' },
};

const NODE_LIBRARY = [
  { type: 'persona', icon: '🧬', title: 'Persona block', copy: 'Inject tone, empathy, or task framing.' },
  { type: 'gate', icon: '🛡️', title: 'Safety gate', copy: 'Filter risky content and branch requests.' },
  { type: 'tool', icon: '🛠️', title: 'Tool call', copy: 'Represent a service, connector, or workflow.' },
  { type: 'summary', icon: '📝', title: 'Synthesis block', copy: 'Summaries, scoring, or QA nodes.' },
  { type: 'action', icon: '⚙️', title: 'Action step', copy: 'Generic processing, notes, or fallbacks.' },
];

const TAG_LIBRARY = ['safety', 'persona', 'data', 'handoff', 'tooling'];

const HERO_CARDS = [
  { title: 'Spatial thinking', body: 'Drop blocks on a map so intent, tools, and safety live side by side.' },
  { title: 'Drag interactions', body: 'Reorder, duplicate, and branch nodes just by pulling them into place.' },
  { title: 'Trace ready', body: 'Connect the dots visually before shipping the agent playbook.' },
];

const STORAGE_KEYS = {
  nodes: 'flowCanvas.nodes',
  activity: 'flowCanvas.activity',
};

const NODE_SIZE = { width: 240, height: 150 };

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const snapValue = (value, step = 20) => Math.round(value / step) * step;
const stampOrder = (list = []) => list.map((node, index) => ({ ...node, order: index + 1 }));

const generateId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `node-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const normalizeNode = (node = {}) => ({
  id: node.id ?? generateId(),
  title: node.title?.trim() || 'Untitled block',
  detail: node.detail ?? 'Describe what happens inside this block.',
  type: NODE_TYPES[node.type] ? node.type : 'action',
  status: node.status === 'draft' ? 'draft' : 'live',
  tags: Array.isArray(node.tags) ? node.tags : [],
  owner: node.owner ?? 'Playbook team',
  position: {
    x: Number.isFinite(node.position?.x) ? node.position.x : 60,
    y: Number.isFinite(node.position?.y) ? node.position.y : 60,
  },
  updatedAt: node.updatedAt ?? new Date().toISOString(),
  order: Number.isFinite(node.order) ? node.order : 0,
});

const normalizeActivity = (entry = {}) => ({
  id: entry.id ?? generateId(),
  text: entry.text ?? 'Canvas updated',
  timestamp: entry.timestamp ?? new Date().toISOString(),
});

const normalizeCollection = (value, normalizer, fallback) => {
  if (!Array.isArray(value) || !value.length) {
    return fallback;
  }
  return value.map((item) => normalizer(item));
};

const loadStored = (key, fallback, normalizer) => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return normalizer ? normalizer(parsed) : parsed;
  } catch {
    return fallback;
  }
};

const DEFAULT_NODES = stampOrder([
  normalizeNode({
    title: 'Listen for intent',
    detail: 'Capture the utterance, detect the job-to-be-done, and hydrate context slots.',
    type: 'persona',
    tags: ['persona'],
    position: { x: 70, y: 80 },
  }),
  normalizeNode({
    title: 'Safety sweep',
    detail: 'Block self-harm, hate, or policy violations. Log rationale for escalations.',
    type: 'gate',
    tags: ['safety'],
    position: { x: 360, y: 60 },
  }),
  normalizeNode({
    title: 'Tool selector',
    detail: 'Choose search, memory, or code execution depending on the detected intent.',
    type: 'tool',
    tags: ['tooling', 'data'],
    position: { x: 660, y: 110 },
  }),
  normalizeNode({
    title: 'Compose reply',
    detail: 'Synthesize findings, cite sources, and propose next actions or handoff.',
    type: 'summary',
    tags: ['handoff'],
    position: { x: 360, y: 320 },
  }),
]);

const formatRelativeTime = (isoString) => {
  if (!isoString) {
    return 'just now';
  }
  const delta = Date.now() - new Date(isoString).getTime();
  if (!Number.isFinite(delta) || delta < 0) {
    return 'just now';
  }
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const computeDropPoint = (count, boardElement) => {
  const column = count % 3;
  const row = Math.floor(count / 3);
  const fallbackWidth = boardElement?.clientWidth ?? 960;
  const fallbackHeight = boardElement?.clientHeight ?? 640;
  const baseX = 60 + column * (NODE_SIZE.width + 80);
  const baseY = 60 + row * (NODE_SIZE.height + 60);
  const maxX = Math.max(20, fallbackWidth - NODE_SIZE.width - 20);
  const maxY = Math.max(20, fallbackHeight - NODE_SIZE.height - 20);
  return {
    x: clamp(baseX, 20, maxX),
    y: clamp(baseY, 20, maxY),
  };
};

export default function CanvasPage() {
  const boardRef = useRef(null);
  const dragRef = useRef({ id: null, offsetX: 0, offsetY: 0 });
  const nodesRef = useRef(DEFAULT_NODES);

  const [nodes, setNodes] = useState(() =>
    stampOrder(
      loadStored(
        STORAGE_KEYS.nodes,
        DEFAULT_NODES,
        (value) => normalizeCollection(value, normalizeNode, DEFAULT_NODES),
      ),
    ),
  );
  const [activity, setActivity] = useState(() =>
    loadStored(STORAGE_KEYS.activity, [], (value) => normalizeCollection(value, normalizeActivity, [])),
  );
  const [selectedId, setSelectedId] = useState(null);
  const [isBoardExpanded, setBoardExpanded] = useState(false);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    if (nodes.length && !selectedId) {
      setSelectedId(nodes[0].id);
      return;
    }
    if (!nodes.length) {
      setSelectedId(null);
    }
  }, [nodes, selectedId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.nodes, JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(activity));
  }, [activity]);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedId) ?? null, [nodes, selectedId]);
  const selectedNodeOrder = useMemo(() => {
    if (!selectedNode) {
      return 0;
    }
    if (Number.isFinite(selectedNode.order) && selectedNode.order > 0) {
      return selectedNode.order;
    }
    const fallbackIndex = nodes.findIndex((node) => node.id === selectedNode.id);
    return fallbackIndex >= 0 ? fallbackIndex + 1 : 0;
  }, [nodes, selectedNode]);
  const liveCount = useMemo(() => nodes.filter((node) => node.status === 'live').length, [nodes]);

  const recordActivity = useCallback((text) => {
    setActivity((prev) => [normalizeActivity({ text }), ...prev].slice(0, 12));
  }, []);

  const handlePointerMove = useCallback((event) => {
    const { id, offsetX, offsetY } = dragRef.current;
    if (!id) {
      return;
    }
    const board = boardRef.current;
    if (!board) {
      return;
    }
    const rect = board.getBoundingClientRect();
    const maxX = Math.max(0, rect.width - NODE_SIZE.width);
    const maxY = Math.max(0, rect.height - NODE_SIZE.height);
    const nextX = clamp(event.clientX - rect.left - offsetX, 0, maxX);
    const nextY = clamp(event.clientY - rect.top - offsetY, 0, maxY);
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id ? { ...node, position: { x: nextX, y: nextY }, updatedAt: new Date().toISOString() } : node,
      ),
    );
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current.id) {
      return;
    }
    dragRef.current = { id: null, offsetX: 0, offsetY: 0 };
    document.removeEventListener('mousemove', handlePointerMove);
    document.removeEventListener('mouseup', handlePointerUp);
  }, [handlePointerMove]);

  const beginDrag = useCallback(
    (event, nodeId) => {
      if (event.button !== 0) {
        return;
      }
      const board = boardRef.current;
      if (!board) {
        return;
      }
      const node = nodesRef.current.find((item) => item.id === nodeId);
      if (!node) {
        return;
      }
      const rect = board.getBoundingClientRect();
      dragRef.current = {
        id: nodeId,
        offsetX: event.clientX - (rect.left + node.position.x),
        offsetY: event.clientY - (rect.top + node.position.y),
      };
      document.addEventListener('mousemove', handlePointerMove);
      document.addEventListener('mouseup', handlePointerUp);
    },
    [handlePointerMove, handlePointerUp],
  );

  useEffect(() => () => handlePointerUp(), [handlePointerUp]);

  const handleNodePointerDown = (event, nodeId) => {
    setSelectedId(nodeId);
    const target = event.target;
    if (target instanceof Element && target.closest('button')) {
      return;
    }
    beginDrag(event, nodeId);
  };

  const handleBoardMouseDown = (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('.blueprint-node')) {
      return;
    }
    setSelectedId(null);
  };

  const handleUpdateNode = (nodeId, patch, activityLabel) => {
    setNodes((prev) =>
      prev.map((node) => (node.id === nodeId ? { ...node, ...patch, updatedAt: new Date().toISOString() } : node)),
    );
    if (activityLabel) {
      recordActivity(activityLabel);
    }
  };

  const handleToggleTag = (nodeId, tag) => {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== nodeId) {
          return node;
        }
        const hasTag = node.tags.includes(tag);
        return {
          ...node,
          tags: hasTag ? node.tags.filter((item) => item !== tag) : [...node.tags, tag],
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  };

  const handleAddNode = (type) => {
    const template = NODE_TYPES[type] ?? NODE_TYPES.action;
    const position = computeDropPoint(nodes.length, boardRef.current);
    const newNode = normalizeNode({
      title: `${template.label} ${nodes.length + 1}`,
      detail: template.description,
      type,
      status: 'draft',
      position,
    });
    setNodes((prev) => stampOrder([...prev, newNode]));
    setSelectedId(newNode.id);
    recordActivity(`Added ${template.label}`);
  };

  const handleDuplicateNode = (nodeId) => {
    const source = nodes.find((node) => node.id === nodeId);
    if (!source) {
      return;
    }
    const board = boardRef.current;
    const maxX = Math.max(20, (board?.clientWidth ?? 960) - NODE_SIZE.width - 20);
    const maxY = Math.max(20, (board?.clientHeight ?? 640) - NODE_SIZE.height - 20);
    const duplicate = normalizeNode({
      ...source,
      id: undefined,
      title: `${source.title} copy`,
      position: {
        x: clamp(source.position.x + 40, 20, maxX),
        y: clamp(source.position.y + 40, 20, maxY),
      },
    });
    setNodes((prev) => {
      const idx = prev.findIndex((node) => node.id === nodeId);
      const next = [...prev];
      next.splice(idx + 1, 0, duplicate);
      return stampOrder(next);
    });
    setSelectedId(duplicate.id);
    recordActivity(`Duplicated ${source.title}`);
  };

  const handleDeleteNode = (nodeId) => {
    const removed = nodes.find((node) => node.id === nodeId);
    setNodes((prev) => stampOrder(prev.filter((node) => node.id !== nodeId)));
    if (removed) {
      recordActivity(`Removed ${removed.title}`);
    }
    if (selectedId === nodeId) {
      setSelectedId(null);
    }
  };

  const handleClearBoard = () => {
    if (!nodes.length) {
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Clear every block from this canvas?')) {
      return;
    }
    setNodes([]);
    setSelectedId(null);
    recordActivity('Cleared blueprint');
  };

  const handleAutoLayout = () => {
    if (!nodes.length) {
      return;
    }
    setNodes((prev) =>
      prev.map((node, index) => ({
        ...node,
        position: computeDropPoint(index, boardRef.current),
        updatedAt: new Date().toISOString(),
      })),
    );
    recordActivity('Auto-arranged canvas');
  };

  const handleSnapToGrid = () => {
    if (!nodes.length) {
      return;
    }
    setNodes((prev) =>
      prev.map((node) => ({
        ...node,
        position: {
          x: snapValue(node.position.x),
          y: snapValue(node.position.y),
        },
        updatedAt: new Date().toISOString(),
      })),
    );
    recordActivity('Snapped nodes to grid');
  };

  const handleShiftHierarchy = useCallback(
    (nodeId, delta) => {
      if (!delta || nodesRef.current.length < 2) {
        return;
      }
      let movedTitle = null;
      const directionLabel = delta < 0 ? 'up' : 'down';
      setNodes((prev) => {
        const index = prev.findIndex((node) => node.id === nodeId);
        if (index < 0) {
          return prev;
        }
        const targetIndex = clamp(index + delta, 0, prev.length - 1);
        if (targetIndex === index) {
          return prev;
        }
        const next = [...prev];
        const [item] = next.splice(index, 1);
        next.splice(targetIndex, 0, item);
        movedTitle = item.title;
        const stamped = stampOrder(next);
        return stamped.map((node) =>
          node.id === item.id ? { ...node, updatedAt: new Date().toISOString() } : node,
        );
      });
      if (movedTitle) {
        recordActivity(`Moved ${movedTitle} ${directionLabel}`);
      }
    },
    [recordActivity],
  );

  const handleSetHierarchy = useCallback(
    (nodeId, rawPosition) => {
      if (rawPosition === '' || rawPosition === null || rawPosition === undefined) {
        return;
      }
      const numericPosition = Number(rawPosition);
      if (!Number.isFinite(numericPosition)) {
        return;
      }
      const total = nodesRef.current?.length ?? 0;
      if (total <= 1) {
        return;
      }
      const desiredIndex = clamp(Math.round(numericPosition) - 1, 0, total - 1);
      let movedTitle = null;
      setNodes((prev) => {
        const index = prev.findIndex((node) => node.id === nodeId);
        if (index < 0 || index === desiredIndex) {
          return prev;
        }
        const next = [...prev];
        const [item] = next.splice(index, 1);
        next.splice(desiredIndex, 0, item);
        movedTitle = item.title;
        const stamped = stampOrder(next);
        return stamped.map((node) =>
          node.id === item.id ? { ...node, updatedAt: new Date().toISOString() } : node,
        );
      });
      if (movedTitle) {
        recordActivity(`Set ${movedTitle} to step ${desiredIndex + 1}`);
      }
    },
    [recordActivity],
  );

  const handleSimulateFlow = () => {
    if (!nodes.length) {
      recordActivity('Simulation skipped — add nodes first');
      return;
    }
    const liveNodes = nodes.filter((node) => node.status === 'live');
    const summary = liveNodes.length
      ? `Simulation: ${liveNodes.length} live node${liveNodes.length === 1 ? '' : 's'} fired`
      : 'Simulation: draft-only path (no live nodes)';
    recordActivity(summary);
  };

  const connections = useMemo(() => {
    if (nodes.length < 2) {
      return [];
    }
    return nodes.slice(1).map((node, index) => {
      const from = nodes[index];
      return {
        id: `${from.id}-${node.id}`,
        start: {
          x: from.position.x + NODE_SIZE.width / 2,
          y: from.position.y + NODE_SIZE.height / 2,
        },
        end: {
          x: node.position.x + NODE_SIZE.width / 2,
          y: node.position.y + NODE_SIZE.height / 2,
        },
        status: node.status,
      };
    });
  }, [nodes]);

  const headerContent = (
    <div className="page-heading">
      <p className="eyebrow">Spatial builder</p>
      <h1>Agent Flow Canvas</h1>
      <p className="dashboard-sub">
        Drop numbered blocks on a map, drag paths into place, and narrate how the agent behaves.
      </p>
    </div>
  );

  const headerActions = (
    <div className="page-actions compact">
      <button className="btn secondary" type="button" onClick={handleSimulateFlow} disabled={!nodes.length}>
        Simulate path
      </button>
      <button className="btn ghost" type="button" onClick={handleAutoLayout} disabled={!nodes.length}>
        Auto layout
      </button>
      <button className="btn ghost" type="button" onClick={() => setBoardExpanded((prev) => !prev)}>
        {isBoardExpanded ? 'Shrink map' : 'Enlarge map'}
      </button>
      <Link className="btn ghost" to="/builder">
        Builder
      </Link>
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent} actions={headerActions}>
      <div className="canvas-lenses">
        {HERO_CARDS.map((lens) => (
          <div key={lens.title} className="lens-card">
            <p className="eyebrow">{lens.title}</p>
            <p className="muted">{lens.body}</p>
          </div>
        ))}
      </div>

      <section className={`blueprint-shell ${isBoardExpanded ? 'is-expanded' : ''}`}>
        <aside className="node-palette">
          <div className="palette-head">
            <p className="eyebrow">Block library</p>
            <p className="muted">Drag-to-place or tap to spawn</p>
          </div>
          <div className="palette-list">
            {NODE_LIBRARY.map((item) => (
              <button key={item.type} type="button" className="palette-item" onClick={() => handleAddNode(item.type)}>
                <span className="palette-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.copy}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="palette-footer">
            <button className="btn ghost mini" type="button" onClick={handleClearBoard} disabled={!nodes.length}>
              Clear canvas
            </button>
            <button className="btn ghost mini" type="button" onClick={handleSnapToGrid} disabled={!nodes.length}>
              Snap to grid
            </button>
          </div>
        </aside>

        <div className="blueprint-board-wrapper">
          <div className="blueprint-toolbar">
            <div>
              <p className="eyebrow">Canvas overview</p>
              <p className="muted">
                {nodes.length} block{nodes.length === 1 ? '' : 's'} · Live {liveCount} · Draft {nodes.length - liveCount}
              </p>
            </div>
            <div className="toolbar-metrics">
              <span>Persona {nodes.filter((node) => node.type === 'persona').length}</span>
              <span>Gates {nodes.filter((node) => node.type === 'gate').length}</span>
              <span>Tools {nodes.filter((node) => node.type === 'tool').length}</span>
            </div>
            <div className="toolbar-actions">
              <button className="btn ghost mini" type="button" onClick={handleSimulateFlow} disabled={!nodes.length}>
                Simulate
              </button>
              <button className="btn ghost mini" type="button" onClick={handleAutoLayout} disabled={!nodes.length}>
                Layout
              </button>
            </div>
          </div>

          <div className="blueprint-board" ref={boardRef} onMouseDown={handleBoardMouseDown}>
            <div className="board-grid" aria-hidden="true" />
            <svg className="connection-layer" width="100%" height="100%">
              {connections.map((connection) => {
                const { start, end, id, status } = connection;
                const deltaX = (end.x - start.x) * 0.5;
                const deltaY = (end.y - start.y) * 0.5;
                const path = `M ${start.x} ${start.y} C ${start.x + deltaX} ${start.y}, ${end.x - deltaX} ${end.y}, ${end.x} ${end.y}`;
                return <path key={id} d={path} className={`connection-line ${status}`} />;
              })}
            </svg>
            {nodes.length === 0 && (
              <div className="board-empty">
                <p>No blocks yet</p>
                <p className="muted">Use the library to spawn nodes, then drag them into place.</p>
              </div>
            )}
            {nodes.map((node, index) => {
              const accent = NODE_TYPES[node.type]?.accent ?? NODE_TYPES.action.accent;
              const orderLabel = node.order || index + 1;
              return (
                <article
                  key={node.id}
                  className={`blueprint-node ${node.type} ${selectedId === node.id ? 'selected' : ''}`}
                  style={{ transform: `translate(${node.position.x}px, ${node.position.y}px)`, '--node-accent': accent }}
                  onMouseDown={(event) => handleNodePointerDown(event, node.id)}
                  onDoubleClick={() => handleDuplicateNode(node.id)}
                >
                  <header className="node-handle">
                    <div className="node-meta">
                      <span className="node-index">#{orderLabel}</span>
                      <span className="node-role">{NODE_TYPES[node.type]?.label}</span>
                    </div>
                    <div className="node-drag-handle" />
                  </header>
                  <h3 className="node-title" title={node.title}>
                    {node.title}
                  </h3>
                  <p className="node-body">{node.detail}</p>
                  <footer className="node-actions">
                    <span className={`node-status ${node.status}`}>{node.status}</span>
                    <div className="node-action-buttons">
                      <button
                        type="button"
                        className="pill soft"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDuplicateNode(node.id);
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="pill alert"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteNode(node.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="node-inspector">
          <div className="inspector-section">
            <p className="eyebrow">Selected node</p>
            {selectedNode ? (
              <>
                <span className="meta-label">Block title</span>
                <input value={selectedNode.title} onChange={(event) => handleUpdateNode(selectedNode.id, { title: event.target.value })} />
                <span className="meta-label">Description</span>
                <textarea
                  rows={4}
                  value={selectedNode.detail}
                  onChange={(event) => handleUpdateNode(selectedNode.id, { detail: event.target.value })}
                  placeholder="Describe what the agent must do here."
                />
                <span className="meta-label">Owner</span>
                <input value={selectedNode.owner} onChange={(event) => handleUpdateNode(selectedNode.id, { owner: event.target.value })} />
                <span className="meta-label">Hierarchy</span>
                <div className="hierarchy-row">
                  <div className="hierarchy-input">
                    <span>#</span>
                    <input
                      type="number"
                      min={1}
                      max={nodes.length}
                      value={selectedNodeOrder}
                      onChange={(event) => handleSetHierarchy(selectedNode.id, event.target.value)}
                    />
                    <span className="hierarchy-total">of {nodes.length}</span>
                  </div>
                  <div className="hierarchy-bumpers">
                    <button
                      type="button"
                      className="pill soft"
                      onClick={() => handleShiftHierarchy(selectedNode.id, -1)}
                      disabled={selectedNodeOrder <= 1}
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="pill soft"
                      onClick={() => handleShiftHierarchy(selectedNode.id, 1)}
                      disabled={selectedNodeOrder >= nodes.length}
                    >
                      Move down
                    </button>
                  </div>
                </div>
                <div className="inspector-row">
                  <button
                    type="button"
                    className={`status-pill ${selectedNode.status}`}
                    onClick={() =>
                      handleUpdateNode(
                        selectedNode.id,
                        { status: selectedNode.status === 'live' ? 'draft' : 'live' },
                        'Toggled node status',
                      )
                    }
                  >
                    {selectedNode.status === 'live' ? 'Mark draft' : 'Mark live'}
                  </button>
                  <button type="button" className="pill" onClick={handleSnapToGrid} disabled={!nodes.length}>
                    Snap grid
                  </button>
                </div>
                <span className="meta-label">Tags</span>
                <div className="tag-row">
                  {TAG_LIBRARY.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`tag-chip ${selectedNode.tags.includes(tag) ? 'active' : ''}`}
                      onClick={() => handleToggleTag(selectedNode.id, tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <p className="timestamp">Updated {formatRelativeTime(selectedNode.updatedAt)}</p>
              </>
            ) : (
              <p className="muted">Tap a block to edit its metadata.</p>
            )}
          </div>

          <div className="inspector-section">
            <div className="inspector-head">
              <div>
                <p className="eyebrow">Activity</p>
                <h3>Canvas log</h3>
              </div>
            </div>
            <ul className="activity-log">
              {activity.length === 0 && <li className="muted">Interactions will show up here.</li>}
              {activity.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.text}</strong>
                  <span className="timestamp">{formatRelativeTime(entry.timestamp)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </DashboardLayout>
  );
}

