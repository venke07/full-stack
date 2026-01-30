import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTutorial } from '../context/TutorialContext';
import { getAllTutorials, getTutorial } from '../lib/tutorialSteps';
import '../styles/TutorialLauncher.css';

const TutorialLauncher = () => {
  const navigate = useNavigate();
  const { startTutorial } = useTutorial();
  const [showMenu, setShowMenu] = React.useState(false);
  const [showModeModal, setShowModeModal] = React.useState(false);
  const [selectedTutorialId, setSelectedTutorialId] = React.useState(null);

  const tutorials = getAllTutorials();

  const handleTutorialClick = (tutorialId) => {
    setSelectedTutorialId(tutorialId);
    setShowMenu(false);
    setShowModeModal(true);
  };

  const startWithMode = (voiceEnabled) => {
    const tutorial = getTutorial(selectedTutorialId);
    setShowModeModal(false);
    
    // If tutorial has a route, navigate to it first
    if (tutorial?.route) {
      navigate(tutorial.route);
      // Give the page time to load, then start the tutorial
      setTimeout(() => {
        startTutorial(selectedTutorialId, voiceEnabled);
      }, 500);
    } else {
      // Start tutorial immediately if no route
      startTutorial(selectedTutorialId, voiceEnabled);
    }
  };

  const selectedTutorial = selectedTutorialId ? getTutorial(selectedTutorialId) : null;

  return (
    <div className="tutorial-launcher">
      <button
        className="tutorial-launcher-btn"
        onClick={() => setShowMenu(!showMenu)}
        title="Start a guided tour"
      >
        ❓
      </button>

      {showMenu && (
        <div className="tutorial-menu">
          <div className="tutorial-menu-header">
            <h3>Guided Tours</h3>
            <button
              className="tutorial-menu-close"
              onClick={() => setShowMenu(false)}
            >
              ×
            </button>
          </div>
          <div className="tutorial-menu-list">
            {tutorials.map((tutorial) => (
              <button
                key={tutorial.id}
                className="tutorial-menu-item"
                onClick={() => handleTutorialClick(tutorial.id)}
              >
                <div className="tutorial-menu-item-title">{tutorial.title}</div>
                <div className="tutorial-menu-item-meta">
                  <span className="tutorial-duration">{tutorial.duration}</span>
                  <span className={`tutorial-difficulty ${tutorial.difficulty}`}>
                    {tutorial.difficulty}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* this is to select the tutorial mode */}
      {showModeModal && (
        <div className="tutorial-mode-overlay" onClick={() => setShowModeModal(false)}>
          <div className="tutorial-mode-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="tutorial-mode-close"
              onClick={() => setShowModeModal(false)}
            >
              ×
            </button>
            
            <div className="tutorial-mode-header">
              <h2>How would you like to learn?</h2>
              {selectedTutorial && (
                <p className="tutorial-mode-subtitle">
                  {selectedTutorial.title}
                </p>
              )}
            </div>

            <div className="tutorial-mode-options">
              <button 
                className="tutorial-mode-option voice-option"
                onClick={() => startWithMode(true)}
              >
                <div className="mode-icon">🔊</div>
                <div className="mode-info">
                  <h3>Voice-Guided</h3>
                  <p>AI narrates each step aloud while you follow along visually</p>
                </div>
                <div className="mode-badge">Interactive</div>
              </button>

              <button 
                className="tutorial-mode-option text-option"
                onClick={() => startWithMode(false)}
              >
                <div className="mode-icon">📖</div>
                <div className="mode-info">
                  <h3>Text Only</h3>
                  <p>Read through each step at your own pace quietly</p>
                </div>
                <div className="mode-badge">Classic</div>
              </button>
            </div>

            <p className="tutorial-mode-hint">
              💡 Voice-guided works best with speakers or headphones
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialLauncher;
