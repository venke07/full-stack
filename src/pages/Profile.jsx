import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
      } else {
        setProfile(data);
      }

      setEmail(user.email || '');
      setLoading(false);
    };

    loadProfile();
  }, [user?.id]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          updated_at: new Date(),
        })
        .eq('id', user.id);

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage('✅ Profile updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: 'new_password_here',
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage('✅ Password updated successfully!');
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div style={{ padding: '40px', textAlign: 'center' }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Profile Settings</h1>
          <button onClick={() => navigate('/home')} className="btn ghost compact">
            ← Back to Home
          </button>
        </div>
      </header>

      <div className="profile-container">
        {message && (
          <div className={`status-message ${message.includes('✅') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {/* Profile Header Card */}
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-avatar">
              {email.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2>{email}</h2>
              <p className="muted">Aether Account</p>
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="profile-card">
          <h3>Account Information</h3>
          
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={email} 
              disabled 
              placeholder="Your email"
            />
            <p className="help">Your email address cannot be changed here. Contact support to update.</p>
          </div>

          <div className="form-group">
            <label>Account ID</label>
            <input 
              type="text" 
              value={user?.id || ''} 
              disabled 
              placeholder="Account ID"
            />
            <p className="help">Your unique Aether account identifier</p>
          </div>

          <div className="form-group">
            <label>Member Since</label>
            <input 
              type="text" 
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''} 
              disabled 
              placeholder="Join date"
            />
          </div>
        </div>

        {/* Security Settings */}
        <div className="profile-card">
          <h3>Security Settings</h3>
          
          <div className="security-section">
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 12px', fontWeight: '600' }}>Change Password</p>
              <p className="muted" style={{ marginBottom: '16px' }}>
                Update your access key to keep your account secure
              </p>
              <button 
                className="btn secondary"
                onClick={() => navigate('/change-password')}
              >
                🔐 Update Password
              </button>
            </div>
          </div>

          <div className="divider-line"></div>

          <div className="security-section">
            <p style={{ margin: '0 0 12px', fontWeight: '600' }}>Two-Factor Authentication</p>
            <p className="muted" style={{ marginBottom: '16px' }}>
              Add an extra layer of security to your account
            </p>
            <button className="btn secondary" disabled>
              Enable 2FA (Coming Soon)
            </button>
          </div>
        </div>

        {/* Preferences */}
        <div className="profile-card">
          <h3>Preferences</h3>
          
          <div className="preference-item">
            <div>
              <p style={{ margin: 0, fontWeight: '600' }}>Email Notifications</p>
              <p className="muted" style={{ margin: '4px 0 0' }}>Get notified about agent activities</p>
            </div>
            <button className="switch active" style={{ width: '50px' }}></button>
          </div>

          <div className="preference-item">
            <div>
              <p style={{ margin: 0, fontWeight: '600' }}>Theme</p>
              <p className="muted" style={{ margin: '4px 0 0' }}>Currently using Dark theme</p>
            </div>
            <span className="badge" style={{ padding: '6px 12px' }}>🌙 Dark</span>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="profile-card danger">
          <h3 style={{ color: '#ff9999' }}>Danger Zone</h3>
          
          <div style={{ marginBottom: '12px' }}>
            <p className="muted">Once you delete your account, there is no going back. Please be certain.</p>
          </div>

          <button 
            className="btn danger"
            onClick={() => {
              if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
                // Handle account deletion
              }
            }}
          >
            Delete Account
          </button>
        </div>

        {/* Sign Out */}
        <div style={{ textAlign: 'center', padding: '40px 20px', marginTop: '20px' }}>
          <button 
            className="btn secondary"
            onClick={() => {
              signOut();
              navigate('/login');
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}