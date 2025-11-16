import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "./components/Header";
import DetailsCard from "./components/DetailsCard";
import PersonalityCard from "./components/PersonalityCard";
import ToolsCard from "./components/ToolsCard";
import Preview from "./components/Preview";
import FooterBar from "./components/FooterBar";
import mapRange from "./utils/mapRange";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000"; // FastAPI server

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

  const [modelPick, setModelPick] = useState("openai");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isTestingAgent, setIsTestingAgent] = useState(false);
  const [isChatReady, setIsChatReady] = useState(false);
  const [chatStatus, setChatStatus] = useState('Click "Test Build Agent" to try a live preview.');
  const [isSending, setIsSending] = useState(false);

  const formalityBadge = useMemo(
    () => mapRange(formality, ["Casual", "Warm", "Neutral", "Confident", "Professional"]),
    [formality]
  );
  const creativityBadge = useMemo(
    () => mapRange(creativity, ["Strictly factual", "Grounded", "Balanced", "Exploratory", "Imaginative"]),
    [creativity]
  );

  const descCount = `${agentDesc.length}/280`;

  const [chat, setChat] = useState([]);

  const toggle = (key) => setToggles((t) => ({ ...t, [key]: !t[key] }));

  const chatInputRef = useRef(null);
  const chatBoxRef = useRef(null);

  const providerLabels = {
    openai: "OpenAI",
    gemini: "Google Gemini",
    tavily: "Tavily AI",
  };

  const formatModelReply = (result) => {
    if (!result) return "I wasn't able to craft a response.";
    const payload = result.data ?? result;
    if (typeof payload === "string") return payload;
    if (payload.summary) return payload.summary;
    if (Array.isArray(payload.recommendations)) {
      return payload.recommendations
        .map((item, idx) => `${idx + 1}. ${item.title || item.name || "Suggestion"}\n${item.description || ""}`)
        .join("\n\n");
    }
    return JSON.stringify(payload, null, 2);
  };

  const appendBotMessage = (text) => {
    setChat((prev) => {
      const nextId = (prev.at(-1)?.id || 0) + 1;
      return [...prev, { id: nextId, who: "bot", text }];
    });
  };

  const handleSend = async () => {
    const val = chatInputRef.current?.value?.trim();
    if (!val || !isChatReady) return;
    setChat((c) => {
      const nextId = (c.at(-1)?.id || 0) + 1;
      return [...c, { id: nextId, who: "me", text: val }];
    });
    if (chatInputRef.current) chatInputRef.current.value = "";

    try {
      setIsSending(true);
      const res = await fetch(`${BACKEND_URL}/api/model-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${agentPrompt || "You are a helpful agent."}\n\nUser ask: ${val}`,
          streaming: false,
          provider: modelPick,
        }),
      });
      if (!res.ok) {
        throw new Error("Model research endpoint returned an error.");
      }
      const data = await res.json();
      appendBotMessage(formatModelReply(data));
      setChatStatus("Connected to preview chat.");
    } catch (err) {
      appendBotMessage(`I ran into an error responding: ${err.message}`);
      setChatStatus(`Chat error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
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
    setIsPublishing(true);
    try {
      const payload = buildPayload();
      if (!payload.agentPrompt) {
        alert("Please provide a system prompt before publishing.");
        return;
      }

      setChatStatus("Publishing agent...");
      
      const response = await fetch(`${BACKEND_URL}/api/build-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.detail || "Failed to publish agent.");
      }

      const agentId = data.agent_id;
      sessionStorage.setItem("publishedAgentId", agentId);
      
      // Initialize chat in preview AFTER publishing
      const friendlyName = payload.agentName.trim() || "your agent";
      const summary = payload.agentDesc.trim() || "I can help with research and insights.";
      const provider = providerLabels[payload.modelPick] || "your configured provider";
      
      setChat([
        { id: 1, who: "bot", text: `Hello! I'm ${friendlyName}. ${summary}`.trim() },
        { id: 2, who: "bot", text: `I'm online via ${provider}. Ask me something!` },
      ]);
      setIsChatReady(true);
      
      setChatStatus(`✅ Agent published successfully! ID: ${agentId}. You can chat below.`);
    } catch (error) {
      console.error("Publish error:", error);
      setChatStatus("❌ Failed to publish: " + error.message);
      alert("Error publishing agent: " + error.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // NEW: Go to Chat Interface
  const onGoToChatInterface = () => {
    const agentId = sessionStorage.getItem("publishedAgentId");
    
    if (!agentId) {
      alert("Please publish an agent first!");
      return;
    }

    window.location.href = `http://localhost:3001/?agentId=${agentId}`;
  };

  // ---------- Optional: separate build-agent test button ----------
  const onBuildAgent = async () => {
    const payload = buildPayload();
    if (!payload.agentPrompt) {
      alert("Please provide a system prompt before starting a test chat.");
      return;
    }

    try {
      setIsTestingAgent(true);
      setChatStatus("Connecting to preview chat...");
      const response = await fetch(`${BACKEND_URL}/api/build-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.detail || "Failed to build agent.");
      }
      const friendlyName = agentName.trim() || "your agent";
      const summary = agentDesc.trim() || "I can help with research and insights.";
      const provider = providerLabels[modelPick] || "your configured provider";
      setChat([
        { id: 1, who: "bot", text: `Hello! I'm ${friendlyName}. ${summary}`.trim() },
        { id: 2, who: "bot", text: `I'm online via ${provider}. Ask me something!` },
      ]);
      setIsChatReady(true);
      setChatStatus("Test chat ready. Ask a question in the preview panel.");
    } catch (error) {
      console.error("Error building agent:", error);
      setChatStatus("Unable to start test chat: " + error.message);
      alert("Error building agent: " + error.message);
    } finally {
      setIsTestingAgent(false);
    }
  };

  useEffect(() => {
    const friendlyName = agentName.trim() || "your agent";
    const summary = agentDesc.trim() || "I can help with research and analysis.";
    setChat([
      { id: 1, who: "bot", text: `Hello! I'm ${friendlyName}. ${summary}`.trim() },
      { id: 2, who: "bot", text: "Adjust your settings and click Test Build Agent to start chatting." },
    ]);
    setIsChatReady(false);
    setChatStatus('Settings changed. Click "Test Build Agent" to refresh the preview chat.');
  }, [agentName, agentDesc, agentPrompt, formality, creativity, modelPick, toggles.web, toggles.rfd, toggles.deep]);

  useEffect(() => {
    document.documentElement.style.colorScheme = 'dark';
  }, []);

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
          chatReady={isChatReady}
          chatStatus={chatStatus}
          isSending={isSending}
        />
      </div>

      <FooterBar 
        onDiscard={onDiscard} 
        onSave={onSave} 
        onPublish={onPublish}
        onGoToChatInterface={onGoToChatInterface}
      />

      <div className="test-actions">
        <button className="btn secondary" onClick={onBuildAgent} disabled={isTestingAgent}>
          {isTestingAgent ? "Connecting..." : isChatReady ? "Refresh Test Chat" : "Test Build Agent"}
        </button>
      </div>
    </div>
  );
}
