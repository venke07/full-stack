# Feature Documentation

This document provides detailed documentation for three key features implemented in the Neural Base Command AI Agent Platform.

---

## Table of Contents

1. [Circle to Action](#1-circle-to-action)
2. [Voice Chat Interface](#2-voice-chat-interface)
3. [Cloud Deployment](#3-cloud-deployment)

---

## 1. Circle to Action

### Overview

Circle to Action is an innovative AI-powered content analysis feature inspired by Microsoft's "Click to Do" and Google's "Circle to Search". It allows users to draw a selection around any content on the screen and instantly get AI-powered insights, explanations, summaries, or suggested actions.

### Features

| Feature | Description |
|---------|-------------|
| Draw-to-Select | Click and drag to create a selection rectangle around any content |
| AI Analysis | Get instant AI-powered analysis of selected content |
| Multiple Actions | Choose from Explain, Summarize, Expand, or Suggest Actions |
| Draggable Button | Floating button can be repositioned anywhere on screen |
| Draggable Menu | Action menu can be moved by dragging the header |
| Keyboard Shortcut | Activate with `Ctrl+Shift+C` |
| Copy Response | One-click copy of AI responses |
| Markdown Rendering | Properly formatted responses with headers, lists, and emphasis |

### Technical Implementation

#### File Structure
```
src/
├── components/
│   └── CircleToAction.jsx    # Main component (525 lines)
└── styles/
    └── CircleToAction.css    # Styling (484 lines)
```

#### Component Architecture

```jsx
// Key State Variables
const [buttonPos, setButtonPos] = useState({ x: 20, y: window.innerHeight - 100 });
const [menuPos, setMenuPos] = useState(null);
const [isActive, setIsActive] = useState(false);
const [isDragging, setIsDragging] = useState(false);
const [isDraggingMenu, setIsDraggingMenu] = useState(false);
const [selection, setSelection] = useState(null);
const [selectedContent, setSelectedContent] = useState('');
const [aiResponse, setAiResponse] = useState(null);
const [loading, setLoading] = useState(false);
```

#### Key Functions

| Function | Purpose |
|----------|---------|
| `handleMouseDown` | Initiates button dragging |
| `handleMouseMove` | Tracks mouse movement during drag |
| `handleMouseUp` | Ends button dragging |
| `handleMenuMouseDown` | Initiates menu dragging |
| `handleMenuDoubleClick` | Releases menu from dragging state |
| `handleCanvasMouseDown` | Starts drawing selection rectangle |
| `handleCanvasMouseMove` | Updates selection rectangle size |
| `handleCanvasMouseUp` | Finalizes selection and extracts content |
| `getElementsInSelection` | Finds all elements within selection bounds |
| `extractTextFromElements` | Extracts readable text from selected elements |
| `handleAction` | Sends selected content to AI for analysis |
| `formatMarkdown` | Converts markdown to styled HTML |

#### Markdown Formatting

The component includes a custom markdown parser that handles:
- **Bold text**: `**text**` → `<strong>text</strong>`
- **Italic text**: `*text*` → `<em>text</em>`
- **Headers**: `## Header` → `<h3>Header</h3>`
- **Bullet lists**: `* item` → `<ul><li>item</li></ul>`
- **Numbered lists**: `1. item` → `<ol><li>item</li></ol>`

#### API Integration

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: prompt }],
    model: 'gemini-2.5-flash',
  }),
});
```

### User Experience Flow

1. **Activation**: Click the floating purple button (bottom-left) or press `Ctrl+Shift+C`
2. **Selection**: Click and drag to draw a rectangle around content
3. **Content Extraction**: Text within the selection is automatically captured
4. **Action Selection**: Choose from Explain, Summarize, Expand, or Suggest Actions
5. **AI Processing**: Request is sent to AI model for analysis
6. **Response Display**: Formatted response appears in draggable menu
7. **Copy/Dismiss**: Copy response to clipboard or close the menu

### Styling

The component uses a modern glassmorphism design with:
- Purple gradient floating button
- Semi-transparent overlay during selection
- Animated selection rectangle with dashed border
- Clean white action menu with shadow
- Responsive design for mobile devices

### Accessibility

- Keyboard shortcut (`Ctrl+Shift+C`) for activation
- `Escape` key to cancel/close
- Visual feedback for all interactions
- Cursor changes to indicate draggable elements

---

## 2. Voice Chat Interface

### Overview

The Voice Chat Interface enables real-time speech-to-text conversation with AI agents. Users can speak naturally and receive AI responses that are both displayed as text and read aloud using text-to-speech synthesis.

### Features

| Feature | Description |
|---------|-------------|
| Speech Recognition | Real-time speech-to-text using Web Speech API |
| Text-to-Speech | AI responses are read aloud naturally |
| Multi-Agent Support | Select from available AI agents |
| Conversation History | Full chat history preserved during session |
| Auto-play Responses | Optional automatic voice playback |
| Visual Feedback | Recording indicator and status messages |

### Technical Implementation

#### File Structure
```
src/
├── pages/
│   └── VoiceChat.jsx         # Main voice chat page
└── styles/
    └── VoiceChat.css         # Voice chat styling
