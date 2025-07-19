# Mobile API Client Utilities

Comprehensive API client utilities for Inkling's voice conversation loop, providing typed interfaces for all Edge Function communication with robust error handling, retry logic, and AbortController support.

## Features

- **Complete STT Integration**: Speech-to-text with OpenAI Whisper
- **Streaming Chat Support**: Real-time chat generation with persona context
- **TTS Audio Streaming**: Text-to-speech with ElevenLabs Flash v2.5
- **AbortController Support**: Request cancellation for all functions
- **Exponential Backoff**: Intelligent retry logic with jitter
- **Comprehensive Error Handling**: Typed error responses with context
- **Offline Testing**: Deterministic mocks for reliable testing
- **Progress Callbacks**: Real-time updates for streaming operations

## Quick Start

```typescript
import { sttWhisper, chatLLM, ttsAudioStream } from '../utils/api';

// Speech-to-text conversion
const transcript = await sttWhisper('file://audio.webm');

// Streaming chat with persona
const response = await chatLLM(
  transcript, 
  'persona-id', 
  'book-id',
  {
    onChunk: (chunk) => console.log('Received:', chunk),
    onComplete: (fullText) => console.log('Complete:', fullText)
  }
);

// Text-to-speech conversion
const audioUrl = await ttsAudioStream(response, 'voice-id');
```

## API Reference

### sttWhisper(fileUri, options?)

Converts audio to text using OpenAI Whisper.

**Parameters:**
- `fileUri: string` - URI of the audio file to transcribe
- `options?: APIOptions` - Optional configuration

**Options:**
```typescript
interface APIOptions {
  timeout?: number;    // Request timeout in ms (default: 30000)
  retries?: number;    // Max retry attempts (default: 3)
  signal?: AbortSignal; // Cancellation signal
}
```

**Returns:** `Promise<string>` - Transcribed text

**Example:**
```typescript
// Basic usage
const text = await sttWhisper('file://recording.webm');

// With options
const text = await sttWhisper('file://recording.webm', {
  timeout: 15000,
  retries: 2,
  signal: controller.signal
});
```

### chatLLM(transcript, personaId, bookId, options?)

Generates streaming chat responses with persona and book context.

**Parameters:**
- `transcript: string` - User's transcribed speech
- `personaId: string` - ID of the AI persona to use
- `bookId: string` - ID of the book for context
- `options?: ChatStreamOptions` - Streaming configuration

**Options:**
```typescript
interface ChatStreamOptions {
  onChunk?: (chunk: string) => void;      // Called for each text chunk
  onComplete?: (fullText: string) => void; // Called when streaming completes
  onError?: (error: Error) => void;       // Called on errors
  signal?: AbortSignal;                   // Cancellation signal
}
```

**Returns:** `Promise<string>` - Complete response text

**Example:**
```typescript
const response = await chatLLM(
  'What is the main theme of this book?',
  'literary-critic',
  'pride-and-prejudice',
  {
    onChunk: (chunk) => {
      // Update UI progressively
      setDisplayText(prev => prev + chunk);
    },
    onComplete: (fullText) => {
      console.log('Chat complete:', fullText);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    }
  }
);
```

### ttsAudioStream(text, voiceId?, options?)

Converts text to speech with streaming audio response.

**Parameters:**
- `text: string` - Text to convert to speech
- `voiceId?: string` - ElevenLabs voice ID (default: Rachel)
- `options?: TTSStreamOptions` - Streaming configuration

**Options:**
```typescript
interface TTSStreamOptions {
  onProgress?: (bytesReceived: number, totalBytes?: number) => void;
  onComplete?: (audioUrl: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}
```

**Returns:** `Promise<string>` - Blob URL for audio playback

**Example:**
```typescript
const audioUrl = await ttsAudioStream(
  'Hello, welcome to our conversation!',
  '21m00Tcm4TlvDq8ikWAM', // Rachel voice
  {
    onProgress: (received, total) => {
      const progress = total ? (received / total) * 100 : 0;
      setLoadingProgress(progress);
    },
    onComplete: (url) => {
      console.log('Audio ready:', url);
    }
  }
);

// Play the audio
const audio = new Audio(audioUrl);
await audio.play();
```

## Error Handling

The API utilities use typed error classes for precise error handling:

### Error Types

