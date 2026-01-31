/**
 * Agent Manager / Orchestrator
 * Coordinates multiple agents to work together and complete complex tasks
 */

import contextMemory from './contextMemory.js';
import agentRegistry from './agentRegistry.js';
import taskPlanner from './taskPlanner.js';

class AgentManager {
  constructor() {
    this.agents = new Map(); // Registered agents
    this.workflows = new Map(); // Stored workflows
  }

  /**
   * Register an agent that can be used in workflows
   */
  registerAgent(agentId, agentConfig) {
    this.agents.set(agentId, {
      id: agentId,
      name: agentConfig.name || agentId,
      systemPrompt: agentConfig.systemPrompt || '',
      modelId: agentConfig.modelId || 'gpt-4o-mini',
      role: agentConfig.role || 'assistant',
      ...agentConfig,
    });
  }

  /**
   * Get registered agent
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Create a workflow from selected agents
   */
  createWorkflow(workflowId, agentIds, strategy = 'sequential') {
    const agents = agentIds
      .map(id => this.agents.get(id))
      .filter(Boolean);

    if (agents.length === 0) {
      throw new Error('No valid agents found for workflow');
    }

    const workflow = {
      id: workflowId,
      agents,
      strategy, // 'sequential', 'parallel', 'decision-tree'
      createdAt: new Date(),
      steps: agents.map((agent, index) => ({
        stepNumber: index + 1,
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        status: 'pending',
      })),
    };

    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  /**
   * Execute workflow orchestration
   * Returns intermediate steps and final result
   */
  async executeWorkflow(
    workflowId,
    userPrompt,
    context,
    callAgentHandler
  ) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const sessionId = context.sessionId || Date.now().toString();
    const executionContext = contextMemory.getContext(sessionId) ||
      contextMemory.createContext(sessionId, { userPrompt });

    const results = {
      workflowId,
      sessionId,
      userPrompt,
      intermediateSteps: [],
      agentOutputs: {},
      finalResult: null,
      executionTime: 0,
    };

    const startTime = Date.now();
    let currentInput = userPrompt;

    try {
      // Execute each agent in sequence
      for (const step of workflow.steps) {
        const agent = this.agents.get(step.agentId);
        if (!agent) continue;

        contextMemory.addHistoryEntry(sessionId, {
          step: step.stepNumber,
          agent: agent.name,
          action: 'start',
        });

        // Build messages for this agent
        const messages = [
          {
            role: 'system',
            content: agent.systemPrompt ||
              `You are a ${agent.role} specialized in helping with tasks. 
              Your role: ${step.agentName}`,
          },
          {
            role: 'user',
            content: currentInput,
          },
        ];

        try {
          // Call the agent
          const agentResponse = await callAgentHandler({
            modelId: agent.modelId,
            apiKey: process.env[this.getApiKeyEnvVar(agent.modelId)],
            temperature: 0.3,
            messages,
            baseUrl: this.getBaseUrl(agent.modelId),
          });

          const output = agentResponse.reply || agentResponse;

          // Store output in context
          contextMemory.addAgentOutput(sessionId, agent.name, output);

          // Add to results
          results.intermediateSteps.push({
            stepNumber: step.stepNumber,
            agent: agent.name,
            input: currentInput,
            output: output,
            timestamp: new Date(),
          });

          results.agentOutputs[agent.name] = output;

          // Use this agent's output as input for next agent
          currentInput = output;

          contextMemory.addHistoryEntry(sessionId, {
            step: step.stepNumber,
            agent: agent.name,
            action: 'complete',
            outputLength: output.length,
          });

          step.status = 'completed';
        } catch (error) {
          contextMemory.addHistoryEntry(sessionId, {
            step: step.stepNumber,
            agent: agent.name,
            action: 'error',
            error: error.message,
          });

          step.status = 'failed';

          // Don't update input, just log the error and continue
          console.error(`Agent ${agent.name} failed:`, error.message);
          // Keep current input as-is for next agent
        }
      }

      // Final result is the output from the last agent
      results.finalResult = currentInput;

      // Update context with final result
      contextMemory.updateContext(sessionId, {
        finalResult: currentInput,
      });

      results.executionTime = Date.now() - startTime;

      return results;
    } catch (error) {
      results.error = error.message;
      results.executionTime = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Orchestrate multiple agents working on a single task (parallel mode)
   */
  async orchestrateParallel(
    agentIds,
    userPrompt,
    callAgentHandler
  ) {
    const sessionId = Date.now().toString();
    contextMemory.createContext(sessionId, { userPrompt });

    const results = {
      sessionId,
      userPrompt,
      agentResponses: {},
      executionTime: 0,
    };

    const startTime = Date.now();

    // Execute all agents in parallel
    const promises = agentIds.map(async (agentId) => {
      const agent = this.agents.get(agentId);
      if (!agent) return;

      try {
        const messages = [
          {
            role: 'system',
            content: agent.systemPrompt || `You are ${agent.name}`,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ];

        const response = await callAgentHandler({
          modelId: agent.modelId,
          apiKey: process.env[this.getApiKeyEnvVar(agent.modelId)],
          temperature: 0.3,
          messages,
          baseUrl: this.getBaseUrl(agent.modelId),
        });

        return {
          agentId,
          agentName: agent.name,
          output: response.reply || response,
        };
      } catch (error) {
        console.warn(`Agent ${agent.name} failed:`, error.message);
        return {
          agentId,
          agentName: agent.name,
          error: error.message,
        };
      }
    });

    const parallelResults = await Promise.all(promises);

    // Collect results
    parallelResults.forEach((result) => {
      if (result) {
        results.agentResponses[result.agentName] = result.output || result.error;
      }
    });

    results.executionTime = Date.now() - startTime;

    return results;
  }

  /**
   * Helper to get API key env variable for a model
   */
  getApiKeyEnvVar(modelId) {
    const mapping = {
      'gemini-2.5-flash': 'GEMINI_API_KEY',
      'gpt-4o-mini': 'OPENAI_API_KEY',
      'deepseek-chat': 'DEEPSEEK_API_KEY',
      'llama-3.3-70b-versatile': 'GROQ_API_KEY',
    };
    return mapping[modelId] || 'OPENAI_API_KEY';
  }

  /**
   * Helper to get base URL for a model
   */
  getBaseUrl(modelId) {
    const mapping = {
      'gpt-4o-mini': 'https://api.openai.com/v1/chat/completions',
      'deepseek-chat': 'https://api.deepseek.com/v1/chat/completions',
      'llama-3.3-70b-versatile': 'https://api.groq.com/openai/v1/chat/completions',
    };
    return mapping[modelId] || 'https://api.openai.com/v1/chat/completions';
  }

  /**
   * Execute autonomous task - system determines needed agents and executes
   */
  async executeAutonomousTask(
    userTask,
    callAgentHandler,
    availableAgents = null
  ) {
    const sessionId = `auto-${Date.now()}`;
    const executionContext = contextMemory.createContext(sessionId, { userTask });

    const results = {
      taskId: sessionId,
      userTask,
      intermediateSteps: [],
      agentOutputs: {},
      finalResult: null,
      executionTime: 0,
    };

    const startTime = Date.now();

    try {
      // Step 1: Analyze the task
      const taskAnalysis = taskPlanner.analyzTask(userTask);
      contextMemory.addHistoryEntry(sessionId, {
        action: 'task_analysis',
        analysis: taskAnalysis,
      });

      results.taskAnalysis = taskAnalysis;

      // Step 2: Get agents needed for this task
      const agentsForTask = agentRegistry.getAgentsForTask(userTask);
      
      if (agentsForTask.length === 0) {
        throw new Error('No agents found for this task type');
      }

      // Step 3: Create execution plan
      const executionPlan = taskPlanner.createExecutionPlan(
        taskAnalysis,
        agentsForTask,
        agentRegistry
      );

      contextMemory.updateContext(sessionId, {
        executionPlan: executionPlan,
      });

      results.executionPlan = executionPlan;

      // Step 4: Execute agents in order
      let currentInput = userTask;
      let lastError = null;

      for (let i = 0; i < executionPlan.executionPlan.length; i++) {
        const step = executionPlan.executionPlan[i];

        contextMemory.addHistoryEntry(sessionId, {
          step: step.step,
          agent: step.agentName,
          action: 'start',
        });

        try {
          // Generate task-specific system prompt
          const systemPrompt = taskPlanner.generateTaskSystemPrompt(executionPlan, i);

          const messages = [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: currentInput,
            },
          ];

          // Call the agent
          const agentResponse = await callAgentHandler({
            modelId: step.agent.modelId,
            apiKey: process.env[this.getApiKeyEnvVar(step.agent.modelId)],
            temperature: 0.3,
            messages,
            baseUrl: this.getBaseUrl(step.agent.modelId),
          });

          const output = agentResponse.reply || agentResponse;

          // Store output
          contextMemory.addAgentOutput(sessionId, step.agentName, output);

          // Add to results
          results.intermediateSteps.push({
            stepNumber: step.step,
            agent: step.agentName,
            capability: step.capabilities.join(', '),
            input: currentInput.substring(0, 200) + (currentInput.length > 200 ? '...' : ''),
            output: output,
            timestamp: new Date(),
          });

          results.agentOutputs[step.agentName] = output;

          // Use this output as input for next agent
          currentInput = output;
          lastError = null;

          contextMemory.addHistoryEntry(sessionId, {
            step: step.step,
            agent: step.agentName,
            action: 'complete',
            outputLength: output.length,
          });
        } catch (error) {
          lastError = error;
          contextMemory.addHistoryEntry(sessionId, {
            step: step.step,
            agent: step.agentName,
            action: 'error',
            error: error.message,
          });

          console.error(`Agent ${step.agentName} failed:`, error.message, error.stack);
          // Continue to next agent with current input if available
          // Don't prepend the error message
        }
      }

      // If all agents failed, throw the last error
      if (results.intermediateSteps.length === 0 && lastError) {
        console.error('[AUTONOMOUS_TASK] All agents failed. Last error:', lastError.message);
        throw new Error(`All agents failed: ${lastError.message}. Please check API keys and model configuration.`);
      }

      // Final result
      results.finalResult = currentInput;
      results.expectedOutputFormat = executionPlan.expectedOutputFormat;

      // Update context
      contextMemory.updateContext(sessionId, {
        finalResult: currentInput,
      });

      results.executionTime = Date.now() - startTime;

      return results;
    } catch (error) {
      results.error = error.message;
      results.executionTime = Date.now() - startTime;
      throw error;
    }
  }
}

export default new AgentManager();
