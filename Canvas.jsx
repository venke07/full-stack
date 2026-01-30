import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const availableTools = [
  { id: 'web_search', name: 'Web Search', description: 'Search the internet for information', icon: '🔍' },
  { id: 'calculator', name: 'Calculator', description: 'Perform mathematical calculations', icon: '🔢' },
  { id: 'weather', name: 'Weather API', description: 'Get current weather information', icon: '🌤️' },
  { id: 'email', name: 'Send Email', description: 'Send email notifications', icon: '📧' },
  { id: 'database', name: 'Database Query', description: 'Query database records', icon: '💾' },
  { id: 'api_call', name: 'HTTP Request', description: 'Make API calls to external services', icon: '🌐' },
  { id: 'text_transform', name: 'Text Transform', description: 'Format, parse, or transform text', icon: '📝' },
  { id: 'file_ops', name: 'File Operations', description: 'Read, write, or process files', icon: '📁' },
];

const paletteBlocks = [
  {
    type: 'trigger',
    title: 'Webhook Trigger',
    description: 'Start workflow from external webhook or API call.',
    icon: '⚡',
  },
  {
    type: 'agent',
    title: 'AI Agent',
    description: 'LLM-powered agent with tool access and reasoning.',
    icon: '🤖',
  },
  {
    type: 'tool',
    title: 'Tool Action',
    description: 'Execute a specific tool or API function.',
    icon: '🛠️',
  },
  {
    type: 'decision',
    title: 'Conditional Branch',
    description: 'Branch workflow based on data or conditions.',
    icon: '🧭',
  },
  {
    type: 'loop',
    title: 'Loop/Iterate',
    description: 'Repeat actions over a list or collection.',
    icon: '🔁',
  },
  {
    type: 'transform',
    title: 'Data Transform',
    description: 'Parse, format, or modify data between steps.',
    icon: '⚙️',
  },
  {
    type: 'api',
    title: 'HTTP Request',
    description: 'Call external APIs with custom parameters.',
    icon: '🌐',
  },
  {
    type: 'output',
    title: 'Output/Response',
    description: 'Return final result or send notification.',
    icon: '📤',
  },
];

const lenses = [
  { title: 'Build Workflows', body: '⚡ Drag, connect, and execute automated flows' },
  { title: 'Add Tools', body: '🛠️ Web search, APIs, databases, and more' },
  { title: 'Configure Agents', body: '🤖 Select models and assign tools to agents' },
  { title: 'Test & Run', body: '▶️ Execute workflows and see real results' },
  { title: 'Export & Share', body: '💾 Save workflows as JSON to reuse' },
];

