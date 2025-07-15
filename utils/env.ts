import Constants from 'expo-constants';

const extras = (Constants.expoConfig?.extra ??
  /* @ts-ignore -- fallback for web manifest2 */ Constants.manifest2?.extra ??
  {}) as Record<string, string>;

export const OPENAI_KEY = extras['OPENAI_API_KEY'];
export const ELEVEN_KEY = extras['ELEVENLABS_API_KEY'];

// Fail fast with clear instructions
if (!OPENAI_KEY) {
  console.error('❌ OPENAI_API_KEY missing at runtime!');
  console.error('💡 Create a .env file in your project root with:');
  console.error('   OPENAI_API_KEY=sk-your-actual-key-here');
  console.error('   Then run: npx expo start -c');
}

if (!ELEVEN_KEY) {
  console.error('❌ ELEVENLABS_API_KEY missing at runtime!');
  console.error('💡 Create a .env file in your project root with:');
  console.error('   ELEVENLABS_API_KEY=your-actual-key-here');
  console.error('   Then run: npx expo start -c');
}

// Success message when keys are found
if (OPENAI_KEY && ELEVEN_KEY) {
  console.log('✅ Loaded secrets: OPENAI_API_KEY ✅ ELEVENLABS_API_KEY');
} 