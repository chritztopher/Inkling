/**
 * Performance monitoring and optimization utilities for voice conversation loop
 * Tracks latency metrics and ensures performance targets are met
 */

import React from 'react';
import { logError } from './errors';

// Performance targets (in milliseconds)
export const PERFORMANCE_TARGETS = {
  STT_LATENCY: 400,           // Speech-to-Text should complete in <400ms
  FIRST_TOKEN_LATENCY: 350,   // First chat token should arrive in <350ms
  TTS_LATENCY: 300,           // Text-to-Speech should complete in <300ms
  TOTAL_LATENCY: 1000,        // Total conversation turn should complete in <1000ms
} as const;

// Performance metrics interface
export interface PerformanceMetrics {
  sttLatency?: number;
  firstTokenLatency?: number;
  ttsLatency?: number;
  audioPlaybackLatency?: number;
  totalLatency: number;
  timestamp: number;
  sessionId: string;
  userId?: string;
  // Internal tracking properties
  sttStart?: number;
  ttsStart?: number;
  audioPlaybackStart?: number;
}

// Performance warning thresholds (80% of target)
const WARNING_THRESHOLDS = {
  STT_LATENCY: PERFORMANCE_TARGETS.STT_LATENCY * 0.8,
  FIRST_TOKEN_LATENCY: PERFORMANCE_TARGETS.FIRST_TOKEN_LATENCY * 0.8,
  TTS_LATENCY: PERFORMANCE_TARGETS.TTS_LATENCY * 0.8,
  TOTAL_LATENCY: PERFORMANCE_TARGETS.TOTAL_LATENCY * 0.8,
} as const;

// Performance monitoring class
export class PerformanceMonitor {
  private startTime: number;
  private metrics: Partial<PerformanceMetrics>;
  private sessionId: string;
  private userId?: string;

  constructor(sessionId: string, userId?: string) {
    this.startTime = Date.now();
    this.sessionId = sessionId;
    this.userId = userId;
    this.metrics = {
      sessionId,
      userId,
      timestamp: this.startTime,
    };
  }

  /**
   * Mark the start of STT processing
   */
  startSTT(): void {
    this.metrics.sttStart = Date.now();
  }

  /**
   * Mark the completion of STT processing
   */
  endSTT(): void {
    if (this.metrics.sttStart) {
      this.metrics.sttLatency = Date.now() - this.metrics.sttStart;
      this.checkPerformanceWarning('STT', this.metrics.sttLatency);
    }
  }

  /**
   * Mark the arrival of the first chat token
   */
  firstToken(): void {
    if (!this.metrics.firstTokenLatency) {
      this.metrics.firstTokenLatency = Date.now() - this.startTime;
      this.checkPerformanceWarning('FIRST_TOKEN', this.metrics.firstTokenLatency);
    }
  }

  /**
   * Mark the start of TTS processing
   */
  startTTS(): void {
    this.metrics.ttsStart = Date.now();
  }

  /**
   * Mark the completion of TTS processing
   */
  endTTS(): void {
    if (this.metrics.ttsStart) {
      this.metrics.ttsLatency = Date.now() - this.metrics.ttsStart;
      this.checkPerformanceWarning('TTS', this.metrics.ttsLatency);
    }
  }

  /**
   * Mark the start of audio playback
   */
  startAudioPlayback(): void {
    this.metrics.audioPlaybackStart = Date.now();
  }

  /**
   * Mark the completion of audio playback setup
   */
  endAudioPlayback(): void {
    if (this.metrics.audioPlaybackStart) {
      this.metrics.audioPlaybackLatency = Date.now() - this.metrics.audioPlaybackStart;
    }
  }

  /**
   * Complete the performance measurement and return metrics
   */
  complete(): PerformanceMetrics {
    const totalLatency = Date.now() - this.startTime;
    
    const finalMetrics: PerformanceMetrics = {
      ...this.metrics,
      totalLatency,
      timestamp: this.startTime,
      sessionId: this.sessionId,
      userId: this.userId,
    };

    // Check total latency warning
    this.checkPerformanceWarning('TOTAL', totalLatency);

    // Log performance metrics
    this.logPerformanceMetrics(finalMetrics);

    return finalMetrics;
  }