```typescript
import { APIError, NetworkError, ValidationError, AudioError } from '../utils/api';

try {
  const result = await sttWhisper('file://audio.webm');
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors (empty input, invalid format)
    console.error('Validation error:', error.field, error.value);
  } else if (error instanceof NetworkError) {
    // Handle network errors (timeout, connection issues)
    console.error('Network error:', error.statusCode, error.url);
  } else if (error instanceof APIError) {
    // Handle API errors (server errors, rate limits)
    console.error('API error:', error.endpoint, error.statusCode);
  } else if (error instanceof AudioError) {
    // Handle audio-specific errors
    console.error('Audio error:', error.operation);
  }
}
```

### Error Context

All errors include detailed context for debugging:

```typescript
try {
  await chatLLM('', 'persona', 'book'); // Empty transcript
} catch (error) {
  console.log(error.context);
  // {
  //   operation: 'chat_llm',
  //   transcript: '...',
  //   personaId: 'persona',
  //   bookId: 'book',
  //   timeout: 45000
  // }
}
```

## Retry Logic

All functions implement intelligent retry logic with exponential backoff:

### Default Retry Behavior

- **STT**: 3 attempts, 1s base delay, max 10s delay
- **Chat**: 2 attempts, 500ms base delay, max 5s delay  
- **TTS**: 2 attempts, 500ms base delay, max 5s delay

### Retry Conditions

- **Network errors**: 5xx status codes, timeouts
- **Rate limits**: 429 status codes (with backoff)
- **Transient failures**: Connection issues, temporary outages

### Custom Retry Configuration

```typescript
import { withRetry, DEFAULT_RETRY_CONFIGS } from '../utils/api';

// Custom retry logic
const result = await withRetry(
  () => sttWhisper('file://audio.webm'),
  {
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterMs: 200,
    onRetry: (error, attempt, delayMs) => {
      console.log(`Retry ${attempt} after ${delayMs}ms:`, error.message);
    }
  }
);
```

## Request Cancellation

All functions support AbortController for request cancellation:

```typescript
const controller = new AbortController();

// Cancel after 10 seconds
setTimeout(() => controller.abort(), 10000);

try {
  const result = await chatLLM(
    'Long conversation...',
    'persona',
    'book',
    { signal: controller.signal }
  );
} catch (error) {
  if (error.message.includes('cancelled')) {
    console.log('Request was cancelled');
  }
}
```

## Performance Optimization

### Concurrent Requests

```typescript
// Process multiple requests in parallel
const [transcript1, transcript2, transcript3] = await Promise.all([
  sttWhisper('file://audio1.webm'),
  sttWhisper('file://audio2.webm'),
  sttWhisper('file://audio3.webm')
]);
```

### Streaming for Immediate Feedback

```typescript
// Start playing audio as soon as first bytes arrive
let audioElement: HTMLAudioElement;

const audioUrl = await ttsAudioStream(text, voiceId, {
  onProgress: (received, total) => {
    if (received > 1024 && !audioElement) {
      // Start playback with partial data
      audioElement = new Audio(audioUrl);
      audioElement.play();
    }
  }
});
```

### Memory Management

```typescript
// Clean up blob URLs to prevent memory leaks
const audioUrl = await ttsAudioStream('Hello world');
const audio = new Audio(audioUrl);

audio.addEventListener('ended', () => {
  URL.revokeObjectURL(audioUrl); // Free memory
});

await audio.play();
```

## Testing

### Unit Tests

The API utilities include comprehensive unit tests with offline capability:

```bash
npm test utils/api.test.ts
```

### Mock Usage

```typescript
import { jest } from '@jest/globals';

// Mock the API utilities for testing
jest.mock('../utils/api', () => ({
  sttWhisper: jest.fn().mockResolvedValue('Mock transcript'),
  chatLLM: jest.fn().mockImplementation((_, __, ___, options) => {
    if (options?.onChunk) {
      setTimeout(() => options.onChunk('Mock '), 100);
      setTimeout(() => options.onChunk('response'), 200);
    }
    return Promise.resolve('Mock response');
  }),
  ttsAudioStream: jest.fn().mockResolvedValue('blob:mock-audio-url')
}));
```

### Integration Testing

```typescript
// Test the complete voice conversation loop
describe('Voice Conversation Loop', () => {
  it('should complete end-to-end conversation', async () => {
    // Record audio (mocked)
    const audioUri = 'file://test-recording.webm';
    
    // Speech-to-text
    const transcript = await sttWhisper(audioUri);
    expect(transcript).toBeTruthy();
    
    // Chat generation
    const response = await chatLLM(transcript, 'persona-1', 'book-1');
    expect(response).toBeTruthy();
    
    // Text-to-speech
    const audioUrl = await ttsAudioStream(response);
    expect(audioUrl).toMatch(/^blob:/);
  });
});
```

