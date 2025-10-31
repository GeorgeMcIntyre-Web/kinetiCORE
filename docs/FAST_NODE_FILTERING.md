# Fast Node Filtering Pipeline

## Overview

The FastNodeFilter implements a **multi-stage ICP-based filtering pipeline** for fast early rejection of invalid node pairs in kinematic extraction workflows. This significantly improves performance by avoiding expensive full ICP computations on nodes that will fail anyway.

## Architecture

### 4-Stage Progressive Filtering

```
Input: N node pairs (FIXED/MOVING point clouds)
│
├─ Stage 1: Geometric Pre-filtering (< 1ms per node)
│  ├─ Point count validation
│  ├─ Bounding box checks
│  ├─ Centroid distance validation
│  └─ Size similarity checks
│  → Reject: Empty, identical, or unrealistic pairs
│
├─ Stage 2: Coarse ICP Test (10-20ms per node)
│  ├─ Downsample to 100 points
│  ├─ Fast ICP (20 iterations)
│  ├─ Error threshold validation
│  └─ Motion detection
│  → Reject: No motion or bad correspondence
│
├─ Stage 3: Full ICP Refinement (100-200ms per node)
│  ├─ Full point cloud (200 iterations)
│  ├─ Cascaded registration (ModelAnalyzer3D)
│  ├─ Translation/rotation extraction
│  └─ Range validation
│  → Reject: Out-of-range motion
│
└─ Stage 4: Confidence Scoring
   ├─ Error score (50% weight)
   ├─ Translation score (30% weight)
   ├─ Rotation score (20% weight)
   └─ Final confidence (0-1)
   → Output: Ranked nodes with quality metrics
```

## Performance Characteristics

### Timing Breakdown (Automotive Tooling - 50 units)

| Stage | Time per Node | Total for 50 Nodes | Pass-Through Rate |
|-------|---------------|--------------------|--------------------|
| 1. Geometric | < 1ms | < 50ms | ~80% (40 nodes) |
| 2. Coarse ICP | 15ms | 600ms | ~50% (20 nodes) |
| 3. Full ICP | 150ms | 3000ms | ~90% (18 nodes) |
| 4. Confidence | < 1ms | < 20ms | ~95% (17 nodes) |
| **TOTAL** | **Variable** | **~3.7s** | **34% final** |

**Without filtering:** 50 nodes × 150ms = **7.5s** (2x slower)

### Early Rejection Benefits

- **Stage 1 rejects 10 nodes** → saves 1.5s of ICP computation
- **Stage 2 rejects 20 nodes** → saves 3.0s of full ICP
- **Net speedup:** ~50% reduction in total time

## Configuration Options

### Default Settings (Automotive Tooling)

```typescript
const DEFAULT_FILTER_OPTIONS = {
  minPoints: 50,                    // Minimum points for ICP
  maxCentroidDistance: 2.0,         // 2m max for automotive
  minCentroidDistance: 0.001,       // 1mm minimum motion
  coarsePointCount: 100,            // Downsample target
  coarseMaxIterations: 20,          // Fast ICP iterations
  coarseErrorMin: 0.001,            // 1mm - below = no motion
  coarseErrorMax: 0.5,              // 50cm - above = bad fit
  fullMaxIterations: 200,           // ModelAnalyzer3D proven
  fullErrorTolerance: 1e-7,         // High precision
  translationRange: {
    min: 0.01,                      // 10mm minimum
    max: 2.0                        // 2m maximum
  },
  rotationRange: {
    min: 1.0,                       // 1° minimum
    max: 180.0                      // 180° maximum
  },
  enableDebug: true                 // Detailed logging
};
```

### Customization Examples

**Precision tooling (smaller range):**
```typescript
fastFiltering: {
  maxCentroidDistance: 0.5,        // 50cm max
  translationRange: { min: 0.005, max: 0.5 },
  rotationRange: { min: 0.5, max: 90.0 }
}
```

**Large industrial equipment:**
```typescript
fastFiltering: {
  maxCentroidDistance: 5.0,        // 5m max
  translationRange: { min: 0.05, max: 5.0 },
  rotationRange: { min: 5.0, max: 180.0 }
}
```

## Integration

### Pipeline Usage

The FastNodeFilter is automatically used in `KinematicExtractionPipeline.fitJoints()`:

```typescript
await pipeline.fitJoints({
  useProfessionalICP: true,        // Use icpts (ModelAnalyzer3D)
  fastFiltering: {
    minPoints: 50,
    maxCentroidDistance: 2.0,
    // ... other options
  }
});
```

### Standalone Usage