  /**
   * Check if a metric exceeds warning threshold
   */
  private checkPerformanceWarning(metric: keyof typeof WARNING_THRESHOLDS, value: number): void {
    const threshold = WARNING_THRESHOLDS[metric];
    const target = PERFORMANCE_TARGETS[`${metric}_LATENCY` as keyof typeof PERFORMANCE_TARGETS];
    
    if (value > threshold) {
      console.warn(`Performance warning: ${metric} latency ${value}ms exceeds warning threshold ${threshold}ms (target: ${target}ms)`);
    }

    if (value > target) {
      console.error(`Performance target exceeded: ${metric} latency ${value}ms exceeds target ${target}ms`);
      
      // Log performance issue
      logError(new Error(`Performance target exceeded: ${metric}`), {
        metric,
        value,
        target,
        threshold,
        sessionId: this.sessionId,
        userId: this.userId,
      });
    }
  }

  /**
   * Log performance metrics for analytics
   */
  private logPerformanceMetrics(metrics: PerformanceMetrics): void {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance Metrics:', {
        STT: `${metrics.sttLatency || 'N/A'}ms`,
        FirstToken: `${metrics.firstTokenLatency || 'N/A'}ms`,
        TTS: `${metrics.ttsLatency || 'N/A'}ms`,
        AudioPlayback: `${metrics.audioPlaybackLatency || 'N/A'}ms`,
        Total: `${metrics.totalLatency}ms`,
        Targets: {
          STT: `<${PERFORMANCE_TARGETS.STT_LATENCY}ms`,
          FirstToken: `<${PERFORMANCE_TARGETS.FIRST_TOKEN_LATENCY}ms`,
          TTS: `<${PERFORMANCE_TARGETS.TTS_LATENCY}ms`,
          Total: `<${PERFORMANCE_TARGETS.TOTAL_LATENCY}ms`,
        },
      });
    }

    // In production, you would send these metrics to your analytics service
    // Example: Analytics.track('voice_conversation_performance', metrics);
  }
}

/**
 * Create a new performance monitor for a conversation turn
 */
export function createPerformanceMonitor(sessionId?: string, userId?: string): PerformanceMonitor {
  const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  return new PerformanceMonitor(id, userId);
}

/**
 * Performance optimization utilities
 */
export class PerformanceOptimizer {
  private static connectionPool: Map<string, any> = new Map();
  private static preloadedResources: Set<string> = new Set();

  /**
   * Get or create a connection from the pool
   */
  static getConnection(key: string, factory: () => any): any {
    if (!this.connectionPool.has(key)) {
      this.connectionPool.set(key, factory());
    }
    return this.connectionPool.get(key);
  }

  /**
   * Preload resources for faster access
   */
  static preloadResource(key: string, loader: () => Promise<any>): void {
    if (!this.preloadedResources.has(key)) {
      this.preloadedResources.add(key);
      loader().catch(error => {
        console.warn(`Failed to preload resource ${key}:`, error);
        this.preloadedResources.delete(key);
      });
    }
  }

  /**
   * Optimize streaming response handling
   */
  static optimizeStreamingResponse(response: Response): Response {
    // Add performance headers
    const headers = new Headers(response.headers);
    headers.set('X-Performance-Optimized', 'true');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Connection', 'keep-alive');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /**
   * Batch multiple operations for better performance
   */
  static async batchOperations<T>(
    operations: Array<() => Promise<T>>,
    batchSize: number = 3
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(op => op()));
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Implement exponential backoff with jitter
   */
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 100
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}

/**
 * Performance monitoring hook for React components
 * Optimized with memoization and cleanup
 */
export function usePerformanceMonitor(sessionId?: string, userId?: string) {
  const monitor = React.useRef<PerformanceMonitor | null>(null);
  
  const startMonitoring = React.useCallback(() => {
    // Clean up previous monitor if exists
    if (monitor.current) {
      monitor.current.complete();
    }
    monitor.current = createPerformanceMonitor(sessionId, userId);
    return monitor.current;
  }, [sessionId, userId]);
  
  const getMonitor = React.useCallback(() => {
    return monitor.current;
  }, []);
  
  const completeMonitoring = React.useCallback(() => {
    if (monitor.current) {
      const metrics = monitor.current.complete();
      monitor.current = null;
      return metrics;
    }
    return null;
  }, []);
  
  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (monitor.current) {
        monitor.current.complete();
        monitor.current = null;
      }
    };
  }, []);
  
  return React.useMemo(() => ({
    startMonitoring,
    getMonitor,
    completeMonitoring,
  }), [startMonitoring, getMonitor, completeMonitoring]);
}

