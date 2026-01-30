# Voice Chat Feature - Gemini Live Experience

## Overview
The Voice Chat feature enables real-time conversations with AI agents using speech recognition and text-to-speech technology. Users can speak naturally to their agents and receive voice responses without typing.

## Features

### 🎙️ Speech Recognition
- **Built-in Web Speech API** - No API key required
- Real-time speech-to-text conversion
- Support for continuous listening
- Automatic transcript display

### 🔊 Voice Responses
- **Browser Text-to-Speech** - Natural-sounding AI responses
- Synchronized speaking status
- Interrupt-friendly design
- Volume and speed controls

### 🤖 Multi-Agent Support
- Select from all published agents
- Full conversation history
- Individual agent contexts
- Agent information display

### 📊 Real-time Visualization
- Audio level waveform during recording
- Listening/Speaking/Ready status indicators
- Transcript display with confidence
- Conversation bubbles

### 💡 Smart Features
- Clear conversation history
- Tips and feature information panel
- Device microphone access permission
- Error handling and status messages

## Architecture

### Components

#### VoiceChat.jsx
Main page component handling:
- Speech recognition initialization
- Audio visualization
- Agent selection
- Conversation management
- API communication

**Key Functions:**
- `startListening()` - Begin speech recognition
- `stopListening()` - End recording
- `handleSendMessage()` - Send transcribed message to API
- `speakText()` - Convert response to speech
- `initializeAudioVisualization()` - Setup audio level monitoring

#### VoiceChat.css
Comprehensive styling including:
- Gradient backgrounds (purple theme)
- Responsive layout (desktop/tablet/mobile)
- Waveform animation
- Status badges with pulse effects
- Conversation bubbles

### Data Flow

```
User speaks
    ↓
Speech Recognition captures audio
    ↓
Transcript displayed
    ↓
User reviews and sends
    ↓
Message sent to /api/chat
    ↓
Agent response received
    ↓
Text-to-Speech plays response
    ↓
Conversation bubble appears
    ↓
Ready for next message
```

## How to Use

### 1. Navigate to Voice Chat
- Click the 🎤 microphone icon on the home page
- Or go to `/voice-chat` route

### 2. Select an Agent
- Choose from your published agents in the left sidebar
- Agent description and details appear in the main area

### 3. Start Conversation
- Click "Start Listening" button
- Speak your message clearly
- Stop recording when done
- Review the transcript

### 4. Send Message
- Click "Send Message" button
- AI agent processes and responds
- Response is spoken aloud automatically
- Continue conversation

### 5. End Session
- Click "Clear Chat" to reset conversation
- Or select a different agent

## Browser Requirements

### Supported APIs
- **Web Speech API** (Chrome, Edge, Safari, Opera)
  - `SpeechRecognition` for voice input
  - `SpeechSynthesisUtterance` for voice output
  
### Browser Support
| Browser | Status | Notes |
|---------|--------|-------|
| Chrome | ✅ Full | Best support |
| Edge | ✅ Full | Chromium-based |
| Safari | ✅ Full | iOS 14.5+ |
| Firefox | ⚠️ Limited | Web Speech API support limited |
| Opera | ✅ Full | Chromium-based |

### Microphone Permission
- Browser will request microphone access on first use
- Grant permission to enable voice input

## Technical Details

### Speech Recognition
```javascript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.interimResults = true;
recognition.lang = 'en-US';
```

### Text-to-Speech
```javascript
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = 1;
utterance.pitch = 1;
utterance.volume = 1;
window.speechSynthesis.speak(utterance);
```

### Audio Visualization
- Uses Web Audio API
- Creates `AudioContext` and `AnalyserNode`
- Frequency data displayed as animated bars
- Updates at ~60fps for smooth animation

### API Integration
Sends to `/api/chat` endpoint:
```json
{
  "modelId": "gemini-2.5-flash",
  "messages": [
    { "role": "system", "content": "System prompt" },
    { "role": "user", "content": "User message" }
  ],
  "temperature": 0.7
}
```

## Routing

### Route Configuration
- **Route**: `/voice-chat`
- **Protected**: Yes (requires authentication)
- **Component**: `VoiceChatPage`
- **Layout**: Full-screen immersive experience

### Navigation
```
Home (/) → Voice Chat Button (🎤) → /voice-chat
Dashboard → Navigation Menu → /voice-chat
```

