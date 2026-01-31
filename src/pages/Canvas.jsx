import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const summaryFallback = [
  'Example: "Handle refunds over $500 and ping finance."',
  'Canvas stays empty until you generate nodes.',
  'AI wires triggers → agents → tools instantly.',
];

const COST_MAP = {
  trigger: 0.0000,
  agent: 0.0040,
  tool: 0.0010,
  notify: 0.0005,
  decision: 0.0002,
  loop: 0.0020,
  transform: 0.0005,
  api: 0.0012,
  output: 0.0003,
};

const LATENCY_MAP = {
  trigger: 50,
  agent: 1200,
  tool: 600,
  notify: 300,
  decision: 180,
  loop: 900,
  transform: 240,
  api: 800,
  output: 200,
};

const formatCurrency = (value) => `$${value.toFixed(3)}`;
const formatMs = (value) => `${Math.round(value)}ms`;

const generateFlowId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `flow-${Date.now()}`);

const estimateCostLatency = (steps = []) => {
  const totals = steps.reduce(
    (acc, step) => {
      const kind = step.kind || 'tool';
      acc.cost += COST_MAP[kind] ?? 0.0004;
      acc.latency += LATENCY_MAP[kind] ?? 300;
      return acc;
    },
    { cost: 0, latency: 0 },
  );
  return {
    cost: formatCurrency(totals.cost),
    latency: formatMs(totals.latency),
  };
};

const simulateStepOutput = (step, payload, index) => {
  const kind = step.kind || 'tool';
  switch (kind) {
    case 'trigger':
      return { event: 'triggered', input: payload };
    case 'agent':
      return { decision: `Planned action for ${step.title}`, summary: step.detail };
    case 'tool':
      return { toolResult: `Executed ${step.title}`, status: 'ok' };
    case 'notify':
      return { notification: `Sent update: ${step.title}` };
    case 'decision':
      return { branch: 'true', reason: 'Condition satisfied' };
    case 'loop':
      return { iteration: 1, note: 'Loop executed once (simulated)' };
    case 'transform':
      return { transformed: true, note: step.detail };
    case 'api':
      return { status: 200, endpoint: step.detail || 'API call' };
    case 'output':
      return { output: `Delivered result from ${step.title}` };
    default:
      return { status: 'ok', detail: step.detail, step: index + 1 };
  }
};

