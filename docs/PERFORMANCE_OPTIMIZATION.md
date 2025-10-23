# Performance Optimization Guide

**Status:** ✅ Active  
**Created:** 2025-10-23  
**Owner:** Agent 4  
**Performance Targets:** 60 FPS with 50+ objects, <50ms input latency

---

## Executive Summary

This guide provides actionable performance optimization strategies for kinetiCORE based on analysis of the current codebase. All recommendations are prioritized by impact and implementation difficulty.

### Current Architecture Analysis

**Rendering Loop (SceneCanvas.tsx:231-240):**
```typescript
engine?.runRenderLoop(() => {
  physicsEngine.step(1 / 60);         // Fixed timestep physics
  registry.syncAllFromPhysics();      // Sync physics → meshes
  scene.render();                     // Render frame
});
```

**Key Findings:**
- ✅ Fixed timestep physics (1/60s) - Good
- ⚠️ No frame timing measurements
- ⚠️ No draw call optimization
- ⚠️ No LOD (Level of Detail) system
- ⚠️ Physics runs every frame (even when static)

---

## Priority 1: Critical Optimizations (Immediate Impact)

### 1.1 Integrate Performance Monitoring

**Impact:** High (enables measurement)  
**Difficulty:** Low  
**Time:** 1 hour

Add performance tracking to the render loop:

```typescript
// src/ui/components/SceneCanvas.tsx
import { performanceMetrics } from '@core/PerformanceMetrics';

engine?.runRenderLoop(() => {
  const frameStart = performance.now();
  
  // Physics step
  performanceMetrics.startOperation('physics-step');
  physicsEngine.step(1 / 60);
  performanceMetrics.endOperation('physics-step');
  
  // Sync entities
  performanceMetrics.startOperation('entity-sync');
  registry.syncAllFromPhysics();
  performanceMetrics.endOperation('entity-sync');
  
  // Render
  scene.render();
  
  // Record frame metrics
  const frameTime = performance.now() - frameStart;
  performanceMetrics.recordFrame({
    fps: engine.getFps(),
    frameTime,
    drawCalls: scene.getActiveMeshes().length,
    triangles: scene.getTotalVertices(),
    entities: registry.getAll().length,
    physicsBodies: physicsEngine.getBodyCount(),
  });
  
  // Record memory every second
  if (scene.getFrameId() % 60 === 0) {
    performanceMetrics.recordMemory();
  }
});
```

**Expected Improvement:** Enables data-driven optimization

### 1.2 Optimize Physics Updates (Sleep/Wake)

**Impact:** High (30-50% CPU reduction)  
**Difficulty:** Medium  
**Time:** 4 hours

**Problem:** Physics runs every frame even for static objects.

**Solution:** Implement sleep/wake system.

```typescript
// src/physics/RapierPhysicsEngine.ts

export class RapierPhysicsEngine {
  private lastActiveFrame = new Map<number, number>();
  private sleepThreshold = 0.001; // velocity threshold
  private sleepTimeout = 60; // frames of inactivity before sleep
  
  step(deltaTime: number): void {
    const currentFrame = this.frameCount++;
    
    // Only step physics for active bodies
    this.world.bodies.forEach(body => {
      const bodyId = body.handle;
      const velocity = body.linvel();
      const isActive = velocity.length() > this.sleepThreshold;
      
      if (isActive) {
        this.lastActiveFrame.set(bodyId, currentFrame);
      } else {
        const lastActive = this.lastActiveFrame.get(bodyId) || 0;
        if (currentFrame - lastActive > this.sleepTimeout) {
          // Put body to sleep
          body.setSleeping(true);
        }
      }
    });
    
    // Step simulation (Rapier handles sleeping bodies efficiently)
    this.world.step();
  }
}
```

**Expected Improvement:** 30-50% CPU reduction for scenes with static objects

### 1.3 Frustum Culling Optimization

**Impact:** High (20-40% GPU reduction)  
**Difficulty:** Low  
**Time:** 2 hours

**Problem:** All meshes rendered even if off-screen.

**Solution:** Ensure frustum culling is enabled.

