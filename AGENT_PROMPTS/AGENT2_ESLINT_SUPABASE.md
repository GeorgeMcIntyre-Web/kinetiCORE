# Agent 2: ESLint Fixes - Supabase Functions

**Your Assignment**: Fix ESLint errors in Supabase functions (unused function parameters)

**Branch**: `feature/smart-routing-system`  
**Status**: Ready to start (wait for Agent 1 to complete)  
**Estimated Time**: 30-60 minutes

## Your Tasks

Fix unused function parameters in Supabase edge functions.

### Category E: Unused Function Parameters (Supabase Functions)
**File to Fix**:
- `supabase/functions/asset-processor/index.ts` (multiple lines: 181, 414, 420, 425, 430, 443, 458, 482, 490, 498, 506)

**Fix Pattern**:
```typescript
// Bad
function process(fileData: Buffer, size: number) {
  return doSomething();
}

// Fix: Prefix with underscore
function process(_fileData: Buffer, _size: number) {
  return doSomething();
}
```

## Workflow

1. **Wait for Agent 1**:
   - Check that Agent 1 has completed and pushed their changes
   - Pull latest changes:
     ```bash
     git pull origin feature/smart-routing-system
     ```

2. **Check current lint errors**:
   ```bash
   npm run lint
   ```

3. **Fix the Supabase file**:
   - Open `supabase/functions/asset-processor/index.ts`
   - Find all unused parameters at the specified lines
   - Prefix each unused parameter with underscore (`_`)

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
   git add supabase/functions/asset-processor/index.ts
   git commit -m "fix(eslint): prefix unused parameters in Supabase functions

   - Prefix unused function parameters with underscore
   - Fixes ESLint errors in asset-processor edge function
   
   Agent 2: Supabase ESLint fixes
   Related: NEXT_DEV_HANDOFF.md"
   ```

2. **Push to branch**:
   ```bash
   git push origin feature/smart-routing-system
   ```

3. **Update handoff document**:
   - Edit `NEXT_DEV_HANDOFF.md`
   - Under "Tasks Remaining Before Merge" → Section 1
   - Add a note: "✅ Agent 2 completed: Supabase ESLint fixes done"
   - Commit this update:
     ```bash
     git add NEXT_DEV_HANDOFF.md
     git commit -m "docs: update handoff - Agent 2 ESLint fixes complete"
     git push origin feature/smart-routing-system
     ```

4. **Notify orchestrator**:
   - The orchestrator (Agent 5) will pick up your work
   - No need to create a PR - just push and update the handoff doc

## Success Criteria

- ✅ `npm run lint` shows 0 errors in `supabase/functions/asset-processor/index.ts`
- ✅ `npm run type-check` still passes
- ✅ `npm test -- --run` still passes (no regressions)
- ✅ All changes committed and pushed
- ✅ Handoff document updated

## Reference Documents

- **Main Handoff**: `NEXT_DEV_HANDOFF.md` - Read this first!
- **Troubleshooting**: See "Troubleshooting Common Issues" section in handoff doc

## Notes

- **This is a single file fix** - Should be quick!
- **Don't fix other ESLint errors** - That's Agent 1's job
- **Don't fix test failures** - That's Agent 3 and 4's job
- **Focus only on Supabase functions** - Stay in your lane!

Good luck! 🚀

