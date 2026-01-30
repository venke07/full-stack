import React, { createContext, useState, useContext } from 'react';

const TutorialContext = createContext();

// Load saved progress from localStorage
const loadSavedProgress = () => {
  try {
    const saved = localStorage.getItem('tutorialProgress');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load tutorial progress');
  }
  return {
    completedTutorials: [],
    completedChallenges: [],
  };
};

// Save progress to localStorage
const saveProgress = (progress) => {
  try {
    localStorage.setItem('tutorialProgress', JSON.stringify(progress));
  } catch (e) {
    console.warn('Failed to save tutorial progress');
  }
};

export const TutorialProvider = ({ children }) => {
  const [activeTutorial, setActiveTutorial] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  
  // Interactive challenge state
  const [progress, setProgress] = useState(loadSavedProgress);
  const [currentQuizAnswer, setCurrentQuizAnswer] = useState(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [taskCompleted, setTaskCompleted] = useState(false);

  const startTutorial = (tutorialId, voiceEnabled = false) => {
    setActiveTutorial(tutorialId);
    setCurrentStep(0);
    setIsVoiceMode(voiceEnabled);
    setIsTutorialOpen(true);
    // Reset step state
    setCurrentQuizAnswer(null);
    setQuizSubmitted(false);
    setIsCorrect(false);
    setTaskCompleted(false);
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
    // Reset interactive state for new step
    setCurrentQuizAnswer(null);
    setQuizSubmitted(false);
    setIsCorrect(false);
    setTaskCompleted(false);
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
    // Reset interactive state
    setCurrentQuizAnswer(null);
    setQuizSubmitted(false);
    setIsCorrect(false);
    setTaskCompleted(false);
  };

  // Submit quiz answer
  const submitQuizAnswer = (correctAnswer) => {
    setQuizSubmitted(true);
    const correct = currentQuizAnswer === correctAnswer;
    setIsCorrect(correct);
  };

  // Complete a task/challenge
  const completeTask = (challengeId) => {
    if (!progress.completedChallenges.includes(challengeId)) {
      setTaskCompleted(true);
      const newProgress = {
        ...progress,
        completedChallenges: [...progress.completedChallenges, challengeId],
      };
      setProgress(newProgress);
      saveProgress(newProgress);
    }
  };

  // Check if a task was already completed
  const isTaskComplete = (challengeId) => {
    return progress.completedChallenges.includes(challengeId);
  };

  const completeTutorial = () => {
    if (activeTutorial && !progress.completedTutorials.includes(activeTutorial)) {
      const newProgress = {
        ...progress,
        completedTutorials: [...progress.completedTutorials, activeTutorial],
      };
      setProgress(newProgress);
      saveProgress(newProgress);
    }
    closeTutorial();
  };

  const closeTutorial = () => {
    // Stop any ongoing speech when closing
    window.speechSynthesis.cancel();
    setActiveTutorial(null);
    setCurrentStep(0);
    setIsTutorialOpen(false);
    setIsVoiceMode(false);
    // Reset interactive state
    setCurrentQuizAnswer(null);
    setQuizSubmitted(false);
    setIsCorrect(false);
    setTaskCompleted(false);
  };

  const skipTutorial = () => {
    closeTutorial();
  };

  const value = {
    activeTutorial,
    currentStep,
    completedTutorials: progress.completedTutorials,
    isTutorialOpen,
    isVoiceMode,
    // Progress
    progress,
    currentQuizAnswer,
    quizSubmitted,
    isCorrect,
    taskCompleted,
    // Actions
    startTutorial,
    nextStep,
    prevStep,
    completeTutorial,
    closeTutorial,
    skipTutorial,
    setCurrentStep,
    setIsVoiceMode,
    setCurrentQuizAnswer,
    submitQuizAnswer,
    completeTask,
    isTaskComplete,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider');
  }
  return context;
};
