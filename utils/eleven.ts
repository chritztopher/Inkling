import Constants from "expo-constants";

const BASE = "https://api.elevenlabs.io/v1";

// SECURITY FIX: Instead of exposing API keys directly, use a backend proxy
// const ELEVEN_KEY = Constants.expoConfig?.extra?.ELEVENLABS_API_KEY as string;
const BACKEND_URL = Constants.expoConfig?.extra?.BACKEND_URL || "https://your-backend-api.com";

/**
 * Convert text to speech using ElevenLabs API (via secure backend proxy)
 * @param text The text to convert to speech
 * @param voiceId The voice ID to use (default: English female)
 * @param model The model to use (default: eleven_multilingual_v2)
 * @returns Promise resolving to audio blob URL
 */
export async function elevenTTS(
  text: string,
  voiceId = "21m00Tcm4TlvDq8ikWAM",   // default English female
  model = "eleven_multilingual_v2"
): Promise<string> {
  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty");
  }

  if (!BACKEND_URL) {
    throw new Error("Backend URL not configured. Please set BACKEND_URL in your .env file.");
  }

  try {
    // Use secure backend proxy instead of direct API calls
    const res = await fetch(`${BACKEND_URL}/api/tts/eleven`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add authentication headers as needed (e.g., JWT token)
      },
      body: JSON.stringify({
        text: text.trim(),
        voiceId,
        model,
        voice_settings: { 
          similarity_boost: 0.75, 
          style: 0.3,
          stability: 0.5
        },
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`TTS Service ${res.status}: ${errTxt}`);
    }

    const blob = await res.blob();
    
    // OPTIONAL: capture cost header if returned by backend
    const creditsUsed = res.headers.get("x-credits-used");
    if (creditsUsed) {
      console.info("TTS credits used:", creditsUsed);
    }

    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("TTS service error:", error);
    throw error;
  }
}

/**
 * Get available voices from ElevenLabs
 * @returns Promise resolving to available voices
 */
export async function getElevenVoices(): Promise<any[]> {
  if (!BACKEND_URL) {
    throw new Error("Backend URL not configured");
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/voices/eleven`, {
      headers: {
        // Add authentication headers as needed
      },
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Voices Service ${res.status}: ${errTxt}`);
    }

    const data = await res.json();
    return data.voices || [];
  } catch (error) {
    console.error("Voices service error:", error);
    throw error;
  }
}

/**
 * Get user info including remaining credits
 * @returns Promise resolving to user info
 */
export async function getElevenUserInfo(): Promise<any> {
  if (!BACKEND_URL) {
    throw new Error("Backend URL not configured");
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/user/eleven`, {
      headers: {
        // Add authentication headers as needed
      },
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`User Info Service ${res.status}: ${errTxt}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("User Info service error:", error);
    throw error;
  }
} 