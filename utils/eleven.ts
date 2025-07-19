/**
 * ElevenLabs Service Wrapper
 * 
 * Provides typed interfaces for ElevenLabs TTS streaming API with comprehensive
 * error handling, retry logic, and AbortController support.
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5
 */

import { 
  APIError, 
  AuthenticationError, 
  ValidationError,
  withRetry, 
  DEFAULT_RETRY_CONFIGS,
  logError,
  // assertDefined,
  assertNonEmptyString
} from './errors';

// ElevenLabs API Configuration
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Type definitions for ElevenLabs API

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface TTSRequest {
  text: string;
  model_id?: string;
  voice_settings?: VoiceSettings;
  pronunciation_dictionary_locators?: Array<{
    pronunciation_dictionary_id: string;
    version_id: string;
  }>;
  seed?: number;
  previous_text?: string;
  next_text?: string;
  previous_request_ids?: string[];
  next_request_ids?: string[];
}

export interface Voice {
  voice_id: string;
  name: string;
  samples?: Array<{
    sample_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    hash: string;
  }>;
  category: string;
  fine_tuning: {
    model_id?: string;
    is_allowed_to_fine_tune: boolean;
    finetuning_state: string;
    verification_failures: string[];
    verification_attempts_count: number;
    manual_verification_requested: boolean;
    language?: string;
    progress?: Record<string, any>;
    message?: Record<string, any>;
    dataset_duration_seconds?: number;
    verification_attempts?: Array<any>;
  };
  labels: Record<string, string>;
  description?: string;
  preview_url?: string;
  available_for_tiers: string[];
  settings?: VoiceSettings;
  sharing?: {
    status: string;
    history_item_sample_id?: string;
    original_voice_id?: string;
    public_owner_id?: string;
    liked_by_count: number;
    cloned_by_count: number;
    name?: string;
    description?: string;
    labels?: Record<string, string>;
    review_status?: string;
    review_message?: string;
    enabled_in_library: boolean;
  };
  high_quality_base_model_ids: string[];
  safety_control?: string;
  voice_verification?: {
    requires_verification: boolean;
    is_verified: boolean;
    verification_failures: string[];
    verification_attempts_count: number;
    language?: string;
    verification_attempts?: Array<any>;
  };
  permission_on_resource?: string;
}

export interface VoicesResponse {
  voices: Voice[];
}

export interface UserInfo {
  subscription: {
    tier: string;
    character_count: number;
    character_limit: number;
    can_extend_character_limit: boolean;
    allowed_to_extend_character_limit: boolean;
    next_character_count_reset_unix: number;
    voice_limit: number;
    max_voice_add_edits: number;
    voice_add_edit_counter: number;
    professional_voice_limit: number;
    can_extend_voice_limit: boolean;
    can_use_instant_voice_cloning: boolean;
    can_use_professional_voice_cloning: boolean;
    currency: string;
    status: string;
  };
  is_new_user: boolean;
  xi_api_key: string;
  can_use_delayed_payment_methods: boolean;
}

export interface ElevenLabsServiceConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface StreamingTTSOptions {
  onChunk?: (chunk: Uint8Array) => void;
  onComplete?: (audioBlob: Blob) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * ElevenLabs Service Wrapper Class
 * 
 * Provides typed interfaces for ElevenLabs APIs with built-in error handling,
 * retry logic, and streaming support.
 */
export class ElevenLabsService {
  private readonly config: Required<ElevenLabsServiceConfig>;

  constructor(config: ElevenLabsServiceConfig) {
    assertNonEmptyString(config.apiKey, 'apiKey');
    
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || ELEVENLABS_BASE_URL,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
    };
  }