## Environment Configuration

The API utilities automatically validate environment configuration:

```typescript
// Required environment variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

// Optional configuration
TTS_RATE_LIMIT=10
WHISPER_TIMEOUT=30000
CHAT_TIMEOUT=45000
```

### Environment Validation

```typescript
import { getEnvironmentConfig, isEnvironmentConfigured } from '../utils/env';

if (!isEnvironmentConfigured()) {
  console.error('Environment not properly configured');
  // App will show configuration error screen
}

const config = getEnvironmentConfig();
console.log('Using Supabase URL:', config.SUPABASE_URL);
```

## Security Considerations

### API Key Management

- ✅ No external API keys in mobile app bundle
- ✅ All sensitive keys stored as Supabase Function secrets
- ✅ Only SUPABASE_URL and SUPABASE_ANON_KEY used client-side
- ✅ Proper CORS configuration for cross-origin requests

### Request Authentication

```typescript
// Authenticated requests (when user is logged in)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data: { session } } = await supabase.auth.getSession();

if (session) {
  // Requests will include user authentication
  const transcript = await sttWhisper('file://audio.webm');
}
```

### Rate Limiting

The Edge Functions implement per-user rate limiting:

- **Default limits**: 10 requests per minute per user
- **Rate limit responses**: 429 status with Retry-After header
- **Graceful degradation**: Clear error messages with retry guidance

## Troubleshooting

### Common Issues

**"Environment not configured" error:**
```bash
# Check your .env file
cat .env

# Restart with cache clear
npx expo start -c
```

**Network timeout errors:**
```typescript
// Increase timeout for slow connections
const result = await sttWhisper('file://audio.webm', {
  timeout: 60000 // 60 seconds
});
```

**Audio playback issues:**
```typescript
// Check audio format and size
const audioUrl = await ttsAudioStream('Hello world');
console.log('Audio URL:', audioUrl);

// Verify blob URL is valid
fetch(audioUrl).then(response => {
  console.log('Audio size:', response.headers.get('content-length'));
  console.log('Audio type:', response.headers.get('content-type'));
});
```

**Streaming interruption:**
```typescript
// Handle streaming errors gracefully
const response = await chatLLM(transcript, persona, book, {
  onChunk: (chunk) => updateUI(chunk),
  onError: (error) => {
    console.error('Streaming error:', error);
    // Fallback to non-streaming mode
    showErrorMessage('Connection interrupted. Please try again.');
  }
});
```

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
import { logError } from '../utils/errors';

// Enable debug logging
process.env.DEBUG = 'api:*';

// All API calls will log detailed information
const result = await sttWhisper('file://audio.webm');
```

## Requirements Compliance

This implementation satisfies the following requirements:

- **5.1**: ✅ Typed wrappers for all external services
- **5.2**: ✅ Provider-agnostic interfaces for mobile layer
- **5.3**: ✅ Streaming support with onChunk callbacks
- **5.4**: ✅ AbortController support for cancellation
- **5.5**: ✅ Exponential backoff retry logic
- **7.1**: ✅ Secure API access without exposing keys
- **7.4**: ✅ Proper CORS headers for cross-origin requests
- **9.1**: ✅ Deterministic Jest mocks for testing
- **9.3**: ✅ All external service calls are mockable
- **9.4**: ✅ Offline testing capability
- **9.5**: ✅ Performance benchmarking support

## Audio Playback Wrapper

The audio playback wrapper (`utils/audio.ts`) provides a clean abstraction layer over expo-av to enable easy migration to expo-audio without breaking changes. It offers consistent error handling, progressive audio streaming, and proper resource management.

### Features

- **Library Abstraction**: Hides expo-av implementation details behind clean interfaces
- **Progressive Playback**: Supports streaming audio with immediate playback
- **Audio Session Management**: Configures optimal audio session settings
- **Resource Cleanup**: Automatic cleanup to prevent memory leaks
- **Error Handling**: Comprehensive error handling with typed AudioError
- **Status Tracking**: Real-time audio playback status updates
- **Concurrent Audio**: Support for multiple simultaneous audio instances

### Quick Start

```typescript
import { 
  playAudio, 
  stopAudio, 
  pauseAudio, 
  configureAudioSession,
  AudioStatus 
} from '../utils/audio';

// Configure audio session (call once at app startup)
await configureAudioSession();

