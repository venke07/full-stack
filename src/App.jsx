import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { TutorialProvider } from './context/TutorialContext.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import GuidedTour from './components/GuidedTour.jsx';
import HomePage from './pages/Home.jsx';
import BuilderPage from './pages/Builder.jsx';
import CanvasPage from './pages/Canvas.jsx';
import ChatPage from './pages/Chat.jsx';
import MultiAgentChat from './pages/MultiAgentChat.jsx';
import VoiceChatPage from './pages/VoiceChat.jsx';
import AutonomousTask from './pages/AutonomousTask.jsx';
import AgentTemplates from './pages/AgentTemplates.jsx';
import TestingPlayground from './pages/TestingPlayground.jsx';
import FusionLab from './pages/FusionLab.jsx';
import EvolutionLab from './pages/EvolutionLab.jsx';
import LoginPage from './pages/Login.jsx';
import SignupPage from './pages/Signup.jsx';
import ProfilePage from './pages/Profile.jsx';
import ChangePasswordPage from './pages/ChangePassword.jsx';
import Analytics from './pages/Analytics.jsx';

function LandingRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
        <p>Checking your neural access…</p>
      </div>
    );
  }

  return <Navigate to={user ? '/home' : '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <TutorialProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/home"
            element={(
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            )}
          />
          <Route
            path="/builder"
            element={(
              <RequireAuth>
                <BuilderPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/canvas"
            element={(
              <RequireAuth>
                <CanvasPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/chat"
            element={(
              <RequireAuth>
                <ChatPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/multi-chat"
            element={(
              <RequireAuth>
                <MultiAgentChat />
              </RequireAuth>
            )}
          />
          <Route
            path="/voice-chat"
            element={(
              <RequireAuth>
                <VoiceChatPage />
              </RequireAuth>
            )}
          />
          <Route
            path="/autonomous"
            element={(
              <RequireAuth>
                <AutonomousTask />
              </RequireAuth>
            )}
          />
          <Route
            path="/templates"
            element={(
              <RequireAuth>
                <AgentTemplates />
              </RequireAuth>
            )}
          />
          <Route
            path="/testing"
            element={(
              <RequireAuth>
                <TestingPlayground />
              </RequireAuth>
            )}
          />
          <Route
            path="/fusion-lab"
            element={(
              <RequireAuth>
                <FusionLab />
              </RequireAuth>
            )}
          />
          <Route
            path="/evolution-lab"
            element={(
              <RequireAuth>
                <EvolutionLab />
              </RequireAuth>
            )}
          />
          <Route
            path="/profile"
            element={(
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            )}
          />
          <Route
            path="/change-password"
            element={(
              <RequireAuth>
                <ChangePasswordPage />
              </RequireAuth>
            )}
          />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <GuidedTour />
        </BrowserRouter>
      </TutorialProvider>
    </AuthProvider>
  );
}
