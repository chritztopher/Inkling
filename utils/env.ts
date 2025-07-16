import Constants from 'expo-constants';

const extras = (Constants.expoConfig?.extra ??
  /* @ts-ignore -- fallback for web manifest2 */ Constants.manifest2?.extra ??
  {}) as Record<string, string>;

export const SUPABASE_URL = extras['SUPABASE_URL'];
export const SUPABASE_ANON_KEY = extras['SUPABASE_ANON_KEY'];

// Fail fast with clear instructions for Supabase configuration
if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL missing at runtime!');
  console.error('💡 Create a .env file in your project root with:');
  console.error('   SUPABASE_URL=https://your-project-ref.supabase.co');
  console.error('   Then run: npx expo start -c');
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY missing at runtime!');
  console.error('💡 Create a .env file in your project root with:');
  console.error('   SUPABASE_ANON_KEY=your-anon-key-here');
  console.error('   Then run: npx expo start -c');
}

// Success message when keys are found
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  console.log('✅ Loaded Supabase config: SUPABASE_URL ✅ SUPABASE_ANON_KEY');
} else {
  console.warn('⚠️  Supabase configuration incomplete. API calls may fail.');
}

// Export deprecated keys for compatibility (they will be undefined)
export const OPENAI_KEY = undefined;
export const ELEVEN_KEY = undefined; 