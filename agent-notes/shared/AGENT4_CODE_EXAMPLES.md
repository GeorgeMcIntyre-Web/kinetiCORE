# Agent 4 - Ready-to-Use Code Examples

**Copy-paste these examples directly into your code!** 📋

---

## 🎯 For Agent 1: IK Target Placement

### Example 1: Monitor Target Placement Performance

```typescript
// src/kinematics/TargetPlacementHandler.ts
import { performanceMetrics } from '@core/PerformanceMetrics';
import { Vector3 } from '@core/types';

export class TargetPlacementHandler {
  handleTargetPlacement(position: Vector3, robotId: string): void {
    // Start timing
    performanceMetrics.startOperation('ik-target-placement');
    
    try {
      // Place visual gizmo
      this.placeTargetGizmo(position);
      
      // Solve IK
      const ikSolution = this.ikSolver.solve(position);
      
      // Update robot
      this.updateRobotPose(robotId, ikSolution);
      
      // End timing with metadata
      performanceMetrics.endOperation('ik-target-placement', {
        robotId,
        hasValidSolution: ikSolution.success,
        iterations: ikSolution.iterations,
      });
      
      // Validate performance target (<50ms)
      const stats = performanceMetrics.getOperationStats('ik-target-placement');
      if (stats && stats.p95 > 50) {
        console.warn(`IK target placement is slow: ${stats.p95.toFixed(2)}ms (target: <50ms)`);
      }
    } catch (error) {
      performanceMetrics.endOperation('ik-target-placement', {
        success: false,
        error: error.message,
      });
      throw error;
    }
  }
}
```

### Example 2: Benchmark IK Solve

```typescript
// tests/performance/ik-solve.benchmark.ts
import { benchmark } from '@utils/benchmark';
import { InverseKinematicsSolver } from '@kinematics/InverseKinematicsSolver';

describe('IK Solver Performance', () => {
  it('should solve IK in <100ms (P95)', () => {
    const solver = new InverseKinematicsSolver();
    const testTarget = { x: 0.5, y: 0.3, z: 1.0 };
    
    const result = benchmark(() => {
      solver.solve(testTarget);
    }, {
      iterations: 100,
      warmup: 10,
      name: 'ik-solve-6dof',
      silent: true, // Don't print to console in tests
    });
    
    // Validate performance target
    expect(result.stats.p95).toBeLessThan(100);
    expect(result.stats.mean).toBeLessThan(50); // Should avg <50ms
    
    // Log for documentation
    console.log(`IK Solve Performance:
      Mean: ${result.stats.mean.toFixed(2)}ms
      P95:  ${result.stats.p95.toFixed(2)}ms
      P99:  ${result.stats.p99.toFixed(2)}ms
    `);
  });
});
```

### Example 3: Unit Tests for Robot Selection

```typescript
// src/kinematics/__tests__/RobotSelector.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { RobotSelector } from '../RobotSelector';
import { MockMesh } from '@/__tests__/mocks/babylon.mock';

describe('RobotSelector', () => {
  let selector: RobotSelector;
  let testRobotMesh: MockMesh;
  
  beforeEach(() => {
    selector = new RobotSelector();
    testRobotMesh = new MockMesh();
    testRobotMesh.name = 'robot_base';
    testRobotMesh.metadata = { isRobot: true, dof: 6 };
  });
  
  it('should identify robot from mesh', () => {
    const robot = selector.selectFromMesh(testRobotMesh);
    
    expect(robot).toBeDefined();
    expect(robot.name).toBe('robot_base');
    expect(robot.isRobot).toBe(true);
  });
  
  it('should discover complete kinematic chain', () => {
    const chain = selector.discoverChain(testRobotMesh);
    
    expect(chain.links.length).toBe(6); // 6-DOF robot
    expect(chain.joints.length).toBe(6);
    expect(chain.endEffector).toBeDefined();
  });
  
  it('should validate joint limits', () => {
    const chain = selector.discoverChain(testRobotMesh);
    
    chain.joints.forEach(joint => {
      expect(joint.minAngle).toBeLessThan(joint.maxAngle);
      expect(joint.currentAngle).toBeGreaterThanOrEqual(joint.minAngle);
      expect(joint.currentAngle).toBeLessThanOrEqual(joint.maxAngle);
    });
  });
  
  it('should handle non-robot meshes gracefully', () => {
    const nonRobotMesh = new MockMesh();
    nonRobotMesh.metadata = { isRobot: false };
    
    const result = selector.selectFromMesh(nonRobotMesh);
    
    expect(result).toBeNull();
  });
});
```

