# Agent 4: Performance Optimization & Testing Infrastructure

## 🎯 Mission
Build a comprehensive performance monitoring and testing infrastructure for kinetiCORE to ensure production-ready performance, stability, and scalability.

## 📊 Current State Analysis

### What Exists
- ✅ Basic test structure (`tests/` directory with Python tests)
- ✅ Some test files: `TEST_RESULTS.md`, `TEST_STATUS.md`, `TESTING_COMPLETE_SUMMARY.md`
- ✅ Unit testing guide: `UNIT_TESTING_GUIDE.md`
- ✅ Production build process (`npm run build`)
- ✅ TypeScript strict mode enabled
- ✅ CI/CD pipeline (GitHub Actions)

### What's Missing
- ❌ Performance benchmarking framework
- ❌ Real-time performance monitoring
- ❌ Load testing infrastructure
- ❌ Memory leak detection
- ❌ Frame rate monitoring (60 FPS target)
- ❌ Input latency measurement (<50ms target)
- ❌ Comprehensive frontend unit tests
- ❌ Integration tests for 3D scene operations
- ❌ Performance regression testing
- ❌ Automated performance reports

## 🎯 Success Metrics

### Performance Targets (from project context)
- **60 FPS** with 50 objects in scene
- **<50ms** input latency
- **<3s** initial load time
- **<500ms** file import time for standard CAD files
- **<100ms** IK solve time
- **Zero memory leaks** in 1-hour session

### Testing Coverage Targets
- **>80%** code coverage for core modules
- **>90%** code coverage for physics abstraction
- **100%** of user workflows have integration tests
- **Zero** regression in performance tests

## 📋 Implementation Plan

### **Phase 1: Performance Monitoring Infrastructure** (Days 1-4)

#### 1.1 Real-Time Performance Monitor Component
**File:** `src/ui/components/PerformanceMonitor.tsx`
```typescript
// Features:
// - FPS counter (real-time)
// - Memory usage tracking
// - Draw call count
// - Active entities count
// - Physics body count
// - Input latency measurement
// - Toggle-able overlay (dev mode only)
```

#### 1.2 Performance Metrics Store
**File:** `src/core/PerformanceMetrics.ts`
```typescript
// Centralized performance data collection
// - Frame timing history
// - Memory snapshots
// - Operation timing (IK solve, physics step, render)
// - Export to JSON for analysis
```

#### 1.3 Performance Benchmarking Utilities
**File:** `src/utils/benchmark.ts`
```typescript
// Utilities for timing operations
// - High-precision timer wrapper
// - Statistical analysis (mean, p50, p95, p99)
// - Benchmark suite runner
```

**Deliverables:**
- ✅ Real-time performance overlay
- ✅ Performance data collection system
- ✅ Benchmark utilities
- ✅ Documentation: `docs/PERFORMANCE_MONITORING.md`

### **Phase 2: Testing Infrastructure** (Days 5-8)

#### 2.1 Frontend Unit Testing Setup
**File:** `vitest.config.ts` (or `jest.config.js`)
```typescript
// Configure testing framework
// - Vitest (recommended for Vite projects)
// - React Testing Library
// - Babylon.js mocking
// - Coverage reporting
```

#### 2.2 Core Module Tests
**Files to create:**
- `src/core/__tests__/CoordinateSystem.test.ts`
- `src/core/__tests__/SceneEntity.test.ts`
- `src/physics/__tests__/PhysicsEngine.test.ts`
- `src/physics/__tests__/IKSolver.test.ts`
- `src/entities/__tests__/EntityRegistry.test.ts`

#### 2.3 UI Component Tests
**Files to create:**
- `src/ui/components/__tests__/Header.test.tsx`
- `src/ui/components/__tests__/FloatingPanel.test.tsx`
- `src/ui/components/__tests__/MotionPanel.test.tsx`
- `src/manipulation/__tests__/TransformGizmo.test.ts`

#### 2.4 Integration Test Suite
**File:** `tests/integration/` directory
```typescript
// End-to-end workflow tests
// - Load URDF → Visualize → Manipulate → IK solve
// - Import CAD → Create physics body → Simulate
// - Multi-selection → Group operations → Undo/Redo
```

**Deliverables:**
- ✅ Testing framework configured
- ✅ >50% code coverage for core modules
- ✅ Component tests for UI
- ✅ Integration test suite
- ✅ Documentation: `docs/TESTING_GUIDE.md`

### **Phase 3: Performance Optimization** (Days 9-12)

#### 3.1 Scene Performance Optimization
**Focus areas:**
- **Mesh instancing** for repeated objects
- **Level of Detail (LOD)** for complex models
- **Frustum culling** optimization
- **Texture compression** and atlasing
- **Geometry optimization** (merge static meshes)

**Files to analyze/optimize:**
- `src/scene/SceneCanvas.tsx`
- `src/entities/EntityRegistry.ts`
- `src/loaders/` (all loader files)

#### 3.2 Physics Performance Optimization
**Focus areas:**
- **Spatial partitioning** for collision detection
- **Sleep/wake** optimization for static bodies
- **Contact pair filtering**
- **Fixed timestep** tuning

