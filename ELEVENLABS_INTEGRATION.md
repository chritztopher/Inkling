# ElevenLabs Text-to-Speech Integration

This document describes the ElevenLabs TTS integration in the Inkling mobile app.

## Overview

The integration provides voice synthesis for assistant responses in the ConversationScreen, allowing users to hear AI personas speak their responses naturally.

## Features

- **Real-time TTS**: Convert text responses to speech using ElevenLabs API
- **Voice Mapping**: Different voices for different personas (Jane Austen, Shakespeare, etc.)
- **Provider-agnostic**: Easily switch between TTS providers
- **Error Handling**: Graceful fallbacks with user-friendly error messages
- **Resource Management**: Proper cleanup of audio resources
- **Usage Tracking**: Monitor API credits and usage

## Setup

### 1. Environment Configuration

Create a `.env` file in your project root:

```bash
ELEVENLABS_API_KEY=your_api_key_here
```

The API key is securely loaded through `app.config.js` and accessed via Expo Constants.

### 2. Dependencies

Required packages are already included in `package.json`:

- `dotenv` - Environment variable loading
- `expo-constants` - Access to Expo configuration
- `react-native-toast-message` - User-friendly error notifications

## Architecture

### File Structure

```
utils/
├── eleven.ts      # ElevenLabs API wrapper
├── tts.ts         # Provider-agnostic TTS interface
└── voice.ts       # Voice recording utilities

services/
└── chat.ts        # Chat service (updated for TTS integration)

app/screens/
└── ConversationScreen.tsx  # Main integration point
```

### Core Components

#### 1. ElevenLabs Wrapper (`utils/eleven.ts`)

Direct interface to ElevenLabs API:

```typescript
export async function elevenTTS(
  text: string,
  voiceId = "21m00Tcm4TlvDq8ikWAM",
  model = "eleven_multilingual_v2"
): Promise<string>
```

Features:
- Streaming audio for faster playback
- Credit usage tracking
- Error handling with detailed messages
- Input validation

#### 2. TTS Provider Interface (`utils/tts.ts`)

Provider-agnostic interface for easy switching:

```typescript
export async function synthesize(
  text: string,
  personaId?: string,
  options?: TTSOptions
): Promise<string>
```

Features:
- Voice mapping per persona
- Provider switching capability
- Consistent error handling
- Future-proof for additional providers

#### 3. ConversationScreen Integration

Updated to use TTS instead of pre-generated audio:

```typescript
// Before
const response = await getInklingResponse(transcript, personaId, bookId);
await playAudioResponse(response.audioUrl);

// After
const response = await getInklingResponse(transcript, personaId, bookId);
await handleAssistantReply(response.text, personaId);
```

## Voice Mapping

Different personas use different ElevenLabs voices:

| Persona | Voice ID | Description |
|---------|----------|-------------|
| jane-austen | 21m00Tcm4TlvDq8ikWAM | Default English female |
| shakespeare | 29vD33N1CtxCmqQRPOHJ | English male (Adam) |
| hemingway | pNInz6obpgDQGcFmaJgB | American male (Josh) |
| default | 21m00Tcm4TlvDq8ikWAM | Fallback voice |

## Error Handling

### Types of Errors

1. **Configuration Errors**: Missing or invalid API key
2. **Network Errors**: API unavailable or timeout
3. **Audio Errors**: Playback failures
4. **Resource Errors**: Memory or cleanup issues

### Error Response Strategy

- **Toast Notifications**: Non-intrusive error messages
- **Graceful Degradation**: Continue conversation without audio
- **Logging**: Detailed error logs for debugging
- **Resource Cleanup**: Prevent memory leaks

### Example Error Flow

```typescript
try {
  const audioUrl = await synthesize(text, personaId);
  await playAudio(audioUrl);
} catch (error) {
  console.error('TTS Error:', error);
  Toast.show({
    type: 'error',
    text1: 'Voice Error',
    text2: 'Failed to generate voice response. Please try again.',
  });
  // Continue conversation without audio
}
```

## Usage

### Basic Usage

```typescript
import { synthesize } from '../utils/tts';

// Synthesize speech for a persona
const audioUrl = await synthesize(
  "Hello, I'm Jane Austen. How can I help you today?",
  "jane-austen"
);

// Play the audio
const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
await sound.playAsync();
```

### Advanced Usage

```typescript
// Use specific voice and model
const audioUrl = await synthesize(
  "To be or not to be, that is the question.",
  "shakespeare",
  {
    voiceId: "29vD33N1CtxCmqQRPOHJ",
    model: "eleven_multilingual_v2",
    provider: "eleven"
  }
);
```

