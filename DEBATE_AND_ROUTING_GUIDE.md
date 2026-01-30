# Multi-Agent Debate & Smart Routing Features

## Overview

Two powerful new modes for multi-agent interactions:

1. **Smart Routing Mode** - Automatically selects best agents for your task
2. **Debate Mode** - Agents discuss topics and reach consensus

---

## 🎯 Smart Routing Mode

### What It Does
Analyzes your query and intelligently selects the most relevant agents from your available agents.

**Flow:**
1. You describe what you need
2. System analyzes your request
3. Shows confidence scores for matched agents
4. Automatically uses the best agents to solve your problem
5. Displays results in real-time

### How to Use
1. Click **"Smart Routing"** tab in the mode selector
2. Type your request (don't need to pre-select agents)
3. Hit Send
4. Watch as the system:
   - Shows task analysis
   - Lists suggested agents with relevance scores
   - Executes the workflow with best agents
   - Delivers results

### Example Use Cases
- "Analyze this dataset and create a report" → Auto-selects Research + Document agents
- "Write code for authentication" → Auto-selects Code agent + Documentation agent
- "Create a marketing campaign" → Auto-selects Content + Strategy agents

### Technical Details

**Backend:** `/api/smart-routing` (POST)
- Analyzes user prompt
- Ranks all available agents by relevance (0-100%)
- Returns top N agents for orchestration

**Response includes:**
- `analysis` - What the system detected in your request
- `topAgents` - Array of suggested agents with scores
- `reason` - Why each agent was selected

---

## 🎬 Debate Mode

### What It Does
Creates a structured discussion where agents present arguments, rebut each other, and reach consensus.

**Flow:**
1. Each agent presents initial position/argument
2. Agents read each other's positions
3. Each agent presents a rebuttal
4. System analyzes consensus and disagreements
5. Final verdict shows agreement points & strongest arguments

### How to Use
1. Click **"Debate"** tab in the mode selector
2. Select **at least 2 agents** for the debate
3. Enter the topic/question you want debated
4. Hit Send
5. Watch the debate unfold with:
   - 💬 Initial positions from each agent
   - 🔄 Rebuttals and counter-arguments
   - 🤝 Consensus analysis
   - Winner - strongest argument identified

### Example Topics
- "Microservices vs Monolithic Architecture"
- "Remote vs Office Work"
- "API-First vs Database-First Design"
- "React vs Vue vs Angular"
- "Should we use TypeScript?"

### Debate Structure

**Stage 1: Initial Positions**
- Each agent presents their initial stance
- Arguments are 2-3 paragraphs each
- Tagged with 💬 Initial Position

**Stage 2: Rebuttals**
- Agents see other positions
- Each rebuts at least one other agent
- Can agree/disagree with points
- Tagged with 🔄 Rebuttal

**Stage 3: Consensus**
Shows:
- **Agreement Points**: Where agents agreed
- **Disagreements**: Unresolved conflicts
- **Conclusion**: Balanced summary
- **Strongest Argument**: Which agent made the most compelling case

### Example Output

```
🎬 Debate Starting
Topic: Should we use a microservice architecture?
3 agents ready to discuss

💬 Agent 1 (Backend Expert):
Microservices provide scalability and independent deployment...

💬 Agent 2 (DevOps Engineer):
Monoliths are simpler to operate initially...

🔄 Agent 1 (Rebuttal):
While simpler initially, monoliths create scaling bottlenecks...

🤝 Consensus
Agreement Points:
• Depends on team size and scale
• Both need proper monitoring

Strongest Argument: Backend Expert - Made compelling case about scaling
```

### Technical Details

**Backend:** `/api/debate-mode` (POST)
- Streams events for real-time display
- Each agent gets full context of debate
- Uses `EventSource` for live updates

**Event Types:**
- `debate-start` - Initialize debate
- `agent-position` - Initial argument
- `agent-rebuttal` - Response/rebuttal
- `consensus-reached` - Analysis complete
- `error` - Any issues

---

## 🎨 Visual Indicators

### Message Styling

| Type | Color | Icon | Use |
|------|-------|------|-----|
| Debate Start | Purple | 🎬 | Debate initialization |
| Initial Position | Purple | 💬 | Agent's opening argument |
| Rebuttal | Green | 🔄 | Agent's response |
| Consensus | Green+Blue | 🤝 | Final agreement analysis |
| Smart Routing | Blue | 🎯 | Agent selection |
| Intent Analysis | Cyan | 🔍 | Task understanding |

### Left Border Colors
- Purple (`rgba(168, 85, 247, 0.5)`) - Debate positions
- Green (`rgba(34, 197, 94, 0.5)`) - Rebuttals
- Blue (`rgba(59, 130, 246, 0.5)`) - Routing

---

## 🔧 Configuration

### Smart Routing
- Uses `gpt-4o-mini` for analysis
- Ranks agents 0-100% relevance
- Returns top 3 agents by default
- Can be adjusted in `/api/smart-routing` response

### Debate Mode
- Requires 2+ agents minimum
- Each stage processes sequentially
- Temperature: 0.7 (creative but focused)
- Uses latest agent's model_id from database

---

## 🚀 Performance Tips

1. **Smart Routing**
   - Works best with 5-20 agents
   - Provide clear, specific requests
   - Results stream in real-time

2. **Debate Mode**
   - Better with 2-3 agents (faster)
   - Select agents with different perspectives
   - Works with all model types

---

## 📝 Example Prompts

### Smart Routing
- "Create a data pipeline to analyze customer behavior"
- "Write and test a REST API"
- "Build a marketing strategy with content calendar"
- "Debug why the application is slow"

### Debate
- "Is AI a threat to software developers?"
- "Should we adopt a NoSQL database?"
- "Mobile-first vs desktop-first approach?"
- "Open source vs proprietary solutions?"

---

## 🎯 Best Practices

1. **Smart Routing**
   - Be specific about outcomes
   - Mention data types or formats
   - Include any constraints

2. **Debate**
   - Choose agents with opposing views
   - Ask open-ended questions
   - Allow time for full debate cycle

---

## 🔄 Workflow Integration

Both modes integrate with existing features:
- Agent responses saved to conversation history
- Can export debate transcripts
- Results feed into autonomous tasks
- Team collaboration on debate conclusions

---

## ⚠️ Notes

- Smart routing auto-selects best agents (no manual selection needed)
- Debate requires manual agent selection for fairness
- Both modes stream results for real-time visibility
- All agent system prompts are respected in both modes

