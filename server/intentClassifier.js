/**
 * Intent Classifier
 * Analyzes user input and determines task type and agents needed
 */

class IntentClassifier {
  constructor() {
    // Task type patterns
    this.patterns = {
      ANALYSIS: {
        keywords: ['analyze', 'analyze', 'examine', 'review', 'assess', 'evaluate', 'inspect'],
        agentsNeeded: ['analyzer', 'summarizer'],
        description: 'Data Analysis Task',
      },
      SUMMARIZATION: {
        keywords: ['summarize', 'summary', 'condense', 'brief', 'overview', 'highlight'],
        agentsNeeded: ['summarizer', 'extractor'],
        description: 'Summarization Task',
      },
      PLANNING: {
        keywords: ['plan', 'planning', 'strategy', 'roadmap', 'steps', 'breakdown', 'organize'],
        agentsNeeded: ['planner', 'analyzer'],
        description: 'Planning Task',
      },
      ACTION_ITEMS: {
        keywords: ['action items', 'action item', 'todo', 'tasks', 'next steps', 'recommendations'],
        agentsNeeded: ['planner', 'executor'],
        description: 'Action Items Generation',
      },
      CODE_GENERATION: {
        keywords: ['code', 'write', 'generate', 'function', 'script', 'implement', 'develop'],
        agentsNeeded: ['coder', 'analyzer'],
        description: 'Code Generation Task',
      },
      DECISION_MAKING: {
        keywords: ['decide', 'decision', 'choose', 'compare', 'pros and cons', 'recommend'],
        agentsNeeded: ['analyzer', 'planner'],
        description: 'Decision Making Task',
      },
    };
  }

  /**
   * Classify user intent
   */
  classify(userPrompt) {
    const lowerPrompt = userPrompt.toLowerCase();
    const scores = {};

    // Score each intent type
    for (const [intentType, config] of Object.entries(this.patterns)) {
      let score = 0;
      for (const keyword of config.keywords) {
        if (lowerPrompt.includes(keyword)) {
          score += 1;
        }
      }
      if (score > 0) {
        scores[intentType] = score;
      }
    }

    // If no clear match, return generic
    if (Object.keys(scores).length === 0) {
      return {
        intent: 'GENERAL',
        confidence: 0.5,
        agentsNeeded: ['analyzer', 'responder'],
        description: 'General Task',
        reasoning: 'No specific intent patterns detected',
      };
    }

    // Get highest scoring intent
    const topIntent = Object.keys(scores).reduce((a, b) =>
      scores[a] > scores[b] ? a : b
    );

    const maxScore = scores[topIntent];
    const confidence = Math.min(maxScore * 0.3, 0.95); // Cap at 0.95

    const config = this.patterns[topIntent];

    return {
      intent: topIntent,
      confidence,
      agentsNeeded: config.agentsNeeded,
      description: config.description,
      reasoning: `Detected ${maxScore} matching keyword(s) for ${topIntent}`,
      allScores: scores,
    };
  }

  /**
   * Get recommended agent workflow based on intent
   */
  getWorkflow(intent) {
    const workflows = {
      ANALYSIS: [
        { agent: 'extractor', prompt: 'Extract key information and data points' },
        { agent: 'analyzer', prompt: 'Analyze the extracted data' },
        { agent: 'summarizer', prompt: 'Provide analysis summary' },
      ],
      SUMMARIZATION: [
        { agent: 'extractor', prompt: 'Extract main points' },
        { agent: 'summarizer', prompt: 'Create concise summary' },
      ],
      PLANNING: [
        { agent: 'analyzer', prompt: 'Analyze requirements' },
        { agent: 'planner', prompt: 'Create detailed plan with steps' },
      ],
      ACTION_ITEMS: [
        { agent: 'analyzer', prompt: 'Identify key areas' },
        { agent: 'planner', prompt: 'Generate actionable recommendations' },
      ],
      CODE_GENERATION: [
        { agent: 'analyzer', prompt: 'Understand requirements' },
        { agent: 'coder', prompt: 'Generate code' },
        { agent: 'analyzer', prompt: 'Review and provide feedback' },
      ],
      DECISION_MAKING: [
        { agent: 'analyzer', prompt: 'Analyze options and factors' },
        { agent: 'planner', prompt: 'Provide recommendation' },
      ],
    };

    return workflows[intent] || [
      { agent: 'analyzer', prompt: 'Process the request' },
      { agent: 'responder', prompt: 'Provide comprehensive response' },
    ];
  }
}

export default new IntentClassifier();
