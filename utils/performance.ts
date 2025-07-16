import React from 'react';
import { Platform } from 'react-native';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface MemoryInfo {
  used: number;
  total: number;
  free: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private frameDropThreshold = 16.67; // 60 FPS threshold
  private memoryThreshold = 100 * 1024 * 1024; // 100MB

  /**
   * Start tracking a performance metric
   */
  startMetric(name: string, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      startTime: Date.now(),
      metadata,
    };
    this.metrics.set(name, metric);
  }

  /**
   * End tracking a performance metric
   */
  endMetric(name: string): number | null {
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric '${name}' not found`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;

    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${duration}ms`);
    }

    return duration;
  }

  /**
   * Get performance stats
   */
  getStats(): {
    totalMetrics: number;
    slowOperations: PerformanceMetric[];
    averageTime: number;
  } {
    const completedMetrics = Array.from(this.metrics.values()).filter(m => m.duration !== undefined);
    const slowOperations = completedMetrics.filter(m => m.duration! > 1000);
    const averageTime = completedMetrics.reduce((sum, m) => sum + m.duration!, 0) / completedMetrics.length;

    return {
      totalMetrics: completedMetrics.length,
      slowOperations,
      averageTime: averageTime || 0,
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Monitor memory usage (basic implementation)
   */
  getMemoryUsage(): MemoryInfo | null {
    // Note: React Native doesn't provide direct memory access
    // This is a placeholder for future implementation
    if (Platform.OS === 'web') {
      // @ts-ignore
      if (performance.memory) {
        // @ts-ignore
        const memory = performance.memory;
        return {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          free: memory.totalJSHeapSize - memory.usedJSHeapSize,
        };
      }
    }
    return null;
  }

  /**
   * Log performance warning
   */
  logWarning(message: string, metadata?: Record<string, any>): void {
    console.warn(`Performance Warning: ${message}`, metadata);
  }

  /**
   * Track component render time
   */
  trackComponentRender(componentName: string, renderTime: number): void {
    if (renderTime > this.frameDropThreshold) {
      this.logWarning(`Component ${componentName} render time exceeded threshold`, {
        renderTime,
        threshold: this.frameDropThreshold,
      });
    }
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export utility functions
export const startPerformanceMetric = (name: string, metadata?: Record<string, any>) => {
  performanceMonitor.startMetric(name, metadata);
};

export const endPerformanceMetric = (name: string) => {
  return performanceMonitor.endMetric(name);
};

export const getPerformanceStats = () => {
  return performanceMonitor.getStats();
};

export const clearPerformanceMetrics = () => {
  performanceMonitor.clearMetrics();
};

export const getMemoryUsage = () => {
  return performanceMonitor.getMemoryUsage();
};

export const logPerformanceWarning = (message: string, metadata?: Record<string, any>) => {
  performanceMonitor.logWarning(message, metadata);
};

export const trackComponentRender = (componentName: string, renderTime: number) => {
  performanceMonitor.trackComponentRender(componentName, renderTime);
};

/**
 * HOC for tracking component performance
 */
export const withPerformanceTracking = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  return React.memo((props: P) => {
    const renderStart = Date.now();
    
    React.useEffect(() => {
      const renderTime = Date.now() - renderStart;
      trackComponentRender(componentName, renderTime);
    });

    return <Component {...props} />;
  });
};

/**
 * Hook for performance tracking
 */
export const usePerformanceTracking = (name: string, dependencies?: React.DependencyList) => {
  React.useEffect(() => {
    startPerformanceMetric(name);
    return () => {
      endPerformanceMetric(name);
    };
  }, dependencies);
};

// Export the monitor instance for advanced usage
export { performanceMonitor };