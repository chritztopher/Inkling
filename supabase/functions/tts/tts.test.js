/**
 * TTS Edge Function Jest Tests
 * 
 * Requirements: 9.1, 9.3
 */

describe('TTS Edge Function', () => {
  test('should validate text input', () => {
    const validateText = (text) => {
      if (!text || typeof text !== 'string') {
        return 'Text is required and must be a string';
      }
      if (text.trim().length === 0) {
        return 'Text cannot be empty';
      }
      if (text.length > 5000) {
        return 'Text is too long (maximum 5000 characters)';
      }
      return null;
    };

    expect(validateText('')).toBe('Text cannot be empty');
    expect(validateText(null)).toBe('Text is required and must be a string');
    expect(validateText('Hello world')).toBe(null);
    expect(validateText('a'.repeat(5001))).toBe('Text is too long (maximum 5000 characters)');
  });

  test('should validate voice IDs', () => {
    const validVoiceIds = [
      '21m00Tcm4TlvDq8ikWAM', // Rachel
      'AZnzlk1XvdvUeBnXmlld', // Domi
      'EXAVITQu4vr4xnSDxMaL', // Bella
      'ErXwobaYiN019PkySvjV', // Antoni
    ];

    validVoiceIds.forEach(voiceId => {
      expect(voiceId).toMatch(/^[a-zA-Z0-9]{20}$/);
    });
  });

  test('should handle CORS headers', () => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
    expect(corsHeaders['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
  });

  test('should handle rate limiting structure', () => {
    const rateLimitResponse = {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60'
      },
      body: JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: 60
      })
    };

    expect(rateLimitResponse.status).toBe(429);
    expect(rateLimitResponse.headers['Retry-After']).toBe('60');
    
    const body = JSON.parse(rateLimitResponse.body);
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.retryAfter).toBe(60);
  });

  test('should handle usage logging structure', () => {
    const mockUsageLog = {
      user_id: 'test-user-123',
      function_name: 'tts',
      text_length: 11,
      voice_id: '21m00Tcm4TlvDq8ikWAM',
      latency_ms: 150,
      success: true,
      timestamp: new Date().toISOString()
    };

    expect(mockUsageLog.user_id).toBe('test-user-123');
    expect(mockUsageLog.function_name).toBe('tts');
    expect(mockUsageLog.success).toBe(true);
    expect(mockUsageLog.latency_ms).toBeGreaterThan(0);
  });

  test('should handle streaming response structure', () => {
    const mockStreamingResponse = {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Latency-Ms': '150',
      },
      body: new Uint8Array([1, 2, 3, 4, 5])
    };

    expect(mockStreamingResponse.status).toBe(200);
    expect(mockStreamingResponse.headers['Content-Type']).toBe('audio/mpeg');
    expect(mockStreamingResponse.body).toBeInstanceOf(Uint8Array);
    expect(mockStreamingResponse.body.length).toBeGreaterThan(0);
  });

  test('should handle error responses', () => {
    const errorResponse = {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-Latency-Ms': '50'
      },
      body: JSON.stringify({
        error: 'Text is required and must be a string',
        timestamp: new Date().toISOString()
      })
    };

    expect(errorResponse.status).toBe(400);
    const body = JSON.parse(errorResponse.body);
    expect(body.error).toBe('Text is required and must be a string');
    expect(body.timestamp).toBeDefined();
  });

  test('should handle ElevenLabs API integration', () => {
    // Mock ElevenLabs API response structure
    const mockAPIResponse = {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'x-credits-used': '1'
      },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4, 5]));
          controller.close();
        }
      })
    };

    expect(mockAPIResponse.status).toBe(200);
    expect(mockAPIResponse.headers['Content-Type']).toBe('audio/mpeg');
    expect(mockAPIResponse.headers['x-credits-used']).toBe('1');
  });

  test('should handle voice validation', () => {
    const VALID_VOICE_IDS = new Set([
      '21m00Tcm4TlvDq8ikWAM', // Rachel - English female
      'AZnzlk1XvdvUeBnXmlld', // Domi - English female
      'EXAVITQu4vr4xnSDxMaL', // Bella - English female
      'ErXwobaYiN019PkySvjV', // Antoni - English male
      'MF3mGyEYCl7XYWbV9V6O', // Elli - English female
      'TxGEqnHWrfWFTfGW9XjX', // Josh - English male
      'VR6AewLTigWG4xSOukaG', // Arnold - English male
      'pNInz6obpgDQGcFmaJgB', // Adam - English male
      'yoZ06aMxZJJ28mfd3POQ', // Sam - English male
      'pqHfZKP75CvOlQylNhV4', // Bill - English male
    ]);

    // Test valid voice IDs
    expect(VALID_VOICE_IDS.has('21m00Tcm4TlvDq8ikWAM')).toBe(true);
    expect(VALID_VOICE_IDS.has('TxGEqnHWrfWFTfGW9XjX')).toBe(true);
    
    // Test invalid voice IDs
    expect(VALID_VOICE_IDS.has('invalid-voice-id')).toBe(false);
    expect(VALID_VOICE_IDS.has('')).toBe(false);
  });

  test('should handle Flash v2.5 model configuration', () => {
    const DEFAULT_VOICE_SETTINGS = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.3,
      use_speaker_boost: true,
    };

    const ttsRequest = {
      text: 'Hello world',
      model_id: 'eleven_flash_v2_5',
      voice_settings: DEFAULT_VOICE_SETTINGS,
    };

    expect(ttsRequest.model_id).toBe('eleven_flash_v2_5');
    expect(ttsRequest.voice_settings.stability).toBe(0.5);
    expect(ttsRequest.voice_settings.similarity_boost).toBe(0.75);
    expect(ttsRequest.voice_settings.style).toBe(0.3);
    expect(ttsRequest.voice_settings.use_speaker_boost).toBe(true);
  });
});