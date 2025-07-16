import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ChatMessage, Persona, Book, ConversationContext } from '../services/chat';

// Chat state types
export interface ChatState {
  // Current conversation
  currentConversation: ConversationContext | null;
  
  // Messages
  messages: ChatMessage[];
  
  // Conversation state
  isRecording: boolean;
  isThinking: boolean;
  isSpeaking: boolean;
  
  // Audio state
  currentAudio: any | null; // Audio.Sound type
  audioProgress: number;
  
  // Personas and books
  personas: Record<string, Persona>;
  books: Record<string, Book>;
  
  // Actions
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  setCurrentConversation: (context: ConversationContext | null) => void;
  setRecording: (isRecording: boolean) => void;
  setThinking: (isThinking: boolean) => void;
  setSpeaking: (isSpeaking: boolean) => void;
  setCurrentAudio: (audio: any | null) => void;
  setAudioProgress: (progress: number) => void;
  addPersona: (persona: Persona) => void;
  addBook: (book: Book) => void;
  resetConversationState: () => void;
}

// Create the store
export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentConversation: null,
      messages: [],
      isRecording: false,
      isThinking: false,
      isSpeaking: false,
      currentAudio: null,
      audioProgress: 0,
      personas: {},
      books: {},

      // Actions
      addMessage: (message: ChatMessage) => {
        set((state: ChatState) => ({
          messages: [...state.messages, message],
        }));
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      setCurrentConversation: (context: ConversationContext | null) => {
        set((state: ChatState) => {
          const updates: Partial<ChatState> = { currentConversation: context };
          
          // If starting a new conversation with a different persona, clear previous messages
          if (context && context.personaId !== state.currentConversation?.personaId) {
            updates.messages = [];
          }
          
          return updates;
        });
      },

      setRecording: (isRecording: boolean) => {
        set({ isRecording });
      },

      setThinking: (isThinking: boolean) => {
        set({ isThinking });
      },

      setSpeaking: (isSpeaking: boolean) => {
        set({ isSpeaking });
      },

      setCurrentAudio: (audio: any | null) => {
        set((state: ChatState) => {
          // Clean up existing audio if it exists
          if (state.currentAudio) {
            try {
              state.currentAudio.stopAsync().catch(console.error);
              state.currentAudio.unloadAsync().catch(console.error);
            } catch (cleanupError) {
              console.warn('Failed to cleanup existing audio:', cleanupError);
            }
          }
          
          return { currentAudio: audio };
        });
      },

      setAudioProgress: (progress: number) => {
        set({ audioProgress: progress });
      },

      addPersona: (persona: Persona) => {
        set((state: ChatState) => ({
          personas: { ...state.personas, [persona.id]: persona },
        }));
      },

      addBook: (book: Book) => {
        set((state: ChatState) => ({
          books: { ...state.books, [book.id]: book },
        }));
      },

      resetConversationState: () => {
        set({
          isRecording: false,
          isThinking: false,
          isSpeaking: false,
          currentAudio: null,
          audioProgress: 0,
        });
      },
    }),
    {
      name: 'chat-store',
    }
  )
);

// Selectors for commonly used state
export const useMessages = () => useChatStore((state: ChatState) => state.messages);
export const useCurrentConversation = () => useChatStore((state: ChatState) => state.currentConversation);
export const useConversationState = () => useChatStore((state: ChatState) => ({
  isRecording: state.isRecording,
  isThinking: state.isThinking,
  isSpeaking: state.isSpeaking,
}));
export const useAudioState = () => useChatStore((state: ChatState) => ({
  currentAudio: state.currentAudio,
  audioProgress: state.audioProgress,
}));
export const usePersonas = () => useChatStore((state: ChatState) => state.personas);
export const useBooks = () => useChatStore((state: ChatState) => state.books);

// Helper functions
export const getCurrentPersona = (): Persona | null => {
  const { currentConversation, personas } = useChatStore.getState();
  if (!currentConversation) return null;
  return personas[currentConversation.personaId] || null;
};

export const getCurrentBook = (): Book | null => {
  const { currentConversation, books } = useChatStore.getState();
  if (!currentConversation) return null;
  return books[currentConversation.bookId] || null;
};

export const getConversationTitle = (): string => {
  const persona = getCurrentPersona();
  const book = getCurrentBook();
  
  if (persona && book) {
    return `${persona.name} - ${book.title}`;
  } else if (persona) {
    return persona.name;
  } else if (book) {
    return book.title;
  }
  
  return 'Conversation';
};

export const isConversationActive = (): boolean => {
  const { currentConversation } = useChatStore.getState();
  return currentConversation !== null;
};

export const canStartRecording = (): boolean => {
  const { isRecording, isThinking, isSpeaking } = useChatStore.getState();
  return !isRecording && !isThinking && !isSpeaking;
}; 