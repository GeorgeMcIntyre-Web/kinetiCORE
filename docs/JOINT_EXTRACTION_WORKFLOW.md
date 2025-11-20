# Joint Extraction Workflow

**Developer guide for ICP-based joint detection in kinetiCORE.**

## What It Does

The joint extraction pipeline analyzes tool units in a GLB model to detect kinematic joints (revolute/prismatic) using ICP (Iterative Closest Point) and geometry analysis.

**Inputs:** Tool units (from scene hierarchy), geometry families (grouped by similarity), point clouds (vertex data)  
**Process:** ICP pairing of geometry states → 3-tier fallback for motion classification  
**Outputs:** Revolute/prismatic joints with complete geometry (axis, anchor, magnitude, confidence)

### 3-Tier Fallback
1. **Point cloud analysis** - Uses `computeRevoluteMotionFromPointClouds` for revolute joints when cached clouds available
2. **extractJoint FromTransform** - Phase 3 tested API for consistent geometry extraction  
3. **Transform decomposition** - Final fallback using quaternion math

---

## Running From UI

### Auto Extract Button
**Location:** Professional Mode → Simulation workspace → Kinematics group → "Auto Extract" button

**Path:**
```
Auto Extract button click
  → KinematicExtractionPanel (toggles visibility)
  → KinematicExtractionPipeline.analyzeScene()
  → StructureBasedToolAnalyzer.analyze()
  → detectJointsWithICP()
  → convertJointPairsToDetectedJoints() ← 3-tier fallback here
```

**Expected Logs:**
```
[StructureBasedToolAnalyzer] Starting analysis from root: <name>
[StructureBasedToolAnalyzer] Running ICP-based joint detection on N units...
[JOINT_ACCEPTED] Joint detection complete: N joints found, X fixed units, Y moving units
[Joints] unit=UNIT_101 revolute=2 prismatic=1 rejected=0
```

---

## Running Dev Script

**Script:** `scripts/validateJointDetection.ts`

**Usage:**
```bash
KINETICORE_DATA_ROOT=C:\path\to\kinetiCORE_data npx tsx scripts/validateJointDetection.ts [fixtureId]
```

**Examples:**
```bash
# Run on all fixtures
KINETICORE_DATA_ROOT=C:\Users\georgem\source\repos\kinetiCORE_data npx tsx scripts/validateJointDetection.ts

# Run on specific fixture
KINETICORE_DATA_ROOT=C:\Users\georgem\source\repos\kinetiCORE_data npx tsx scripts/validateJointDetection.ts 016ZF_140_CI00
```

**Outputs:**
- **JSON reports:** `reports/joints_<fixtureName>_<timestamp>.json`
- **Console logs:** Per-unit summaries `[Joints] unit=X revolute=N prismatic=M unknown=K`

**JSON Format:**
```json
{
  "fixtureId": "016ZF_140_CI00",
  "timestamp": "2025-11-20T...",
  "joints": [
    {
      "unitId": "unit_123",
      "jointId": "unit_123_J0",
      "type": "revolute",
      "axis": [0.0, 0.0, 1.0],
      "anchor": [0.5, 0.3, 0.2],
      "magnitude": 45.2,
      "rmsError": 0.003,
      "familyId": "..."
    }
  ],
  "summary": {
    "totalJoints": 6,
    "revolute": 4,
    "prismatic": 2,
    "unknown": 0
  }
}
```

---

## Sanity Checklist

**For any engineer debugging joint extraction:**

1. **Load Test Model**
   - Use `016ZF_140_CI00.glb` or similar from testing_data
   - Open in kinetiCORE Professional Mode

2. **Run Auto Extract**
   - Switch to Simulation workspace
   - Click "Auto Extract" button
   - Wait for analysis (~5-30 seconds depending on model complexity)

3. **Verify Results**
   - ✅ At least some joints detected (check console/panel)
   - ✅ Joint types are "revolute" or "prismatic" (not "unknown")
   - ✅ No crashes or exceptions
   - ✅ Axes are normalized (length ≈ 1.0)
   - ✅ Anchors have finite coordinates
   - ✅ Magnitudes in realistic range:
     - Revolute: 0-360 degrees
     - Prismatic: 0-1 meters typical

4. **Check Logs**
   - Console should show:
     ```
     [Joints] unit=UNIT_X revolute=N prismatic=M rejected=K
     ```
   - RMS errors should be < 0.01 (1cm) for good matches

5. **Run Dev Script (Optional)**
   - Generates JSON report for deeper inspection
   - Useful for batch validation on multiple fixtures

---

## Test Commands

**ICP Classification:**
```bash
npx vitest run tests/kinematics/IcpMotionClassifier.test.ts
```
**Expected:** 4/4 passing

**3-Tier Fallback:**
```bash
npx vitest run tests/kinematics/ConvertJointPairs.test.ts
```
**Expected:** 10/10 passing

**SceneTree Mapping:**
```bash
npx vitest run tests/scene/
```
**Expected:** 8/8 passing

---

## Key Files

**Pipeline:**
- `src/babylon/pipeline/KinematicExtractionPipeline.ts` - Main pipeline orchestrator
- `src/babylon/sceneAnalysis/StructureBasedToolAnalyzer.ts` - ICP detection (line 1246)

