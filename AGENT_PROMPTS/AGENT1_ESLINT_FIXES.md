# Agent 1: ESLint Fixes - Core Files

**Your Assignment**: Fix ESLint errors in core source files (unused variables, case blocks, @ts-ignore, empty catch blocks)

**Branch**: `feature/smart-routing-system`  
**Status**: Ready to start  
**Estimated Time**: 2-3 hours

## Your Tasks

Fix ESLint errors in the following categories:

### Category A: Unused Variables
**Files to Fix**:
- `src/kinematics/__tests__/Kinematics.edgecases.test.ts` (lines 345, 356, 366, 376)
- `src/kinematics/__tests__/MassProperties.test.ts` (line 74)
- `src/kinematics/__tests__/WholeBodyIKSolver.test.ts` (lines 101, 132)
- `test-honest-jt-workflow.ts` (line 22)
- `test-jt-kinematic-workflow.ts` (line 23)
- `test-mjcf-google-robot.ts` (lines 18, 345)
- `vite.config.ts` (line 109)

**Fix Pattern**:
```typescript
// Bad
const fkPose = calculateFK(...);

// Fix: Prefix with underscore
const _fkPose = calculateFK(...);

// Or remove if truly unused
```

### Category B: Lexical Declarations in Case Blocks
**Files to Fix**:
- `src/kinematics/device/DeviceClassifier.ts` (lines 560, 564)
- `src/kinematics/devices/FixtureController.ts` (line 190)
- `src/library/UserAwareAssetManager.ts` (lines 672, 673)
- `src/library/services/ThumbnailGenerationService.ts` (lines 368, 372, 376, 383, 387, 395)

**Fix Pattern**:
```typescript
// Bad
switch (type) {
  case 'foo':
    const x = 10;
    break;
}

// Fix: Wrap in braces
switch (type) {
  case 'foo': {
    const x = 10;
    break;
  }
}
```

### Category C: @ts-ignore → @ts-expect-error
**Files to Fix**:
- `src/library/AdvancedSearchManager.ts` (lines 183, 408, 412)
- `src/library/UserAwareAssetManager.ts` (lines 32, 96)

**Fix Pattern**:
```typescript
// Bad
// @ts-ignore
const data = legacyAPI();

// Fix
// @ts-expect-error - Legacy API compatibility
const data = legacyAPI();
```

### Category D: Empty Catch Blocks
**Files to Fix**:
- `src/library/AssetLibraryManager.ts` (line 75)
- `src/library/AssetLoader.ts` (line 248)
- `src/library/GLBExportService.ts` (lines 96, 106, 120, 166, 179, 183, 195, 204, 236, 246, 247, 251, 254)
- Multiple test files (check for empty catch blocks)

**Fix Pattern**:
```typescript
// Bad
try {
  dangerousOperation();
} catch (e) {}

// Fix: Add comment explaining why it's safe to ignore
try {
  dangerousOperation();
} catch (e) {
  // Ignore: Operation is optional, failure is acceptable
}
```

## Workflow

1. **Pull latest changes**:
   ```bash
   git pull origin feature/smart-routing-system
   ```

2. **Check current lint errors**:
   ```bash
   npm run lint
   ```

3. **Fix files systematically**:
   - Start with Category A (unused variables)
   - Then Category B (case blocks)
   - Then Category C (@ts-ignore)
   - Finally Category D (empty catch blocks)

4. **Verify your fixes**:
   ```bash
   npm run lint
   npm run type-check  # Ensure TypeScript still compiles
   ```

5. **Test that nothing broke**:
   ```bash
   npm test -- --run
   ```

## When You're Done

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "fix(eslint): resolve unused variables, case blocks, @ts-ignore, and empty catch blocks

   - Fix unused variables by prefixing with underscore or removing
   - Wrap lexical declarations in case blocks with braces
   - Replace @ts-ignore with @ts-expect-error and add explanations
   - Add explanatory comments to empty catch blocks
   
   Agent 1: Core ESLint fixes
   Related: NEXT_DEV_HANDOFF.md"
   ```

2. **Push to branch**:
   ```bash
   git push origin feature/smart-routing-system
   ```

3. **Update handoff document**:
   - Edit `NEXT_DEV_HANDOFF.md`
   - Under "Tasks Remaining Before Merge" → Section 1
   - Add a note: "✅ Agent 1 completed: Core ESLint fixes done"
   - Commit this update:
     ```bash
     git add NEXT_DEV_HANDOFF.md
     git commit -m "docs: update handoff - Agent 1 ESLint fixes complete"
     git push origin feature/smart-routing-system
     ```

4. **Notify orchestrator**:
   - The orchestrator (Agent 5) will pick up your work
   - No need to create a PR - just push and update the handoff doc

## Success Criteria

- ✅ `npm run lint` shows 0 errors in your assigned files
- ✅ `npm run type-check` still passes
- ✅ `npm test -- --run` still passes (no regressions)
- ✅ All changes committed and pushed
- ✅ Handoff document updated

## Reference Documents

- **Main Handoff**: `NEXT_DEV_HANDOFF.md` - Read this first!
- **Troubleshooting**: See "Troubleshooting Common Issues" section in handoff doc

## Notes

- **Don't fix React Refresh warnings** - These are warnings, not errors, and can be ignored
- **Don't fix Supabase function unused params** - That's Agent 2's job
- **Don't fix test failures** - That's Agent 3 and 4's job
- **Focus only on your assigned categories** - Stay in your lane!

Good luck! 🚀