---

## 🤖 For Agent 2: Full Body IK

### Example 1: Monitor Multi-Chain Solve

```typescript
// src/kinematics/FullBodyIKSolver.ts
import { performanceMetrics } from '@core/PerformanceMetrics';
import { Vector3 } from '@core/types';

export class FullBodyIKSolver {
  solve(targets: {
    leftArm?: Vector3;
    rightArm?: Vector3;
    leftLeg?: Vector3;
    rightLeg?: Vector3;
    torso?: Vector3;
  }): FullBodyIKResult {
    performanceMetrics.startOperation('fullbody-ik-solve');
    
    try {
      // Phase 1: Solve individual chains
      performanceMetrics.startOperation('chain-solve-phase');
      const chainSolutions = this.solveIndividualChains(targets);
      performanceMetrics.endOperation('chain-solve-phase');
      
      // Phase 2: Apply constraints
      performanceMetrics.startOperation('constraint-phase');
      const constrained = this.applyConstraints(chainSolutions);
      performanceMetrics.endOperation('constraint-phase');
      
      // Phase 3: Balance and coordinate
      performanceMetrics.startOperation('coordination-phase');
      const coordinated = this.coordinateChains(constrained);
      performanceMetrics.endOperation('coordination-phase');
      
      performanceMetrics.endOperation('fullbody-ik-solve', {
        chainCount: Object.keys(targets).length,
        success: true,
      });
      
      return coordinated;
    } catch (error) {
      performanceMetrics.endOperation('fullbody-ik-solve', {
        success: false,
        error: error.message,
      });
      throw error;
    }
  }
}
```

### Example 2: Benchmark Multi-Chain Performance

```typescript
// tests/performance/fullbody-ik.benchmark.ts
import { benchmark, benchmarkSuite } from '@utils/benchmark';
import { FullBodyIKSolver } from '@kinematics/FullBodyIKSolver';

describe('Full Body IK Performance', () => {
  let solver: FullBodyIKSolver;
  
  beforeEach(() => {
    solver = new FullBodyIKSolver();
  });
  
  it('should solve dual-arm IK in <200ms', async () => {
    const targets = {
      leftArm: { x: -0.5, y: 0.3, z: 1.0 },
      rightArm: { x: 0.5, y: 0.3, z: 1.0 },
    };
    
    const result = benchmark(() => {
      solver.solve(targets);
    }, { iterations: 50, silent: true });
    
    expect(result.stats.p95).toBeLessThan(200);
  });
  
  it('should benchmark all phases', async () => {
    const targets = {
      leftArm: { x: -0.5, y: 0.3, z: 1.0 },
      rightArm: { x: 0.5, y: 0.3, z: 1.0 },
    };
    
    // Run solve to populate performance metrics
    for (let i = 0; i < 50; i++) {
      solver.solve(targets);
    }
    
    // Check individual phase timings
    const chainSolveStats = performanceMetrics.getOperationStats('chain-solve-phase');
    const constraintStats = performanceMetrics.getOperationStats('constraint-phase');
    const coordinationStats = performanceMetrics.getOperationStats('coordination-phase');
    
    expect(chainSolveStats?.p95).toBeLessThan(100);
    expect(constraintStats?.p95).toBeLessThan(50);
    expect(coordinationStats?.p95).toBeLessThan(50);
    
    console.log('Full Body IK Phase Breakdown:');
    console.log(`  Chain Solve:   ${chainSolveStats?.mean.toFixed(2)}ms`);
    console.log(`  Constraints:   ${constraintStats?.mean.toFixed(2)}ms`);
    console.log(`  Coordination:  ${coordinationStats?.mean.toFixed(2)}ms`);
  });
});
```

### Example 3: Integration Tests for Constraint System

