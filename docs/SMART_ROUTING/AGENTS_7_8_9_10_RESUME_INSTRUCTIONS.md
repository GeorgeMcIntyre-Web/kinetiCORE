# Resume Instructions for Agents 7, 8, 9, 10

**Date:** 2025-01-03
**Resume Time:** 12:15 PM
**Your tokens reset at:** 1:00 PM

---

## 🚨 CRITICAL: First Action When You Resume

**BEFORE doing anything else, run these commands:**

```bash
# 1. Check your current branch
git branch

# 2. Check if you have local commits
git log --oneline -10

# 3. Check if your branch exists on GitHub
git fetch origin
git branch -r | grep "agent-[YOUR_NUMBER]"

# 4. If you have a local branch with commits, PUSH IT:
git push origin feature/sr/agent-[YOUR_NUMBER]-[topic]

# 5. If you DON'T have a branch yet:
git checkout feature/smart-routing-system
git pull origin feature/smart-routing-system
git checkout -b feature/sr/agent-[YOUR_NUMBER]-[topic]
# Make your first commit
git add .
git commit -m "feat(agent-[N]): initial commit"
git push -u origin feature/sr/agent-[YOUR_NUMBER]-[topic]
```

---

## 📊 Current Status (As of Session Pause)

### ✅ Agents with Work on GitHub:
- **Agent 1:** `origin/feature/sr/agent-1-pathfinding` (10 commits, in progress)
- **Agent 2:** `origin/feature/sr/agent-2-validation` (4 commits, appears complete)
- **Agent 3:** `origin/feature/sr/agent-3-specs` (2 commits, ✅ COMPLETE)
- **Agent 4:** `origin/feature/sr/agent-4-pipe-geo` (standup only)
- **Agent 5:** `origin/feature/sr/agent-5-tray-geo` (no commits yet)
- **Agent 6:** `origin/feature/sr/agent-6-wire-conduit-geo` (2 commits, ✅ COMPLETE)

### ❌ Agents WITHOUT branches on GitHub:
- **Agent 7** ← YOU
- **Agent 8** ← YOU (CRITICAL PATH!)
- **Agent 9** ← YOU
- **Agent 10** ← YOU

---

## 📋 Agent 7: Connection Manager

### Your Role
Enhance the existing ConnectionManager with multi-drop support and duplicate detection.

### What Already Exists (Pre-Agent Work)
- ✅ `src/routing/core/ConnectionManager.ts` (273 lines, merged Nov 1)
- ✅ `src/routing/core/ConnectionPoint.ts` (151 lines, merged Nov 1)
- ✅ `src/routing/core/__tests__/ConnectionManager.test.ts` (202 lines)

### Your Task
1. **Review existing code:**
   ```bash
   cat src/routing/core/ConnectionManager.ts
   cat src/routing/core/ConnectionPoint.ts
   ```

2. **Check what's missing:**
   - Is `findDuplicateAt(position, radius)` implemented?
   - Is multi-drop support working?
   - Are tests covering TC-CM1 and TC-CM2?

3. **Implement missing features:**
   - Add duplicate detection if missing
   - Ensure multi-drop connections work
   - Add/update tests

4. **Test your work:**
   ```bash
   npm test -- tests/routing/ConnectionManager.test.ts
   ```

5. **Update ACCEPTANCE_TESTS.md:**
   - Mark TC-CM1 and TC-CM2 with status
   - Add test output
   - Add your name and date

6. **Push and create PR:**
   ```bash
   git add .
   git commit -m "feat(agent-7): enhance connection manager with duplicate detection"
   git push origin feature/sr/agent-7-connections
   ```

### Your Acceptance Tests
- **TC-CM1:** Multi-drop support (multiple routes from one connector)
- **TC-CM2:** Duplicate prevention (no overlapping connectors within 0.1m)

### Your Files (from AGENT_ASSIGNMENTS.md)
**YOUR FILES:**
- `src/routing/core/ConnectionManager.ts`
- `src/routing/core/ConnectionPoint.ts`
- `tests/routing/ConnectionManager.test.ts`

**SHARED FILES (announce before editing):**
- `src/routing/core/types.ts`

---

## 📋 Agent 8: UI/UX & Scene Tree

### ⚠️ YOU ARE CRITICAL PATH!

**Other agents are waiting for your UI fixes before they can test their work!**

### Your Role
Fix stack overflow errors and implement ID-based selection.

### What Already Exists (Pre-Agent Work)
- ✅ `src/ui/components/SceneTree.tsx` (25,246 bytes)
- ✅ Recent cycle detection fixes (commits f681843, 915969e)
- ✅ Fix: "Add cycle detection initialization and better error logging"