```typescript
// src/scene/services/EngineService.ts

export class EngineService {
  createEngine(canvas: HTMLCanvasElement): BABYLON.Engine {
    const engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      // Performance optimizations
      doNotHandleContextLost: true,
      powerPreference: "high-performance",
    });
    
    return engine;
  }
}

// In scene setup
scene.autoClear = false;
scene.autoClearDepthAndStencil = false;

// Enable frustum culling
scene.meshes.forEach(mesh => {
  mesh.isPickable = false; // Disable picking for non-interactive meshes
  mesh.alwaysSelectAsActiveMesh = false; // Use frustum culling
});
```

**Expected Improvement:** 20-40% GPU reduction when camera doesn't see all objects

---

## Priority 2: Important Optimizations (High Impact)

### 2.1 Mesh Instancing for Repeated Objects

**Impact:** High (50-80% memory reduction)  
**Difficulty:** Medium  
**Time:** 6 hours

**Problem:** Each robot link creates unique mesh (wasteful for identical geometries).

**Solution:** Use instanced meshes.

```typescript
// src/loaders/URDFLoader.ts

export class URDFLoader {
  private geometryCache = new Map<string, BABYLON.Mesh>();
  
  createLinkMesh(link: URDFLink): BABYLON.Mesh {
    const geometryKey = this.getGeometryKey(link);
    
    // Check if we already have this geometry
    const cachedMesh = this.geometryCache.get(geometryKey);
    
    if (cachedMesh) {
      // Create instance instead of clone
      const instance = cachedMesh.createInstance(`${link.name}-instance`);
      this.applyLinkTransform(instance, link);
      return instance;
    } else {
      // Create new mesh and cache it
      const mesh = this.createMeshFromGeometry(link);
      this.geometryCache.set(geometryKey, mesh);
      return mesh;
    }
  }
  
  private getGeometryKey(link: URDFLink): string {
    // Create unique key based on geometry properties
    return `${link.visual.geometry.type}-${JSON.stringify(link.visual.geometry.size)}`;
  }
}
```

**Expected Improvement:** 50-80% memory reduction, 20-30% faster rendering

### 2.2 Level of Detail (LOD) System

**Impact:** High (30-50% GPU reduction)  
**Difficulty:** High  
**Time:** 8 hours

**Problem:** High-poly models rendered at all distances.

**Solution:** Implement LOD system.

```typescript
// src/scene/LODManager.ts

export class LODManager {
  setupLOD(mesh: BABYLON.Mesh, scene: BABYLON.Scene): void {
    // Create simplified versions
    const lod1 = this.createSimplifiedMesh(mesh, 0.5); // 50% detail
    const lod2 = this.createSimplifiedMesh(mesh, 0.25); // 25% detail
    
    // Add LOD levels
    mesh.addLODLevel(10, mesh);    // Full detail within 10m
    mesh.addLODLevel(50, lod1);    // Medium detail 10-50m
    mesh.addLODLevel(100, lod2);   // Low detail 50-100m
    mesh.addLODLevel(200, null);   // Don't render beyond 200m
  }
  
  private createSimplifiedMesh(
    mesh: BABYLON.Mesh, 
    simplificationFactor: number
  ): BABYLON.Mesh {
    const simplifiedMesh = mesh.clone(`${mesh.name}_LOD`);
    
    // Use Babylon's decimation
    BABYLON.SceneOptimizer.OptimizeMeshes(
      [simplifiedMesh],
      simplificationFactor
    );
    
    return simplifiedMesh;
  }
}
```

**Expected Improvement:** 30-50% GPU reduction for large scenes

### 2.3 Texture Optimization

**Impact:** Medium (20-30% memory reduction)  
**Difficulty:** Medium  
**Time:** 4 hours

**Problem:** Large, uncompressed textures.

**Solution:** Implement texture compression and atlasing.

```typescript
// src/loaders/TextureManager.ts

export class TextureManager {
  private textureCache = new Map<string, BABYLON.Texture>();
  
  loadTexture(
    url: string, 
    scene: BABYLON.Scene
  ): BABYLON.Texture {
    // Check cache first
    if (this.textureCache.has(url)) {
      return this.textureCache.get(url)!;
    }
    
    const texture = new BABYLON.Texture(url, scene, {
      // Optimization settings
      generateMipMaps: true,
      samplingMode: BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
      format: BABYLON.Engine.TEXTUREFORMAT_RGB, // Use RGB if no alpha
      useSRGBBuffer: true,
    });
    
    // Enable compression (if supported)
    if (this.supportsCompression(scene.getEngine())) {
      texture.format = BABYLON.Constants.TEXTUREFORMAT_COMPRESSED_RGBA_S3TC_DXT5;
    }
    
    this.textureCache.set(url, texture);
    return texture;
  }
  
  private supportsCompression(engine: BABYLON.Engine): boolean {
    return engine.getCaps().s3tc !== null;
  }
}
```

