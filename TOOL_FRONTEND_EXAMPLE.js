/**
 * Frontend Integration Example
 * 
 * This shows how to integrate the tool system into your React/Vue frontend
 * Place this in your src/utils/ or src/services/ directory
 */

/**
 * Tool Service - Handles all tool-related API calls
 */
class ToolService {
  constructor(baseUrl = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Get all available tools
   */
  async getAvailableTools() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tools`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tools');
      }

      return data;
    } catch (error) {
      console.error('Error fetching tools:', error);
      throw error;
    }
  }

  /**
   * Execute a tool directly
   * @param {string} toolId - ID of the tool to execute
   * @param {object} params - Tool parameters
   */
  async executeTool(toolId, params = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, params }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Tool execution failed');
      }

      return data;
    } catch (error) {
      console.error(`Error executing tool ${toolId}:`, error);
      throw error;
    }
  }

  /**
   * Process an agent response and execute any tool calls found
   * @param {string} responseText - Agent response text
   */
  async processAgentResponse(responseText) {
    try {
      const response = await fetch(`${this.baseUrl}/api/tools/process-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseText }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process response');
      }

      return data;
    } catch (error) {
      console.error('Error processing agent response:', error);
      throw error;
    }
  }

  /**
   * Write a file
   */
  async writeFile(filename, content, format = 'text') {
    return this.executeTool('writeFile', { filename, content, format });
  }

  /**
   * Read a file
   */
  async readFile(filename) {
    return this.executeTool('readFile', { filename });
  }

  /**
   * List files in outputs directory
   */
  async listFiles() {
    return this.executeTool('listFiles', {});
  }

  /**
   * Analyze data from CSV/JSON
   */
  async analyzeData(filename, operation = 'summary', column = null) {
    return this.executeTool('analyzeData', { filename, operation, column });
  }

  /**
   * Generate a report
   */
  async generateReport(title, sections = [], format = 'html') {
    return this.executeTool('generateReport', { title, sections, format });
  }

  /**
   * Execute JavaScript code
   */
  async executeCode(code) {
    return this.executeTool('executeCode', { code });
  }
}

export default new ToolService();

// ============================================================================
// REACT COMPONENT EXAMPLES
// ============================================================================

/**
 * Example React Hook for using the tool system
 */
