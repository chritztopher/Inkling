import { elevenTTS } from "./eleven";
// later import { vogentTTS } from "./vogent";

// Configuration for TTS provider
const PROVIDER = "eleven" as const; // flip when we A/B test

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
 */
export async function synthesize(
  text: string,
  personaId?: string,
  options?: {
    model?: string;
    voiceId?: string;
    provider?: "eleven";
  }
): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty for synthesis");
  }

  const provider = options?.provider || PROVIDER;
  const voiceId = options?.voiceId || VOICE_MAP[personaId || "default"] || VOICE_MAP["default"];

  try {
    switch (provider) {
      case "eleven":
        return await elevenTTS(text, voiceId, options?.model);
      
      // case "vogent":
      //   return await vogentTTS(text, voiceId, options?.model);
      
      default:
        throw new Error(`Unsupported TTS provider: ${provider}`);
    }
  } catch (error) {
    console.error(`TTS synthesis error with provider ${provider}:`, error);
    throw error;
  }
}

/**
 * Get available voices for the current provider
 * @param provider Optional provider to get voices for
 * @returns Promise resolving to available voices
 */
export async function getAvailableVoices(provider?: "eleven"): Promise<any[]> {
  const currentProvider = provider || PROVIDER;

  switch (currentProvider) {
    case "eleven":
      const { getElevenVoices } = await import("./eleven");
      return await getElevenVoices();
    
    // case "vogent":
    //   const { getVogentVoices } = await import("./vogent");
    //   return await getVogentVoices();
    
    default:
      throw new Error(`Unsupported TTS provider: ${currentProvider}`);
  }
}

/**
 * Get user/account info for the current provider
 * @param provider Optional provider to get info for
 * @returns Promise resolving to user info
 */
export async function getProviderInfo(provider?: "eleven"): Promise<any> {
  const currentProvider = provider || PROVIDER;

  switch (currentProvider) {
    case "eleven":
      const { getElevenUserInfo } = await import("./eleven");
      return await getElevenUserInfo();
    
    // case "vogent":
    //   const { getVogentUserInfo } = await import("./vogent");
    //   return await getVogentUserInfo();
    
    default:
      throw new Error(`Unsupported TTS provider: ${currentProvider}`);
  }
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