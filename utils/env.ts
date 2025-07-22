/**
 * Environment Configuration - Centralized environment variable validation
 * 
 * This module provides centralized access to environment variables with
 * comprehensive validation and clear error messages for missing configuration.
 * 
 * Requirements: 5.1, 7.3
 */

import Constants from 'expo-constants';

// Types for environment validation
export interface EnvironmentConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Cached environment variable extraction for performance
let cachedExtras: Record<string, string> | null = null;

function getExtras(): Record<string, string> {
  if (!cachedExtras) {
    try {
      cachedExtras = (Constants.expoConfig?.extra ??
        /* @ts-ignore -- fallback for web manifest2 */ Constants.manifest2?.extra ??
        Constants.manifest?.extra ??
        {}) as Record<string, string>;
    } catch (error) {
      console.warn('Failed to load environment extras, using empty object:', error);
      cachedExtras = {};
    }
  }
  return cachedExtras;
}

// Core environment variables (lazy-loaded)
export const SUPABASE_URL = getExtras()['SUPABASE_URL'];
export const SUPABASE_ANON_KEY = getExtras()['SUPABASE_ANON_KEY'];

// Deprecated keys (should be undefined for security)
export const OPENAI_KEY = undefined;
export const ELEVEN_KEY = undefined;

/**
 * Validate environment configuration
 * Returns detailed validation results with actionable error messages
 */
export const validateEnvironment = (): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required environment variables
  const requiredVars = [
    {
      name: 'SUPABASE_URL',
      value: SUPABASE_URL,
      description: 'Supabase project URL',
      example: 'https://your-project-ref.supabase.co',
      validator: (value: string) => {
        if (!value.startsWith('https://') || !value.includes('.supabase.co')) {
          return 'Must be a valid Supabase URL (https://your-project-ref.supabase.co)';
        }
        return null;
      }
    },
    {
      name: 'SUPABASE_ANON_KEY',
      value: SUPABASE_ANON_KEY,
      description: 'Supabase anonymous key',
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      validator: (value: string) => {
        if (!value.startsWith('eyJ')) {
          return 'Must be a valid JWT token starting with "eyJ"';
        }
        if (value.length < 100) {
          return 'Appears to be too short for a valid Supabase anon key';
        }
        return null;
      }
    }
  ];

  // Validate each required variable
  for (const variable of requiredVars) {
    if (!variable.value) {
      errors.push(
        `❌ ${variable.name} is missing!\n` +
        `   Description: ${variable.description}\n` +
        `   Example: ${variable.example}\n` +
        `   Fix: Add to your .env file and restart with 'npx expo start -c'`
      );
    } else {
      const validationError = variable.validator(variable.value);
      if (validationError) {
        errors.push(
          `❌ ${variable.name} is invalid: ${validationError}\n` +
          `   Current value: ${variable.value.substring(0, 20)}...\n` +
          `   Expected format: ${variable.example}`
        );
      }
    }
  }

  // Security warnings for deprecated keys
  if (extras['OPENAI_KEY']) {
    warnings.push(
      '⚠️  OPENAI_KEY found in client environment!\n' +
      '   Security Risk: API keys should not be exposed to the client\n' +
      '   Fix: Remove from .env and use Supabase Edge Functions instead'
    );
  }

  if (extras['ELEVEN_KEY'] || extras['ELEVENLABS_API_KEY']) {
    warnings.push(
      '⚠️  ElevenLabs API key found in client environment!\n' +
      '   Security Risk: API keys should not be exposed to the client\n' +
      '   Fix: Remove from .env and use Supabase Edge Functions instead'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Get environment configuration with validation
 * Throws detailed error if configuration is invalid
 */
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const validation = validateEnvironment();

  if (!validation.isValid) {
    const errorMessage = [
      '🚨 Environment Configuration Error',
      '=' .repeat(50),
      ...validation.errors,
      '',
      '💡 Setup Instructions:',
      '1. Create a .env file in your project root',
      '2. Add the required environment variables',
      '3. Restart the development server with: npx expo start -c',
      '4. Check your Supabase project settings for the correct values',
      ''
    ].join('\n');

    throw new Error(errorMessage);
  }

  // Log warnings if any
  if (validation.warnings.length > 0) {
    console.warn('\n🔒 Security Warnings:');
    validation.warnings.forEach(warning => console.warn(warning));
    console.warn('');
  }

  return {
    SUPABASE_URL: SUPABASE_URL!,
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY!,
  };
};

/**
 * Check if environment is properly configured
 * Non-throwing version for conditional logic
 */
export const isEnvironmentConfigured = (): boolean => {
  return validateEnvironment().isValid;
};

/**
 * Get safe environment info for debugging
 * Masks sensitive values for logging
 */
export const getEnvironmentInfo = () => {
  const maskValue = (value: string | undefined, showLength = 4) => {
    if (!value) return 'undefined';
    if (value.length <= showLength) return '*'.repeat(value.length);
    return value.substring(0, showLength) + '*'.repeat(Math.max(0, value.length - showLength));
  };

  return {
    SUPABASE_URL: SUPABASE_URL || 'undefined',
    SUPABASE_ANON_KEY: maskValue(SUPABASE_ANON_KEY, 8),
    platform: Constants.platform,
    appVersion: Constants.expoConfig?.version || 'unknown',
    isConfigured: isEnvironmentConfigured(),
  };
};

// Initialize and validate environment on module load
try {
  const validation = validateEnvironment();
  
  if (validation.isValid) {
    console.log('✅ Environment configuration loaded successfully');
    console.log('📊 Config info:', getEnvironmentInfo());
  } else {
    console.error('\n🚨 Environment Configuration Issues:');
    validation.errors.forEach(error => console.error(error));
    console.error('\n⚠️  App may not function correctly until these issues are resolved.\n');
  }

  // Show warnings
  if (validation.warnings.length > 0) {
    console.warn('\n🔒 Security Warnings:');
    validation.warnings.forEach(warning => console.warn(warning));
    console.warn('');
  }
} catch (error) {
  console.error('Failed to validate environment:', error);
} 