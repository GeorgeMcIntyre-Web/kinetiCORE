# Agent 4: Performance Optimization & Testing Infrastructure

**Agent:** Agent 4 (Claude Code)  
**Priority:** MEDIUM - Production readiness  
**Timeline:** 12-16 days (4 phases)  
**Status:** 🚀 Ready to Start

---

## 🎯 Mission

Build comprehensive performance testing infrastructure, optimize real-time rendering and physics, and establish production-ready performance benchmarks.

---

## 📊 Current State Analysis

### What Exists ✅
- React + TypeScript + Babylon.js + Rapier physics stack
- Basic CI/CD pipeline (linting, type-checking)
- Some manual testing (no automated performance tests)

### What's Missing ❌
- **No performance benchmarks** - No baseline metrics
- **No automated performance tests** - Manual testing only
- **No profiling infrastructure** - No continuous monitoring
- **No optimization strategy** - Ad-hoc improvements only
- **No regression detection** - Performance can degrade unnoticed

### The Problem 🔥
Performance requirements:
- **60 FPS** with 50+ objects in scene
- **<50ms input latency** for interactive controls
- **<100ms IK solve time** for real-time manipulation
- **<2 MB bundle size** for fast loading

**Currently:** No way to verify these targets or catch regressions.

---

## 📋 Implementation Plan

### Phase 1: Performance Analysis & Baseline (Days 1-4)
**Goal:** Establish performance baselines and identify bottlenecks

**Tasks:**
1. Profile React component rendering (identify slow components)
2. Profile Babylon.js scene rendering (FPS, draw calls, GPU usage)
3. Profile physics simulation (Rapier overhead)
4. Measure IK solver performance (Agent 1 & 2 code)
5. Create performance baseline report

**Tools to Use:**
- Chrome DevTools Performance tab
- React DevTools Profiler
- Babylon.js Inspector
- Custom performance markers (`performance.mark()`)

**Deliverables:**
- `PERFORMANCE_BASELINE.md` (current metrics)
- `BOTTLENECK_ANALYSIS.md` (slow code paths)
- `OPTIMIZATION_PRIORITIES.md` (what to fix first)

---

### Phase 2: Automated Performance Testing (Days 5-9)
**Goal:** Build automated performance test suite

**Tasks:**
1. Create performance test framework (Jest + custom metrics)
2. Add render performance tests (FPS measurement)
3. Add physics performance tests (simulation step time)
4. Add IK solver performance tests (solve time)
5. Add bundle size tests (fail if >2 MB)

**Files to Create:**
- `tests/performance/renderPerformance.test.ts`
- `tests/performance/physicsPerformance.test.ts`
- `tests/performance/ikPerformance.test.ts`
- `tests/performance/bundleSize.test.ts`
- `tests/performance/helpers/performanceTestRunner.ts`

**Success Criteria:**
- Tests run in CI/CD pipeline
- Tests fail if performance regresses >10%
- Performance report generated after each run

---

### Phase 3: Optimization Implementation (Days 10-14)
**Goal:** Optimize identified bottlenecks

**Tasks:**
1. Optimize React re-renders (useMemo, useCallback, React.memo)
2. Optimize Babylon.js scene (LOD, instancing, culling)
3. Optimize physics (sleeping bodies, broad-phase tuning)
4. Optimize IK solver (caching, early exit)
5. Reduce bundle size (code splitting, tree shaking)

**Focus Areas:**
- React component re-renders (especially UI panels)
- Babylon.js draw calls (reduce with instancing)
- Physics collision checks (spatial partitioning)
- IK solver iterations (adaptive iteration count)

**Success Criteria:**
- React re-renders reduced by 50%
- Babylon.js FPS stable at 60 FPS (50+ objects)
- Physics step time <5ms
- IK solve time <50ms
- Bundle size <2 MB

---

### Phase 4: Continuous Performance Monitoring (Days 15-16)
**Goal:** Set up continuous performance monitoring

**Tasks:**
1. Add performance metrics to CI/CD (run on every commit)
2. Create performance dashboard (visualize trends)
3. Add performance regression alerts (Slack notifications)
4. Document performance best practices

