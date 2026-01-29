# Agent Tool System Documentation

## Overview

The Agent Tool System enables AI agents to execute actions beyond just generating text. Agents can now:
- **Read and write files** in the outputs directory
- **Analyze data** from CSV and JSON files
- **Generate reports** in HTML or Markdown format
- **Execute code** safely in a sandboxed environment
- **List available files** to understand what data exists

## How It Works

### 1. Tool Call Syntax

Agents communicate tool requests using a special syntax embedded in their responses:

```
[TOOL_CALL: toolName({"param1": "value1", "param2": "value2"})]
```

**Example:**
```
I'll create a report summarizing the findings.
[TOOL_CALL: generateReport({"title": "Analysis Report", "sections": [{"title": "Executive Summary", "content": "Key findings..."}], "format": "html"})]
```

### 2. Available Tools

#### `readFile`
Read contents of a file from the outputs directory.

**Parameters:**
- `filename` (string, required): Name of file to read

**Example:**
```
[TOOL_CALL: readFile({"filename": "data.csv"})]
```

#### `writeFile`
Create or update a file in the outputs directory.

**Parameters:**
- `filename` (string, required): Name of file to create/update
- `content` (string, required): Content to write
- `format` (string, optional): 'text', 'json', 'html', 'markdown' (default: 'text')

**Example:**
```
[TOOL_CALL: writeFile({"filename": "results.json", "content": "{\"status\": \"success\"}", "format": "json"})]
```

#### `analyzeData`
Parse and analyze CSV/JSON data, compute statistics.

**Parameters:**
- `filename` (string, required): Name of CSV or JSON file in outputs directory
- `operation` (string, required): 'summary', 'statistics', 'count', 'distinct'
- `column` (string, optional): Column to analyze (for statistics/distinct operations)

**Example:**
```
[TOOL_CALL: analyzeData({"filename": "sales.csv", "operation": "statistics", "column": "revenue"})]
```

**Operations:**
- `summary`: Returns total rows and column names
- `count`: Returns number of rows
- `statistics`: Returns mean, median, min, max, sum, range for a numeric column
- `distinct`: Returns unique values in a column

#### `generateReport`
Generate a formatted report and save it as HTML or Markdown.

**Parameters:**
- `title` (string, optional): Report title
- `sections` (array, optional): Array of sections with `title` and `content`
- `format` (string, optional): 'html' or 'markdown' (default: 'html')

**Example:**
```
[TOOL_CALL: generateReport({"title": "Monthly Report", "sections": [{"title": "Overview", "content": "This month was productive..."}], "format": "html"})]
```

#### `listFiles`
List all files in the outputs directory.

**Parameters:** None

**Example:**
```
[TOOL_CALL: listFiles({})]
```

#### `executeCode`
Execute JavaScript code safely and see results.

**Parameters:**
- `code` (string, required): JavaScript code to execute

**Example:**
```
[TOOL_CALL: executeCode({"code": "return 2 + 2;"})]
```

## Architecture

### Components

1. **toolRegistry.js** - Defines all available tools and their handlers
2. **toolExecutor.js** - Parses agent responses and executes tool calls
3. **API Endpoints** - REST endpoints for tool execution

### API Endpoints

#### GET /api/tools
Get list of available tools and their parameters.

**Response:**
```json
{
  "success": true,
  "tools": [
    {
      "id": "readFile",
      "name": "Read File",
      "description": "Read contents of a file from the outputs directory",
      "parameters": {...}
    }
  ],
  "count": 6
}
```

#### POST /api/tools/execute
Execute a tool directly (not through an agent).

**Request:**
```json
{
  "toolId": "writeFile",
  "params": {
    "filename": "test.txt",
    "content": "Hello World"
  }
}
```

**Response:**
```json
{
  "success": true,
  "toolId": "writeFile",
  "result": {
    "filename": "test.txt",
    "size": 11,
    "message": "File successfully written"
  }
}
```

#### POST /api/tools/process-response
Process a full agent response and execute any tool calls found.

**Request:**
```json
{
  "responseText": "I will analyze the data. [TOOL_CALL: readFile({\"filename\": \"data.csv\"})]"
}
```

**Response:**
```json
{
  "success": true,
  "hasToolCalls": true,
  "toolCalls": [
    {
      "tool": "readFile",
      "params": {"filename": "data.csv"}
    }
  ],
  "results": [
    {
      "tool": "readFile",
      "success": true,
      "result": {...}
    }
  ],
  "modifiedResponse": "I will analyze the data. [TOOL_RESULT: {...}]"
}
```

