import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AgentDashboard from "./AgentDashboard";
import MultiAgentChat from './pages/MultiAgentChat';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AgentDashboard />} />
        <Route path="/multi-chat" element={<MultiAgentChat />} />
      </Routes>
    </Router>
  );
}

export default App;
