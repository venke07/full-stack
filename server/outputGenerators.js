/**
 * Output Generators
 * Handles creation of different output formats (Word docs, images, PDFs, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';

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
   * Generate Word Document (using simple DOCX format)
   * Note: For production, use 'docx' or 'pptx' npm package
   */
  async generateWordDocument(content, filename) {
    try {
      // Try to use docx library if available
      try {
        const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');

        const doc = new Document({
          sections: [
            {
              children: [
                new Paragraph({
                  text: 'Generated Document',
                  heading: HeadingLevel.HEADING_1,
                }),
                new Paragraph(''),
                ...this.parseContentToParagraphs(content),
              ],
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
      } catch (e) {
        // Fallback to markdown/text if docx not available
        console.warn('docx library not available, saving as text');
        return this.generateTextDocument(content, filename || `document_${Date.now()}.txt`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Convert text to paragraphs for Word doc
   */
  parseContentToParagraphs(content) {
    const Paragraph = require('docx')?.Paragraph || class Paragraph {
      constructor(config) { this.config = config; }
    };

    return content
      .split('\n\n')
      .filter(p => p.trim())
      .map(
        p =>
          new Paragraph({
            text: p.trim(),
          })
      );
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
   * Generate document based on format
   */
  async generateDocument(content, format = 'text', filename = null) {
    const timestamp = Date.now();

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
        return this.generateJsonDocument(content, filename);
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