## Usage Examples

### Example 1: Document Generation

**User:** "Create a report summarizing the key metrics"

**Agent Response:**
```
I'll analyze the data and create a comprehensive report for you.

First, let me list the available files to see what data we have:
[TOOL_CALL: listFiles({})]

Now I'll generate the report:
[TOOL_CALL: generateReport({
  "title": "Key Metrics Report",
  "sections": [
    {
      "title": "Overview",
      "content": "This report provides a summary of key performance metrics."
    },
    {
      "title": "Data Summary",
      "content": "Analysis shows strong performance trends..."
    }
  ],
  "format": "html"
})]
```

**Result:** A new HTML file is created in the `/outputs` directory and the agent returns the file path and results.

### Example 2: Data Analysis

**User:** "Analyze the sales data and tell me the average revenue"

**Agent Response:**
```
I'll analyze your sales data right away.
[TOOL_CALL: analyzeData({"filename": "sales.csv", "operation": "statistics", "column": "revenue"})]

Based on the analysis, the average revenue is [TOOL_RESULT: showing the mean value].
```

### Example 3: Code Execution

**User:** "Calculate the compound interest for $1000 at 5% annual rate for 10 years"

**Agent Response:**
```
I'll calculate the compound interest for you.
[TOOL_CALL: executeCode({"code": "const principal = 1000; const rate = 0.05; const years = 10; return principal * Math.pow(1 + rate, years);"})]

The final amount after 10 years would be [TOOL_RESULT: $1628.89].
```

## Security Considerations

1. **File Access Restrictions**: Tools can only read/write files in the `/outputs` directory
2. **Code Execution Sandbox**: Code execution uses Function constructor (more restrictive than eval)
3. **Input Validation**: All tool parameters are validated before execution
4. **Error Handling**: Tool failures are caught and returned gracefully

## Integration with Agents

The tool system is automatically integrated into all agents:

1. **System Prompt Enhancement**: Each agent's system prompt includes tool information
2. **Tool Syntax**: Agents are instructed to use `[TOOL_CALL: ...]` syntax
3. **Automatic Parsing**: Server automatically detects and executes tool calls
4. **Result Injection**: Tool results are injected back into the response

## Setting Up Custom Agents with Tools

To create a new agent that can use tools:

```javascript
const myAgent = {
  id: 'my-agent',
  name: 'My Custom Agent',
  systemPrompt: `You are my custom specialist. You can use the following tools:
  - readFile: Read files from outputs
  - writeFile: Write files to outputs
  - analyzeData: Analyze data
  - generateReport: Create reports
  - listFiles: See available files
  - executeCode: Run JavaScript code
  
  To use a tool, format it as: [TOOL_CALL: toolName({"param": "value"})]`,
  modelId: 'gpt-4o-mini',
  capabilities: ['your', 'capabilities'],
  outputFormat: 'text'
};
```

## Future Enhancements

1. **Web Scraping Tool**: Fetch and summarize web content
2. **API Integration Tool**: Make HTTP requests to external APIs
3. **Image Generation Tool**: Use DALL-E or similar to generate images
4. **Database Tools**: Read/write to databases
5. **Email Tool**: Send emails from agents
6. **Scheduling**: Run agents on schedules
7. **Persistent Memory**: Agents remembering what they've done

## Troubleshooting

### Tool Not Being Called

1. Check the syntax: `[TOOL_CALL: toolName({...})]`
2. Verify JSON parameters are valid
3. Ensure tool name matches exactly (case-sensitive)

### Tool Execution Fails

Check the error message returned in `[TOOL_ERROR: ...]` tags. Common issues:
- File not found (check filename)
- Invalid JSON in parameters
- Insufficient permissions (only /outputs directory allowed)

### Agent Not Mentioning Tools

Make sure the agent's system prompt includes tool information. Check that the agent is using one of the default agents or has tools mentioned in their system prompt.

## API Testing

### Test with curl

```bash
# Get available tools
curl http://localhost:4000/api/tools

# Execute a tool directly
curl -X POST http://localhost:4000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"toolId":"writeFile","params":{"filename":"test.txt","content":"Hello"}}'

# Process agent response
curl -X POST http://localhost:4000/api/tools/process-response \
  -H "Content-Type: application/json" \
  -d '{"responseText":"[TOOL_CALL: listFiles({})]"}'
```
