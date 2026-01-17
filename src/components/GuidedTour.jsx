import React, { useEffect, useState } from 'react';
import { useTutorial } from '../context/TutorialContext';
import { getTutorial } from '../lib/tutorialSteps';
import '../styles/GuidedTour.css';

const GuidedTour = () => {
  const {
    activeTutorial,
    currentStep,
    isTutorialOpen,
    nextStep,
    prevStep,
    completeTutorial,
    skipTutorial,
  } = useTutorial();

  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [highlightPos, setHighlightPos] = useState(null);

  useEffect(() => {
    if (!isTutorialOpen || !activeTutorial) {
      return;
    }

    const tutorial = getTutorial(activeTutorial);
    if (!tutorial) {
      return;
    }

    const step = tutorial.steps[currentStep];
    if (!step || !step.target) {
      return;
    }

    // Find the target element
    let targetElement = null;
    try {
      targetElement = document.querySelector(step.target);
    } catch (e) {
      console.warn(`Invalid selector: ${step.target}`);
    }

    if (targetElement && targetElement !== document.body) {
      const rect = targetElement.getBoundingClientRect();
      const highlightOffset = 8;

      // Calculate highlight position
      setHighlightPos({
        top: rect.top - highlightOffset,
        left: rect.left - highlightOffset,
        width: rect.width + highlightOffset * 2,
        height: rect.height + highlightOffset * 2,
      });

      // Calculate popover position based on placement
      let popoverTop = rect.top;
      let popoverLeft = rect.left;

      const popoverWidth = 350;
      const popoverHeight = 220;
      const offset = 20;

      switch (step.placement) {
        case 'top':
          popoverTop = rect.top - popoverHeight - offset;
          popoverLeft = rect.left + rect.width / 2 - popoverWidth / 2;
          break;
        case 'bottom':
          popoverTop = rect.bottom + offset;
          popoverLeft = rect.left + rect.width / 2 - popoverWidth / 2;
          break;
        case 'left':
          popoverTop = rect.top + rect.height / 2 - popoverHeight / 2;
          popoverLeft = rect.left - popoverWidth - offset;
          break;
        case 'right':
          popoverTop = rect.top + rect.height / 2 - popoverHeight / 2;
          popoverLeft = rect.right + offset;
          break;
        case 'center':
          popoverTop = window.innerHeight / 2 - popoverHeight / 2;
          popoverLeft = window.innerWidth / 2 - popoverWidth / 2;
          break;
        default:
          popoverTop = rect.bottom + offset;
          popoverLeft = rect.left + rect.width / 2 - popoverWidth / 2;
      }

      // Ensure popover stays in viewport
      if (popoverLeft < 10) popoverLeft = 10;
      if (popoverLeft + popoverWidth > window.innerWidth) {
        popoverLeft = window.innerWidth - popoverWidth - 10;
      }
      if (popoverTop < 10) popoverTop = 10;

      setPopoverPos({ top: popoverTop, left: popoverLeft });
    } else {
      // Center the popover if no target element
      setPopoverPos({
        top: window.innerHeight / 2 - 110,
        left: window.innerWidth / 2 - 175,
      });
      setHighlightPos(null);
    }
  }, [activeTutorial, currentStep, isTutorialOpen]);

  if (!isTutorialOpen || !activeTutorial) {
    return null;
  }

  const tutorial = getTutorial(activeTutorial);
  if (!tutorial) {
    return null;
  }

  const step = tutorial.steps[currentStep];
  if (!step) {
    return null;
  }

  const isLastStep = currentStep === tutorial.steps.length - 1;

  return (
    <div className="guided-tour-overlay">
      <div
        className={`guided-tour-popover placement-${step.placement}`}
        style={{
          top: `${popoverPos.top}px`,
          left: `${popoverPos.left}px`,
        }}
      >
        <div className="guided-tour-header">
          <h3>{tutorial.title}</h3>
          <button
            className="guided-tour-close"
            onClick={skipTutorial}
            aria-label="Close tutorial"
          >
            ×
          </button>
        </div>

        <div className="guided-tour-content">
          <p>{step.content}</p>
          <div className="guided-tour-progress">
            <span>{currentStep + 1} / {tutorial.steps.length}</span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${((currentStep + 1) / tutorial.steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="guided-tour-actions">
          <button
            className="guided-tour-btn btn-secondary"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            Previous
          </button>
          {isLastStep ? (
            <button className="guided-tour-btn btn-primary" onClick={completeTutorial}>
              Finish
            </button>
          ) : (
            <button className="guided-tour-btn btn-primary" onClick={nextStep}>
              Next
            </button>
          )}
        </div>
      </div>

      {/* Highlight the target element */}
      {highlightPos && (
        <div
          className="guided-tour-highlight"
          style={{
            top: `${highlightPos.top}px`,
            left: `${highlightPos.left}px`,
            width: `${highlightPos.width}px`,
            height: `${highlightPos.height}px`,
          }}
        />
      )}
    </div>
  );
};

export default GuidedTour;
