import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Marketplace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('downloads');

  useEffect(() => {
    loadMarketplaceAgents();
  }, [search, selectedTags, sortBy]);

  const loadMarketplaceAgents = async () => {
    try {
      const params = new URLSearchParams({
        search,
        tags: selectedTags.join(','),
        sort: sortBy
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/marketplace/agents?${params}`);
      const data = await response.json();

      if (data.success) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error('Failed to load marketplace:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFork = async (agentId) => {
    if (!user) {
      alert('Please log in to export agents');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/marketplace/fork/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      if (data.success) {
        alert('Agent exported successfully! Redirecting to import page...');
        navigate('/import');  // Redirect to import page
      }
    } catch (error) {
      console.error('Fork failed:', error);
    }
  };

  const handleRate = async (agentId, rating, review) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/marketplace/rate/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, review })
      });

      const data = await response.json();
      if (data.success) {
        loadMarketplaceAgents(); // Refresh ratings
      }
    } catch (error) {
      console.error('Rating failed:', error);
    }
  };

  if (loading) return <div>Loading marketplace...</div>;

  return (
    <div className="marketplace-page">
      <header>
        <h1>Agent Marketplace</h1>
        <p>Discover and fork amazing AI agents built by the community</p>
      </header>

      <div className="marketplace-filters">
        <input
          type="text"
          placeholder="Search agents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="downloads">Most Popular</option>
          <option value="rating">Highest Rated</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <div className="marketplace-grid">
        {agents.map(agent => (
          <div key={agent.id} className="agent-card">
            <div className="agent-header">
              <h3>{agent.name}</h3>
              <div className="agent-rating">
                ⭐ {agent.average_rating?.toFixed(1) || '0.0'} 
                ({agent.ratings?.length || 0} reviews)
              </div>
            </div>
            
            <p className="agent-description">{agent.description}</p>
            
            <div className="agent-stats">
              <span>📥 {agent.downloads} downloads</span>
              <span>🔀 {agent.fork_count || 0} forks</span>
            </div>

            <div className="agent-tags">
              {agent.tags?.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>

            <div className="agent-actions">
              <button 
                onClick={() => handleFork(agent.id)}
                disabled={!user}
                className="fork-btn"
              >
                {user ? 'Fork Agent' : 'Login to Fork'}
              </button>
              
              {user && (
                <RatingModal 
                  agentId={agent.id} 
                  onRate={(rating, review) => handleRate(agent.id, rating, review)}
                />
              )}
              <button 
                onClick={() => navigate(`/marketplace/${agent.id}`)}  // Optional: detailed view page
                className="view-btn"
              >
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple rating modal component
function RatingModal({ agentId, onRate }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [showModal, setShowModal] = useState(false);

  const submitRating = () => {
    onRate(rating, review);
    setShowModal(false);
    setReview('');
  };

  return (
    <>
      <button onClick={() => setShowModal(true)} className="rate-btn">
        Rate Agent
      </button>
      
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Rate this Agent</h3>
            <div className="rating-stars">
              {[1,2,3,4,5].map(star => (
                <span 
                  key={star}
                  onClick={() => setRating(star)}
                  className={star <= rating ? 'active' : ''}
                >
                  ⭐
                </span>
              ))}
            </div>
            <textarea
              placeholder="Write a review (optional)"
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
            <div className="modal-actions">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={submitRating}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}