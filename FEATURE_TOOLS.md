# Agent Tool System - Feature Guide

## 🎉 New Feature: Agent Tools

Your AI agents can now **execute actions** beyond just answering questions!

## What Can Agents Do Now?

✅ **Read files** from the outputs directory  
✅ **Write/create files** (text, JSON, HTML, Markdown)  
✅ **Analyze data** (CSV parsing, statistics, aggregations)  
✅ **Generate reports** (formatted HTML or Markdown)  
✅ **Execute code** (safe JavaScript execution)  
✅ **List files** in the outputs directory  

## Quick Example

**User:** "Analyze our Q4 sales and create a summary report"

**Agent does:**
1. Reads the sales CSV file
2. Calculates statistics (mean, median, min, max)
3. Generates a professional HTML report
4. Saves it to `/outputs`
5. Returns the report link

**Result:** A complete analysis report ready to use!

## How It Works

Agents embed tool requests in their responses using this syntax:
```
[TOOL_CALL: toolName({"param": "value"})]
```

The server automatically detects, executes, and returns results.

## Getting Started

### 1. Install & Update
```bash
npm install
```

### 2. Run Tests
```bash
node test-tools.js
```

### 3. Start Server
```bash
npm start
```

### 4. Try It!
Chat with agents and ask them to:
- "Create a report"
- "Analyze this data"
- "Write a summary"
- "Calculate something"

## Documentation

- **[TOOL_QUICKSTART.md](./TOOL_QUICKSTART.md)** - Quick start guide
- **[TOOL_SYSTEM.md](./TOOL_SYSTEM.md)** - Complete documentation
- **[TOOL_IMPLEMENTATION_SUMMARY.md](./TOOL_IMPLEMENTATION_SUMMARY.md)** - Implementation details
- **[TOOL_FRONTEND_EXAMPLE.js](./TOOL_FRONTEND_EXAMPLE.js)** - React/JavaScript integration

## API Endpoints

### Get Available Tools
```bash
curl http://localhost:4000/api/tools
```

### Execute a Tool
```bash
curl -X POST http://localhost:4000/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"toolId": "writeFile", "params": {"filename": "test.txt", "content": "Hello"}}'
```

### Process Agent Response with Tool Calls
```bash
curl -X POST http://localhost:4000/api/tools/process-response \
  -H "Content-Type: application/json" \
  -d '{"responseText": "[TOOL_CALL: listFiles({})]"}'
```

## Available Tools

| Tool | Purpose |
|------|---------|
| **readFile** | Read a file from outputs |
| **writeFile** | Create or update a file |
| **analyzeData** | Analyze CSV/JSON data |
| **generateReport** | Create HTML/Markdown reports |
| **listFiles** | List files in outputs |
| **executeCode** | Run JavaScript code |

## Frontend Integration

See [TOOL_FRONTEND_EXAMPLE.js](./TOOL_FRONTEND_EXAMPLE.js) for:
- React hooks and components
- Vanilla JavaScript examples
- API integration patterns
- UI components for displaying results

## Test Results

Run `node test-tools.js` to verify everything works. Expected output:
```
Tests Passed: 8/8
Tests Failed: 0/8
```

All tests should pass! ✓

## Use Cases

### 📊 Data Analysis
Agents analyze data files and create reports

### 📝 Document Generation
Agents create formatted documents automatically

### 🔢 Calculations
Agents execute code for complex calculations

### 🔍 File Processing
Agents process and summarize files

## Next Steps

1. ✅ Test with `node test-tools.js`
2. ✅ Chat with agents using tool-enabled prompts
3. ✅ Check `/outputs` for generated files
4. ✅ Integrate into your React UI (see TOOL_FRONTEND_EXAMPLE.js)
5. ✅ Build custom workflows using agent tools

## Files Modified/Created

**New Files:**
- `server/toolRegistry.js` - Tool definitions
- `server/toolExecutor.js` - Tool execution engine
- `test-tools.js` - Comprehensive test suite
- `TOOL_SYSTEM.md` - Complete documentation
- `TOOL_QUICKSTART.md` - Quick start guide
- `TOOL_IMPLEMENTATION_SUMMARY.md` - Implementation details
- `TOOL_FRONTEND_EXAMPLE.js` - Frontend integration examples

**Modified Files:**
- `server/index.js` - Added tool endpoints
- `package.json` - Added papaparse dependency

## Troubleshooting

### Tools not working?
→ Run `node test-tools.js` to diagnose

### Agent not using tools?
→ Check agent's system prompt includes tool instructions

### File not found?
→ Tools only work with files in `/outputs` directory

## Security

- ✅ File access restricted to `/outputs` directory
- ✅ Input validation on all parameters
- ✅ Error handling for tool failures
- ✅ Safe code execution sandbox

## Questions?

Refer to the documentation files:
1. `TOOL_QUICKSTART.md` - For quick examples
2. `TOOL_SYSTEM.md` - For detailed documentation
3. `TOOL_FRONTEND_EXAMPLE.js` - For code examples

---

**Ready to go!** Test the system with `node test-tools.js` 🚀
