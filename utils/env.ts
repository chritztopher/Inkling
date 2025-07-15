import Constants from 'expo-constants';

const extras = (Constants.expoConfig?.extra ??
  /* @ts-ignore -- fallback for web manifest2 */ Constants.manifest2?.extra ??
  {}) as Record<string, string>;

export const OPENAI_KEY = extras['OPENAI_API_KEY'];
export const ELEVEN_KEY = extras['ELEVENLABS_API_KEY'];

if (!OPENAI_KEY) console.warn('⚠️  OPENAI_API_KEY missing at runtime!');
if (!ELEVEN_KEY) console.warn('⚠️  ELEVENLABS_API_KEY missing at runtime!'); 