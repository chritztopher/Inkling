-- Usage logging and rate limiting tables for voice conversation loop

-- Create usage_logs table for tracking API usage
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  status_code INTEGER NOT NULL,
  latency_ms INTEGER,
  tokens_used INTEGER DEFAULT 0,
  audio_duration_ms INTEGER,
  error_message TEXT,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_endpoint ON usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_endpoint_time ON usage_logs(user_id, endpoint, created_at);

-- Create rate_limits table for configurable rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  requests_per_minute INTEGER NOT NULL DEFAULT 60,
  requests_per_hour INTEGER NOT NULL DEFAULT 1000,
  requests_per_day INTEGER NOT NULL DEFAULT 10000,
  tokens_per_minute INTEGER DEFAULT 10000,
  tokens_per_hour INTEGER DEFAULT 100000,
  tokens_per_day INTEGER DEFAULT 1000000,
  audio_minutes_per_hour INTEGER DEFAULT 60,
  audio_minutes_per_day INTEGER DEFAULT 300,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default rate limits for each endpoint
INSERT INTO rate_limits (endpoint, requests_per_minute, requests_per_hour, requests_per_day, tokens_per_minute, tokens_per_hour, tokens_per_day, audio_minutes_per_hour, audio_minutes_per_day) VALUES
  ('whisper', 30, 500, 2000, 5000, 50000, 200000, 30, 120),
  ('chat', 60, 1000, 5000, 10000, 100000, 500000, NULL, NULL),
  ('tts', 40, 800, 3000, 8000, 80000, 300000, 60, 240)
ON CONFLICT (endpoint) DO NOTHING;

-- Create user_rate_limit_overrides table for per-user customization
CREATE TABLE IF NOT EXISTS user_rate_limit_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  requests_per_minute INTEGER,
  requests_per_hour INTEGER,
  requests_per_day INTEGER,
  tokens_per_minute INTEGER,
  tokens_per_hour INTEGER,
  tokens_per_day INTEGER,
  audio_minutes_per_hour INTEGER,
  audio_minutes_per_day INTEGER,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Create indexes for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_user_rate_limit_overrides_user_endpoint ON user_rate_limit_overrides(user_id, endpoint);

-- Enable Row Level Security
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rate_limit_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies for usage_logs
-- Users can only see their own usage logs
CREATE POLICY "Users can view own usage logs" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert usage logs
CREATE POLICY "Service role can insert usage logs" ON usage_logs
  FOR INSERT WITH CHECK (true);

-- Service role can read all usage logs for analytics
CREATE POLICY "Service role can read all usage logs" ON usage_logs
  FOR SELECT USING (auth.role() = 'service_role');

-- RLS Policies for rate_limits
-- Everyone can read rate limits (needed for client-side rate limit display)
CREATE POLICY "Anyone can read rate limits" ON rate_limits
  FOR SELECT USING (true);

-- Only service role can modify rate limits
CREATE POLICY "Service role can modify rate limits" ON rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for user_rate_limit_overrides
-- Users can view their own overrides
CREATE POLICY "Users can view own rate limit overrides" ON user_rate_limit_overrides
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all overrides
CREATE POLICY "Service role can manage rate limit overrides" ON user_rate_limit_overrides
  FOR ALL USING (auth.role() = 'service_role');

-- Create function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_tokens INTEGER DEFAULT 0,
  p_audio_duration_ms INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  rate_limit_config RECORD;
  current_usage RECORD;
  result JSONB;
