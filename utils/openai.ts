/**
 * OpenAI Service Wrapper
 * 
 * Provides typed interfaces for OpenAI Whisper and GPT-4o APIs with comprehensive
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
  assertDefined,
  assertNonEmptyString
} from './errors';

// OpenAI API Configuration
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Type definitions for OpenAI API

export interface WhisperTranscriptionRequest {
  file: File | Blob;
  model?: 'whisper-1';
  language?: string;
  prompt?: string;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

export interface WhisperTranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  stop?: string | string[];
  user?: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

export interface OpenAIServiceConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface StreamingOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * OpenAI Service Wrapper Class
 * 
 * Provides typed interfaces for OpenAI APIs with built-in error handling,
 * retry logic, and streaming support.
 */
export class OpenAIService {
  private readonly config: Required<OpenAIServiceConfig>;

  constructor(config: OpenAIServiceConfig) {
    assertNonEmptyString(config.apiKey, 'apiKey');
    
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || OPENAI_BASE_URL,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
    };
  }

  /**
   * Transcribe audio using OpenAI Whisper API
   * 
   * @param request - Whisper transcription request
   * @param signal - Optional AbortSignal for cancellation
   * @returns Promise resolving to transcription response
   */
  async transcribeAudio(
    request: WhisperTranscriptionRequest,
    signal?: AbortSignal
  ): Promise<WhisperTranscriptionResponse> {
    assertDefined(request.file, 'file');
    
    const context = {
      service: 'openai',
      operation: 'transcribe',
      model: request.model || 'whisper-1',
      responseFormat: request.response_format || 'json',
    };

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('file', request.file, 'audio.webm');
      formData.append('model', request.model || 'whisper-1');
      
      if (request.language) {
        formData.append('language', request.language);
      }
      
      if (request.prompt) {
        formData.append('prompt', request.prompt);
      }
      
      if (request.response_format) {
        formData.append('response_format', request.response_format);
      }
      
      if (request.temperature !== undefined) {
        formData.append('temperature', request.temperature.toString());
      }

      const response = await withRetry(
        async () => {
          const res = await fetch(`${this.config.baseUrl}/audio/transcriptions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: formData,
            signal: signal || null,
          });

          if (!res.ok) {
            await this.handleAPIError(res, 'transcription');
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
      
      // Handle different response formats
      if (request.response_format === 'text') {
        return { text: result };
      }
      
      return result as WhisperTranscriptionResponse;
      
    } catch (error) {
      logError(error, context);
      
      if (error instanceof APIError || error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new APIError(
        `Whisper transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '/audio/transcriptions',
        undefined,
        undefined,
        context,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate chat completion using GPT-4o
   * 
   * @param request - Chat completion request
   * @param signal - Optional AbortSignal for cancellation
   * @returns Promise resolving to chat completion response
   */
  async createChatCompletion(
    request: ChatCompletionRequest,
    signal?: AbortSignal
  ): Promise<ChatCompletionResponse> {
    assertDefined(request.messages, 'messages');
    assertNonEmptyString(request.model, 'model');
    
    if (request.messages.length === 0) {
      throw new ValidationError('Messages array cannot be empty', 'messages', request.messages);
    }

    const context = {
      service: 'openai',
      operation: 'chat_completion',
      model: request.model,
      messageCount: request.messages.length,
      stream: false,
    };

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...request,
              stream: false,
            }),
            signal: signal || null,
          });

          if (!res.ok) {
            await this.handleAPIError(res, 'chat completion');
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
      return result as ChatCompletionResponse;
      
    } catch (error) {
      logError(error, context);
      
      if (error instanceof APIError || error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new APIError(
        `Chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '/chat/completions',
        undefined,
        undefined,
        context,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Generate streaming chat completion using GPT-4o
   * 
   * @param request - Chat completion request
   * @param options - Streaming options with callbacks
   * @returns Promise resolving to complete response text
   */
  async createStreamingChatCompletion(
    request: ChatCompletionRequest,
    options: StreamingOptions = {}
  ): Promise<string> {
    assertDefined(request.messages, 'messages');
    assertNonEmptyString(request.model, 'model');
    
    if (request.messages.length === 0) {
      throw new ValidationError('Messages array cannot be empty', 'messages', request.messages);
    }

    const context = {
      service: 'openai',
      operation: 'streaming_chat_completion',
      model: request.model,
      messageCount: request.messages.length,
      stream: true,
    };

    let fullText = '';

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...request,
              stream: true,
            }),
            signal: options.signal || null,
          });

          if (!res.ok) {
            await this.handleAPIError(res, 'streaming chat completion');
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
          '/chat/completions',
          response.status,
          undefined,
          context
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                if (options.onComplete) {
                  options.onComplete(fullText);
                }
                return fullText;
              }
              
              try {
                const parsed = JSON.parse(data) as ChatCompletionStreamChunk;
                const content = parsed.choices[0]?.delta?.content;
                
                if (content) {
                  fullText += content;
                  if (options.onChunk) {
                    options.onChunk(content);
                  }
                }
              } catch (parseError) {
                // Skip invalid JSON chunks
                logError(parseError, { ...context, chunk: data });
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (options.onComplete) {
        options.onComplete(fullText);
      }
      
      return fullText;
      
    } catch (error) {
      logError(error, context);
      
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }
      
      if (error instanceof APIError || error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new APIError(
        `Streaming chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '/chat/completions',
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
      errorBody = { error: { message: response.statusText } };
    }

    const errorMessage = errorBody?.error?.message || `OpenAI API error ${response.status}`;
    const errorCode = errorBody?.error?.code;
    const errorType = errorBody?.error?.type;

    // Handle specific error types
    if (response.status === 401) {
      throw new AuthenticationError(
        'Invalid OpenAI API key. Please check your configuration.',
        'openai_api_key',
        { operation, errorCode, errorType }
      );
    }

    if (response.status === 429) {
      throw new APIError(
        'OpenAI API rate limit exceeded. Please wait and try again.',
        `/${operation}`,
        response.status,
        errorBody,
        { operation, errorCode, errorType }
      );
    }

    if (response.status === 413) {
      throw new ValidationError(
        'Request payload too large. Please reduce the size of your input.',
        'payload_size',
        undefined,
        { operation, errorCode, errorType }
      );
    }

    if (response.status >= 400 && response.status < 500) {
      throw new ValidationError(
        errorMessage,
        'request_validation',
        undefined,
        { operation, errorCode, errorType, statusCode: response.status }
      );
    }

    throw new APIError(
      errorMessage,
      `/${operation}`,
      response.status,
      errorBody,
      { operation, errorCode, errorType }
    );
  }
}

// Convenience functions for backward compatibility and ease of use

/**
 * Create a configured OpenAI service instance
 * 
 * @param apiKey - OpenAI API key
 * @param config - Optional additional configuration
 * @returns Configured OpenAI service instance
 */
export function createOpenAIService(
  apiKey: string,
  config: Partial<OpenAIServiceConfig> = {}
): OpenAIService {
  return new OpenAIService({
    apiKey,
    ...config,
  });
}

/**
 * Transcribe audio using OpenAI Whisper (convenience function)
 * 
 * @param apiKey - OpenAI API key
 * @param audioFile - Audio file to transcribe
 * @param options - Optional transcription options
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to transcribed text
 */
export async function transcribeAudio(
  apiKey: string,
  audioFile: File | Blob,
  options: Partial<WhisperTranscriptionRequest> = {},
  signal?: AbortSignal
): Promise<string> {
  const service = createOpenAIService(apiKey);
  const response = await service.transcribeAudio(
    {
      file: audioFile,
      response_format: 'json',
      ...options,
    },
    signal
  );
  
  return response.text;
}

/**
 * Generate streaming chat completion (convenience function)
 * 
 * @param apiKey - OpenAI API key
 * @param messages - Chat messages
 * @param options - Streaming options
 * @param model - GPT model to use
 * @returns Promise resolving to complete response text
 */
export async function streamChatCompletion(
  apiKey: string,
  messages: ChatMessage[],
  options: StreamingOptions & { model?: string } = {}
): Promise<string> {
  const service = createOpenAIService(apiKey);
  const { model = 'gpt-4o', ...streamingOptions } = options;
  
  return service.createStreamingChatCompletion(
    {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    },
    streamingOptions
  );
} 