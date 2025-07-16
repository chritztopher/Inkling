# Supabase Edge Functions

This directory contains the Supabase Edge Functions that provide secure proxy endpoints for your OpenAI and ElevenLabs API calls.

## Functions Overview

### 1. `/whisper` - Speech-to-Text
- **Purpose**: Proxies audio transcription requests to OpenAI's Whisper API
- **Input**: FormData with audio file
- **Output**: `{ text: string }`

### 2. `/chat` - Streaming Chat
- **Purpose**: Provides streaming GPT-4o responses with persona and book context
- **Input**: `{ transcript: string, personaId: string, bookId: string }`
- **Output**: Streaming text response

### 3. `/tts` - Text-to-Speech  
- **Purpose**: Proxies text-to-speech requests to ElevenLabs API
- **Input**: `{ text: string, voiceId?: string }`
- **Output**: Streaming audio (MP3)

## Environment Variables

You need to set these environment variables in your Supabase project:

```bash
OPENAI_API_KEY=your_openai_api_key_here
ELEVEN_LABS_API_KEY=your_elevenlabs_api_key_here
```

## Deployment Instructions

### 1. Install Supabase CLI

```bash
npm install -g @supabase/cli
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link your project

```bash
supabase link --project-ref mmrlgagmqvujggzkqtmk
```

### 4. Set environment variables

```bash
# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here

# Set ElevenLabs API key  
supabase secrets set ELEVEN_LABS_API_KEY=your_elevenlabs_api_key_here
```

### 5. Deploy functions

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individual functions
supabase functions deploy whisper
supabase functions deploy chat
supabase functions deploy tts
```

## Testing Functions

### Test Whisper function locally:
```bash
supabase functions serve whisper
```

### Test Chat function locally:
```bash
supabase functions serve chat
```

### Test TTS function locally:
```bash
supabase functions serve tts
```

## Usage Examples

### Whisper API
```javascript
const formData = new FormData();
formData.append('file', audioFile);

const response = await fetch('https://mmrlgagmqvujggzkqtmk.supabase.co/functions/v1/whisper', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result.text);
```

### Chat API
```javascript
const response = await fetch('https://mmrlgagmqvujggzkqtmk.supabase.co/functions/v1/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transcript: "Hello, how are you?",
    personaId: "jane-austen",
    bookId: "pride-and-prejudice"
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value, { stream: true });
  console.log(chunk); // Stream of text chunks
}
```

### TTS API
```javascript
const response = await fetch('https://mmrlgagmqvujggzkqtmk.supabase.co/functions/v1/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "Hello, this is a test of text-to-speech.",
    voiceId: "21m00Tcm4TlvDq8ikWAM"
  })
});

const blob = await response.blob();
const audioUrl = URL.createObjectURL(blob);
```

## Persona and Book Configuration

The chat function currently uses hardcoded personas and books. You can modify these in `supabase/functions/chat/index.ts`:

- **Personas**: Add new personas with their system prompts and voice IDs
- **Books**: Add new books with context information

For production, consider moving this data to your Supabase database.

## Security Notes

- API keys are stored securely as Supabase secrets
- CORS is configured to allow your app's origin
- Functions include proper error handling and logging
- All API calls are proxied through your Supabase project

## Troubleshooting

- **Function not found**: Make sure you've deployed the function using `supabase functions deploy`
- **API key errors**: Check that your secrets are set correctly using `supabase secrets list`
- **CORS issues**: Ensure your app's origin is included in the CORS headers
- **Streaming issues**: Make sure your client is properly handling the streaming response 