```

#### Web Speech API Integration

```javascript
// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true;
recognition.lang = 'en-US';

// Speech Synthesis Setup
const synth = window.speechSynthesis;
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = 1.0;
utterance.pitch = 1.0;
synth.speak(utterance);
```

#### Key Components

| Component | Purpose |
|-----------|---------|
| Agent Selector | Sidebar list of available AI agents |
| Message Display | Chat bubbles showing conversation |
| Voice Controls | Microphone, send, and clear buttons |
| Status Indicator | Shows recording/processing state |
| Feature Panel | Lists voice chat capabilities |

#### API Integration

```javascript
const response = await fetch(`${API_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: conversationHistory,
    model: selectedAgent.model_id || 'gemini-2.5-flash',
    systemPrompt: selectedAgent.system_prompt,
  }),
});
```

### User Experience Flow

1. **Agent Selection**: Choose an AI agent from the sidebar
2. **Start Recording**: Click the microphone button
3. **Speak**: Talk naturally - speech is transcribed in real-time
4. **Send Message**: Click send or stop recording to submit
5. **AI Processing**: Message is sent to selected AI agent
6. **Response**: AI response is displayed and optionally read aloud
7. **Continue**: Conversation continues with context preserved

### Voice Controls Layout

```
┌─────────────────────────────────────┐
│  🗑️ Clear  │  🎤 Mic  │  Send ▶️   │
└─────────────────────────────────────┘
```

### Browser Compatibility

| Browser | Speech Recognition | Text-to-Speech |
|---------|-------------------|----------------|
| Chrome | ✅ Full Support | ✅ Full Support |
| Edge | ✅ Full Support | ✅ Full Support |
| Firefox | ❌ Limited | ✅ Full Support |
| Safari | ✅ With Prefix | ✅ Full Support |

### Error Handling

The component handles various error states:
- Microphone permission denied
- Speech recognition errors
- Network/API failures
- No agents available

---

## 3. Cloud Deployment

### Overview

The application is deployed to Render, a cloud platform that provides hosting for both the React frontend and Node.js backend. The deployment is configured for automatic deploys on every push to the main branch.

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Render Cloud                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Web Service (Node.js)               │    │
│  │  ┌─────────────────┐  ┌─────────────────────┐   │    │
│  │  │  Static Files   │  │   Express Server    │   │    │
│  │  │  (React Build)  │  │   (API Endpoints)   │   │    │
│  │  │     /dist       │  │      /api/*         │   │    │
│  │  └─────────────────┘  └─────────────────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 External Services                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Supabase │  │  Gemini  │  │  OpenAI  │  │  Groq  │  │
│  │    DB    │  │   API    │  │   API    │  │  API   │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Configuration Files

#### render.yaml (Blueprint)
```yaml
services:
  - type: web
    name: agent-builder
    runtime: node
    region: singapore
    plan: free
    buildCommand: npm install --include=dev && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: GEMINI_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      # ... other environment variables
```

#### package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "server": "node ./server/index.js",
    "start": "node ./server/index.js"
  }
}
```

#### vite.config.js
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
```

### Server Configuration

The Express server is configured to serve both API endpoints and static files:

```javascript
// Serve static files from the dist folder
app.use(express.static(path.join(__dirname, '../dist')));

// Handle client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  return res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Listen on all interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Builder API running on port ${PORT}`);
});
```

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NODE_ENV` | Environment mode | Yes |
| `GEMINI_API_KEY` | Google Gemini AI API | Yes |
| `OPENAI_API_KEY` | OpenAI API | Optional |
| `GROQ_API_KEY` | Groq API | Optional |
| `DEEPSEEK_API_KEY` | DeepSeek API | Optional |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | Yes |
| `VITE_SUPABASE_URL` | Frontend Supabase URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Frontend Supabase key | Yes |

### Deployment Process

#### Initial Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Create Render Service**
   - Go to render.com
   - Click "New" → "Web Service"
   - Connect GitHub repository
   - Configure build settings

3. **Set Environment Variables**
   - Add all required API keys in Render dashboard
   - Ensure VITE_* variables are set for frontend

4. **Deploy**
   - Click "Create Web Service"
   - Wait for build and deployment (5-10 minutes)

#### Subsequent Deployments

Auto-deploy is enabled, so pushing to main triggers automatic deployment:

```bash
git add .
git commit -m "Update feature"
git push origin main
# Render auto-deploys within 2-3 minutes
```

#### Manual Redeployment

1. Go to Render Dashboard
2. Click "Manual Deploy"
3. Select "Deploy latest commit" or "Clear build cache & deploy"

### Build Command Details

```bash
rm -rf node_modules package-lock.json && npm install --include=dev && npm run build
```

This command:
1. Removes existing node_modules (fixes npm caching issues)
2. Removes package-lock.json (ensures fresh dependencies)
3. Installs all dependencies including devDependencies
4. Runs Vite build to create production bundle

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `vite: not found` | Add `--include=dev` to npm install |
| `rollup-linux-x64-gnu` error | Clear build cache and redeploy |
| VITE_* variables not working | Variables must be present at build time, redeploy with cache clear |
| API returns HTML instead of JSON | Check that API routes are defined before static file serving |
| "API key leaked" error | Generate new API key and update in Render Environment |

### Performance Considerations

| Aspect | Free Tier Limitation | Mitigation |
|--------|---------------------|------------|
| Cold Start | ~30-50 seconds after inactivity | Keep service warm with periodic pings |
| Memory | 512MB RAM | Optimize bundle size, use code splitting |
| CPU | 0.1 CPU | Minimize server-side computation |
| Bandwidth | Limited | Use CDN for static assets |

### Security Best Practices

1. **Never commit .env files** - Added to .gitignore
2. **Use environment variables** - All secrets stored in Render dashboard
3. **Rotate leaked keys immediately** - Generate new keys if exposed
4. **CORS configuration** - Restrict allowed origins in production
5. **Rate limiting** - Implemented on API endpoints

---

## Summary

These three features significantly enhance the Neural Base Command platform:

| Feature | Value Added |
|---------|-------------|
| Circle to Action | Innovative AI interaction paradigm |
| Voice Chat | Natural, hands-free conversation |
| Cloud Deployment | Publicly accessible, production-ready |

Together, they transform the application from a local development project into a fully-featured, publicly accessible AI agent platform.

---

## Quick Reference

### URLs
- **Production**: https://full-stack-7lgo.onrender.com
- **Health Check**: https://full-stack-7lgo.onrender.com/api/health

### Keyboard Shortcuts
- `Ctrl+Shift+C` - Activate Circle to Action
- `Escape` - Cancel/Close Circle to Action

### Key Technologies
- React 18 + Vite
- Node.js + Express
- Supabase (PostgreSQL)
- Google Gemini AI
- Web Speech API
- Render Cloud Platform
