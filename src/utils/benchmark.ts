/**
 * Benchmark utilities for performance testing
 * 
 * Provides high-precision timing and statistical analysis utilities
 * for benchmarking operations in kinetiCORE.
 * 
 * @module utils/benchmark
 */

export interface BenchmarkResult {
  operation: string;
  iterations: number;
  timings: number[]; // Individual timings in ms
  stats: {
    mean: number;
    median: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    stdDev: number;
  };
  throughput: number; // operations per second
}

export interface BenchmarkOptions {
  iterations?: number;
  warmup?: number;
  name?: string;
  silent?: boolean;
}

/**
 * High-precision timer for benchmarking
 */
export class Timer {
  private startTime: number = 0;
  private endTime: number = 0;
  
  /**
   * Start the timer
   */
  start(): void {
    this.startTime = performance.now();
  }
  
  /**
   * Stop the timer and return elapsed time in ms
   */
  stop(): number {
    this.endTime = performance.now();
    return this.elapsed();
  }
  
  /**
   * Get elapsed time without stopping
   */
  elapsed(): number {
    const end = this.endTime || performance.now();
    return end - this.startTime;
  }
  
  /**
   * Reset the timer
   */
  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
  }
}

/**
 * Measure execution time of a synchronous function
 */
export function measure<T>(fn: () => T): { result: T; duration: number } {
  const timer = new Timer();
  timer.start();
  const result = fn();
  const duration = timer.stop();
  return { result, duration };
}

/**
 * Measure execution time of an async function
 */
export async function measureAsync<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const timer = new Timer();
  timer.start();
  const result = await fn();
  const duration = timer.stop();
  return { result, duration };
}

/**
 * Calculate statistics from an array of numbers
 */
export function calculateStats(values: number[]): BenchmarkResult['stats'] {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
    };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  
  // Standard deviation
  const squaredDiffs = sorted.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length;
  const stdDev = Math.sqrt(variance);
  
  // Percentiles
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
  
  return {
    mean,
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50,
    p95,
    p99,
    stdDev,
  };
}

/**
 * Benchmark a synchronous function
 */
export function benchmark(
  fn: () => void,
  options: BenchmarkOptions = {}
): BenchmarkResult {
  const {
    iterations = 100,
    warmup = 10,
    name = 'benchmark',
    silent = false,
  } = options;
  
  // Warmup
  for (let i = 0; i < warmup; i++) {
    fn();
  }
  
  // Actual benchmark
  const timings: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const timer = new Timer();
    timer.start();
    fn();
    timings.push(timer.stop());
  }
  
  const stats = calculateStats(timings);
  const totalTime = timings.reduce((a, b) => a + b, 0);
  const throughput = (iterations / totalTime) * 1000; // ops/sec
  
  const result: BenchmarkResult = {
    operation: name,
    iterations,
    timings,
    stats,
    throughput,
  };
  
  if (!silent) {
    console.log(`\n🔬 Benchmark: ${name}`);
    console.log(`   Iterations: ${iterations}`);
    console.log(`   Mean: ${stats.mean.toFixed(3)}ms`);
    console.log(`   Median: ${stats.median.toFixed(3)}ms`);
    console.log(`   P95: ${stats.p95.toFixed(3)}ms`);
    console.log(`   P99: ${stats.p99.toFixed(3)}ms`);
    console.log(`   Min: ${stats.min.toFixed(3)}ms`);
    console.log(`   Max: ${stats.max.toFixed(3)}ms`);
    console.log(`   StdDev: ${stats.stdDev.toFixed(3)}ms`);
    console.log(`   Throughput: ${throughput.toFixed(0)} ops/sec`);
  }
  
  return result;
}

/**
 * Benchmark an async function
 */
