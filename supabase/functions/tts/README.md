# TTS Edge Function

Text-to-Speech conversion using ElevenLabs Flash v2.5 streaming API with comprehensive error handling, voice validation, rate limiting, and usage logging.

## Features

- **ElevenLabs Flash v2.5 Integration**: Uses the latest Flash model for faster TTS generation
- **Streaming Audio Response**: Streams audio/mpeg directly to client for immediate playback
- **Voice ID Validation**: Validates voice IDs against known voices and ElevenLabs API
- **Rate Limiting**: Per-user rate limiting via Supabase Row-Level Security
- **Usage Logging**: Comprehensive logging for analytics and monitoring
- **Error Handling**: Detailed error responses with appropriate HTTP status codes
- **CORS Support**: Full CORS support for cross-origin requests

## API Specification

### Endpoint
```
POST /tts
```

### Request Headers
```
Content-Type: application/json
Authorization: Bearer <supabase-jwt-token> (optional, for rate limiting)
```

### Request Body
```json
{
  "text": "Text to convert to speech",
  "voiceId": "21m00Tcm4TlvDq8ikWAM" // Optional, defaults to Rachel
}
```

### Response

#### Success (200 OK)
```
Content-Type: audio/mpeg
Cache-Control: no-cache
Connection: keep-alive
X-Latency-Ms: 150

<streaming audio data>
```

#### Error Responses

**400 Bad Request**
```json
{
  "error": "Text is required and must be a string",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**401 Unauthorized**
```json
{
  "error": "Invalid ElevenLabs API key",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**429 Too Many Requests**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Voice IDs

### Supported Voices

| Voice ID | Name | Gender | Language |
|----------|------|--------|----------|
| `21m00Tcm4TlvDq8ikWAM` | Rachel | Female | English |
| `AZnzlk1XvdvUeBnXmlld` | Domi | Female | English |
| `EXAVITQu4vr4xnSDxMaL` | Bella | Female | English |
| `ErXwobaYiN019PkySvjV` | Antoni | Male | English |
| `MF3mGyEYCl7XYWbV9V6O` | Elli | Female | English |
| `TxGEqnHWrfWFTfGW9XjX` | Josh | Male | English |
| `VR6AewLTigWG4xSOukaG` | Arnold | Male | English |
| `pNInz6obpgDQGcFmaJgB` | Adam | Male | English |
| `yoZ06aMxZJJ28mfd3POQ` | Sam | Male | English |
| `pqHfZKP75CvOlQylNhV4` | Bill | Male | English |

### Voice Settings

The function uses optimized voice settings for Flash v2.5:

```json
{
  "stability": 0.5,
  "similarity_boost": 0.75,
  "style": 0.3,
  "use_speaker_boost": true
}
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ELEVEN_LABS_API_KEY` | Yes | ElevenLabs API key |
| `SUPABASE_URL` | Optional | Supabase project URL (for logging) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase service key (for logging) |
| `TTS_RATE_LIMIT` | Optional | Requests per minute per user (default: 10) |

### Rate Limiting

- **Window**: 1 minute
- **Default Limit**: 10 requests per user per minute
- **Anonymous Users**: No rate limiting (relies on ElevenLabs limits)
- **Authenticated Users**: Per-user limits via Supabase RLS

## Usage Examples

### Basic Usage
```javascript
const response = await fetch('/tts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'Hello, this is a test of the text-to-speech system.'
  })
});

if (response.ok) {
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.play();
}
```

### With Custom Voice
```javascript
const response = await fetch('/tts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseToken}`
  },
  body: JSON.stringify({
    text: 'This will use Josh\'s voice.',
    voiceId: 'TxGEqnHWrfWFTfGW9XjX'
  })
});
```

### Streaming Playback
```javascript
const response = await fetch('/tts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: 'This audio will start playing immediately as it streams.'
  })
});