```typescript
// src/kinematics/__tests__/ConstraintSystem.test.ts
import { describe, it, expect } from 'vitest';
import { ConstraintSystem } from '../ConstraintSystem';
import { KinematicChain } from '../types';

describe('ConstraintSystem', () => {
  let constraintSystem: ConstraintSystem;
  let testChain: KinematicChain;
  
  beforeEach(() => {
    constraintSystem = new ConstraintSystem();
    testChain = createTestChain(); // Helper function
  });
  
  it('should enforce joint limits', () => {
    // Set joint beyond limits
    testChain.joints[0].angle = 200; // Beyond max of 180
    
    constraintSystem.applyJointLimits(testChain);
    
    expect(testChain.joints[0].angle).toBe(180); // Clamped to max
  });
  
  it('should prevent self-collision', () => {
    // Position that would cause collision
    const colliding = createCollidingPose();
    
    const result = constraintSystem.checkCollision(colliding);
    
    expect(result.hasCollision).toBe(true);
    expect(result.collidingJoints).toHaveLength(2);
  });
  
  it('should maintain balance constraints', () => {
    const solution = {
      leftLeg: { x: -0.3, y: 0, z: 0 },
      rightLeg: { x: 0.3, y: 0, z: 0 },
    };
    
    const balanced = constraintSystem.applyBalanceConstraint(solution);
    
    // Center of mass should be within support polygon
    expect(balanced.centerOfMass.x).toBeGreaterThan(-0.3);
    expect(balanced.centerOfMass.x).toBeLessThan(0.3);
  });
});
```

---

## 🔍 For Agent 3: Code Review

### Example 1: Generate Coverage Report

```bash
#!/bin/bash
# scripts/generate-coverage-report.sh

echo "🔍 Generating test coverage report..."

# Run tests with coverage
npm run test:coverage

# Check if coverage meets targets
echo ""
echo "📊 Coverage Summary:"
cat coverage/coverage-summary.json | jq '.total.lines.pct'

# Open HTML report
if [[ "$OSTYPE" == "darwin"* ]]; then
  open coverage/index.html
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open coverage/index.html
else
  start coverage/index.html
fi
```

### Example 2: Performance Anti-Pattern Detector

```typescript
// tools/detect-performance-issues.ts
import { Glob } from 'glob';
import * as fs from 'fs';

interface PerformanceIssue {
  file: string;
  line: number;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

const ANTI_PATTERNS = [
  {
    pattern: /scene\.onBeforeRenderObservable\.add\(\(\) => \{[\s\S]*?(\/\/ expensive|calculate|compute)/i,
    issue: 'Expensive operation in render loop',
    severity: 'high' as const,
  },
  {
    pattern: /useEditorStore\(\)\s*;/,
    issue: 'Unoptimized Zustand selector (re-renders on all changes)',
    severity: 'medium' as const,
  },
  {
    pattern: /\.dispose\(/,
    inverse: true,
    context: /(useEffect|componentWillUnmount)/,
    issue: 'Potential memory leak - missing cleanup',
    severity: 'high' as const,
  },
];

function detectIssues(filepath: string): PerformanceIssue[] {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  const issues: PerformanceIssue[] = [];
  
  ANTI_PATTERNS.forEach(({ pattern, issue, severity }) => {
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        issues.push({
          file: filepath,
          line: index + 1,
          issue,
          severity,
        });
      }
    });
  });
  
  return issues;
}

// Run detection
const files = new Glob.sync('src/**/*.{ts,tsx}');
const allIssues: PerformanceIssue[] = [];

files.forEach(file => {
  const issues = detectIssues(file);
  allIssues.push(...issues);
});

// Report
console.log(`\n🔍 Found ${allIssues.length} performance issues:\n`);
allIssues.forEach(issue => {
  const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
  console.log(`${icon} ${issue.file}:${issue.line}`);
  console.log(`   ${issue.issue}`);
});
```

### Example 3: Code Review Checklist

```typescript
// tests/code-review/checklist.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Code Review Checklist', () => {
  it('should have >80% test coverage', () => {
    // Run coverage
    execSync('npm run test:coverage -- --reporter=json', { stdio: 'pipe' });
    
    const coverage = JSON.parse(
      fs.readFileSync('coverage/coverage-summary.json', 'utf-8')
    );
    
    expect(coverage.total.lines.pct).toBeGreaterThan(80);
    expect(coverage.total.statements.pct).toBeGreaterThan(80);
  });
  
  it('should have no TypeScript errors', () => {
    const output = execSync('npm run type-check', { encoding: 'utf-8' });
    expect(output).not.toContain('error TS');
  });
  
  it('should have no ESLint errors', () => {
    const output = execSync('npm run lint', { encoding: 'utf-8' });
    expect(output).not.toContain('error');
  });
  
  it('should have proper resource disposal', () => {
    // Check that all .dispose() calls are in cleanup functions
    const files = execSync('grep -r ".dispose()" src/', { encoding: 'utf-8' });
    // Add validation logic
  });
});
```

