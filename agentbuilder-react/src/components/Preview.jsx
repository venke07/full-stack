import React from "react";

export default function Preview({ chat, chatBoxRef, chatInputRef, handleSend, dynamicIntro, chatReady, chatStatus, isSending }) {
  return (
    <section className="card preview">
      <div className="inner" style={{ paddingBottom: 0 }}>
        <h3>Preview of your agent</h3>
      </div>
      <div className={`chat-status ${chatReady ? "ready" : ""}`}>{chatStatus}</div>
      <div className="chat" id="chat" ref={chatBoxRef}>
        {chat.map((m) => (
          <div key={m.id} className={`bubble ${m.who === "me" ? "me" : ""}`}>
            {m.text}
          </div>
        ))}
        {!chatReady && <div className="bubble">{dynamicIntro}</div>}
      </div>
      <div className="chatbar">
        <input
          id="chatInput"
          type="text"
          placeholder={chatReady ? "Type here to chat with your agent..." : "Click Test Build Agent to enable chat."}
          ref={chatInputRef}
          disabled={!chatReady || isSending}
        />
        <button
          className="btn secondary"
          id="sendBtn"
          onClick={handleSend}
          disabled={!chatReady || isSending}
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </section>
  );
}
