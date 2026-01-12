import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from?.pathname ?? '/home';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/home', { replace: true });
    }
  }, [loading, user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setStatus('Aether ID and Access Key are required.');
      return;
    }
    setIsSubmitting(true);
    setStatus('Initializing Aether link…');
    const { error } = await signIn(email, password);
    if (error) {
      setStatus(error.message || 'Access denied.');
      setIsSubmitting(false);
      return;
    }
    setStatus('Aether link established. Redirecting…');
    navigate(redirectPath, { replace: true });
  };

  return (
    <div className="auth-shell">
      <div className="neural-background">
        <div className="neural-grid" />
        <div className="floating-particles" />
      </div>
      <div className="auth-panel">
        <div className="auth-header">
          <div className="neural-logo">
            <div className="core-node" />
            <div className="connection-ring" />
            <div className="pulse-ring" />
          </div>
          <h1 className="portal-title">
            <span className="gradient-text">Aether Access</span>
            <span className="subtitle">AI Agent Portal</span>
          </h1>
          <div className="status-indicator">
            <div className="status-dot" />
            <span>System Online</span>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="loginEmail">
            Aether ID
          </label>
          <div className="input-container">
            <input
              id="loginEmail"
              type="email"
              placeholder="agent@aether.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <div className="input-glow" />
          </div>

          <label className="field-label" htmlFor="loginPassword">
            Access Key
          </label>
          <div className="input-container">
            <input
              id="loginPassword"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <div className="input-glow" />
          </div>

          {status && <div className="auth-status">{status}</div>}

          <button className="primary-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Establishing connection…' : 'Initialize Connection'}
          </button>
          <button
            className="secondary-btn"
            type="button"
            onClick={() => navigate('/signup')}
            disabled={isSubmitting}
          >
            Create Aether Profile
          </button>
        </form>

        <div className="auth-footer">
          <div className="encryption-badge">
            <span role="img" aria-label="lock">
              🔐
            </span>
            <span>256-bit Aether Encryption</span>
          </div>
          <div>
            Need help? <Link to="/signup">Contact Aether ops</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
