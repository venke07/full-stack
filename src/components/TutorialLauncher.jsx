import React from 'react';
import { useTutorial } from '../context/TutorialContext';
import { getAllTutorials } from '../lib/tutorialSteps';
import '../styles/TutorialLauncher.css';

const TutorialLauncher = () => {
  const { startTutorial } = useTutorial();
  const [showMenu, setShowMenu] = React.useState(false);

  const tutorials = getAllTutorials();

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
                onClick={() => {
                  startTutorial(tutorial.id);
                  setShowMenu(false);
                }}
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
