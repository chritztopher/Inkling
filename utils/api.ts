import Constants from 'expo-constants';

const EDGE = `${Constants.expoConfig?.extra?.['SUPABASE_URL']}/functions/v1`;

export async function sttWhisper(fileUri: string): Promise<string> {
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: 'audio.webm',
    type: 'audio/webm',
  } as any);
  
  const res = await fetch(`${EDGE}/whisper`, { 
    method: 'POST', 
    body: form 
  });
  
  if (!res.ok) {
    throw new Error(`Whisper ${res.status}: ${await res.text()}`);
  }
  
  const result = await res.json();
  return result.text;
}

export async function chatLLM(
  transcript: string,
  personaId: string,
  bookId: string,
  onChunk: (delta: string) => void
): Promise<string> {
  const res = await fetch(`${EDGE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, personaId, bookId }),
  });
  
  if (!res.ok) {
    throw new Error(`Chat ${res.status}: ${await res.text()}`);
  }

  // Stream text/event-stream
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value, { stream: true });
    onChunk(chunk);                // Update UI progressively
    full += chunk;
  }
  
  return full.trim();
}

export async function ttsAudioStream(
  text: string,
  voiceId = '21m00Tcm4TlvDq8ikWAM'
): Promise<string> {
  const res = await fetch(`${EDGE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  });
  
  if (!res.ok) {
    throw new Error(`TTS ${res.status}: ${await res.text()}`);
  }
  
  const blob = await res.blob();           // ElevenLabs stream piped back
  return URL.createObjectURL(blob);
} 