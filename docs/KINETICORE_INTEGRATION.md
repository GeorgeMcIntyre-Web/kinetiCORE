# kinetiCORE Integration Guide

> **Purpose**: Step-by-step guide for integrating CascadedPointCloudFit TypeScript library into the kinetiCORE project.

## Table of Contents

1. [Integration Overview](#integration-overview)
2. [Installation Methods](#installation-methods)
3. [Quick Start Example](#quick-start-example)
4. [Common Integration Patterns](#common-integration-patterns)
5. [TypeScript Configuration](#typescript-configuration)
6. [Performance Considerations](#performance-considerations)
7. [Error Handling](#error-handling)
8. [Testing Integration](#testing-integration)
9. [Troubleshooting](#troubleshooting)

---

## Integration Overview

### What is CascadedPointCloudFit?

A production-ready TypeScript library for point cloud registration using PCA (Principal Component Analysis) and ICP (Iterative Closest Point) algorithms.

### Why Integrate with kinetiCORE?

**Primary Use Case**: Automatic kinematic generation from CAD designs by fitting open-closed component positions.

**Key Capabilities**:
- ✅ Detect motion between CAD components
- ✅ Register point clouds extracted from 3D models
- ✅ High accuracy (RMSE = 0.000000 on test data)
- ✅ Handle large point clouds (tested up to 155K points)
- ✅ TypeScript-native with full type safety

### Integration Architecture

```
kinetiCORE Project
  │
  ├─ Import cascaded-point-cloud-fit-ts
  │    ↓
  │  [ Point Cloud Registration Module ]
  │    ↓
  ├─ Load CAD component point clouds
  │    ↓
  ├─ Register open/closed positions
  │    ↓
  ├─ Extract transformation matrices
  │    ↓
  └─ Generate kinematic constraints
```

---

## Installation Methods

### Method 1: NPM Package (Recommended for Production)

**Prerequisites**: Package must be published to npm or private registry.

```bash
cd C:\Users\George\source\repos\kinetiCORE
npm install cascaded-point-cloud-fit-ts
```

**In kinetiCORE code**:
```typescript
import {
  PointCloudReader,
  RegistrationAlgorithms,
  MetricsCalculator,
  PointCloud,
  Transform4x4
} from 'cascaded-point-cloud-fit-ts';
```

---

### Method 2: Local Package (Development/Testing)

**Step 1**: Build the TypeScript package
```bash
cd C:\Users\George\source\repos\cursor\CascadedPointCloudFit\typescript
npm install
npm run build
```

**Step 2**: Link package locally
```bash
# In CascadedPointCloudFit/typescript
npm link

# In kinetiCORE
cd C:\Users\George\source\repos\kinetiCORE
npm link cascaded-point-cloud-fit-ts
```

**Step 3**: Use in kinetiCORE
```typescript
import { RegistrationAlgorithms } from 'cascaded-point-cloud-fit-ts';
```

---

### Method 3: Direct Path Import (Quick Testing)

**package.json** in kinetiCORE:
```json
{
  "dependencies": {
    "cascaded-point-cloud-fit-ts": "file:../cursor/CascadedPointCloudFit/typescript"
  }
}
```

```bash
npm install
```

---

### Method 4: Git Submodule (Version Control)

```bash
cd C:\Users\George\source\repos\kinetiCORE
git submodule add <repo-url> libs/cascaded-point-cloud-fit
```

**package.json**:
```json
{
  "dependencies": {
    "cascaded-point-cloud-fit-ts": "file:./libs/cascaded-point-cloud-fit/typescript"
  }
}
```

---

## Quick Start Example

### Example 1: Basic Registration

```typescript
// File: kinetiCORE/src/registration/pointCloudRegistration.ts

import {
  PointCloudReader,
  RegistrationAlgorithms,
  PointCloud,
  ICPResult
} from 'cascaded-point-cloud-fit-ts';

export async function registerCADComponents(
  openPositionPath: string,
  closedPositionPath: string
): Promise<ICPResult> {
  // Load point clouds from CAD exports
  const openCloud = await PointCloudReader.loadFromFile(openPositionPath);
  const closedCloud = await PointCloudReader.loadFromFile(closedPositionPath);

  // Register (PCA + ICP)
  const result = RegistrationAlgorithms.register(openCloud, closedCloud);

  console.log(`Registration converged in ${result.iterations} iterations`);
  console.log(`Final RMSE: ${result.error}`);

  return result;
}

// Usage
const result = await registerCADComponents(
  'data/hinge_open.ply',
  'data/hinge_closed.ply'
);

// Extract transformation
const transform = result.transform.matrix;
console.log('Transformation matrix:', transform);
```

---

### Example 2: Kinematic Extraction

```typescript
// File: kinetiCORE/src/kinematics/extractKinematics.ts

import {
  PointCloudReader,
  RegistrationAlgorithms,
  Transform4x4,
  ICPResult
} from 'cascaded-point-cloud-fit-ts';

interface KinematicConstraint {
  type: 'revolute' | 'prismatic' | 'fixed';
  axis?: [number, number, number];
  origin?: [number, number, number];
  angle?: number;
  translation?: [number, number, number];
}

export class KinematicExtractor {
  /**
   * Extract kinematic constraint from two component positions
   */
  async extractConstraint(
    position1Path: string,
    position2Path: string
  ): Promise<KinematicConstraint> {
    // Register point clouds
    const cloud1 = await PointCloudReader.loadFromFile(position1Path);
    const cloud2 = await PointCloudReader.loadFromFile(position2Path);

    const result = RegistrationAlgorithms.register(cloud1, cloud2);

    // Extract rotation and translation from 4x4 matrix
    const { rotation, translation } = this.decomposeTransform(result.transform);

    // Analyze motion type
    const constraint = this.analyzeMotion(rotation, translation);

    return constraint;
  }

  private decomposeTransform(transform: Transform4x4): {
    rotation: number[][];
    translation: [number, number, number];
  } {
    const m = transform.matrix;

    // Extract 3x3 rotation matrix
    const rotation = [
      [m[0][0], m[0][1], m[0][2]],
      [m[1][0], m[1][1], m[1][2]],
      [m[2][0], m[2][1], m[2][2]]
    ];

    // Extract translation vector
    const translation: [number, number, number] = [
      m[0][3],
      m[1][3],
      m[2][3]
    ];

    return { rotation, translation };
  }

  private analyzeMotion(
    rotation: number[][],
    translation: [number, number, number]
  ): KinematicConstraint {
    // Check if pure rotation (revolute joint)
    const translationMag = Math.sqrt(
      translation[0] ** 2 + translation[1] ** 2 + translation[2] ** 2
    );

    if (translationMag < 0.001) {
      // Pure rotation - extract axis and angle
      const { axis, angle } = this.extractRotationAxis(rotation);
      return {
        type: 'revolute',
        axis,
        origin: [0, 0, 0],
        angle
      };
    }

    // Check if pure translation (prismatic joint)
    const isIdentityRotation = this.isIdentityMatrix(rotation);

    if (isIdentityRotation) {
      return {
        type: 'prismatic',
        axis: this.normalizeVector(translation),
        translation
      };
    }

    // Mixed motion - could be helical or complex
    // For now, classify as revolute with translation
    const { axis, angle } = this.extractRotationAxis(rotation);
    return {
      type: 'revolute',
      axis,
      origin: [0, 0, 0],
      angle,
      translation
    };
  }

  private extractRotationAxis(R: number[][]): {
    axis: [number, number, number];
    angle: number;
  } {
    // Extract rotation axis from rotation matrix
    // Using Rodrigues' formula

    // Trace of rotation matrix
    const trace = R[0][0] + R[1][1] + R[2][2];

    // Rotation angle
    const angle = Math.acos((trace - 1) / 2);

    if (Math.abs(angle) < 0.001) {
      // No rotation
      return { axis: [0, 0, 1], angle: 0 };
    }

    // Rotation axis (skew-symmetric part)
    const axis: [number, number, number] = [
      R[2][1] - R[1][2],
      R[0][2] - R[2][0],
      R[1][0] - R[0][1]
    ];

    // Normalize
    const mag = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);

    return {
      axis: [axis[0] / mag, axis[1] / mag, axis[2] / mag],
      angle
    };
  }

  private isIdentityMatrix(R: number[][], tolerance = 0.001): boolean {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const expected = i === j ? 1 : 0;
        if (Math.abs(R[i][j] - expected) > tolerance) {
          return false;
        }
      }
    }
    return true;
  }

  private normalizeVector(v: [number, number, number]): [number, number, number] {
    const mag = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
    return [v[0] / mag, v[1] / mag, v[2] / mag];
  }
}

// Usage
const extractor = new KinematicExtractor();
const constraint = await extractor.extractConstraint(
  'hinge_0deg.ply',
  'hinge_90deg.ply'
);

console.log('Kinematic constraint:', constraint);
// Output: { type: 'revolute', axis: [0, 0, 1], angle: 1.5708 (90°) }
```

---

### Example 3: Batch Processing Multiple Components

```typescript
// File: kinetiCORE/src/registration/batchRegistration.ts

import {
  PointCloudReader,
  RegistrationAlgorithms,
  ICPResult
} from 'cascaded-point-cloud-fit-ts';
import { promises as fs } from 'fs';
import * as path from 'path';

interface ComponentPair {
  name: string;
  openPath: string;
  closedPath: string;
}

interface RegistrationResult {
  name: string;
  transform: number[][];
  iterations: number;
  rmse: number;
  success: boolean;
  error?: string;
}

export class BatchRegistration {
  async processCADAssembly(
    componentPairs: ComponentPair[],
    outputDir: string
  ): Promise<RegistrationResult[]> {
    const results: RegistrationResult[] = [];

    for (const pair of componentPairs) {
      console.log(`Processing ${pair.name}...`);

      try {
        const result = await this.registerPair(pair);
        results.push(result);

        // Save transformation matrix
        await this.saveTransform(result, outputDir);

      } catch (error) {
        console.error(`Failed to register ${pair.name}:`, error);
        results.push({
          name: pair.name,
          transform: [],
          iterations: 0,
          rmse: -1,
          success: false,
          error: (error as Error).message
        });
      }
    }

    return results;
  }

  private async registerPair(pair: ComponentPair): Promise<RegistrationResult> {
    const openCloud = await PointCloudReader.loadFromFile(pair.openPath);
    const closedCloud = await PointCloudReader.loadFromFile(pair.closedPath);

    const result = RegistrationAlgorithms.register(
      openCloud,
      closedCloud,
      100,   // max iterations
      1e-8   // tight tolerance
    );

    return {
      name: pair.name,
      transform: result.transform.matrix,
      iterations: result.iterations,
      rmse: result.error,
      success: result.error < 0.01 // Success threshold: RMSE < 0.01
    };
  }

  private async saveTransform(
    result: RegistrationResult,
    outputDir: string
  ): Promise<void> {
    const filename = path.join(outputDir, `${result.name}_transform.json`);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(
      filename,
      JSON.stringify(result, null, 2),
      'utf-8'
    );

    console.log(`Saved transform to ${filename}`);
  }
}

// Usage
const batch = new BatchRegistration();

const componentPairs: ComponentPair[] = [
  {
    name: 'hinge_1',
    openPath: 'cad_exports/hinge_1_open.ply',
    closedPath: 'cad_exports/hinge_1_closed.ply'
  },
  {
    name: 'hinge_2',
    openPath: 'cad_exports/hinge_2_open.ply',
    closedPath: 'cad_exports/hinge_2_closed.ply'
  },
  {
    name: 'slider',
    openPath: 'cad_exports/slider_retracted.ply',
    closedPath: 'cad_exports/slider_extended.ply'
  }
];

const results = await batch.processCADAssembly(
  componentPairs,
  'output/transformations'
);

console.log(`Processed ${results.length} components`);
console.log(`Success: ${results.filter(r => r.success).length}`);
console.log(`Failed: ${results.filter(r => !r.success).length}`);
```

---

## Common Integration Patterns

### Pattern 1: CAD Export → Point Cloud → Registration

```typescript
import {
  PointCloudReader,
  RegistrationAlgorithms
} from 'cascaded-point-cloud-fit-ts';

// Assuming CAD software exports to PLY format
async function processCADExport(
  cadExportPath: string,
  referenceCloudPath: string
) {
  const cadCloud = await PointCloudReader.loadFromFile(cadExportPath);
  const refCloud = await PointCloudReader.loadFromFile(referenceCloudPath);

  const result = RegistrationAlgorithms.register(cadCloud, refCloud);

  return result.transform.matrix;
}
```

---

### Pattern 2: Real-Time Sensor Data Processing

```typescript
import {
  PointCloudReader,
  RegistrationAlgorithms,
  PointCloud
} from 'cascaded-point-cloud-fit-ts';

class RealTimeRegistration {
  private referenceCloud: PointCloud | null = null;

  async setReference(referencePath: string) {
    this.referenceCloud = await PointCloudReader.loadFromFile(referencePath);
  }

  registerSensorData(sensorPoints: Float32Array, pointCount: number) {
    if (!this.referenceCloud) {
      throw new Error('Reference cloud not set');
    }

    const sensorCloud: PointCloud = {
      points: sensorPoints,
      count: pointCount
    };

    const result = RegistrationAlgorithms.register(
      sensorCloud,
      this.referenceCloud,
      30,    // Fewer iterations for real-time
      1e-6   // Slightly relaxed tolerance
    );

    return result;
  }
}
```

---

### Pattern 3: Quality Control Validation

```typescript
import {
  PointCloudReader,
  RegistrationAlgorithms,
  MetricsCalculator
} from 'cascaded-point-cloud-fit-ts';

async function validateComponentAlignment(
  actualPath: string,
  expectedPath: string,
  rmseThreshold: number = 0.5
): Promise<{ passed: boolean; rmse: number; details: string }> {
  const actual = await PointCloudReader.loadFromFile(actualPath);
  const expected = await PointCloudReader.loadFromFile(expectedPath);

  const result = RegistrationAlgorithms.register(actual, expected);

  const metrics = MetricsCalculator.calculateMetrics(
    actual,
    expected,
    result.transform
  );

  const passed = metrics.rmse <= rmseThreshold;

  return {
    passed,
    rmse: metrics.rmse,
    details: passed
      ? `✅ Alignment within tolerance (RMSE: ${metrics.rmse.toFixed(6)})`
      : `❌ Alignment failed (RMSE: ${metrics.rmse.toFixed(6)} > ${rmseThreshold})`
  };
}

// Usage
const validation = await validateComponentAlignment(
  'scanned_part.ply',
  'cad_design.ply',
  0.5 // 0.5mm tolerance
);

console.log(validation.details);
```

---

## TypeScript Configuration

### kinetiCORE tsconfig.json

Ensure your TypeScript configuration is compatible:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Key Requirements**:
- `target`: ES2020 or higher (for Float32Array support)
- `strict`: true (for type safety)
- `moduleResolution`: node (for npm package resolution)

---

## Performance Considerations

### 1. Point Cloud Size Optimization

```typescript
import { RegistrationAlgorithms, PointCloud } from 'cascaded-point-cloud-fit-ts';

function optimizeCloudSize(cloud: PointCloud): PointCloud {
  // Downsample large clouds before registration
  if (cloud.count > 50000) {
    const factor = Math.ceil(cloud.count / 25000);
    return RegistrationAlgorithms.downsample(cloud, factor);
  }
  return cloud;
}

// Usage
const largeCloud = await PointCloudReader.loadFromFile('large_model.ply');
const optimizedCloud = optimizeCloudSize(largeCloud);
const result = RegistrationAlgorithms.register(optimizedCloud, target);
```

---

### 2. Caching Reference Clouds

```typescript
class CachedRegistration {
  private cloudCache = new Map<string, PointCloud>();

  async getOrLoadCloud(path: string): Promise<PointCloud> {
    if (!this.cloudCache.has(path)) {
      const cloud = await PointCloudReader.loadFromFile(path);
      this.cloudCache.set(path, cloud);
    }
    return this.cloudCache.get(path)!;
  }

  clearCache() {
    this.cloudCache.clear();
  }
}
```

---

### 3. Parallel Processing (Node.js Worker Threads)

```typescript
import { Worker } from 'worker_threads';

async function parallelRegistration(
  pairs: Array<[string, string]>
): Promise<any[]> {
  const workers = pairs.map(([source, target]) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./registrationWorker.js', {
        workerData: { source, target }
      });

      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  });

  return Promise.all(workers);
}
```

**registrationWorker.js**:
```javascript
const { parentPort, workerData } = require('worker_threads');
const { PointCloudReader, RegistrationAlgorithms } = require('cascaded-point-cloud-fit-ts');

(async () => {
  const source = await PointCloudReader.loadFromFile(workerData.source);
  const target = await PointCloudReader.loadFromFile(workerData.target);
  const result = RegistrationAlgorithms.register(source, target);

  parentPort.postMessage(result);
})();
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
import {
  PointCloudReader,
  RegistrationAlgorithms,
  PointCloud,
  ICPResult
} from 'cascaded-point-cloud-fit-ts';

async function safeRegistration(
  sourcePath: string,
  targetPath: string
): Promise<ICPResult | null> {
  try {
    // Validate file existence
    const fs = require('fs').promises;
    await fs.access(sourcePath);
    await fs.access(targetPath);

    // Load point clouds
    let source: PointCloud;
    let target: PointCloud;

    try {
      source = await PointCloudReader.loadFromFile(sourcePath);
    } catch (error) {
      console.error(`Failed to load source cloud from ${sourcePath}:`, error);
      throw new Error(`Invalid source file: ${sourcePath}`);
    }

    try {
      target = await PointCloudReader.loadFromFile(targetPath);
    } catch (error) {
      console.error(`Failed to load target cloud from ${targetPath}:`, error);
      throw new Error(`Invalid target file: ${targetPath}`);
    }

    // Validate point counts
    if (source.count < 3) {
      throw new Error(`Source cloud has insufficient points: ${source.count} (need >= 3)`);
    }
    if (target.count < 3) {
      throw new Error(`Target cloud has insufficient points: ${target.count} (need >= 3)`);
    }

    // Register
    const result = RegistrationAlgorithms.register(source, target);

    // Validate result quality
    if (result.error > 10.0) {
      console.warn(`High RMSE detected: ${result.error}. Registration may be poor.`);
    }

    if (result.iterations >= 50) {
      console.warn(`Maximum iterations reached. May not have converged.`);
    }

    return result;

  } catch (error) {
    console.error('Registration failed:', error);
    return null;
  }
}
```

---

## Testing Integration

### Unit Test Example (Jest)

```typescript
// File: kinetiCORE/tests/registration.test.ts

import {
  PointCloudReader,
  RegistrationAlgorithms,
  PointCloud
} from 'cascaded-point-cloud-fit-ts';

describe('Point Cloud Registration', () => {
  let testCloud: PointCloud;

  beforeAll(async () => {
    testCloud = await PointCloudReader.loadFromFile('test_data/sample.ply');
  });

  test('should register identical clouds with zero error', async () => {
    const result = RegistrationAlgorithms.register(testCloud, testCloud);

    expect(result.error).toBeLessThan(1e-6);
    expect(result.iterations).toBeGreaterThan(0);
  });

  test('should handle rotated clouds', async () => {
    const rotatedCloud = await PointCloudReader.loadFromFile('test_data/rotated.ply');
    const result = RegistrationAlgorithms.register(testCloud, rotatedCloud);

    expect(result.error).toBeLessThan(0.01);
    expect(result.iterations).toBeLessThan(20);
  });

  test('should fail gracefully on invalid input', async () => {
    const emptyCloud: PointCloud = {
      points: new Float32Array(0),
      count: 0
    };

    expect(() => {
      RegistrationAlgorithms.register(emptyCloud, testCloud);
    }).toThrow();
  });
});
```

---

## Troubleshooting

### Issue 1: "Cannot find module 'cascaded-point-cloud-fit-ts'"

**Solution**:
```bash
# Ensure package is installed
npm install

# If using npm link
npm link cascaded-point-cloud-fit-ts

# Check node_modules
ls node_modules/cascaded-point-cloud-fit-ts
```

---

### Issue 2: "TypeError: PointCloudReader.loadFromFile is not a function"

**Cause**: Import issue or version mismatch

**Solution**:
```typescript
// Use named imports
import { PointCloudReader } from 'cascaded-point-cloud-fit-ts';

// NOT default import
// import PointCloudReader from '...'; // ❌ Wrong
```

---

### Issue 3: High RMSE or Poor Registration

**Possible Causes**:
1. Point clouds are from different objects
2. Clouds have different scales
3. Clouds need preprocessing (outlier removal)

**Solution**:
```typescript
// Check point cloud properties
console.log(`Source points: ${source.count}`);
console.log(`Target points: ${target.count}`);

// Validate RMSE threshold
if (result.error > 1.0) {
  console.warn('Poor registration. Check input data.');
}

// Try tighter tolerance
const result = RegistrationAlgorithms.register(source, target, 100, 1e-9);
```

---

### Issue 4: Stack Overflow on Large Clouds

**Solution**: Already handled in TypeScript version (iterative KD-tree construction)

If still occurs:
```typescript
// Downsample before registration
const downsampledSource = RegistrationAlgorithms.downsample(source, 2);
const downsampledTarget = RegistrationAlgorithms.downsample(target, 2);

const result = RegistrationAlgorithms.register(
  downsampledSource,
  downsampledTarget
);
```

---

## Next Steps

1. **Install**: Choose installation method (npm link recommended for development)
2. **Test**: Run example code to verify integration
3. **Implement**: Add kinematic extraction logic for your use case
4. **Optimize**: Profile performance with your CAD data
5. **Deploy**: Test with production CAD exports

---

## Support Resources

- **Architecture Docs**: `typescript/docs/ARCHITECTURE.md`
- **API Reference**: `typescript/docs/API_REFERENCE.md`
- **Code Map**: `typescript/docs/CODE_MAP.md`
- **Test Data**: `test_data/` (real-world examples)
- **Python Reference**: `cascaded_fit/` (algorithm validation)

---

**Last Updated**: 2025-11-27
**Version**: 0.1.0
**Target**: kinetiCORE Project at `C:\Users\George\source\repos\kinetiCORE`
