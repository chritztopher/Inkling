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
 * This function is now deprecated - use chatLLM from utils/api.ts instead
 */
export const getInklingResponse = async (
  transcript: string,
  personaId: string,
  bookId: string
): Promise<InklingResponse | null> => {
  // Deprecated: Use chatLLM from utils/api.ts for new implementations
  console.warn('getInklingResponse is deprecated. Use chatLLM from utils/api.ts instead.');
  return {
    text: `Mock response for "${transcript}" from ${personaId} discussing ${bookId}. Please use the new chatLLM API.`,
  };
};

/**
 * Get persona information by ID
 */
export const getPersona = async (personaId: string): Promise<Persona | null> => {
  // Using mock data for now - replace with real API call when backend is ready
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
};

/**
 * Get book information by ID
 */
export const getBook = async (bookId: string): Promise<Book | null> => {
  // Using mock data for now - replace with real API call when backend is ready
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