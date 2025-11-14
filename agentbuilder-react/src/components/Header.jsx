import React from "react";

export default function Header() {
  return (
    <header>
      <div className="brand">
        <div className="logo">AI</div>
        <div>
          <h1>Agent Builder</h1>
          <div className="sub">Build and configure your AI agent</div>
        </div>
      </div>
      <div className="row">
        <span className="chip">🔒 Autosave enabled</span>
        <span className="chip">✨ Draft</span>
      </div>
    </header>
  );
}