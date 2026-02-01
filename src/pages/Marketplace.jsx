import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/Marketplace.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

      const response = await fetch(`${API_URL}/api/marketplace/agents?${params}`);
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
      const response = await fetch(`${API_URL}/api/marketplace/fork/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
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
    if (!user) {
      throw new Error('Please log in to rate agents.');
    }
    try {
      const response = await fetch(`${API_URL}/api/marketplace/rate/${agentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, review, userId: user.id })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error || 'Rating failed.');
      }
      loadMarketplaceAgents();
    } catch (error) {
      console.error('Rating failed:', error);
      throw error;
    }
  };

  if (loading) return <div>Loading marketplace...</div>;

  return (
    <div className="marketplace-page">
      <header>
        <Link className="btn ghost" to="/home">← Back to dashboard</Link>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submitRating = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await onRate(rating, review);
      setShowModal(false);
      setReview('');
    } catch (err) {
      setError(err.message || 'Unable to submit rating.');
    } finally {
      setIsSubmitting(false);
    }
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
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={star <= rating ? 'active' : ''}
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              placeholder="Write a review (optional)"
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
            {error && <p className="rating-error">{error}</p>}
            <div className="modal-actions">
              <button onClick={() => setShowModal(false)}>Cancel</button>
              <button onClick={submitRating} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}