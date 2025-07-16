// Configuration for TTS provider
const PROVIDER = "supabase" as const; // Using Supabase Edge Functions

// Voice mapping for different personas
const VOICE_MAP: Record<string, string> = {
  "jane-austen": "21m00Tcm4TlvDq8ikWAM",     // Default English female
  "shakespeare": "29vD33N1CtxCmqQRPOHJ",     // English male (Adam)
  "hemingway": "pNInz6obpgDQGcFmaJgB",       // American male (Josh)
  "default": "21m00Tcm4TlvDq8ikWAM",         // Default fallback
};

/**
 * Provider-agnostic text-to-speech synthesis
 * @param text The text to convert to speech
 * @param personaId Optional persona ID to select appropriate voice
 * @param options Optional provider-specific options
 * @returns Promise resolving to audio blob URL
 * @deprecated Use ttsAudioStream from utils/api.ts instead
 */
export async function synthesize(
  text: string,
  personaId?: string,
  options?: {
    model?: string;
    voiceId?: string;
    provider?: "supabase";
  }
): Promise<string | null> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty for synthesis");
  }

  console.warn('synthesize is deprecated. Use ttsAudioStream from utils/api.ts instead.');

  const voiceId = options?.voiceId || VOICE_MAP[personaId || "default"] || VOICE_MAP["default"];

  try {
    // Use the new Supabase Edge Function API
    const { ttsAudioStream } = await import('./api');
    return await ttsAudioStream(text, voiceId);
  } catch (error) {
    console.error('TTS synthesis error:', error);
    // Return null for development when API is not configured
    if (error instanceof Error && error.message.includes('not configured')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get available voices for the current provider
 * @param provider Optional provider to get voices for
 * @returns Promise resolving to available voices
 * @deprecated Voice selection is now handled by Supabase Edge Functions
 */
export async function getAvailableVoices(_provider?: "supabase"): Promise<any[]> {
  console.warn('getAvailableVoices is deprecated. Voice selection is now handled by Supabase Edge Functions.');
  
  // Return the default voice mappings for compatibility
  return Object.entries(VOICE_MAP).map(([personaId, voiceId]) => ({
    id: voiceId,
    name: personaId,
    persona: personaId,
  }));
}

/**
 * Get user/account info for the current provider
 * @param provider Optional provider to get info for
 * @returns Promise resolving to user info
 * @deprecated User info is now handled by Supabase Edge Functions
 */
export async function getProviderInfo(_provider?: "supabase"): Promise<any> {
  console.warn('getProviderInfo is deprecated. User info is now handled by Supabase Edge Functions.');
  
  // Return mock provider info for compatibility
  return {
    provider: 'supabase',
    status: 'connected',
    voices: Object.keys(VOICE_MAP),
  };
}

/**
 * Update voice mapping for personas
 * @param personaId The persona ID
 * @param voiceId The voice ID to map to
 */
export function setPersonaVoice(personaId: string, voiceId: string): void {
  VOICE_MAP[personaId] = voiceId;
}

/**
 * Get the current voice mapping
 * @returns Current voice mapping object
 */
export function getVoiceMapping(): Record<string, string> {
  return { ...VOICE_MAP };
}

/**
 * Get the current TTS provider
 * @returns Current provider name
 */
export function getCurrentProvider(): string {
  return PROVIDER;
} 