## Tutorial

A comprehensive "Voice Chat with Agents" tutorial is available in the tutorial system:
- **ID**: `voiceChat`
- **Difficulty**: Intermediate
- **Duration**: 4 minutes
- **Steps**: 9 guided steps covering all features

Access by clicking the tutorial button (❓) in the header.

## Performance Considerations

### Optimization
- Speech recognition runs continuously without blocking UI
- Audio visualization uses `requestAnimationFrame` for smooth 60fps
- Message handling is async to prevent UI freezing
- Conversation history scrolls efficiently

### Limitations
- Single agent conversation at a time
- Speech recognition not available in private/incognito windows
- TTS quality depends on browser implementation
- No custom voice profiles (browser defaults used)

## Best Practices

### For Users
1. **Speak clearly** - Distinct pronunciation improves accuracy
2. **Quiet environment** - Reduce background noise
3. **Natural pace** - Speak at comfortable conversation speed
4. **Wait for response** - Let AI finish speaking before interrupting
5. **Review transcript** - Check before sending if accuracy needed

### For Developers
1. **Error handling** - Always handle API failures gracefully
2. **Permissions** - Check microphone access before use
3. **Fallbacks** - Provide text chat alternative if speech fails
4. **Mobile testing** - Test on iOS/Android for compatibility
5. **Accessibility** - Provide captions for deaf users

## Future Enhancements

### Planned Features
1. **Custom Voice Selection** - Choose different voice profiles
2. **Language Support** - Multi-language speech recognition
3. **Voice Cloning** - Agent-specific voice training
4. **Real-time Transcription** - Live captions during speech
5. **Audio Recording** - Save conversations as files
6. **ElevenLabs Integration** - Premium TTS with more voice options
7. **Sentiment Analysis** - Detect emotion in user's voice
8. **Voice Commands** - Control UI with voice

### Integration Possibilities
- WebRTC for peer-to-peer streaming
- Cloud Speech-to-Text (Google Cloud Speech API)
- Advanced audio processing (noise cancellation)
- Multi-modal AI (image + voice input)

## Troubleshooting

### Common Issues

**Microphone not working**
- Check browser permissions (Settings → Privacy → Microphone)
- Ensure microphone is connected and working
- Try a different browser

**Speech recognition not starting**
- Your browser may not support Web Speech API
- Check browser compatibility
- Try using Chrome or Edge

**No sound from AI**
- Volume might be muted in browser
- Speaker volume might be off
- Try muting browser tab and un-muting

**Poor transcription accuracy**
- Speak more clearly and slowly
- Reduce background noise
- Use proper language (English US)
- Avoid speaking too quietly or loudly

**API errors**
- Check internet connection
- Verify backend server is running
- Check agent is published
- Review browser console for details

## Environment Setup

### No Additional Setup Required
The Voice Chat feature uses only browser APIs and no external services by default.

### Optional: ElevenLabs Integration (Future)
If implementing premium TTS:
```env
VITE_ELEVENLABS_API_KEY=your_api_key_here
```

## Files Created

### Core Files
- `src/pages/VoiceChat.jsx` - Main page component
- `src/styles/VoiceChat.css` - Component styling

### Modified Files
- `src/App.jsx` - Added route `/voice-chat`
- `src/pages/Home.jsx` - Added Voice Chat button
- `src/styles.css` - Added button styling
- `src/lib/tutorialSteps.js` - Added voice chat tutorial

## Testing Checklist

- [ ] Voice Chat page loads without errors
- [ ] Microphone permission prompt appears
- [ ] Agent selection works
- [ ] Speech recognition starts/stops correctly
- [ ] Transcript displays accurately
- [ ] Message sends successfully
- [ ] AI response appears and is spoken
- [ ] Conversation history builds correctly
- [ ] Clear Chat button resets conversation
- [ ] Tutorial launches and guides users
- [ ] Mobile responsive layout works
- [ ] Browser audio visualization animates smoothly
- [ ] Status badges update correctly
- [ ] Navigation back to home/chat works

## Support & Contact

For issues or feature requests:
1. Check the troubleshooting section
2. Review browser console for errors
3. Test in supported browser
4. Check microphone permissions

---

**Version**: 1.0
**Status**: Production Ready
**Last Updated**: January 2026
