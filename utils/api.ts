/**
 * Mobile API Client Utilities
 * 
 * Provides typed interfaces for all Edge Function communication with comprehensive
 * error handling, retry logic, and AbortController support.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.1, 7.4
 */

import { 
  APIError, 
  ValidationError,
  AudioError,
  withRetry, 
  DEFAULT_RETRY_CONFIGS,
  createTimeoutController,
  logError,
  assertNonEmptyString
} from './errors';
import { getEnvironmentConfig } from './env';

// Cached environment configuration for performance
let cachedEnv: ReturnType<typeof getEnvironmentConfig> | null = null;
let cachedEdgeUrl: string | null = null;

function getEdgeUrl(): string {
  if (!cachedEdgeUrl) {
    cachedEnv = getEnvironmentConfig();
    cachedEdgeUrl = `${cachedEnv.SUPABASE_URL}/functions/v1`;
  }
  return cachedEdgeUrl;
}

// API response types
export interface WhisperResponse {
  text: string;
}

export interface ChatStreamOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export interface APIOptions {
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

/**
 * Speech-to-Text conversion using OpenAI Whisper
 * 
 * @param fileUri - URI of the audio file to transcribe
 * @param options - Optional configuration for timeout, retries, and cancellation
 * @returns Promise resolving to transcribed text
 */
export async function sttWhisper(
  fileUri: string, 
  options: APIOptions = {}
): Promise<string> {
  assertNonEmptyString(fileUri, 'fileUri');
  
  const { timeout = 30000, retries = 3, signal } = options;
  
  const context = {
    operation: 'stt_whisper',
    fileUri,
    timeout,
    retries
  };

  try {
    return await withRetry(
      async () => {
        // Create timeout controller if no signal provided
        const controller = signal ? undefined : createTimeoutController(timeout);
        const requestSignal = signal || controller?.signal;

        // Prepare form data
        const form = new FormData();
        form.append('file', {
          uri: fileUri,
          name: 'audio.webm',
          type: 'audio/webm',
        } as any);

        const response = await fetch(`${getEdgeUrl()}/whisper`, {
          method: 'POST',
          body: form,
          signal: requestSignal || null,
        });

        if (!response.ok) {
          let errorMessage = `Whisper API error: ${response.status}`;
          
          try {
            const errorBody = await response.text();
            const errorJson = JSON.parse(errorBody);
            errorMessage = errorJson.error || errorMessage;
          } catch {
            // Use default error message if parsing fails
          }

          throw new APIError(
            errorMessage,
            '/whisper',
            response.status,
            undefined,
            context
          );
        }

        const result: WhisperResponse = await response.json();
        
        if (!result.text || typeof result.text !== 'string') {
          throw new ValidationError(
            'Invalid response format from Whisper API',
            'text',
            result.text,
            context
          );
        }

        return result.text;
      },
      {
        ...DEFAULT_RETRY_CONFIGS.API,
        maxAttempts: retries,
        onRetry: (error, attempt, delayMs) => {
          logError(error, { ...context, attempt, delayMs });
        },
      }
    );
  } catch (error) {
    logError(error, context);
    
    if (error instanceof APIError || error instanceof ValidationError) {
      throw error;
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError(
        'Speech-to-text request was cancelled',
        '/whisper',
        undefined,
        undefined,
        context,
        error
      );
    }
    
    throw new APIError(
      `Speech-to-text failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      '/whisper',
      undefined,
      undefined,
      context,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Streaming chat generation with persona and book context
 * 
 * @param transcript - User's transcribed speech
 * @param personaId - ID of the AI persona to use
 * @param bookId - ID of the book for context
 * @param options - Streaming options with callbacks and cancellation
 * @returns Promise resolving to complete response text
 */
export async function chatLLM(
  transcript: string,
  personaId: string,
  bookId: string,
  options: ChatStreamOptions = {}
): Promise<string> {
  assertNonEmptyString(transcript, 'transcript');
  assertNonEmptyString(personaId, 'personaId');
  assertNonEmptyString(bookId, 'bookId');
  
  const { onChunk, onComplete, onError, signal } = options;
  const timeout = 45000; // Longer timeout for streaming responses
  
  const context = {
    operation: 'chat_llm',
    transcript: transcript.substring(0, 100) + '...', // Truncate for logging
    personaId,
    bookId,
    timeout
  };

  try {
    return await withRetry(
      async () => {
        // Create timeout controller if no signal provided
        const controller = signal ? undefined : createTimeoutController(timeout);
        const requestSignal = signal || controller?.signal;

        const response = await fetch(`${getEdgeUrl()}/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          body: JSON.stringify({ transcript, personaId, bookId }),
          signal: requestSignal || null,
        });

        if (!response.ok) {
          let errorMessage = `Chat API error: ${response.status}`;
          
          try {
            const errorBody = await response.text();
            const errorJson = JSON.parse(errorBody);
            errorMessage = errorJson.error || errorMessage;
          } catch {
            // Use default error message if parsing fails
          }

          throw new APIError(
            errorMessage,
            '/chat',
            response.status,
            undefined,
            context
          );
        }

        if (!response.body) {
          throw new APIError(
            'No response body received for streaming request',
            '/chat',
            response.status,
            undefined,
            context
          );
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        try {
          while (true) {
            const { value, done } = await reader.read();
            
            if (done) break;
            
            // Decode chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete lines (Server-Sent Events format)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6); // Remove 'data: ' prefix
                
                if (data === '[DONE]') {
                  // End of stream marker
                  break;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || '';
                  
                  if (content) {
                    fullText += content;
                    
                    // Call chunk callback if provided
                    if (onChunk) {
                      onChunk(content);
                    }
                  }
                } catch (parseError) {
                  // Skip malformed JSON chunks
                  console.warn('Failed to parse streaming chunk:', data);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        const trimmedText = fullText.trim();
        
        if (!trimmedText) {
          throw new ValidationError(
            'Empty response received from chat API',
            'response',
            trimmedText,
            context
          );
        }

        // Call completion callback if provided
        if (onComplete) {
          onComplete(trimmedText);
        }

        return trimmedText;
      },
      {
        ...DEFAULT_RETRY_CONFIGS.API,
        maxAttempts: 2, // Fewer retries for streaming to avoid long delays
        onRetry: (error, attempt, delayMs) => {
          logError(error, { ...context, attempt, delayMs });
        },
      }
    );
  } catch (error) {
    logError(error, context);
    
    // Call error callback if provided
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
    
    if (error instanceof APIError || error instanceof ValidationError) {
      throw error;
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError(
        'Chat request was cancelled',
        '/chat',
        undefined,
        undefined,
        context,
        error
      );
    }
    
    throw new APIError(
      `Chat generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      '/chat',
      undefined,
      undefined,
      context,
      error instanceof Error ? error : undefined
    );
  }
}

export interface TTSStreamOptions {
  onProgress?: (bytesReceived: number, totalBytes?: number) => void;
  onComplete?: (audioUrl: string) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * Text-to-Speech conversion with streaming audio response
 * 
 * @param text - Text to convert to speech
 * @param voiceId - ElevenLabs voice ID to use (defaults to Rachel)
 * @param options - Streaming options with callbacks and cancellation
 * @returns Promise resolving to blob URL for audio playback
 */
export async function ttsAudioStream(
  text: string,
  voiceId = '21m00Tcm4TlvDq8ikWAM',
  options: TTSStreamOptions = {}
): Promise<string> {
  assertNonEmptyString(text, 'text');
  assertNonEmptyString(voiceId, 'voiceId');
  
  const { onProgress, onComplete, onError, signal } = options;
  const timeout = 30000; // 30 second timeout for TTS
  
  const context = {
    operation: 'tts_audio_stream',
    text: text.substring(0, 100) + '...', // Truncate for logging
    voiceId,
    timeout,
    textLength: text.length
  };

  try {
    return await withRetry(
      async () => {
        // Create timeout controller if no signal provided
        const controller = signal ? undefined : createTimeoutController(timeout);
        const requestSignal = signal || controller?.signal;

        const response = await fetch(`${getEdgeUrl()}/tts`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({ text, voiceId }),
          signal: requestSignal || null,
        });

        if (!response.ok) {
          let errorMessage = `TTS API error: ${response.status}`;
          
          try {
            const errorBody = await response.text();
            const errorJson = JSON.parse(errorBody);
            errorMessage = errorJson.error || errorMessage;
          } catch {
            // Use default error message if parsing fails
          }

          // Handle specific TTS error cases
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            errorMessage = `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : ''}`;
          }

          throw new APIError(
            errorMessage,
            '/tts',
            response.status,
            undefined,
            context
          );
        }

        if (!response.body) {
          throw new APIError(
            'No response body received for TTS request',
            '/tts',
            response.status,
            undefined,
            context
          );
        }

        // Handle streaming audio response
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytesReceived = 0;
        
        // Get total size from Content-Length header if available
        const contentLength = response.headers.get('Content-Length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;

        try {
          while (true) {
            const { value, done } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            bytesReceived += value.length;
            
            // Call progress callback if provided
            if (onProgress) {
              onProgress(bytesReceived, totalBytes);
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (chunks.length === 0) {
          throw new AudioError(
            'No audio data received from TTS API',
            'LOAD',
            context
          );
        }

        // Create blob from audio chunks
        const audioBlob = new Blob(chunks, { type: 'audio/mpeg' });
        
        if (audioBlob.size === 0) {
          throw new AudioError(
            'Empty audio blob received from TTS API',
            'LOAD',
            context
          );
        }

        // Create blob URL for playback
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Call completion callback if provided
        if (onComplete) {
          onComplete(audioUrl);
        }

        return audioUrl;
      },
      {
        ...DEFAULT_RETRY_CONFIGS.API,
        maxAttempts: 2, // Fewer retries for audio to avoid long delays
        onRetry: (error, attempt, delayMs) => {
          logError(error, { ...context, attempt, delayMs });
        },
      }
    );
  } catch (error) {
    logError(error, context);
    
    // Call error callback if provided
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
    
    if (error instanceof APIError || error instanceof AudioError) {
      throw error;
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError(
        'Text-to-speech request was cancelled',
        '/tts',
        undefined,
        undefined,
        context,
        error
      );
    }
    
    throw new APIError(
      `Text-to-speech failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      '/tts',
      undefined,
      undefined,
      context,
      error instanceof Error ? error : undefined
    );
  }
}

// Convenience function for backward compatibility
export async function ttsAudioStreamSimple(
  text: string,
  voiceId = '21m00Tcm4TlvDq8ikWAM'
): Promise<string> {
  return ttsAudioStream(text, voiceId);
}

// Export utility functions for advanced usage
export { 
  APIError, 
  ValidationError, 
  AudioError,
  createTimeoutController,
  withRetry,
  DEFAULT_RETRY_CONFIGS 
} from './errors'; 