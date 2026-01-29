import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentTemplates, categories, getTemplatesByCategory } from '../data/agentTemplates';
import { supabase } from '../lib/supabaseClient.js';
import { getModelMeta } from '../lib/modelOptions.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function AgentTemplates() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(null);
  const navigate = useNavigate();

  const filteredTemplates = getTemplatesByCategory(selectedCategory).filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleImportTemplate = async (template) => {
    setImporting(template.id);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('Please log in to create agents');
        navigate('/login');
        return;
      }

      // Get model metadata
      const modelMeta = getModelMeta(template.model);
      
      if (!modelMeta) {
        throw new Error(`Invalid model: ${template.model}`);
      }

      // Create agent from template
      const agentData = {
        user_id: user.id,
        name: template.name,
        description: template.description,
        system_prompt: template.systemPrompt,
        status: 'draft',
        guardrails: { factual: true, opinions: true },
        sliders: { formality: 50, creativity: 50 },
        tools: { web: true, rfd: false, deep: false },
        model_id: template.model,
        model_label: modelMeta.label,
        model_provider: modelMeta.provider,
        model_env_key: modelMeta.envKey,
        created_at: new Date().toISOString(),
      };

      const { data: newAgent, error } = await supabase
        .from('agent_personas')
        .insert([agentData]);

      if (error) {
        throw error;
      }

      alert(`✅ "${template.name}" has been added to your drafts!`);
      navigate('/home');
    } catch (error) {
      console.error('Failed to import template:', error);
      console.error('Error details:', error.message);
      alert('Failed to import template. Please try again.');
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="logo">AI</div>
          <div>
            <h1>Agent Templates</h1>
            <div className="sub">Pre-built agents ready to use</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn ghost compact" onClick={() => navigate('/home')}>
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
        {/* Search and Filter */}
        <div className="templates-controls">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="category-filters">
            {categories.map((category) => (
              <button
                key={category}
                className={`category-chip ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <div className="templates-grid">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="template-card" style={{ borderTopColor: template.color }}>
              <div className="template-header">
                <div className="template-icon" style={{ background: `${template.color}20` }}>
                  {template.icon}
                </div>
                <div className="template-category">{template.category}</div>
              </div>

              <h3 className="template-name">{template.name}</h3>
              <p className="template-description">{template.description}</p>

              <div className="template-meta">
                <div className="template-model">
                  <span className="meta-label">Model:</span>
                  <span className="meta-value">{template.model}</span>
                </div>
                <div className="template-temp">
                  <span className="meta-label">Temp:</span>
                  <span className="meta-value">{template.temperature}</span>
                </div>
              </div>

              {template.tools.length > 0 && (
                <div className="template-tools">
                  <span className="tools-label">🛠️ Tools:</span>
                  <div className="tools-list">
                    {template.tools.map((tool) => (
                      <span key={tool} className="tool-badge">{tool}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="template-tags">
                {template.tags.map((tag) => (
                  <span key={tag} className="tag-badge">#{tag}</span>
                ))}
              </div>

              <button
                className="btn primary"
                onClick={() => handleImportTemplate(template)}
                disabled={importing === template.id}
                style={{ width: '100%', marginTop: 'auto' }}
              >
                {importing === template.id ? '⏳ Importing...' : '➕ Use This Template'}
              </button>
            </div>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔍</div>
            <h3>No templates found</h3>
            <p className="muted">Try adjusting your search or filter</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .templates-controls {
          margin: 30px 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .search-box {
          position: relative;
          max-width: 500px;
        }

        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 18px;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px 12px 48px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: inherit;
          font-size: 15px;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: rgba(122, 240, 213, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        .category-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .category-chip {
          padding: 8px 18px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
          color: inherit;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .category-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .category-chip.active {
          background: rgba(122, 240, 213, 0.2);
          border-color: rgba(122, 240, 213, 0.5);
          color: rgba(122, 240, 213, 1);
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
        }

        .template-card {
          display: flex;
          flex-direction: column;
          padding: 24px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top: 3px solid;
          background: rgba(255, 255, 255, 0.03);
          transition: all 0.3s ease;
        }

        .template-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .template-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .template-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
        }

        .template-category {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.6);
        }

        .template-name {
          font-size: 20px;
          margin: 0 0 12px 0;
          font-weight: 600;
        }

        .template-description {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 16px;
          flex-grow: 1;
        }

        .template-meta {
          display: flex;
          gap: 20px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          margin-bottom: 12px;
          font-size: 13px;
        }

        .meta-label {
          color: var(--muted);
          margin-right: 6px;
        }

        .meta-value {
          font-weight: 600;
          color: rgba(122, 240, 213, 0.9);
        }

        .template-tools {
          margin-bottom: 12px;
          padding: 10px 12px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
        }

        .tools-label {
          font-size: 12px;
          font-weight: 600;
          display: block;
          margin-bottom: 6px;
        }

        .tools-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tool-badge {
          font-size: 11px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .template-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 16px;
        }

        .tag-badge {
          font-size: 11px;
          padding: 4px 8px;
          background: rgba(122, 240, 213, 0.1);
          color: rgba(122, 240, 213, 0.9);
          border-radius: 6px;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .templates-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
