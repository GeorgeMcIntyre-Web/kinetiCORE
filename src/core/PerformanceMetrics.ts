/**
 * PerformanceMetrics - Centralized performance data collection
 * 
 * This module provides a centralized system for collecting and analyzing
 * performance metrics across the kinetiCORE application.
 * 
 * @module core/PerformanceMetrics
 */

export interface FrameMetrics {
  timestamp: number;
  fps: number;
  frameTime: number; // ms
  drawCalls: number;
  triangles: number;
  entities: number;
  physicsBodies: number;
}

export interface OperationTiming {
  name: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface MemorySnapshot {
  timestamp: number;
  usedJSHeapSize: number; // bytes
  totalJSHeapSize: number; // bytes
  jsHeapSizeLimit: number; // bytes
}

export interface PerformanceSnapshot {
  timestamp: number;
  frame: FrameMetrics;
  memory?: MemorySnapshot;
  operations: OperationTiming[];
  userMetrics?: Record<string, number>;
}

export interface PerformanceStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  stdDev: number;
}

/**
 * PerformanceMetrics - Singleton for performance data collection
 */
export class PerformanceMetrics {
  private static instance: PerformanceMetrics;
  
  private frameHistory: FrameMetrics[] = [];
  private memoryHistory: MemorySnapshot[] = [];
  private operationHistory: OperationTiming[] = [];
  private maxHistorySize = 300; // ~5 seconds at 60 FPS
  
  // private currentFrame: Partial<FrameMetrics> = {};
  private activeOperations = new Map<string, number>();
  
  private enabled = true;
  
  private constructor() {
    // Private constructor for singleton
  }
  
  static getInstance(): PerformanceMetrics {
    if (!PerformanceMetrics.instance) {
      PerformanceMetrics.instance = new PerformanceMetrics();
    }
    return PerformanceMetrics.instance;
  }
  
