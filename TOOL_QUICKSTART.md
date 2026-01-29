# Agent Tool System - Quick Start Guide

## What's New?

Your agents can now **take actions** beyond just chatting! They can:

✅ **Read and write files**  
✅ **Analyze data (CSV/JSON)**  
✅ **Generate formatted reports**  
✅ **Execute JavaScript code**  
✅ **List available files**  

## How Agents Use Tools

Agents automatically request tools by writing this syntax in their responses:

```
[TOOL_CALL: toolName({"param": "value"})]
```

The server detects this syntax, executes the tool, and returns the result.

## Example: Generate a Report

**You:** "Create a summary report of our quarterly performance"

**Agent Response:**
```
I'll create a comprehensive quarterly performance report.

[TOOL_CALL: generateReport({
  "title": "Q4 2025 Performance Report",
  "sections": [
    {
      "title": "Executive Summary",
      "content": "Our Q4 performance exceeded projections..."
    },
    {
      "title": "Key Metrics",
      "content": "Revenue increased by 25% YoY..."
    }
  ],
  "format": "html"
})]

The report has been generated and saved to the outputs folder.
```

**Result:** ✓ HTML file created in `/outputs/` directory

## Testing the Tool System

### 1. Start your server
```bash
cd full-stack
npm install
npm start
```

### 2. Run the test suite
```bash
node test-tools.js
```

You'll see output like:
```
╔════════════════════════════════════════════╗
║   Agent Tool System - Test Suite           ║
╚════════════════════════════════════════════╝

=== Test 1: Get Available Tools ===
✓ Found 6 tools:
  - Read File (readFile): Read contents of a file from the outputs directory
  - Write File (writeFile): Create or update a file in the outputs directory
  ...
```

## Available Tools

| Tool | Purpose | Example |
|------|---------|---------|
| **readFile** | Read a file from outputs | `[TOOL_CALL: readFile({"filename": "data.csv"})]` |
| **writeFile** | Create/update a file | `[TOOL_CALL: writeFile({"filename": "report.txt", "content": "..."})]` |
| **analyzeData** | Analyze CSV/JSON data | `[TOOL_CALL: analyzeData({"filename": "sales.csv", "operation": "statistics", "column": "revenue"})]` |
| **generateReport** | Create formatted reports | `[TOOL_CALL: generateReport({"title": "Report", "sections": [...], "format": "html"})]` |
| **listFiles** | See files in outputs | `[TOOL_CALL: listFiles({})]` |
| **executeCode** | Run JavaScript code | `[TOOL_CALL: executeCode({"code": "return 2 + 2;"})]` |

## Use Cases

### 📊 Data Analysis
"Analyze this sales data and create a summary report"
- Agent reads CSV file
- Computes statistics
- Generates formatted report
- Saves to outputs

### 📝 Document Generation
"Create a project proposal document"
- Agent generates structured content
- Saves as HTML/Markdown
- Creates professional formatting
- Stores in outputs folder

### 🔢 Calculations
"Calculate compound interest and show me the breakdown"
- Agent executes calculation code
- Shows intermediate results
- Saves calculations to file
- Provides explanation

### 🔍 File Processing
"Summarize all the files in our data folder"
- Agent lists available files
- Reads each file
- Creates comprehensive summary
- Saves summary report

## REST API Usage

### Get Available Tools
```bash
curl http://localhost:4000/api/tools
```

### Execute a Tool Directly
```bash
curl -X POST http://localhost:4000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolId": "writeFile",
    "params": {
      "filename": "hello.txt",
      "content": "Hello, World!"
    }
  }'
```

### Process Agent Response with Tool Calls
```bash
curl -X POST http://localhost:4000/api/tools/process-response \
  -H "Content-Type: application/json" \
  -d '{
    "responseText": "[TOOL_CALL: listFiles({})] The files are listed above."
  }'
```

## Frontend Integration

To use tools in your React/Vue frontend:

```javascript
// Get available tools
const toolsResponse = await fetch('http://localhost:4000/api/tools');
const { tools } = await toolsResponse.json();

// Process an agent response that contains tool calls
const processResponse = await fetch('http://localhost:4000/api/tools/process-response', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    responseText: agentResponse
  })
});

const { hasToolCalls, results, modifiedResponse } = await processResponse.json();

if (hasToolCalls) {
  console.log('Tools executed:', results);
  console.log('Updated response:', modifiedResponse);
}
```

## Files Modified/Created

### New Files:
- `server/toolRegistry.js` - Tool definitions and handlers
- `server/toolExecutor.js` - Tool call parsing and execution
- `test-tools.js` - Comprehensive test suite
- `TOOL_SYSTEM.md` - Detailed documentation
- `TOOL_QUICKSTART.md` - This file

### Modified Files:
- `server/index.js` - Added tool endpoints and updated agent system prompts

## Next Steps

1. ✅ Run `node test-tools.js` to verify everything works
2. ✅ Try chatting with agents and have them use tools
3. ✅ Check `/outputs` folder for generated files
4. ✅ Customize agents with tool instructions (see TOOL_SYSTEM.md)
5. ✅ Build UI to display generated reports/files

## Troubleshooting

### Tools not working?
1. Check server is running on port 4000
2. Verify `/outputs` directory exists
3. Run `node test-tools.js` to diagnose
4. Check console for error messages

### Agent not using tools?
1. Make sure agent's system prompt mentions tools
2. Verify syntax: `[TOOL_CALL: toolName({...})]`
3. Check tool name matches exactly (case-sensitive)

### File not found?
- Tools only work with files in `/outputs` directory
- Make sure filename is correct
- Run `listFiles` tool to see available files

## What's Next?

Future tool ideas:
- 🌐 Web scraping tool
- 📧 Email sending tool
- 🖼️ Image generation tool
- 🗄️ Database operations
- 📅 Task scheduling
- 💾 Advanced data processing

## Need Help?

See `TOOL_SYSTEM.md` for detailed documentation and examples.
