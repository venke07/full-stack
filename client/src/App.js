import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import History from "./components/history/history";
import ChatSummary from "./components/chat-summary/chat-summary";
import UsageDashboard from "./components/usage-dashboard/usageDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* default route */}
        <Route path="/" element={<History />} />

        {/* optional alias */}
        <Route path="/history" element={<History />} />

        {/* your chat summary page */}
        <Route path="/chat-summary" element={<ChatSummary />} />

        {/* usage dashboard */}
        <Route path="/usage-dashboard" element={<UsageDashboard />} />

        {/* fallback: anything else goes home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