export function useTools() {
  const [tools, setTools] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchTools = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ToolService.getAvailableTools();
      setTools(result.tools);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const executeTool = React.useCallback(
    async (toolId, params) => {
      setLoading(true);
      setError(null);
      try {
        const result = await ToolService.executeTool(toolId, params);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const processAgentResponse = React.useCallback(
    async (responseText) => {
      setLoading(true);
      setError(null);
      try {
        const result = await ToolService.processAgentResponse(responseText);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return {
    tools,
    loading,
    error,
    executeTool,
    processAgentResponse,
    fetchTools,
  };
}

/**
 * Example Component: Display available tools
 */
export function AvailableToolsList() {
  const { tools, loading, error } = useTools();

  if (loading) return <div>Loading tools...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="tools-list">
      <h3>Available Tools</h3>
      <ul>
        {tools.map(tool => (
          <li key={tool.id}>
            <strong>{tool.name}</strong> ({tool.id})
            <p>{tool.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example Component: Display processed agent response with tool results
 */
export function AgentResponseDisplay({ responseText }) {
  const { processAgentResponse, loading, error } = useTools();
  const [result, setResult] = React.useState(null);

  React.useEffect(() => {
    if (responseText) {
      processAgentResponse(responseText).then(setResult).catch(console.error);
    }
  }, [responseText, processAgentResponse]);

  if (loading) return <div>Processing agent response...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!result) return null;

  return (
    <div className="agent-response">
      {result.hasToolCalls && (
        <div className="tool-execution">
          <h4>Tools Executed</h4>
          {result.results.map((tr, i) => (
            <div key={i} className={`tool-result ${tr.success ? 'success' : 'error'}`}>
              <strong>{tr.tool}</strong>: {tr.success ? '✓ Success' : '✗ Failed'}
              {tr.success && tr.result && (
                <pre>{JSON.stringify(tr.result, null, 2)}</pre>
              )}
              {!tr.success && tr.error && (
                <p className="error-message">{tr.error}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="modified-response">
        <h4>Final Response</h4>
        <p>{result.modifiedResponse}</p>
      </div>
    </div>
  );
}

/**
 * Example Component: Manual tool executor
 */
export function ToolExecutor({ toolId, onResult }) {
  const [params, setParams] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const { executeTool } = useTools();

  const handleExecute = async () => {
    setLoading(true);
    try {
      const result = await executeTool(toolId, params);
      onResult(result);
    } catch (error) {
      console.error('Tool execution error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-executor">
      <h3>Execute {toolId}</h3>
      <textarea
        value={JSON.stringify(params, null, 2)}
        onChange={e => setParams(JSON.parse(e.target.value))}
        placeholder="Tool parameters (JSON)"
      />
      <button onClick={handleExecute} disabled={loading}>
        {loading ? 'Executing...' : 'Execute'}
      </button>
    </div>
  );
}

/**
 * Example Usage in a Chat Component
 */
export function ChatWithTools({ agentResponse }) {
  return (
    <div className="chat-container">
      <div className="agent-message">
        <AgentResponseDisplay responseText={agentResponse} />
      </div>

      <div className="available-tools">
        <AvailableToolsList />
      </div>
    </div>
  );
}

// ============================================================================
// VANILLA JAVASCRIPT EXAMPLE (No React/Vue required)
// ============================================================================

/**
 * Simple vanilla JavaScript example
 */
async function exampleVanillaJS() {
  // Get available tools
  console.log('Fetching available tools...');
  const toolsResponse = await fetch('http://localhost:4000/api/tools');
  const { tools } = await toolsResponse.json();
  console.log('Available tools:', tools);

  // Execute a tool
  console.log('\nExecuting writeFile tool...');
  const writeResponse = await fetch('http://localhost:4000/api/tools/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolId: 'writeFile',
      params: {
        filename: 'example.txt',
        content: 'This is an example file created by JavaScript',
      },
    }),
  });
  const writeResult = await writeResponse.json();
  console.log('File written:', writeResult);

  // List files
  console.log('\nListing files...');
  const listResponse = await fetch('http://localhost:4000/api/tools/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolId: 'listFiles',
      params: {},
    }),
  });
  const listResult = await listResponse.json();
  console.log('Files:', listResult.result.files);

  // Process agent response with tool calls
  console.log('\nProcessing agent response with tool calls...');
  const agentResponse = `
    I'll help you with that. Let me check what files are available.
    [TOOL_CALL: listFiles({})]
    
    Now I'll create a summary:
    [TOOL_CALL: writeFile({"filename": "summary.txt", "content": "Summary created by agent"})]
  `;

  const processResponse = await fetch('http://localhost:4000/api/tools/process-response', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responseText: agentResponse }),
  });
  const processResult = await processResponse.json();
  console.log('Tool execution results:', processResult);
}

// ============================================================================
// CSS STYLING EXAMPLE
// ============================================================================

/**
 * Example CSS styles for tool components
 * 
 * .tools-list {
 *   border: 1px solid #ddd;
 *   border-radius: 8px;
 *   padding: 16px;
 *   margin: 16px 0;
 * }
 *
 * .tool-execution {
 *   background-color: #f5f5f5;
 *   border-left: 4px solid #4CAF50;
 *   padding: 12px;
 *   margin: 8px 0;
 * }
 *
 * .tool-result.success {
 *   color: #4CAF50;
 * }
 *
 * .tool-result.error {
 *   color: #f44336;
 * }
 *
 * .tool-result pre {
 *   background: #f0f0f0;
 *   padding: 8px;
 *   border-radius: 4px;
 *   overflow-x: auto;
 * }
 *
 * .modified-response {
 *   background-color: #e8f5e9;
 *   padding: 12px;
 *   border-radius: 4px;
 *   margin: 8px 0;
 * }
 */
