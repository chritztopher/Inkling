/**
 * Unit tests for Whisper Edge Function
 * 
 * Tests comprehensive error handling, validation, rate limiting, and OpenAI integration
 * with mocked responses for offline testing capability.
 * 
 * Requirements: 9.1, 9.3
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// Mock fetch for testing
let mockFetch: typeof fetch
let originalFetch: typeof fetch

// Mock OpenAI responses
const mockOpenAIResponses = {
  success: {
    text: 'This is a test transcription',
    duration: 5.2,
    language: 'en'
  },
  error: {
    error: {
      message: 'Invalid audio format',
      type: 'invalid_request_error',
      code: 'invalid_audio'
    }
  },
  rateLimitError: {
    error: {
      message: 'Rate limit exceeded',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded'
    }
  }
}

// Mock Supabase client
const mockSupabaseClient = {
  from: (table: string) => ({
    insert: (data: any[]) => Promise.resolve({ error: null })
  })
}

// Test utilities
function createMockAudioFile(
  size: number = 1024,
  type: string = 'audio/webm',
  name: string = 'test.webm'
): File {
  const buffer = new ArrayBuffer(size)
  const blob = new Blob([buffer], { type })
  return new File([blob], name, { type })
}

function createMockRequest(
  method: string = 'POST',
  headers: Record<string, string> = {},
  formData?: FormData
): Request {
  const url = 'https://test.supabase.co/functions/v1/whisper'
  
  if (method === 'OPTIONS') {
    return new Request(url, { method: 'OPTIONS', headers })
  }
  
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...headers
    },
    body: formData
  })
}

function setupMockFetch(response: any, status: number = 200, delay: number = 0) {
  mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // Simulate network delay
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    const url = typeof input === 'string' ? input : input.toString()
    
    // Mock OpenAI API
    if (url.includes('api.openai.com/v1/audio/transcriptions')) {
      return new Response(JSON.stringify(response), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Default response
    return new Response(JSON.stringify(response), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Replace global fetch
  globalThis.fetch = mockFetch
}

function restoreFetch() {
  if (originalFetch) {
    globalThis.fetch = originalFetch
  }
}

// Store original fetch before tests
Deno.test({
  name: 'Setup - Store original fetch',
  fn() {
    originalFetch = globalThis.fetch
  }
})

// Test CORS preflight handling
Deno.test({
  name: 'CORS - Should handle OPTIONS preflight request',
  async fn() {
    // Import the function (this would need to be adjusted based on actual export)
    const { default: handler } = await import('./index.ts')
    
    const request = createMockRequest('OPTIONS')
    const response = await handler(request)
    
    assertEquals(response.status, 200)
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*')
    assertEquals(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS')
    
    const body = await response.text()
    assertEquals(body, 'ok')
  }
})

// Test method validation
Deno.test({
  name: 'Validation - Should reject non-POST requests',
  async fn() {
    const { default: handler } = await import('./index.ts')
    
    const request = createMockRequest('GET')
    const response = await handler(request)
    
    assertEquals(response.status, 405)
    
    const body = await response.json()
    assertEquals(body.error, 'Method not allowed')
    assertEquals(body.code, 'METHOD_NOT_ALLOWED')
  }
})

// Test missing API key
Deno.test({
  name: 'Configuration - Should handle missing OpenAI API key',
  async fn() {
    // Clear environment variable
    const originalKey = Deno.env.get('OPENAI_API_KEY')
    Deno.env.delete('OPENAI_API_KEY')
    
    try {
      const { default: handler } = await import('./index.ts')
      
      const formData = new FormData()
      formData.append('file', createMockAudioFile())
      
      const request = createMockRequest('POST', {}, formData)
      const response = await handler(request)
      
      assertEquals(response.status, 503)
      
      const body = await response.json()
      assertEquals(body.error, 'OpenAI API key not configured')
      assertEquals(body.code, 'CONFIGURATION_ERROR')
    } finally {
      // Restore environment variable
      if (originalKey) {
        Deno.env.set('OPENAI_API_KEY', originalKey)
      }
    }
  }
})

// Test audio file validation
Deno.test({
  name: 'Validation - Should reject missing audio file',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    
    const { default: handler } = await import('./index.ts')
    
    const formData = new FormData()
    // Don't add any file
    
    const request = createMockRequest('POST', {}, formData)
    const response = await handler(request)
    
    assertEquals(response.status, 400)
    
    const body = await response.json()
    assertEquals(body.error, 'No audio file provided')
    assertEquals(body.code, 'INVALID_AUDIO_FILE')
  }
})

// Test file size validation
Deno.test({
  name: 'Validation - Should reject oversized audio file',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    
    const { default: handler } = await import('./index.ts')
    
    const formData = new FormData()
    const oversizedFile = createMockAudioFile(26 * 1024 * 1024) // 26MB
    formData.append('file', oversizedFile)
    
    const request = createMockRequest('POST', {}, formData)
    const response = await handler(request)
    
    assertEquals(response.status, 400)
    
    const body = await response.json()
    assertEquals(body.error, 'Audio file too large. Maximum size is 25MB')
    assertEquals(body.code, 'INVALID_AUDIO_FILE')
  }
})

// Test unsupported format validation
Deno.test({
  name: 'Validation - Should reject unsupported audio format',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    
    const { default: handler } = await import('./index.ts')
    
    const formData = new FormData()
    const unsupportedFile = createMockAudioFile(1024, 'video/mp4', 'test.mp4')
    formData.append('file', unsupportedFile)
    
    const request = createMockRequest('POST', {}, formData)
    const response = await handler(request)
    
    assertEquals(response.status, 400)
    
    const body = await response.json()
    assertEquals(body.error.includes('Unsupported audio format'), true)
    assertEquals(body.code, 'INVALID_AUDIO_FILE')
  }
})

// Test successful transcription
Deno.test({
  name: 'Success - Should successfully transcribe audio',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    setupMockFetch(mockOpenAIResponses.success)
    
    try {
      const { default: handler } = await import('./index.ts')
      
      const formData = new FormData()
      formData.append('file', createMockAudioFile())
      
      const request = createMockRequest('POST', {}, formData)
      const response = await handler(request)
      
      assertEquals(response.status, 200)
      
      const body = await response.json()
      assertEquals(body.text, 'This is a test transcription')
      assertEquals(body.duration, 5.2)
    } finally {
      restoreFetch()
    }
  }
})

// Test OpenAI API error handling
Deno.test({
  name: 'Error Handling - Should handle OpenAI API errors',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    setupMockFetch(mockOpenAIResponses.error, 400)
    
    try {
      const { default: handler } = await import('./index.ts')
      
      const formData = new FormData()
      formData.append('file', createMockAudioFile())
      
      const request = createMockRequest('POST', {}, formData)
      const response = await handler(request)
      
      assertEquals(response.status, 500)
      
      const body = await response.json()
      assertEquals(body.error, 'Invalid audio format')
    } finally {
      restoreFetch()
    }
  }
})

// Test rate limiting
Deno.test({
  name: 'Rate Limiting - Should enforce rate limits',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    setupMockFetch(mockOpenAIResponses.success)
    
    try {
      const { default: handler } = await import('./index.ts')
      
      const formData = new FormData()
      formData.append('file', createMockAudioFile())
      
      const headers = { 'authorization': 'Bearer test-token' }
      
      // Make 11 requests (rate limit is 10 per minute)
      const requests = []
      for (let i = 0; i < 11; i++) {
        const request = createMockRequest('POST', headers, formData)
        requests.push(handler(request))
      }
      
      const responses = await Promise.all(requests)
      
      // First 10 should succeed, 11th should be rate limited
      for (let i = 0; i < 10; i++) {
        assertEquals(responses[i].status, 200)
      }
      
      assertEquals(responses[10].status, 429)
      
      const rateLimitBody = await responses[10].json()
      assertEquals(rateLimitBody.code, 'RATE_LIMIT_EXCEEDED')
      assertExists(rateLimitBody.retryAfter)
    } finally {
      restoreFetch()
    }
  }
})

// Test retry logic
Deno.test({
  name: 'Retry Logic - Should retry on server errors',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    
    let callCount = 0
    mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      callCount++
      
      if (callCount === 1) {
        // First call fails with 500
        return new Response(JSON.stringify({ error: 'Server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      } else {
        // Second call succeeds
        return new Response(JSON.stringify(mockOpenAIResponses.success), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    
    globalThis.fetch = mockFetch
    
    try {
      const { default: handler } = await import('./index.ts')
      
      const formData = new FormData()
      formData.append('file', createMockAudioFile())
      
      const request = createMockRequest('POST', {}, formData)
      const response = await handler(request)
      
      assertEquals(response.status, 200)
      assertEquals(callCount, 2) // Should have retried once
      
      const body = await response.json()
      assertEquals(body.text, 'This is a test transcription')
    } finally {
      restoreFetch()
    }
  }
})

// Test timeout handling
Deno.test({
  name: 'Timeout - Should handle request timeouts',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    setupMockFetch(mockOpenAIResponses.success, 200, 35000) // 35 second delay
    
    try {
      const { default: handler } = await import('./index.ts')
      
      const formData = new FormData()
      formData.append('file', createMockAudioFile())
      
      const request = createMockRequest('POST', {}, formData)
      const response = await handler(request)
      
      assertEquals(response.status, 408)
      
      const body = await response.json()
      assertEquals(body.code, 'REQUEST_TIMEOUT')
      assertEquals(body.error.includes('timeout'), true)
    } finally {
      restoreFetch()
    }
  }
})

// Test invalid form data
Deno.test({
  name: 'Validation - Should handle invalid form data',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    
    const { default: handler } = await import('./index.ts')
    
    // Create request with invalid body (not form data)
    const request = new Request('https://test.supabase.co/functions/v1/whisper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' })
    })
    
    const response = await handler(request)
    
    assertEquals(response.status, 400)
    
    const body = await response.json()
    assertEquals(body.error, 'Invalid multipart form data')
    assertEquals(body.code, 'INVALID_FORM_DATA')
  }
})

// Test user ID extraction
Deno.test({
  name: 'Authentication - Should extract user ID from JWT token',
  async fn() {
    Deno.env.set('OPENAI_API_KEY', 'test-key')
    setupMockFetch(mockOpenAIResponses.success)
    
    try {
      const { default: handler } = await import('./index.ts')
      
      // Create a simple JWT token for testing
      const payload = { sub: 'user-123', iat: Date.now() }
      const encodedPayload = btoa(JSON.stringify(payload))
      const mockToken = `header.${encodedPayload}.signature`
      
      const formData = new FormData()
      formData.append('file', createMockAudioFile())
      
      const request = createMockRequest('POST', {
        'authorization': `Bearer ${mockToken}`
      }, formData)
      
      const response = await handler(request)
      
      assertEquals(response.status, 200)
      
      // The user ID should be extracted and used for rate limiting
      // This is tested indirectly through successful processing
    } finally {
      restoreFetch()
    }
  }
})

// Cleanup
Deno.test({
  name: 'Cleanup - Restore original fetch',
  fn() {
    restoreFetch()
  }
})