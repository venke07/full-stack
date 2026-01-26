import * as AgentModel from '../model/agentModel.js';

// GET /api/agents
export async function getAgents(req, res) {
  try {
    const data = await AgentModel.getAgents();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