export async function benchmarkAsync(
  fn: () => Promise<void>,
  options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
  const {
    iterations = 100,
    warmup = 10,
    name = 'async-benchmark',
    silent = false,
  } = options;
  
  // Warmup
  for (let i = 0; i < warmup; i++) {
    await fn();
  }
  
  // Actual benchmark
  const timings: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const timer = new Timer();
    timer.start();
    await fn();
    timings.push(timer.stop());
  }
  
  const stats = calculateStats(timings);
  const totalTime = timings.reduce((a, b) => a + b, 0);
  const throughput = (iterations / totalTime) * 1000; // ops/sec
  
  const result: BenchmarkResult = {
    operation: name,
    iterations,
    timings,
    stats,
    throughput,
  };
  
  if (!silent) {
    console.log(`\n🔬 Async Benchmark: ${name}`);
    console.log(`   Iterations: ${iterations}`);
    console.log(`   Mean: ${stats.mean.toFixed(3)}ms`);
    console.log(`   Median: ${stats.median.toFixed(3)}ms`);
    console.log(`   P95: ${stats.p95.toFixed(3)}ms`);
    console.log(`   P99: ${stats.p99.toFixed(3)}ms`);
    console.log(`   Min: ${stats.min.toFixed(3)}ms`);
    console.log(`   Max: ${stats.max.toFixed(3)}ms`);
    console.log(`   StdDev: ${stats.stdDev.toFixed(3)}ms`);
    console.log(`   Throughput: ${throughput.toFixed(0)} ops/sec`);
  }
  
  return result;
}

/**
 * Compare multiple benchmark results
 */
export function compareBenchmarks(results: BenchmarkResult[]): void {
  if (results.length === 0) return;
  
  console.log('\n📊 Benchmark Comparison:');
  console.log('─'.repeat(80));
  console.log(
    'Operation'.padEnd(30) +
    'Mean'.padEnd(12) +
    'P95'.padEnd(12) +
    'P99'.padEnd(12) +
    'Throughput'
  );
  console.log('─'.repeat(80));
  
  results.forEach((result) => {
    console.log(
      result.operation.padEnd(30) +
      `${result.stats.mean.toFixed(2)}ms`.padEnd(12) +
      `${result.stats.p95.toFixed(2)}ms`.padEnd(12) +
      `${result.stats.p99.toFixed(2)}ms`.padEnd(12) +
      `${result.throughput.toFixed(0)} ops/sec`
    );
  });
  console.log('─'.repeat(80));
}

/**
 * Run a benchmark suite
 */
export async function benchmarkSuite(
  suite: Array<{
    name: string;
    fn: () => void | Promise<void>;
    options?: BenchmarkOptions;
  }>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  
  console.log('\n🧪 Running Benchmark Suite...\n');
  
  for (const test of suite) {
    const options = { ...test.options, name: test.name };
    
    let result: BenchmarkResult;
    if (test.fn.constructor.name === 'AsyncFunction') {
      result = await benchmarkAsync(test.fn as () => Promise<void>, options);
    } else {
      result = benchmark(test.fn as () => void, options);
    }
    
    results.push(result);
  }
  
  compareBenchmarks(results);
  
  return results;
}

/**
 * Format benchmark result as a readable string
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  return `
Benchmark: ${result.operation}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Iterations: ${result.iterations}
Mean:       ${result.stats.mean.toFixed(3)} ms
Median:     ${result.stats.median.toFixed(3)} ms
P50:        ${result.stats.p50.toFixed(3)} ms
P95:        ${result.stats.p95.toFixed(3)} ms
P99:        ${result.stats.p99.toFixed(3)} ms
Min:        ${result.stats.min.toFixed(3)} ms
Max:        ${result.stats.max.toFixed(3)} ms
StdDev:     ${result.stats.stdDev.toFixed(3)} ms
Throughput: ${result.throughput.toFixed(0)} ops/sec
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();
}

/**
 * Export benchmark results to JSON
 */
export function exportBenchmarkResults(
  results: BenchmarkResult[],
  filename?: string
): string {
  const data = {
    timestamp: new Date().toISOString(),
    environment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      cores: navigator.hardwareConcurrency,
    },
    results,
  };
  
  const json = JSON.stringify(data, null, 2);
  
  if (filename) {
    // Create download link
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  return json;
}
