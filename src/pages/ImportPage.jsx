import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../../config/supabaseClient';  // Adjust path if needed
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

export default function ImportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [forkedAgents, setForkedAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadForkedAgents();
    }
  }, [user]);

  const loadForkedAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_personas')
        .select('id, name, description, forked_from, created_at')
        .eq('user_id', user.id)
        .not('forked_from', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setForkedAgents(data || []);
    } catch (error) {
      console.error('Failed to load forked agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = (agentId) => {
    // Navigate to builder and pre-select the agent
    navigate(`/builder?import=${agentId}`);
  };

  const headerContent = (
    <div className="page-heading">
      <h1>Import Agents</h1>
      <p>Manage agents you've exported from the marketplace</p>
    </div>
  );

  return (
    <DashboardLayout headerContent={headerContent}>
      <div className="import-page">
        {loading ? (
          <p>Loading exported agents...</p>
        ) : forkedAgents.length === 0 ? (
          <div className="empty-state">
            <p>No exported agents yet. Visit the <a href="/marketplace">Marketplace</a> to export some!</p>
          </div>
        ) : (
          <div className="forked-agents-grid">
            {forkedAgents.map(agent => (
              <div key={agent.id} className="agent-card">
                <h3>{agent.name}</h3>
                <p>{agent.description}</p>
                <small>Exported on {new Date(agent.created_at).toLocaleDateString()}</small>
                <button 
                  onClick={() => handleImport(agent.id)}
                  className="btn primary"
                >
                  Import to Builder
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}