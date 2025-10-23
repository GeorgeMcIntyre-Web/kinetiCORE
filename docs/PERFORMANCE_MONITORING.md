# Performance Monitoring Guide

**Status:** ✅ Implemented  
**Created:** 2025-10-23  
**Owner:** Agent 4

---

## Overview

The kinetiCORE performance monitoring system provides real-time performance metrics and benchmarking tools to ensure the application meets production performance targets.

### Performance Targets

- **60 FPS** with 50+ objects in scene
- **<50ms** input latency
- **<3s** initial load time
- **<500ms** file import time for standard CAD files
- **<100ms** IK solve time
- **Zero memory leaks** in 1-hour session

---

## Components

### 1. PerformanceMetrics (Core)

**Location:** `src/core/PerformanceMetrics.ts`

Centralized singleton for collecting and analyzing performance data.

#### Usage

```typescript
import { performanceMetrics } from '@core/PerformanceMetrics';

// Record frame metrics
performanceMetrics.recordFrame({
  fps: 60,
  frameTime: 16.7,
  drawCalls: 150,
  triangles: 50000,
  entities: 25,
  physicsBodies: 25,
});

// Record memory snapshot (Chrome only)
performanceMetrics.recordMemory();

// Time an operation
performanceMetrics.startOperation('ik-solve');
// ... perform IK solve ...
performanceMetrics.endOperation('ik-solve');

// Get statistics
const frameStats = performanceMetrics.getFrameStats();
console.log(`Average FPS: ${frameStats?.fps.mean}`);

const ikStats = performanceMetrics.getOperationStats('ik-solve');
console.log(`IK solve P95: ${ikStats?.p95}ms`);

// Export data
const snapshot = performanceMetrics.exportToJSON();
const summary = performanceMetrics.exportStatsSummary();
```

#### API Reference

**Recording Methods:**
- `recordFrame(metrics: Partial<FrameMetrics>)` - Record frame metrics
- `recordMemory()` - Record memory snapshot (Chrome only)
- `startOperation(name: string, metadata?)` - Start timing an operation
- `endOperation(name: string, metadata?)` - End timing an operation

**Query Methods:**
- `getCurrentFrame()` - Get latest frame metrics
- `getCurrentMemory()` - Get latest memory snapshot
- `getFrameStats()` - Get frame statistics (FPS, frame time)
- `getOperationStats(name: string)` - Get statistics for a specific operation
- `getOperationTimings(name: string)` - Get all timings for an operation

**Export Methods:**
- `exportToJSON()` - Export raw performance snapshot
- `exportStatsSummary()` - Export statistical summary

**Utility Methods:**
- `setEnabled(enabled: boolean)` - Enable/disable collection
- `clear()` - Clear all metrics
- `setMaxHistorySize(size: number)` - Set history buffer size (default: 300 frames)

---

### 2. Benchmark Utilities

**Location:** `src/utils/benchmark.ts`

High-precision timing and statistical analysis for performance testing.

#### Basic Usage

```typescript
import { benchmark, benchmarkAsync, Timer } from '@utils/benchmark';

// Benchmark a synchronous function
const result = benchmark(() => {
  // Code to benchmark
  calculateComplexOperation();
}, {
  iterations: 100,
  warmup: 10,
  name: 'complex-operation',
});

console.log(`Mean: ${result.stats.mean}ms`);
console.log(`P95: ${result.stats.p95}ms`);

// Benchmark an async function
const asyncResult = await benchmarkAsync(async () => {
  await loadModel();
}, {
  iterations: 50,
  name: 'model-loading',
});

// Use Timer for manual timing
const timer = new Timer();
timer.start();
// ... operation ...
const elapsed = timer.stop();
console.log(`Operation took ${elapsed}ms`);
```

#### Benchmark Suite

```typescript
import { benchmarkSuite } from '@utils/benchmark';

const results = await benchmarkSuite([
  {
    name: 'ik-solve',
    fn: () => ikSolver.solve(target),
    options: { iterations: 100 },
  },
  {
    name: 'physics-step',
    fn: () => physicsEngine.step(deltaTime),
    options: { iterations: 100 },
  },
  {
    name: 'render-frame',
    fn: () => scene.render(),
    options: { iterations: 100 },
  },
]);

// Results are automatically compared and printed
```

#### API Reference

**Timing Functions:**
- `measure<T>(fn: () => T)` - Measure synchronous function
- `measureAsync<T>(fn: () => Promise<T>)` - Measure async function

**Benchmarking:**
- `benchmark(fn, options)` - Benchmark synchronous function
- `benchmarkAsync(fn, options)` - Benchmark async function
- `benchmarkSuite(tests)` - Run multiple benchmarks and compare

**Statistics:**
- `calculateStats(values: number[])` - Calculate statistics from array

**Utilities:**
- `compareBenchmarks(results)` - Print comparison table
- `formatBenchmarkResult(result)` - Format result as string
- `exportBenchmarkResults(results, filename?)` - Export to JSON

