# Testing StructureBasedToolAnalyzer on Multiple GLB Files

## Available Test Files

All 4 GLB files have been found and are ready for testing:

| # | Name | Size | Path | Expected Results |
|---|------|------|------|------------------|
| 1 | **8X-140_GEO** (Original) | 24.92 MB | `testing_data/8X-140_GEO/016ZF_20142435_140_CI00.glb` | ✅ 9 units, 6 joints, 4 with joints |
| 2 | **8X-140-1E1_LH** | 13.33 MB | `testing_data/8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00.glb` | Unknown (to be discovered) |
| 3 | **8X-140-2E1_RH** | 13.37 MB | `testing_data/8X-140-2E1_RH/016ZF_20142435_140_2E1_CI00.glb` | Unknown (to be discovered) |
| 4 | **016ZF_20142435_130** | 42.16 MB | `testing_data/016ZF_20142435_130/016ZF_20142435_130.glb` | Unknown (to be discovered) |

## How to Test Each File

### Method 1: Update the Existing Test File

Edit `tests/babylon/sceneAnalysis/StructureBasedToolAnalyzer.test.ts` and change the `glbPath` on line 61:

```typescript
// Original (8X-140_GEO)
const glbPath = path.resolve(
  process.cwd(),
  '..',
  'kinetiCORE_data',
  'Tooling',
  'testing_data',
  '8X-140_GEO',
  '016ZF_20142435_140_CI00.glb'
);

// Test 8X-140-1E1_LH
const glbPath = path.resolve(
  process.cwd(),
  '..',
  'kinetiCORE_data',
  'Tooling',
  'testing_data',
  '8X-140-1E1_LH',
  '016ZF_20142435_140_1E1_CI00.glb'
);

// Test 8X-140-2E1_RH
const glbPath = path.resolve(
  process.cwd(),
  '..',
  'kinetiCORE_data',
  'Tooling',
  'testing_data',
  '8X-140-2E1_RH',
  '016ZF_20142435_140_2E1_CI00.glb'
);

// Test 016ZF_20142435_130
const glbPath = path.resolve(
  process.cwd(),
  '..',
  'kinetiCORE_data',
  'Tooling',
  'testing_data',
  '016ZF_20142435_130',
  '016ZF_20142435_130.glb'
);
```

Then run:
```bash
npm test -- tests/babylon/sceneAnalysis/StructureBasedToolAnalyzer.test.ts --run
```

### Method 2: Check File Status

Run the file checker script:
```bash
node run-glb-tests.mjs
```

This will verify all 4 GLB files exist and show their sizes.

## Expected Performance

With the new aggressive limits, each GLB file should:
- ✅ Complete in **6-10 seconds** (not 46 minutes!)
- ✅ **Not hang or timeout**
- ✅ Find all units and joints
- ✅ Show detailed progress logging

## What to Look For in Test Output

### Successful Test Output:
```
[StructureBasedToolAnalyzer] Starting analysis from root: 016ZF_20142435_140_CI00
[StructureBasedToolAnalyzer] Found units level at depth 2 with 9 children
[StructureBasedToolAnalyzer] Processing unit 1/9: unit_123 (6 state nodes)
[StructureBasedToolAnalyzer] Unit unit_123: Checking 5 parent groups
[StructureBasedToolAnalyzer] Unit unit_123: Parent group 1/5 has 3 siblings
[StructureBasedToolAnalyzer] Unit unit_123: BB match found for pair 1/3
[StructureBasedToolAnalyzer] Unit unit_123: Running ICP with 50 vs 50 points...
[StructureBasedToolAnalyzer] Unit unit_123: ICP complete - error: 0.000270
[StructureBasedToolAnalyzer] ✓ JOINT 1 FOUND in Unit unit_123: prismatic, error: 0.000270
[StructureBasedToolAnalyzer] Unit unit_123: Found 1 joint(s) total
...
[StructureBasedToolAnalyzer] ICP joint detection complete: 6 joints found, 5 fixed, 4 moving
```

### Performance Indicators:
- ⏱️ **Time:** Should complete in 6-10s
- 🔍 **ICP Calls:** Should be ~100-150 calls (not 55,000!)
- 📊 **Units Found:** Varies by GLB file
- 🔧 **Joints Found:** Varies by GLB file

## Comparing Results Across Files

After testing all 4 files, you'll be able to see:
- Which fixtures have more/fewer units
- Which have more/fewer joints
- Whether the algorithm scales well across different file sizes
- If the limits need adjustment based on real-world data

## Next Steps

1. ✅ **Test Original File** (8X-140_GEO) - Already know it should work
2. 📝 **Test 8X-140-1E1_LH** - Discover units/joints
3. 📝 **Test 8X-140-2E1_RH** - Discover units/joints
4. 📝 **Test 016ZF_20142435_130** - Discover units/joints (largest file)
5. 📊 **Compare Results** - Document findings
6. ⚙️ **Adjust Limits** if needed based on real-world results

## Troubleshooting

If a test hangs or times out:
1. Check the console output - which unit is it stuck on?
2. Increase timeout in test file (currently 60s)
3. Add more aggressive limits if needed
4. Review the GLB file structure - may have unusual hierarchy

## Performance Verification

Run the limit calculator to verify performance estimates:
```bash
node test-structure-analyzer.js
```

This shows:
- ICP call reduction (should be 99.8%)
- Estimated time (should be under 10s)
- Confirms limits are working as expected