/**
 * Validate that performance targets are being met
 */
export function validatePerformanceTargets(metrics: PerformanceMetrics): {
  passed: boolean;
  failures: string[];
  warnings: string[];
} {
  const failures: string[] = [];
  const warnings: string[] = [];
  
  // Check STT latency
  if (metrics.sttLatency) {
    if (metrics.sttLatency > PERFORMANCE_TARGETS.STT_LATENCY) {
      failures.push(`STT latency ${metrics.sttLatency}ms exceeds target ${PERFORMANCE_TARGETS.STT_LATENCY}ms`);
    } else if (metrics.sttLatency > WARNING_THRESHOLDS.STT_LATENCY) {
      warnings.push(`STT latency ${metrics.sttLatency}ms approaching target ${PERFORMANCE_TARGETS.STT_LATENCY}ms`);
    }
  }
  
  // Check first token latency
  if (metrics.firstTokenLatency) {
    if (metrics.firstTokenLatency > PERFORMANCE_TARGETS.FIRST_TOKEN_LATENCY) {
      failures.push(`First token latency ${metrics.firstTokenLatency}ms exceeds target ${PERFORMANCE_TARGETS.FIRST_TOKEN_LATENCY}ms`);
    } else if (metrics.firstTokenLatency > WARNING_THRESHOLDS.FIRST_TOKEN_LATENCY) {
      warnings.push(`First token latency ${metrics.firstTokenLatency}ms approaching target ${PERFORMANCE_TARGETS.FIRST_TOKEN_LATENCY}ms`);
    }
  }
  
  // Check TTS latency
  if (metrics.ttsLatency) {
    if (metrics.ttsLatency > PERFORMANCE_TARGETS.TTS_LATENCY) {
      failures.push(`TTS latency ${metrics.ttsLatency}ms exceeds target ${PERFORMANCE_TARGETS.TTS_LATENCY}ms`);
    } else if (metrics.ttsLatency > WARNING_THRESHOLDS.TTS_LATENCY) {
      warnings.push(`TTS latency ${metrics.ttsLatency}ms approaching target ${PERFORMANCE_TARGETS.TTS_LATENCY}ms`);
    }
  }
  
  // Check total latency
  if (metrics.totalLatency > PERFORMANCE_TARGETS.TOTAL_LATENCY) {
    failures.push(`Total latency ${metrics.totalLatency}ms exceeds target ${PERFORMANCE_TARGETS.TOTAL_LATENCY}ms`);
  } else if (metrics.totalLatency > WARNING_THRESHOLDS.TOTAL_LATENCY) {
    warnings.push(`Total latency ${metrics.totalLatency}ms approaching target ${PERFORMANCE_TARGETS.TOTAL_LATENCY}ms`);
  }
  
  return {
    passed: failures.length === 0,
    failures,
    warnings,
  };
}

// Global performance metrics collection
export const PerformanceMetricsCollector = {
  metrics: [] as PerformanceMetrics[],
  
  add(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  },
  
  getAverages(): {
    avgSTT: number;
    avgFirstToken: number;
    avgTTS: number;
    avgTotal: number;
    count: number;
  } {
    if (this.metrics.length === 0) {
      return { avgSTT: 0, avgFirstToken: 0, avgTTS: 0, avgTotal: 0, count: 0 };
    }
    
    const sttMetrics = this.metrics.filter(m => m.sttLatency).map(m => m.sttLatency!);
    const firstTokenMetrics = this.metrics.filter(m => m.firstTokenLatency).map(m => m.firstTokenLatency!);
    const ttsMetrics = this.metrics.filter(m => m.ttsLatency).map(m => m.ttsLatency!);
    const totalMetrics = this.metrics.map(m => m.totalLatency);
    
    return {
      avgSTT: sttMetrics.length > 0 ? sttMetrics.reduce((a, b) => a + b, 0) / sttMetrics.length : 0,
      avgFirstToken: firstTokenMetrics.length > 0 ? firstTokenMetrics.reduce((a, b) => a + b, 0) / firstTokenMetrics.length : 0,
      avgTTS: ttsMetrics.length > 0 ? ttsMetrics.reduce((a, b) => a + b, 0) / ttsMetrics.length : 0,
      avgTotal: totalMetrics.reduce((a, b) => a + b, 0) / totalMetrics.length,
      count: this.metrics.length,
    };
  },
  
  clear(): void {
    this.metrics = [];
  },
};