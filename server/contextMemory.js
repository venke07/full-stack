/**
 * Context Memory System
 * Manages shared state and data between agents during orchestrated workflows
 */

class ContextMemory {
  constructor() {
    this.contexts = new Map(); // Store by sessionId
  }

  /**
   * Create a new context for a workflow session
   */
  createContext(sessionId, initialData = {}) {
    const context = {
      sessionId,
      createdAt: new Date(),
      data: {
        userPrompt: '',
        intent: null,
        subtasks: [],
        agentOutputs: {},
        finalResult: null,
        ...initialData,
      },
      history: [],
    };
    this.contexts.set(sessionId, context);
    return context;
  }

  /**
   * Get context for a session
   */
  getContext(sessionId) {
    return this.contexts.get(sessionId);
  }

  /**
   * Update context data
   */
  updateContext(sessionId, updates) {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }
    context.data = { ...context.data, ...updates };
    context.updatedAt = new Date();
    return context;
  }

  /**
   * Add to agent outputs
   */
  addAgentOutput(sessionId, agentName, output) {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }
    context.data.agentOutputs[agentName] = output;
    context.history.push({
      timestamp: new Date(),
      agent: agentName,
      action: 'output',
      data: output,
    });
    return context;
  }

  /**
   * Get agent output
   */
  getAgentOutput(sessionId, agentName) {
    const context = this.contexts.get(sessionId);
    if (!context) return null;
    return context.data.agentOutputs[agentName];
  }

  /**
   * Add history entry
   */
  addHistoryEntry(sessionId, entry) {
    const context = this.contexts.get(sessionId);
    if (!context) {
      throw new Error(`Context not found for session: ${sessionId}`);
    }
    context.history.push({
      timestamp: new Date(),
      ...entry,
    });
    return context;
  }

  /**
   * Get full workflow history
   */
  getHistory(sessionId) {
    const context = this.contexts.get(sessionId);
    if (!context) return [];
    return context.history;
  }

  /**
   * Clear context (cleanup after workflow completes)
   */
  clearContext(sessionId) {
    this.contexts.delete(sessionId);
  }

  /**
   * Get all active contexts
   */
  getAllContexts() {
    return Array.from(this.contexts.values());
  }
}

export default new ContextMemory();
