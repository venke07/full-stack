import React, { useEffect, useState, useRef } from 'react';
import { useTutorial } from '../context/TutorialContext';
import { getTutorial } from '../lib/tutorialSteps';
import '../styles/GuidedTour.css';

const GuidedTour = () => {
  const {
    activeTutorial,
    currentStep,
    isTutorialOpen,
    isVoiceMode,
    currentQuizAnswer,
    quizSubmitted,
    isCorrect,
    taskCompleted,
    nextStep,
    prevStep,
    completeTutorial,
    skipTutorial,
    setIsVoiceMode,
    setCurrentQuizAnswer,
    submitQuizAnswer,
    completeTask,
    isTaskComplete,
  } = useTutorial();

  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [highlightPos, setHighlightPos] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef(null);

  // Speak the current step content
  const speakStep = (text) => {
    if (!isVoiceMode || !text) return;
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Toggle voice mode
  const toggleVoiceMode = () => {
    if (isVoiceMode) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setIsVoiceMode(!isVoiceMode);
  };

  // Speak when step changes (in voice mode)
  useEffect(() => {
    if (isVoiceMode && isTutorialOpen && activeTutorial) {
      const tutorial = getTutorial(activeTutorial);
      const step = tutorial?.steps[currentStep];
      if (step?.content) {
        setTimeout(() => speakStep(step.content), 300);
      }
    }
    
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [currentStep, isVoiceMode, isTutorialOpen, activeTutorial]);

  const updatePositions = () => {
    if (!isTutorialOpen || !activeTutorial) return;

    const tutorial = getTutorial(activeTutorial);
    if (!tutorial) return;

    const step = tutorial.steps[currentStep];
    if (!step || !step.target) return;

    let targetElement = null;
    try {
      targetElement = document.querySelector(step.target);
    } catch (e) {
      console.warn(`Invalid selector: ${step.target}`);
    }

    if (targetElement && targetElement !== document.body) {
      const rect = targetElement.getBoundingClientRect();
      const highlightOffset = 8;

      setHighlightPos({
        top: rect.top - highlightOffset,
        left: rect.left - highlightOffset,
        width: rect.width + highlightOffset * 2,
        height: rect.height + highlightOffset * 2,
      });

      let popoverTop = rect.top;
      let popoverLeft = rect.left;
      const popoverWidth = 400;
      const popoverHeight = 320;
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

      if (popoverLeft < 10) popoverLeft = 10;
      if (popoverLeft + popoverWidth > window.innerWidth) {
        popoverLeft = window.innerWidth - popoverWidth - 10;
      }
      if (popoverTop < 10) popoverTop = 10;
      if (popoverTop + popoverHeight > window.innerHeight) {
        popoverTop = window.innerHeight - popoverHeight - 10;
      }

      setPopoverPos({ top: popoverTop, left: popoverLeft });
    } else {
      setPopoverPos({
        top: window.innerHeight / 2 - 160,
        left: window.innerWidth / 2 - 200,
      });
      setHighlightPos(null);
    }
  };

  useEffect(() => {
    updatePositions();
    window.addEventListener('scroll', updatePositions);
    window.addEventListener('resize', updatePositions);
    
    return () => {
      window.removeEventListener('scroll', updatePositions);
      window.removeEventListener('resize', updatePositions);
    };
  }, [activeTutorial, currentStep, isTutorialOpen]);

  if (!isTutorialOpen || !activeTutorial) return null;

  const tutorial = getTutorial(activeTutorial);
  if (!tutorial) return null;

  const step = tutorial.steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === tutorial.steps.length - 1;
  const stepType = step.type || 'info';

  // Check if step requires completion before proceeding
  const isStepBlocked = () => {
    if (stepType === 'quiz' && !quizSubmitted) return true;
    if (stepType === 'task' && !taskCompleted && !isTaskComplete(step.taskId)) return true;
    return false;
  };

  // Render quiz options
  const renderQuiz = () => {
    if (stepType !== 'quiz' || !step.options) return null;

    return (
      <div className="quiz-container">
        <div className="quiz-options">
          {step.options.map((option, idx) => (
            <button
              key={idx}
              className={`quiz-option ${currentQuizAnswer === idx ? 'selected' : ''} ${
                quizSubmitted ? (idx === step.correctAnswer ? 'correct' : currentQuizAnswer === idx ? 'incorrect' : '') : ''
              }`}
              onClick={() => !quizSubmitted && setCurrentQuizAnswer(idx)}
              disabled={quizSubmitted}
            >
              <span className="quiz-option-letter">{String.fromCharCode(65 + idx)}</span>
              <span className="quiz-option-text">{option}</span>
              {quizSubmitted && idx === step.correctAnswer && <span className="quiz-check">✓</span>}
              {quizSubmitted && currentQuizAnswer === idx && idx !== step.correctAnswer && <span className="quiz-x">✗</span>}
            </button>
          ))}
        </div>
        {!quizSubmitted ? (
          <button
            className="quiz-submit-btn"
            onClick={() => submitQuizAnswer(step.correctAnswer)}
            disabled={currentQuizAnswer === null}
          >
            Submit Answer
          </button>
        ) : (
          <div className={`quiz-result ${isCorrect ? 'correct' : 'incorrect'}`}>
            {isCorrect ? '🎉 Correct!' : '❌ Not quite. The correct answer is highlighted.'}
          </div>
        )}
      </div>
    );
  };

  // Render task challenge
  const renderTask = () => {
    if (stepType !== 'task') return null;

    const completed = taskCompleted || isTaskComplete(step.taskId);

    return (
      <div className="task-container">
        <div className="task-instruction">
          <span className="task-icon">🎯</span>
          <span className="task-text">{step.taskDescription || 'Complete the action described above'}</span>
        </div>
        {!completed ? (
          <button
            className="task-complete-btn"
            onClick={() => completeTask(step.taskId)}
          >
            ✓ I've Completed This Task
          </button>
        ) : (
          <div className="task-completed">
            <span>✅ Task Completed!</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="guided-tour-overlay">
      <div
        className={`guided-tour-popover placement-${step.placement} type-${stepType}`}
        style={{
          top: `${popoverPos.top}px`,
          left: `${popoverPos.left}px`,
        }}
      >
        <div className="guided-tour-header">
          <div className="guided-tour-header-left">
            <h3>{tutorial.title}</h3>
            <div className="header-badges">
              {isVoiceMode && (
                <span className={`voice-indicator ${isSpeaking ? 'speaking' : ''}`}>
                  🔊 {isSpeaking ? 'Speaking...' : 'Voice On'}
                </span>
              )}
              {stepType === 'quiz' && <span className="step-type-badge quiz">Quiz</span>}
              {stepType === 'task' && <span className="step-type-badge task">Challenge</span>}
            </div>
          </div>
          <div className="guided-tour-header-right">
            <button
              className={`guided-tour-voice-toggle ${isVoiceMode ? 'active' : ''}`}
              onClick={toggleVoiceMode}
              title={isVoiceMode ? 'Turn off voice' : 'Turn on voice'}
            >
              {isVoiceMode ? '🔊' : '🔇'}
            </button>
            <button
              className="guided-tour-close"
              onClick={skipTutorial}
              aria-label="Close tutorial"
            >
              ×
            </button>
          </div>
        </div>

        <div className="guided-tour-content">
          <p>{step.content}</p>
          
          {/* Render interactive elements based on step type */}
          {renderQuiz()}
          {renderTask()}

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
            <button 
              className="guided-tour-btn btn-primary" 
              onClick={completeTutorial}
              disabled={isStepBlocked()}
            >
              🎉 Finish
            </button>
          ) : (
            <button 
              className="guided-tour-btn btn-primary" 
              onClick={nextStep}
              disabled={isStepBlocked()}
            >
              {isStepBlocked() ? '🔒 Complete to Continue' : 'Next →'}
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