**Expected Improvement:** 20-30% memory reduction, faster loading

---

## Priority 3: React Performance (UI Responsiveness)

### 3.1 Zustand Selector Optimization

**Impact:** Medium (eliminates unnecessary re-renders)  
**Difficulty:** Low  
**Time:** 2 hours

**Problem:** Components re-render on irrelevant state changes.

**Current (Bad):**
```typescript
// Re-renders on ANY store change
const state = useEditorStore();
```

**Optimized (Good):**
```typescript
// Only re-renders when selectedMeshes changes
const selectedMeshes = useEditorStore(state => state.selectedMeshes);
const selectMesh = useEditorStore(state => state.selectMesh);
```

**Action Items:**
1. Audit all `useEditorStore()` calls
2. Replace with specific selectors
3. Use `shallow` comparison for arrays/objects:

```typescript
import { shallow } from 'zustand/shallow';

const { selectedMeshes, transformMode } = useEditorStore(
  state => ({
    selectedMeshes: state.selectedMeshes,
    transformMode: state.transformMode,
  }),
  shallow
);
```

### 3.2 Memo Heavy Components

**Impact:** Medium (reduces React reconciliation)  
**Difficulty:** Low  
**Time:** 3 hours

Wrap expensive components with `React.memo()`:

```typescript
// src/ui/components/FloatingPanel.tsx

export const FloatingPanel = React.memo(({
  title,
  children,
  onClose,
}: FloatingPanelProps) => {
  return (
    <div className="floating-panel">
      <header>{title}</header>
      <button onClick={onClose}>×</button>
      {children}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison (only re-render if title or children change)
  return prevProps.title === nextProps.title &&
         prevProps.children === nextProps.children;
});
```

### 3.3 Debounce Input Handlers

**Impact:** Medium (prevents excessive updates)  
**Difficulty:** Low  
**Time:** 2 hours

**Problem:** Input handlers fire on every keystroke/mouse move.

**Solution:** Debounce expensive operations.

```typescript
import { useMemo } from 'react';
import { debounce } from 'lodash-es';

export function TransformPanel() {
  const handlePositionChange = useMemo(
    () => debounce((axis: 'x' | 'y' | 'z', value: number) => {
      updateMeshPosition(axis, value);
    }, 100), // 100ms debounce
    []
  );
  
  return (
    <NumericInput 
      onChange={(value) => handlePositionChange('x', value)} 
    />
  );
}
```

---

## Priority 4: Memory Leak Prevention

### 4.1 Proper Resource Disposal

**Impact:** Critical (prevents crashes)  
**Difficulty:** Medium  
**Time:** 6 hours

**Checklist:**

1. **Meshes & Materials:**
```typescript
mesh.dispose(false, true); // Dispose geometry and materials
```

2. **Textures:**
```typescript
texture.dispose();
```

3. **Physics Bodies:**
```typescript
physicsBody.dispose();
world.removeRigidBody(body);
```

4. **Event Listeners:**
```typescript
useEffect(() => {
  const observer = scene.onBeforeRenderObservable.add(() => {
    // ...
  });
  
  return () => {
    scene.onBeforeRenderObservable.remove(observer);
  };
}, []);
```

5. **Babylon.js Observables:**
```typescript
// Always remove observers
scene.onBeforeRenderObservable.clear();
engine.onResizeObservable.clear();
```

### 4.2 Memory Leak Detection

Add automated leak detection:

