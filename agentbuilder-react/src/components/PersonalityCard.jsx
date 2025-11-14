import React from "react";

export default function PersonalityCard({
  formality,
  setFormality,
  formalityBadge,
  creativity,
  setCreativity,
  creativityBadge,
}) {
  return (
    <>
      <h3>Personality</h3>

      <div className="metric">
        <b>Formality</b>
        <span className="badge" id="formalityBadge">
          {formalityBadge}
        </span>
      </div>
      <input className="slider" id="formality" type="range" min={0} max={100} value={formality} onChange={(e) => setFormality(+e.target.value)} />
      <div className="help">Casual ↔ Professional</div>

      <div style={{ height: 12 }} />

      <div className="metric">
        <b>Creativity</b>
        <span className="badge" id="creativityBadge">
          {creativityBadge}
        </span>
      </div>
      <input className="slider" id="creativity" type="range" min={0} max={100} value={creativity} onChange={(e) => setCreativity(+e.target.value)} />
      <div className="help">Factual ↔ Imaginative</div>

      <div style={{ height: 18 }} />
    </>
  );
}