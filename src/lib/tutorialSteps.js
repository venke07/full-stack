export const tutorialSteps = {
  introToAgents: {
    id: 'introToAgents',
    title: 'Introduction to AI Agents',
    description: 'Learn the basics of AI agents and how to use them',
    duration: '5 min',
    difficulty: 'beginner',
    route: '/home',
    steps: [
      {
        target: '.brand',
        content: 'Welcome to the AI Agent platform! This is your dashboard where you can manage all your agents.',
        placement: 'bottom',
        type: 'info',
      },
      {
        target: '.dashboard-grid',
        content: "Here you can see all your agents. Each card shows an agent's details, status, and available actions.",
        placement: 'left',
        type: 'info',
      },
      {
        target: 'body',
        content: 'Quick quiz: What is the main purpose of an AI Agent?',
        placement: 'center',
        type: 'quiz',
        options: [
          'To replace human workers entirely',
          'To automate tasks and assist users with specific goals',
          'To store data in the cloud',
          'To create websites'
        ],
        correctAnswer: 1,
        points: 10,
      },
      {
        target: '.chat-icon-btn',
        content: 'Click here to test a single agent in the Chat interface.',
        placement: 'bottom',
        type: 'info',
      },
      {
        target: '.multi-chat-icon-btn',
        content: 'Or click here to have multiple agents discuss topics together!',
        placement: 'bottom',
        type: 'info',
      },
      {
        target: 'body',
        content: 'Which button would you click to have a conversation with a SINGLE agent?',
        placement: 'center',
        type: 'quiz',
        options: [
          'The Multi-Chat button (🤖💬)',
          'The Chat button (💬)',
          'The Profile button',
          'The Voice Chat button (🎤)'
        ],
        correctAnswer: 1,
        points: 10,
      },
      {
        target: '.profile-btn',
        content: 'You can access your profile settings from here.',
        placement: 'left',
        type: 'info',
      },
      {
        target: 'body',
        content: "Great! You've completed the introduction. Ready to create your first agent?",
        placement: 'center',
        type: 'info',
      },
    ],
  },

  buildingYourFirstAgent: {
    id: 'buildingYourFirstAgent',
    title: 'Building Your First Agent',
    description: 'Step-by-step guide to create your first AI agent',
    duration: '10 min',
    difficulty: 'beginner',
    route: '/builder',
    steps: [
      {
        target: 'body',
        content: 'Welcome to the Agent Builder! This is where you create and configure your AI agents.',
        placement: 'center',
        type: 'info',
      },
      {
        target: 'body',
        content: 'Before we start, what do you think a "System Prompt" does for an AI agent?',
        placement: 'center',
        type: 'quiz',
        options: [
          'It displays error messages',
          'It defines the agent\'s personality and behavior',
          'It stores user passwords',
          'It creates the user interface'
        ],
        correctAnswer: 1,
        points: 10,
      },
      {
        target: 'input[placeholder*="Agent name"]',
        content: 'Give your agent a meaningful name. Try naming it something descriptive!',
        placement: 'bottom',
        type: 'task',
        taskId: 'name-agent',
        taskDescription: 'Type a name for your agent in the input field above',
        points: 15,
      },
      {
        target: 'textarea[placeholder*="description"]',
        content: 'Describe what your agent will do. Be specific about its purpose.',
        placement: 'bottom',
        type: 'task',
        taskId: 'describe-agent',
        taskDescription: 'Write a description for your agent',
        points: 15,
      },
      {
        target: 'select',
        content: 'Choose the AI model that will power your agent. Different models have different capabilities.',
        placement: 'right',
        type: 'info',
      },
      {
        target: 'body',
        content: 'Which model would you choose for creative writing tasks?',
        placement: 'center',
        type: 'quiz',
        options: [
          'Any model - they are all the same',
          'A model with higher creativity settings',
          'The cheapest model only',
          'Models cannot do creative writing'
        ],
        correctAnswer: 1,
        points: 10,
      },
      {
        target: 'textarea[placeholder*="system prompt"]',
        content: "Write the system prompt. This defines your agent's behavior, personality, and how it should respond.",
        placement: 'left',
        type: 'task',
        taskId: 'write-system-prompt',
        taskDescription: 'Write a system prompt that defines how your agent should behave',
        points: 20,
      },
      {
        target: 'body',
        content: "Excellent work! You've learned how to build an AI agent. Save it to see it on your dashboard!",
        placement: 'center',
        type: 'info',
      },
    ],
  },

  startingAChat: {
    id: 'startingAChat',
    title: 'Starting Your First Chat',
    description: 'Learn how to have a conversation with an AI agent',
    duration: '3 min',
    difficulty: 'beginner',
    route: '/chat',
    steps: [
      {
        target: '.chat-rail',
        content: 'This panel shows all your available agents. Select one to start chatting.',
        placement: 'right',
        type: 'info',
      },
      {
        target: '.rail-item',
        content: 'Click on an agent to select it for the chat.',
        placement: 'right',
        type: 'task',
        taskId: 'select-agent-chat',
        taskDescription: 'Click on any agent in the list to select it',
        points: 10,
      },
      {
        target: 'body',
        content: 'When chatting with an AI agent, which of these is a good practice?',
        placement: 'center',
        type: 'quiz',
        options: [
          'Use very short, vague messages',
          'Be clear and specific about what you want',
          'Never provide context',
          'Type in all caps'
        ],
        correctAnswer: 1,
        points: 10,
      },
      {
        target: '.stage-window',
        content: "Your messages and the agent's responses will appear here in the chat window.",
        placement: 'left',
        type: 'info',
      },
      {
        target: '.stage-input input',
        content: 'Type your message here and press Enter or click Send.',
        placement: 'top',
        type: 'task',
        taskId: 'type-first-message',
        taskDescription: 'Type a message in the input field (you can send it or just type)',
        points: 15,
      },
      {
        target: 'body',
        content: 'Perfect! You can now chat with your agents. Experiment and have fun!',
        placement: 'center',
        type: 'info',
      },
    ],
  },

  multiAgentChat: {
    id: 'multiAgentChat',
    title: 'Multi-Agent Chat',
    description: 'Learn how to have conversations with multiple agents',
    duration: '8 min',
    route: '/multi-chat',
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
    route: '/builder',
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
        target: '.palette-chip',
        content: 'Click or drag a block from the palette. For example, drag a trigger to start your workflow.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.agent-palette',
        content: "Scroll down in the palette to see your AI agents. You can drag any agent directly into the workflow!",
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.canvas-board',
        content: 'The canvas is where you build your workflow. Drop blocks here, arrange them, and connect them together.',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.canvas-node',
        content: 'Each block on the canvas is a node. Click a node to select it. You can drag to move it around the canvas.',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.node-actions button',
        content: 'Click the "Connect" button on a node to start creating connections. Then click another node to link them.',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.canvas-lines',
        content: 'Lines between nodes show your workflow connections. Data and control flow through these connections.',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.inspector',
        content: 'The Inspector on the right shows details about the selected node and lets you bind AI models to it.',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.header-actions button',
        content: 'When your workflow is complete, click "Save as Agent" to create an agent from this workflow!',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: 'body',
        content: 'You now master Workflow Canvas! Create powerful automated workflows by combining triggers, agents, and actions.',
        placement: 'center',
        action: 'complete',
      },
    ],
  },

  voiceChat: {
    id: 'voiceChat',
    title: 'Voice Chat with Agents',
    description: 'Have real-time conversations with AI agents using your voice',
    duration: '4 min',
    difficulty: 'intermediate',
    route: '/voice-chat',
    steps: [
      {
        target: '.brand',
        content: 'Welcome to Voice Chat! Have real-time conversations with your AI agents using speech recognition.',
        placement: 'bottom',
        action: 'highlight',
      },
      {
        target: '.agent-selector',
        content: 'First, select an agent from this list. Your published agents will appear here.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.agent-option',
        content: 'Click on any agent to select it. The agent will be highlighted when active.',
        placement: 'right',
        action: 'highlight',
      },
      {
        target: '.voice-stage',
        content: 'This is the main chat area. Agent responses will appear here, and you can see your conversation history.',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: '.status-badge',
        content: 'Check this status badge to see if you are listening, speaking, or ready to chat.',
        placement: 'top',
        action: 'highlight',
      },
      {
        target: '.control-btn',
        content: 'Click "Start Listening" to begin recording. Your speech will be converted to text automatically.',
        placement: 'top',
        action: 'highlight',
      },
      {
        target: '.transcript-box',
        content: 'Your transcribed speech will appear here. You can verify it before sending.',
        placement: 'top',
        action: 'highlight',
      },
      {
        target: '.info-panel',
        content: 'Check out the tips panel for best practices. Speak clearly and in quiet environments for best results!',
        placement: 'left',
        action: 'highlight',
      },
      {
        target: 'body',
        content: 'Perfect! You now know how to use Voice Chat. Start a conversation with your AI agents!',
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
