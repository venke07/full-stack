import React from "react";

export default function FooterBar({ onDiscard, onSave, onPublish }) {
  return (
    <div className="footer">
      <div className="wrap">
        <button className="btn danger" id="discard" onClick={onDiscard}>
          Discard
        </button>
        <button className="btn secondary" id="saveDraft" onClick={onSave}>
          Save
        </button>
        <button className="btn primary" id="publish" onClick={onPublish}>
          Publish
        </button>
      </div>
    </div>
  );
}