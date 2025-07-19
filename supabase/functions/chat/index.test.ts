/**
 * Unit tests for Chat Edge Function
 * 
 * Tests the enhanced chat function with mocked OpenAI streaming responses,
 * error handling, rate limiting, and usage logging.
 * 
 * Requirements: 9.1, 9.2
 */

import { assertEquals, assertExists, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// Mock environment variables
Deno.env.set('OPENAI_API_KEY', 'test-openai-key')
Deno.env.set('SUPABASE_URL', 'https://test-project.supabase.co')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
Deno.env.set('CHAT_RATE_LIMIT_PER_HOUR', '100')

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: (token: string) => {
      if (token === 'valid-token') {
        return Promise.resolve({
          data: { user: { id: 'test-user-123' } },
          error: null
        })
      }
      return Promise.resolve({
        data: { user: null },
        error: { message: 'Invalid token' }
      })
    }
  },
  from: (table: string) => ({
    insert: (data: any) => Promise.resolve({ data, error: null })
  })
}

// Mock fetch for OpenAI API
const originalFetch = globalThis.fetch
let mockFetchResponses: Array<{
  url: string
  response: Response
}> = []

function mockFetch(url: string | URL, init?: RequestInit): Promise<Response> {
  const urlString = url.toString()
  
  // Find matching mock response
  const mockResponse = mockFetchResponses.find(mock => 
    urlString.includes(mock.url) || mock.url === '*'
  )
  
  if (mockResponse) {
    return Promise.resolve(mockResponse.response)
  }
  
  // Default to original fetch if no mock found
  return originalFetch(url, init)
}

// Helper to create streaming OpenAI response
function createStreamingResponse(chunks: string[], shouldError = false): Response {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      // Send start chunk
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n'))
      
      // Send content chunks
      chunks.forEach((chunk, index) => {
        setTimeout(() => {
          if (shouldError && index === chunks.length - 1) {
            controller.error(new Error('Stream error'))
            return
          }
          
          const data = JSON.stringify({
            choices: [{
              delta: { content: chunk }
            }]
          })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          
          // Send done signal after last chunk
          if (index === chunks.length - 1) {
            setTimeout(() => {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            }, 10)
          }
        }, index * 10)
      })
    }
  })
  
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' }
  })
}

// Helper to create error response
function createErrorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

// Mock the Supabase import
const originalCreateClient = (await import('https://esm.sh/@supabase/supabase-js@2')).createClient
const mockCreateClient = () => mockSupabaseClient

// Import the function after setting up mocks
globalThis.fetch = mockFetch

// We need to dynamically import and patch the module
const moduleCode = await Deno.readTextFile('./index.ts')
const patchedCode = moduleCode.replace(
  'import { createClient } from \'https://esm.sh/@supabase/supabase-js@2\'',
  ''
)

// Create a test module with our mocked dependencies
const testModule = `
const createClient = () => (${JSON.stringify(mockSupabaseClient)})
${patchedCode}
`

// Write and import the test module
await Deno.writeTextFile('./index.test.module.ts', testModule)
const { default: handler } = await import('./index.test.module.ts')

Deno.test('Chat Function - Successful streaming response', async () => {
  // Setup mock response
  mockFetchResponses = [{
    url: 'chat/completions',
    response: createStreamingResponse(['Hello', ' there', '!'])
  }]
  
  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer valid-token'
    },
    body: JSON.stringify({
      transcript: 'Hello, how are you?',
      personaId: 'jane-austen',
      bookId: 'pride-and-prejudice'
    })
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 200)
  assertEquals(response.headers.get('Content-Type'), 'text/event-stream')
  assertExists(response.body)
  
  // Read the streaming response
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      fullContent += chunk
    }
  } finally {
    reader.releaseLock()
  }
  
  // Verify SSE format
  assertStringIncludes(fullContent, 'data: {"type":"start"}')
  assertStringIncludes(fullContent, 'data: {"type":"content","content":"Hello"}')
  assertStringIncludes(fullContent, 'data: {"type":"content","content":" there"}')
  assertStringIncludes(fullContent, 'data: {"type":"content","content":"!"}')
  assertStringIncludes(fullContent, 'data: {"type":"complete"}')
})