// Play audio with callbacks
const audioInstance = await playAudio('blob:audio-url', {
  onLoadComplete: (duration) => console.log(`Audio loaded: ${duration}ms`),
  onPlaybackStatusUpdate: (status) => console.log('Status:', status),
  onPlaybackComplete: () => console.log('Playback finished')
});

// Control playback
await pauseAudio(audioInstance);
await resumeAudio(audioInstance);
await stopAudio(audioInstance);
```

### API Reference

#### configureAudioSession()

Configures the audio session for optimal playback. Should be called once when the app starts.

```typescript
await configureAudioSession();
```

**Configuration:**
- iOS: Plays in silent mode, handles interruptions properly
- Android: Ducks other audio, prevents mixing
- Background: Stops when app goes to background

#### playAudio(uri, options?)

Plays audio from a URI with comprehensive options and callbacks.

**Parameters:**
- `uri: string` - Audio URI (blob URL, file URI, or network URL)
- `options?: AudioPlaybackOptions` - Playback configuration

**Options:**
```typescript
interface AudioPlaybackOptions {
  shouldPlay?: boolean;                    // Auto-play (default: true)
  volume?: number;                         // Volume 0.0-1.0 (default: 1.0)
  rate?: number;                          // Playback rate (default: 1.0)
  shouldLoop?: boolean;                   // Loop playback (default: false)
  progressUpdateIntervalMillis?: number;  // Update interval (default: 100)
  onLoadStart?: () => void;               // Called when loading starts
  onLoadComplete?: (duration: number) => void; // Called when loaded
  onPlaybackStatusUpdate?: (status: AudioPlaybackStatus) => void;
  onPlaybackComplete?: () => void;        // Called when finished
  onError?: (error: Error) => void;       // Called on errors
}
```

**Returns:** `Promise<AudioInstance>` - Audio instance for control

**Example:**
```typescript
const audioInstance = await playAudio('blob:tts-audio', {
  volume: 0.8,
  onLoadComplete: (duration) => {
    console.log(`Audio duration: ${duration / 1000}s`);
  },
  onPlaybackStatusUpdate: (status) => {
    if (status.isPlaying) {
      const progress = (status.position / status.duration!) * 100;
      updateProgressBar(progress);
    }
  },
  onError: (error) => {
    console.error('Audio playback failed:', error);
    showErrorMessage('Audio playback failed');
  }
});
```

#### playAudioProgressive(uri, options?)

Plays audio with progressive loading optimized for streaming content.

**Additional Options:**
```typescript
interface ProgressiveOptions extends AudioPlaybackOptions {
  onBuffering?: (isBuffering: boolean) => void; // Buffering state changes
  onReadyToPlay?: () => void;                   // Ready for playback
}
```

**Example:**
```typescript
const audioInstance = await playAudioProgressive('blob:streaming-tts', {
  onBuffering: (isBuffering) => {
    setLoadingSpinner(isBuffering);
  },
  onReadyToPlay: () => {
    console.log('Audio ready for immediate playback');
  }
});
```

#### stopAudio(instance)

Stops audio playback and cleans up resources.

```typescript
await stopAudio(audioInstance);
```

#### pauseAudio(instance) / resumeAudio(instance)

Pause and resume audio playback.

```typescript
await pauseAudio(audioInstance);
await resumeAudio(audioInstance);
```

#### seekAudio(instance, positionMillis)

Seek to a specific position in the audio.

```typescript
await seekAudio(audioInstance, 30000); // Seek to 30 seconds
```

#### setAudioVolume(instance, volume)

Set the audio volume (0.0 to 1.0).

```typescript
await setAudioVolume(audioInstance, 0.5); // 50% volume
```

#### getAudioStatus(instance)

Get current audio playback status.

```typescript
const status = await getAudioStatus(audioInstance);
console.log('Position:', status.position);
console.log('Duration:', status.duration);
console.log('Is Playing:', status.isPlaying);
```

#### stopAllAudio()

Stop all active audio instances (useful for cleanup).

```typescript
await stopAllAudio();
```

#### cleanupAudioResources()

Clean up all audio resources (call when app backgrounds).

```typescript
await cleanupAudioResources();
```

### Audio Status Management

The wrapper provides detailed status tracking:

```typescript
enum AudioStatus {
  LOADING = 'loading',     // Audio is loading
  READY = 'ready',         // Audio loaded, ready to play
  PLAYING = 'playing',     // Currently playing
  PAUSED = 'paused',       // Paused
  STOPPED = 'stopped',     // Stopped
  ERROR = 'error',         // Error occurred
  FINISHED = 'finished'    // Playback completed
}

