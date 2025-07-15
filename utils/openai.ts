/* eslint-disable camelcase */
import * as FileSystem from 'expo-file-system';
import { OPENAI_KEY } from './env';

const BASE = 'https://api.openai.com/v1';

/**
 * Transcribe audio using OpenAI Whisper
 * @param audioUri - Local file URI of the audio to transcribe
 * @returns Promise<string> - The transcribed text
 */
export async function whisperTranscribe(audioUri: string): Promise<string> {
  if (!OPENAI_KEY) {
    // Return mock transcription for development when API key is not configured
    return 'Mock transcription: This is a test voice message for development purposes.';
  }

  try {
    // Convert file to blob for upload
    const audioBlob = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create FormData for multipart upload
    const formData = new FormData();
    
    // Convert base64 to blob
    const response = await fetch(`data:audio/webm;base64,${audioBlob}`);
    const blob = await response.blob();
    
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    const res = await fetch(`${BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: formData,
    });

    if (!res.ok) {
      let errorMessage = `Whisper API error ${res.status}`;
      
      try {
        const errorData = await res.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        // If JSON parsing fails, use the status text
        errorMessage = `${errorMessage}: ${res.statusText}`;
      }
      
      // Provide user-friendly error messages
      if (res.status === 401) {
        errorMessage = 'Invalid OpenAI API key. Please check your configuration.';
      } else if (res.status === 413) {
        errorMessage = 'Audio file too large. Please try a shorter recording.';
      } else if (res.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      }
      
      throw new Error(errorMessage);
    }

    const result = await res.json();
    return result.text || '';
  } catch (error) {
    console.error('Failed to transcribe audio with Whisper:', error);
    // Re-throw with preserved error message for user feedback
    throw error instanceof Error ? error : new Error('Unknown transcription error');
  }
}

type Role = 'system' | 'user' | 'assistant';

/**
 * Get a response from OpenAI chat completions
 * @param userText - The user's message
 * @param personaId - The persona ID to use for context
 * @param bookId - The book ID to use for context
 * @returns Promise<string> - The assistant's response
 */
export async function getInklingResponse(
  userText: string,
  personaId: string,
  bookId: string
): Promise<string> {
  if (!OPENAI_KEY) {
    throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.');
  }

  try {
    const personaPrompt = makePersonaPrompt(personaId, bookId);

    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: personaPrompt },
          { role: 'user', content: userText },
        ] as { role: Role; content: string }[],
        temperature: 0.7,
        max_tokens: 150,
        stream: false,
      }),
    });

    if (!res.ok) {
      let errorMessage = `OpenAI Chat API error ${res.status}`;
      
      try {
        const errorData = await res.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        // If JSON parsing fails, use the status text
        errorMessage = `${errorMessage}: ${res.statusText}`;
      }
      
      // Provide user-friendly error messages
      if (res.status === 401) {
        errorMessage = 'Invalid OpenAI API key. Please check your configuration.';
      } else if (res.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (res.status === 400) {
        errorMessage = 'Invalid request. Please try again with a different message.';
      }
      
      throw new Error(errorMessage);
    }

    const data = await res.json();
    const response = data.choices[0]?.message?.content?.trim();
    
    if (!response) {
      throw new Error('No response generated from OpenAI');
    }
    
    return response;
  } catch (error) {
    console.error('Failed to get response from OpenAI:', error);
    
    // Re-throw with preserved error message for user feedback
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to generate response. Please try again.');
  }
}

/**
 * Create a persona prompt based on persona and book context
 * @param personaId - The persona ID
 * @param bookId - The book ID  
 * @returns string - The system prompt
 */
function makePersonaPrompt(personaId: string, bookId: string): string {
  // This is a basic implementation - in a real app, you'd fetch actual persona/book data
  return `You are ${personaId}, a knowledgeable character discussing ${bookId}. 
Respond in character with insights about the book, themes, characters, and literary analysis. 
Keep responses conversational, engaging, and under 150 words. 
Draw from the book's content to provide thoughtful, contextual responses.`;
} 