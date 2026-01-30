import { useState, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function KnowledgeBaseUpload({ agentId, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const loadDocuments = async () => {
    if (!agentId) return;
    try {
      const response = await fetch(`${API_URL}/api/knowledge/${agentId}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  useState(() => {
    loadDocuments();
  }, [agentId]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files) => {
    if (!agentId) {
      alert('Please save the agent first before uploading documents.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('agentId', agentId);

    try {
      const response = await fetch(`${API_URL}/api/knowledge/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setUploadProgress(100);
      
      // Reload documents
      await loadDocuments();
      
      if (onUploadComplete) {
        onUploadComplete(result);
      }

      alert(`Successfully uploaded ${files.length} document(s)!`);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload documents. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`${API_URL}/api/knowledge/${docId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      await loadDocuments();
      alert('Document deleted successfully!');
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete document.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="knowledge-base-upload">
      <div className="upload-header">
        <h3>📚 Knowledge Base</h3>
        <p className="muted">Upload documents to give your agent context and knowledge</p>
      </div>

      <div
        className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.pdf,.doc,.docx,.md"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        
        {uploading ? (
          <div className="upload-progress">
            <div className="spinner">⏳</div>
            <p>Uploading and processing...</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <div className="upload-icon">📄</div>
            <p><strong>Click to upload</strong> or drag and drop</p>
            <p className="muted">TXT, PDF, DOC, DOCX, MD (Max 10MB per file)</p>
          </>
        )}
      </div>

      {documents.length > 0 && (
        <div className="documents-list">
          <h4>Uploaded Documents ({documents.length})</h4>
          {documents.map((doc) => (
            <div key={doc.id} className="document-item">
              <div className="doc-icon">
                {doc.filename.endsWith('.pdf') ? '📕' :
                 doc.filename.endsWith('.doc') || doc.filename.endsWith('.docx') ? '📘' :
                 doc.filename.endsWith('.txt') ? '📝' : '📄'}
              </div>
              <div className="doc-info">
                <div className="doc-name">{doc.filename}</div>
                <div className="doc-meta">
                  {formatFileSize(doc.size)} • {new Date(doc.uploaded_at).toLocaleDateString()}
                </div>
              </div>
              <button
                className="btn ghost compact"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(doc.id);
                }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .knowledge-base-upload {
          margin-top: 20px;
        }

        .upload-header h3 {
          margin-bottom: 6px;
          font-size: 16px;
        }

        .upload-dropzone {
          border: 2px dashed rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: 40px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.02);
          margin: 16px 0;
        }

        .upload-dropzone:hover,
        .upload-dropzone.drag-active {
          border-color: rgba(122, 240, 213, 0.6);
          background: rgba(122, 240, 213, 0.05);
        }

        .upload-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .upload-dropzone p {
          margin: 8px 0;
        }

        .upload-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .spinner {
          font-size: 32px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50, #8BC34A);
          transition: width 0.3s ease;
        }

        .documents-list {
          margin-top: 20px;
        }

        .documents-list h4 {
          font-size: 14px;
          margin-bottom: 12px;
          color: rgba(255, 255, 255, 0.8);
        }

        .document-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          margin-bottom: 8px;
          transition: background 0.2s ease;
        }

        .document-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .doc-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .doc-info {
          flex: 1;
          min-width: 0;
        }

        .doc-name {
          font-size: 14px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .doc-meta {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
}
