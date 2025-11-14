import React from "react";

export default function ToolsCard({ toggles, toggle, modelPick, setModelPick, handleFiles }) {
  return (
    <>
      <h3>Tools</h3>
      <div className="tool" onClick={() => toggle("web")}>
        <div>
          <b>Web Search</b>
          <br />
          <small>Let the agent search the web when needed.</small>
        </div>
        <div className={`switch ${toggles.web ? "active" : ""}`} />
      </div>

      <div className="tool">
        <div>
          <b>RFD (Retrieve from Documents)</b>
          <br />
          <small>Index PDFs/Docs you upload and ground answers in them.</small>
        </div>
        <div className="row">
          <label className="chip ghost" htmlFor="fileUp">
            ⬆️ Add source
          </label>
          <input id="fileUp" type="file" hidden multiple onChange={handleFiles} />
          <div className={`switch ${toggles.rfd ? "active" : ""}`} onClick={() => toggle("rfd")} />
        </div>
      </div>

      <div className="tool">
        <div>
          <b>Custom GPT Model</b>
          <br />
          <small>Choose a tuned model for this agent.</small>
        </div>
        <div style={{ minWidth: 170 }}>
          <select id="modelPick" value={modelPick} onChange={(e) => setModelPick(e.target.value)}>
            <option>GPT-5 Thinking</option>
            <option>GPT-4o mini (fast)</option>
            <option>Cost-optimized</option>
          </select>
        </div>
      </div>

      <div className="tool" onClick={() => toggle("deep")}>
        <div>
          <b>Deep Research</b>
          <br />
          <small>Runs multi-step research with citations.</small>
        </div>
        <div className={`switch ${toggles.deep ? "active" : ""}`} />
      </div>
    </>
  );
}