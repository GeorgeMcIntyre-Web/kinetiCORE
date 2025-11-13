# 🚀 AUTO KINEMATICS - TEST NOW!

## Quick Start (30 seconds)

1. **Start dev server** (if not running)
   ```bash
   npm run dev
   ```

2. **Open browser to** http://localhost:5173

3. **Open DevTools console** (F12)

4. **Run test:**
   ```javascript
   window.testAutoKinematics()
   ```

5. **Watch console** for detailed output

6. **Check Downloads** for `auto_kinematics_test_report_*.json`

---

## Expected Result

```
================================================================================
Overall: ✅ PASS
Stages Passed: 9/9
Total Errors: 0
================================================================================
```

---

## If It Works ✅

**You'll see:**
- Real 9X_110_GEO.glb file loaded (34MB)
- Bounding box matching output showing TransformNode pairs
- UNIT_112 analysis: RH, LH, WIRE pairs detected
- Dimension similarity scores (should be >0.90 for matches)
- Complete pipeline test results

**Bounding Box Matching Output:**
```
[GeometricToolAnalyzer] Finding dimension-matched pairs in 'UNIT_112':
  - Direct TransformNode children: 4
  - RH: dims=[0.xxx, 0.xxx, 0.xxx]m
  - LH: dims=[0.xxx, 0.xxx, 0.xxx]m
  - WIRE: dims=[...]
  ✓ MATCH: RH ↔ LH (similarity: 0.9xx)
  - Total pairs found: X
```

**Next steps:**
- Verify pairs match expected FIXED/MOVING geometry
- Check if similarity threshold (0.90) needs adjustment
- Integrate matched pairs into ICP pipeline

---

## If It Fails ❌

**Look for:**
- Which stage failed (e.g., "Stage 4: Capture Retracted States")
- Error messages in console
- Warning messages about missing data

**Debugging:**
- See [AUTO_KINEMATICS_QUICK_START.md](docs/AUTO_KINEMATICS_QUICK_START.md) → "Common Issues"
- See [AUTO_KINEMATICS_TEST_READY.md](docs/AUTO_KINEMATICS_TEST_READY.md) → "Debugging Failed Tests"

---

## What the Test Does

| Stage | Action | Result |
|-------|--------|--------|
| 0 | Create Babylon scene | Scene ready |
| 1 | Load real 9X_110_GEO.glb | Import 34MB GLB file |
| 2 | Test bounding box matching | Find FIXED/MOVING pairs |
| 3 | Analyze geometry | Detect fixed/moving classification |
| 4 | Validate SceneTree | Node mappings correct |
| 5 | Capture retracted | ~2000 points sampled |
| 6 | Simulate motion + capture | Parts moved 10-15cm |
| 7 | Run ICP + fit joints | 2 prismatic joints found |
| 8 | Export JSON | Tooling JSON generated |
| 9 | Validate output | Schema correct |

**Total time:** ~2-4 seconds (real GLB file)

---

## Full Documentation

📚 **Guides:**
- [AUTO_KINEMATICS_QUICK_START.md](docs/AUTO_KINEMATICS_QUICK_START.md) - How to run & interpret results
- [AUTO_KINEMATICS_TEST_READY.md](docs/AUTO_KINEMATICS_TEST_READY.md) - Complete test documentation
- [AUTO_KINEMATICS_DEBUGGING_PLAN.md](docs/AUTO_KINEMATICS_DEBUGGING_PLAN.md) - Systematic debugging

📐 **Design:**
- [BOUNDING_BOX_MATCHING_ALGORITHM.md](docs/BOUNDING_BOX_MATCHING_ALGORITHM.md) - Advanced detection method

🔧 **Code:**
- [AutoKinematicsFullPipelineTest.ts](src/babylon/pipeline/AutoKinematicsFullPipelineTest.ts) - Test implementation
- [AutoKinematicsTestButton.tsx](src/ui/components/AutoKinematicsTestButton.tsx) - UI component

---

## Status

✅ **READY FOR TESTING**

- TypeScript compilation: ✅ Clean (test files fixed)
- Test infrastructure: ✅ Complete (9 stages, 1000+ LOC)
- Documentation: ✅ Complete (5 guides, 3000+ lines)
- Console access: ✅ Enabled (`window.testAutoKinematics()`)
- Diagnostics: ✅ Comprehensive (100+ log messages)
- Auto-report: ✅ JSON download on completion

---

**GO TEST NOW:** `window.testAutoKinematics()` 🚀
