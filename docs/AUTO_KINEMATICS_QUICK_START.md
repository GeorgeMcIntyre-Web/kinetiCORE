# Auto Kinematics Test - Quick Start Guide

## Run the Test (3 Ways)

### Method 1: Browser Console (Easiest) ✅

1. Open kinetiCORE in your browser (`npm run dev`)
2. Open DevTools console (F12)
3. Run:

```javascript
window.testAutoKinematics()
```

4. Watch the console output for detailed logs
5. A JSON report will auto-download when complete

---

### Method 2: React Component

Add the test button to any component:

```tsx
import { AutoKinematicsTestButton } from './src/ui/components/AutoKinematicsTestButton';

function MyComponent() {
  return <AutoKinematicsTestButton />;
}
```

---

### Method 3: TypeScript Import

```typescript
import { runAutoKinematicsFullTest } from './src/babylon/pipeline/AutoKinematicsFullPipelineTest';

async function runTest() {
  const report = await runAutoKinematicsFullTest();

  if (report.overallSuccess) {
    console.log('✅ All tests passed!');
  } else {
    console.log('❌ Tests failed:', report.summary.totalErrors, 'errors');
  }
}

runTest();
```

---

## What to Expect

### Console Output Preview

```
================================================================================
AUTO KINEMATICS FULL PIPELINE TEST
================================================================================
Test File: C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\9X_110_GEO.glb
Start Time: 2025-10-31T...
================================================================================

[Stage 0: Setup] Starting...
[Stage 0: Setup] ✓ Babylon scene created
[Stage 0: Setup] ✓ Camera and light added
[Stage 0: Setup] ✓ SceneTreeManager initialized

[Stage 1: Load GLB] Starting...
[Mock GLB] Created 9X_110_GEO structure:
  - UNIT_118: Fixed jaw + Moving jaw (prismatic, 15cm)
  - UNIT_112: Retracted pin + Extended pin (prismatic, 10cm)
  - BASEPLATE: Large fixed base

[Stage 2: Analyze Scene] Starting...
[GeometricToolAnalyzer] Found 5 significant nodes
[GeometricToolAnalyzer] Formed 3 spatial clusters
[Pipeline] Analysis complete: 3 units (1 fixed, 2 moving)

[Stage 6: Fit Joints (ICP)] Starting...
[PCLICPSolver] Converged after 8 iterations (error: 0.0001m)
[Pipeline] Fitted prismatic joint: magnitude=0.1500m, confidence=0.90

[Stage 8: Validate Output] Starting...
[Stage 8: Validate Output] ✓ Joint UNIT_118_MOVING_joint valid
[Stage 8: Validate Output] ✓ Joint UNIT_112_MOVING_joint valid

================================================================================
TEST REPORT
================================================================================
Overall: ✅ PASS
Stages Passed: 9/9
Total Errors: 0
Total Warnings: 1
================================================================================
```

### Downloaded File

Look for: `auto_kinematics_test_report_<timestamp>.json` in your Downloads folder

---

## Interpreting Results

### ✅ Success

```
Overall: ✅ PASS
Stages Passed: 9/9
```

**Means:**
- All 9 stages completed successfully
- 2 prismatic joints detected
- Valid tooling JSON exported
- Pipeline is working correctly

---

### ❌ Failure

```
Overall: ❌ FAIL
Stages Passed: 6/9
Total Errors: 3
```

**Action:**
1. Check which stage failed (look for `❌ FAIL` in console)
2. Read the error messages under that stage
3. See [AUTO_KINEMATICS_TEST_READY.md](./AUTO_KINEMATICS_TEST_READY.md) → "Debugging Failed Tests"

---

## Common Issues

### Issue: "window.testAutoKinematics is not a function"

**Solution:** Refresh the page (the function is exposed in `main.tsx` on load)

---

### Issue: Test runs but shows 0 units detected

**Check:**
- Look for `[GeometricToolAnalyzer]` logs
- Verify `minVolume` threshold isn't too high
- Check if mock GLB structure was created

---

### Issue: ICP fails to converge

**Check:**
- Look for `[PCLICPSolver]` or `[ICP]` logs
- Verify motion was simulated in Stage 5
- Check if point clouds have enough points (should be ~1000-2000)

---

## Next Steps After First Run

### If Tests Pass ✅

1. **Review the exported JSON**
   - Open `auto_kinematics_test_report_*.json`
   - Check joint parameters look reasonable
   - Verify axis directions match expected motion

2. **Test with real GLB file**
   - Modify Stage 1 to load actual `9X_110_GEO.glb`
   - Replace mock structure with `SceneLoader.ImportMeshAsync()`

3. **Adjust parameters**
   - Try different `minVolume` thresholds
   - Test `similarityThreshold` for geometric matching
   - Experiment with ICP iterations

---

### If Tests Fail ❌

1. **Identify failing stage**
   ```
   ❌ FAIL  Stage 4: Capture Retracted States
     Error: Empty point cloud captured
   ```

2. **Check detailed logs**
   - Scroll up to find `[Stage 4: ...]` section
   - Look for specific error messages
   - Note any warnings

3. **Review debugging guide**
   - Open [AUTO_KINEMATICS_TEST_READY.md](./AUTO_KINEMATICS_TEST_READY.md)
   - Find your error in "Common Failure Scenarios"
   - Apply suggested parameter adjustments

4. **Re-run with adjusted parameters**
   ```javascript
   // Modify pipeline options in AutoKinematicsFullPipelineTest.ts
   // Then re-run
   window.testAutoKinematics()
   ```

---

## Full Documentation

- **[AUTO_KINEMATICS_TEST_READY.md](./AUTO_KINEMATICS_TEST_READY.md)** - Complete test guide
- **[AUTO_KINEMATICS_DEBUGGING_PLAN.md](./AUTO_KINEMATICS_DEBUGGING_PLAN.md)** - Debugging strategies
- **[AUTO_KINEMATICS_COMPLETE_GUIDE.md](./AUTO_KINEMATICS_COMPLETE_GUIDE.md)** - User workflow guide

---

## Test Parameters (Current Defaults)

```typescript
{
  geometric: {
    minVolume: 0.00001,              // Very sensitive (0.01 cm³)
    clusteringDistance: 0.5,          // 50cm grouping
    similarityThreshold: 0.90         // 90% match
  },
  icp: {
    maxIterations: 100,
    tolerance: 1e-6,
    useProfessionalICP: true
  },
  jointExtraction: {
    translationThreshold: 0.001,      // 1mm
    rotationThreshold: 0.05,          // ~2.86°
    minConfidence: 0.3                // Lower for testing
  }
}
```

---

**Ready to test? Run:** `window.testAutoKinematics()`
