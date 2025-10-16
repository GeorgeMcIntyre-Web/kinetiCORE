# MJCF Loader - Agent Coordination Plan

## Overview
This document coordinates work between Agent 1 (MJCF Loader refactoring) and Agent 2 (Architecture & integration).

---

## ✅ Completed by Agent 2

### New Utility Classes Added
All located in `src/loaders/mjcf/`:

1. **[MJCFModelTypeDetector.ts](src/loaders/mjcf/MJCFModelTypeDetector.ts)** - Model type analysis
   - Detects OBJ, STL, GLB, or MIXED models
   - Provides confidence score and recommendations
   - Known model profiles (Unitree B2, H1, GO2, G1, etc.)

2. **[MJCFKeyframeManager.ts](src/loaders/mjcf/MJCFKeyframeManager.ts)** - Keyframe state management
   - Prevents double application of keyframes
   - Tracks which keyframes have been applied to which models
   - Provides keyframe validation

3. **[MJCFValidator.ts](src/loaders/mjcf/MJCFValidator.ts)** - Post-load validation
   - Detects common issues (orientation, scale, hierarchy, meshes)
   - Auto-fix functionality for common problems
   - Categorizes issues by severity (error/warning/info)

---

## 🔄 Current Status

### Agent 1 - Active Work on MJCFLoader.ts
Based on the recent file changes, Agent 1 is:
- ✅ Simplifying `buildBodies()` to use unified `convertPosition()`
- ✅ Removing OBJ/STL conditional branches
- ✅ Creating simple mesh inventory system
- ✅ Applying unified coordinate conversion to body/geom positions
- 🔄 Likely working on `applyKeyframeData()` simplification next

### Agent 2 - Completed Utilities (Ready for Integration)
- ✅ Three new utility classes created and ready to use
- ⏸️ Waiting for Agent 1 to complete loader refactoring
- 🎯 Ready to integrate utilities once loader is stable

---

## 🎯 Integration Plan (After Agent 1 Completes)

### Phase 1: Integrate Model Type Detection

**File:** `src/loaders/mjcf/MJCFLoader.ts`

**Location:** In `loadMJCFFromFile()` function, after extracting mesh files from ZIP

**Changes:**
```typescript
import { MJCFModelTypeDetector, ModelTypeAnalysis } from './MJCFModelTypeDetector';

// After extracting mesh files (around line 1000)
const modelAnalysis = MJCFModelTypeDetector.analyzeModel(extractedMeshFiles);
console.log(`[MJCF Import] Model analysis:`, modelAnalysis);

// Use analysis results
if (mjcfLoading) {
  mjcfLoading.setModelAnalysis({
    isOBJBased: modelAnalysis.primary === 'OBJ',
    isSTLBased: modelAnalysis.primary === 'STL',
    isMixed: modelAnalysis.primary === 'MIXED'
  }, {
    // ... existing code
  });
}

// Log recommendations
modelAnalysis.recommendations.forEach(rec => {
  console.log(`[MJCF Import] ${rec}`);
});
```

### Phase 2: Integrate Keyframe Manager

**File:** `src/loaders/mjcf/MJCFLoader.ts`

**Location:** In `applyKeyframeData()` function

**Changes:**
```typescript
import { MJCFKeyframeManager, Keyframe } from './MJCFKeyframeManager';

// At start of applyKeyframeData()
const keyframeManager = MJCFKeyframeManager.getInstance();
const modelId = rootNode.name;

// Register keyframes
const keyframeObjects: Keyframe[] = Object.entries(keyframes).map(([name, values]) => ({
  name,
  jointValues: values,
  description: `${values.length} joint values`
}));
keyframeManager.registerKeyframes(modelId, keyframeObjects);

// Before applying each keyframe
for (const [keyframeName, qposValues] of Object.entries(keyframes)) {
  // Check if already applied
  if (keyframeManager.hasBeenApplied(modelId, keyframeName)) {
    console.log(`[MJCF Keyframe] Keyframe '${keyframeName}' already applied, skipping`);
    continue;
  }

  // ... apply keyframe logic ...

  // Mark as applied
  keyframeManager.markAsApplied(modelId, rootNode.id, keyframeName, Object.keys(jointMap).length);
}
```

### Phase 3: Integrate Validator

**File:** `src/loaders/mjcf/MJCFLoader.ts`

**Location:** At the end of `loadMJCFFromFile()`, before returning success

