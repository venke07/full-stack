/**
 * Agent Registry System
 * Each agent declares its capabilities, so the system knows what it can do
 */

class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.capabilities = new Map();
    this.initializeDefaultCapabilities();
  }

  /**
   * Initialize default capability categories
   */
  initializeDefaultCapabilities() {
    const defaultCapabilities = [
      {
        id: 'data_research',
        name: 'Data Research',
        description: 'Gather and analyze data for a task',
        keywords: ['research', 'data', 'gather', 'analyze', 'collect'],
      },
      {
        id: 'planning',
        name: 'Planning',
        description: 'Create plans and strategies',
        keywords: ['plan', 'strategy', 'roadmap', 'organize', 'structure'],
      },
      {
        id: 'document_generation',
        name: 'Document Generation',
        description: 'Create and format documents',
        keywords: ['document', 'report', 'write', 'generate', 'format'],
      },
      {
        id: 'image_generation',
        name: 'Image Generation',
        description: 'Create and generate images',
        keywords: ['image', 'visual', 'design', 'draw', 'picture'],
      },
      {
        id: 'code_generation',
        name: 'Code Generation',
        description: 'Write and generate code',
        keywords: ['code', 'function', 'script', 'implement', 'develop'],
      },
      {
        id: 'analysis',
        name: 'Analysis',
        description: 'Analyze and provide insights',
        keywords: ['analyze', 'analyze', 'evaluate', 'assess', 'interpret'],
      },
      {
        id: 'summarization',
        name: 'Summarization',
        description: 'Summarize and condense information',
        keywords: ['summarize', 'summary', 'brief', 'condense', 'highlight'],
      },
      {
        id: 'creative_writing',
        name: 'Creative Writing',
        description: 'Create creative content',
        keywords: ['write', 'creative', 'story', 'narrative', 'fiction'],
      },
      {
        id: 'data_processing',
        name: 'Data Processing',
        description: 'Process and transform data',
        keywords: ['process', 'transform', 'convert', 'parse', 'extract'],
      },
      {
        id: 'quality_assurance',
        name: 'Quality Assurance',
        description: 'Review and validate output',
        keywords: ['review', 'validate', 'check', 'verify', 'quality'],
      },
    ];

    defaultCapabilities.forEach(cap => {
      this.capabilities.set(cap.id, cap);
    });
  }

  /**
   * Register an agent with its capabilities
   */
  registerAgent(agentId, agentConfig) {
    const agent = {
      id: agentId,
      name: agentConfig.name || agentId,
      description: agentConfig.description || '',
      systemPrompt: agentConfig.systemPrompt || '',
      modelId: agentConfig.modelId || 'gpt-4o-mini',
      role: agentConfig.role || 'assistant',
      capabilities: agentConfig.capabilities || [], // Array of capability IDs
      dependencies: agentConfig.dependencies || [], // Agent IDs it depends on
      outputFormat: agentConfig.outputFormat || 'text', // 'text', 'json', 'document', 'image', etc.
      maxTokens: agentConfig.maxTokens || 2000,
    };

    this.agents.set(agentId, agent);
    return agent;
  }

  /**
   * Get an agent by ID
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
   * Get agents by capability
   */
  getAgentsByCapability(capabilityId) {
    return Array.from(this.agents.values()).filter(agent =>
      agent.capabilities.includes(capabilityId)
    );
  }

  /**
   * Find best agent for a capability
   */
  findBestAgentForCapability(capabilityId, excludeAgents = []) {
    const agents = this.getAgentsByCapability(capabilityId);
    return agents.find(agent => !excludeAgents.includes(agent.id)) || agents[0];
  }

  /**
   * Get all capabilities
   */
  getAllCapabilities() {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get capability by ID
   */
  getCapability(capabilityId) {
    return this.capabilities.get(capabilityId);
  }

  /**
   * Find required capabilities for a task
   */
  findRequiredCapabilities(taskDescription) {
    const lowerTask = taskDescription.toLowerCase();
    const requiredCapabilities = new Set();

    // Check each capability's keywords
    for (const [capId, capability] of this.capabilities) {
      for (const keyword of capability.keywords) {
        if (lowerTask.includes(keyword)) {
          requiredCapabilities.add(capId);
          break;
        }
      }
    }

    return Array.from(requiredCapabilities);
  }

  /**
   * Get agents needed for a task
   */
  getAgentsForTask(taskDescription) {
    const requiredCapabilities = this.findRequiredCapabilities(taskDescription);
    const selectedAgents = new Map();

    // For each capability, find the best agent
    for (const capabilityId of requiredCapabilities) {
      const agent = this.findBestAgentForCapability(capabilityId);
      if (agent && !selectedAgents.has(agent.id)) {
        selectedAgents.set(agent.id, agent);
      }
    }

    return Array.from(selectedAgents.values());
  }

  /**
   * Get execution order considering dependencies
   */
  getExecutionOrder(agents) {
    const order = [];
    const processed = new Set();

    const addAgent = (agent) => {
      if (processed.has(agent.id)) return;

      // First add dependencies
      for (const depId of agent.dependencies) {
        const depAgent = this.getAgent(depId);
        if (depAgent && !processed.has(depId)) {
          addAgent(depAgent);
        }
      }

      order.push(agent);
      processed.add(agent.id);
    };

    // Process all agents respecting dependencies
    for (const agent of agents) {
      addAgent(agent);
    }

    return order;
  }
}

export default new AgentRegistry();
