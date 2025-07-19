# Implementation Plan

- [x] 1. Set up core infrastructure and utilities





  - Create audio wrapper abstraction to enable easy migration from expo-av to expo-audio
  - Implement centralized environment variable validation with clear error messages
  - Set up typed error handling interfaces and retry logic utilities
  - _Requirements: 5.1, 5.4, 7.3, 8.1, 8.2_

- [x] 2. Implement external service wrapper modules





  - Create OpenAI service wrapper with typed interfaces for Whisper and GPT-4o APIs
  - Create ElevenLabs service wrapper with typed interfaces for TTS streaming
  - Implement AbortController support and exponential backoff retry logic in both wrappers
  - Add comprehensive error handling and logging for all external service calls
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 3. Complete Whisper Edge Function implementation





  - Enhance existing /whisper function with proper multipart form handling
  - Add comprehensive error handling and validation for audio file uploads
  - Implement basic rate limiting and CORS headers
  - Add request logging structure for future usage analytics
  - Write unit tests for the function with mocked OpenAI responses
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1, 6.2, 6.3, 7.4, 9.1, 9.3_

- [x] 4. Complete Chat Edge Function implementation





  - Enhance existing /chat function with proper streaming text/event-stream responses
  - Implement persona system prompt injection and book context integration
  - Add RAG retrieval stub hook (retrieveChunks function) for future implementation
  - Implement comprehensive error handling and streaming response management
  - Add usage logging structure and rate limiting via Supabase RLS
  - Write unit tests with mocked OpenAI streaming responses
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.3, 6.1, 6.2, 6.3, 6.4, 9.1, 9.2_

- [x] 5. Complete TTS Edge Function implementation






  - Enhance existing /tts function with proper ElevenLabs Flash v2.5 streaming integration
  - Implement audio/mpeg streaming response with proper headers
  - Add voice ID validation and error handling for invalid voices
  - Implement rate limiting and usage logging structure
  - Write unit tests with mocked ElevenLabs streaming responses





  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 9.1, 9.3_

- [x] 6. Implement mobile API client utilities





  - Update utils/api.ts with complete sttWhisper function implementation
  - Implement chatLLM function with streaming support and onChunk callback handling
  - Implement ttsAudioStream function with proper blob URL generation
  - Add AbortController support and exponential backoff retry logic to all API functions
  - Add comprehensive error handling with typed error responses
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.1, 7.4_

- [x] 7. Create audio playback wrapper
  - Implement utils/audio.ts with playAudio, stopAudio, and pauseAudio functions
  - Abstract expo-av implementation details behind clean interface
  - Add progressive audio streaming support for immediate playback
  - Implement proper audio session management and interruption handling
  - Add error handling and fallback mechanisms for audio failures
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8. Update ConversationScreen integration
  - Replace all mock service calls with real API utility functions
  - Implement streaming text updates using chatLLM onChunk callback
  - Integrate audio playback using the new audio wrapper
  - Add proper state management for recording, thinking, and speaking states
  - Implement error handling and user feedback for all conversation states
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.5, 4.4, 5.3_

- [x] 9. Implement comprehensive testing suite
  - Create Jest mocks for all Edge Function endpoints with deterministic responses
  - Write unit tests for all API utility functions with offline capability
  - Create integration tests for the complete voice conversation loop
  - Implement performance benchmarking tests for latency requirements
  - Add error scenario testing for network failures and service outages
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 10. Add rate limiting and usage monitoring
  - Implement Supabase Row-Level Security policies for per-user rate limiting
  - Create usage logging table structure in Supabase
  - Add usage logging to all Edge Functions with userId, tokens, and latency tracking
  - Implement 429 rate limit responses with proper Retry-After headers
  - Add environment variable configuration for rate limit values
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. Performance optimization and validation
  - Implement latency measurement and logging for all conversation loop stages
  - Add performance monitoring for STT (<400ms), first token (<350ms), and TTS (<300ms) targets
  - Optimize streaming response handling for immediate UI updates
  - Add connection pooling and resource management optimizations
  - Validate end-to-end conversation loop meets <1 second total latency requirement
  - _Requirements: 1.1, 1.2, 1.3, 1.4_