**Timer Class:**
- `new Timer()` - Create timer
- `timer.start()` - Start timing
- `timer.stop()` - Stop and return elapsed time
- `timer.elapsed()` - Get elapsed time without stopping
- `timer.reset()` - Reset timer

---

### 3. PerformanceMonitor Component

**Location:** `src/ui/components/debug/PerformanceMonitor.tsx`

Real-time performance overlay for development and debugging.

#### Usage

```tsx
import { PerformanceMonitor, usePerformanceMonitor } from '@ui/components/debug/PerformanceMonitor';

function App() {
  const performanceEnabled = usePerformanceMonitor();
  
  return (
    <>
      <PerformanceMonitor 
        enabled={performanceEnabled}
        position="top-right"
        detailed={true}
      />
      {/* Your app */}
    </>
  );
}
```

#### Props

- `enabled?: boolean` - Enable/disable the monitor (default: `true`)
- `position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'` - Overlay position (default: `'top-right'`)
- `updateInterval?: number` - Update interval in ms (default: `200`)
- `detailed?: boolean` - Show detailed metrics (default: `false`)

#### Features

**Displayed Metrics:**
- **FPS** - Frames per second (color-coded: green >55, yellow >30, red <30)
- **Frame Time** - Time per frame in milliseconds
- **Memory** - JavaScript heap size in MB (color-coded: green <100, yellow <300, red >300)
- **Draw Calls** - Number of draw calls per frame (detailed mode)
- **Triangles** - Triangle count (detailed mode)
- **Entities** - Scene entity count (detailed mode)
- **Physics Bodies** - Physics body count (detailed mode)

**Actions:**
- **Clear** - Clear all collected metrics
- **Export** - Export metrics to JSON file

**Collapsible:**
- Click header to expand/collapse
- Collapsed mode shows FPS and memory only

#### Enabling via URL

Add `?debug=true` or `?perf=true` to the URL:
```
http://localhost:5173/?debug=true
```

The monitor is also automatically enabled in development mode (`import.meta.env.DEV`).

---

## Integration with Babylon.js

### SceneCanvas Integration

**Location:** `src/scene/SceneCanvas.tsx`

Add performance monitoring to your scene rendering loop:

```typescript
import { performanceMetrics } from '@core/PerformanceMetrics';

// In your render loop
scene.onBeforeRenderObservable.add(() => {
  const frameStartTime = performance.now();
  
  // Your render logic...
  
  const frameTime = performance.now() - frameStartTime;
  const fps = engine.getFps();
  
  performanceMetrics.recordFrame({
    fps,
    frameTime,
    drawCalls: scene.getActiveMeshes().length,
    triangles: scene.getTotalVertices(),
    entities: entityRegistry.getAll().length,
    physicsBodies: physicsEngine.getBodyCount(),
  });
  
  // Record memory every 60 frames (~1 second at 60 FPS)
  if (scene.getFrameId() % 60 === 0) {
    performanceMetrics.recordMemory();
  }
});
```

### Timing Operations

```typescript
import { performanceMetrics } from '@core/PerformanceMetrics';

// Time IK solve
performanceMetrics.startOperation('ik-solve');
const result = ikSolver.solve(targetPosition);
performanceMetrics.endOperation('ik-solve', {
  chainLength: chain.length,
  iterations: result.iterations,
});

// Time physics step
performanceMetrics.startOperation('physics-step');
physicsEngine.step(deltaTime);
performanceMetrics.endOperation('physics-step', {
  deltaTime,
  bodyCount: physicsEngine.getBodyCount(),
});

// Time file loading
performanceMetrics.startOperation('urdf-load');
await urdfLoader.load(url);
performanceMetrics.endOperation('urdf-load', {
  url,
  fileSize: response.size,
});
```

---

## Performance Targets Validation

### Automated Checks

Create performance tests to validate targets:

```typescript
import { benchmark } from '@utils/benchmark';
import { performanceMetrics } from '@core/PerformanceMetrics';

describe('Performance Targets', () => {
  it('should maintain 60 FPS with 50 objects', () => {
    // Create 50 objects in scene
    for (let i = 0; i < 50; i++) {
      createTestObject();
    }
    
    // Run for 5 seconds
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      scene.render();
    }
    
    const stats = performanceMetrics.getFrameStats();
    expect(stats?.fps.mean).toBeGreaterThanOrEqual(60);
  });
  
  it('should solve IK in <100ms', () => {
    const result = benchmark(() => {
      ikSolver.solve(targetPosition);
    }, { iterations: 100 });
    
    expect(result.stats.p95).toBeLessThan(100);
  });
  
  it('should have <50ms input latency', () => {
    const result = benchmark(() => {
      handleMouseMove(event);
      scene.render();
    }, { iterations: 100 });
    
    expect(result.stats.p95).toBeLessThan(50);
  });
});
```

### Manual Validation

Use the PerformanceMonitor component to manually validate targets:

