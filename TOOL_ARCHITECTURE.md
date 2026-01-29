# Agent Tool System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                         │
│                  (React/Vue Component)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ├──────── User sends message
                       │         "Create a report"
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                           │
│                  (Node.js/port 4000)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
    ┌─────────┐  ┌──────────┐  ┌─────────────┐
    │ /api/   │  │ /api/    │  │ /api/tools/ │
    │ chat    │  │orchestr..│  │process-resp │
    │         │  │          │  │             │
    └────┬────┘  └────┬─────┘  └────┬────────┘
         │             │             │
         │             ▼             │
         │        ┌──────────────┐   │
         │        │ AgentManager │   │
         │        │ AgentRegistry│   │
         │        └──────┬───────┘   │
         │               │           │
         │               ▼           │
         │        ┌──────────────┐   │
         └───────▶│ callAgent()  │   │
                  │  Handler     │   │
                  └──────┬───────┘   │
                         │           │
                         │           │
      ┌──────────────────┴──────┐    │
      │                         │    │
      ▼                         ▼    │
┌──────────────────┐    ┌───────────────────┐
│ LLM API Calls    │    │  Tool Executor    │
│ (Gemini/OpenAI) │    │ (toolExecutor.js) │
└────────┬─────────┘    └────────┬──────────┘
         │                       │
         │ Agent Response         │
         │ with Tool Calls        │ Detects & parses
         │ [TOOL_CALL: ...]      │ [TOOL_CALL: ...]
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌──────────────────────┐
         │  Tool Registry       │
         │ (toolRegistry.js)    │
         └────────┬─────────────┘
                  │
     ┌────────────┼────────────┬───────────────┐
     │            │            │               │
     ▼            ▼            ▼               ▼
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│readFile │  │writeFile│  │analyzeD │  │generate │
│         │  │         │  │ata      │  │Report   │
└────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘
     │            │            │            │
     │            │            │            │
     ▼            ▼            ▼            ▼
   /outputs/ Directory (File Storage)
     │
     ├── data.csv
     ├── report.html
     ├── summary.txt
     └── results.json
```

## Request Flow - Detailed

### 1. User Sends Request
```
User: "Create a report analyzing sales"
         │
         ▼
GET /api/orchestrated-chat-stream?agentIds=[...]&userPrompt=...
```

### 2. Agent Processing
```
Server receives request
    │
    ├─ Create workflow with agents
    │
    └─ Agent 1: Research Agent
         │
         ├─ Receives: "Create a report analyzing sales"
         │
         ├─ Thinks: "I need to read data, analyze it, and create a report"
         │
         ├─ Generates response with tool calls:
         │  "I'll analyze the sales data.
         │   [TOOL_CALL: readFile({"filename": "sales.csv"})]
         │   [TOOL_CALL: analyzeData({"filename": "sales.csv", "operation": "statistics", "column": "revenue"})]
         │   [TOOL_CALL: generateReport({"title": "Sales Report", "sections": [...]})]"
         │
         └─ Returns to server
```

### 3. Tool Execution
```
Tool Executor receives agent response
    │
    ├─ Parse: Detects [TOOL_CALL: ...] patterns
    │
    ├─ Extract: readFile, analyzeData, generateReport
    │
    ├─ Execute:
    │  ├─ readFile → loads sales.csv
    │  ├─ analyzeData → computes statistics
    │  └─ generateReport → creates HTML report
    │
    ├─ Replace tool calls with results:
    │  [TOOL_RESULT: {...result...}]
    │
    └─ Return modified response to user
```

### 4. Response to User
```
Modified response with tool results:

"I'll analyze the sales data.
[TOOL_RESULT: {...file content...}]

Now analyzing the data for key metrics:
[TOOL_RESULT: {"mean": 50000, "min": 25000, "max": 100000...}]

Report generated and saved:
[TOOL_RESULT: {"filename": "report-1234567.html", "path": "...", "size": 5432}]

The comprehensive sales report has been created successfully."
```

## Component Interactions

### Server Components
```
Express Server
│
├─ Route Handlers
│  ├─ POST /api/chat
│  ├─ POST /api/orchestrated-chat
│  ├─ GET /api/orchestrated-chat-stream
│  ├─ GET /api/tools                    ◄─ NEW
│  ├─ POST /api/tools/execute           ◄─ NEW
│  └─ POST /api/tools/process-response  ◄─ NEW
│
├─ Agent Management
│  ├─ AgentManager
│  ├─ AgentRegistry
│  └─ TaskPlanner
│
├─ Tool System (NEW)
│  ├─ toolExecutor (parse & execute)
│  ├─ toolRegistry (tool definitions)
│  └─ Tool implementations
│      ├─ readFile
│      ├─ writeFile
│      ├─ analyzeData
│      ├─ generateReport
│      ├─ listFiles
│      └─ executeCode
│
├─ LLM Integration
│  ├─ callGemini
│  ├─ callOpenAICompatible
│  └─ modelHandlers
│
└─ Utilities
   ├─ conversationMemory
   ├─ intentClassifier
   ├─ outputGenerators
   └─ promptVersioning
