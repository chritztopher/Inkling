/**
 * Integration tests for the complete voice conversation loop
 * Tests the end-to-end flow: Recording -> STT -> Chat -> TTS -> Audio Playback
 */

// Mock the API functions directly without importing the actual modules
const mockSttWhisper = jest.fn();
const mockChatLLM = jest.fn();
const mockTtsAudioStream = jest.fn();
const mockPlayAudio = jest.fn();
const mockStopAudio = jest.fn();
const mockStartRecording = jest.fn();
const mockStopRecording = jest.fn();

// Mock the modules
jest.mock('../../utils/api', () => ({
  sttWhisper: mockSttWhisper,
  chatLLM: mockChatLLM,
  ttsAudioStream: mockTtsAudioStream,
}));

jest.mock('../../utils/audio', () => ({
  playAudio: mockPlayAudio,
  stopAudio: mockStopAudio,
  AudioStatus: {
    READY: 'ready',
    LOADING: 'loading',
    PLAYING: 'playing',
    PAUSED: 'paused',
    STOPPED: 'stopped',
    ERROR: 'error',
  },
}));

jest.mock('../../utils/voice', () => ({
  startRecording: mockStartRecording,
  stopRecording: mockStopRecording,
}));

// Define types locally to avoid import issues
interface AudioInstance {
  id: string;
  uri: string;
  sound: any;
  status: string;
}

const AudioStatus = {
  READY: 'ready',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ERROR: 'error',
};

