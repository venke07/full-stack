import React, { createContext, useState, useContext } from 'react';

const TutorialContext = createContext();

export const TutorialProvider = ({ children }) => {
  const [activeTutorial, setActiveTutorial] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedTutorials, setCompletedTutorials] = useState([]);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  const startTutorial = (tutorialId) => {
    setActiveTutorial(tutorialId);
    setCurrentStep(0);
    setIsTutorialOpen(true);
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const completeTutorial = () => {
    if (activeTutorial && !completedTutorials.includes(activeTutorial)) {
      setCompletedTutorials([...completedTutorials, activeTutorial]);
    }
    closeTutorial();
  };

  const closeTutorial = () => {
    setActiveTutorial(null);
    setCurrentStep(0);
    setIsTutorialOpen(false);
  };

  const skipTutorial = () => {
    closeTutorial();
  };

  const value = {
    activeTutorial,
    currentStep,
    completedTutorials,
    isTutorialOpen,
    startTutorial,
    nextStep,
    prevStep,
    completeTutorial,
    closeTutorial,
    skipTutorial,
    setCurrentStep,
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
