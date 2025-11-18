import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import HomePage from './pages/Home.jsx';
import BuilderPage from './pages/Builder.jsx';
import CanvasPage from './pages/Canvas.jsx';
import ChatPage from './pages/Chat.jsx';
import MultiAgentChat from './pages/MultiAgentChat.jsx';
import LoginPage from './pages/Login.jsx';
import SignupPage from './pages/Signup.jsx';

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
