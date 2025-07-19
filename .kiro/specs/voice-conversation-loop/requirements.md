# Requirements Document

## Introduction

The voice conversation loop is the core feature of Inkling that enables users to have near-instant, spoken conversations with AI personas about books. This feature implements the primary user experience goal: press the mic, speak, and hear a reply in roughly one second. The system consists of three integrated services (speech-to-text, chat generation, and text-to-speech) that work together to create a seamless voice interaction experience.

## Requirements

### Requirement 1

**User Story:** As a user, I want to speak to my device and receive an audio response from an AI persona about a book, so that I can have natural conversations about literature.

#### Acceptance Criteria

1. WHEN a user speaks into the microphone THEN the system SHALL convert speech to text within 400ms
2. WHEN speech-to-text conversion completes THEN the system SHALL generate a persona-based response within 350ms of first token
3. WHEN response generation begins THEN the system SHALL convert text to speech and start audio playback within 300ms of first audio bytes
4. WHEN the conversation loop executes THEN the total latency SHALL be under 1 second from speech end to audio start

### Requirement 2

**User Story:** As a user, I want my voice input to be accurately transcribed, so that the AI persona can understand and respond appropriately to my questions.

#### Acceptance Criteria

1. WHEN a user uploads audio data THEN the system SHALL accept multipart audio format
2. WHEN audio is received THEN the system SHALL forward it to OpenAI Whisper API
3. WHEN transcription completes THEN the system SHALL return structured JSON with text field
4. WHEN transcription fails THEN the system SHALL return appropriate error messages with retry capability
5. WHEN multiple requests occur THEN the system SHALL implement rate limiting to prevent abuse

### Requirement 3

**User Story:** As a user, I want to receive contextual responses from different AI personas about specific books, so that I can have varied and engaging literary discussions.

#### Acceptance Criteria

1. WHEN a chat request is made THEN the system SHALL accept transcript, personaId, and bookId parameters
2. WHEN processing a request THEN the system SHALL prepend the appropriate persona system prompt
3. WHEN calling the LLM THEN the system SHALL use GPT-4o with streaming enabled
4. WHEN response is generated THEN the system SHALL stream text/event-stream back to client
5. WHEN streaming occurs THEN the system SHALL provide real-time token updates to the UI
6. IF RAG retrieval is available THEN the system SHALL include relevant book passages in the context

### Requirement 4

**User Story:** As a user, I want to hear responses in different voices that match the personas, so that the conversation feels more immersive and character-appropriate.

#### Acceptance Criteria

1. WHEN text-to-speech is requested THEN the system SHALL accept text and voiceId parameters
2. WHEN processing TTS THEN the system SHALL call ElevenLabs Flash v2.5 stream endpoint
3. WHEN audio is generated THEN the system SHALL pipe audio/mpeg bytes directly to client
4. WHEN audio streaming begins THEN the system SHALL start playback immediately without waiting for completion
5. WHEN TTS fails THEN the system SHALL provide fallback error handling

### Requirement 5

**User Story:** As a developer, I want all external service calls to be abstracted behind typed wrappers, so that we can easily swap providers and maintain clean architecture.

#### Acceptance Criteria

1. WHEN integrating external services THEN the system SHALL wrap each service in its own typed module
2. WHEN exposing APIs to mobile layer THEN the system SHALL provide provider-agnostic interfaces
3. WHEN implementing streaming THEN all helpers SHALL accept onChunk callbacks
4. WHEN making service calls THEN the system SHALL implement AbortController for cancellation
5. WHEN errors occur THEN the system SHALL implement exponential backoff retry logic

### Requirement 6

**User Story:** As a system administrator, I want API usage to be monitored and rate-limited, so that the service remains stable and costs are controlled.

#### Acceptance Criteria

1. WHEN any Edge Function is called THEN the system SHALL log userId, path, tokensIn, tokensOut, and latencyMs
2. WHEN users make requests THEN the system SHALL enforce Row-Level Security rate limits
3. WHEN rate limits are exceeded THEN the system SHALL return 429 status with appropriate headers
4. WHEN configuring limits THEN the system SHALL read limit values from environment variables
5. IF usage logging fails THEN the system SHALL continue processing but log the error

### Requirement 7

**User Story:** As a mobile app user, I want secure API access without exposing sensitive keys, so that my data and the service remain protected.

#### Acceptance Criteria

1. WHEN the mobile app makes API calls THEN it SHALL only use SUPABASE_URL and SUPABASE_ANON_KEY
2. WHEN Edge Functions need external API keys THEN they SHALL read from Supabase Function secrets
3. WHEN building the app bundle THEN no OpenAI or ElevenLabs keys SHALL be included
4. WHEN making cross-origin requests THEN all Edge Functions SHALL include proper CORS headers
5. WHEN environment variables are accessed THEN they SHALL be centralized in utils/env.ts

### Requirement 8

**User Story:** As a developer, I want audio playback to be abstracted, so that we can easily migrate from expo-av to expo-audio without breaking changes.

#### Acceptance Criteria

1. WHEN implementing audio playback THEN the system SHALL use a playAudio(uri) wrapper function
2. WHEN the audio abstraction is used THEN it SHALL hide implementation details from screens
3. WHEN migrating audio libraries THEN only the wrapper implementation SHALL need changes
4. WHEN audio playback fails THEN the wrapper SHALL provide consistent error handling
5. WHEN audio streaming occurs THEN the wrapper SHALL support progressive playback

### Requirement 9

**User Story:** As a developer, I want comprehensive testing capabilities, so that the system can be tested reliably in offline environments.

#### Acceptance Criteria

1. WHEN running unit tests THEN the system SHALL provide deterministic Jest mocks for Edge endpoints
2. WHEN mocks are used THEN they SHALL return realistic response data and timing
3. WHEN testing offline THEN all external service calls SHALL be mockable
4. WHEN tests run THEN they SHALL not require actual API keys or network access
5. WHEN mocking streaming responses THEN the mocks SHALL simulate chunk-by-chunk delivery