  /**
   * Convert text to speech using ElevenLabs streaming API
   * 
   * @param voiceId - Voice ID to use for synthesis
   * @param request - TTS request parameters
   * @param signal - Optional AbortSignal for cancellation
   * @returns Promise resolving to audio blob
   */
  async synthesizeSpeech(
    voiceId: string,
    request: TTSRequest,
    signal?: AbortSignal
  ): Promise<Blob> {
    assertNonEmptyString(voiceId, 'voiceId');
    assertNonEmptyString(request.text, 'text');
    
    const context = {
      service: 'elevenlabs',
      operation: 'text_to_speech',
      voiceId,
      model: request.model_id || 'eleven_multilingual_v2',
      textLength: request.text.length,
    };

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(`${this.config.baseUrl}/text-to-speech/${voiceId}/stream`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'xi-api-key': this.config.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model_id: 'eleven_multilingual_v2',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.3,
                use_speaker_boost: true,
              },
              ...request,
            }),
            signal: signal || null,
          });

          if (!res.ok) {
            await this.handleAPIError(res, 'text-to-speech');
          }

          return res;
        },
        {
          ...DEFAULT_RETRY_CONFIGS.API,
          maxAttempts: this.config.maxRetries,
          onRetry: (error, attempt, delayMs) => {
            logError(error, { ...context, attempt, delayMs });
          },
        }
      );

      // Log credits used if available
      const creditsUsed = response.headers.get('x-credits-used');
      if (creditsUsed) {
        console.info('ElevenLabs credits used:', creditsUsed);
      }

      const audioBlob = await response.blob();
      return audioBlob;
      
    } catch (error) {
      logError(error, context);
      
      if (error instanceof APIError || error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new APIError(
        `Text-to-speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '/text-to-speech',
        undefined,
        undefined,
        context,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Convert text to speech with streaming support
   * 
   * @param voiceId - Voice ID to use for synthesis
   * @param request - TTS request parameters
   * @param options - Streaming options with callbacks
   * @returns Promise resolving to complete audio blob
   */
  async synthesizeSpeechStreaming(
    voiceId: string,
    request: TTSRequest,
    options: StreamingTTSOptions = {}
  ): Promise<Blob> {
    assertNonEmptyString(voiceId, 'voiceId');
    assertNonEmptyString(request.text, 'text');
    
    const context = {
      service: 'elevenlabs',
      operation: 'streaming_text_to_speech',
      voiceId,
      model: request.model_id || 'eleven_multilingual_v2',
      textLength: request.text.length,
    };

    const audioChunks: Uint8Array[] = [];

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(`${this.config.baseUrl}/text-to-speech/${voiceId}/stream`, {
            method: 'POST',
            headers: {
              'Accept': 'audio/mpeg',
              'xi-api-key': this.config.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model_id: 'eleven_multilingual_v2',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.3,
                use_speaker_boost: true,
              },
              ...request,
            }),
            signal: options.signal || null,
          });

          if (!res.ok) {
            await this.handleAPIError(res, 'streaming text-to-speech');
          }

          return res;
        },
        {
          ...DEFAULT_RETRY_CONFIGS.API,
          maxAttempts: this.config.maxRetries,
          onRetry: (error, attempt, delayMs) => {
            logError(error, { ...context, attempt, delayMs });
          },
        }
      );

      if (!response.body) {
        throw new APIError(
          'No response body received for streaming request',
          '/text-to-speech',
          response.status,
          undefined,
          context
        );
      }

      // Log credits used if available
      const creditsUsed = response.headers.get('x-credits-used');
      if (creditsUsed) {
        console.info('ElevenLabs credits used:', creditsUsed);
      }

      const reader = response.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          audioChunks.push(value);
          
          if (options.onChunk) {
            options.onChunk(value);
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Combine all chunks into a single blob
      const audioBlob = new Blob(audioChunks, { type: 'audio/mpeg' });
      
      if (options.onComplete) {
        options.onComplete(audioBlob);
      }
      
      return audioBlob;
      
    } catch (error) {
      logError(error, context);
      
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }
      
      if (error instanceof APIError || error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new APIError(
        `Streaming text-to-speech synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '/text-to-speech',
        undefined,
        undefined,
        context,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get available voices from ElevenLabs
   * 
   * @param signal - Optional AbortSignal for cancellation
   * @returns Promise resolving to voices response
   */
  async getVoices(signal?: AbortSignal): Promise<VoicesResponse> {
    const context = {
      service: 'elevenlabs',
      operation: 'get_voices',
    };

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(`${this.config.baseUrl}/voices`, {
            method: 'GET',
            headers: {
              'xi-api-key': this.config.apiKey,
            },
            signal: signal || null,
          });

          if (!res.ok) {
            await this.handleAPIError(res, 'get voices');
          }

          return res;
        },
        {
          ...DEFAULT_RETRY_CONFIGS.API,
          maxAttempts: this.config.maxRetries,
          onRetry: (error, attempt, delayMs) => {
            logError(error, { ...context, attempt, delayMs });
          },
        }
      );

      const result = await response.json();
      return result as VoicesResponse;
      
    } catch (error) {
      logError(error, context);
      
      if (error instanceof APIError || error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new APIError(
        `Get voices failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '/voices',
        undefined,
        undefined,
        context,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get user information including subscription details
   * 
   * @param signal - Optional AbortSignal for cancellation
   * @returns Promise resolving to user info
   */
  async getUserInfo(signal?: AbortSignal): Promise<UserInfo> {
    const context = {
      service: 'elevenlabs',
      operation: 'get_user_info',
    };

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(`${this.config.baseUrl}/user`, {
            method: 'GET',
            headers: {
              'xi-api-key': this.config.apiKey,
            },
            signal: signal || null,
          });

          if (!res.ok) {
            await this.handleAPIError(res, 'get user info');
          }

          return res;
        },
        {
          ...DEFAULT_RETRY_CONFIGS.API,
          maxAttempts: this.config.maxRetries,
          onRetry: (error, attempt, delayMs) => {
            logError(error, { ...context, attempt, delayMs });
          },
        }
      );

      const result = await response.json();
      return result as UserInfo;
      
    } catch (error) {
      logError(error, context);
      
      if (error instanceof APIError || error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new APIError(
        `Get user info failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '/user',
        undefined,
        undefined,
        context,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Handle API errors and convert to appropriate error types
   */
  private async handleAPIError(response: Response, operation: string): Promise<never> {
    let errorBody: any;
    
    try {
      errorBody = await response.json();
    } catch {
      errorBody = { detail: { message: response.statusText } };
    }

    const errorMessage = errorBody?.detail?.message || 
                        errorBody?.message || 
                        `ElevenLabs API error ${response.status}`;

    // Handle specific error types
    if (response.status === 401) {
      throw new AuthenticationError(
        'Invalid ElevenLabs API key. Please check your configuration.',
        'elevenlabs_api_key',
        { operation, errorBody }
      );
    }

    if (response.status === 429) {
      throw new APIError(
        'ElevenLabs API rate limit exceeded. Please wait and try again.',
        `/${operation}`,
        response.status,
        errorBody,
        { operation }
      );
    }

    if (response.status === 413) {
      throw new ValidationError(
        'Request payload too large. Please reduce the size of your input text.',
        'payload_size',
        undefined,
        { operation }
      );
    }

    if (response.status === 422) {
      throw new ValidationError(
        errorMessage,
        'request_validation',
        undefined,
        { operation, statusCode: response.status }
      );
    }

    if (response.status >= 400 && response.status < 500) {
      throw new ValidationError(
        errorMessage,
        'request_validation',
        undefined,
        { operation, statusCode: response.status }
      );
    }

    throw new APIError(
      errorMessage,
      `/${operation}`,
      response.status,
      errorBody,
      { operation }
    );
  }
}

// Convenience functions for backward compatibility and ease of use

/**
 * Create a configured ElevenLabs service instance
 * 
 * @param apiKey - ElevenLabs API key
 * @param config - Optional additional configuration
 * @returns Configured ElevenLabs service instance
 */
export function createElevenLabsService(
  apiKey: string,
  config: Partial<ElevenLabsServiceConfig> = {}
): ElevenLabsService {
  return new ElevenLabsService({
    apiKey,
    ...config,
  });
}

/**
 * Convert text to speech using ElevenLabs (convenience function)
 * 
 * @param apiKey - ElevenLabs API key
 * @param text - Text to convert to speech
 * @param voiceId - Voice ID to use
 * @param options - Optional TTS options
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to audio blob URL
 */
export async function synthesizeSpeech(
  apiKey: string,
  text: string,
  voiceId: string = '21m00Tcm4TlvDq8ikWAM', // Default English female voice
  options: Partial<TTSRequest> = {},
  signal?: AbortSignal
): Promise<string> {
  const service = createElevenLabsService(apiKey);
  const audioBlob = await service.synthesizeSpeech(
    voiceId,
    {
      text,
      model_id: 'eleven_multilingual_v2',
      ...options,
    },
    signal
  );
  
  return URL.createObjectURL(audioBlob);
}

/**
 * Convert text to speech with streaming support (convenience function)
 * 
 * @param apiKey - ElevenLabs API key
 * @param text - Text to convert to speech
 * @param voiceId - Voice ID to use
 * @param options - Streaming options
 * @returns Promise resolving to audio blob URL
 */
export async function synthesizeSpeechStreaming(
  apiKey: string,
  text: string,
  voiceId: string = '21m00Tcm4TlvDq8ikWAM',
  options: StreamingTTSOptions & { ttsOptions?: Partial<TTSRequest> } = {}
): Promise<string> {
  const service = createElevenLabsService(apiKey);
  const { ttsOptions = {}, ...streamingOptions } = options;
  
  const audioBlob = await service.synthesizeSpeechStreaming(
    voiceId,
    {
      text,
      model_id: 'eleven_multilingual_v2',
      ...ttsOptions,
    },
    streamingOptions
  );
  
  return URL.createObjectURL(audioBlob);
}

/**
 * Get available voices (convenience function)
 * 
 * @param apiKey - ElevenLabs API key
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to available voices
 */
export async function getVoices(
  apiKey: string,
  signal?: AbortSignal
): Promise<Voice[]> {
  const service = createElevenLabsService(apiKey);
  const response = await service.getVoices(signal);
  return response.voices;
} 