**Deliverables:**
- CI/CD integration for performance tests
- Performance dashboard (simple HTML + charts)
- `PERFORMANCE_BEST_PRACTICES.md` (guide for all agents)
- `PERFORMANCE_MONITORING_SETUP.md` (how to use the system)

---

## 🗂️ Key Files to Profile & Optimize

### React Components (Re-render Optimization)
```
src/ui/components/
├── MotionPanel.tsx             (Agent 1 & 2 work - check re-renders)
├── MultiChainPanel.tsx         (Agent 2 work - optimize list rendering)
├── RibbonToolbar.tsx           (Large component - memoize sections)
├── SceneCanvas.tsx             (Critical - avoid re-renders)
└── PropertiesPanel.tsx         (Dynamic content - optimize selectors)
```

### Babylon.js Scene (Render Optimization)
```
src/scene/
├── SceneManager.ts             (Scene setup - check draw calls)
├── EntityRenderer.ts           (Entity rendering - use instancing?)
└── LightingManager.ts          (Lighting - reduce shadow maps?)

src/manipulation/
├── TransformGizmo.ts           (Gizmo rendering - optimize lines)
└── IKTargetGizmo.ts            (Agent 1 work - check overhead)
```

### Physics (Simulation Optimization)
```
src/physics/
├── RapierPhysicsEngine.ts      (Physics step - profile collision checks)
└── CollisionHandler.ts         (Collision detection - optimize broad-phase)
```

### Kinematics (IK Solver Optimization)
```
src/kinematics/
├── IKSolver.ts                 (Agent 1 work - profile iterations)
├── MultiChainIKSolver.ts       (Agent 2 work - profile multi-chain)
└── Constraints.ts              (Agent 2 work - check constraint overhead)
```

---

## 🛠️ Performance Testing Framework

### Test Structure
```typescript
// tests/performance/performanceTestRunner.ts
export class PerformanceTestRunner {
  private metrics: Map<string, number[]> = new Map();
  
  measure(name: string, fn: () => void): number {
    const start = performance.now();
    fn();
    const duration = performance.now() - start;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
    
    return duration;
  }
  
  getAverage(name: string): number {
    const values = this.metrics.get(name) || [];
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  getP95(name: string): number {
    const values = this.metrics.get(name) || [];
    const sorted = values.sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index];
  }
}
```

### Example: Render Performance Test
```typescript
// tests/performance/renderPerformance.test.ts
import { PerformanceTestRunner } from './helpers/performanceTestRunner';
import { SceneManager } from '../../src/scene/SceneManager';

describe('Render Performance', () => {
  const runner = new PerformanceTestRunner();
  let scene: SceneManager;
  
  beforeEach(() => {
    scene = new SceneManager();
  });
  
  test('should render 50 objects at 60 FPS', () => {
    // Add 50 objects to scene
    for (let i = 0; i < 50; i++) {
      scene.addEntity({ type: 'box' });
    }
    
    // Measure frame time over 100 frames
    const frameTimes: number[] = [];
    for (let i = 0; i < 100; i++) {
      const frameTime = runner.measure('frame', () => {
        scene.render();
      });
      frameTimes.push(frameTime);
    }
    
    // Check average FPS
    const avgFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
    const fps = 1000 / avgFrameTime;
    
    expect(fps).toBeGreaterThanOrEqual(60);
  });
});
```

### Example: IK Solver Performance Test
```typescript
// tests/performance/ikPerformance.test.ts
import { PerformanceTestRunner } from './helpers/performanceTestRunner';
import { IKSolver } from '../../src/kinematics/IKSolver';

describe('IK Solver Performance', () => {
  const runner = new PerformanceTestRunner();
  
  test('should solve IK in <50ms', () => {
    const solver = new IKSolver();
    const chain = createTestChain(); // 6-DOF arm
    const target = { position: [0.5, 0.5, 0.5], rotation: [0, 0, 0, 1] };
    
    // Measure solve time over 100 iterations
    for (let i = 0; i < 100; i++) {
      runner.measure('ik-solve', () => {
        solver.solve(chain, target);
      });
    }
    
    const avgTime = runner.getAverage('ik-solve');
    const p95Time = runner.getP95('ik-solve');
    
    expect(avgTime).toBeLessThan(50);
    expect(p95Time).toBeLessThan(100);
  });
});
```