BEGIN
  -- Get rate limit configuration (user override or default)
  SELECT 
    COALESCE(uro.requests_per_minute, rl.requests_per_minute) as requests_per_minute,
    COALESCE(uro.requests_per_hour, rl.requests_per_hour) as requests_per_hour,
    COALESCE(uro.requests_per_day, rl.requests_per_day) as requests_per_day,
    COALESCE(uro.tokens_per_minute, rl.tokens_per_minute) as tokens_per_minute,
    COALESCE(uro.tokens_per_hour, rl.tokens_per_hour) as tokens_per_hour,
    COALESCE(uro.tokens_per_day, rl.tokens_per_day) as tokens_per_day,
    COALESCE(uro.audio_minutes_per_hour, rl.audio_minutes_per_hour) as audio_minutes_per_hour,
    COALESCE(uro.audio_minutes_per_day, rl.audio_minutes_per_day) as audio_minutes_per_day,
    COALESCE(uro.enabled, rl.enabled) as enabled
  INTO rate_limit_config
  FROM rate_limits rl
  LEFT JOIN user_rate_limit_overrides uro ON rl.endpoint = uro.endpoint AND uro.user_id = p_user_id
  WHERE rl.endpoint = p_endpoint;

  -- If no rate limit config found or disabled, allow request
  IF NOT FOUND OR NOT rate_limit_config.enabled THEN
    RETURN jsonb_build_object('allowed', true, 'reason', 'no_limits');
  END IF;

  -- Get current usage statistics
  SELECT 
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 minute') as requests_last_minute,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as requests_last_hour,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as requests_last_day,
    COALESCE(SUM(tokens_used) FILTER (WHERE created_at >= NOW() - INTERVAL '1 minute'), 0) as tokens_last_minute,
    COALESCE(SUM(tokens_used) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour'), 0) as tokens_last_hour,
    COALESCE(SUM(tokens_used) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day'), 0) as tokens_last_day,
    COALESCE(SUM(audio_duration_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour'), 0) / 60000.0 as audio_minutes_last_hour,
    COALESCE(SUM(audio_duration_ms) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day'), 0) / 60000.0 as audio_minutes_last_day
  INTO current_usage
  FROM usage_logs
  WHERE user_id = p_user_id AND endpoint = p_endpoint AND status_code < 500;

  -- Check request rate limits
  IF current_usage.requests_last_minute >= rate_limit_config.requests_per_minute THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'requests_per_minute_exceeded',
      'limit', rate_limit_config.requests_per_minute,
      'current', current_usage.requests_last_minute,
      'retry_after', 60
    );
  END IF;

  IF current_usage.requests_last_hour >= rate_limit_config.requests_per_hour THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'requests_per_hour_exceeded',
      'limit', rate_limit_config.requests_per_hour,
      'current', current_usage.requests_last_hour,
      'retry_after', 3600
    );
  END IF;

  IF current_usage.requests_last_day >= rate_limit_config.requests_per_day THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'requests_per_day_exceeded',
      'limit', rate_limit_config.requests_per_day,
      'current', current_usage.requests_last_day,
      'retry_after', 86400
    );
  END IF;

  -- Check token rate limits (if applicable)
  IF rate_limit_config.tokens_per_minute IS NOT NULL AND 
     current_usage.tokens_last_minute + p_tokens > rate_limit_config.tokens_per_minute THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'tokens_per_minute_exceeded',
      'limit', rate_limit_config.tokens_per_minute,
      'current', current_usage.tokens_last_minute,
      'retry_after', 60
    );
  END IF;

  IF rate_limit_config.tokens_per_hour IS NOT NULL AND 
     current_usage.tokens_last_hour + p_tokens > rate_limit_config.tokens_per_hour THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'tokens_per_hour_exceeded',
      'limit', rate_limit_config.tokens_per_hour,
      'current', current_usage.tokens_last_hour,
      'retry_after', 3600
    );
  END IF;

  IF rate_limit_config.tokens_per_day IS NOT NULL AND 
     current_usage.tokens_last_day + p_tokens > rate_limit_config.tokens_per_day THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'tokens_per_day_exceeded',
      'limit', rate_limit_config.tokens_per_day,
      'current', current_usage.tokens_last_day,
      'retry_after', 86400
    );
  END IF;

  -- Check audio duration limits (if applicable)
  IF rate_limit_config.audio_minutes_per_hour IS NOT NULL AND 
     current_usage.audio_minutes_last_hour + (p_audio_duration_ms / 60000.0) > rate_limit_config.audio_minutes_per_hour THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'audio_minutes_per_hour_exceeded',
      'limit', rate_limit_config.audio_minutes_per_hour,
      'current', current_usage.audio_minutes_last_hour,
      'retry_after', 3600
    );
  END IF;

  IF rate_limit_config.audio_minutes_per_day IS NOT NULL AND 
     current_usage.audio_minutes_last_day + (p_audio_duration_ms / 60000.0) > rate_limit_config.audio_minutes_per_day THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'audio_minutes_per_day_exceeded',
      'limit', rate_limit_config.audio_minutes_per_day,
      'current', current_usage.audio_minutes_last_day,
      'retry_after', 86400
    );
  END IF;

  -- All checks passed
  RETURN jsonb_build_object('allowed', true, 'reason', 'within_limits');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log usage
CREATE OR REPLACE FUNCTION log_usage(
  p_user_id UUID,
  p_session_id TEXT,
  p_endpoint TEXT,
  p_method TEXT,
  p_status_code INTEGER,
  p_latency_ms INTEGER DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT 0,
  p_audio_duration_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_request_size_bytes INTEGER DEFAULT NULL,
  p_response_size_bytes INTEGER DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO usage_logs (
    user_id, session_id, endpoint, method, status_code, latency_ms, 
    tokens_used, audio_duration_ms, error_message, request_size_bytes, 
    response_size_bytes, ip_address, user_agent
  ) VALUES (
    p_user_id, p_session_id, p_endpoint, p_method, p_status_code, p_latency_ms,
    p_tokens_used, p_audio_duration_ms, p_error_message, p_request_size_bytes,
    p_response_size_bytes, p_ip_address, p_user_agent
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;