const makeId = () => `node-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultNodeConfig = {
  trigger: { webhookUrl: '', method: 'POST' },
  agent: { model: 'gpt-4o-mini', tools: [], systemPrompt: '' },
  tool: { toolId: '', parameters: {} },
  decision: { condition: '', trueNext: null, falseNext: null },
  loop: { iterateOver: '', maxIterations: 10 },
  transform: { operation: 'json_parse', inputField: '' },
  api: { method: 'GET', url: '', headers: {}, body: '' },
  output: { format: 'json', destination: 'response' },
};

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
    id: 'node-start-1',
    type: 'trigger',
    title: 'Webhook Trigger',
    description: 'Receives incoming requests',
    icon: '⚡',
    badges: ['Trigger'],
    x: 60,
    y: 120,
    config: { webhookUrl: '/api/workflow/trigger', method: 'POST' },
  },
  {
    id: 'node-agent-1',
    type: 'agent',
    title: 'Research Agent',
    description: 'AI agent with web search capabilities',
    icon: '🤖',
    badges: ['GPT-4', 'Web Search'],
    x: 360,
    y: 120,
    config: { 
      model: 'gpt-4o-mini', 
      tools: ['web_search'], 
      systemPrompt: 'You are a research assistant. Search the web and provide accurate information.' 
    },
  },
  {
    id: 'node-transform-1',
    type: 'transform',
    title: 'Format Output',
    description: 'Structure the response data',
    icon: '⚙️',
    badges: ['Transform'],
    x: 660,
    y: 120,
    config: { operation: 'json_format', inputField: 'result' },
  },
  {
    id: 'node-output-1',
    type: 'output',
    title: 'Send Response',
    description: 'Return formatted result',
    icon: '📤',
    badges: ['Output'],
    x: 960,
    y: 120,
    config: { format: 'json', destination: 'response' },
  },
];

export default function CanvasPage() {
  const [canvasBlocks, setCanvasBlocks] = useState(() => {
    try {
      const saved = localStorage.getItem('canvasBlocks');
      return saved ? JSON.parse(saved) : starterFlow;
    } catch (error) {
      console.error('Failed to load saved canvas', error);
      return starterFlow;
    }
  });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [connections, setConnections] = useState(() => {
    try {
      const saved = localStorage.getItem('canvasConnections');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectFrom, setConnectFrom] = useState(null);
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

  // Auto-create connections between sequential nodes if no custom connections
  const displayConnections = useMemo(() => {
    if (connections.length > 0) return connections;
    
    // Auto-connect nodes left to right
    const sorted = [...canvasBlocks].sort((a, b) => a.x - b.x);
    const autoConnections = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      autoConnections.push({ from: sorted[i].id, to: sorted[i + 1].id });
    }
    return autoConnections;
  }, [canvasBlocks, connections]);

  useEffect(() => {
    try {
      localStorage.setItem('canvasPersona', JSON.stringify(persona));
    } catch (error) {
      console.warn('Failed to persist canvas persona', error);
    }
  }, [persona]);

  useEffect(() => {
    try {
      localStorage.setItem('canvasBlocks', JSON.stringify(canvasBlocks));
    } catch (error) {
      console.warn('Failed to persist canvas blocks', error);
    }
  }, [canvasBlocks]);

  useEffect(() => {
    try {
      localStorage.setItem('canvasConnections', JSON.stringify(connections));
    } catch (error) {
      console.warn('Failed to persist connections', error);
    }
  }, [connections]);

  const handleDragStart = (event, block) => {
    event.dataTransfer.setData('application/json', JSON.stringify(block));
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDraggingOver(false);
    const payload = event.dataTransfer.getData('application/json');
    if (!payload) return;
    try {
      const block = JSON.parse(payload);
      const boardRect = boardRef.current?.getBoundingClientRect();
      const x = boardRect ? event.clientX - boardRect.left - NODE_WIDTH / 2 : 0;
      const y = boardRect ? event.clientY - boardRect.top - NODE_HEIGHT / 2 : 0;
      
      // Snap to grid (optional - 20px grid)
      const snappedX = Math.round(x / 20) * 20;
      const snappedY = Math.round(y / 20) * 20;
      
      const newBlock = {
        id: makeId(),
        ...block,
        x: snappedX,
        y: snappedY,
        config: defaultNodeConfig[block.type] || {},
        badges:
          block.badges ||
          (block.type === 'agent'
            ? ['AI', 'Tools']
            : block.type === 'tool'
              ? ['Action']
              : block.type === 'decision'
                ? ['Branch']
                : block.type === 'loop'
                  ? ['Iterate']
                  : [block.type]),
      };
      
      setCanvasBlocks((prev) => [...prev, newBlock]);
      setSelectedNodeId(newBlock.id);
    } catch (error) {
      console.error('Drag payload parse error', error);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event) => {
    if (event.target === boardRef.current) {
      setIsDraggingOver(false);
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the entire canvas?')) {
      setCanvasBlocks([]);
      setSelectedNodeId(null);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Reset to the default starter flow?')) {
      setCanvasBlocks(starterFlow);
      setSelectedNodeId(null);
    }
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
    
    // Add visual feedback
    document.body.style.cursor = 'grabbing';
  };

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragStateRef.current || !boardRef.current) return;
      const boardRect = boardRef.current.getBoundingClientRect();
      const { id, offsetX, offsetY } = dragStateRef.current;
      let x = event.clientX - boardRect.left - offsetX;
      let y = event.clientY - boardRect.top - offsetY;
      
      // Snap to grid (20px grid)
      x = Math.round(x / 20) * 20;
      y = Math.round(y / 20) * 20;
      
      // Keep nodes within bounds
      x = Math.max(0, Math.min(x, boardRect.width - NODE_WIDTH));
      y = Math.max(0, Math.min(y, boardRect.height - NODE_HEIGHT));
      
      setCanvasBlocks((prev) =>
        prev.map((block) => (block.id === id ? { ...block, x, y } : block)),
      );
    };

    const handlePointerUp = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Connection management
  const handleStartConnection = (fromNodeId) => {
    setIsConnecting(true);
    setConnectFrom(fromNodeId);
  };

  const handleCompleteConnection = (toNodeId) => {
    if (isConnecting && connectFrom && connectFrom !== toNodeId) {
      setConnections((prev) => [...prev, { from: connectFrom, to: toNodeId }]);
    }
    setIsConnecting(false);
    setConnectFrom(null);
  };

  const handleRemoveConnection = (fromId, toId) => {
    setConnections((prev) => prev.filter((c) => !(c.from === fromId && c.to === toId)));
  };

  // Node configuration
  const updateNodeConfig = (nodeId, configUpdates) => {
    setCanvasBlocks((prev) =>
      prev.map((block) =>
        block.id === nodeId
          ? { ...block, config: { ...block.config, ...configUpdates } }
          : block
      )
    );
  };

  const updateNodeTitle = (nodeId, title) => {
    setCanvasBlocks((prev) =>
      prev.map((block) =>
        block.id === nodeId ? { ...block, title } : block
      )
    );
  };

  // Workflow execution
  const executeWorkflow = async (inputData = {}) => {
    setIsExecuting(true);
    setExecutionResults({});
    
    try {
      // Build execution order based on connections
      const executionOrder = buildExecutionOrder();
      let context = { input: inputData };
      
      for (const nodeId of executionOrder) {
        const node = canvasBlocks.find((n) => n.id === nodeId);
        if (!node) continue;
        
        setExecutionResults((prev) => ({
          ...prev,
          [nodeId]: { status: 'running', output: null },
        }));
        
        try {
          const result = await executeNode(node, context);
          context = { ...context, [nodeId]: result };
          
          setExecutionResults((prev) => ({
            ...prev,
            [nodeId]: { status: 'success', output: result },
          }));
          
          // Small delay for visual feedback
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          setExecutionResults((prev) => ({
            ...prev,
            [nodeId]: { status: 'error', output: error.message },
          }));
          throw error;
        }
      }
      
      alert('Workflow executed successfully! Check node results in the panel.');
    } catch (error) {
      alert(`Workflow execution failed: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const buildExecutionOrder = () => {
    // Simple topological sort based on connections
    const order = [];
    const visited = new Set();
    const sorted = [...canvasBlocks].sort((a, b) => a.x - b.x);
    
    const visit = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      order.push(nodeId);
    };
    
    // Use connections if available, otherwise left-to-right order
    if (displayConnections.length > 0) {
      const triggerNodes = canvasBlocks.filter((n) => n.type === 'trigger');
      for (const trigger of triggerNodes) {
        visit(trigger.id);
        const traverse = (id) => {
          const outgoing = displayConnections.filter((c) => c.from === id);
          for (const conn of outgoing) {
            visit(conn.to);
            traverse(conn.to);
          }
        };
        traverse(trigger.id);
      }
    } else {
      sorted.forEach((node) => visit(node.id));
    }
    
    return order;
  };

  const executeNode = async (node, context) => {
    // Simulate node execution
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    switch (node.type) {
      case 'trigger':
        return { triggered: true, data: context.input };
      
      case 'agent':
        return {
          type: 'agent_response',
          model: node.config.model || 'gpt-4o-mini',
          tools: node.config.tools || [],
          response: `Agent "${node.title}" processed the request using ${node.config.model}`,
        };
      
      case 'tool':
        return {
          type: 'tool_result',
          tool: node.config.toolId,
          result: `Tool "${node.config.toolId}" executed successfully`,
        };
      
      case 'transform':
        return {
          type: 'transformed_data',
          operation: node.config.operation,
          data: context,
        };
      
      case 'api':
        return {
          type: 'api_response',
          method: node.config.method,
          url: node.config.url,
          response: { status: 200, data: 'API call simulated' },
        };
      
      case 'decision':
        return {
          type: 'decision_result',
          condition: node.config.condition,
          result: true,
        };
      
      case 'output':
        return {
          type: 'final_output',
          format: node.config.format,
          data: context,
        };
      
      default:
        return { processed: true };
    }
  };

  // Import/Export
  const exportWorkflow = () => {
    const workflow = {
      version: '1.0',
      nodes: canvasBlocks,
      connections: connections.length > 0 ? connections : null,
      metadata: {
        name: 'My Workflow',
        created: new Date().toISOString(),
      },
    };
    
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importWorkflow = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target.result);
        if (workflow.nodes) {
          setCanvasBlocks(workflow.nodes);
          if (workflow.connections) {
            setConnections(workflow.connections);
          }
          alert('Workflow imported successfully!');
        }
      } catch (error) {
        alert('Failed to import workflow: Invalid format');
      }
    };
    reader.readAsText(file);
  };

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
              <h3>Workflow Canvas</h3>
              <p className="muted">Build → Connect → Execute your automated workflow</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label className="btn ghost compact" style={{ cursor: 'pointer', margin: 0 }}>
                📥 Import
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={importWorkflow}
                  style={{ display: 'none' }}
                />
              </label>
              <button className="btn ghost compact" type="button" onClick={exportWorkflow} disabled={!canvasBlocks.length}>
                💾 Export
              </button>
              <button 
                className="btn primary compact" 
                type="button" 
                onClick={() => executeWorkflow({ test: 'data' })} 
                disabled={!canvasBlocks.length || isExecuting}
              >
                {isExecuting ? '⏳ Running...' : '▶️ Run Workflow'}
              </button>
              <button className="btn secondary compact" type="button" onClick={handleResetToDefault}>
                Reset
              </button>
              <button className="btn secondary compact" type="button" onClick={handleClear} disabled={!canvasBlocks.length}>
                Clear
              </button>
            </div>
          </div>
          <section className={`canvas-board cutting-mat ${isDraggingOver ? 'drag-over' : ''}`}>
            <div className="board-surface" ref={boardRef} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
              <svg className="connection-layer" width="100%" height="100%">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0 L8,4 L0,8 L2,4 Z" fill="#5af8ff" />
                  </marker>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                {displayConnections.map((conn, idx) => {
                  const fromNode = canvasBlocks.find((n) => n.id === conn.from);
                  const toNode = canvasBlocks.find((n) => n.id === conn.to);
                  if (!fromNode || !toNode) return null;
                  
                  const x1 = fromNode.x + NODE_WIDTH;
                  const y1 = fromNode.y + NODE_HEIGHT / 2;
                  const x2 = toNode.x;
                  const y2 = toNode.y + NODE_HEIGHT / 2;
                  const midX = (x1 + x2) / 2;
                  
                  // Create a smooth curve
                  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                  
                  return (
                    <g key={`${conn.from}-${conn.to}-${idx}`}>
                      <path
                        d={path}
                        stroke="#5af8ff"
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#arrowhead)"
                        filter="url(#glow)"
                        opacity="0.7"
                      />
                      {connections.length > 0 && (
                        <circle
                          cx={midX}
                          cy={(y1 + y2) / 2}
                          r="8"
                          fill="rgba(255, 0, 0, 0.6)"
                          stroke="#fff"
                          strokeWidth="2"
                          cursor="pointer"
                          onClick={() => handleRemoveConnection(conn.from, conn.to)}
                          style={{ cursor: 'pointer' }}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
              {canvasBlocks.length === 0 && (
                <div className="empty-state board-empty">
                  <h3>Drop blocks here</h3>
                  <p className="muted">
                    Describe triggers, agents, decision gates, and downstream tools.
                  </p>
                </div>
              )}
              {canvasBlocks.map((block, index) => {
                const execResult = executionResults[block.id];
                const statusColor = execResult?.status === 'success' ? '#4CAF50' : 
                                   execResult?.status === 'running' ? '#FFA726' :
                                   execResult?.status === 'error' ? '#EF5350' : 'transparent';
                
                return (
                <div
                  key={block.id}
                  className={`canvas-node floating ${selectedNodeId === block.id ? 'selected' : ''} ${execResult?.status || ''}`}
                  style={{
                    width: `${NODE_WIDTH}px`,
                    transform: `translate(${block.x}px, ${block.y}px)`,
                    boxShadow: execResult ? `0 0 20px ${statusColor}` : undefined,
                  }}
                >
                  {/* Connection points */}
                  <button
                    className="node-connect-point left"
                    type="button"
                    title="Incoming connection"
                    onClick={() => isConnecting && handleCompleteConnection(block.id)}
                    style={{
                      position: 'absolute',
                      left: '-8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '2px solid #5af8ff',
                      background: isConnecting && connectFrom !== block.id ? '#5af8ff' : '#0e1524',
                      cursor: isConnecting ? 'pointer' : 'default',
                      zIndex: 10,
                    }}
                  />
                  <button
                    className="node-connect-point right"
                    type="button"
                    title="Start connection"
                    onClick={() => handleStartConnection(block.id)}
                    style={{
                      position: 'absolute',
                      right: '-8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '2px solid #5af8ff',
                      background: connectFrom === block.id ? '#5af8ff' : '#0e1524',
                      cursor: 'pointer',
                      zIndex: 10,
                    }}
                  />
                  
                  <button
                    className="node-body"
                    type="button"
                    onPointerDown={(event) => handleNodePointerDown(event, block)}
                    onClick={() => setSelectedNodeId(block.id)}
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
                        {execResult && (
                          <span className="chip" style={{ 
                            background: statusColor,
                            color: '#fff',
                            fontSize: '10px',
                          }}>
                            {execResult.status === 'success' ? '✓' : 
                             execResult.status === 'running' ? '⏳' : '✗'}
                          </span>
                        )}
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
              )})
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
              <input
                type="text"
                value={selectedNode.title}
                onChange={(e) => updateNodeTitle(selectedNode.id, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  marginBottom: '8px',
                  fontSize: '16px',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: 'inherit',
                  textAlign: 'center',
                }}
              />
              <p className="muted">{selectedNode.description}</p>
              <div className="badge-row">
                {selectedNode.badges?.map((badge) => (
                  <span key={badge} className="chip ghost">
                    {badge}
                  </span>
                ))}
              </div>
              
              {/* Configuration based on node type */}
              <div style={{ marginTop: '20px', textAlign: 'left' }}>
                <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Configuration</h4>
                
                {selectedNode.type === 'agent' && (
                  <>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px' }}>Model</label>
                    <select
                      value={selectedNode.config?.model || 'gpt-4o-mini'}
                      onChange={(e) => updateNodeConfig(selectedNode.id, { model: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginBottom: '12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: 'inherit',
                      }}
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                    </select>
                    
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px' }}>Tools</label>
                    <div style={{ maxHeight: '150px', overflow: 'auto', marginBottom: '12px' }}>
                      {availableTools.map((tool) => (
                        <label key={tool.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedNode.config?.tools?.includes(tool.id) || false}
                            onChange={(e) => {
                              const tools = selectedNode.config?.tools || [];
                              const newTools = e.target.checked
                                ? [...tools, tool.id]
                                : tools.filter((t) => t !== tool.id);
                              updateNodeConfig(selectedNode.id, { tools: newTools });
                            }}
                          />
                          <span style={{ fontSize: '12px' }}>{tool.icon} {tool.name}</span>
                        </label>
                      ))}
                    </div>
                    
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px' }}>System Prompt</label>
                    <textarea
                      value={selectedNode.config?.systemPrompt || ''}
                      onChange={(e) => updateNodeConfig(selectedNode.id, { systemPrompt: e.target.value })}
                      placeholder="Describe the agent's role and behavior..."
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: 'inherit',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </>
                )}
                
                {selectedNode.type === 'tool' && (
                  <>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px' }}>Select Tool</label>
                    <select
                      value={selectedNode.config?.toolId || ''}
                      onChange={(e) => updateNodeConfig(selectedNode.id, { toolId: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginBottom: '12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: 'inherit',
                      }}
                    >
                      <option value="">Choose a tool...</option>
                      {availableTools.map((tool) => (
                        <option key={tool.id} value={tool.id}>{tool.icon} {tool.name}</option>
                      ))}
                    </select>
                  </>
                )}
                
                {selectedNode.type === 'api' && (
                  <>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px' }}>Method</label>
                    <select
                      value={selectedNode.config?.method || 'GET'}
                      onChange={(e) => updateNodeConfig(selectedNode.id, { method: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginBottom: '12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: 'inherit',
                      }}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                    
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px' }}>URL</label>
                    <input
                      type="text"
                      value={selectedNode.config?.url || ''}
                      onChange={(e) => updateNodeConfig(selectedNode.id, { url: e.target.value })}
                      placeholder="https://api.example.com/endpoint"
                      style={{
                        width: '100%',
                        padding: '8px',
                        marginBottom: '12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: 'inherit',
                        fontSize: '13px',
                      }}
                    />
                  </>
                )}
                
                {selectedNode.type === 'decision' && (
                  <>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px' }}>Condition</label>
                    <input
                      type="text"
                      value={selectedNode.config?.condition || ''}
                      onChange={(e) => updateNodeConfig(selectedNode.id, { condition: e.target.value })}
                      placeholder="e.g., result.status === 'success'"
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: 'inherit',
                        fontSize: '13px',
                      }}
                    />
                  </>
                )}
                
                {executionResults[selectedNode.id] && (
                  <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                    <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>Execution Result</h4>
                    <pre style={{ fontSize: '11px', overflow: 'auto', maxHeight: '150px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {JSON.stringify(executionResults[selectedNode.id].output, null, 2)}
                    </pre>
                  </div>
                )}
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
