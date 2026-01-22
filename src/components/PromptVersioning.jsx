import React, { useState, useEffect } from 'react';
import './PromptVersioning.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const PromptVersioning = ({ agentId, currentPrompt, onVersionSelect }) => {
  const [versions, setVersions] = useState([]);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDescription, setNewVersionDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState(null);

  useEffect(() => {
    if (agentId) {
      loadVersions();
    }
  }, [agentId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/agents/${agentId}/prompt-versions`);
      const data = await res.json();
      if (data.versions) {
        setVersions(data.versions);
        const active = data.versions.find(v => v.is_active);
        setActiveVersionId(active?.id);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!newVersionName.trim()) {
      alert('Version name is required');
      return;
    }

    if (!currentPrompt || !currentPrompt.trim()) {
      alert('Please create or edit a prompt first before creating a version');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/agents/${agentId}/prompt-versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_name: newVersionName,
          prompt_text: currentPrompt,
          description: newVersionDescription,
          is_active: false,
        }),
      });

      const data = await res.json();
      if (data.version) {
        setVersions([data.version, ...versions]);
        setNewVersionName('');
        setNewVersionDescription('');
        setShowNewVersion(false);
      } else {
        throw new Error(data.error || 'Failed to create version');
      }
    } catch (error) {
      console.error('Error creating version:', error);
      alert(`Failed to create version: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (versionId) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/prompt-versions/${versionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      });

      const data = await res.json();
      if (data.version) {
        setVersions(versions.map(v => ({
          ...v,
          is_active: v.id === versionId,
        })));
        setActiveVersionId(versionId);
        if (onVersionSelect) {
          onVersionSelect(data.version);
        }
      }
    } catch (error) {
      console.error('Error setting active version:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVersion = async (versionId) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;

    try {
      setLoading(true);
      await fetch(`${API_URL}/api/prompt-versions/${versionId}`, {
        method: 'DELETE',
      });
      setVersions(versions.filter(v => v.id !== versionId));
    } catch (error) {
      console.error('Error deleting version:', error);
      alert('Failed to delete version');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="prompt-versioning">
      <div className="version-header">
        <h3>📝 Prompt Versions</h3>
        <button
          className="btn-primary btn-small"
          onClick={() => setShowNewVersion(!showNewVersion)}
          disabled={loading}
        >
          {showNewVersion ? '✕ Cancel' : '+ New Version'}
        </button>
      </div>

      {showNewVersion && (
        <div className="new-version-form">
          <input
            type="text"
            placeholder="Version name (e.g., 'v2 - More Concise')"
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.target.value)}
            className="version-input"
          />
          <textarea
            placeholder="Optional: Describe changes in this version"
            value={newVersionDescription}
            onChange={(e) => setNewVersionDescription(e.target.value)}
            className="version-textarea"
            rows="3"
          />
          <button
            className="btn-primary"
            onClick={handleCreateVersion}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Save as New Version'}
          </button>
        </div>
      )}

      <div className="versions-list">
        {versions.length === 0 ? (
          <p className="empty-message">No versions yet. Create your first version above.</p>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              className={`version-item ${version.is_active ? 'active' : ''}`}
            >
              <div className="version-info">
                <h4>{version.version_name}</h4>
                <p className="version-number">v{version.version_number}</p>
                {version.description && (
                  <p className="version-description">{version.description}</p>
                )}
                <p className="version-date">
                  {new Date(version.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="version-actions">
                {!version.is_active && (
                  <button
                    className="btn-secondary btn-small"
                    onClick={() => handleSetActive(version.id)}
                    disabled={loading}
                  >
                    Use This
                  </button>
                )}
                {version.is_active && (
                  <span className="badge badge-active">✓ Active</span>
                )}
                <button
                  className="btn-danger btn-small"
                  onClick={() => handleDeleteVersion(version.id)}
                  disabled={loading || version.is_active}
                  title={version.is_active ? 'Cannot delete active version' : ''}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PromptVersioning;