  /**
   * Enable/disable metrics collection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Record frame metrics
   */
  recordFrame(metrics: Partial<FrameMetrics>): void {
    if (!this.enabled) return;
    
    const timestamp = performance.now();
    const frameMetrics: FrameMetrics = {
      timestamp,
      fps: metrics.fps || 0,
      frameTime: metrics.frameTime || 0,
      drawCalls: metrics.drawCalls || 0,
      triangles: metrics.triangles || 0,
      entities: metrics.entities || 0,
      physicsBodies: metrics.physicsBodies || 0,
    };
    
    this.frameHistory.push(frameMetrics);
    
    // Trim history if too large
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }
  }
  
  /**
   * Record memory snapshot (if available)
   */
  recordMemory(): void {
    if (!this.enabled) return;
    
    // Check if memory API is available (Chrome only)
    const perfMemory = (performance as any).memory;
    if (!perfMemory) return;
    
    const snapshot: MemorySnapshot = {
      timestamp: performance.now(),
      usedJSHeapSize: perfMemory.usedJSHeapSize,
      totalJSHeapSize: perfMemory.totalJSHeapSize,
      jsHeapSizeLimit: perfMemory.jsHeapSizeLimit,
    };
    
    this.memoryHistory.push(snapshot);
    
    // Trim history
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }
  }
  
  /**
   * Start timing an operation
   */
  startOperation(name: string, _metadata?: Record<string, unknown>): void {
    if (!this.enabled) return;
    
    const operationId = `${name}-${Date.now()}-${Math.random()}`;
    this.activeOperations.set(operationId, performance.now());
    
    return;
  }
  
  /**
   * End timing an operation
   */
  endOperation(name: string, metadata?: Record<string, unknown>): void {
    if (!this.enabled) return;
    
    // Find the most recent matching operation
    let operationId: string | undefined;
    for (const [id, _] of this.activeOperations) {
      if (id.startsWith(name)) {
        operationId = id;
        break;
      }
    }
    
    if (!operationId) {
      console.warn(`No active operation found for: ${name}`);
      return;
    }
    
    const startTime = this.activeOperations.get(operationId)!;
    const duration = performance.now() - startTime;
    
    this.operationHistory.push({
      name,
      startTime,
      duration,
      metadata,
    });
    
    this.activeOperations.delete(operationId);
    
    // Trim history
    if (this.operationHistory.length > this.maxHistorySize * 2) {
      this.operationHistory.shift();
    }
  }
  
  /**
   * Get current frame metrics
   */
  getCurrentFrame(): FrameMetrics | null {
    return this.frameHistory[this.frameHistory.length - 1] || null;
  }
  
  /**
   * Get current memory snapshot
   */
  getCurrentMemory(): MemorySnapshot | null {
    return this.memoryHistory[this.memoryHistory.length - 1] || null;
  }
  
  /**
   * Get frame statistics over the history window
   */
  getFrameStats(): {
    fps: PerformanceStats;
    frameTime: PerformanceStats;
  } | null {
    if (this.frameHistory.length === 0) return null;
    
    const fpsValues = this.frameHistory.map((f) => f.fps);
    const frameTimeValues = this.frameHistory.map((f) => f.frameTime);
    
    return {
      fps: this.calculateStats(fpsValues),
      frameTime: this.calculateStats(frameTimeValues),
    };
  }
  
  /**
   * Get operation statistics by name
   */
  getOperationStats(operationName: string): PerformanceStats | null {
    const operations = this.operationHistory.filter(
      (op) => op.name === operationName
    );
    
    if (operations.length === 0) return null;
    
    const durations = operations.map((op) => op.duration);
    return this.calculateStats(durations);
  }
  
  /**
   * Get all operation timings for a specific operation
   */
  getOperationTimings(operationName: string): OperationTiming[] {
    return this.operationHistory.filter((op) => op.name === operationName);
  }
  
  /**
   * Calculate statistics for a set of values
   */
  private calculateStats(values: number[]): PerformanceStats {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
      };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;
    
    // Calculate standard deviation
    const squaredDiffs = sorted.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1],
      stdDev,
    };
  }
  
  /**
   * Export all metrics to JSON
   */
  exportToJSON(): PerformanceSnapshot {
    const currentFrame = this.getCurrentFrame();
    const currentMemory = this.getCurrentMemory();
    
    return {
      timestamp: performance.now(),
      frame: currentFrame || {
        timestamp: 0,
        fps: 0,
        frameTime: 0,
        drawCalls: 0,
        triangles: 0,
        entities: 0,
        physicsBodies: 0,
      },
      memory: currentMemory || undefined,
      operations: [...this.operationHistory],
    };
  }
  
  /**
   * Export statistics summary
   */
  exportStatsSummary(): {
    frames: any;
    operations: { [name: string]: PerformanceStats };
    memory: {
      current: MemorySnapshot | null;
      peak: number;
    };
  } {
    // Get unique operation names
    const operationNames = new Set(this.operationHistory.map((op) => op.name));
    const operationStats: { [name: string]: PerformanceStats } = {};
    
    operationNames.forEach((name) => {
      const stats = this.getOperationStats(name);
      if (stats) {
        operationStats[name] = stats;
      }
    });
    
    // Find peak memory usage
    const peakMemory = Math.max(
      ...this.memoryHistory.map((m) => m.usedJSHeapSize),
      0
    );
    
    return {
      frames: this.getFrameStats(),
      operations: operationStats,
      memory: {
        current: this.getCurrentMemory(),
        peak: peakMemory,
      },
    };
  }
  
  /**
   * Clear all metrics
   */
  clear(): void {
    this.frameHistory = [];
    this.memoryHistory = [];
    this.operationHistory = [];
    this.activeOperations.clear();
  }
  
  /**
   * Set maximum history size (number of frames to keep)
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
  }
}

/**
 * Global singleton instance
 */
export const performanceMetrics = PerformanceMetrics.getInstance();
