import { useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const WORKFLOW_PRESETS = [
	{
		id: 'refund',
		matcher: /(refund|chargeback|stripe|payment|credit)/i,
		title: 'Refund triage autopilot',
		subtitle: 'Finance + CX',
		insight: 'Amounts under $500 are approved instantly while risky refunds ping finance.',
		palette: 'amber',
		summary: [
			'Stripe webhook ingests refund events.',
			'Risk guard scores the request for fraud or abuse.',
			'Agent drafts the response with rationale.',
			'Tool layer issues credit + posts audit trail.',
			'Finance gets notified only for edge cases.',
		],
		steps: [
			{ icon: '⚡', title: 'Stripe Webhook', detail: 'Listens for charge.refund.created events.', meta: 'Trigger', kind: 'trigger' },
			{ icon: '🛡️', title: 'Risk Guard', detail: 'Scores refund against velocity + account health.', meta: 'Evaluator', kind: 'agent' },
			{ icon: '🤖', title: 'Triage Agent', detail: 'Summarizes reason, drafts human reply.', meta: 'Agent', kind: 'agent' },
			{ icon: '🛠️', title: 'Credit Issuer', detail: 'Calls Stripe + ERP to execute action.', meta: 'Tool chain', kind: 'tool' },
			{ icon: '📣', title: 'Finance Notify', detail: 'Posts recap to Slack #revenue-ops.', meta: 'Notification', kind: 'tool' },
		],
	},
	{
		id: 'incident',
		matcher: /(incident|pagerduty|outage|alert|oncall)/i,
		title: 'Incident follow-up brain',
		subtitle: 'SRE + Comms',
		insight: 'PagerDuty wake-ups turn into diagnostics, draft updates, and published retros automatically.',
		palette: 'violet',
		summary: [
			'PagerDuty trigger captures the alert payload.',
			'Diagnostics agent inspects logs + metrics.',
			'Writer agent drafts customer + internal copy.',
			'Tool step posts to Statuspage and Slack.',
		],
		steps: [
			{ icon: '🚨', title: 'PagerDuty Trigger', detail: 'Ingests P1/P2 signals.', meta: 'Trigger', kind: 'trigger' },
			{ icon: '🧠', title: 'Diagnostics Agent', detail: 'Pulls Grafana + log entries.', meta: 'Agent', kind: 'agent' },
			{ icon: '✍️', title: 'Comms Writer', detail: 'Drafts summary + ETA for customers.', meta: 'Agent', kind: 'agent' },
			{ icon: '🌐', title: 'Status Push', detail: 'Publishes to Statuspage + Slack.', meta: 'Tool', kind: 'tool' },
			{ icon: '📓', title: 'Retro Starter', detail: 'Seeds Notion postmortem doc.', meta: 'Tool', kind: 'tool' },
		],
	},
	{
		id: 'newsletter',
		matcher: /(newsletter|growth|campaign|marketing|leads|email)/i,
		title: 'Growth newsletter spine',
		subtitle: 'Lifecycle + Content',
		insight: 'Research, write, and publish multi-channel updates from one prompt.',
		palette: 'teal',
		summary: [
			'Scheduler sets cadence + pulls fresh data.',
			'Research agent collects highlights + metrics.',
			'Writer agent drafts variants by cohort.',
			'Publishing node pushes to ESP + socials.',
		],
		steps: [
			{ icon: '⏱️', title: 'Weekly Scheduler', detail: 'Locks send window + cohort filters.', meta: 'Trigger', kind: 'trigger' },
			{ icon: '🔎', title: 'Insight Scraper', detail: 'Grabs top metrics + wins.', meta: 'Data fetch', kind: 'tool' },
			{ icon: '🧪', title: 'Copy Lab', detail: 'LLM drafts variants with guardrails.', meta: 'Agent', kind: 'agent' },
			{ icon: '🛰️', title: 'Channel Launcher', detail: 'Sends to ESP + Buffer queue.', meta: 'Tool', kind: 'tool' },
			{ icon: '📊', title: 'Lift Radar', detail: 'Logs performance into CRM.', meta: 'Telemetry', kind: 'tool' },
		],
	},
];

const DEFAULT_PRESET = {
	id: 'general',
	title: 'Prompt-orchestrated workflow',
	subtitle: 'General automation',
	insight: 'Starter stack with trigger → reasoning → tool execution.',
	palette: 'slate',
	summary: [
		'Manual/HTTP trigger captures the signal.',
		'Reasoning agent plans the run.',
		'Tool macro executes APIs/databases.',
		'Notification node reports the outcome.',
	],
	steps: [
		{ icon: '⚡', title: 'Universal Trigger', detail: 'Webhook or scheduled call kicks things off.', meta: 'Trigger', kind: 'trigger' },
		{ icon: '🧭', title: 'Planner Agent', detail: 'Breaks request into executable steps.', meta: 'Agent', kind: 'agent' },
		{ icon: '🛠️', title: 'Tool Stack', detail: 'Hits APIs, DBs, and SaaS actions.', meta: 'Tool', kind: 'tool' },
		{ icon: '📩', title: 'Notify/Sync', detail: 'Writes back to Slack, Notion, or ticketing.', meta: 'Notification', kind: 'tool' },
	],
};

const buildWorkflow = (rawPrompt) => {
	const prompt = rawPrompt.trim();
	const base = WORKFLOW_PRESETS.find((preset) => preset.matcher.test(prompt)) ?? DEFAULT_PRESET;
	return {
		...base,
		prompt,
		generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
		steps: base.steps.map((step, index) => ({ ...step, id: `${base.id}-${index}` })),
	};
};

const normalizeWorkflow = (payload, promptText) => {
	if (!payload || !Array.isArray(payload.steps)) {
		return null;
	}
	return {
		title: payload.title || 'AI workflow',
		subtitle: payload.subtitle || 'Generated from prompt',
		insight: payload.insight || '',
		palette: payload.palette || 'slate',
		summary: Array.isArray(payload.summary) ? payload.summary : [],
		prompt: promptText,
		generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
		steps: payload.steps.map((step, index) => ({
			id: step.id || `ai-${index}-${Date.now()}`,
			title: step.title || `Step ${index + 1}`,
			detail: step.detail || '',
			kind: step.kind || 'tool',
			icon: step.icon || '🧩',
			meta: step.meta || step.kind || 'Step',
		})),
	};
};

export default function CanvasPage() {
	const [prompt, setPrompt] = useState('');
	const [workflow, setWorkflow] = useState(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState('');

	const metrics = useMemo(() => {
		if (!workflow) return null;
		const agentCount = workflow.steps.filter((step) => step.kind === 'agent').length;
		const toolCount = workflow.steps.filter((step) => step.kind === 'tool').length;
		return [
			{ label: 'Nodes generated', value: workflow.steps.length },
			{ label: 'Agent brains', value: agentCount },
			{ label: 'Tool invocations', value: toolCount },
		];
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
		setIsGenerating(true);
		try {
			const response = await fetch(`${API_URL}/api/flow-canvas/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: text }),
			});
			if (!response.ok) {
				const payload = await response.json().catch(() => ({}));
				throw new Error(payload?.error || 'Generation failed.');
			}
			const data = await response.json();
			const normalized = normalizeWorkflow(data.workflow, text);
			if (!normalized) {
				throw new Error('Received invalid workflow payload.');
			}
			setWorkflow(normalized);
			setPrompt('');
		} catch (error) {
			setError(error.message || 'Unable to generate workflow.');
			setWorkflow(buildWorkflow(text));
		} finally {
			setIsGenerating(false);
		}
	};

	const summaryFallback = [
		'Example: “Handle refunds over $500 and ping finance.”',
		'Canvas stays empty until you generate nodes.',
		'AI wires triggers → agents → tools instantly.',
	];

	return (
		<div className="lab-shell">
			<header className="lab-head">
				<p className="lab-eyebrow">Flow Canvas · Prompt mode</p>
				<h1>Start from an empty canvas and let AI reveal the workflow.</h1>
				<p className="lab-muted">
					No palettes or manual dragging yet. Describe the ops outcome and the canvas fabricates every node,
					connector, and telemetry panel the moment you hit generate.
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
							<small>Try prompts like “auto-handle refunds and alert finance.”</small>
							<ul>
								<li>We parse your ask into trigger → reasoning → tools.</li>
								<li>Nodes appear with connectors already balanced.</li>
								<li>You can re-prompt to regenerate anytime.</li>
							</ul>
						</div>
					)}

					{!isGenerating && workflow && (
						<div className="lab-flow" aria-live="polite">
							{workflow.steps.map((step, index) => (
								<div key={step.id} className={`lab-segment ${workflow.palette}`}>
									<article className="lab-node">
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
							{workflow ? `Generated ${workflow.generatedAt}` : 'Mention tools or systems you want to involve.'}
						</span>
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
						onChange={(event) => setPrompt(event.target.value)}
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
