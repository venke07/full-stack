/**
 * Tool Executor - Parses agent responses and executes tool calls
 * Agents communicate tool needs through special syntax in their responses
 */

import toolRegistry from './toolRegistry.js';

class ToolExecutor {
  /**
   * Parse tool calls from agent response
   * Expected format: [TOOL_CALL: toolName({"param": "value"})]
   */
  parseToolCalls(responseText) {
    const toolCallPattern = /\[TOOL_CALL:\s*(\w+)\s*\(\s*({.*?})\s*\)\s*\]/g;
    const toolCalls = [];
    let match;

    while ((match = toolCallPattern.exec(responseText)) !== null) {
      try {
        const toolName = match[1];
        const paramsStr = match[2];
        const params = JSON.parse(paramsStr);

        toolCalls.push({
          tool: toolName,
          params,
          fullMatch: match[0],
        });
      } catch (error) {
        console.error(`Failed to parse tool call: ${match[0]}`, error);
      }
    }

    return toolCalls;
  }

  /**
   * Execute all tool calls found in response
   */
  async executeToolCalls(responseText) {
    const toolCalls = this.parseToolCalls(responseText);

    if (toolCalls.length === 0) {
      return {
        hasToolCalls: false,
        toolCalls: [],
        results: [],
        modifiedResponse: responseText,
      };
    }

    const results = [];
    let modifiedResponse = responseText;

    for (const toolCall of toolCalls) {
      try {
        const result = await toolRegistry.executeTool(toolCall.tool, toolCall.params);
        results.push({
          tool: toolCall.tool,
          params: toolCall.params,
          ...result,
        });

        // Replace tool call with result in response
        const resultText = result.success
          ? `[TOOL_RESULT: ${JSON.stringify(result.result)}]`
          : `[TOOL_ERROR: ${result.error}]`;

        modifiedResponse = modifiedResponse.replace(toolCall.fullMatch, resultText);
      } catch (error) {
        results.push({
          tool: toolCall.tool,
          params: toolCall.params,
          success: false,
          error: error.message,
        });

        modifiedResponse = modifiedResponse.replace(
          toolCall.fullMatch,
          `[TOOL_ERROR: ${error.message}]`
        );
      }
    }

    return {
      hasToolCalls: true,
      toolCalls,
      results,
      modifiedResponse,
    };
  }

  /**
   * Get available tools for agent to use
   */
  getAvailableTools() {
    return toolRegistry.getAllTools();
  }

  /**
   * Create system prompt addition for agents about tool usage
   */
  getToolSystemPrompt() {
    const tools = this.getAvailableTools();
    const toolDescriptions = tools
      .map(
        tool =>
          `- **${tool.name}** (${tool.id}): ${tool.description}\n  Parameters: ${JSON.stringify(
            tool.parameters
          )}`
      )
      .join('\n');

    return `
You have access to the following tools to help complete tasks:

${toolDescriptions}

To use a tool, format your response with this syntax:
[TOOL_CALL: toolName({"param1": "value1", "param2": "value2"})]

For example:
[TOOL_CALL: writeFile({"filename": "report.txt", "content": "Hello World"})]

You can use multiple tool calls in a single response.
After using a tool, you'll see the result in [TOOL_RESULT: ...] tags.
If a tool fails, you'll see [TOOL_ERROR: ...] tags.

Always explain what you're doing and provide context for tool calls.
`;
  }
}

export default new ToolExecutor();