### Your Task
1. **Verify existing fixes:**
   ```bash
   # Check recent SceneTree changes
   git log --oneline -- src/ui/components/SceneTree.tsx -10

   # View the file
   code src/ui/components/SceneTree.tsx
   ```

2. **Test manually:**
   ```bash
   npm run dev
   # Open http://localhost:5173
   # Switch to Professional Mode
   # Open Scene Tree
   # Expand/collapse nodes 10 times
   # Check console for errors
   ```

3. **Check if fixes are already done:**
   - Search for "cycle detection" in SceneTree.tsx
   - Search for "uniqueId" selection logic
   - Search for "visitedNodes" tracking

4. **If fixes exist:**
   - Document what was fixed and when
   - Add tests to verify fixes
   - Update ACCEPTANCE_TESTS.md with ✅ status
   - Create PR documenting the pre-existing fixes

5. **If fixes are missing:**
   - Implement stack overflow prevention
   - Implement ID-based selection
   - Add tests
   - Update ACCEPTANCE_TESTS.md

6. **Push immediately:**
   ```bash
   git add .
   git commit -m "feat(agent-8): verify and test scene tree fixes"
   git push origin feature/sr/agent-8-ui
   ```

### Your Acceptance Tests
- **TC-UI1:** No hook or stack overflow errors
- **TC-UI2:** Selection by unique ID (not by name)
- **TC-UI3:** Scene tree auto-resize

### Your Files (from AGENT_ASSIGNMENTS.md)
**YOUR FILES:**
- `src/ui/components/SceneTree.tsx`
- `src/ui/components/SceneTree.css`
- `src/routing/ui/RoutingControlPanel.tsx`
- `tests/routing/UI.test.ts`

**SHARED FILES (announce before editing):**
- `src/ui/store/routingStore.ts`

### CRITICAL: Post Status Update
Once you verify the fixes, immediately post in TODO_BOARD.md:
```
#### Agent 8 - UI/UX (12:15 PM Update)
- **Status:** Stack overflow fixes VERIFIED ✅ (pre-existing commit f681843)
- **Status:** ID-based selection VERIFIED ✅ (uniqueId usage confirmed)
- **Blockers:** NONE - other agents can proceed
```

---

## 📋 Agent 9: Persistence & Exports

### Your Role
Create routing-specific persistence layer and export functionality.

### What Already Exists (Pre-Agent Work)
- ✅ `src/scene/WorldSerializer.ts` (general scene serialization)
- ✅ `src/library/GLBExportService.ts` (general GLB export)
- ❌ **NO `src/routing/persistence/` folder**

### Your Task
1. **Create routing persistence layer:**
   ```bash
   mkdir -p src/routing/persistence
   ```

2. **Create these files:**
   - `src/routing/persistence/RouteSerializer.ts` - Save/load routes
   - `src/routing/persistence/BOMExporter.ts` - Export bill of materials
   - `src/routing/persistence/RouteGLBExporter.ts` - Export routes as GLB
   - `tests/routing/Persistence.test.ts` - Tests

3. **Extend WorldSerializer:**
   - Add routing data to save format
   - Hook into existing save/load workflow

4. **Implement BOM export:**
   - Collect parts from all routes
   - Use `computeBOM()` from Agents 4, 5, 6
   - Export as JSON/CSV

5. **Implement GLB export:**
   - Export route geometry as GLB
   - Include connectors and supports

6. **Dependencies:**
   - **WAIT** for Agents 4, 5, 6 to implement `computeBOM()` methods
   - Check their PRs before implementing BOM export

7. **Test:**
   ```bash
   npm test -- tests/routing/Persistence.test.ts
   ```

8. **Push:**
   ```bash
   git add .
   git commit -m "feat(agent-9): implement routing persistence and export"
   git push origin feature/sr/agent-9-persistence
   ```

### Your Acceptance Tests
- **TC-S1:** Save/load routes, connectors, and BOM export

### Your Files (from AGENT_ASSIGNMENTS.md)
**YOUR FILES:**
- `src/routing/persistence/` (new folder)
- `tests/routing/Persistence.test.ts`

**SHARED FILES (announce before editing):**
- `src/scene/WorldSerializer.ts`

---

## 📋 Agent 10: QA & Testing

### 🔄 ROLE CLARIFICATION

**Your PRIMARY role is INDEPENDENT VERIFICATION, not writing test infrastructure!**

### What You Should Do
**Verify other agents' work independently:**

1. **Verify Agent 1 (Pathfinding):**
   ```bash
   git checkout origin/feature/sr/agent-1-pathfinding
   npm test -- tests/routing/Agent1-Pathfinding.test.ts
   # Document results in ACCEPTANCE_TESTS.md
   ```

