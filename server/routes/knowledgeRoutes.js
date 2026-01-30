import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'knowledge');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf', '.doc', '.docx', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only TXT, PDF, DOC, DOCX, MD allowed.'));
    }
  }
});

// In-memory storage for demo (replace with database in production)
const knowledgeBase = new Map();

/**
 * Upload documents to knowledge base
 */
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { agentId } = req.body;
    
    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const documents = req.files.map(file => {
      const docId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const doc = {
        id: docId,
        agentId,
        filename: file.originalname,
        filepath: file.path,
        size: file.size,
        mimetype: file.mimetype,
        uploaded_at: new Date().toISOString(),
      };

      // Store in memory (in production, save to database)
      if (!knowledgeBase.has(agentId)) {
        knowledgeBase.set(agentId, []);
      }
      knowledgeBase.get(agentId).push(doc);

      return {
        id: doc.id,
        filename: doc.filename,
        size: doc.size,
        uploaded_at: doc.uploaded_at,
      };
    });

    // In production, you would:
    // 1. Extract text from files
    // 2. Chunk the text
    // 3. Generate embeddings
    // 4. Store in vector database

    res.json({
      success: true,
      documents,
      message: `Uploaded ${documents.length} document(s)`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

/**
 * Get all documents for an agent
 */
router.get('/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const documents = knowledgeBase.get(agentId) || [];
    
    const sanitizedDocs = documents.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      size: doc.size,
      uploaded_at: doc.uploaded_at,
    }));

    res.json({
      success: true,
      documents: sanitizedDocs,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

/**
 * Delete a document
 */
router.delete('/:docId', (req, res) => {
  try {
    const { docId } = req.params;
    let found = false;

    // Find and remove document
    for (const [agentId, docs] of knowledgeBase.entries()) {
      const index = docs.findIndex(doc => doc.id === docId);
      if (index !== -1) {
        const doc = docs[index];
        
        // Delete file from filesystem
        if (fs.existsSync(doc.filepath)) {
          fs.unlinkSync(doc.filepath);
        }
        
        // Remove from memory
        docs.splice(index, 1);
        found = true;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * Search knowledge base (placeholder for RAG)
 */
router.post('/search', async (req, res) => {
  try {
    const { agentId, query, topK = 5 } = req.body;

    if (!agentId || !query) {
      return res.status(400).json({ error: 'Agent ID and query are required' });
    }

    const documents = knowledgeBase.get(agentId) || [];
    
    if (documents.length === 0) {
      return res.json({
        success: true,
        results: [],
        message: 'No documents found in knowledge base',
      });
    }

    // In production, this would:
    // 1. Generate query embedding
    // 2. Search vector database
    // 3. Return top K most relevant chunks with metadata

    // For now, return placeholder
    res.json({
      success: true,
      results: [],
      message: 'RAG search will be implemented with vector database',
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
