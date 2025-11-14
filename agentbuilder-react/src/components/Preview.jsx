import React from "react";

export default function Preview({ chat, chatBoxRef, chatInputRef, handleSend, dynamicIntro }) {
  return (
    <section className="card preview">
      <div className="inner" style={{ paddingBottom: 0 }}>
        <h3>Preview of your agent</h3>
      </div>
      <div className="chat" id="chat" ref={chatBoxRef}>
        {chat.map((m) => (
          <div key={m.id} className={`bubble ${m.who === "me" ? "me" : ""}`}>
            {m.text}
          </div>
        ))}
        <div className="bubble">{dynamicIntro}</div>
      </div>
      <div className="chatbar">
        <input id="chatInput" type="text" placeholder="Type here to chat with your agent…" ref={chatInputRef} />
        <button className="btn secondary" id="sendBtn" onClick={handleSend}>
          Send
        </button>
      </div>
    </section>
  );
}