---

## 📏 Success Metrics

### Phase 1 Success (Baseline)
- [ ] Performance baseline report complete
- [ ] Bottlenecks identified and prioritized
- [ ] Current metrics documented
  - React re-render count
  - Babylon.js FPS (with 50 objects)
  - Physics step time
  - IK solve time
  - Bundle size

### Phase 2 Success (Testing Infrastructure)
- [ ] Automated performance tests written
- [ ] Tests run in CI/CD pipeline
- [ ] Tests fail on regression (>10% slower)
- [ ] Performance report generated

### Phase 3 Success (Optimization)
- [ ] React re-renders reduced by 50%
- [ ] Babylon.js FPS stable at 60 (50+ objects)
- [ ] Physics step time <5ms
- [ ] IK solve time <50ms
- [ ] Bundle size <2 MB

### Phase 4 Success (Monitoring)
- [ ] CI/CD integration complete
- [ ] Performance dashboard live
- [ ] Regression alerts configured
- [ ] Best practices documented

### Overall Success
- [ ] All performance targets met
- [ ] No regressions detected in CI/CD
- [ ] Optimization guide complete
- [ ] Monitoring system operational

---

## 🚀 Getting Started

### Step 1: Install Performance Tools
```bash
# Install testing dependencies
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D jest-performance-testing

# Install profiling tools
npm install -D webpack-bundle-analyzer source-map-explorer
```

### Step 2: Profile Current Performance
```bash
# Build and analyze bundle
npm run build
npx webpack-bundle-analyzer dist/stats.json

# Run app and profile in Chrome DevTools
npm run dev
# Open http://localhost:5173
# Open Chrome DevTools > Performance > Record
```

### Step 3: Create Baseline Report
```bash
# Create reports directory
mkdir -p reports

# Start baseline report
touch reports/PERFORMANCE_BASELINE.md
```

---

## 📋 Performance Targets

### Rendering
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| FPS (50 objects) | 60 FPS | ??? | ⚠️ Measure |
| Draw calls | <100 | ??? | ⚠️ Measure |
| Frame time | <16ms | ??? | ⚠️ Measure |

### Physics
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Step time | <5ms | ??? | ⚠️ Measure |
| Collision checks | <1000/frame | ??? | ⚠️ Measure |

### IK Solver
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Single-chain solve | <50ms | ??? | ⚠️ Measure |
| Multi-chain solve | <100ms | ??? | ⚠️ Measure |

### Bundle Size
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Total bundle | <2 MB | ??? | ⚠️ Measure |
| Vendor bundle | <1 MB | ??? | ⚠️ Measure |

---

## 🤝 Coordination with Other Agents

### Agent 1 & Agent 2 Code
- Profile Agent 1's IK solver performance
- Profile Agent 2's multi-chain IK performance
- Optimize their code if needed (coordinate first!)

### Agent 3 Code Review
- Use Agent 3's performance audit as input
- Coordinate on optimization priorities
- Share performance test results

### Agent 5 Documentation
- Document performance testing process
- Share best practices for all agents
- Create performance optimization guides

---

## 📚 Resources

### Performance Profiling
- Chrome DevTools: https://developer.chrome.com/docs/devtools/performance/
- React Profiler: https://react.dev/reference/react/Profiler
- Babylon.js Inspector: https://doc.babylonjs.com/toolsAndResources/inspector

### Optimization Guides
- React Performance: https://react.dev/learn/render-and-commit
- Babylon.js Optimization: https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene
- Bundle Size: https://webpack.js.org/guides/code-splitting/

---

## ❓ Questions or Blockers?

Post in `#dev-blockers` Slack channel if stuck >1 hour.

**Common Issues:**
- **Profiler shows nothing?** → Ensure production build (`npm run build`)
- **Tests flaky?** → Run multiple iterations, use P95 metrics
- **Bundle too large?** → Use `source-map-explorer` to find culprits

---

**Status: READY TO START! 🚀**

Start with Phase 1: Profile current performance and create baseline report.
