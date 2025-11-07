# Agent 4: Unit Test Fixes - Asset Loading Workflow Tests

**Your Assignment**: Fix failing unit tests in Asset Loading Workflow test file (4 failing tests)

**Branch**: `feature/smart-routing-system`  
**Status**: Ready to start (wait for Agents 1, 2, & 3 to complete)  
**Estimated Time**: 1-2 hours

## Your Tasks

Fix 4 failing tests in the Asset Loading Workflow test file.

### Main Issue: `editorStore` undefined in integration tests

**File to Fix**:
- `src/__tests__/integration/AssetLoadingWorkflow.test.ts` (4 failing tests)

**Error Pattern**:
```
TypeError: Cannot destructure property 'getButtonState' of 'useEditorStore(...)' as it is undefined.
```

**Root Cause**: Test setup not initializing Zustand store properly (same issue as Agent 3)

## Workflow

1. **Wait for Agents 1, 2, & 3**:
   - Check that ESLint fixes and MJCF test fixes are complete
   - Pull latest changes:
     ```bash
     git pull origin feature/smart-routing-system
     ```

2. **Check current test failures**:
   ```bash
   npm test -- --run src/__tests__/integration/AssetLoadingWorkflow.test.ts
   ```

3. **Review Agent 3's solution**:
   - Check how Agent 3 fixed `MJCFIntegration.test.tsx`
   - You can likely use a similar approach
   - Check `src/ui/store/editorStore.ts` to see the actual store structure

4. **Fix the test setup**:
   
   **Option A: Mock the store** (Recommended, same as Agent 3):
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
   npm test -- --run src/__tests__/integration/AssetLoadingWorkflow.test.ts
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
6. **Check Agent 3's solution**: See how they fixed similar issues

## When You're Done

1. **Commit your changes**:
   ```bash
   git add src/__tests__/integration/AssetLoadingWorkflow.test.ts
   git commit -m "fix(tests): initialize editorStore in Asset Loading Workflow tests

   - Add proper Zustand store mock/initialization
   - Fix 4 failing tests due to undefined editorStore
   - Ensure test isolation with proper cleanup
   
   Agent 4: Asset Loading Workflow test fixes
   Related: NEXT_DEV_HANDOFF.md"
   ```

2. **Push to branch**:
   ```bash
   git push origin feature/smart-routing-system
   ```

3. **Update handoff document**:
   - Edit `NEXT_DEV_HANDOFF.md`
   - Under "Tasks Remaining Before Merge" → Section 2
   - Add a note: "✅ Agent 4 completed: Asset Loading Workflow tests fixed (4/4 passing)"
   - Commit this update:
     ```bash
     git add NEXT_DEV_HANDOFF.md
     git commit -m "docs: update handoff - Agent 4 test fixes complete"
     git push origin feature/smart-routing-system
     ```

4. **Notify orchestrator**:
   - The orchestrator (Agent 5) will pick up your work
   - No need to create a PR - just push and update the handoff doc

## Success Criteria

- ✅ All 4 tests in `AssetLoadingWorkflow.test.ts` pass
- ✅ `npm test -- --run` shows no failures in your file
- ✅ `npm run lint` still shows 0 errors
- ✅ `npm run type-check` still passes
- ✅ All changes committed and pushed
- ✅ Handoff document updated

## Reference Documents

- **Main Handoff**: `NEXT_DEV_HANDOFF.md` - Read this first!
- **Troubleshooting**: See "Troubleshooting Common Issues" → Issue 2
- **Store File**: `src/ui/store/editorStore.ts` - Check actual store structure
- **Agent 3's Solution**: `src/__tests__/integration/MJCFIntegration.test.tsx` - See how they fixed it

## Notes

- **Don't fix other test files** - That's Agent 3's job
- **Don't fix ESLint errors** - That's Agents 1 & 2's job
- **Focus only on Asset Loading Workflow tests** - Stay in your lane!
- **Test isolation is critical** - Make sure tests don't affect each other
- **Similar to Agent 3's work** - You can reference their solution

Good luck! 🚀

