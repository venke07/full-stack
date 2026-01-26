import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTutorial } from '../context/TutorialContext';
import { getAllTutorials, getTutorial } from '../lib/tutorialSteps';
import '../styles/TutorialLauncher.css';

const TutorialLauncher = () => {
  const navigate = useNavigate();
  const { startTutorial } = useTutorial();
  const [showMenu, setShowMenu] = React.useState(false);

  const tutorials = getAllTutorials();

  const handleTutorialClick = (tutorialId) => {
    const tutorial = getTutorial(tutorialId);
    
    // If tutorial has a route, navigate to it first
    if (tutorial?.route) {
      navigate(tutorial.route);
      // Give the page time to mount, then start the tutorial
      setTimeout(() => {
        startTutorial(tutorialId);
      }, 500);
    } else {
      // Start tutorial immediately if no route
      startTutorial(tutorialId);
    }
    
    setShowMenu(false);
  };

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
    </div>
  );
};

export default TutorialLauncher;
