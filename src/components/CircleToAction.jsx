import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/CircleToAction.css';

// Simple markdown to HTML converter
const formatMarkdown = (text) => {
  if (!text) return '';
  
  let html = text
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ (but not inside words)
    .replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em>$1</em>')
    // Headers: ## Header
    .replace(/^###\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^##\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#\s+(.+)$/gm, '<h3>$1</h3>')
    // Bullet points: * item or - item (convert to list items)
    .replace(/^\s*[\*\-]\s+(.+)$/gm, '••LISTITEM••$1••ENDLISTITEM••')
    // Numbered lists: 1. item
    .replace(/^\s*\d+\.\s+(.+)$/gm, '••NUMITEM••$1••ENDNUMITEM••')
    // Line breaks
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
  
  // Wrap consecutive list items in <ul>
  html = html.replace(/(••LISTITEM••[\s\S]*?••ENDLISTITEM••)+/g, (match) => {
    const items = match
      .split('••ENDLISTITEM••')
      .filter(item => item.includes('••LISTITEM••'))
      .map(item => `<li>${item.replace('••LISTITEM••', '').replace(/<br\/>/g, '')}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });
  
  // Wrap consecutive numbered items in <ol>
  html = html.replace(/(••NUMITEM••[\s\S]*?••ENDNUMITEM••)+/g, (match) => {
    const items = match
      .split('••ENDNUMITEM••')
      .filter(item => item.includes('••NUMITEM••'))
      .map(item => `<li>${item.replace('••NUMITEM••', '').replace(/<br\/>/g, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  });
  
  return html;
};

const CircleToAction = () => {
  // Button position state (draggable)
  const [buttonPos, setButtonPos] = useState({ x: 20, y: window.innerHeight - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Menu position state (draggable)
  const [menuPos, setMenuPos] = useState(null);
  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [menuDragOffset, setMenuDragOffset] = useState({ x: 0, y: 0 });
  
  // Circle mode states
  const [isActive, setIsActive] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [selectedContent, setSelectedContent] = useState(null);
  const [showActions, setShowActions] = useState(false);
  const [actionPosition, setActionPosition] = useState({ x: 0, y: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const canvasRef = useRef(null);

  // Handle button drag start
  const handleMouseDown = (e) => {
    if (e.target.closest('.cta-floating-btn')) {
      setIsDragging(true);
      const rect = buttonRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      e.preventDefault();
    }
  };

  // Handle menu drag start
  const handleMenuMouseDown = (e) => {
    // Only start drag on the header bar, not buttons
    if (e.target.closest('.cta-close-btn')) return;
    if (e.target.closest('.cta-action-header') && menuRef.current) {
      setIsDraggingMenu(true);
      const rect = menuRef.current.getBoundingClientRect();
      setMenuDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Handle menu drag end on double click or mouseup
  const handleMenuDoubleClick = (e) => {
    e.stopPropagation();
    setIsDraggingMenu(false);
  };

  // Handle button drag
  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      const newX = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.y));
      setButtonPos({ x: newX, y: newY });
    }
    if (isDraggingMenu) {
      const newX = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - menuDragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - menuDragOffset.y));
      setMenuPos({ x: newX, y: newY });
    }
  }, [isDragging, dragOffset, isDraggingMenu, menuDragOffset]);

  // Handle button drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsDraggingMenu(false);
  }, []);

  useEffect(() => {
    if (isDragging || isDraggingMenu) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isDraggingMenu, handleMouseMove, handleMouseUp]);

  // Toggle circle mode
  const toggleCircleMode = () => {
    if (!isDragging) {
      setIsActive(!isActive);
      setShowActions(false);
      setSelectedContent(null);
      setAiResponse(null);
      setMenuPos(null); // Reset menu position
    }
  };

  // Handle drawing start
  const handleCanvasMouseDown = (e) => {
    if (!isActive) return;
    setIsDrawing(true);
    setStartPoint({ x: e.clientX, y: e.clientY });
    setEndPoint({ x: e.clientX, y: e.clientY });
    setShowActions(false);
    setAiResponse(null);
  };

  // Handle drawing
  const handleCanvasMouseMove = (e) => {
    if (!isDrawing) return;
    setEndPoint({ x: e.clientX, y: e.clientY });
  };

  // Handle drawing end - capture content
  const handleCanvasMouseUp = async (e) => {
    if (!isDrawing || !startPoint) return;
    setIsDrawing(false);
    
    const rect = {
      left: Math.min(startPoint.x, endPoint.x),
      top: Math.min(startPoint.y, endPoint.y),
      right: Math.max(startPoint.x, endPoint.x),
      bottom: Math.max(startPoint.y, endPoint.y),
      width: Math.abs(endPoint.x - startPoint.x),
      height: Math.abs(endPoint.y - startPoint.y)
    };

    // Minimum size check
    if (rect.width < 20 || rect.height < 20) {
      setStartPoint(null);
      setEndPoint(null);
      return;
    }

    // Get elements under the selection
    const elementsInSelection = getElementsInSelection(rect);
    const textContent = extractTextFromElements(elementsInSelection);
    
    if (textContent.trim()) {
      setSelectedContent({
        text: textContent.trim(),
        rect: rect,
        elements: elementsInSelection
      });
      setActionPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10
      });
      setShowActions(true);
    } else {
      // Reset if no content selected
      setStartPoint(null);
      setEndPoint(null);
    }
  };

  // Get elements within selection rectangle
  const getElementsInSelection = (rect) => {
    const elements = document.elementsFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    );
    
    // Get all text-containing elements in the area
    const allElements = document.body.querySelectorAll('*');
    const selectedElements = [];
    
    allElements.forEach(el => {
      const elRect = el.getBoundingClientRect();
      const isOverlapping = !(
        elRect.right < rect.left ||
        elRect.left > rect.right ||
        elRect.bottom < rect.top ||
        elRect.top > rect.bottom
      );
      
      if (isOverlapping && el.innerText && !el.querySelector('*:not(br)')) {
        selectedElements.push(el);
      }
    });
    
    return selectedElements.length > 0 ? selectedElements : elements;
  };

  // Extract text from elements
  const extractTextFromElements = (elements) => {
    const textSet = new Set();
    elements.forEach(el => {
      if (el.innerText && !el.classList.contains('cta-overlay')) {
        const text = el.innerText.trim();
        if (text && text.length < 5000) {
          textSet.add(text);
        }
      }
    });
    
    // Get unique text, prioritize shorter specific text
    const texts = Array.from(textSet).sort((a, b) => a.length - b.length);
    return texts.slice(0, 3).join('\n\n');
  };

  // Action handlers
  const handleAction = async (action) => {
    if (!selectedContent) return;
    
    setIsAnalyzing(true);
    
    try {
      let prompt = '';
      switch (action) {
        case 'explain':
          prompt = `Please explain the following content in simple terms:\n\n"${selectedContent.text}"`;
          break;
        case 'summarize':
          prompt = `Please provide a brief summary of:\n\n"${selectedContent.text}"`;
          break;
        case 'expand':
          prompt = `Please expand on this topic and provide more details:\n\n"${selectedContent.text}"`;
          break;
        case 'actions':
          prompt = `Based on this content, what actions or next steps would you suggest? Content:\n\n"${selectedContent.text}"`;
          break;
        default:
          prompt = `Analyze this content:\n\n"${selectedContent.text}"`;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant. Provide concise, clear responses.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        })
      });

      console.log('Circle to Action response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Circle to Action data:', data);
        setAiResponse({
          action,
          response: data.reply
        });
      } else {
        setAiResponse({
          action,
          response: 'Sorry, I couldn\'t process that request. Please try again.'
        });
      }
    } catch (error) {
      console.error('Circle to Action error:', error);
      setAiResponse({
        action,
        response: 'An error occurred. Please try again.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Copy selected text
  const handleCopy = () => {
    if (selectedContent?.text) {
      navigator.clipboard.writeText(selectedContent.text);
      // Show brief feedback
      const btn = document.querySelector('.cta-action-btn.copy');
      if (btn) {
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
          btn.textContent = '📋 Copy';
        }, 1500);
      }
    }
  };

  // Close and reset
  const handleClose = () => {
    setIsActive(false);
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);
    setSelectedContent(null);
    setShowActions(false);
    setAiResponse(null);
  };

  // Calculate selection box style
  const getSelectionStyle = () => {
    if (!startPoint || !endPoint) return {};
    
    return {
      left: Math.min(startPoint.x, endPoint.x),
      top: Math.min(startPoint.y, endPoint.y),
      width: Math.abs(endPoint.x - startPoint.x),
      height: Math.abs(endPoint.y - startPoint.y)
    };
  };

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + Shift + C to toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        toggleCircleMode();
      }
      // Escape to close
      if (e.key === 'Escape' && isActive) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  return (
    <>
      {/* Floating Button */}
      <div
        ref={buttonRef}
        className={`cta-floating-btn ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{ left: buttonPos.x, top: buttonPos.y }}
        onMouseDown={handleMouseDown}
        onClick={toggleCircleMode}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="cta-icon">{isActive ? '✕' : '○'}</span>
        {showTooltip && !isDragging && !isActive && (
          <div className="cta-tooltip">
            Circle to Action
            <span className="cta-shortcut">Ctrl+Shift+C</span>
          </div>
        )}
      </div>

      {/* Overlay when active */}
      {isActive && (
        <div
          className="cta-overlay"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          {/* Instructions */}
          {!isDrawing && !showActions && (
            <div className="cta-instructions">
              <div className="cta-instructions-content">
                <span className="cta-instructions-icon">○</span>
                <p>Draw a circle or rectangle around any content</p>
                <span className="cta-instructions-hint">Press ESC to cancel</span>
              </div>
            </div>
          )}

          {/* Selection rectangle */}
          {(isDrawing || showActions) && startPoint && endPoint && (
            <div 
              className={`cta-selection ${isDrawing ? 'drawing' : 'complete'}`}
              style={getSelectionStyle()}
            />
          )}

          {/* Action Menu */}
          {showActions && selectedContent && (
            <div 
              ref={menuRef}
              className={`cta-action-menu ${isDraggingMenu ? 'dragging' : ''}`}
              style={{
                left: menuPos ? menuPos.x : Math.min(actionPosition.x, window.innerWidth - 320),
                top: menuPos ? menuPos.y : Math.min(actionPosition.y, window.innerHeight - 300)
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onMouseUp={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsDraggingMenu(false);
              }}
            >
              <div 
                className="cta-action-header" 
                style={{ cursor: isDraggingMenu ? 'grabbing' : 'grab' }}
                onMouseDown={handleMenuMouseDown}
                onDoubleClick={handleMenuDoubleClick}
              >
                <span className="cta-action-title">🎯 Circle to Action</span>
                <span className="cta-drag-hint" title="Drag to move, double-click to stop">⋮⋮</span>
                <button className="cta-close-btn" onClick={(e) => { e.stopPropagation(); handleClose(); }}>✕</button>
              </div>
              
              <div className="cta-selected-preview">
                <p>{selectedContent.text.slice(0, 150)}{selectedContent.text.length > 150 ? '...' : ''}</p>
              </div>

              {!aiResponse && !isAnalyzing && (
                <div className="cta-action-buttons">
                  <button className="cta-action-btn explain" onClick={() => handleAction('explain')}>
                    💡 Explain
                  </button>
                  <button className="cta-action-btn summarize" onClick={() => handleAction('summarize')}>
                    📝 Summarize
                  </button>
                  <button className="cta-action-btn expand" onClick={() => handleAction('expand')}>
                    🔍 Expand
                  </button>
                  <button className="cta-action-btn actions" onClick={() => handleAction('actions')}>
                    ⚡ Suggest Actions
                  </button>
                  <button className="cta-action-btn copy" onClick={handleCopy}>
                    📋 Copy
                  </button>
                </div>
              )}

              {isAnalyzing && (
                <div className="cta-analyzing">
                  <div className="cta-spinner"></div>
                  <p>Analyzing content...</p>
                </div>
              )}

              {aiResponse && (
                <div className="cta-response">
                  <div className="cta-response-header">
                    <span>
                      {aiResponse.action === 'explain' && '💡 Explanation'}
                      {aiResponse.action === 'summarize' && '📝 Summary'}
                      {aiResponse.action === 'expand' && '🔍 Expanded'}
                      {aiResponse.action === 'actions' && '⚡ Suggested Actions'}
                    </span>
                    <button 
                      className="cta-back-btn"
                      onClick={() => setAiResponse(null)}
                    >
                      ← Back
                    </button>
                  </div>
                  <div 
                    className="cta-response-content"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(aiResponse.response) }}
                  />
                  <button 
                    className="cta-copy-response"
                    onClick={() => {
                      navigator.clipboard.writeText(aiResponse.response);
                    }}
                  >
                    📋 Copy Response
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default CircleToAction;
