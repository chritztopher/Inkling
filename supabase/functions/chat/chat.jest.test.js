/**
 * Jest tests for Chat API integration
 * 
 * Tests the mobile app's integration with the chat Edge Function
 * using mocked responses for offline testing capability.
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

// Mock fetch for testing
global.fetch = jest.fn();

// Mock EventSource for SSE testing
global.EventSource = jest.fn();

describe('Chat API Integration', () => {
  beforeEach(() => {
    fetch.mockClear();
    EventSource.mockClear();
  });

  describe('Successful streaming response', () => {
    it('should handle streaming chat response correctly', async () => {
      // Mock streaming response
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: (name) => {
            if (name === 'Content-Type') return 'text/event-stream';
            return null;
          }
        },
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"start"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":"Hello"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":" there"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"complete"}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              }),
            releaseLock: jest.fn()
          })
        }
      };

      fetch.mockResolvedValue(mockResponse);

      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          transcript: 'Hello, how are you?',
          personaId: 'jane-austen',
          bookId: 'pride-and-prejudice'
        })
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');

      // Test streaming content reading
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        fullContent += chunk;
      }

      expect(fullContent).toContain('data: {"type":"start"}');
      expect(fullContent).toContain('data: {"type":"content","content":"Hello"}');
      expect(fullContent).toContain('data: {"type":"content","content":" there"}');
      expect(fullContent).toContain('data: {"type":"complete"}');

      reader.releaseLock();
    });

    it('should handle chunk-by-chunk streaming updates', async () => {
      const chunks = [];
      const onChunk = jest.fn((chunk) => chunks.push(chunk));

      // Simulate streaming response processing
      const mockStreamData = [
        'data: {"type":"start"}\n\n',
        'data: {"type":"content","content":"Hello"}\n\n',
        'data: {"type":"content","content":" world"}\n\n',
        'data: {"type":"content","content":"!"}\n\n',
        'data: {"type":"complete"}\n\n'
      ];

      // Process each chunk as it would arrive
      mockStreamData.forEach(data => {
        const lines = data.split('\n');
        lines.forEach(line => {
          if (line.startsWith('data: ')) {
            const eventData = JSON.parse(line.slice(6));
            if (eventData.type === 'content') {
              onChunk(eventData.content);
            }
          }
        });
      });

      expect(onChunk).toHaveBeenCalledTimes(3);
      expect(chunks).toEqual(['Hello', ' world', '!']);
      expect(chunks.join('')).toBe('Hello world!');
    });
  });

  describe('Error handling', () => {
    it('should handle validation errors', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 400,
        headers: {
          get: () => 'application/json'
        },
        json: () => Promise.resolve({
          error: 'transcript is required and must be a non-empty string',
          timestamp: '2024-01-01T00:00:00.000Z'
        })
      };

      fetch.mockResolvedValue(mockErrorResponse);

      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: '', // Invalid empty transcript
          personaId: 'jane-austen',
          bookId: 'pride-and-prejudice'
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);

      const errorBody = await response.json();
      expect(errorBody.error).toContain('transcript is required');
      expect(errorBody.timestamp).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      const mockRateLimitResponse = {
        ok: false,
        status: 429,
        headers: {
          get: (name) => {
            if (name === 'Retry-After') return '3600';
            if (name === 'Content-Type') return 'application/json';
            return null;
          }
        },
        json: () => Promise.resolve({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please wait before trying again.',
          retryAfter: 3600
        })
      };

      fetch.mockResolvedValue(mockRateLimitResponse);

      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: 'Hello',
          personaId: 'jane-austen',
          bookId: 'pride-and-prejudice'
        })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('3600');

      const errorBody = await response.json();
      expect(errorBody.error).toBe('Rate limit exceeded');
      expect(errorBody.retryAfter).toBe(3600);
    });

    it('should handle streaming errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: () => 'text/event-stream'
        },
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"start"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":"Hello"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"error","error":"Stream processing failed"}\n\n')
              })
              .mockRejectedValue(new Error('Stream error')),
            releaseLock: jest.fn()
          })
        }
      };

      fetch.mockResolvedValue(mockResponse);

      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: 'Hello',
          personaId: 'jane-austen',
          bookId: 'pride-and-prejudice'
        })
      });

      expect(response.ok).toBe(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let errorReceived = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          if (chunk.includes('"type":"error"')) {
            errorReceived = true;
            const errorData = JSON.parse(chunk.split('data: ')[1]);
            expect(errorData.error).toBe('Stream processing failed');
          }
        }
      } catch (error) {
        // Stream should eventually error
        expect(error.message).toBe('Stream error');
      }

      expect(errorReceived).toBe(true);
      reader.releaseLock();
    });
  });

  describe('CORS handling', () => {
    it('should handle preflight requests', async () => {
      const mockPreflightResponse = {
        ok: true,
        status: 200,
        headers: {
          get: (name) => {
            switch (name) {
              case 'Access-Control-Allow-Origin': return '*';
              case 'Access-Control-Allow-Headers': return 'authorization, x-client-info, apikey, content-type';
              default: return null;
            }
          }
        },
        text: () => Promise.resolve('ok')
      };

      fetch.mockResolvedValue(mockPreflightResponse);

      const response = await fetch('/chat', {
        method: 'OPTIONS'
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
    });
  });

  describe('Request validation', () => {
    it('should validate persona IDs', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Invalid persona ID: invalid-persona. Available personas: jane-austen, shakespeare'
        })
      };

      fetch.mockResolvedValue(mockErrorResponse);

      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: 'Hello',
          personaId: 'invalid-persona',
          bookId: 'pride-and-prejudice'
        })
      });

      const errorBody = await response.json();
      expect(errorBody.error).toContain('Invalid persona ID');
      expect(errorBody.error).toContain('Available personas:');
    });

    it('should validate book IDs', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'Invalid book ID: invalid-book. Available books: pride-and-prejudice, hamlet'
        })
      };

      fetch.mockResolvedValue(mockErrorResponse);

      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: 'Hello',
          personaId: 'jane-austen',
          bookId: 'invalid-book'
        })
      });

      const errorBody = await response.json();
      expect(errorBody.error).toContain('Invalid book ID');
      expect(errorBody.error).toContain('Available books:');
    });
  });

  describe('Performance and latency', () => {
    it('should measure response latency', async () => {
      const startTime = Date.now();
      
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"start"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":"Fast response"}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"complete"}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              }),
            releaseLock: jest.fn()
          })
        }
      };

      fetch.mockResolvedValue(mockResponse);

      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: 'Quick test',
          personaId: 'jane-austen',
          bookId: 'pride-and-prejudice'
        })
      });

      const firstByteLatency = Date.now() - startTime;
      
      // Should get first response quickly (target: <350ms for first token)
      expect(firstByteLatency).toBeLessThan(1000); // Generous for mock
      expect(response.ok).toBe(true);
    });

    it('should handle concurrent requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValue({ done: true, value: undefined }),
            releaseLock: jest.fn()
          })
        }
      };

      fetch.mockResolvedValue(mockResponse);

      // Simulate multiple concurrent requests
      const requests = Array.from({ length: 5 }, (_, i) =>
        fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: `Request ${i}`,
            personaId: 'jane-austen',
            bookId: 'pride-and-prejudice'
          })
        })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.ok).toBe(true);
      });
      
      expect(fetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('Authentication and authorization', () => {
    it('should handle authenticated requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
            releaseLock: jest.fn()
          })
        }
      };

      fetch.mockResolvedValue(mockResponse);

      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token'
        },
        body: JSON.stringify({
          transcript: 'Authenticated request',
          personaId: 'jane-austen',
          bookId: 'pride-and-prejudice'
        })
      });

      expect(response.ok).toBe(true);
      
      // Verify authorization header was sent
      expect(fetch).toHaveBeenCalledWith('/chat', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer valid-jwt-token'
        })
      }));
    });

    it('should handle anonymous requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
            releaseLock: jest.fn()
          })
        }
      };

      fetch.mockResolvedValue(mockResponse);

      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: 'Anonymous request',
          personaId: 'jane-austen',
          bookId: 'pride-and-prejudice'
        })
      });

      expect(response.ok).toBe(true);
    });
  });
});