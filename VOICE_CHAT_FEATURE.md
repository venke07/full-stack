# 🎤 Voice Chat Feature

## Overview
Voice chat functionality has been added to the Chat interface, allowing users to speak to their AI agents and hear responses spoken back.

## Features Implemented

### 1. Speech-to-Text (Voice Input)
- **Microphone button** in chat input area
- Click to start recording your voice
- Uses Web Speech API (browser native)
- Automatically transcribes speech to text
- Visual indicator when listening (red pulsing animation)
- Works with: Chrome, Edge, Safari (with webkit prefix)

### 2. Text-to-Speech (Voice Output)
- **Auto-play toggle** in the sidebar under "Voice Chat" section
- When enabled, agent responses are automatically spoken
- Uses SpeechSynthesis API (browser native)
- Stop speaking button appears when audio is playing
- Adjustable voice settings (rate, pitch, volume can be customized)

### 3. UI Components Added

#### Chat Input Area:
- 🎤 Microphone button (appears only if browser supports voice)
- Changes to ⏹️ when actively listening
- Animated red pulse effect during recording
- Placeholder text changes to "Listening..." when active

#### Sidebar Controls:
- New "🎤 Voice Chat" section
- Checkbox toggle: "Auto-play responses"
- Stop Speaking button (only visible when audio is playing)
- Only appears if browser supports voice features

### 4. Browser Compatibility
- ✅ Chrome/Edge (full support)
- ✅ Safari (with webkit prefix)
- ❌ Firefox (limited Speech Recognition support)

## How to Use

### Voice Input:
1. Navigate to the Chat page
2. Select an agent from the sidebar
3. Click the 🎤 microphone button
4. Speak your message
5. Message will appear in the text input
6. Click Send or press Enter

### Voice Output:
1. In the sidebar, find "🎤 Voice Chat" section
2. Check "Auto-play responses"
3. Send a message (typed or voice)
4. Agent's response will be spoken automatically
5. Click "🔇 Stop Speaking" to interrupt if needed

## Technical Details

### State Management:
```javascript
const [isListening, setIsListening] = useState(false);
const [isPlaying, setIsPlaying] = useState(false);
const [voiceEnabled, setVoiceEnabled] = useState(false);
const [recognition, setRecognition] = useState(null);
const [synthesis, setSynthesis] = useState(null);
const [voiceSupported, setVoiceSupported] = useState(false);
```

### Key Functions:
- `startListening()` - Begins voice recording
- `stopListening()` - Stops voice recording
- `speakText(text)` - Speaks the provided text
- `stopSpeaking()` - Cancels ongoing speech

### Files Modified:
1. **src/pages/Chat.jsx** - Added voice state, hooks, and UI
2. **src/styles.css** - Added voice button styles and animations

## Future Enhancements

Possible improvements:
- Voice selection (different voices)
- Speech rate/pitch controls
- Multi-language support
- Wake word detection
- Voice activity detection (auto-stop when silent)
- Transcript history
- Voice authentication