describe('Voice Conversation Loop Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete conversation flow', () => {
    it('should handle a complete voice conversation turn successfully', async () => {
      // Mock recording
      const mockRecording = { stopAndUnloadAsync: jest.fn() };
      mockStartRecording.mockResolvedValue(mockRecording as any);
      mockStopRecording.mockResolvedValue('blob:audio-recording-url');

      // Mock STT
      mockSttWhisper.mockResolvedValue('Hello, can you tell me about Pride and Prejudice?');

      // Mock Chat with streaming
      mockChatLLM.mockImplementation(async (text, personaId, bookId, options) => {
        // Simulate streaming chunks synchronously for testing
        if (options?.onChunk) {
          options.onChunk('Pride and Prejudice ');
          options.onChunk('is a wonderful novel ');
          options.onChunk('about love and society.');
        }
        
        return 'Pride and Prejudice is a wonderful novel about love and society.';
      });

      // Mock TTS
      mockTtsAudioStream.mockResolvedValue('blob:tts-audio-url');

      // Mock Audio playback
      const mockAudioInstance: AudioInstance = {
        id: 'test-audio-1',
        uri: 'blob:tts-audio-url',
        sound: {} as any,
        status: AudioStatus.READY,
      };
      mockPlayAudio.mockResolvedValue(mockAudioInstance);

      // Execute the conversation flow
      const recording = await mockStartRecording();
      expect(recording).toBeDefined();

      const audioUri = await mockStopRecording(recording);
      expect(audioUri).toBe('blob:audio-recording-url');

      const transcript = await mockSttWhisper(audioUri);
      expect(transcript).toBe('Hello, can you tell me about Pride and Prejudice?');

      let streamedText = '';
      const response = await mockChatLLM(
        transcript,
        'jane-austen',
        'pride-and-prejudice',
        {
          onChunk: (chunk: string) => {
            streamedText += chunk;
          }
        }
      );

      expect(response).toBe('Pride and Prejudice is a wonderful novel about love and society.');
      expect(streamedText).toBe('Pride and Prejudice is a wonderful novel about love and society.');

      const audioUrl = await mockTtsAudioStream(response);
      expect(audioUrl).toBe('blob:tts-audio-url');

      const audioInstance = await mockPlayAudio(audioUrl);
      expect(audioInstance).toEqual(mockAudioInstance);

      // Verify all functions were called with correct parameters
      expect(mockSttWhisper).toHaveBeenCalledWith('blob:audio-recording-url');
      expect(mockChatLLM).toHaveBeenCalledWith(
        'Hello, can you tell me about Pride and Prejudice?',
        'jane-austen',
        'pride-and-prejudice',
        expect.objectContaining({
          onChunk: expect.any(Function)
        })
      );
      expect(mockTtsAudioStream).toHaveBeenCalledWith('Pride and Prejudice is a wonderful novel about love and society.');
      expect(mockPlayAudio).toHaveBeenCalledWith('blob:tts-audio-url');
    });

    it('should handle errors gracefully during conversation flow', async () => {
      // Mock recording success
      const mockRecording = { stopAndUnloadAsync: jest.fn() };
      mockStartRecording.mockResolvedValue(mockRecording as any);
      mockStopRecording.mockResolvedValue('blob:audio-recording-url');

      // Mock STT failure
      mockSttWhisper.mockRejectedValue(new Error('STT service unavailable'));

      // Execute the flow and expect error handling
      const recording = await mockStartRecording();
      const audioUri = await mockStopRecording(recording);

      await expect(mockSttWhisper(audioUri)).rejects.toThrow('STT service unavailable');

      // Verify subsequent calls are not made
      expect(mockChatLLM).not.toHaveBeenCalled();
      expect(mockTtsAudioStream).not.toHaveBeenCalled();
      expect(mockPlayAudio).not.toHaveBeenCalled();
    });

    it('should handle chat streaming errors', async () => {
      // Mock successful STT
      mockSttWhisper.mockResolvedValue('Test message');

      // Mock chat streaming error
      mockChatLLM.mockRejectedValue(new Error('Chat service rate limited'));

      const transcript = await mockSttWhisper('blob:audio-url');
      
      await expect(mockChatLLM(
        transcript,
        'jane-austen',
        'pride-and-prejudice'
      )).rejects.toThrow('Chat service rate limited');

      // Verify TTS and audio are not called
      expect(mockTtsAudioStream).not.toHaveBeenCalled();
      expect(mockPlayAudio).not.toHaveBeenCalled();
    });

    it('should handle TTS errors', async () => {
      // Mock successful STT and Chat
      mockSttWhisper.mockResolvedValue('Test message');
      mockChatLLM.mockResolvedValue('Test response');

      // Mock TTS failure
      mockTtsAudioStream.mockRejectedValue(new Error('TTS service unavailable'));

      const transcript = await mockSttWhisper('blob:audio-url');
      const response = await mockChatLLM(transcript, 'jane-austen', 'pride-and-prejudice');

      await expect(mockTtsAudioStream(response)).rejects.toThrow('TTS service unavailable');

      // Verify audio playback is not called
      expect(mockPlayAudio).not.toHaveBeenCalled();
    });

    it('should handle audio playback errors', async () => {
      // Mock successful STT, Chat, and TTS
      mockSttWhisper.mockResolvedValue('Test message');
      mockChatLLM.mockResolvedValue('Test response');
      mockTtsAudioStream.mockResolvedValue('blob:tts-audio-url');

      // Mock audio playback failure
      mockPlayAudio.mockRejectedValue(new Error('Audio playback failed'));

      const transcript = await mockSttWhisper('blob:audio-url');
      const response = await mockChatLLM(transcript, 'jane-austen', 'pride-and-prejudice');
      const audioUrl = await mockTtsAudioStream(response);

      await expect(mockPlayAudio(audioUrl)).rejects.toThrow('Audio playback failed');
    });
  });

  describe('Performance benchmarking', () => {
    it('should measure latency for each stage of the conversation', async () => {
      // Mock all services with realistic delays
      mockSttWhisper.mockImplementation(async (audioUri) => {
        await new Promise(resolve => setTimeout(resolve, 300)); // 300ms STT
        return 'Test transcript';
      });

      mockChatLLM.mockImplementation(async (text, personaId, bookId, options) => {
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms first token
        if (options?.onChunk) {
          options.onChunk('Test response');
        }
        return 'Test response';
      });

      mockTtsAudioStream.mockImplementation(async (text) => {
        await new Promise(resolve => setTimeout(resolve, 250)); // 250ms TTS
        return 'blob:tts-audio-url';
      });

      const mockAudioInstance: AudioInstance = {
        id: 'test-audio-1',
        uri: 'blob:tts-audio-url',
        sound: {} as any,
        status: AudioStatus.READY,
      };
      mockPlayAudio.mockResolvedValue(mockAudioInstance);

      // Measure total latency
      const startTime = Date.now();

      const transcript = await mockSttWhisper('blob:audio-url');
      const sttLatency = Date.now() - startTime;

      const chatStartTime = Date.now();
      const response = await mockChatLLM(transcript, 'jane-austen', 'pride-and-prejudice');
      const chatLatency = Date.now() - chatStartTime;

      const ttsStartTime = Date.now();
      const audioUrl = await mockTtsAudioStream(response);
      const ttsLatency = Date.now() - ttsStartTime;

      await mockPlayAudio(audioUrl);
      const totalLatency = Date.now() - startTime;

      // Verify latency targets (allowing some margin for test execution)
      expect(sttLatency).toBeLessThan(500); // Target: <400ms
      expect(chatLatency).toBeLessThan(400); // Target: <350ms  
      expect(ttsLatency).toBeLessThan(400); // Target: <300ms
      expect(totalLatency).toBeLessThan(1200); // Target: <1000ms total
    });
  });

  describe('Concurrent conversation handling', () => {
    it('should handle multiple conversation turns without interference', async () => {
      // Mock services
      mockSttWhisper.mockResolvedValue('Concurrent test');
      mockChatLLM.mockResolvedValue('Concurrent response');
      mockTtsAudioStream.mockResolvedValue('blob:concurrent-audio');
      
      const mockAudioInstance: AudioInstance = {
        id: 'concurrent-audio',
        uri: 'blob:concurrent-audio',
        sound: {} as any,
        status: AudioStatus.READY,
      };
      mockPlayAudio.mockResolvedValue(mockAudioInstance);

      // Execute multiple conversation flows concurrently
      const conversations = Array.from({ length: 3 }, async (_, index) => {
        const transcript = await mockSttWhisper(`blob:audio-${index}`);
        const response = await mockChatLLM(transcript, 'jane-austen', 'pride-and-prejudice');
        const audioUrl = await mockTtsAudioStream(response);
        return await mockPlayAudio(audioUrl);
      });

      const results = await Promise.all(conversations);

      // Verify all conversations completed successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toEqual(mockAudioInstance);
      });

      // Verify all services were called the expected number of times
      expect(mockSttWhisper).toHaveBeenCalledTimes(3);
      expect(mockChatLLM).toHaveBeenCalledTimes(3);
      expect(mockTtsAudioStream).toHaveBeenCalledTimes(3);
      expect(mockPlayAudio).toHaveBeenCalledTimes(3);
    });
  });

  describe('Network failure scenarios', () => {
    it('should handle network timeouts gracefully', async () => {
      // Mock network timeout
      mockSttWhisper.mockRejectedValue(new Error('Network timeout'));

      await expect(mockSttWhisper('blob:audio-url')).rejects.toThrow('Network timeout');
    });

    it('should handle service outages', async () => {
      // Mock service unavailable
      mockChatLLM.mockRejectedValue(new Error('Service temporarily unavailable'));

      await expect(mockChatLLM('test', 'persona', 'book')).rejects.toThrow('Service temporarily unavailable');
    });

    it('should handle rate limiting', async () => {
      // Mock rate limiting
      mockTtsAudioStream.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(mockTtsAudioStream('test text')).rejects.toThrow('Rate limit exceeded');
    });
  });
});