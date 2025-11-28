# Testing Scripts - Complete Summary and Fixes

## Status: All Scripts Created and Fixed

I've created and fixed all test scripts. Here's what's ready:

## Scripts Created/Fixed

### 1. ✅ `scripts/batchTestDracoOffGLBs.ts`
**Status:** Ready with Babylon.js polyfills
**Purpose:** Tests complete pipeline on all `_draco_off.glb` files

**Fixes Applied:**
- ✅ Added Babylon.js polyfills (xhr2, require, Draco setup)
- ✅ Added GLTF loader import
- ✅ Handles `*1_draco_off.glb` naming pattern
- ✅ Comprehensive error handling

**Run:**
```powershell
$env:KINETICORE_DATA_ROOT="C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data"
npx tsx scripts/batchTestDracoOffGLBs.ts
```

### 2. ✅ `scripts/validateSVDAccuracyOnRealFixtures.ts`
**Status:** Ready with Babylon.js polyfills
**Purpose:** Validates SVD accuracy on real fixture data

**Fixes Applied:**
- ✅ Added Babylon.js polyfills
- ✅ Validates rotation matrix orthogonality
- ✅ Checks determinant = +1
- ✅ Detects NaN values

**Run:**
```powershell
$env:KINETICORE_DATA_ROOT="C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data"
npx tsx scripts/validateSVDAccuracyOnRealFixtures.ts
```

### 3. ✅ `scripts/testSingleFixture.ts`
**Status:** Ready
**Purpose:** Tests one fixture with detailed logging

**Run:**
```powershell
$env:KINETICORE_DATA_ROOT="C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data"
npx tsx scripts/testSingleFixture.ts
```

### 4. ✅ `scripts/runTestsWithFileOutput.ts`
**Status:** Ready
**Purpose:** Basic tests with guaranteed file output

**Run:**
```powershell
$env:KINETICORE_DATA_ROOT="C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data"
npx tsx scripts/runTestsWithFileOutput.ts
```

### 5. ✅ `scripts/diagnosticTest.ts`
**Status:** Ready
**Purpose:** Diagnostic test to verify environment

**Run:**
```powershell
npx tsx scripts/diagnosticTest.ts
```

## Key Fixes Applied

### 1. Babylon.js Polyfills
All scripts that load GLB files now include:
```typescript
// XMLHttpRequest polyfill
import xhr2 from 'xhr2';
if (!(globalThis as any).XMLHttpRequest) {
  (globalThis as any).XMLHttpRequest = xhr2;
}

// require() polyfill
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (!(globalThis as any).require) {
  (globalThis as any).require = require;
}

// Draco decoder setup
import path from 'node:path';
const dracoAssetDir = path.resolve(
  process.cwd(),
  'node_modules',
  '@babylonjs',
  'core',
  'assets',
  'Draco'
);
if (!(globalThis as any).__dirname) {
  (globalThis as any).__dirname = dracoAssetDir;
}
if (!(globalThis as any).__filename) {
  (globalThis as any).__filename = path.join(dracoAssetDir, 'draco_wasm_wrapper_gltf.js');
}

import '@babylonjs/loaders/glTF';
```

### 2. File Path Patterns
Scripts now check for multiple naming patterns:
- `${fixtureName}_draco_off.glb`
- `${fixtureName}_1_draco_off.glb` (your pattern)
- `${fixtureName}.glb` (fallback)

### 3. Error Handling
- Comprehensive try/catch blocks
- Detailed error messages
- Graceful degradation

## Expected Output Files

After running tests, you should see:
- `batch_test_results.json` - Batch test results
- `svd_validation_results.json` - SVD validation results
- `test_single_fixture_output.txt` - Single fixture test log
- `test_single_fixture_result.json` - Single fixture test results
- `test_results_final.json` - Basic test results
- `test_results_final.txt` - Basic test results (text)
- `diagnostic_results.txt` - Diagnostic test results

## Running All Tests (Batch Script)

Create a file `run_all_tests.ps1`:

```powershell
# Set environment variable
$env:KINETICORE_DATA_ROOT="C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data"

Write-Host "Running diagnostic test..."
npx tsx scripts/diagnosticTest.ts

Write-Host "`nRunning single fixture test..."
npx tsx scripts/testSingleFixture.ts

Write-Host "`nRunning batch test..."
npx tsx scripts/batchTestDracoOffGLBs.ts

Write-Host "`nRunning SVD validation..."
npx tsx scripts/validateSVDAccuracyOnRealFixtures.ts

Write-Host "`nAll tests complete! Check output files for results."
```

## Troubleshooting

### If scripts don't produce output files:
1. Check that you're in the correct directory (kinetiCORE root)
2. Verify Node.js and npm are working: `node --version` and `npm --version`
3. Check TypeScript compilation: `npx tsc --noEmit scripts/batchTestDracoOffGLBs.ts`
4. Try running with explicit output: `npx tsx scripts/diagnosticTest.ts > output.txt 2>&1`

### If imports fail:
1. Run `npm install` to ensure all dependencies are installed
2. Check that `xhr2` is installed: `npm list xhr2`
3. Verify Babylon.js is installed: `npm list @babylonjs/core`

### If GLB loading fails:
1. Verify GLB files exist and are not corrupted
2. Check that files are actually `_draco_off.glb` (not regular `.glb`)
3. Try loading a GLB file manually in a browser to verify it's valid

## What Each Script Tests

### Batch Test (`batchTestDracoOffGLBs.ts`)
- ✅ Unit detection
- ✅ Pose pair detection
- ✅ Vertex extraction
- ✅ ICP alignment
- ✅ Joint classification

### SVD Validation (`validateSVDAccuracyOnRealFixtures.ts`)
- ✅ Rotation matrix orthogonality (R*R^T ≈ identity)
- ✅ Determinant = +1 (proper rotation)
- ✅ No NaN values
- ✅ RMS error analysis

### Single Fixture Test (`testSingleFixture.ts`)
- ✅ Complete pipeline on one fixture
- ✅ Detailed step-by-step logging
- ✅ Error reporting

## Next Steps

1. **Run diagnostic test first:**
   ```powershell
   npx tsx scripts/diagnosticTest.ts
   ```
   This verifies the environment is set up correctly.

2. **Run single fixture test:**
   ```powershell
   $env:KINETICORE_DATA_ROOT="C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\testing_data"
   npx tsx scripts/testSingleFixture.ts
   ```
   This tests one fixture to verify the pipeline works.

3. **Run batch test:**
   ```powershell
   npx tsx scripts/batchTestDracoOffGLBs.ts
   ```
   This tests all fixtures.

4. **Run SVD validation:**
   ```powershell
   npx tsx scripts/validateSVDAccuracyOnRealFixtures.ts
   ```
   This validates SVD accuracy.

5. **Review results:**
   - Check JSON files for detailed results
   - Look for any failures or warnings
   - Fix issues and re-run

## All Scripts Are Ready

All scripts have been:
- ✅ Created with proper structure
- ✅ Fixed with Babylon.js polyfills
- ✅ Updated to handle your file naming pattern
- ✅ Enhanced with error handling
- ✅ Documented with clear instructions

You can run them whenever you're ready!
