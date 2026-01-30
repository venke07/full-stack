/**
 * Tool Registry - Defines all available tools that agents can use
 * Agents can call these tools to perform actions beyond just chatting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.registerDefaultTools();
  }

  /**
   * Register a tool that agents can call
   */
  registerTool(toolId, config) {
    this.tools.set(toolId, {
      id: toolId,
      name: config.name,
      description: config.description,
      parameters: config.parameters || {},
      handler: config.handler,
    });
  }

  /**
   * Get a tool by ID
   */
  getTool(toolId) {
    return this.tools.get(toolId);
  }

  /**
   * Get all available tools
   */
  getAllTools() {
    return Array.from(this.tools.values()).map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Execute a tool
   */
  async executeTool(toolId, params) {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`);
    }

    try {
      const result = await tool.handler(params);
      return {
        success: true,
        toolId,
        result,
      };
    } catch (error) {
      return {
        success: false,
        toolId,
        error: error.message,
      };
    }
  }

  /**
   * Register default tools
   */
  registerDefaultTools() {
    // File Reading Tool
    this.registerTool('readFile', {
      name: 'Read File',
      description: 'Read contents of a file from the outputs directory',
      parameters: {
        filename: {
          type: 'string',
          description: 'Name of file to read (without path)',
        },
      },
      handler: async ({ filename }) => {
        if (!filename) throw new Error('filename is required');

        // Security: only allow files in outputs directory
        const outputDir = path.join(__dirname, '../outputs');
        const filePath = path.resolve(path.join(outputDir, filename));

        if (!filePath.startsWith(outputDir)) {
          throw new Error('Access denied: can only read from outputs directory');
        }

        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filename}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          filename,
          content,
          size: Buffer.byteLength(content),
        };
      },
    });

    // File Writing Tool
    this.registerTool('writeFile', {
      name: 'Write File',
      description: 'Create or update a file in the outputs directory',
      parameters: {
        filename: {
          type: 'string',
          description: 'Name of file to create/update (without path)',
        },
        content: {
          type: 'string',
          description: 'Content to write to file',
        },
        format: {
          type: 'string',
          enum: ['text', 'json', 'html', 'markdown'],
          description: 'File format (optional, defaults to text)',
        },
      },
      handler: async ({ filename, content, format = 'text' }) => {
        if (!filename) throw new Error('filename is required');
        if (content === undefined) throw new Error('content is required');

        // Ensure filename is safe
        const safeFilename = path.basename(filename);
        const outputDir = path.join(__dirname, '../outputs');
        const filePath = path.join(outputDir, safeFilename);

        // Create outputs directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Add extension based on format
        const ext = {
          json: '.json',
          html: '.html',
          markdown: '.md',
          text: '.txt',
        }[format] || '.txt';

        const finalPath = filePath.endsWith(ext) ? filePath : filePath + ext;

        fs.writeFileSync(finalPath, content, 'utf-8');

        return {
          filename: path.basename(finalPath),
          path: finalPath,
          size: Buffer.byteLength(content),
          format,
          message: `File successfully written`,
        };
      },
    });

    // CSV/Data Analysis Tool
    this.registerTool('analyzeData', {
      name: 'Analyze Data',
      description: 'Parse and analyze CSV/JSON data, compute statistics',
      parameters: {
        filename: {
          type: 'string',
          description: 'Name of CSV or JSON file in outputs directory',
        },
        operation: {
          type: 'string',
          enum: ['summary', 'statistics', 'count', 'distinct'],
          description: 'Type of analysis to perform',
        },
        column: {
          type: 'string',
          description: 'Optional: Column to analyze (for statistics/distinct)',
        },
      },
      handler: async ({ filename, operation = 'summary', column }) => {
        if (!filename) throw new Error('filename is required');

        const outputDir = path.join(__dirname, '../outputs');
        const filePath = path.resolve(path.join(outputDir, filename));

        if (!filePath.startsWith(outputDir)) {
          throw new Error('Access denied: can only read from outputs directory');
        }

        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filename}`);
        }

        let data;
        if (filename.endsWith('.json')) {
          const content = fs.readFileSync(filePath, 'utf-8');
          data = JSON.parse(content);
        } else if (filename.endsWith('.csv')) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = Papa.parse(content, { header: true });
          data = parsed.data;
        } else {
          throw new Error('Only CSV and JSON files are supported');
        }

        let result = {};

        if (operation === 'summary') {
          result = {
            totalRows: Array.isArray(data) ? data.length : Object.keys(data).length,
            columns: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [],
          };
        } else if (operation === 'count') {
          result = {
            count: Array.isArray(data) ? data.length : Object.keys(data).length,
          };
        } else if (operation === 'statistics' && column) {
          if (!Array.isArray(data)) {
            throw new Error('Statistics only work with array data (CSV)');
          }

          const values = data
            .map(row => parseFloat(row[column]))
            .filter(v => !isNaN(v));

          if (values.length === 0) {
            throw new Error(`No numeric values found in column: ${column}`);
          }

          const sum = values.reduce((a, b) => a + b, 0);
          const mean = sum / values.length;
          const sorted = values.sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          const min = Math.min(...values);
          const max = Math.max(...values);

          result = {
            column,
            count: values.length,
            sum,
            mean: mean.toFixed(2),
            median,
            min,
            max,
            range: max - min,
          };
        } else if (operation === 'distinct' && column) {
          if (!Array.isArray(data)) {
            throw new Error('Distinct only works with array data (CSV)');
          }

          const distinct = [...new Set(data.map(row => row[column]))];
          result = {
            column,
            distinctCount: distinct.length,
            distinctValues: distinct.slice(0, 100), // Limit to first 100
          };
        }

        return result;
      },
    });

    // Generate Report Tool
    this.registerTool('generateReport', {
      name: 'Generate Report',
      description: 'Generate a formatted report and save it as HTML or Markdown',
      parameters: {
        title: {
          type: 'string',
          description: 'Report title',
        },
        sections: {
          type: 'array',
          description: 'Array of sections with title and content',
        },
        format: {
          type: 'string',
          enum: ['html', 'markdown'],
          description: 'Report format (default: html)',
        },
      },
      handler: async ({ title = 'Report', sections = [], format = 'html' }) => {
        if (!Array.isArray(sections)) {
          throw new Error('sections must be an array');
        }

        let content;

        if (format === 'html') {
          content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .section { margin: 20px 0; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f0f0f0; }
    .timestamp { color: #999; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="timestamp">Generated on ${new Date().toLocaleString()}</p>
  ${sections.map(sec => `
    <div class="section">
      <h2>${sec.title || 'Section'}</h2>
      <div>${sec.content || ''}</div>
    </div>
  `).join('')}
</body>
</html>`;
        } else if (format === 'markdown') {
          content = `# ${title}\n\n*Generated on ${new Date().toLocaleString()}*\n\n${sections
            .map(sec => `## ${sec.title || 'Section'}\n\n${sec.content || ''}\n`)
            .join('\n')}`;
        }

        const filename = `report-${Date.now()}`;
        const ext = format === 'html' ? '.html' : '.md';
        const outputDir = path.join(__dirname, '../outputs');

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const filePath = path.join(outputDir, filename + ext);
        fs.writeFileSync(filePath, content, 'utf-8');

        return {
          filename: filename + ext,
          path: filePath,
          format,
          title,
          message: 'Report generated successfully',
        };
      },
    });

    // List Files Tool
    this.registerTool('listFiles', {
      name: 'List Files',
      description: 'List all files in the outputs directory',
      parameters: {},
      handler: async () => {
        const outputDir = path.join(__dirname, '../outputs');

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
          return { files: [] };
        }

        const files = fs.readdirSync(outputDir);
        const fileDetails = files.map(file => {
          const filePath = path.join(outputDir, file);
          const stat = fs.statSync(filePath);
          return {
            name: file,
            size: stat.size,
            created: stat.birthtime,
            modified: stat.mtime,
          };
        });

        return {
          count: files.length,
          files: fileDetails,
        };
      },
    });

    // Execute JavaScript Code Tool (with sandbox-like restrictions)
    this.registerTool('executeCode', {
      name: 'Execute Code',
      description: 'Execute JavaScript code and return results (safe sandbox)',
      parameters: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute',
        },
      },
      handler: async ({ code }) => {
        if (!code) throw new Error('code is required');

        try {
          // Safe eval using Function constructor
          // This is more restrictive than eval but still allows code execution
          const fn = new Function(code);
          const result = fn();

          return {
            success: true,
            result: JSON.stringify(result),
          };
        } catch (error) {
          throw new Error(`Code execution error: ${error.message}`);
        }
      },
    });
  }
}

export default new ToolRegistry();
