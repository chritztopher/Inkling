import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Rate limiting utilities (inline for Deno compatibility)
// Note: In production, these would be imported from a shared Deno module

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Supported audio formats
const SUPPORTED_AUDIO_FORMATS = [
  'audio/webm',
  'audio/mp3', 
  'audio/mpeg',
  'audio/wav',
  'audio/m4a',
  'audio/mp4',
  'audio/ogg',
  'audio/flac'
]

// File size limits (25MB max for OpenAI Whisper)
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

// Configuration
interface UsageLog {
  userId: string
  path: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  timestamp: string
  success: boolean
  errorCode?: string
}

/**
 * Get user ID from request headers
 */
function getUserId(req: Request): string {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return 'anonymous'
  
  // Extract user ID from JWT token (simplified)
  try {
    const token = authHeader.replace('Bearer ', '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub || 'anonymous'
  } catch {
    return 'anonymous'
  }
}



/**
 * Validate audio file
 */
function validateAudioFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No audio file provided' }
  }
  
  if (file.size === 0) {
    return { valid: false, error: 'Audio file is empty' }
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Audio file too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` }
  }
  
  if (!SUPPORTED_AUDIO_FORMATS.includes(file.type)) {
    return { 
      valid: false, 
      error: `Unsupported audio format: ${file.type}. Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}` 
    }
  }
  
  return { valid: true }
}

/**
 * Log usage for analytics
 */
async function logUsage(supabase: any, log: UsageLog): Promise<void> {
  try {
    const { error } = await supabase
      .from('usage_logs')
      .insert([log])
    
    if (error) {
      console.error('Failed to log usage:', error)
    }
  } catch (error) {
    console.error('Usage logging error:', error)
  }
}

/**
 * Call OpenAI Whisper API with retry logic
 */
async function transcribeWithOpenAI(
  apiKey: string, 
  audioFile: File,
  signal?: AbortSignal
): Promise<{ text: string; duration?: number }> {
  const maxRetries = 2
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData()
      formData.append('file', audioFile, audioFile.name || 'audio.webm')
      formData.append('model', 'whisper-1')
      formData.append('response_format', 'verbose_json')
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `OpenAI API error: ${response.status}`
        
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error?.message || errorMessage
        } catch {
          // Use default error message
        }
        
        // Don't retry on client errors (4xx except 408, 429)
        if (response.status >= 400 && response.status < 500 && 
            response.status !== 408 && response.status !== 429) {
          throw new Error(errorMessage)
        }
        
        throw new Error(errorMessage)
      }

      const result = await response.json()
      return {
        text: result.text || '',
        duration: result.duration
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on abort or client errors
      if (error instanceof Error && 
          (error.name === 'AbortError' || error.message.includes('400'))) {
        throw lastError
      }
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // Exponential backoff: 1s, 2s
      const delayMs = 1000 * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  throw lastError!
}

serve(async (req) => {
  const startTime = Date.now()
  let userId = 'anonymous'
  let success = false
  let errorCode: string | undefined
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ 
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )
  }

  try {
    // Get user ID for rate limiting and logging
    userId = getUserId(req)
    
    // Rate limiting is now handled by the withRateLimiting middleware

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      errorCode = 'CONFIGURATION_ERROR'
      throw new Error('OpenAI API key not configured')
    }

    // Parse multipart form data with error handling
    let formData: FormData
    try {
      formData = await req.formData()
    } catch (error) {
      errorCode = 'INVALID_FORM_DATA'
      throw new Error('Invalid multipart form data')
    }

    const audioFile = formData.get('file') as File
    
    // Validate audio file
    const validation = validateAudioFile(audioFile)
    if (!validation.valid) {
      errorCode = 'INVALID_AUDIO_FILE'
      throw new Error(validation.error!)
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 30000) // 30 second timeout

    try {
      // Call OpenAI Whisper API
      const result = await transcribeWithOpenAI(
        openaiApiKey,
        audioFile,
        controller.signal
      )
      
      clearTimeout(timeoutId)
      success = true
      
      // Log successful usage
      const latencyMs = Date.now() - startTime
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)
        await logUsage(supabase, {
          userId,
          path: '/whisper',
          tokensIn: Math.ceil(audioFile.size / 1000), // Approximate tokens based on file size
          tokensOut: Math.ceil(result.text.length / 4), // Approximate tokens
          latencyMs,
          timestamp: new Date().toISOString(),
          success: true
        })
      }
      
      return new Response(
        JSON.stringify({ 
          text: result.text,
          duration: result.duration 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
      
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        errorCode = 'REQUEST_TIMEOUT'
        throw new Error('Request timeout. Please try with a shorter audio file.')
      }
      
      throw error
    }

  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    // Log failed usage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey)
        await logUsage(supabase, {
          userId,
          path: '/whisper',
          tokensIn: 0,
          tokensOut: 0,
          latencyMs,
          timestamp: new Date().toISOString(),
          success: false,
          errorCode
        })
      } catch (logError) {
        console.error('Failed to log error usage:', logError)
      }
    }
    
    console.error('Whisper function error:', {
      error: errorMessage,
      userId,
      latencyMs,
      errorCode
    })
    
    // Determine appropriate status code
    let statusCode = 500
    if (errorCode === 'RATE_LIMIT_EXCEEDED') statusCode = 429
    else if (errorCode === 'INVALID_AUDIO_FILE' || errorCode === 'INVALID_FORM_DATA') statusCode = 400
    else if (errorCode === 'CONFIGURATION_ERROR') statusCode = 503
    else if (errorCode === 'REQUEST_TIMEOUT') statusCode = 408
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        code: errorCode || 'INTERNAL_ERROR'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    )
  }
})