```

## Data Flow - Tool Execution

```
Agent Response Text
        │
        ▼
toolExecutor.executeToolCalls(text)
        │
        ├─ Parse: regex match [TOOL_CALL: ...]
        │         Extract: toolName, params JSON
        │
        ├─ For each tool call:
        │  │
        │  └─ toolRegistry.executeTool(toolName, params)
        │     │
        │     ├─ Find tool definition
        │     │
        │     ├─ Validate parameters
        │     │
        │     ├─ Execute handler function
        │     │
        │     └─ Return result or error
        │
        ├─ Replace tool call with result
        │  [TOOL_CALL: ...] → [TOOL_RESULT: ...]
        │                  or [TOOL_ERROR: ...]
        │
        └─ Return modified response
```

## File System Structure

```
FSDP_Assg/full-stack/
│
├─ server/
│  ├─ index.js                    (Main Express app - MODIFIED)
│  ├─ agentManager.js            (Orchestration)
│  ├─ agentRegistry.js           (Agent definitions)
│  ├─ intentClassifier.js        (Intent analysis)
│  ├─ taskPlanner.js             (Task planning)
│  ├─ toolRegistry.js            ◄─ NEW
│  ├─ toolExecutor.js            ◄─ NEW
│  ├─ contextMemory.js
│  ├─ conversationMemory.js
│  ├─ outputGenerators.js
│  ├─ promptVersioning.js
│  └─ migrations/
│
├─ outputs/                       (Tool file storage)
│  ├─ data.csv
│  ├─ report-1234567.html
│  ├─ summary-1234567.md
│  └─ results.json
│
├─ public/                        (Static files)
├─ src/                          (React components)
│
├─ test-tools.js                 ◄─ NEW
├─ TOOL_SYSTEM.md                ◄─ NEW
├─ TOOL_QUICKSTART.md            ◄─ NEW
├─ TOOL_IMPLEMENTATION_SUMMARY.md ◄─ NEW
├─ TOOL_FRONTEND_EXAMPLE.js      ◄─ NEW
├─ FEATURE_TOOLS.md              ◄─ NEW
└─ package.json                  (MODIFIED - added papaparse)
```

## Security Architecture

```
Tool Execution
    │
    ├─ Input Validation
    │  ├─ Check tool exists
    │  ├─ Validate parameters
    │  └─ Type checking
    │
    ├─ Access Control
    │  ├─ File operations limited to /outputs
    │  ├─ No parent directory access (..)
    │  └─ Safe filename sanitization
    │
    ├─ Execution Sandbox
    │  ├─ Code uses Function constructor (not eval)
    │  ├─ No access to process/require
    │  └─ Timeout protection
    │
    └─ Error Handling
       ├─ Try/catch blocks
       ├─ Error messages logged
       └─ User-friendly error returns
```

## Tool Definition Structure

```
Tool Definition
{
  id: "toolName",
  name: "Display Name",
  description: "What it does",
  parameters: {
    param1: {
      type: "string",
      description: "Parameter description"
    },
    ...
  },
  handler: async (params) => {
    // Implementation
    return result;
  }
}
```

## API Response Format

### Success Response
```json
{
  "success": true,
  "toolId": "writeFile",
  "result": {
    "filename": "report.txt",
    "size": 1234,
    "message": "File successfully written"
  }
}
```

### Error Response
```json
{
  "success": false,
  "toolId": "readFile",
  "error": "File not found: nonexistent.txt"
}
```

### Processing Response
```json
{
  "success": true,
  "hasToolCalls": true,
  "toolCalls": [
    {
      "tool": "readFile",
      "params": { "filename": "data.csv" }
    }
  ],
  "results": [
    {
      "tool": "readFile",
      "success": true,
      "result": { "filename": "data.csv", "content": "..." }
    }
  ],
  "modifiedResponse": "..."
}
```

## Performance Considerations

```
Tool Execution Timeline
├─ Parse tool calls: ~1ms
├─ Tool lookup: <1ms
├─ Parameter validation: ~1ms
├─ File I/O operations: ~10-100ms
├─ Data analysis (large files): ~50-500ms
└─ Total: ~60-600ms per request
```

## Error Handling Flow

```
Tool Call Fails
    │
    ├─ Catch exception
    │
    ├─ Log error with context
    │
    ├─ Return graceful error:
    │  {
    │    "success": false,
    │    "error": "User-friendly message"
    │  }
    │
    └─ Replace in response:
       [TOOL_ERROR: error message]
```

## Future Expansion

```
Current Tools (6)
├─ readFile
├─ writeFile
├─ analyzeData
├─ generateReport
├─ listFiles
└─ executeCode

Potential Future Tools
├─ webScraper
├─ apiCaller
├─ imageGenerator
├─ databaseQuery
├─ emailSender
├─ taskScheduler
└─ ...
```

---

This architecture enables **agents to take actions**, transforming them from passive chat interfaces to active automation tools. 🚀
