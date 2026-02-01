import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email || !password || !name) {
      setStatus('All profile fields are required.');
      return;
    }
    setIsSubmitting(true);
    setStatus('Creating neural profile…');
    const { error } = await signUp(email, password, { display_name: name });
    if (error) {
      setStatus(error.message || 'Sign up failed.');
      setIsSubmitting(false);
      return;
    }
    setStatus('Profile created! Redirecting to your workspace…');
    setTimeout(() => {
      navigate('/home', { replace: true });
    }, 1200);
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
            <span className="gradient-text">Create Profile</span>
            <span className="subtitle">Neural AI Access</span>
          </h1>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="signupName">
            Display Name
          </label>
          <div className="input-container">
            <input
              id="signupName"
              type="text"
              placeholder="Agent Zero"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="input-glow" />
          </div>

          <label className="field-label" htmlFor="signupEmail">
            Neural ID (Email)
          </label>
          <div className="input-container">
            <input
              id="signupEmail"
              type="email"
              placeholder="agent@neural.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <div className="input-glow" />
          </div>

          <label className="field-label" htmlFor="signupPassword">
            Access Key
          </label>
          <div className="input-container">
            <input
              id="signupPassword"
              type="password"
              placeholder="Choose a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <div className="input-glow" />
          </div>

          {status && <div className="auth-status">{status}</div>}

          <button className="primary-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Provisioning profile…' : 'Create Neural Profile'}
          </button>
          <Link className="link-btn" to="/login">
            Back to login
          </Link>
        </form>
      </div>
    </div>
  );
}
