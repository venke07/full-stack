import React from "react";

export default function DetailsCard({
  agentName,
  setAgentName,
  agentDesc,
  setAgentDesc,
  agentPrompt,
  setAgentPrompt,
  descCount,
  toggles,
  toggle,
}) {
  return (
    <section className="card">
      <div className="inner">
        <h3>Details</h3>

        <label htmlFor="agentName">Name</label>
        <input id="agentName" type="text" placeholder="e.g., Business Analyst" value={agentName} onChange={(e) => setAgentName(e.target.value)} />

        <div style={{ height: 10 }} />

        <label htmlFor="agentDesc">Description</label>
        <textarea id="agentDesc" placeholder="What does this agent do? Who is it for?" value={agentDesc} onChange={(e) => setAgentDesc(e.target.value.slice(0, 280))} />
        <div className="hint row-split">
          <span id="descCount">{descCount}</span>
          <span>Keep it concise.</span>
        </div>

        <div style={{ height: 10 }} />

        <label htmlFor="agentPrompt">System Prompt</label>
        <textarea id="agentPrompt" placeholder="Give high-level instructions that shape the agent's behaviour." value={agentPrompt} onChange={(e) => setAgentPrompt(e.target.value)} />

        <div style={{ height: 14 }} />
        <h3>Guardrails</h3>
        <div className="toggle" onClick={() => toggle("factual")}>
          <span>Stay factual</span>
          <div className={`switch ${toggles.factual ? "active" : ""}`} />
        </div>
        <div className="toggle" onClick={() => toggle("opinions")}>
          <span>Avoid personal opinions</span>
          <div className={`switch ${toggles.opinions ? "active" : ""}`} />
        </div>
      </div>
    </section>
  );
}