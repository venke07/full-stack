export const tutorialSteps = {
  introToAgents: {
    id: 'introToAgents',
    title: 'Introduction to AI Agents',
    description: 'Learn the basics of AI agents and how to use them',
    duration: '5 min',
    difficulty: 'beginner',
    steps: [
      {
        target: '.brand',
        content: 'Welcome to the AI Agent platform! This is your dashboard where you can manage all your agents.',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.dashboard-grid',
        content: "Here you can see all your agents. Each card shows an agent's details, status, and available actions.",
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.chat-icon-btn',
        content: 'Click here to test a single agent in the Chat interface.',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.multi-chat-icon-btn',
        content: 'Or click here to have multiple agents discuss topics together!',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.profile-btn',
        content: 'You can access your profile settings from here.',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: 'body',
        content: "Great! You've completed the introduction. Ready to create your first agent?",
        placement: 'center',
        action: 'complete',
      },
    ],
  },

  buildingYourFirstAgent: {
    id: 'buildingYourFirstAgent',
    title: 'Building Your First Agent',
    description: 'Step-by-step guide to create your first AI agent',
    duration: '10 min',
    difficulty: 'beginner',
    steps: [
      {
        target: 'body',
        content: 'Navigate to the Builder by clicking the Builder link. The Agent Builder is where you create and configure your agents.',
        placement: 'center',
        action: 'highlight',
      },
      {
        target: 'input[placeholder*="Agent name"]',
        content: 'Start by giving your agent a meaningful name that describes its purpose.',
        placement: 'bottom',
        action: 'input',
      },
      {
        target: 'textarea[placeholder*="description"]',
        content: 'Describe what your agent will do. Be specific about its purpose and capabilities.',
        placement: 'bottom',
        action: 'textarea',
      },
      {
        target: 'select',
        content: 'Choose the AI model that will power your agent. Different models have different strengths and capabilities.',
        placement: 'right',
        action: 'select',
      },
      {
        target: 'textarea[placeholder*="system prompt"]',
        content: "Write the system prompt. This defines your agent's behavior, personality, and how it should respond.",
        placement: 'left',
        action: 'textarea',
      },
      {
        target: 'button:contains("Save")',
        content: 'Click Save to create your agent. You can edit it anytime from the dashboard.',
        placement: 'top',
        action: 'button',
      },
      {
        target: 'body',
        content: "Congratulations! You've created your first agent. Now you can use it to have conversations.",
        placement: 'center',
        action: 'complete',
      },
    ],
  },

  startingAChat: {
    id: 'startingAChat',
    title: 'Starting Your First Chat',
    description: 'Learn how to have a conversation with an AI agent',
    duration: '3 min',
    difficulty: 'beginner',
    steps: [
      {
        target: '.chat-rail',
        content: 'This panel shows all your available agents. Select one to start chatting.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.rail-item',
        content: 'Click on an agent to select it for the chat.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.stage-header',
        content: "Here you can see the selected agent's name and description.",
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.stage-window',
        content: "Your messages and the agent's responses will appear here in the chat window.",
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.stage-input input',
        content: 'Type your message here and press Enter or click Send.',
        placement: 'top',
        action: 'input',
      },
      {
        target: 'body',
        content: 'Perfect! You can now chat with your agents. Experiment and have fun!',
        placement: 'center',
        action: 'complete',
      },
    ],
  },

  multiAgentChat: {
    id: 'multiAgentChat',
    title: 'Multi-Agent Chat',
    description: 'Learn how to have conversations with multiple agents',
    duration: '8 min',
    difficulty: 'intermediate',
    steps: [
      {
        target: '.multi-agent-chat',
        content: 'Welcome to Multi-Agent Chat! Here you can have multiple agents discuss topics and provide different perspectives.',
        placement: 'center',
        action: 'highlight',
      },
      {
        target: '.agent-selector',
        content: 'This is the agent selection panel. Choose which agents you want to participate in the conversation.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.agent-list-selector',
        content: 'Check the boxes to select your agents. You can select as many as you want!',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.message-input input',
        content: 'Type your topic or question here and all selected agents will respond.',
        placement: 'top',
        action: 'input',
      },
      {
        target: '.chat-messages-area',
        content: 'Watch as your agents respond with their unique perspectives. Each agent brings different insights!',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: 'body',
        content: 'Multi-agent conversations are great for brainstorming, research, and exploring diverse viewpoints!',
        placement: 'center',
        action: 'complete',
      },
    ],
  },

  agentBuilder: {
    id: 'agentBuilder',
    title: 'Advanced Agent Builder',
    description: 'Create powerful AI agents with detailed configurations',
    duration: '12 min',
    difficulty: 'intermediate',
    steps: [
      {
        target: 'header',
        content: 'Welcome to the Agent Builder! Here you can create and configure AI agents with precise control.',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '#agentName',
        content: 'Start by giving your agent a clear, descriptive name. This helps you identify it later.',
        placement: 'bottom',
        action: 'input',
      },
      {
        target: '#agentDesc',
        content: "Describe what your agent does and who it's for. This context helps the agent stay focused.",
        placement: 'bottom',
        action: 'textarea',
      },
      {
        target: '#agentPrompt',
        content: 'Write detailed system instructions here. This is where you define your agent\'s behavior, tone, and expertise.',
        placement: 'left',
        action: 'textarea',
      },
      {
        target: '.config-column section:nth-child(2)',
        content: 'Use Personality sliders to fine-tune your agent. Formality controls professionalism, Creativity controls imaginativeness.',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.toggle',
        content: 'Guardrails help control your agent\'s behavior. Enable them to ensure factuality and prevent opinions.',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.chat-column',
        content: 'Test your agent here! Type messages and see how it responds in real-time.',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.header-actions button:contains("publish")',
        content: 'When you\'re happy with your agent, publish it to make it available for chats and workflows.',
        placement: 'bottom',
        action: 'button',
      },
      {
        target: 'body',
        content: 'Congratulations! You\'ve mastered the Agent Builder. Now create amazing AI agents!',
        placement: 'center',
        action: 'complete',
      },
    ],
  },

  chatSurface: {
    id: 'chatSurface',
    title: 'Chat Surface',
    description: 'Learn how to interact with agents in the chat interface',
    duration: '5 min',
    difficulty: 'beginner',
    steps: [
      {
        target: 'header',
        content: 'The Chat Surface is where you test and interact with individual agents before deployment.',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.chat-rail',
        content: 'This sidebar shows all your published agents. Click one to start chatting with it.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.rail-item',
        content: 'Each agent is displayed with its avatar and name. Select the agent you want to chat with.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.stage-header',
        content: "Here you can see the selected agent's name and description. This helps you understand the agent's purpose.",
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.stage-window',
        content: "The chat history appears here. You'll see your messages and the agent's responses.",
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.stage-input input',
        content: 'Type your message here and press Enter or click Send to chat with the agent.',
        placement: 'top',
        action: 'input',
      },
      {
        target: '.chat-sidebar',
        content: 'The capabilities panel shows the agent\'s configuration like model, formality, and creativity settings.',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: 'body',
        content: 'Perfect! You now know how to use the Chat Surface to test your agents!',
        placement: 'center',
        action: 'complete',
      },
    ],
  },

  workflowCanvas: {
    id: 'workflowCanvas',
    title: 'Workflow Canvas',
    description: 'Create complex workflows by connecting AI agents and actions',
    duration: '15 min',
    difficulty: 'advanced',
    steps: [
      {
        target: '.canvas-header',
        content: 'Welcome to the Workflow Canvas! Build complex automation by connecting triggers, agents, and actions.',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.palette',
        content: 'The palette on the left contains different block types: triggers, actions, data, logic, and LLM agents.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.palette-block',
        content: 'Drag blocks from the palette onto the canvas to add them to your workflow.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.canvas-board',
        content: 'The main canvas area is where you build your workflow. Click and drag to pan, scroll to zoom.',
        placement: 'center',
        action: 'highlight',
      },
      {
        target: '.node',
        content: 'Each block on the canvas is a node. Click a node to select it and see its details.',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.canvas-board',
        content: 'To connect nodes, click the connection button on one node, then click another node to create a link.',
        placement: 'center',
        action: 'highlight',
      },
      {
        target: '.canvas-board',
        content: 'Build workflows like: CRM Trigger → LLM Agent (analyze) → Slack Action (notify). Automate complex processes!',
        placement: 'center',
        action: 'highlight',
      },
      {
        target: 'body',
        content: 'You\'re ready to create powerful automated workflows! Combine agents, data, and actions to solve real problems.',
        placement: 'center',
        action: 'complete',
      },
    ],
  },
};

export const getTutorial = (tutorialId) => {
  return tutorialSteps[tutorialId];
};

export const getAllTutorials = () => {
  return Object.values(tutorialSteps);
};
