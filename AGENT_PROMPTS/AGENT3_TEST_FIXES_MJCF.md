# Agent 3: Unit Test Fixes - MJCF Integration Tests

**Your Assignment**: Fix failing unit tests in MJCF integration test file (40 failing tests)

**Branch**: `feature/smart-routing-system`  
**Status**: Ready to start (wait for Agents 1 & 2 to complete)  
**Estimated Time**: 2-3 hours

## Your Tasks

Fix 40 failing tests in the MJCF integration test file.

### Main Issue: `editorStore` undefined in integration tests

**File to Fix**:
- `src/__tests__/integration/MJCFIntegration.test.tsx` (40 failing tests)

**Error Pattern**:
```
TypeError: Cannot destructure property 'getButtonState' of 'useEditorStore(...)' as it is undefined.
```

**Root Cause**: Test setup not initializing Zustand store properly

## Workflow

1. **Wait for Agents 1 & 2**:
   - Check that ESLint fixes are complete
   - Pull latest changes:
     ```bash
     git pull origin feature/smart-routing-system
     ```

2. **Check current test failures**:
   ```bash
   npm test -- --run src/__tests__/integration/MJCFIntegration.test.tsx
   ```

3. **Understand the store structure**:
   - Check `src/ui/store/editorStore.ts` to see the actual store structure
   - Use `useEditorStore.getState()` to inspect what methods/properties exist
   - Check what `getButtonState` and other methods return

4. **Fix the test setup**:
   
   **Option A: Mock the store** (Recommended):
   ```typescript
   // At top of test file, before any imports
   import { vi } from 'vitest';
   
   vi.mock('@/ui/store/editorStore', () => {
     const mockStore = {
       getButtonState: vi.fn(() => ({ visible: true, enabled: true })),
       // Add other methods that tests need
       // Check the actual store to see what's needed
     };
     return {
       useEditorStore: vi.fn((selector) => selector(mockStore)),
     };
   });
   ```

   **Option B: Initialize store properly**:
   ```typescript
   import { useEditorStore } from '@/ui/store/editorStore';
   
   beforeEach(() => {
     // Reset store state before each test
     useEditorStore.setState({
       // ... initial state matching what tests expect
     });
   });
   
   afterEach(() => {
     // Clean up after each test
     useEditorStore.setState({});
     vi.clearAllMocks();
   });
   ```

5. **Verify your fixes**:
   ```bash
   npm test -- --run src/__tests__/integration/MJCFIntegration.test.tsx
   ```

6. **Ensure no regressions**:
   ```bash
   npm test -- --run  # Run all tests
   npm run lint       # Ensure no new lint errors
   npm run type-check # Ensure TypeScript still compiles
   ```

## Troubleshooting

If tests still fail after adding mocks:

1. **Check import path**: Ensure `@/ui/store/editorStore` is correct
2. **Verify mock is before imports**: Vitest mocks must be declared before component imports
3. **Check store structure**: Use `useEditorStore.getState()` to see actual structure
4. **Check for multiple store instances**: Ensure you're not creating multiple instances
5. **See handoff doc**: Check "Troubleshooting Common Issues" → Issue 2

## When You're Done

1. **Commit your changes**:
   ```bash
   git add src/__tests__/integration/MJCFIntegration.test.tsx
   git commit -m "fix(tests): initialize editorStore in MJCF integration tests

   - Add proper Zustand store mock/initialization
   - Fix 40 failing tests due to undefined editorStore
   - Ensure test isolation with proper cleanup
   
   Agent 3: MJCF integration test fixes
   Related: NEXT_DEV_HANDOFF.md"
   ```

2. **Push to branch**:
   ```bash
   git push origin feature/smart-routing-system
   ```

3. **Update handoff document**:
   - Edit `NEXT_DEV_HANDOFF.md`
   - Under "Tasks Remaining Before Merge" → Section 2
   - Add a note: "✅ Agent 3 completed: MJCF integration tests fixed (40/40 passing)"
   - Commit this update:
     ```bash
     git add NEXT_DEV_HANDOFF.md
     git commit -m "docs: update handoff - Agent 3 test fixes complete"
     git push origin feature/smart-routing-system
     ```

4. **Notify orchestrator**:
   - The orchestrator (Agent 5) will pick up your work
   - No need to create a PR - just push and update the handoff doc

## Success Criteria

- ✅ All 40 tests in `MJCFIntegration.test.tsx` pass
- ✅ `npm test -- --run` shows no failures in your file
- ✅ `npm run lint` still shows 0 errors
- ✅ `npm run type-check` still passes
- ✅ All changes committed and pushed
- ✅ Handoff document updated

## Reference Documents

- **Main Handoff**: `NEXT_DEV_HANDOFF.md` - Read this first!
- **Troubleshooting**: See "Troubleshooting Common Issues" → Issue 2
- **Store File**: `src/ui/store/editorStore.ts` - Check actual store structure

## Notes

- **Don't fix other test files** - That's Agent 4's job
- **Don't fix ESLint errors** - That's Agents 1 & 2's job
- **Focus only on MJCF integration tests** - Stay in your lane!
- **Test isolation is critical** - Make sure tests don't affect each other

Good luck! 🚀