**Files to analyze/optimize:**
- `src/physics/RapierPhysicsEngine.ts`
- `src/physics/PhysicsEngine.ts`

#### 3.3 React Performance Optimization
**Focus areas:**
- **Zustand selector optimization**
- **Memo/useMemo/useCallback** for expensive computations
- **Virtual scrolling** for large lists
- **Debouncing/throttling** for input handlers
- **Code splitting** for lazy loading

**Files to analyze/optimize:**
- `src/ui/stores/editorStore.ts`
- All component files in `src/ui/components/`

#### 3.4 Memory Leak Detection & Prevention
**Tools:**
- Chrome DevTools Memory Profiler
- Performance.memory API
- Automated leak detection in tests

**Focus areas:**
- Babylon.js resource disposal
- Physics body cleanup
- Event listener cleanup
- React cleanup in useEffect

**Deliverables:**
- ✅ Scene rendering optimized (60 FPS with 50+ objects)
- ✅ Physics simulation optimized
- ✅ React re-render optimization
- ✅ Memory leak audit complete
- ✅ Performance benchmarks meet targets
- ✅ Documentation: `docs/PERFORMANCE_OPTIMIZATION.md`

### **Phase 4: Automated Testing & CI/CD Integration** (Days 13-16)

#### 4.1 Performance Regression Testing
**File:** `.github/workflows/performance-tests.yml`
```yaml
# Automated performance benchmarks on PR
# - Run benchmark suite
# - Compare against main branch baseline
# - Fail if >10% regression
# - Post results as PR comment
```

#### 4.2 Lighthouse CI Integration
**File:** `lighthouserc.json`
```json
// Automated Lighthouse audits
// - Performance score >90
// - Accessibility score >90
// - Best practices score >90
```

#### 4.3 Visual Regression Testing
**Tool:** Playwright or Percy
```typescript
// Screenshot comparison tests
// - UI component rendering
// - 3D scene rendering
// - Ensure no unintended visual changes
```

#### 4.4 Load Testing
**File:** `tests/load/` directory
```typescript
// Stress testing scenarios
// - 100+ objects in scene
// - Rapid user interactions
// - Memory usage over time
// - Long-running sessions (1+ hour)
```

**Deliverables:**
- ✅ Performance regression tests in CI
- ✅ Lighthouse CI configured
- ✅ Visual regression testing
- ✅ Load testing suite
- ✅ Automated performance reports
- ✅ Documentation: `docs/CI_CD_TESTING.md`

## 🗂️ Files to Work With

### Primary Files to Create
1. `src/ui/components/PerformanceMonitor.tsx` - Real-time performance overlay
2. `src/core/PerformanceMetrics.ts` - Performance data collection
3. `src/utils/benchmark.ts` - Benchmarking utilities
4. `vitest.config.ts` - Testing framework configuration
5. `tests/integration/` - Integration test suite
6. `.github/workflows/performance-tests.yml` - Performance CI
7. `docs/PERFORMANCE_MONITORING.md` - Performance guide
8. `docs/TESTING_GUIDE.md` - Testing guide
9. `docs/PERFORMANCE_OPTIMIZATION.md` - Optimization guide

### Primary Files to Analyze/Optimize
1. `src/scene/SceneCanvas.tsx` - Scene rendering performance
2. `src/physics/RapierPhysicsEngine.ts` - Physics performance
3. `src/entities/EntityRegistry.ts` - Entity management performance
4. `src/ui/stores/editorStore.ts` - State management optimization
5. All loader files in `src/loaders/` - Import performance

### Reference Files
1. `UNIT_TESTING_GUIDE.md` - Existing testing documentation
2. `TEST_STATUS.md` - Current testing status
3. `TESTING_COMPLETE_SUMMARY.md` - Testing summary
4. `docs/PHYSICS_API.md` - Physics system documentation
5. `COORDINATE_SYSTEM.md` - Coordinate system standard

## 🛠️ Technical Requirements

### Testing Tools to Install
```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom
npm install -D @testing-library/user-event happy-dom
npm install -D @playwright/test
npm install -D lighthouse lighthouse-ci
```

### Performance Monitoring Tools
```bash
npm install stats.js  # FPS/memory monitor
npm install web-vitals  # Core Web Vitals
```

### Babylon.js Performance Tools
- Use `scene.debugLayer` for analysis
- `BABYLON.SceneOptimizer` for automatic optimization
- `BABYLON.PerformanceMonitor` for profiling

## 📐 Implementation Details

### Performance Monitor Component Pattern
```typescript
// src/ui/components/PerformanceMonitor.tsx
import { useEffect, useRef, useState } from 'react';
import Stats from 'stats.js';

export function PerformanceMonitor({ enabled }: { enabled: boolean }) {
  const statsRef = useRef<Stats>();
  const [metrics, setMetrics] = useState({
    fps: 60,
    memory: 0,
    drawCalls: 0,
    entities: 0
  });

  useEffect(() => {
    if (!enabled) return;
    
    const stats = new Stats();
    stats.showPanel(0); // FPS
    document.body.appendChild(stats.dom);
    statsRef.current = stats;

    return () => {
      stats.dom.remove();
    };
  }, [enabled]);

  // Update metrics from scene/physics
  // ...

  if (!enabled) return null;

  return (
    <div className="performance-overlay">
      <div>FPS: {metrics.fps.toFixed(1)}</div>
      <div>Memory: {(metrics.memory / 1024 / 1024).toFixed(1)} MB</div>
      <div>Draw Calls: {metrics.drawCalls}</div>
      <div>Entities: {metrics.entities}</div>
    </div>
  );
}
```