**Changes:**
```typescript
import { MJCFValidator } from './MJCFValidator';

// Before final return (around line 1330)
const validator = new MJCFValidator();
const validationResult = validator.validate(root, {
  modelType: modelAnalysis.primary,
  keyframesApplied: Object.keys(keyframes).length > 0,
  jointCount: Object.keys(jointMap).length
});

console.log(`[MJCF Validation] ${validationResult.summary}`);

// Log warnings
if (validationResult.warnings.length > 0) {
  console.warn(`[MJCF Validation] Warnings:`);
  validationResult.warnings.forEach(w => {
    console.warn(`  - ${w.message}: ${w.suggestedFix}`);
    if (mjcfLoading) {
      mjcfLoading.addWarning(`${w.message}: ${w.suggestedFix}`);
    }
  });
}

// Log errors
if (validationResult.errors.length > 0) {
  console.error(`[MJCF Validation] Errors:`);
  validationResult.errors.forEach(e => {
    console.error(`  - ${e.message}: ${e.suggestedFix}`);
  });
}
```

---

## 📋 Coordination Rules

### Agent 1 (Loader Refactoring)
**Focus:** Simplifying existing `MJCFLoader.ts` logic
- ✅ Remove conditional OBJ/STL branches
- ✅ Use unified coordinate conversion
- ✅ Simplify keyframe application
- ❌ **Do NOT** add new utility classes (Agent 2 handles this)
- ❌ **Do NOT** add validation logic (Agent 2 will integrate)

### Agent 2 (Architecture & Integration)
**Focus:** Adding utilities and integrating them after Agent 1 finishes
- ✅ Create utility classes
- ✅ Document integration points
- ❌ **Do NOT** modify `MJCFLoader.ts` while Agent 1 is working
- ⏸️ **Wait** for Agent 1 to signal completion before integration

---

## 🚦 Integration Trigger

**When to integrate:** Agent 1 should signal when loader refactoring is complete by:
1. Confirming all position/quaternion conversion is unified
2. Confirming keyframe application logic is simplified
3. Confirming loader tests pass

**Then:** Agent 2 will:
1. Read the final `MJCFLoader.ts` state
2. Integrate the three utility classes one by one
3. Test each integration step
4. Run full validation suite

---

## 📝 Testing Checklist (After Integration)

### Model Type Detection
- [ ] Pure OBJ model (B2/GO2) detected correctly
- [ ] Pure STL model (H1/H1_2) detected correctly
- [ ] Mixed model detected and classified
- [ ] Recommendations displayed in console

### Keyframe Management
- [ ] Keyframes registered on first load
- [ ] Double application prevented on reload
- [ ] Keyframe switching works correctly
- [ ] Validation catches invalid keyframes

### Validation
- [ ] Orientation issues detected (sideways robots)
- [ ] Scale accumulation detected
- [ ] Hierarchy errors caught (orphaned nodes)
- [ ] Ground plane warnings shown
- [ ] Auto-fix functions work

---

## 🔍 Known Issues to Watch

1. **Coordinate System:**
   - kinetiCORE uses Z-up throughout (see `COORDINATE_SYSTEM.md`)
   - MJCFLoader converts from MuJoCo Z-up to Babylon Y-up
   - Ensure this conversion is consistent with existing coordinate system

2. **Keyframe Double Application:**
   - Previously caused major issues
   - `MJCFKeyframeManager` should prevent this completely
   - Test extensively with reload scenarios

3. **OBJ Upright Rotation:**
   - Only OBJ models need upright rotation
   - STL models are already pre-oriented
   - Ensure `MJCFModelTypeDetector` correctly identifies model type

---

## 🎯 Success Criteria

Integration is successful when:
- ✅ All existing MJCF models load correctly
- ✅ Model type detection shows correct recommendations
- ✅ Keyframe double application is prevented
- ✅ Validation catches common issues
- ✅ No regression in existing functionality
- ✅ Console logs are informative but not excessive

---

## 📞 Communication Protocol

When Agent 1 completes refactoring:
1. Commit changes with message: `refactor: MJCF loader unified coordinate conversion`
2. Tag Agent 2 in commit or notify George
3. Agent 2 will review, integrate utilities, and test

When Agent 2 completes integration:
1. Commit changes with message: `feat: Add MJCF model analysis and validation utilities`
2. Run full test suite
3. Document any new issues found

---

## 📚 References

- Main Coordinate System Doc: `COORDINATE_SYSTEM.md`
- Project Instructions: `CLAUDE.md`
- Architecture Doc: `docs/architecture.md`
- MJCF Package Guide: See files in `C:\Users\George\source\repos\cursor\kinetiCORE\src_feature\MJCF_UIUX\`

---

**Last Updated:** 2025-10-16
**Agent 1 Status:** 🔄 Active (refactoring loader)
**Agent 2 Status:** ✅ Complete (utilities ready)
**Integration Status:** ⏸️ Waiting for Agent 1 to finish