```typescript
// src/utils/memoryLeakDetector.ts

export class MemoryLeakDetector {
  private snapshots: number[] = [];
  
  startMonitoring(intervalMs = 5000): void {
    setInterval(() => {
      const memory = (performance as any).memory;
      if (!memory) return;
      
      this.snapshots.push(memory.usedJSHeapSize);
      
      // Check for consistent growth
      if (this.snapshots.length > 10) {
        const trend = this.calculateTrend();
        if (trend > 0.05) { // >5% growth per interval
          console.warn('Potential memory leak detected!');
          console.warn('Memory trend:', trend);
        }
        
        // Keep last 10 snapshots
        this.snapshots = this.snapshots.slice(-10);
      }
    }, intervalMs);
  }
  
  private calculateTrend(): number {
    // Simple linear regression
    const n = this.snapshots.length;
    const sum = this.snapshots.reduce((a, b) => a + b, 0);
    return (this.snapshots[n - 1] - this.snapshots[0]) / sum;
  }
}
```

---

## Performance Benchmarks

### Current Performance (Pre-Optimization)

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| FPS (50 objects) | 60 FPS | ⏳ TBD | 🔍 Measuring |
| Input Latency | <50ms | ⏳ TBD | 🔍 Measuring |
| Load Time | <3s | ⏳ TBD | 🔍 Measuring |
| IK Solve | <100ms | ⏳ TBD | 🔍 Measuring |
| Memory (1hr) | No leaks | ⏳ TBD | 🔍 Measuring |

### Post-Optimization Targets

| Optimization | Expected FPS Gain | Expected Memory Reduction |
|--------------|-------------------|---------------------------|
| Frustum Culling | +20-40% | - |
| Mesh Instancing | +20-30% | 50-80% |
| LOD System | +30-50% | - |
| Physics Sleep | +30-50% CPU | - |
| Texture Optimization | - | 20-30% |

---

## Implementation Roadmap

### Week 1: Foundation
- [x] Integrate performance monitoring
- [ ] Measure baseline performance
- [ ] Identify bottlenecks

### Week 2: Critical Path
- [ ] Implement frustum culling optimization
- [ ] Add physics sleep/wake system
- [ ] Optimize Zustand selectors

### Week 3: Scene Optimization
- [ ] Implement mesh instancing
- [ ] Add LOD system
- [ ] Optimize textures

### Week 4: Polish
- [ ] Memory leak audit
- [ ] React component optimization
- [ ] Final performance validation

---

## Monitoring & Validation

### How to Measure

1. **Enable Performance Monitor:**
```
http://localhost:5173/?debug=true
```

2. **Run Benchmark Suite:**
```bash
npm run benchmark
```

3. **Load Test:**
```typescript
// Create 50 objects and measure FPS
for (let i = 0; i < 50; i++) {
  createTestObject();
}

// Monitor for 10 seconds
setTimeout(() => {
  const stats = performanceMetrics.getFrameStats();
  console.log('Average FPS:', stats.fps.mean);
}, 10000);
```

### Performance Regression Tests

```typescript
// tests/performance/scene-rendering.test.ts

describe('Scene Rendering Performance', () => {
  it('should maintain 60 FPS with 50 objects', () => {
    // Test implementation
  });
  
  it('should have <50ms input latency', () => {
    // Test implementation
  });
});
```

---

## Tools & Resources

### Babylon.js Tools
- **Scene Inspector:** Press `Shift+Ctrl+Alt+I` in dev
- **Scene Optimizer:** `BABYLON.SceneOptimizer.OptimizeMeshes()`
- **Performance Monitor:** `scene.debugLayer.show()`

### Chrome DevTools
- **Performance Tab:** Record and analyze frame timing
- **Memory Tab:** Find memory leaks
- **Rendering Tab:** Check paint flashing, layer borders

### External Tools
- **stats.js:** FPS/memory overlay (already integrated)
- **Spector.js:** WebGL call analyzer
- **Chrome Task Manager:** Per-tab resource usage

---

## Quick Wins (Do These First!)

1. ✅ **Add Performance Monitoring** (1 hour)
2. 🔧 **Enable Frustum Culling** (2 hours) 
3. 🔧 **Optimize Zustand Selectors** (2 hours)
4. 🔧 **Debounce Input Handlers** (2 hours)
5. 🔧 **Add Memory Leak Detection** (2 hours)

**Total Quick Wins:** ~9 hours, Expected improvement: 20-30% FPS boost

---

## Related Documentation

- [Performance Monitoring Guide](./PERFORMANCE_MONITORING.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Babylon.js Performance](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene)

---

**Agent 4 Status:** Active - Implementing optimizations  
**Next Update:** Phase 3 completion report