Deno.test('Chat Function - Invalid request body', async () => {
  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: '', // Empty transcript
      personaId: 'jane-austen',
      bookId: 'pride-and-prejudice'
    })
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 400)
  
  const body = await response.json()
  assertStringIncludes(body.error, 'transcript is required and must be a non-empty string')
})

Deno.test('Chat Function - Invalid persona ID', async () => {
  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: 'Hello',
      personaId: 'invalid-persona',
      bookId: 'pride-and-prejudice'
    })
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 400)
  
  const body = await response.json()
  assertStringIncludes(body.error, 'Invalid persona ID: invalid-persona')
  assertStringIncludes(body.error, 'Available personas:')
})

Deno.test('Chat Function - Invalid book ID', async () => {
  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: 'Hello',
      personaId: 'jane-austen',
      bookId: 'invalid-book'
    })
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 400)
  
  const body = await response.json()
  assertStringIncludes(body.error, 'Invalid book ID: invalid-book')
  assertStringIncludes(body.error, 'Available books:')
})

Deno.test('Chat Function - OpenAI API error', async () => {
  // Setup mock error response
  mockFetchResponses = [{
    url: 'chat/completions',
    response: createErrorResponse(401, 'Invalid API key')
  }]
  
  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: 'Hello',
      personaId: 'jane-austen',
      bookId: 'pride-and-prejudice'
    })
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 500)
  
  const body = await response.json()
  assertStringIncludes(body.error, 'Invalid API key')
})

Deno.test('Chat Function - Rate limiting', async () => {
  // Mock rate limit exceeded
  const originalCheckRateLimit = globalThis.checkRateLimit
  globalThis.checkRateLimit = () => Promise.resolve(false)
  
  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: 'Hello',
      personaId: 'jane-austen',
      bookId: 'pride-and-prejudice'
    })
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 429)
  assertEquals(response.headers.get('Retry-After'), '3600')
  
  const body = await response.json()
  assertEquals(body.error, 'Rate limit exceeded')
  assertEquals(body.retryAfter, 3600)
  
  // Restore original function
  globalThis.checkRateLimit = originalCheckRateLimit
})

Deno.test('Chat Function - CORS preflight', async () => {
  const request = new Request('http://localhost:8000', {
    method: 'OPTIONS'
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 200)
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
  assertEquals(
    response.headers.get('Access-Control-Allow-Headers'),
    'authorization, x-client-info, apikey, content-type'
  )
})

Deno.test('Chat Function - Method not allowed', async () => {
  const request = new Request('http://localhost:8000', {
    method: 'GET'
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 405)
  
  const body = await response.json()
  assertEquals(body.error, 'Method not allowed')
})

Deno.test('Chat Function - Missing environment variables', async () => {
  // Temporarily remove environment variables
  const originalOpenAIKey = Deno.env.get('OPENAI_API_KEY')
  Deno.env.delete('OPENAI_API_KEY')
  
  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: 'Hello',
      personaId: 'jane-austen',
      bookId: 'pride-and-prejudice'
    })
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 503)
  
  const body = await response.json()
  assertEquals(body.error, 'Service temporarily unavailable')
  
  // Restore environment variable
  if (originalOpenAIKey) {
    Deno.env.set('OPENAI_API_KEY', originalOpenAIKey)
  }
})

Deno.test('Chat Function - Streaming error handling', async () => {
  // Setup mock response that errors during streaming
  mockFetchResponses = [{
    url: 'chat/completions',
    response: createStreamingResponse(['Hello'], true) // Will error after first chunk
  }]
  
  const request = new Request('http://localhost:8000', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: 'Hello',
      personaId: 'jane-austen',
      bookId: 'pride-and-prejudice'
    })
  })
  
  const response = await handler(request)
  
  assertEquals(response.status, 200) // Initial response is OK
  assertEquals(response.headers.get('Content-Type'), 'text/event-stream')
  
  // The error will be sent as an SSE event
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      fullContent += chunk
    }
  } catch (error) {
    // Stream should error
    assertExists(error)
  } finally {
    reader.releaseLock()
  }
  
  // Should contain error event
  assertStringIncludes(fullContent, '"type":"error"')
})

// Cleanup
Deno.test('Cleanup test files', async () => {
  try {
    await Deno.remove('./index.test.module.ts')
  } catch {
    // File might not exist
  }
  
  // Restore original fetch
  globalThis.fetch = originalFetch
  
  // Clear mock responses
  mockFetchResponses = []
})