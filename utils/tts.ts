import { elevenTTS } from "./eleven";
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
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

// TTS cache for audio files
const ttsCache = new Map<string, string>();
const activeRequests = new Map<string, Promise<string>>();

// Cache directory for TTS files
const TTS_CACHE_DIR = `${FileSystem.documentDirectory}tts_cache/`;

/**
 * Initialize TTS cache directory
 */
async function initializeTTSCache(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(TTS_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(TTS_CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    console.warn('Failed to initialize TTS cache directory:', error);
  }
}

/**
 * Generate cache key for TTS request
 */
async function generateCacheKey(text: string, voiceId: string, model?: string): Promise<string> {
  const input = `${text}-${voiceId}-${model || 'default'}`;
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

/**
 * Clean up old TTS cache files
 */
async function cleanupTTSCache(): Promise<void> {
  try {
    const files = await FileSystem.readDirectoryAsync(TTS_CACHE_DIR);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const file of files) {
      const filePath = `${TTS_CACHE_DIR}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      if (fileInfo.exists && fileInfo.modificationTime) {
        const age = now - fileInfo.modificationTime * 1000;
        if (age > maxAge) {
          await FileSystem.deleteAsync(filePath);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup TTS cache:', error);
  }
}

/**
 * Provider-agnostic text-to-speech synthesis with caching
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
    useCache?: boolean;
  }
): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty for synthesis");
  }

  const provider = options?.provider || PROVIDER;
  const voiceId = options?.voiceId || VOICE_MAP[personaId || "default"] || VOICE_MAP["default"];
  const useCache = options?.useCache ?? true;
  
  // Initialize cache if needed
  if (useCache) {
    await initializeTTSCache();
  }

  // Generate cache key
  const cacheKey = await generateCacheKey(text, voiceId, options?.model);
  
  // Check memory cache first
  if (useCache && ttsCache.has(cacheKey)) {
    return ttsCache.get(cacheKey)!;
  }

  // Check file cache
  if (useCache) {
    const cachedFilePath = `${TTS_CACHE_DIR}${cacheKey}.mp3`;
    const cachedFile = await FileSystem.getInfoAsync(cachedFilePath);
    
    if (cachedFile.exists) {
      const audioUrl = cachedFile.uri;
      ttsCache.set(cacheKey, audioUrl);
      return audioUrl;
    }
  }

  // Check if request is already in progress
  if (activeRequests.has(cacheKey)) {
    return activeRequests.get(cacheKey)!;
  }

  // Create new request
  const requestPromise = synthesizeInternal(text, voiceId, options?.model, provider, cacheKey, useCache);
  activeRequests.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    
    // Cache the result
    if (useCache) {
      ttsCache.set(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error(`TTS synthesis error with provider ${provider}:`, error);
    throw error;
  } finally {
    // Clean up active request
    activeRequests.delete(cacheKey);
  }
}

/**
 * Internal synthesis function
 */
async function synthesizeInternal(
  text: string,
  voiceId: string,
  model: string | undefined,
  provider: "eleven",
  cacheKey: string,
  useCache: boolean
): Promise<string> {
  let audioUrl: string;
  
  switch (provider) {
    case "eleven":
      audioUrl = await elevenTTS(text, voiceId, model);
      break;
    
    // case "vogent":
    //   audioUrl = await vogentTTS(text, voiceId, model);
    //   break;
    
    default:
      throw new Error(`Unsupported TTS provider: ${provider}`);
  }

  // Save to file cache if enabled
  if (useCache) {
    try {
      const cachedFilePath = `${TTS_CACHE_DIR}${cacheKey}.mp3`;
      await FileSystem.downloadAsync(audioUrl, cachedFilePath);
      return cachedFilePath;
    } catch (error) {
      console.warn('Failed to cache TTS file:', error);
      // Return original URL if caching fails
      return audioUrl;
    }
  }

  return audioUrl;
}

/**
 * Clear TTS cache
 */
export async function clearTTSCache(): Promise<void> {
  try {
    ttsCache.clear();
    activeRequests.clear();
    
    const dirInfo = await FileSystem.getInfoAsync(TTS_CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(TTS_CACHE_DIR);
    }
  } catch (error) {
    console.warn('Failed to clear TTS cache:', error);
  }
}

/**
 * Get TTS cache stats
 */
export function getTTSCacheStats(): {
  memoryCache: number;
  activeRequests: number;
} {
  return {
    memoryCache: ttsCache.size,
    activeRequests: activeRequests.size,
  };
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
 * Get provider user info (quotas, usage, etc.)
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

// Initialize cache cleanup on app start
initializeTTSCache().then(() => {
  cleanupTTSCache();
}); 