**Core Logic:**
- `src/babylon/sceneAnalysis/StructureBasedToolAnalyzer.ts`:
  - `detectJointsWithICP()` (line ~1246) - Family building, pairing, ICP
  - `convertJointPairsToDetectedJoints()` (line ~1727) - 3-tier fallback

**ICP API (Phase 3):**
- `src/babylon/pointCloud/ICP.ts` - ICP.align()
- `src/babylon/pointCloud/JointExtractor.ts` - extractJointFromTransform()

**UI:**
- `src/ui/layouts/ProfessionalModeLayout.tsx` (line 846-853) - Auto Extract button
- `src/ui/components/KinematicExtractionPanel.tsx` - Panel component

---

## Coordinate System

**IMPORTANT:** All transforms and joints are in **tooling/model origin space** (GLB root).

- ❌ NO "car line" frame
- ❌ NO special coordinate transformations
- ✅ World-space (model origin) only

---

## Troubleshooting

**No joints detected:**
- Check model has multiple units (hierarchy with UNIT_* nodes or similar)
- Verify geometry has significant volume (not just empty transforms)
- Check ICP thresholds in options (may need tuning for specific fixtures)

**High ICP errors:**
- Normal if geometry is very different between states
- Should see rejection in logs: `[MATRIX_FILTER] Rejected: ...`
- Not a bug if mismatched geometry

**Crashes/Exceptions:**
- Check console for stack trace
- Verify GLB file is valid (loads in Babylon Inspector)
- Report issue with fixture name and error message

---

## Visual Debug Overlay

**Phase 7:** Programmatic API for joint visualization.  
**Phase 8:** UI toggle in Kinematic Extraction Panel.

### Using From UI (Phase 8)

**Location:** Kinematic Extraction Panel → Debug section (bottom of panel)

**Workflow:**
1. Load tool GLB model
2. Click "Analyze Selected Device" (Step 1)
3. Enable "Show joint debug overlay" checkbox
4. Joints appear as glyphs in 3D viewport:
   - **Blue** = Revolute joints (rotation)
   - **Green** = Prismatic joints (translation)
5. Toggle off to hide glyphs

**Features:**
- Checkbox shows Eye icon when enabled, EyeOff when disabled
- Displays joint count: "X joints cached"
- Glyphs persist until cleared or panel reset
- Automatically updates when running Auto Extract again

### JointDebugOverlayController API

**Location:** `src/babylon/sceneDebug/JointDebugOverlayController.ts`

**Purpose:** Integration layer for UI contexts. Manages overlay lifecycle and caching.

**API:**
```typescript
import { JointDebugOverlayController } from './babylon/sceneDebug/JointDebugOverlayController';

// Create controller
const controller = new JointDebugOverlayController(scene);

// Update with detected joints
controller.updateFromJoints(detectedJoints);

// Toggle visibility
controller.setEnabled(true);
controller.setEnabled(false);

// Clear all
controller.clear();

// Dispose
controller.dispose();
```

### JointDebugOverlay Service

**Location:** `src/babylon/sceneDebug/JointDebugOverlay.ts`

**Purpose:** Low-level service for rendering joint glyphs.

**API:**
```typescript
import { JointDebugOverlay } from './babylon/sceneDebug/JointDebugOverlay';

// Create overlay
const overlay = new JointDebugOverlay(scene);

// Show joints (DetectedToolJoint[] from analyzer)
overlay.showJoints(detectedJoints);

// Toggle visibility
overlay.setVisible(false);
overlay.setVisible(true);

// Clear all glyphs
overlay.clear();

// Dispose
overlay.dispose();
```

### Glyph Types

**Revolute Joints (Blue):**
- Blue axis cylinder (10cm length, 1cm diameter)
- Small sphere marker at origin
- Oriented along rotation axis

**Prismatic Joints (Green):**
- Green arrow (shaft + cone head)
- Length based on travel distance
- Small sphere marker at origin
- Oriented along translation direction

### Programmatic Usage Example

```typescript
// After running Auto Extract or validation script
const analyzer = new StructureBasedToolAnalyzer();
await analyzer.analyze(scene, options, rootNode);
const joints = analyzer.getDetectedToolJoints();

// Option 1: Use controller (recommended for UI)
const controller = new JointDebugOverlayController(scene);
controller.setEnabled(true);
controller.updateFromJoints(joints);

// Option 2: Use overlay directly (for scripts)
const overlay = new JointDebugOverlay(scene);
overlay.showJoints(joints);

// Later: hide or clear
overlay.setVisible(false);
overlay.clear();
```

### Integration Notes

- **UI Integration:** Checkbox in Kinematic Extraction Panel (Phase 8)
- **Dev/Debug Only:** Not for production end-user UX
- **Glyphs:** Emissive materials (visible without lighting)
- **Mesh Names:** `joint_{unitId}_{jointId}_axis` for easy identification
- **Guards:** Skips joints with missing geometry (null axis/anchor)

---

## References

- **Implementation docs:** `PHASE4_COMPLETE.md`, `PHASE5_COMPLETE.md`
- **UI verification:** `UI_AUTO_EXTRACT_VERIFIED.md`
- **Test status:** `TEST_STATUS.md`
- **SceneTree mapping:** `docs/auto-kinematics/SCENE_TREE_MAPPING.md`
