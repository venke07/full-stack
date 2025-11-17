import React from "react";

export default function FooterBar({ onDiscard, onSave, onPublish, onGoToChatInterface }) {
  return (
    <footer className="footer-bar">
      <button className="btn secondary" onClick={onDiscard}>
        Discard
      </button>
      <button className="btn secondary" onClick={onSave}>
        Save Draft
      </button>
      <button className="btn primary" onClick={onPublish}>
        Publish Agent
      </button>
      <button className="btn primary-success" onClick={onGoToChatInterface}>
        Go to Chat Interface →
      </button>
    </footer>
  );
}