export default function CanvasPage() {
  const [prompt, setPrompt] = useState('');
  const [workflow, setWorkflow] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generationMeta, setGenerationMeta] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  const [replaceIndex, setReplaceIndex] = useState(0);
  const [replacePrompt, setReplacePrompt] = useState('');
  const [replaceError, setReplaceError] = useState('');
  const [isReplacing, setIsReplacing] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [simulationInput, setSimulationInput] = useState('{"sample": "payload"}');
  const [simulationOutputs, setSimulationOutputs] = useState([]);
  const [simulationError, setSimulationError] = useState('');
  const [selectedStep, setSelectedStep] = useState(null);
  const [stepExplanation, setStepExplanation] = useState('');
  const [isExplainingStep, setIsExplainingStep] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [savedFlows, setSavedFlows] = useState([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [savedError, setSavedError] = useState('');
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [agentStatus, setAgentStatus] = useState('');
  const [agentError, setAgentError] = useState('');

  const metrics = useMemo(() => {
    if (!workflow) return null;
    const stepsCount = workflow.steps?.length ?? 0;
    return [
      { label: 'Nodes generated', value: stepsCount },
      { label: 'Segments parsed', value: workflow.segmentCount ?? stepsCount },
      { label: 'Keywords detected', value: workflow.keywords?.length ?? 0 },
    ];
  }, [workflow]);

  const estimates = useMemo(() => {
    if (!workflow?.steps?.length) return null;
    return estimateCostLatency(workflow.steps);
  }, [workflow]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isGenerating) return;

    const text = prompt.trim();
    if (!text) {
      setError('Describe what you want the workflow to do first.');
      return;
    }

    setError('');
    setGenerationMeta(null);
    setIsGenerating(true);

    try {
      const response = await fetch(`${API_URL}/api/flow-canvas/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await response.json();
      if (!response.ok || !data?.workflow) {
        throw new Error(data?.error || 'Flow generation failed. Try again.');
      }
      setWorkflow({
        ...data.workflow,
        flowId: data.workflow?.flowId || generateFlowId(),
      });
      setGenerationMeta({
        source: data.source || 'model',
        warning: data.warning || '',
      });
      setPrompt('');
    } catch (err) {
      setError(err.message || 'Unable to generate workflow. Try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadSavedFlows = async () => {
    setIsLoadingSaved(true);
    setSavedError('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) {
        setSavedFlows([]);
        return;
      }

      const { data, error } = await supabase
        .from('flow_canvas_versions')
        .select('flow_id, version, prompt, created_at, workflow')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSavedFlows(data || []);
    } catch (err) {
      setSavedError(err.message || 'Unable to load saved flows.');
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!workflow) return;
    setIsSaving(true);
    setSaveError('');
    setSaveStatus('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        throw authError;
      }
      const userId = authData?.user?.id;
      if (!userId) {
        throw new Error('Sign in to save workflows.');
      }

      const flowId = workflow.flowId || generateFlowId();
      const { data: existing, error: existingError } = await supabase
        .from('flow_canvas_versions')
        .select('version')
        .eq('user_id', userId)
        .eq('flow_id', flowId)
        .order('version', { ascending: false })
        .limit(1);

      if (existingError) {
        throw existingError;
      }

      const nextVersion = existing?.[0]?.version ? existing[0].version + 1 : 1;
      const payload = {
        user_id: userId,
        flow_id: flowId,
        version: nextVersion,
        prompt: workflow.prompt || '',
        summary: workflow.summary || [],
        workflow,
        created_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('flow_canvas_versions').insert(payload);
      if (insertError) {
        throw insertError;
      }
      setWorkflow((prev) => (prev ? { ...prev, flowId } : prev));
      setSaveStatus(`Saved v${nextVersion}`);
      await loadSavedFlows();
    } catch (err) {
      setSaveError(err.message || 'Unable to save workflow.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    loadSavedFlows();
  }, []);

  const handleCreateAgentFromWorkflow = async () => {
    if (!workflow?.steps?.length) return;
    setIsCreatingAgent(true);
    setAgentError('');
    setAgentStatus('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) throw new Error('Sign in to create agents.');

      const agentName = workflow.title || workflow.intentLabel || 'Workflow Agent';
      const agentDesc = (workflow.summary || []).join(' ');
      const stepsText = workflow.steps
        .map((step, index) => `${index + 1}. ${step.title} (${step.kind}) - ${step.detail}`)
        .join('\n');
      const agentPrompt = `You are an automation agent. Execute this workflow:\n${stepsText}\n\nRules:\n- Follow steps in order.\n- Use tools when specified.\n- Provide a short final summary.`;

      const payload = {
        user_id: userId,
        name: agentName,
        description: agentDesc,
        system_prompt: agentPrompt,
        status: 'draft',
        tools: { web: false, rfd: false, deep: false },
        sliders: { formality: 45, creativity: 35 },
        model_id: 'gemini-2.5-flash',
        model_label: 'Gemini 2.5 Flash',
        model_provider: 'gemini',
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('agent_personas').insert(payload).select('id').single();
      if (error) throw error;
      setAgentStatus(`Agent created: ${data?.id || 'unknown id'}`);
    } catch (err) {
      setAgentError(err.message || 'Unable to create agent.');
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleReplaceStep = async () => {
    if (!workflow?.steps?.length) return;
    if (!replacePrompt.trim()) {
      setReplaceError('Add a short instruction for the replacement step.');
      return;
    }
    setReplaceError('');
    setIsReplacing(true);
    try {
      const response = await fetch(`${API_URL}/api/flow-canvas/replace-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: replacePrompt.trim(),
          stepIndex: replaceIndex,
          workflow,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.step) {
        throw new Error(data?.error || 'Unable to replace step.');
      }
      setWorkflow((prev) => {
        if (!prev) return prev;
        const updated = [...prev.steps];
        updated[replaceIndex] = { ...updated[replaceIndex], ...data.step, id: updated[replaceIndex].id || data.step.id };
        return { ...prev, steps: updated };
      });
      setReplacePrompt('');
    } catch (err) {
      setReplaceError(err.message || 'Replacement failed.');
    } finally {
      setIsReplacing(false);
    }
  };

  const handleExplainFlow = async () => {
    if (!workflow?.steps?.length) return;
    setIsExplaining(true);
    try {
      const response = await fetch(`${API_URL}/api/flow-canvas/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      });
      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      const data = contentType.includes('application/json') ? JSON.parse(rawText) : null;
      if (!response.ok || !data?.explanation) {
        throw new Error(data?.error || 'Explanation failed. Check the server is running.');
      }
      setExplanation(data.explanation);
    } catch (err) {
      setExplanation(err.message || 'Unable to explain flow.');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleSimulate = () => {
    if (!workflow?.steps?.length) return;
    setSimulationError('');
    try {
      const parsed = simulationInput.trim() ? JSON.parse(simulationInput) : {};
      const outputs = workflow.steps.map((step, index) => ({
        stepId: step.id,
        title: step.title,
        output: simulateStepOutput(step, parsed, index),
      }));
      setSimulationOutputs(outputs);
    } catch (err) {
      setSimulationError('Simulation payload must be valid JSON.');
    }
  };

  const handleExplainStep = async (step, index) => {
    if (!step) return;
    setSelectedStep({ ...step, index });
    setStepExplanation('');
    setIsExplainingStep(true);
    try {
      const response = await fetch(`${API_URL}/api/flow-canvas/explain-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, index, workflow }),
      });
      const contentType = response.headers.get('content-type') || '';
      const rawText = await response.text();
      const data = contentType.includes('application/json') ? JSON.parse(rawText) : null;
      if (!response.ok || !data?.explanation) {
        throw new Error(data?.error || rawText || 'Unable to explain node.');
      }
      setStepExplanation(data.explanation);
    } catch (err) {
      const fallback = `Step ${index + 1} (${step.kind || 'step'}) verifies: ${step.title}. ${step.detail || ''}`;
      setStepExplanation(err.message ? `${err.message}\n${fallback}` : fallback);
    } finally {
      setIsExplainingStep(false);
    }
  };

  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (index) => {
    if (dragIndex === null || !workflow?.steps?.length) {
      return;
    }
    setWorkflow((prev) => {
      if (!prev) return prev;
      const updated = [...prev.steps];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(index, 0, moved);
      return { ...prev, steps: updated };
    });
    setDragIndex(null);
  };

  const sourceLabel =
    generationMeta?.source === 'model'
      ? 'LLM-generated'
      : generationMeta?.source === 'fallback'
        ? 'Heuristic fallback'
        : null;

  return (
    <div className="lab-shell">
      <header className="lab-head">
        <p className="lab-eyebrow">Flow Canvas · Prompt mode</p>
        <h1>Start from an empty canvas and let AI reveal the workflow.</h1>
        <p className="lab-muted">
          Describe the ops outcome and the canvas fabricates every node, connector, and telemetry panel the moment you
          hit generate. Drag nodes to reorder, click a node to inspect it.
        </p>
      </header>

      <section className="lab-panel">
        <div className="lab-board">
          <div className="lab-grid" aria-hidden="true" />
          {isGenerating && (
            <div className="lab-empty is-generating" aria-live="assertive">
              <span className="lab-spinner" />
              <p>Generating nodes…</p>
              <small>Auto-routing triggers, agents, and tool steps.</small>
            </div>
          )}

          {!isGenerating && !workflow && (
            <div className="lab-empty" aria-live="polite">
              <p>Blank space, ready for instructions.</p>
              <small>Try prompts like "auto-handle refunds and alert finance."</small>
              <ul>
                <li>We parse your ask into trigger → reasoning → tools.</li>
                <li>Nodes appear with connectors already balanced.</li>
                <li>You can re-prompt to regenerate anytime.</li>
              </ul>
            </div>
          )}

          {!isGenerating && workflow && workflow.steps?.length && (
            <div className="lab-flow" aria-live="polite">
              {workflow.steps.map((step, index) => (
                <div key={step.id} className={`lab-segment ${workflow.palette}`}>
                  <article
                    className="lab-node"
                    role="button"
                    tabIndex={0}
                    draggable
                    onClick={() => handleExplainStep(step, index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        handleExplainStep(step, index);
                      }
                    }}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(index)}
                  >
                    <div className="lab-node-icon" aria-hidden="true">{step.icon}</div>
                    <div>
                      <h4>{step.title}</h4>
                      <p>{step.detail}</p>
                    </div>
                    <span className="lab-chip">{step.meta}</span>
                  </article>
                  {index < workflow.steps.length - 1 && <div className="lab-link" />}
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="lab-sidebar">
          <div className="lab-card">
            <p className="lab-eyebrow">Prompt</p>
            <p className="lab-prompt-text">{workflow?.prompt ?? 'Awaiting your instructions'}</p>
            <span className="lab-meta">
              {workflow
                ? `Intent: ${workflow.intentLabel} · Generated ${workflow.generatedAt}${sourceLabel ? ` · ${sourceLabel}` : ''}`
                : 'Mention tools or systems you want to involve.'}
            </span>
            {generationMeta?.warning && <small className="lab-warning">{generationMeta.warning}</small>}
            {estimates && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                <span className="lab-chip">Est. cost {estimates.cost}</span>
                <span className="lab-chip">Est. latency {estimates.latency}</span>
              </div>
            )}
          </div>

          <div className="lab-card">
            <p className="lab-eyebrow">Summary</p>
            <ul>
              {(workflow?.summary ?? summaryFallback).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="lab-card">
            <p className="lab-eyebrow">Selected node</p>
            {selectedStep ? (
              <>
                <p className="lab-prompt-text">
                  Step {selectedStep.index + 1}: {selectedStep.title}
                </p>
                <p className="lab-muted">{selectedStep.detail}</p>
                <button type="button" className="btn ghost" onClick={() => handleExplainStep(selectedStep, selectedStep.index)} disabled={isExplainingStep}>
                  {isExplainingStep ? 'Explaining…' : 'Explain node'}
                </button>
                {stepExplanation && <p className="lab-muted" style={{ marginTop: '10px' }}>{stepExplanation}</p>}
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    if (!selectedStep) return;
                    const agentDraft = {
                      name: `${selectedStep.title} Agent`,
                      role: selectedStep.meta || selectedStep.kind,
                      goal: selectedStep.detail,
                      tools: [],
                    };
                    setExplanation(`Agent draft created: ${JSON.stringify(agentDraft, null, 2)}`);
                  }}
                >
                  Draft agent from node
                </button>
              </>
            ) : (
              <p className="lab-muted">Click a node to inspect and explain it.</p>
            )}
          </div>

          <div className="lab-card">
            <p className="lab-eyebrow">Explain this flow</p>
            {workflow ? (
              <>
                <button type="button" className="btn ghost" onClick={handleExplainFlow} disabled={isExplaining}>
                  {isExplaining ? 'Explaining…' : 'Generate explanation'}
                </button>
                {explanation && <p className="lab-muted" style={{ marginTop: '10px' }}>{explanation}</p>}
              </>
            ) : (
              <p className="lab-muted">Generate a workflow to explain it.</p>
            )}
          </div>

          <div className="lab-card">
            <p className="lab-eyebrow">Replace a node</p>
            {workflow?.steps?.length ? (
              <>
                <label className="lab-meta" htmlFor="replaceStep">Step</label>
                <select
                  id="replaceStep"
                  value={replaceIndex}
                  onChange={(event) => setReplaceIndex(Number(event.target.value))}
                >
                  {workflow.steps.map((step, index) => (
                    <option key={step.id} value={index}>
                      {index + 1}. {step.title}
                    </option>
                  ))}
                </select>
                <input
                  value={replacePrompt}
                  onChange={(event) => setReplacePrompt(event.target.value)}
                  placeholder="Replace with…"
                />
                {replaceError && <small className="lab-error">{replaceError}</small>}
                <button type="button" className="btn ghost" onClick={handleReplaceStep} disabled={isReplacing}>
                  {isReplacing ? 'Replacing…' : 'Replace step'}
                </button>
              </>
            ) : (
              <p className="lab-muted">Generate a workflow before replacing nodes.</p>
            )}
          </div>

          <div className="lab-card">
            <p className="lab-eyebrow">Simulate run</p>
            {workflow?.steps?.length ? (
              <>
                <textarea
                  rows={4}
                  value={simulationInput}
                  onChange={(event) => setSimulationInput(event.target.value)}
                  placeholder='{"sample":"payload"}'
                />
                {simulationError && <small className="lab-error">{simulationError}</small>}
                <button type="button" className="btn ghost" onClick={handleSimulate}>
                  Simulate
                </button>
                {simulationOutputs.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                    {simulationOutputs.map((entry) => (
                      <div key={entry.stepId} className="lab-card" style={{ padding: '10px' }}>
                        <strong>{entry.title}</strong>
                        <pre style={{ marginTop: '6px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(entry.output, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="lab-muted">Generate a workflow to simulate it.</p>
            )}
          </div>

          <div className="lab-card">
            <p className="lab-eyebrow">Save version</p>
            {workflow ? (
              <>
                <button type="button" className="btn ghost" onClick={handleSaveWorkflow} disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save to Supabase'}
                </button>
                {saveStatus && <small className="lab-meta">{saveStatus}</small>}
                {saveError && <small className="lab-error">{saveError}</small>}
              </>
            ) : (
              <p className="lab-muted">Generate a workflow to save it.</p>
            )}
          </div>

          <div className="lab-card">
            <p className="lab-eyebrow">Create agent</p>
            {workflow ? (
              <>
                <button type="button" className="btn ghost" onClick={handleCreateAgentFromWorkflow} disabled={isCreatingAgent}>
                  {isCreatingAgent ? 'Creating…' : 'Create agent from workflow'}
                </button>
                {agentStatus && <small className="lab-meta">{agentStatus}</small>}
                {agentError && <small className="lab-error">{agentError}</small>}
              </>
            ) : (
              <p className="lab-muted">Generate a workflow to build an agent.</p>
            )}
          </div>

          <div className="lab-card">
            <p className="lab-eyebrow">Saved versions</p>
            {isLoadingSaved && <p className="lab-muted">Loading saved flows…</p>}
            {savedError && <small className="lab-error">{savedError}</small>}
            {!isLoadingSaved && !savedFlows.length && (
              <p className="lab-muted">No saved flows yet.</p>
            )}
            {!isLoadingSaved && savedFlows.length > 0 && (
              <div style={{ display: 'grid', gap: '8px' }}>
                {savedFlows.map((item, index) => (
                  <button
                    key={`${item.flow_id}-${item.version}-${index}`}
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      if (!item.workflow) return;
                      setWorkflow(item.workflow);
                    }}
                  >
                    v{item.version} · {item.prompt?.slice(0, 36) || 'Untitled'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lab-card">
            <p className="lab-eyebrow">Stats</p>
            {metrics ? (
              <div className="lab-metrics">
                {metrics.map((metric) => (
                  <article key={metric.label}>
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p className="lab-muted">Metrics unlock after the first generation.</p>
            )}
          </div>
        </aside>
      </section>

      <form className="lab-prompt" onSubmit={handleSubmit}>
        <div className="lab-input-wrapper">
          <label htmlFor="flowPrompt">AI prompt</label>
          <input
            id="flowPrompt"
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              if (error) {
                setError('');
              }
            }}
            placeholder="Example: If PagerDuty fires, draft comms + update Statuspage."
            aria-invalid={Boolean(error)}
          />
          {error && <small className="lab-error">{error}</small>}
        </div>
        <button type="submit" disabled={isGenerating}>
          {isGenerating ? 'Generating…' : 'Generate nodes'}
        </button>
      </form>
    </div>
  );
}