if (response.ok && response.body) {
  const reader = response.body.getReader();
  const chunks = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    chunks.push(value);
    
    // Start playing as soon as we have some data
    if (chunks.length === 1) {
      const audioBlob = new Blob([value], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  }
}
```

## Error Handling

### Client-Side Error Handling
```javascript
async function synthesizeSpeech(text, voiceId) {
  try {
    const response = await fetch('/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voiceId })
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limited. Retry after ${retryAfter} seconds.`);
      }
      
      throw new Error(error.error || 'TTS request failed');
    }

    return await response.blob();
  } catch (error) {
    console.error('TTS Error:', error);
    throw error;
  }
}
```

### Common Error Scenarios

1. **Invalid Text**: Empty or non-string text
2. **Text Too Long**: Text exceeds 5000 characters
3. **Invalid Voice ID**: Voice ID not found in ElevenLabs
4. **Rate Limited**: Too many requests from user
5. **API Key Issues**: Invalid or missing ElevenLabs API key
6. **Network Errors**: Connection issues with ElevenLabs

## Performance

### Latency Targets
- **First Audio Byte**: < 300ms (requirement 4.4)
- **Total Processing**: Varies by text length
- **Streaming Start**: Immediate upon first bytes

### Optimization Features
- **Flash v2.5 Model**: Fastest ElevenLabs model
- **Streaming Response**: No buffering delay
- **Connection Keep-Alive**: Reduces connection overhead
- **Efficient Voice Validation**: Cached known voices

## Monitoring and Logging

### Usage Logs
The function logs detailed usage information to Supabase:

```sql
CREATE TABLE usage_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  function_name TEXT NOT NULL,
  text_length INTEGER NOT NULL,
  voice_id TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Metrics Tracked
- **User ID**: For rate limiting and analytics
- **Text Length**: For cost analysis
- **Voice ID**: For voice usage patterns
- **Latency**: For performance monitoring
- **Success Rate**: For reliability tracking
- **Error Messages**: For debugging

### Log Analysis Queries

**Average latency by voice:**
```sql
SELECT voice_id, AVG(latency_ms) as avg_latency_ms
FROM usage_logs 
WHERE function_name = 'tts' AND success = true
GROUP BY voice_id;
```

**Error rate by hour:**
```sql
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE success = false) as errors,
  (COUNT(*) FILTER (WHERE success = false) * 100.0 / COUNT(*)) as error_rate
FROM usage_logs 
WHERE function_name = 'tts'
GROUP BY hour
ORDER BY hour DESC;
```

## Testing

### Unit Tests
```bash
# Run Deno tests
deno test supabase/functions/tts/index.test.ts

# Run Jest tests
npm test supabase/functions/tts/tts.test.js
```

### Test Coverage
- ✅ CORS handling
- ✅ Request validation
- ✅ Voice ID validation
- ✅ ElevenLabs API integration
- ✅ Streaming response handling
- ✅ Error scenarios
- ✅ Rate limiting
- ✅ Usage logging
- ✅ Performance requirements

### Manual Testing
```bash
# Test basic functionality
curl -X POST http://localhost:54321/functions/v1/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world"}' \
  --output test_audio.mp3

# Test with custom voice
curl -X POST http://localhost:54321/functions/v1/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Testing custom voice", "voiceId": "TxGEqnHWrfWFTfGW9XjX"}' \
  --output test_audio_josh.mp3

# Test error handling
curl -X POST http://localhost:54321/functions/v1/tts \
  -H "Content-Type: application/json" \
  -d '{"text": ""}' \
  -v
```

## Security Considerations

### API Key Protection
- ElevenLabs API key stored as Supabase Function secret
- Never exposed to client-side code
- Rotatable through environment updates

### Rate Limiting
- Per-user limits prevent abuse
- Anonymous users rely on ElevenLabs limits
- Configurable limits via environment variables

### Input Validation
- Text length limits prevent excessive usage
- Voice ID validation prevents invalid requests
- JSON parsing with error handling

### CORS Configuration
- Allows cross-origin requests for web apps
- Configurable origins (currently allows all)
- Proper preflight handling

## Deployment

### Supabase CLI
```bash
# Deploy function
supabase functions deploy tts

# Set environment variables
supabase secrets set ELEVEN_LABS_API_KEY=your_api_key_here
supabase secrets set TTS_RATE_LIMIT=10
```

### Environment Setup
1. Get ElevenLabs API key from [ElevenLabs Dashboard](https://elevenlabs.io/app/settings/api-keys)
2. Set up Supabase project with usage_logs table
3. Configure rate limiting policies
4. Deploy function with secrets

## Troubleshooting

### Common Issues

**"ElevenLabs API key not configured"**
- Ensure `ELEVEN_LABS_API_KEY` is set in Supabase secrets
- Verify API key is valid in ElevenLabs dashboard

**"Invalid voice ID"**
- Check voice ID against supported voices list
- Verify voice exists in your ElevenLabs account

**"Rate limit exceeded"**
- Wait for rate limit window to reset
- Check `TTS_RATE_LIMIT` configuration
- Verify user authentication for per-user limits

**Audio playback issues**
- Ensure `Content-Type: audio/mpeg` is handled correctly
- Check browser audio codec support
- Verify streaming response handling

### Debug Mode
Enable detailed logging by checking function logs:
```bash
supabase functions logs tts
```

## Requirements Compliance

This implementation satisfies the following requirements:

- **4.1**: ✅ Accepts text and voiceId parameters
- **4.2**: ✅ Uses ElevenLabs Flash v2.5 stream endpoint
- **4.3**: ✅ Pipes audio/mpeg bytes directly to client
- **4.4**: ✅ Starts streaming immediately without buffering
- **4.5**: ✅ Provides fallback error handling
- **6.1**: ✅ Logs userId, path, tokensIn, tokensOut, and latencyMs
- **6.2**: ✅ Enforces Row-Level Security rate limits
- **6.3**: ✅ Returns 429 status with appropriate headers
- **9.1**: ✅ Provides deterministic Jest mocks for testing
- **9.3**: ✅ All external service calls are mockable