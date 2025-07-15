// Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  audioUrl?: string;
}

export interface InklingResponse {
  text: string;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  voiceId: string;
  avatar?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  cover?: string;
}

export interface ConversationContext {
  personaId: string;
  bookId: string;
  messages: ChatMessage[];
  persona?: Persona;
  book?: Book;
}

/**
 * Get a response from Inkling based on the user's transcript
 * This function handles the conversation flow and returns both text and audio
 */
export const getInklingResponse = async (
  transcript: string,
  personaId: string,
  bookId: string
): Promise<InklingResponse | null> => {
  try {
    // In a real implementation, this would:
    // 1. Send the transcript, persona, and book context to your backend
    // 2. Generate a contextual response using AI/LLM
    // 3. Convert the response to speech using TTS
    // 4. Return both text and audio URL

    // Mock implementation for now
    const response = await fetch('https://your-api-endpoint.com/inkling/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: transcript,
        persona_id: personaId,
        book_id: bookId,
        context: {
          // Add any additional context here
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat API failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      text: result.text,
    };
  } catch (error) {
    console.error('Failed to get Inkling response:', error);
    
    // Fallback mock response for development
    return {
      text: `Thank you for saying "${transcript}". I'm ${personaId} and we're discussing ${bookId}. How can I help you explore this further?`,
    };
  }
};

/**
 * Get persona information by ID
 */
export const getPersona = async (personaId: string): Promise<Persona | null> => {
  try {
    const response = await fetch(`https://your-api-endpoint.com/personas/${personaId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch persona: ${response.statusText}`);
    }

    const persona = await response.json();
    return persona;
  } catch (error) {
    console.error('Failed to get persona:', error);
    
    // Fallback mock persona
    const mockPersonas: Record<string, Persona> = {
      'jane-austen': {
        id: 'jane-austen',
        name: 'Jane Austen',
        description: 'English novelist known for her wit and social commentary',
        voiceId: 'jane-austen-voice',
        avatar: 'https://example.com/jane-austen-avatar.jpg',
      },
      'shakespeare': {
        id: 'shakespeare',
        name: 'William Shakespeare',
        description: 'English playwright and poet',
        voiceId: 'shakespeare-voice',
        avatar: 'https://example.com/shakespeare-avatar.jpg',
      },
    };

    return mockPersonas[personaId] || null;
  }
};

/**
 * Get book information by ID
 */
export const getBook = async (bookId: string): Promise<Book | null> => {
  try {
    const response = await fetch(`https://your-api-endpoint.com/books/${bookId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch book: ${response.statusText}`);
    }

    const book = await response.json();
    return book;
  } catch (error) {
    console.error('Failed to get book:', error);
    
    // Fallback mock books
    const mockBooks: Record<string, Book> = {
      'pride-and-prejudice': {
        id: 'pride-and-prejudice',
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        description: 'A romantic novel about Elizabeth Bennet and Mr. Darcy',
        cover: 'https://example.com/pride-prejudice-cover.jpg',
      },
      'hamlet': {
        id: 'hamlet',
        title: 'Hamlet',
        author: 'William Shakespeare',
        description: 'A tragedy about the Prince of Denmark',
        cover: 'https://example.com/hamlet-cover.jpg',
      },
    };

    return mockBooks[bookId] || null;
  }
};

/**
 * Generate a unique message ID
 */
export const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new chat message
 */
export const createMessage = (
  role: 'user' | 'assistant',
  text: string,
  audioUrl?: string
): ChatMessage => {
  const message: ChatMessage = {
    id: generateMessageId(),
    role,
    text,
    timestamp: Date.now(),
  };
  
  if (audioUrl) {
    message.audioUrl = audioUrl;
  }
  
  return message;
};

/**
 * Format conversation context for API calls
 */
export const formatConversationContext = (
  messages: ChatMessage[],
  maxMessages: number = 10
): Array<{ role: string; content: string }> => {
  return messages
    .slice(-maxMessages)
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));
};

/**
 * Validate conversation parameters
 */
export const validateConversationParams = (
  personaId: string,
  bookId: string
): { isValid: boolean; error?: string } => {
  if (!personaId || !personaId.trim()) {
    return { isValid: false, error: 'Persona ID is required' };
  }

  if (!bookId || !bookId.trim()) {
    return { isValid: false, error: 'Book ID is required' };
  }

  return { isValid: true };
}; 