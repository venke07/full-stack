import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage('');

    // Validation
    if (!currentPassword.trim()) {
      setMessage('Current Access Key is required');
      return;
    }
    if (!newPassword.trim()) {
      setMessage('New Access Key is required');
      return;
    }
    if (newPassword.length < 8) {
      setMessage('New Access Key must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('Access Keys do not match');
      return;
    }
    if (newPassword === currentPassword) {
      setMessage('New Access Key must be different from current');
      return;
    }

    setIsLoading(true);

    try {
      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setMessage('Current Access Key is incorrect');
        setIsLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setMessage(`Error: ${updateError.message}`);
        setIsLoading(false);
        return;
      }

      setMessage('✅ Access Key updated successfully! Redirecting...');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
    } catch (error) {
      console.error('Error changing password:', error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <header style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Change Access Key</h1>
          <button onClick={() => navigate('/profile')} className="btn ghost compact">
            ← Back to Profile
          </button>
        </div>
      </header>

      <div className="profile-container">
        <div className="profile-card">
          <h3>Update Your Access Key</h3>
          <p className="muted">Enter your current Access Key and choose a new one</p>

          {message && (
            <div className={`status-message ${message.includes('✅') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleChangePassword} style={{ marginTop: '24px' }}>
            <div className="form-group">
              <label htmlFor="current-password">Current Access Key *</label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
              />
              <p className="help">Enter your current password to verify your identity</p>
            </div>

            <div className="form-group">
              <label htmlFor="new-password">New Access Key *</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
              />
              <p className="help">Minimum 8 characters. Use a strong combination of letters, numbers, and symbols.</p>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm New Access Key *</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
              />
              <p className="help">Re-enter your new Access Key to confirm</p>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button
                type="submit"
                className="btn primary"
                disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {isLoading ? '⏳ Updating...' : '🔒 Update Access Key'}
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => navigate('/profile')}
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Password Requirements */}
        <div className="profile-card">
          <h3>Security Tips</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span>✓</span>
              <p style={{ margin: 0, color: 'var(--muted)' }}>Use at least 8 characters</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span>✓</span>
              <p style={{ margin: 0, color: 'var(--muted)' }}>Mix uppercase and lowercase letters</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span>✓</span>
              <p style={{ margin: 0, color: 'var(--muted)' }}>Include numbers and symbols</p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span>✓</span>
              <p style={{ margin: 0, color: 'var(--muted)' }}>Avoid common words or personal info</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}