/**
 * Mobile API Client Utilities Tests
 * 
 * Comprehensive unit tests for all API utility functions with offline capability
 * and deterministic mocking for reliable testing.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { jest } from '@jest/globals';
import { 
  sttWhisper, 
  chatLLM, 
  ttsAudioStream,
  ttsAudioStreamSimple,
  APIError,
  // NetworkError,
  ValidationError,
  AudioError
} from './api';

// Mock environment configuration
jest.mock('./env', () => ({
  getEnvironmentConfig: jest.fn(() => ({
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key'
  }))
}));

// Mock error utilities
jest.mock('./errors', () => {
  const originalModule = jest.requireActual('./errors');
  return {
    ...originalModule,
    logError: jest.fn(),
    createTimeoutController: jest.fn((timeout) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error(`Timeout after ${timeout}ms`)), timeout as number);
      return controller;
    }),
    withRetry: jest.fn(async (fn, config) => {
      // Simple retry implementation for testing
      let lastError;
      for (let attempt = 1; attempt <= (config?.maxAttempts || 1); attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          if (attempt >= (config?.maxAttempts || 1)) break;
          if (config?.onRetry) {
            config.onRetry(error, attempt, 100);
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      throw lastError;
    })
  };
});

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock FormData
global.FormData = jest.fn(() => ({
  append: jest.fn()
})) as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-audio-url');

// Helper to create mock ReadableStream
function createMockReadableStream(chunks: string[] | Uint8Array[]) {
  let index = 0;
  return new ReadableStream({
    start(controller) {
      const pump = () => {
        if (index < chunks.length) {
          controller.enqueue(chunks[index]);
          index++;
          setTimeout(pump, 10); // Simulate streaming delay
        } else {
          controller.close();
        }
      };
      pump();
    }
  });
}

describe('Mobile API Client Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('sttWhisper', () => {
    it('should successfully transcribe audio', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'Hello world' })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await sttWhisper('file://test-audio.webm');

      expect(result).toBe('Hello world');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-project.supabase.co/functions/v1/whisper',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(Object)
        })
      );
    });

    it('should handle API errors with proper error types', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Invalid audio format' }))
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(sttWhisper('file://invalid-audio.txt')).rejects.toThrow(APIError);
    });

    it('should validate input parameters', async () => {
      await expect(sttWhisper('')).rejects.toThrow(ValidationError);
      await expect(sttWhisper(null as any)).rejects.toThrow(ValidationError);
    });

    it('should handle timeout and cancellation', async () => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 100);

      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AbortError')), 200)
        )
      );

      await expect(sttWhisper('file://test-audio.webm', { 
        signal: controller.signal 
      })).rejects.toThrow(APIError);
    });

    it('should handle invalid response format', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ invalid: 'response' })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(sttWhisper('file://test-audio.webm')).rejects.toThrow(ValidationError);
    });

    it('should use custom timeout and retry options', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'Test transcript' })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await sttWhisper('file://test-audio.webm', {
        timeout: 5000,
        retries: 1
      });

      expect(result).toBe('Test transcript');
    });
  });

  describe('chatLLM', () => {
    it('should handle streaming chat responses', async () => {
      const streamChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" there"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const mockResponse = {
        ok: true,
        body: createMockReadableStream(streamChunks.map(chunk => new TextEncoder().encode(chunk)))
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const chunks: string[] = [];
      const result = await chatLLM(
        'Hello',
        'persona-1',
        'book-1',
        {
          onChunk: (chunk) => chunks.push(chunk)
        }
      );

      expect(result).toBe('Hello there!');
      expect(chunks).toEqual(['Hello', ' there', '!']);
    });

    it('should handle API errors during streaming', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Internal server error' }))
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const onError = jest.fn();
      await expect(chatLLM('Hello', 'persona-1', 'book-1', { onError }))
        .rejects.toThrow(APIError);
      
      expect(onError).toHaveBeenCalled();
    });

    it('should validate required parameters', async () => {
      await expect(chatLLM('', 'persona-1', 'book-1')).rejects.toThrow(ValidationError);
      await expect(chatLLM('Hello', '', 'book-1')).rejects.toThrow(ValidationError);
      await expect(chatLLM('Hello', 'persona-1', '')).rejects.toThrow(ValidationError);
    });

    it('should handle empty streaming response', async () => {
      const mockResponse = {
        ok: true,
        body: createMockReadableStream([new TextEncoder().encode('data: [DONE]\n\n')])
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(chatLLM('Hello', 'persona-1', 'book-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should handle malformed streaming chunks gracefully', async () => {
      const streamChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: invalid-json\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const mockResponse = {
        ok: true,
        body: createMockReadableStream(streamChunks.map(chunk => new TextEncoder().encode(chunk)))
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await chatLLM('Hello', 'persona-1', 'book-1');
      expect(result).toBe('Hello world');
    });

    it('should call completion callback when streaming finishes', async () => {
      const streamChunks = [
        'data: {"choices":[{"delta":{"content":"Complete"}}]}\n\n',
        'data: [DONE]\n\n'
      ];

      const mockResponse = {
        ok: true,
        body: createMockReadableStream(streamChunks.map(chunk => new TextEncoder().encode(chunk)))
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const onComplete = jest.fn();
      const result = await chatLLM('Hello', 'persona-1', 'book-1', { onComplete });

      expect(result).toBe('Complete');
      expect(onComplete).toHaveBeenCalledWith('Complete');
    });
  });

  describe('ttsAudioStream', () => {
    it('should successfully convert text to audio stream', async () => {
      const mockAudioData = new Uint8Array([1, 2, 3, 4, 5]);
      const mockResponse = {
        ok: true,
        headers: new Map([['Content-Length', '5']]),
        body: createMockReadableStream([mockAudioData])
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await ttsAudioStream('Hello world');

      expect(result).toBe('blob:mock-audio-url');
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });

    it('should handle progress callbacks during streaming', async () => {
      const mockAudioChunks = [
        new Uint8Array([1, 2]),
        new Uint8Array([3, 4]),
        new Uint8Array([5, 6])
      ];
      const mockResponse = {
        ok: true,
        headers: new Map([['Content-Length', '6']]),
        body: createMockReadableStream(mockAudioChunks)
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const progressUpdates: Array<{received: number, total?: number}> = [];
      const onProgress = jest.fn((received, total) => {
        progressUpdates.push({ received, total });
      });

      await ttsAudioStream('Hello world', '21m00Tcm4TlvDq8ikWAM', { onProgress });

      expect(progressUpdates).toEqual([
        { received: 2, total: 6 },
        { received: 4, total: 6 },
        { received: 6, total: 6 }
      ]);
    });

    it('should handle TTS API errors with rate limiting', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '60']]),
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Rate limit exceeded' }))
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(ttsAudioStream('Hello world')).rejects.toThrow(APIError);
    });

    it('should validate input parameters', async () => {
      await expect(ttsAudioStream('')).rejects.toThrow(ValidationError);
      await expect(ttsAudioStream('Hello', '')).rejects.toThrow(ValidationError);
    });

    it('should handle empty audio response', async () => {
      const mockResponse = {
        ok: true,
        headers: new Map(),
        body: createMockReadableStream([])
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(ttsAudioStream('Hello world')).rejects.toThrow(AudioError);
    });

    it('should handle completion callback', async () => {
      const mockAudioData = new Uint8Array([1, 2, 3]);
      const mockResponse = {
        ok: true,
        headers: new Map(),
        body: createMockReadableStream([mockAudioData])
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const onComplete = jest.fn();
      const result = await ttsAudioStream('Hello world', '21m00Tcm4TlvDq8ikWAM', { onComplete });

      expect(result).toBe('blob:mock-audio-url');
      expect(onComplete).toHaveBeenCalledWith('blob:mock-audio-url');
    });

    it('should handle error callback on failures', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal server error')
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const onError = jest.fn();
      await expect(ttsAudioStream('Hello world', '21m00Tcm4TlvDq8ikWAM', { onError }))
        .rejects.toThrow(APIError);
      
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('ttsAudioStreamSimple', () => {
    it('should be a convenience wrapper for ttsAudioStream', async () => {
      const mockAudioData = new Uint8Array([1, 2, 3]);
      const mockResponse = {
        ok: true,
        headers: new Map(),
        body: createMockReadableStream([mockAudioData])
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await ttsAudioStreamSimple('Hello world');
      expect(result).toBe('blob:mock-audio-url');
    });

    it('should use default voice ID', async () => {
      const mockAudioData = new Uint8Array([1, 2, 3]);
      const mockResponse = {
        ok: true,
        headers: new Map(),
        body: createMockReadableStream([mockAudioData])
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      await ttsAudioStreamSimple('Hello world');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-project.supabase.co/functions/v1/tts',
        expect.objectContaining({
          body: JSON.stringify({ text: 'Hello world', voiceId: '21m00Tcm4TlvDq8ikWAM' })
        })
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should properly classify different error types', async () => {
      // Network error
      mockFetch.mockRejectedValue(new Error('Network error'));
      await expect(sttWhisper('file://test.webm')).rejects.toThrow(APIError);

      // Validation error
      await expect(sttWhisper('')).rejects.toThrow(ValidationError);

      // API error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad request')
      } as any);
      await expect(sttWhisper('file://test.webm')).rejects.toThrow(APIError);
    });

    it('should handle AbortController cancellation', async () => {
      const controller = new AbortController();
      
      mockFetch.mockImplementation(() => {
        controller.abort();
        return Promise.reject(new DOMException('AbortError', 'AbortError'));
      });

      await expect(sttWhisper('file://test.webm', { signal: controller.signal }))
        .rejects.toThrow(APIError);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent requests', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'Concurrent test' })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const promises = Array.from({ length: 5 }, (_, i) => 
        sttWhisper(`file://test-${i}.webm`)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(result => expect(result).toBe('Concurrent test'));
    });

    it('should handle large text inputs for TTS', async () => {
      const largeText = 'A'.repeat(4000); // Large but under 5000 char limit
      const mockAudioData = new Uint8Array([1, 2, 3]);
      const mockResponse = {
        ok: true,
        headers: new Map(),
        body: createMockReadableStream([mockAudioData])
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await ttsAudioStream(largeText);
      expect(result).toBe('blob:mock-audio-url');
    });

    it('should handle network timeouts gracefully', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(sttWhisper('file://test.webm', { timeout: 50 }))
        .rejects.toThrow(APIError);
    });
  });

  describe('Offline Testing Capability', () => {
    it('should work without network access using mocks', async () => {
      // All tests use mocks and don't require actual network access
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'Offline test' })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await sttWhisper('file://offline-test.webm');
      expect(result).toBe('Offline test');
      
      // Verify no actual network calls were made
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('test-project.supabase.co'),
        expect.any(Object)
      );
    });

    it('should provide deterministic responses for testing', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ text: 'Deterministic response' })
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      // Multiple calls should return the same result
      const result1 = await sttWhisper('file://test1.webm');
      const result2 = await sttWhisper('file://test2.webm');
      
      expect(result1).toBe(result2);
      expect(result1).toBe('Deterministic response');
    });
  });
});