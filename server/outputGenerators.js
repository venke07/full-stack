/**
 * Output Generators
 * Handles creation of different output formats (Word docs, images, PDFs, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';

class OutputGenerators {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'outputs');
    this.ensureOutputDir();
  }

  /**
   * Ensure output directory exists
   */
  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate plain text document
   */
  generateTextDocument(content, filename) {
    const filepath = path.join(this.outputDir, filename || `document_${Date.now()}.txt`);
    fs.writeFileSync(filepath, content, 'utf-8');
    return {
      success: true,
      filename: path.basename(filepath),
      filepath,
      type: 'text',
      size: fs.statSync(filepath).size,
    };
  }

  /**
   * Generate JSON document
   */
  generateJsonDocument(data, filename) {
    const filepath = path.join(this.outputDir, filename || `data_${Date.now()}.json`);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
    return {
      success: true,
      filename: path.basename(filepath),
      filepath,
      type: 'json',
      size: fs.statSync(filepath).size,
    };
  }

  /**
   * Generate Word Document with proper formatting
   */
  async generateWordDocument(content, filename) {
    try {
      // Split content into sections and paragraphs
      const lines = content.split('\n');
      const children = [];

      // Add title
      children.push(
        new Paragraph({
          text: 'Agent Report',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        })
      );

      // Add timestamp
      children.push(
        new Paragraph({
          text: `Generated: ${new Date().toLocaleString()}`,
          spacing: { after: 300 },
        })
      );

      // Process content lines
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if it's a section header (starts with ===)
        if (line.trim().startsWith('===') && line.trim().endsWith('===')) {
          const sectionTitle = line.replace(/===/g, '').trim();
          children.push(
            new Paragraph({
              text: sectionTitle,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            })
          );
        } else if (line.trim()) {
          // Regular paragraph
          children.push(
            new Paragraph({
              text: line,
              spacing: { after: 100 },
            })
          );
        } else {
          // Empty line - add spacing
          children.push(
            new Paragraph({
              text: '',
              spacing: { after: 100 },
            })
          );
        }
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: children,
          },
        ],
      });

      const filepath = path.join(this.outputDir, filename || `document_${Date.now()}.docx`);
      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(filepath, buffer);

      return {
        success: true,
        filename: path.basename(filepath),
        filepath,
        type: 'docx',
        size: fs.statSync(filepath).size,
      };
    } catch (error) {
      console.error('Error generating Word document:', error.message, error.stack);
      // Fallback to text document
      return this.generateTextDocument(content, filename ? filename.replace('.docx', '.txt') : `document_${Date.now()}.txt`);
    }
  }

  /**
   * Generate CSV document
   */
  generateCSVDocument(data, filename) {
    let csvContent = '';
    
    if (Array.isArray(data) && data.length > 0) {
      // If it's an array of objects
      if (typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        csvContent = headers.join(',') + '\n';
        csvContent += data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if needed
            return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',')
        ).join('\n');
      } else {
        // If it's an array of arrays
        csvContent = data.map(row => 
          Array.isArray(row) ? row.join(',') : row
        ).join('\n');
      }
    } else if (typeof data === 'string') {
      csvContent = data;
    }

    const filepath = path.join(this.outputDir, filename || `data_${Date.now()}.csv`);
    fs.writeFileSync(filepath, csvContent, 'utf-8');
    return {
      success: true,
      filename: path.basename(filepath),
      filepath,
      type: 'csv',
      size: fs.statSync(filepath).size,
    };
  }

  /**
   * Generate HTML document
   */
  generateHtmlDocument(content, filename) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Document</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #007bff;
            padding-bottom: 10px;
        }
        h2 {
            color: #555;
            margin-top: 20px;
        }
        p {
            color: #666;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 0.9rem;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Generated Document</h1>
        ${content
          .split('\n\n')
          .map(
            p =>
              `<p>${p.replace(/\n/g, '<br>')}</p>`
          )
          .join('\n')}
        <div class="footer">
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
    `;

    const filepath = path.join(this.outputDir, filename || `document_${Date.now()}.html`);
    fs.writeFileSync(filepath, html, 'utf-8');
    return {
      success: true,
      filename: path.basename(filepath),
      filepath,
      type: 'html',
      size: fs.statSync(filepath).size,
    };
  }

  /**
   * Generate Markdown document
   */
  generateMarkdownDocument(content, filename) {
    const filepath = path.join(this.outputDir, filename || `document_${Date.now()}.md`);
    fs.writeFileSync(filepath, content, 'utf-8');
    return {
      success: true,
      filename: path.basename(filepath),
      filepath,
      type: 'markdown',
      size: fs.statSync(filepath).size,
    };
  }

  /**
   * Generate image as SVG (simple text-based)
   */
  async generateImage(content, filename) {
    try {
      let imagePath = path.join(this.outputDir, filename || `image_${Date.now()}.svg`);

      // If content is base64 encoded image data, save as-is
      if (content.startsWith('data:image') || content.startsWith('/9j/') || content.startsWith('iVBOR')) {
        let buffer;
        let ext = '.png';
        
        if (content.startsWith('data:image')) {
          const match = content.match(/data:image\/(\w+);base64,/);
          if (match) ext = '.' + match[1];
          const base64Data = content.replace(/^data:image\/\w+;base64,/, '');
          buffer = Buffer.from(base64Data, 'base64');
        } else {
          buffer = Buffer.from(content, 'base64');
        }
        
        imagePath = path.join(this.outputDir, filename || `image_${Date.now()}${ext}`);
        fs.writeFileSync(imagePath, buffer);
        
        return {
          success: true,
          filename: path.basename(imagePath),
          filepath: imagePath,
          type: 'image',
          size: fs.statSync(imagePath).size,
        };
      }

      // Create SVG image with description
      const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML || str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      };

      const lines = content.substring(0, 500).split('\n').slice(0, 10);
      const textElements = lines.map((line, i) => 
        `<text x="20" y="${40 + i * 30}" font-size="14" font-family="Arial" fill="#333">${line.substring(0, 80)}</text>`
      ).join('\n');

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#grad1)"/>
  <rect x="50" y="50" width="700" height="500" fill="white" rx="10"/>
  <text x="400" y="100" font-size="28" font-family="Arial" font-weight="bold" fill="#333" text-anchor="middle">Generated Image</text>
  ${textElements}
  <text x="400" y="550" font-size="12" font-family="Arial" fill="#999" text-anchor="middle">Generated on ${new Date().toLocaleString()}</text>
</svg>`;

      fs.writeFileSync(imagePath, svg, 'utf-8');

      return {
        success: true,
        filename: path.basename(imagePath),
        filepath: imagePath,
        type: 'image',
        size: fs.statSync(imagePath).size,
      };
    } catch (error) {
      console.warn('Error generating image:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate CSV document
   */
  generateCSVDocument(data, filename) {
    let csvContent = '';
    
    if (Array.isArray(data) && data.length > 0) {
      // If it's an array of objects
      if (typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        csvContent = headers.join(',') + '\n';
        csvContent += data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if needed
            return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',')
        ).join('\n');
      } else {
        // If it's an array of arrays
        csvContent = data.map(row => 
          Array.isArray(row) ? row.join(',') : row
        ).join('\n');
      }
    } else if (typeof data === 'string') {
      csvContent = data;
    }

    const filepath = path.join(this.outputDir, filename || `data_${Date.now()}.csv`);
    fs.writeFileSync(filepath, csvContent, 'utf-8');
    return {
      success: true,
      filename: path.basename(filepath),
      filepath,
      type: 'csv',
      size: fs.statSync(filepath).size,
    };
  }

  /**
   * Generate document based on format
   */
  async generateDocument(content, format = 'text', filename = null) {
    switch (format.toLowerCase()) {
      case 'word':
      case 'docx':
        return await this.generateWordDocument(content, filename);
      case 'html':
        return this.generateHtmlDocument(content, filename);
      case 'markdown':
      case 'md':
        return this.generateMarkdownDocument(content, filename);
      case 'json':
        return this.generateJsonDocument(
          typeof content === 'string' ? JSON.parse(content) : content,
          filename
        );
      case 'csv':
        return this.generateCSVDocument(content, filename);
      case 'image':
      case 'png':
      case 'jpg':
      case 'jpeg':
        return await this.generateImage(content, filename);
      case 'text':
      case 'txt':
      default:
        return this.generateTextDocument(content, filename);
    }
  }

  /**
   * Get generated file
   */
  getFile(filename) {
    const filepath = path.join(this.outputDir, filename);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    return {
      filename,
      filepath,
      content: fs.readFileSync(filepath),
      size: fs.statSync(filepath).size,
    };
  }

  /**
   * List all generated files
   */
  listFiles() {
    if (!fs.existsSync(this.outputDir)) {
      return [];
    }

    return fs.readdirSync(this.outputDir).map(filename => ({
      filename,
      size: fs.statSync(path.join(this.outputDir, filename)).size,
      createdAt: fs.statSync(path.join(this.outputDir, filename)).birthtime,
    }));
  }

  /**
   * Delete a file
   */
  deleteFile(filename) {
    const filepath = path.join(this.outputDir, filename);

    if (!fs.existsSync(filepath)) {
      return { success: false, error: 'File not found' };
    }

    try {
      fs.unlinkSync(filepath);
      return { success: true, filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new OutputGenerators();
