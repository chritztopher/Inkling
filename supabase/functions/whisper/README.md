# Whisper Edge Function

A Supabase Edge Function that provides speech-to-text transcription using OpenAI's Whisper API with comprehensive error handling, rate limiting, and usage analytics.

## Features

- **Multipart Form Handling**: Accepts audio files via multipart/form-data
- **Audio Format Validation**: Supports webm, mp3, mpeg, wav, m4a, mp4, ogg, flac
- **File Size Validation**: Maximum 25MB file size limit
- **Rate Limiting**: 10 requests per minute per user
- **Retry Logic**: Exponential backoff for transient failures
- **CORS Support**: Proper cross-origin request handling
- **Usage Analytics**: Structured logging for monitoring
- **Error Handling**: Comprehensive error responses with codes
- **Timeout Protection**: 30-second request timeout

## API Specification

### Endpoint
```
POST /functions/v1/whisper
```

### Request Format
```http
POST /functions/v1/whisper
Content-Type: multipart/form-data
Authorization: Bearer <supabase-anon-key>

file: <audio-file>
```

### Response Format

#### Success Response (200)
```json
{
  "text": "Transcribed text from the audio file",
  "duration": 5.2
}
```

#### Error Response (4xx/5xx)
```json
{
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE"
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `METHOD_NOT_ALLOWED` | 405 | Only POST requests are allowed |
| `INVALID_FORM_DATA` | 400 | Request body is not valid multipart form data |
| `INVALID_AUDIO_FILE` | 400 | Audio file validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests, includes `Retry-After` header |
| `CONFIGURATION_ERROR` | 503 | Server configuration issue |
| `REQUEST_TIMEOUT` | 408 | Request took longer than 30 seconds |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Supported Audio Formats

- `audio/webm` - WebM audio format
- `audio/mp3` - MP3 audio format  
- `audio/mpeg` - MPEG audio format
- `audio/wav` - WAV audio format
- `audio/m4a` - M4A audio format
- `audio/mp4` - MP4 audio format
- `audio/ogg` - OGG audio format
- `audio/flac` - FLAC audio format

## Rate Limiting

- **Window**: 1 minute (60 seconds)
- **Limit**: 10 requests per user per window
- **Identification**: Based on JWT token in Authorization header
- **Response**: 429 status with `Retry-After` header when exceeded

## Environment Variables

The function requires the following environment variables to be set in Supabase:

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for Whisper access | Yes |
| `SUPABASE_URL` | Supabase project URL | Optional* |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for usage logging | Optional* |

*Required for usage analytics logging

## Usage Analytics

When properly configured, the function logs usage data to a `usage_logs` table:

```sql
CREATE TABLE usage_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  path TEXT NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  success BOOLEAN NOT NULL,
  error_code TEXT
);
```

## Example Usage

### JavaScript/TypeScript
```javascript
const transcribeAudio = async (audioFile) => {
  const formData = new FormData()
  formData.append('file', audioFile)
  
  const response = await fetch('/functions/v1/whisper', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: formData
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Transcription failed: ${error.error}`)
  }
  
  const result = await response.json()
  return result.text
}
```

### React Native
```javascript
import * as FileSystem from 'expo-file-system'

const transcribeRecording = async (recordingUri) => {
  const formData = new FormData()
  formData.append('file', {
    uri: recordingUri,
    type: 'audio/webm',
    name: 'recording.webm'
  })
  
  const response = await fetch(`${supabaseUrl}/functions/v1/whisper`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: formData
  })
  
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error)
  }
  
  return result.text
}
```

## Testing

The function includes comprehensive unit tests covering:

- CORS preflight handling
- Request method validation
- Audio file validation (size, format, presence)
- OpenAI API integration and error handling
- Rate limiting logic
- Retry mechanisms
- Error response formatting
- Usage logging structure
- JWT token parsing

Run tests with:
```bash
npm run test:whisper
```

## Deployment

Deploy to Supabase using the Supabase CLI:

```bash
supabase functions deploy whisper
```

Set required environment variables:
```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key
```

## Performance Characteristics

- **Target Latency**: < 400ms for typical audio files
- **File Size Limit**: 25MB maximum
- **Timeout**: 30 seconds maximum processing time
- **Concurrency**: Handles multiple concurrent requests
- **Memory Usage**: Optimized for serverless environment

## Security Considerations

- API keys are stored securely as Supabase secrets
- No sensitive data is logged or exposed
- Rate limiting prevents abuse
- CORS headers properly configured
- Input validation prevents malicious uploads
- JWT token validation for user identification

## Monitoring

The function provides structured logging for monitoring:

- Request/response latency tracking
- Error rate monitoring
- Usage analytics collection
- Rate limiting metrics
- OpenAI API call tracking

## Requirements Satisfied

This implementation satisfies the following requirements:

- **2.1**: Accepts multipart audio format
- **2.2**: Forwards to OpenAI Whisper API
- **2.3**: Returns structured JSON with text field
- **2.4**: Comprehensive error handling with retry capability
- **2.5**: Rate limiting to prevent abuse
- **6.1**: Usage logging with userId, path, tokens, and latency
- **6.2**: Row-Level Security rate limits
- **6.3**: 429 responses with appropriate headers
- **7.4**: Proper CORS headers for cross-origin requests
- **9.1**: Deterministic Jest mocks for testing
- **9.3**: Offline testing capability with mocked responses