1. Enable the monitor: `?debug=true`
2. Create test scenario (e.g., 50 objects)
3. Observe FPS, frame time, memory
4. Export metrics for analysis
5. Review operation timings

---

## Best Practices

### 1. Enable in Development Only

```typescript
// Only enable in development or when debugging
const isDev = import.meta.env.DEV;
const hasDebugFlag = new URLSearchParams(window.location.search).get('debug') === 'true';
performanceMetrics.setEnabled(isDev || hasDebugFlag);
```

### 2. Avoid Overhead in Production

Performance monitoring has minimal overhead, but should be disabled in production:

```typescript
// In production build
if (import.meta.env.PROD) {
  performanceMetrics.setEnabled(false);
}
```

### 3. Time Critical Operations Only

Don't time every operation - focus on critical paths:

- ✅ IK solve
- ✅ Physics step
- ✅ File loading
- ✅ Large computations
- ❌ Simple getters/setters
- ❌ Trivial calculations

### 4. Use Benchmarks for Optimization

Before optimizing, benchmark to establish baseline:

```typescript
// Before optimization
const before = benchmark(() => slowFunction(), { iterations: 100 });

// After optimization
const after = benchmark(() => fastFunction(), { iterations: 100 });

// Compare
console.log(`Speedup: ${before.stats.mean / after.stats.mean}x`);
```

### 5. Monitor Memory Over Time

Use the memory tracking to detect leaks:

```typescript
// Run for extended period
setInterval(() => {
  performanceMetrics.recordMemory();
  const memory = performanceMetrics.getCurrentMemory();
  if (memory && memory.usedJSHeapSize > 500 * 1024 * 1024) {
    console.warn('High memory usage detected:', memory.usedJSHeapSize / 1024 / 1024, 'MB');
  }
}, 5000);
```

---

## Troubleshooting

### Memory API Not Available

The `performance.memory` API is Chrome-only and requires specific flags:

**Chrome:**
- Run with `--enable-precise-memory-info` flag
- Or use Chrome DevTools Memory Profiler

**Other Browsers:**
- Memory monitoring will be disabled automatically
- Use browser DevTools instead

### Low FPS

If FPS is below target (60 FPS):

1. **Check draw calls:** Should be <500 for smooth performance
2. **Check triangle count:** Optimize mesh complexity
3. **Check entity count:** Too many physics bodies?
4. **Profile with Chrome DevTools:** Identify bottlenecks
5. **Use scene optimizer:** `BABYLON.SceneOptimizer`

### High Memory Usage

If memory usage is increasing over time:

1. **Export metrics:** `performanceMetrics.exportStatsSummary()`
2. **Check for leaks:** Use Chrome DevTools Memory Profiler
3. **Dispose resources:** Ensure meshes, materials, textures are disposed
4. **Clear physics bodies:** Remove unused physics bodies

---

## Examples

### Example 1: Basic Integration

```typescript
import { performanceMetrics } from '@core/PerformanceMetrics';
import { PerformanceMonitor } from '@ui/components/debug/PerformanceMonitor';

function App() {
  useEffect(() => {
    performanceMetrics.setEnabled(import.meta.env.DEV);
  }, []);
  
  return (
    <>
      <PerformanceMonitor enabled={import.meta.env.DEV} position="top-right" />
      <SceneCanvas />
    </>
  );
}
```

### Example 2: Benchmark Suite

```typescript
import { benchmarkSuite } from '@utils/benchmark';

const results = await benchmarkSuite([
  {
    name: 'IK Solve (6 DOF)',
    fn: () => ikSolver.solve(target),
    options: { iterations: 100 },
  },
  {
    name: 'Physics Step',
    fn: () => physicsEngine.step(0.016),
    options: { iterations: 100 },
  },
  {
    name: 'Render Frame',
    fn: () => scene.render(),
    options: { iterations: 60 },
  },
]);

// Results printed automatically with comparison table
```

### Example 3: Operation Timing

```typescript
import { performanceMetrics } from '@core/PerformanceMetrics';

// Time complex operation
performanceMetrics.startOperation('boolean-operation');
const result = performBooleanOperation(meshA, meshB);
performanceMetrics.endOperation('boolean-operation', {
  operationType: 'union',
  verticesA: meshA.getTotalVertices(),
  verticesB: meshB.getTotalVertices(),
});

// Later, analyze
const stats = performanceMetrics.getOperationStats('boolean-operation');
console.log(`Boolean ops P95: ${stats?.p95}ms`);
```

---

## Performance Dashboard (Future)

**Planned Enhancement:** Web-based performance dashboard

Features:
- Real-time graphs (FPS, memory, operations)
- Historical data analysis
- Performance regression detection
- Automated alerts for performance issues
- Export reports

---

## Related Documentation

- [Testing Guide](./TESTING_GUIDE.md) - Performance testing infrastructure
- [CI/CD Guide](./CI_CD.md) - Automated performance tests
- [Performance Optimization](./PERFORMANCE_OPTIMIZATION.md) - Optimization strategies

---

**Questions?** Post in `#dev-performance` Slack channel.
