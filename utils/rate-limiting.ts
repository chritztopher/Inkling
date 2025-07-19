/**
 * Rate limiting and usage logging utilities for Supabase Edge Functions
 * Provides centralized rate limiting, usage tracking, and analytics
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
export interface RateLimitResult {
  allowed: boolean;
  reason: string;
  limit?: number;
  current?: number;
  retryAfter?: number;
}

export interface UsageLogEntry {
  userId?: string;
  sessionId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs?: number;
  tokensUsed?: number;
  audioDurationMs?: number;
  errorMessage?: string;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  tokensPerMinute?: number;
  tokensPerHour?: number;
  tokensPerDay?: number;
  audioMinutesPerHour?: number;
  audioMinutesPerDay?: number;
  enabled: boolean;
}

/**
 * Initialize Supabase client for rate limiting operations
 * Cached for performance optimization
 */
let cachedSupabaseClient: any = null;

function getSupabaseClient() {
  if (!cachedSupabaseClient) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration for rate limiting');
    }
    
    cachedSupabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  
  return cachedSupabaseClient;
}

/**
 * Extract user ID from JWT token in request headers
 */
export function extractUserId(request: Request): string | null {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || null;
  } catch (error) {
    console.warn('Failed to extract user ID from token:', error);
    return null;
  }
}

/**
 * Extract session ID from request headers or generate one
 */
export function extractSessionId(request: Request): string {
  const sessionId = request.headers.get('X-Session-ID') || 
                   request.headers.get('X-Request-ID') ||
                   crypto.randomUUID();
  return sessionId;
}

/**
 * Extract client IP address from request
 */
export function extractClientIP(request: Request): string | null {
  return request.headers.get('X-Forwarded-For') ||
         request.headers.get('X-Real-IP') ||
         request.headers.get('CF-Connecting-IP') ||
         null;
}

/**
 * Check if request is within rate limits
 */
export async function checkRateLimit(
  endpoint: string,
  userId?: string,
  tokensToUse: number = 0,
  audioDurationMs: number = 0
): Promise<RateLimitResult> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId || null,
      p_endpoint: endpoint,
      p_tokens: tokensToUse,
      p_audio_duration_ms: audioDurationMs
    });
    
    if (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow request if rate limit check fails
      return { allowed: true, reason: 'rate_limit_check_failed' };
    }
    
    return data as RateLimitResult;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow request if rate limit check fails
    return { allowed: true, reason: 'rate_limit_check_error' };
  }
}

/**
 * Log API usage for analytics and monitoring
 */
export async function logUsage(entry: UsageLogEntry): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase.rpc('log_usage', {
      p_user_id: entry.userId || null,
      p_session_id: entry.sessionId || null,
      p_endpoint: entry.endpoint,
      p_method: entry.method,
      p_status_code: entry.statusCode,
      p_latency_ms: entry.latencyMs || null,
      p_tokens_used: entry.tokensUsed || 0,
      p_audio_duration_ms: entry.audioDurationMs || null,
      p_error_message: entry.errorMessage || null,
      p_request_size_bytes: entry.requestSizeBytes || null,
      p_response_size_bytes: entry.responseSizeBytes || null,
      p_ip_address: entry.ipAddress || null,
      p_user_agent: entry.userAgent || null
    });
    
    if (error) {
      console.error('Usage logging failed:', error);
      return null;
    }
    
    return data as string;
  } catch (error) {
    console.error('Usage logging error:', error);
    return null;
  }
}

/**
 * Create rate limit response with proper headers
 */
