/**
 * Task Planner
 * Analyzes user request and determines which agents are needed and in what order
 */

class TaskPlanner {
  constructor() {
    this.taskPatterns = {
      FITNESS: {
        keywords: ['fitness', 'workout', 'exercise', 'health', 'training'],
        requiredCapabilities: ['data_research', 'planning', 'document_generation'],
        outputFormat: 'document',
        description: 'Fitness & Workout Planning',
      },
      DOCUMENT_CREATION: {
        keywords: ['document', 'report', 'essay', 'article', 'write'],
        requiredCapabilities: ['data_research', 'creative_writing', 'document_generation'],
        outputFormat: 'document',
        description: 'Document Creation',
      },
      IMAGE_GENERATION: {
        keywords: ['image', 'picture', 'visual', 'design', 'create image'],
        requiredCapabilities: ['image_generation'],
        outputFormat: 'image',
        description: 'Image Generation',
      },
      CODE_PROJECT: {
        keywords: ['code', 'build', 'develop', 'application', 'software'],
        requiredCapabilities: ['analysis', 'code_generation', 'quality_assurance'],
        outputFormat: 'code',
        description: 'Code Development',
      },
      RESEARCH_REPORT: {
        keywords: ['research', 'report', 'analyze', 'investigate'],
        requiredCapabilities: ['data_research', 'analysis', 'document_generation'],
        outputFormat: 'document',
        description: 'Research Report',
      },
      DATA_ANALYSIS: {
        keywords: ['analyze', 'data', 'statistics', 'trends', 'insights'],
        requiredCapabilities: ['data_processing', 'analysis', 'summarization'],
        outputFormat: 'document',
        description: 'Data Analysis',
      },
      CREATIVE_PROJECT: {
        keywords: ['story', 'creative', 'fiction', 'narrative', 'novel'],
        requiredCapabilities: ['creative_writing', 'document_generation'],
        outputFormat: 'document',
        description: 'Creative Writing Project',
      },
    };
  }

  /**
   * Analyze task and return execution plan
   */
  analyzTask(taskDescription) {
    const lowerTask = taskDescription.toLowerCase();
    const detectedPatterns = [];

    // Detect task patterns
    for (const [patternId, pattern] of Object.entries(this.taskPatterns)) {
      let matchScore = 0;
      for (const keyword of pattern.keywords) {
        if (lowerTask.includes(keyword)) {
          matchScore++;
        }
      }
      if (matchScore > 0) {
        detectedPatterns.push({
          pattern: patternId,
          score: matchScore,
          ...pattern,
        });
      }
    }

    // Sort by match score
    detectedPatterns.sort((a, b) => b.score - a.score);

    const primaryPattern = detectedPatterns[0] || {
      pattern: 'GENERAL',
      description: 'General Task',
      requiredCapabilities: ['analysis'],
      outputFormat: 'text',
      score: 0,
    };

    return {
      taskDescription,
      detectedPattern: primaryPattern.pattern,
      description: primaryPattern.description,
      requiredCapabilities: primaryPattern.requiredCapabilities,
      outputFormat: primaryPattern.outputFormat,
      confidence: Math.min((primaryPattern.score / 3) * 100, 100),
      alternativePatterns: detectedPatterns.slice(1, 3),
    };
  }

  /**
   * Create execution plan with agent dependencies
   */
  createExecutionPlan(taskAnalysis, availableAgents, agentRegistry) {
    const requiredCapabilities = taskAnalysis.requiredCapabilities;
    const selectedAgents = new Map();
    const agentCapabilities = new Map();

    // Step 1: Find agents for each required capability
    for (const capabilityId of requiredCapabilities) {
      const agent = agentRegistry.findBestAgentForCapability(capabilityId);
      if (agent && !selectedAgents.has(agent.id)) {
        selectedAgents.set(agent.id, agent);
        if (!agentCapabilities.has(agent.id)) {
          agentCapabilities.set(agent.id, []);
        }
        agentCapabilities.get(agent.id).push(capabilityId);
      }
    }

    // Step 2: Get execution order considering dependencies
    const agentsArray = Array.from(selectedAgents.values());
    const executionOrder = agentRegistry.getExecutionOrder(agentsArray);

    // Step 3: Create detailed execution plan
    const executionPlan = executionOrder.map((agent, index) => ({
      step: index + 1,
      agent: agent,
      agentId: agent.id,
      agentName: agent.name,
      capabilities: agentCapabilities.get(agent.id) || [],
      dependencies: agent.dependencies.filter(dep =>
        executionOrder.some(a => a.id === dep)
      ),
      inputSource: index === 0 ? 'user_task' : executionOrder[index - 1].id,
      outputFormat: agent.outputFormat,
      systemPrompt: agent.systemPrompt,
    }));

    return {
      taskId: `task-${Date.now()}`,
      taskDescription: taskAnalysis.taskDescription,
      pattern: taskAnalysis.detectedPattern,
      confidence: taskAnalysis.confidence,
      requiredCapabilities: requiredCapabilities,
      expectedOutputFormat: taskAnalysis.outputFormat,
      totalSteps: executionPlan.length,
      executionPlan,
      estimatedTokens: executionPlan.reduce((sum, step) => sum + step.agent.maxTokens, 0),
    };
  }

  /**
   * Generate system prompt for task execution
   */
  generateTaskSystemPrompt(executionPlan, stepIndex) {
    const step = executionPlan.executionPlan[stepIndex];
    if (!step) return '';

    let prompt = `You are ${step.agentName}, a specialized agent for ${step.agent.role}.

Task: ${executionPlan.taskDescription}

Your role: ${step.agent.description}

Current Step: ${step.step} of ${executionPlan.totalSteps}
Capabilities: ${step.capabilities.join(', ')}

${step.step > 1 ? `You will receive output from the previous agent to build upon.` : 'You are the first step - start fresh with the user task.'}

Output Format: ${step.outputFormat}

${step.agent.systemPrompt ? `Additional Instructions: ${step.agent.systemPrompt}` : ''}

Focus on delivering clear, actionable, and high-quality output for the next agent or final result.`;

    return prompt;
  }
}

export default new TaskPlanner();