2. **Verify Agent 2 (Validation):**
   ```bash
   git checkout origin/feature/sr/agent-2-validation
   npm test
   # Check TC-V1, TC-V2
   ```

3. **Verify Agent 3 (Specifications):**
   ```bash
   git checkout origin/feature/sr/agent-3-specs
   npm test -- tests/routing/Specifications.test.ts
   # Check TC-SP1, TC-SP2
   ```

4. **Verify Agent 6 (Wire/Conduit):**
   ```bash
   git checkout origin/feature/sr/agent-6-wire-conduit-geo
   npm test -- tests/routing/CableGenerator.test.ts
   npm test -- tests/routing/ConduitGenerator.test.ts
   # Check TC-W1, TC-C1
   ```

5. **Update ACCEPTANCE_TESTS.md:**
   For each test you verify, add:
   ```markdown
   **Independently Verified By:** Agent 10
   **Verification Date:** 2025-01-03 12:30 PM
   **Verification Result:** ✅ CONFIRMED PASSING / ❌ FAILING
   **Notes:** [Any issues found]
   ```

6. **Document findings in TODO_BOARD.md:**
   ```markdown
   #### Agent 10 - QA (12:15 PM Update)
   - **Yesterday:** Token limit reached
   - **Today:** Verifying Agents 1, 2, 3, 6
   - **Verified:** Agent 1 (1.5/3 tests ✅), Agent 2 (pending), Agent 3 (✅)
   - **Blockers:** None
   ```

### What You Should NOT Do
- ❌ Write test scaffolds (agents write their own tests)
- ❌ Write demo scenes (not needed)
- ❌ Create test infrastructure (already exists via vitest)
- ❌ Work in isolation without verifying others

### Your Acceptance Test
- **TC-QA1:** Independent verification of 5+ agents complete

### Your Files (from AGENT_ASSIGNMENTS.md)
**YOUR FILES:**
- `docs/SMART_ROUTING/ACCEPTANCE_TESTS.md` (add verification signatures)
- `docs/SMART_ROUTING/TODO_BOARD.md` (document findings)

---

## 📅 Timeline for Today (12:15 - 1:00 PM)

**You have ~45 minutes before tokens reset at 1:00 PM.**

### Recommended Schedule:

**12:15 - 12:20 (5 min):** Check branch status, push if needed
**12:20 - 12:45 (25 min):** Core implementation work
**12:45 - 12:55 (10 min):** Test and document
**12:55 - 1:00 (5 min):** Push final changes, create PR

---

## 🔗 Key Resources

- **Acceptance Tests:** `docs/SMART_ROUTING/ACCEPTANCE_TESTS.md`
- **TODO Board:** `docs/SMART_ROUTING/TODO_BOARD.md`
- **Agent Assignments:** `docs/SMART_ROUTING/AGENT_ASSIGNMENTS.md`
- **Tech Spec:** `docs/SMART_ROUTING/TECH_SPEC.md`

---

## 📞 Communication Protocol

### If You're Blocked:
Post immediately in TODO_BOARD.md under **Active Blockers**:
```markdown
### [BLOCKER] Agent [N] - [Issue Title]
**Issue:** [Description]
**Blocked Since:** [Time]
**Owner:** [Who can unblock]
**Status:** [What you need]
```

### Daily Standup Format:
Post in TODO_BOARD.md under **Daily Standups**:
```markdown
#### Agent [N] - [Your Role] (12:15 PM)
- **Yesterday:** [What you did before token limit]
- **Today:** [What you're doing now]
- **Tomorrow:** [Next session plans]
- **Blockers:** [Any blockers]
- **PRs:** [PR links]
```

---

## ✅ Definition of Done

Your work is NOT done until:

1. ✅ All code pushed to `origin/feature/sr/agent-[N]-[topic]`
2. ✅ All tests passing (`npm test -- tests/routing/YourTests.test.ts`)
3. ✅ ACCEPTANCE_TESTS.md updated with evidence
4. ✅ TODO_BOARD.md updated with status
5. ✅ PR created with title: `[Agent N] feat: your feature description`
6. ✅ PR includes: Test output, acceptance test IDs, screenshots

---

## 🚀 Quick Start Commands

```bash
# Check status
git status
git branch
git log --oneline -5

# Create/switch to your branch
git checkout -b feature/sr/agent-[N]-[topic]

# Make changes, then:
git add .
git commit -m "feat(agent-[N]): your change"
git push origin feature/sr/agent-[N]-[topic]

# Run tests
npm test -- tests/routing/YourTest.test.ts

# Run all tests
npm test

# Run build
npm run build
```

---

**Good luck! Remember: Evidence-based completion only. No "done" without tests passing.**