### Benchmark Utility Pattern
```typescript
// src/utils/benchmark.ts
export class Benchmark {
  private results: number[] = [];

  async measure<T>(fn: () => T | Promise<T>, iterations = 100): Promise<BenchmarkResult> {
    this.results = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      this.results.push(end - start);
    }

    return this.analyze();
  }

  private analyze(): BenchmarkResult {
    const sorted = this.results.sort((a, b) => a - b);
    return {
      mean: sorted.reduce((a, b) => a + b) / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }
}
```

### Testing Pattern Example
```typescript
// src/core/__tests__/CoordinateSystem.test.ts
import { describe, it, expect } from 'vitest';
import { CoordinateSystem } from '../CoordinateSystem';

describe('CoordinateSystem', () => {
  it('should convert mm to meters correctly', () => {
    const result = CoordinateSystem.mmToMeters(1000);
    expect(result).toBe(1);
  });

  it('should maintain Z-up coordinate system', () => {
    const up = CoordinateSystem.getUpAxis();
    expect(up).toEqual({ x: 0, y: 0, z: 1 });
  });
});
```

## 🎯 Success Criteria

### Phase 1 Complete When:
- [ ] Performance monitor displays real-time FPS, memory, draw calls
- [ ] Performance metrics can be exported to JSON
- [ ] Benchmark utilities can measure operation timing
- [ ] Documentation covers how to use monitoring tools

### Phase 2 Complete When:
- [ ] Testing framework is configured and running
- [ ] Core modules have >50% test coverage
- [ ] UI components have basic tests
- [ ] Integration tests cover main user workflows
- [ ] `npm test` runs successfully

### Phase 3 Complete When:
- [ ] Scene maintains 60 FPS with 50+ objects
- [ ] Input latency is <50ms
- [ ] No memory leaks detected in 1-hour test
- [ ] All performance targets met
- [ ] Performance optimization guide documented

### Phase 4 Complete When:
- [ ] Performance tests run automatically in CI
- [ ] Lighthouse CI configured with passing thresholds
- [ ] Visual regression tests prevent UI breakage
- [ ] Load tests validate system stability
- [ ] Automated performance reports generated

## 🚀 Getting Started

### Day 1 Checklist
1. ✅ Read this project file
2. ✅ Review existing test infrastructure (`UNIT_TESTING_GUIDE.md`)
3. ✅ Install testing dependencies
4. ✅ Create `PerformanceMonitor.tsx` component
5. ✅ Add performance monitor to dev mode
6. ✅ Test FPS counter works

### Quick Start Commands
```bash
# Install dependencies
npm install

# Run existing tests
npm test

# Check current performance
npm run dev
# (Add ?debug=true to URL to enable performance monitor)

# Type checking
npm run type-check

# Build
npm run build
```

## 📞 Team Coordination

### Dependencies
- **Agent 1 (George):** Physics abstraction performance targets
- **Agent 2:** Full-body IK performance requirements
- **Agent 3:** Code review findings to address

### Communication
- Post performance benchmark results in `#dev-performance` Slack
- Notify team before major optimization refactors
- Share testing patterns in `#dev-testing`

### Integration Points
- Performance monitor in dev mode (coordinate with Edwin/UI team)
- Testing patterns shared across all agents
- CI/CD performance gates (coordinate with Agent 1/CI team)

## 📚 Resources

### Performance Resources
- [Babylon.js Performance Docs](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene)
- [React Performance Optimization](https://react.dev/reference/react/memo)
- [Web Vitals](https://web.dev/vitals/)

### Testing Resources
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)

### Tools
- Chrome DevTools Performance
- Chrome DevTools Memory Profiler
- Lighthouse CI
- Stats.js

## 📝 Notes

- **Performance monitoring should NOT impact production performance**
  - Use feature flags to disable in production
  - Keep monitoring code lightweight
  
- **Test coverage is important, but don't test implementation details**
  - Focus on behavior, not internals
  - Integration tests > unit tests for UI
  
- **Performance optimization requires measurement first**
  - Always benchmark before and after changes
  - Document performance improvements
  
- **Coordinate with other agents on breaking changes**
  - Performance optimizations may require refactoring
  - Testing infrastructure benefits all agents

## 🎯 Priority

**MEDIUM** - Production readiness

This work is critical for ensuring kinetiCORE is production-ready, but can be done in parallel with other feature development. Performance monitoring should be implemented early to catch regressions.

---

**Agent 4, you are cleared for takeoff! 🚀**

Read this file, understand your mission, and start with Phase 1. You have all the context you need to build a world-class performance and testing infrastructure for kinetiCORE.