```typescript
import { FastNodeFilter } from './FastNodeFilter';

const nodePairs = [
  {
    fixedNodeId: 'UNIT_112',
    movingNodeId: 'UNIT_112',
    fixedPoints: retractedPointCloud,
    movingPoints: extendedPointCloud,
  },
  // ... more pairs
];

const filterResults = await FastNodeFilter.filterBatch(nodePairs, {
  enableDebug: true
});

// Process results
for (const [nodeId, result] of filterResults.entries()) {
  if (result.passed && result.stage === 'confidence') {
    console.log(`Node ${nodeId} passed: confidence=${result.metrics.confidence}`);
  } else {
    console.log(`Node ${nodeId} rejected at ${result.stage}: ${result.reason}`);
  }
}
```

## Filter Result Interface

```typescript
interface FilterResult {
  nodeId: string;
  stage: 'prefilter' | 'coarse' | 'full' | 'confidence';
  passed: boolean;
  reason: string;
  metrics?: {
    error?: number;                 // ICP RMS error (meters)
    translationMagnitude?: number;  // Translation length (meters)
    rotationMagnitude?: number;     // Rotation angle (degrees)
    confidence?: number;            // Final confidence score (0-1)
    timeMs?: number;               // Stage execution time
  };
}
```

## Rejection Reasons

### Stage 1: Geometric Pre-filter

- `Insufficient points` - Below minPoints threshold
- `No motion detected` - Centroid distance < minCentroidDistance
- `Unrealistic motion` - Centroid distance > maxCentroidDistance
- `Geometry size mismatch` - Bounding box size differs > 50%

### Stage 2: Coarse ICP

- `No motion detected` - ICP error < coarseErrorMin
- `Bad correspondence` - ICP error > coarseErrorMax
- `Coarse ICP failed` - Algorithm convergence failure

### Stage 3: Full ICP

- `Full ICP failed to converge` - Algorithm failure
- `Translation out of range` - Not in [min, max] range
- `Full ICP error` - Exception during computation

### Stage 4: Confidence (Rarely Rejects)

All nodes reaching stage 4 typically pass. Confidence scores are computed for ranking.

## ModelAnalyzer3D Reference

The filtering pipeline is based on the proven cascaded registration approach from:

```
C:\Users\George\source\repos\ModelAnalyzer3D\ModelAnalyzer3D-master\
├── CascadedPointCloudFit.py
├── IcpFitter.py (forward → reverse ICP)
└── FgrFitter.py (FGR fallback)
```

**Key Parameters Adopted:**
- `maxIterations: 200` - Proven convergence for automotive
- `max_correspondence_distance: 100mm` - Automotive scale
- Forward/reverse ICP pattern for robustness

## Console Output Example

```
[FastFilter] ===== BATCH FILTERING =====
[FastFilter] Input node pairs: 50
[FastFilter] Stage 1 (Geometric): 50 → 40 (45.2ms)
[FastFilter] Stage 2 (Coarse ICP): 40 → 20 (612.4ms)
[FastFilter] Stage 3 (Full ICP): 20 → 18 (2845.1ms)
[FastFilter] Stage 4 (Confidence): Scored 18 nodes (15.3ms)
[FastFilter] ===== TOTAL TIME: 3517.0ms =====
[FastFilter] Final valid nodes: 18/50

[Pipeline] Unit 'UNIT_112_MOVING' rejected at stage 'prefilter': No motion detected (centroid distance: 0.52mm < 1mm)
[Pipeline] Unit 'UNIT_115_MOVING' rejected at stage 'coarse': Bad correspondence (error: 0.752m > 0.5m)
[Pipeline] Running final ICP for unit 'UNIT_110_MOVING'...
[Pipeline] Fitted hinge joint for unit 'UNIT_110_MOVING': magnitude=0.1234, confidence=0.85, filterConfidence=0.92, error=0.0012m
```

## Future Enhancements

### Parallel Processing

Stage 1-2 are embarrassingly parallel:

```typescript
// Potential optimization
const stage1Results = await Promise.all(
  nodePairs.map(pair => this.geometricPrefilter(pair, opts))
);
```

### Adaptive Thresholds

Learn optimal thresholds from successful fits:

```typescript
// Track success rates per threshold setting
const stats = trackFilterStatistics(filterResults, icpResults);
const optimized = adaptThresholds(stats, opts);
```

### Point Cloud Visualization

Debug rejected nodes with 3D visualization:

```typescript
// Show why a node was rejected
visualizeFilterResult(filterResult, fixedPoints, movingPoints);
```

## Testing

See `ICPTestPanel.tsx` for manual testing UI:

1. Select FIXED and MOVING nodes
2. Run ICP test
3. View detailed metrics and diagnostics
4. Compare icpts vs custom ICP

## References

- **ModelAnalyzer3D Pipeline:** `C:\Users\George\source\repos\ModelAnalyzer3D\ModelAnalyzer3D-master\`
- **icpts Library:** Pure TypeScript ICP (no WebAssembly)
- **Open3D Documentation:** Python ICP reference
- **FastNodeFilter Source:** `src/babylon/pipeline/FastNodeFilter.ts`
- **Pipeline Integration:** `src/babylon/pipeline/KinematicExtractionPipeline.ts:326-450`