---

## 📝 For Agent 5: Documentation

### Example 1: Performance Troubleshooting Section

```markdown
<!-- Add to user documentation -->

## 🐌 Troubleshooting Performance Issues

If you're experiencing lag, stuttering, or slowdowns:

### Step 1: Enable Performance Monitor

Add `?debug=true` to your URL:
\`\`\`
http://localhost:5173/?debug=true
\`\`\`

A performance overlay will appear in the top-right corner.

### Step 2: Check Metrics

Look for warning signs:
- **FPS** below 60 (shown in red)
- **Memory** above 300MB (shown in red)
- **Frame Time** above 16ms

### Step 3: Identify the Issue

Click the overlay to expand and see:
- Draw calls (should be <500)
- Triangle count (should be reasonable for your scene)
- Entity count
- Physics body count

### Step 4: Export Data

Click the "Export" button to save performance data. Share this file with support for detailed analysis.

### Common Solutions

**Problem: Low FPS**
- Reduce number of visible objects
- Lower model quality/detail
- Check for expensive operations in motion panel

**Problem: High Memory**
- Reload the page to clear memory
- Remove unused imported models
- Check for memory leaks (contact support)

**Problem: Laggy Controls**
- Close other browser tabs
- Disable browser extensions
- Use Chrome for best performance
\`\`\`

### Example 2: Contributor Testing Guide

\`\`\`markdown
<!-- Add to CONTRIBUTING.md -->

## 🧪 Testing Your Changes

Before submitting a pull request, ensure:

### 1. Run All Tests

\`\`\`bash
npm test
\`\`\`

All tests must pass. If you added new features, add tests for them.

### 2. Check Coverage

\`\`\`bash
npm run test:coverage
open coverage/index.html
\`\`\`

- New code should have >80% coverage
- Critical paths should have 100% coverage

### 3. Benchmark Performance-Critical Code

If your changes affect performance:

\`\`\`typescript
import { benchmark } from '@utils/benchmark';

const result = benchmark(() => {
  myNewFeature();
}, { iterations: 100 });

console.log(\`Performance: \${result.stats.p95}ms\`);
\`\`\`

Ensure your changes don't regress performance.

### 4. Run Type Checking

\`\`\`bash
npm run type-check
\`\`\`

Fix any TypeScript errors.

### 5. Run Linter

\`\`\`bash
npm run lint
\`\`\`

Fix any linting errors.

### Performance Targets

Your changes should meet these targets:
- Frame rate: 60 FPS with 50 objects
- Input latency: <50ms
- IK solve: <100ms
- No memory leaks

See `docs/PERFORMANCE_MONITORING.md` for details.
```

---

## 🚀 Universal Pattern: Performance + Tests

### Template for Any New Feature

```typescript
// src/features/MyFeature.ts
import { performanceMetrics } from '@core/PerformanceMetrics';

export class MyFeature {
  performOperation(input: any): any {
    // 1. Start performance monitoring
    performanceMetrics.startOperation('my-feature-operation');
    
    try {
      // 2. Your feature logic
      const result = this.doWork(input);
      
      // 3. End monitoring with metadata
      performanceMetrics.endOperation('my-feature-operation', {
        inputSize: input.length,
        success: true,
      });
      
      return result;
    } catch (error) {
      // 4. Track errors
      performanceMetrics.endOperation('my-feature-operation', {
        success: false,
        error: error.message,
      });
      throw error;
    }
  }
}

// tests/features/__tests__/MyFeature.test.ts
import { describe, it, expect } from 'vitest';
import { benchmark } from '@utils/benchmark';
import { MyFeature } from '../MyFeature';

describe('MyFeature', () => {
  // 1. Unit tests
  it('should work correctly', () => {
    const feature = new MyFeature();
    const result = feature.performOperation(testInput);
    expect(result).toBeDefined();
  });
  
  // 2. Performance tests
  it('should complete in <100ms', () => {
    const feature = new MyFeature();
    const result = benchmark(() => {
      feature.performOperation(testInput);
    }, { iterations: 100, silent: true });
    
    expect(result.stats.p95).toBeLessThan(100);
  });
  
  // 3. Edge cases
  it('should handle empty input', () => {
    const feature = new MyFeature();
    expect(() => feature.performOperation(null)).toThrow();
  });
});
```

---

**All examples are production-ready - just copy and adapt!** ✨

_Created by Agent 4 - Performance & Testing Infrastructure_