export function createRateLimitResponse(rateLimitResult: RateLimitResult): Response {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': rateLimitResult.limit?.toString() || '0',
    'X-RateLimit-Remaining': Math.max(0, (rateLimitResult.limit || 0) - (rateLimitResult.current || 0)).toString(),
    'X-RateLimit-Reset': new Date(Date.now() + (rateLimitResult.retryAfter || 60) * 1000).toISOString(),
  });
  
  if (rateLimitResult.retryAfter) {
    headers.set('Retry-After', rateLimitResult.retryAfter.toString());
  }
  
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Rate limit exceeded: ${rateLimitResult.reason}`,
      retryAfter: rateLimitResult.retryAfter,
      limit: rateLimitResult.limit,
      current: rateLimitResult.current
    }),
    {
      status: 429,
      headers
    }
  );
}

/**
 * Middleware wrapper for Edge Functions with rate limiting and usage logging
 */
export function withRateLimiting(
  endpoint: string,
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const startTime = Date.now();
    const userId = extractUserId(request);
    const sessionId = extractSessionId(request);
    const clientIP = extractClientIP(request);
    const userAgent = request.headers.get('User-Agent') || undefined;
    const method = request.method;
    
    let response: Response;
    let tokensUsed = 0;
    let audioDurationMs = 0;
    let errorMessage: string | undefined;
    
    try {
      // Check rate limits before processing request
      const rateLimitResult = await checkRateLimit(endpoint, userId);
      
      if (!rateLimitResult.allowed) {
        // Log rate limit violation
        await logUsage({
          userId,
          sessionId,
          endpoint,
          method,
          statusCode: 429,
          latencyMs: Date.now() - startTime,
          errorMessage: `Rate limit exceeded: ${rateLimitResult.reason}`,
          ipAddress: clientIP,
          userAgent
        });
        
        return createRateLimitResponse(rateLimitResult);
      }
      
      // Process the actual request
      response = await handler(request);
      
      // Extract usage metrics from response headers if available
      tokensUsed = parseInt(response.headers.get('X-Tokens-Used') || '0');
      audioDurationMs = parseInt(response.headers.get('X-Audio-Duration-Ms') || '0');
      
    } catch (error) {
      console.error(`Error in ${endpoint} handler:`, error);
      errorMessage = error instanceof Error ? error.message : String(error);
      
      response = new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: 'An unexpected error occurred'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Log usage regardless of success or failure
    const latencyMs = Date.now() - startTime;
    await logUsage({
      userId,
      sessionId,
      endpoint,
      method,
      statusCode: response.status,
      latencyMs,
      tokensUsed,
      audioDurationMs,
      errorMessage,
      requestSizeBytes: request.headers.get('Content-Length') ? 
        parseInt(request.headers.get('Content-Length')!) : undefined,
      responseSizeBytes: response.headers.get('Content-Length') ? 
        parseInt(response.headers.get('Content-Length')!) : undefined,
      ipAddress: clientIP,
      userAgent
    });
    
    // Add performance headers to response
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Response-Time', `${latencyMs}ms`);
    responseHeaders.set('X-Endpoint', endpoint);
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  };
}

/**
 * Get rate limit configuration for an endpoint
 */
export async function getRateLimitConfig(endpoint: string, userId?: string): Promise<RateLimitConfig | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('rate_limits')
      .select(`
        requests_per_minute,
        requests_per_hour,
        requests_per_day,
        tokens_per_minute,
        tokens_per_hour,
        tokens_per_day,
        audio_minutes_per_hour,
        audio_minutes_per_day,
        enabled
      `)
      .eq('endpoint', endpoint)
      .single();
    
    if (error || !data) {
      console.error('Failed to get rate limit config:', error);
      return null;
    }
    
    return {
      requestsPerMinute: data.requests_per_minute,
      requestsPerHour: data.requests_per_hour,
      requestsPerDay: data.requests_per_day,
      tokensPerMinute: data.tokens_per_minute,
      tokensPerHour: data.tokens_per_hour,
      tokensPerDay: data.tokens_per_day,
      audioMinutesPerHour: data.audio_minutes_per_hour,
      audioMinutesPerDay: data.audio_minutes_per_day,
      enabled: data.enabled
    };
  } catch (error) {
    console.error('Error getting rate limit config:', error);
    return null;
  }
}

/**
 * Estimate token usage for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

/**
 * Calculate audio duration from file size (rough approximation)
 */
export function estimateAudioDuration(fileSizeBytes: number, format: string = 'mp3'): number {
  // Rough approximation based on common bitrates
  const bitrates = {
    'mp3': 128, // kbps
    'wav': 1411, // kbps (uncompressed)
    'ogg': 128, // kbps
    'm4a': 128, // kbps
  };
  
  const bitrate = bitrates[format as keyof typeof bitrates] || 128;
  const durationSeconds = (fileSizeBytes * 8) / (bitrate * 1000);
  return Math.ceil(durationSeconds * 1000); // Convert to milliseconds
}