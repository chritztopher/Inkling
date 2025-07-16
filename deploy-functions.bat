@echo off

REM Deploy Supabase Edge Functions
REM This script deploys all three functions: whisper, chat, and tts

echo 🚀 Deploying Supabase Edge Functions...

REM Check if Supabase CLI is installed
where supabase >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Supabase CLI is not installed. Please install it first:
    echo    npm install -g @supabase/cli
    exit /b 1
)

REM Check if user is logged in
supabase projects list >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Please login to Supabase first:
    echo    supabase login
    exit /b 1
)

REM Link to project (if not already linked)
echo 🔗 Linking to Supabase project...
supabase link --project-ref mmrlgagmqvujggzkqtmk

REM Deploy functions
echo 📦 Deploying Whisper function...
supabase functions deploy whisper

echo 📦 Deploying Chat function...
supabase functions deploy chat

echo 📦 Deploying TTS function...
supabase functions deploy tts

echo ✅ All functions deployed successfully!
echo.
echo 🔧 Don't forget to set your environment variables:
echo    supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
echo    supabase secrets set ELEVEN_LABS_API_KEY=your_elevenlabs_api_key_here
echo.
echo 🌐 Your functions are now available at:
echo    https://mmrlgagmqvujggzkqtmk.supabase.co/functions/v1/whisper
echo    https://mmrlgagmqvujggzkqtmk.supabase.co/functions/v1/chat
echo    https://mmrlgagmqvujggzkqtmk.supabase.co/functions/v1/tts

pause 