interface AudioPlaybackStatus {
  isLoaded: boolean;       // Audio file loaded
  isPlaying: boolean;      // Currently playing
  position: number;        // Current position (ms)
  duration?: number;       // Total duration (ms)
  volume: number;          // Current volume (0.0-1.0)
  rate: number;           // Playback rate
  shouldLoop: boolean;     // Loop enabled
  error?: string;         // Error message if any
}
```

### Error Handling

The wrapper uses typed AudioError for consistent error handling:

```typescript
import { AudioError } from '../utils/audio';

try {
  const audioInstance = await playAudio('invalid-url');
} catch (error) {
  if (error instanceof AudioError) {
    console.error('Audio operation:', error.operation);
    console.error('Error context:', error.context);
    
    switch (error.operation) {
      case 'PLAY':
        showError('Failed to play audio');
        break;
      case 'LOAD':
        showError('Failed to load audio file');
        break;
      case 'PAUSE':
        showError('Failed to pause audio');
        break;
    }
  }
}
```

### Progressive Audio Streaming

For TTS and streaming audio, use progressive playback:

```typescript
// Get streaming audio from TTS
const audioUrl = await ttsAudioStream('Hello world');

// Play with progressive loading
const audioInstance = await playAudioProgressive(audioUrl, {
  onBuffering: (isBuffering) => {
    // Show/hide loading indicator
    setIsBuffering(isBuffering);
  },
  onReadyToPlay: () => {
    // Audio starts playing immediately
    setIsPlaying(true);
  },
  onPlaybackComplete: () => {
    // Clean up when finished
    setIsPlaying(false);
    URL.revokeObjectURL(audioUrl); // Free memory
  }
});
```

### Memory Management

The wrapper includes automatic memory management:

```typescript
// Audio instances are tracked automatically
const audio1 = await playAudio('blob:audio1');
const audio2 = await playAudio('blob:audio2');

// Stop all audio when app backgrounds
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    await cleanupAudioResources();
  }
});

// Clean up individual instances
await stopAudio(audio1); // Automatically unloads and cleans up
```

### Migration from expo-av to expo-audio

The wrapper is designed to make migration seamless:

```typescript
// Current implementation uses expo-av
import { Audio } from 'expo-av';

// Future migration to expo-audio only requires changing the wrapper implementation
// All client code using playAudio(), stopAudio(), etc. remains unchanged

// The wrapper interface stays the same:
const audioInstance = await playAudio(uri, options);
await pauseAudio(audioInstance);
await resumeAudio(audioInstance);
await stopAudio(audioInstance);
```

### Testing

The wrapper includes comprehensive tests with offline capability:

```typescript
// Tests use mocked expo-av for reliable offline testing
import { playAudio, AudioStatus } from '../utils/audio';

// All tests work without actual audio files
const audioInstance = await playAudio('blob:mock-audio');
expect(audioInstance.status).toBe(AudioStatus.READY);
```

### Constants

```typescript
import { AUDIO_CONSTANTS } from '../utils/audio';

console.log(AUDIO_CONSTANTS.DEFAULT_VOLUME);              // 1.0
console.log(AUDIO_CONSTANTS.DEFAULT_RATE);                // 1.0
console.log(AUDIO_CONSTANTS.DEFAULT_PROGRESS_UPDATE_INTERVAL); // 100ms
console.log(AUDIO_CONSTANTS.MAX_CONCURRENT_AUDIO);        // 5
```

### Best Practices

1. **Configure Session Early**: Call `configureAudioSession()` at app startup
2. **Handle Errors**: Always wrap audio operations in try-catch blocks
3. **Clean Up Resources**: Call `stopAudio()` when done with audio instances
4. **Use Progressive Loading**: Use `playAudioProgressive()` for streaming content
5. **Monitor Status**: Use status callbacks for UI updates
6. **Background Handling**: Clean up audio when app goes to background
7. **Memory Management**: Revoke blob URLs when finished

### Requirements Compliance

This implementation satisfies the following requirements:

- **8.1**: ✅ Uses playAudio(uri) wrapper function
- **8.2**: ✅ Hides implementation details from screens
- **8.3**: ✅ Only wrapper implementation needs changes for migration
- **8.4**: ✅ Provides consistent error handling
- **8.5**: ✅ Supports progressive playback for streaming