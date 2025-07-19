# Chat Edge Function

Enhanced chat function that provides streaming AI responses with persona-based system prompts and book context integration.

## Features

- **Streaming Responses**: Real-time text streaming using Server-Sent Events (SSE)
- **Persona System**: Character-based AI responses with distinct voices and personalities
- **Book Context Integration**: Contextual responses based on specific books and literature
- **RAG Retrieval Hook**: Stub implementation for future vector similarity search
- **Rate Limiting**: Per-user request limits via Supabase RLS
- **Usage Logging**: Comprehensive logging for analytics and monitoring
- **Error Handling**: Robust error handling with appropriate HTTP status codes
- **CORS Support**: Cross-origin requests for mobile app integration

## API Specification

### Endpoint
```
POST /chat
```

### Request Headers
```
Content-Type: application/json
Authorization: Bearer <supabase-jwt-token> (optional)
```

### Request Body
```typescript
{
  transcript: string;    // User's spoken input (transcribed text)
  personaId: string;     // ID of the AI persona to use
  bookId: string;        // ID of the book context
}
```

### Response
Streaming response with `Content-Type: text/event-stream`

#### SSE Event Types

**Start Event**
```
data: {"type":"start"}
```

**Content Events** (multiple)
```
data: {"type":"content","content":"Hello"}
data: {"type":"content","content":" there"}
data: {"type":"content","content":"!"}
```

**Complete Event**
```
data: {"type":"complete"}
```

**Error Event**
```
data: {"type":"error","error":"Error message"}
```

## Available Personas

### Jane Austen (`jane-austen`)
- **Voice ID**: `21m00Tcm4TlvDq8ikWAM`
- **Character**: Witty, charming, keen social observations
- **Specialty**: Regency society and human nature

### William Shakespeare (`shakespeare`)
- **Voice ID**: `pNInz6obpgDQGcFmaJgB`
- **Character**: Eloquent, wise, poetic insight
- **Specialty**: Human nature and the arts

## Available Books

### Pride and Prejudice (`pride-and-prejudice`)
- **Author**: Jane Austen
- **Themes**: Love, reputation, social class in Regency England

### Hamlet (`hamlet`)
- **Author**: William Shakespeare
- **Themes**: Revenge, madness, moral corruption

## Environment Variables

### Required
- `OPENAI_API_KEY`: OpenAI API key for GPT-4o access
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

### Optional
- `CHAT_RATE_LIMIT_PER_HOUR`: Rate limit per user per hour (default: 100)

## Error Responses

### 400 Bad Request
```json
{
  "error": "transcript is required and must be a non-empty string",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 405 Method Not Allowed
```json
{
  "error": "Method not allowed"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please wait before trying again.",
  "retryAfter": 3600
}
```

### 500 Internal Server Error
```json
{
  "error": "OpenAI API error: Invalid API key",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 503 Service Unavailable
```json
{
  "error": "Service temporarily unavailable",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Usage Examples

### JavaScript/TypeScript
```typescript
const response = await fetch('/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseToken}`
  },
  body: JSON.stringify({
    transcript: "What do you think about Elizabeth Bennet's character?",
    personaId: 'jane-austen',
    bookId: 'pride-and-prejudice'
  })
});

if (response.ok) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        
        if (data.type === 'content') {
          console.log(data.content); // Stream content to UI
        } else if (data.type === 'complete') {
          console.log('Response complete');
        } else if (data.type === 'error') {
          console.error('Stream error:', data.error);
        }
      }
    }
  }
}
```

### React Native with EventSource
```typescript
const eventSource = new EventSource('/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseToken}`
  },
  body: JSON.stringify({
    transcript: "Tell me about Hamlet's soliloquy",
    personaId: 'shakespeare',
    bookId: 'hamlet'
  })
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'start':
      setIsStreaming(true);
      break;
    case 'content':
      setResponse(prev => prev + data.content);
      break;
    case 'complete':
      setIsStreaming(false);
      break;
    case 'error':
      setError(data.error);
      break;
  }
};
```

## Future Enhancements

### RAG Integration
The `retrieveChunks()` function is currently a stub that will be enhanced to:
1. Convert user queries to embeddings using OpenAI embeddings API
2. Perform vector similarity search in Supabase pgvector
3. Return top 6 relevant book passages with similarity scores
4. Integrate passages naturally into persona responses

### Usage Analytics
The usage logging system will track:
- User ID and request patterns
- Token consumption (input/output)
- Response latency metrics
- Error rates and types
- Popular personas and books

### Rate Limiting
Enhanced rate limiting will include:
- Supabase RLS policies for per-user limits
- Configurable limits by user tier
- Graceful degradation for rate-limited users
- Usage-based billing integration

## Testing

Run the test suite:
```bash
deno test --allow-net --allow-read --allow-write --allow-env supabase/functions/chat/index.test.ts
```

The tests cover:
- Successful streaming responses
- Input validation and error handling
- Rate limiting behavior
- CORS preflight requests
- OpenAI API error scenarios
- Streaming error recovery
- Environment configuration validation

## Performance Considerations

- **Streaming**: Immediate response start reduces perceived latency
- **Token Limits**: 500 token max response to control costs and latency
- **Connection Management**: Proper stream cleanup and error handling
- **Rate Limiting**: Prevents abuse and controls API costs
- **Caching**: Future implementation will cache persona/book metadata

## Security

- **API Keys**: All external API keys stored as Supabase Function secrets
- **Authentication**: Optional JWT token validation for user identification
- **Rate Limiting**: Prevents abuse and DoS attacks
- **Input Validation**: Comprehensive request validation and sanitization
- **Error Handling**: No sensitive information leaked in error responses