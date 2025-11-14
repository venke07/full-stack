import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import DetailsCard from "./components/DetailsCard";
import PersonalityCard from "./components/PersonalityCard";
import ToolsCard from "./components/ToolsCard";
import Preview from "./components/Preview";
import FooterBar from "./components/FooterBar";
import mapRange from "./utils/mapRange";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001"; // FastAPI server

export default function App() {
  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");

  const [formality, setFormality] = useState(50);
  const [creativity, setCreativity] = useState(50);

  const [toggles, setToggles] = useState({
    web: false,
    rfd: false,
    deep: false,
  });

  const [modelPick, setModelPick] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  const formalityBadge = useMemo(
    () => mapRange(formality, ["Casual", "Warm", "Neutral", "Confident", "Professional"]),
    [formality]
  );
  const creativityBadge = useMemo(
    () => mapRange(creativity, ["Strictly factual", "Grounded", "Balanced", "Exploratory", "Imaginative"]),
    [creativity]
  );

  const descCount = `${agentDesc.length}/280`;

  const [chat, setChat] = useState([
    {
      id: 1,
      who: "bot",
      text:
        "Hello! I'm your Business Analyst agent. I specialize in financial insights, market analysis, and business reporting. How can I assist you today?",
    },
    { id: 2, who: "me", text: "Summarize Q3 performance by product with key risks." },
  ]);

  const toggle = (key) => setToggles((t) => ({ ...t, [key]: !t[key] }));

  const chatInputRef = useRef(null);
  const chatBoxRef = useRef(null);

  // ----- Chat send (still mock for now) -----
  const handleSend = () => {
    const val = chatInputRef.current?.value?.trim();
    if (!val) return;
    const nextId = (chat.at(-1)?.id || 2) + 1;
    setChat((c) => [...c, { id: nextId, who: "me", text: val }]);
    if (chatInputRef.current) chatInputRef.current.value = "";
    setTimeout(() => {
      const replyText = `Got it. I will analyze this using the enabled tools${
        toggles.web ? " (web search on)" : ""
      }${toggles.rfd ? " and your uploaded sources" : ""}.`;
      const nextId2 = nextId + 1;
      setChat((c) => [...c, { id: nextId2, who: "bot", text: replyText }]);
    }, 300);
  };

  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [chat]);

  const handleFiles = (e) => {
    const files = [...e.target.files].map((f) => f.name).join(", ");
    if (files) alert("Added sources: " + files);
  };

  const onDiscard = () => {
    if (window.confirm("Discard all changes?")) {
      window.location.reload();
    }
  };

  const onSave = () => alert("Draft saved locally. (Wire up to your backend)");

  const buildPayload = () => ({
    agentName: agentName.trim(),
    agentDesc: agentDesc.trim(),
    agentPrompt: agentPrompt.trim(),
    formality,
    creativity,
    toggles,
    modelPick,
  });

  // ---------- PUBLISH: build agent + redirect to chat.html ----------
  const onPublish = async () => {
    if (isPublishing) return;
    const payload = buildPayload();

    if (!payload.agentName) {
      alert("Give your agent a name before publishing.");
      return;
    }
    if (!payload.agentPrompt) {
      alert("Please provide a system prompt so the backend knows how to configure your agent.");
      return;
    }

    try {
      setIsPublishing(true);
      const res = await fetch(`${BACKEND_URL}/api/build-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.detail || "Failed to build agent");
      }

      sessionStorage.setItem(
        "latestAgent",
        JSON.stringify({
          ...payload,
          research_plan: data.research_plan || null,
          createdAt: new Date().toISOString(),
        })
      );

      const encoded = encodeURIComponent(payload.agentName || "My Agent");
      window.location.href = `/chat.html?agent=${encoded}`;
    } catch (err) {
      console.error(err);
      alert("Error publishing agent: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };
  // ---------- Simple test: call /api/model-research (non-streaming for now) ----------
  const handleModelResearch = async () => {
    if (!agentPrompt.trim()) {
      alert("Please enter a system prompt first.");
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/model-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: agentPrompt, streaming: false }),
      });
      const data = await res.json();
      console.log("Model research result:", data);

      const nextId = (chat.at(-1)?.id || 2) + 1;
      setChat((c) => [
        ...c,
        {
          id: nextId,
          who: "bot",
          text:
            "Model research result:\n" +
            JSON.stringify(data.data || data, null, 2),
        },
      ]);
    } catch (err) {
      console.error("Error:", err);
      alert("Error calling model research: " + err.message);
    }
  };

  // ---------- Optional: separate build-agent test button ----------
  const onBuildAgent = async () => {
    const payload = buildPayload();

    try {
      const response = await fetch(`${BACKEND_URL}/api/build-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.ok) {
        alert("Agent built successfully! Research Plan: " + JSON.stringify(data.research_plan));
      } else {
        alert("Failed to build agent.");
      }
    } catch (error) {
      console.error("Error building agent:", error);
      alert("Error building agent: " + error.message);
    }
  };

  return (
    <div className="app">
      <Header />
      <div className="grid">
        <DetailsCard
          agentName={agentName}
          setAgentName={setAgentName}
          agentDesc={agentDesc}
          setAgentDesc={setAgentDesc}
          agentPrompt={agentPrompt}
          setAgentPrompt={setAgentPrompt}
          descCount={descCount}
          toggles={toggles}
          toggle={toggle}
        />

        <div className="card">
          <div className="inner">
            <PersonalityCard
              formality={formality}
              setFormality={setFormality}
              formalityBadge={formalityBadge}
              creativity={creativity}
              setCreativity={setCreativity}
              creativityBadge={creativityBadge}
            />

            <ToolsCard
              toggles={toggles}
              toggle={toggle}
              modelPick={modelPick}
              setModelPick={setModelPick}
              handleFiles={handleFiles}
            />
          </div>
        </div>

        <Preview
          chat={chat}
          chatBoxRef={chatBoxRef}
          chatInputRef={chatInputRef}
          handleSend={handleSend}
          dynamicIntro={`You are chatting with ${agentName.trim() || "your agent"}. I aim for a ${formalityBadge.toLowerCase()} tone. ${
            agentDesc.trim() || ""
          }`}
        />
      </div>

      <FooterBar onDiscard={onDiscard} onSave={onSave} onPublish={onPublish} />

      {/* Temporary test buttons */}
      <div style={{ marginTop: "16px" }}>
        <button onClick={handleModelResearch}>Test Model Research</button>
        <button onClick={onBuildAgent} style={{ marginLeft: 8 }}>
          Test Build Agent
        </button>
      </div>
    </div>
  );
}
