#!/bin/bash

# Deploy Supabase Edge Functions
# This script deploys all three functions: whisper, chat, and tts

echo "🚀 Deploying Supabase Edge Functions..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "   npm install -g @supabase/cli"
    exit 1
fi

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Please login to Supabase first:"
    echo "   supabase login"
    exit 1
fi

# Link to project (if not already linked)
echo "🔗 Linking to Supabase project..."
supabase link --project-ref mmrlgagmqvujggzkqtmk

# Deploy functions
echo "📦 Deploying Whisper function..."
supabase functions deploy whisper

echo "📦 Deploying Chat function..."
supabase functions deploy chat

echo "📦 Deploying TTS function..."
supabase functions deploy tts

echo "✅ All functions deployed successfully!"
echo ""
echo "🔧 Don't forget to set your environment variables:"
echo "   supabase secrets set OPENAI_API_KEY=your_openai_api_key_here"
echo "   supabase secrets set ELEVEN_LABS_API_KEY=your_elevenlabs_api_key_here"
echo ""
echo "🌐 Your functions are now available at:"
echo "   https://mmrlgagmqvujggzkqtmk.supabase.co/functions/v1/whisper"
echo "   https://mmrlgagmqvujggzkqtmk.supabase.co/functions/v1/chat"
echo "   https://mmrlgagmqvujggzkqtmk.supabase.co/functions/v1/tts" 