### Voice Management

```typescript
import { setPersonaVoice, getVoiceMapping } from '../utils/tts';

// Update voice for a persona
setPersonaVoice("new-persona", "new-voice-id");

// Get current voice mapping
const voices = getVoiceMapping();
console.log(voices);
```

## API Integration

### ElevenLabs API Features Used

- **Text-to-Speech Streaming**: `/v1/text-to-speech/{voice_id}/stream`
- **Voice Listing**: `/v1/voices`
- **User Info**: `/v1/user`

### Request Format

```json
{
  "text": "Hello world",
  "model_id": "eleven_multilingual_v2",
  "voice_settings": {
    "similarity_boost": 0.75,
    "style": 0.3,
    "stability": 0.5
  }
}
```

### Response Handling

- **Success**: Returns audio blob as `audio/mpeg`
- **Error**: Detailed error message with status code
- **Credits**: Track usage via `x-credits-used` header

## Performance Considerations

### Optimization Strategies

1. **Streaming Audio**: Use `/stream` endpoint for faster playback
2. **Blob URLs**: Create local blob URLs for efficient playback
3. **Resource Cleanup**: Properly dispose of audio objects
4. **Error Boundaries**: Prevent TTS errors from crashing the app

### Memory Management

```typescript
// Proper cleanup in useEffect
useEffect(() => {
  return () => {
    if (currentSound) {
      currentSound.stopAsync()
        .then(() => currentSound.unloadAsync())
        .catch(console.error);
    }
  };
}, []);
```

## Testing

### Acceptance Test Checklist

1. **Environment Setup**
   - [ ] `.env` file created with API key
   - [ ] API key not committed to git
   - [ ] App loads without errors

2. **Basic Functionality**
   - [ ] Navigate to ConversationScreen
   - [ ] Hold mic button and speak
   - [ ] Receive text response
   - [ ] Audio plays within 1 second
   - [ ] Credits used logged in console

3. **Error Handling**
   - [ ] Invalid API key shows error
   - [ ] Network errors handled gracefully
   - [ ] Audio errors don't crash app
   - [ ] Toast notifications appear

4. **Cleanup**
   - [ ] Audio stops when leaving screen
   - [ ] No memory leaks
   - [ ] Proper resource disposal

### Manual Testing

```bash
# 1. Start the app
yarn expo start

# 2. Navigate to conversation
# 3. Test voice interaction
# 4. Check console for credit usage
# 5. Test error scenarios (disable network, invalid key)
```

## Monitoring

### Usage Tracking

```typescript
// Credit usage logging
const creditsUsed = response.headers.get("x-credits-used");
if (creditsUsed) {
  console.info("Eleven credits used:", creditsUsed);
}
```

### Performance Metrics

- **TTS Latency**: Time from text to audio URL
- **Playback Latency**: Time from URL to audio start
- **Error Rate**: Percentage of failed requests
- **Credit Consumption**: API credits used per conversation

## Troubleshooting

### Common Issues

1. **No Audio**: Check device volume, test with different text
2. **Slow Response**: Monitor network, try shorter text
3. **Credit Exhaustion**: Check ElevenLabs account balance
4. **Permission Denied**: Verify API key validity

### Debug Mode

Enable detailed logging:

```typescript
// In utils/eleven.ts
const DEBUG = true;
if (DEBUG) {
  console.log('TTS Request:', { text, voiceId, model });
  console.log('TTS Response:', response.status, response.headers);
}
```

## Future Enhancements

### Planned Features

1. **Voice Cloning**: Custom voices for each persona
2. **Emotion Control**: Dynamic voice emotion based on context
3. **Caching**: Cache frequently used phrases
4. **Offline Mode**: Fallback to device TTS
5. **Real-time Streaming**: Stream audio as it's generated

### Provider Expansion

Framework is ready for additional providers:

```typescript
// Future providers
import { vogentTTS } from "./vogent";
import { azureTTS } from "./azure";

const PROVIDER = "eleven"; // Switch as needed
```

## Security

### API Key Management

- Store in environment variables only
- Never commit to version control
- Use different keys for development/production
- Rotate keys periodically

### Data Privacy

- Text is sent to ElevenLabs API
- Audio is generated server-side
- No persistent storage of audio data
- Follow ElevenLabs privacy policy

## Support

For issues or questions:

1. Check ElevenLabs API documentation
2. Review error logs and console output
3. Test with minimal text examples
4. Verify API key and account status

---

**Note**: This integration requires an active ElevenLabs account with available credits. Monitor usage to avoid service interruptions. 