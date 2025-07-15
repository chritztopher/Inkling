import { ELEVEN_KEY } from "./env";

const BASE = "https://api.elevenlabs.io/v1";

/**
 * Convert text to speech using ElevenLabs API
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
  if (!ELEVEN_KEY) {
    // Skip audio synthesis for development when API key is not configured
    throw new Error("ElevenLabs API key not configured");
  }

  if (!text || text.trim().length === 0) {
    throw new Error("Text cannot be empty");
  }

  try {
    const res = await fetch(`${BASE}/text-to-speech/${voiceId}/stream`, {
      method: "POST",
      headers: {
        accept: "audio/mpeg",
        "xi-api-key": ELEVEN_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: model,
        voice_settings: { 
          similarity_boost: 0.75, 
          style: 0.3,
          stability: 0.5
        },
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`ElevenLabs ${res.status}: ${errTxt}`);
    }

    const blob = await res.blob();                  // small, plays quickly
    
    // OPTIONAL: capture cost header
    const creditsUsed = res.headers.get("x-credits-used");
    if (creditsUsed) {
      console.info("Eleven credits used:", creditsUsed);
    }

    return URL.createObjectURL(blob);               // for Expo Audio
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    throw error;
  }
}

/**
 * Get available voices from ElevenLabs
 * @returns Promise resolving to available voices
 */
export async function getElevenVoices(): Promise<any[]> {
  if (!ELEVEN_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  try {
    const res = await fetch(`${BASE}/voices`, {
      headers: {
        "xi-api-key": ELEVEN_KEY,
      },
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`ElevenLabs ${res.status}: ${errTxt}`);
    }

    const data = await res.json();
    return data.voices || [];
  } catch (error) {
    console.error("ElevenLabs voices error:", error);
    throw error;
  }
}

/**
 * Get user info including remaining credits
 * @returns Promise resolving to user info
 */
export async function getElevenUserInfo(): Promise<any> {
  if (!ELEVEN_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  try {
    const res = await fetch(`${BASE}/user`, {
      headers: {
        "xi-api-key": ELEVEN_KEY,
      },
    });

    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`ElevenLabs ${res.status}: ${errTxt}`);
    }

    const data = await res.json();
    return data;
  } catch (error) {
    console.error("ElevenLabs user info error:", error);
    throw error;
  }
} 