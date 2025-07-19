import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Rate limiting utilities (inline for Deno compatibility)
// Note: In production, these would be imported from a shared Deno module

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Valid voice IDs for ElevenLabs (commonly used voices)
const VALID_VOICE_IDS = new Set([
  '21m00Tcm4TlvDq8ikWAM', // Rachel - English female
  'AZnzlk1XvdvUeBnXmlld', // Domi - English female
  'EXAVITQu4vr4xnSDxMaL', // Bella - English female
  'ErXwobaYiN019PkySvjV', // Antoni - English male
  'MF3mGyEYCl7XYWbV9V6O', // Elli - English female
  'TxGEqnHWrfWFTfGW9XjX', // Josh - English male
  'VR6AewLTigWG4xSOukaG', // Arnold - English male
  'pNInz6obpgDQGcFmaJgB', // Adam - English male
  'yoZ06aMxZJJ28mfd3POQ', // Sam - English male
  'pqHfZKP75CvOlQylNhV4', // Bill - English male
])

// Default voice settings for Flash v2.5
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.3,
  use_speaker_boost: true,
}

interface TTSRequest {
  text: string
  voiceId?: string
}

interface UsageLog {
  user_id: string
  function_name: string
  text_length: number
  voice_id: string
  latency_ms: number
  success: boolean
  error_message?: string
  timestamp: string
}

async function logUsage(supabase: any, log: UsageLog) {
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

async function validateVoiceId(voiceId: string, apiKey: string): Promise<boolean> {
  // First check against known valid voice IDs
  if (VALID_VOICE_IDS.has(voiceId)) {
    return true
  }

  // If not in our known set, validate with ElevenLabs API
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    })

    return response.ok
  } catch (error) {
    console.error('Voice validation error:', error)
    return false
  }
}

serve(async (req) => {
  const startTime = Date.now()
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )
  }

  let userId = 'anonymous'
  let requestBody: TTSRequest
  let supabase: any

  try {
    // Initialize Supabase client for usage logging and rate limiting
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (supabaseUrl && supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey)
    }

    // Get user ID from auth header for rate limiting
    const authHeader = req.headers.get('authorization')
    if (authHeader && supabase) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) {
          userId = user.id
        }
      } catch (error) {
        console.warn('Failed to get user from auth token:', error)
      }
    }

    // Get ElevenLabs API key from environment
    const elevenLabsApiKey = Deno.env.get('ELEVEN_LABS_API_KEY')
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured')
    }

    // Parse and validate request body
    try {
      requestBody = await req.json()
    } catch (error) {
      throw new Error('Invalid JSON in request body')
    }

    const { text, voiceId } = requestBody

    // Validate required fields
    if (!text || typeof text !== 'string') {
      throw new Error('Text is required and must be a string')
    }

    if (text.trim().length === 0) {
      throw new Error('Text cannot be empty')
    }

    if (text.length > 5000) {
      throw new Error('Text is too long (maximum 5000 characters)')
    }

    // Use default voice ID if not provided
    const finalVoiceId = voiceId || '21m00Tcm4TlvDq8ikWAM'

    // Validate voice ID
    const isValidVoice = await validateVoiceId(finalVoiceId, elevenLabsApiKey)
    if (!isValidVoice) {
      throw new Error(`Invalid voice ID: ${finalVoiceId}`)
    }

    // Check rate limits (if Supabase is configured)
    if (supabase && userId !== 'anonymous') {
      const rateLimitWindow = 60 * 1000 // 1 minute
      const maxRequestsPerWindow = parseInt(Deno.env.get('TTS_RATE_LIMIT') || '10')
      
      const { data: recentRequests } = await supabase
        .from('usage_logs')
        .select('timestamp')
        .eq('user_id', userId)
        .eq('function_name', 'tts')
        .gte('timestamp', new Date(Date.now() - rateLimitWindow).toISOString())

      if (recentRequests && recentRequests.length >= maxRequestsPerWindow) {
        const retryAfter = Math.ceil(rateLimitWindow / 1000)
        
        // Log rate limit hit
        if (supabase) {
          await logUsage(supabase, {
            user_id: userId,
            function_name: 'tts',
            text_length: text.length,
            voice_id: finalVoiceId,
            latency_ms: Date.now() - startTime,
            success: false,
            error_message: 'Rate limit exceeded',
            timestamp: new Date().toISOString(),
          })
        }

        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded',
            retryAfter: retryAfter 
          }),
          {
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString()
            },
            status: 429,
          }
        )
      }
    }

    // Call ElevenLabs Flash v2.5 streaming API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}/stream`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_flash_v2_5', // Use Flash v2.5 for faster generation
        voice_settings: DEFAULT_VOICE_SETTINGS,
      }),
    })

    if (!response.ok) {
      let errorMessage = `ElevenLabs API error: ${response.status}`
      
      try {
        const errorBody = await response.text()
        console.error('ElevenLabs API error response:', errorBody)
        
        // Parse error details if available
        try {
          const errorJson = JSON.parse(errorBody)
          if (errorJson.detail?.message) {
            errorMessage = errorJson.detail.message
          }
        } catch {
          // Use raw error text if not JSON
          if (errorBody) {
            errorMessage = errorBody
          }
        }
      } catch (error) {
        console.error('Failed to read error response:', error)
      }

      // Handle specific error cases
      if (response.status === 401) {
        errorMessage = 'Invalid ElevenLabs API key'
      } else if (response.status === 429) {
        errorMessage = 'ElevenLabs API rate limit exceeded'
      } else if (response.status === 422) {
        errorMessage = 'Invalid request parameters'
      }

      throw new Error(errorMessage)
    }

    const latencyMs = Date.now() - startTime

    // Log successful usage
    if (supabase) {
      await logUsage(supabase, {
        user_id: userId,
        function_name: 'tts',
        text_length: text.length,
        voice_id: finalVoiceId,
        latency_ms: latencyMs,
        success: true,
        timestamp: new Date().toISOString(),
      })
    }

    // Stream the audio response back with proper headers
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Latency-Ms': latencyMs.toString(),
      },
    })

  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error('TTS function error:', error)

    // Log failed usage
    if (supabase && requestBody) {
      await logUsage(supabase, {
        user_id: userId,
        function_name: 'tts',
        text_length: requestBody.text?.length || 0,
        voice_id: requestBody.voiceId || 'unknown',
        latency_ms: latencyMs,
        success: false,
        error_message: errorMessage,
        timestamp: new Date().toISOString(),
      })
    }

    // Return appropriate error status
    let status = 500
    if (errorMessage.includes('Rate limit')) {
      status = 429
    } else if (errorMessage.includes('Invalid') || errorMessage.includes('required')) {
      status = 400
    } else if (errorMessage.includes('API key')) {
      status = 401
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Latency-Ms': latencyMs.toString()
        },
        status,
      }
    )
  }
})