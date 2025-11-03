# Quick Resume Cards - Copy/Paste to Each Agent

**Instructions:** When agents 7-10 resume at 12:15, copy/paste the relevant card below to that agent.

---

## 🟦 AGENT 7 - QUICK RESUME CARD

```
AGENT 7 - CONNECTION MANAGER RESUME (12:15 PM)

⏰ STATUS CHECK FIRST:
Run these commands immediately:
  git branch
  git log --oneline -5
  git fetch origin
  git branch -r | grep "agent-7"

❌ YOUR BRANCH NOT FOUND ON GITHUB!
If you have local commits, push now:
  git push origin feature/sr/agent-7-connections

📋 YOUR TASK:
1. ConnectionManager.ts already exists (merged Nov 1 - pre-agent work)
2. Verify if duplicate detection (findDuplicateAt) is implemented
3. Add/enhance if missing
4. Test: npm test -- tests/routing/ConnectionManager.test.ts
5. Update ACCEPTANCE_TESTS.md (TC-CM1, TC-CM2)
6. PUSH BRANCH + CREATE PR

📖 FULL INSTRUCTIONS:
docs/SMART_ROUTING/AGENTS_7_8_9_10_RESUME_INSTRUCTIONS.md (Agent 7 section)

⏱️ YOU HAVE 45 MINUTES (tokens reset 1pm)
```

---

## 🟧 AGENT 8 - QUICK RESUME CARD

```
AGENT 8 - UI/UX RESUME (12:15 PM) 🚨 CRITICAL PATH!

⚠️ ALL OTHER AGENTS ARE WAITING FOR YOU!

⏰ STATUS CHECK FIRST:
Run these commands immediately:
  git branch
  git log --oneline -5
  git fetch origin
  git branch -r | grep "agent-8"

❌ YOUR BRANCH NOT FOUND ON GITHUB!

🔍 CRITICAL TASK:
SceneTree.tsx fixes may ALREADY EXIST (from prior work):
1. Check: git log -- src/ui/components/SceneTree.tsx
2. Search code for "cycle detection" and "uniqueId"
3. Test manually: npm run dev → Professional Mode → Scene Tree
4. If fixes exist: Document them, add tests, PUSH BRANCH
5. If fixes missing: Implement, test, PUSH BRANCH

✅ YOUR ACCEPTANCE TESTS:
- TC-UI1: No stack overflow errors
- TC-UI2: ID-based selection (not name-based)

🚨 PUSH IMMEDIATELY TO UNBLOCK OTHERS!
Post status in TODO_BOARD.md as soon as verified.

📖 FULL INSTRUCTIONS:
docs/SMART_ROUTING/AGENTS_7_8_9_10_RESUME_INSTRUCTIONS.md (Agent 8 section)

⏱️ YOU HAVE 45 MINUTES (tokens reset 1pm)
```

---

## 🟩 AGENT 9 - QUICK RESUME CARD

```
AGENT 9 - PERSISTENCE & EXPORTS RESUME (12:15 PM)

⏰ STATUS CHECK FIRST:
Run these commands immediately:
  git branch
  git log --oneline -5
  git fetch origin
  git branch -r | grep "agent-9"

❌ YOUR BRANCH NOT FOUND ON GITHUB!
❌ NO src/routing/persistence/ FOLDER FOUND!

📋 YOUR TASK:
1. Create: mkdir -p src/routing/persistence
2. Implement:
   - RouteSerializer.ts (save/load routes)
   - BOMExporter.ts (export bill of materials)
   - RouteGLBExporter.ts (export routes as GLB)
3. Tests: tests/routing/Persistence.test.ts
4. Update ACCEPTANCE_TESTS.md (TC-S1)
5. PUSH BRANCH + CREATE PR

✅ DEPENDENCY RESOLVED:
Agent 6 COMPLETE ✅ - BOM APIs available!

📖 FULL INSTRUCTIONS:
docs/SMART_ROUTING/AGENTS_7_8_9_10_RESUME_INSTRUCTIONS.md (Agent 9 section)

⏱️ YOU HAVE 45 MINUTES (tokens reset 1pm)
```

---

## 🟪 AGENT 10 - QUICK RESUME CARD

```
AGENT 10 - QA & TESTING RESUME (12:15 PM)

⚠️ ROLE CLARIFICATION:
Your PRIMARY role is INDEPENDENT VERIFICATION, not writing test infrastructure!

⏰ STATUS CHECK FIRST:
Run these commands immediately:
  git branch
  git log --oneline -5

❌ YOUR BRANCH NOT FOUND ON GITHUB!

🔄 YOUR TASK (VERIFICATION WORK):
DO NOT write test infrastructure. Instead, VERIFY other agents:

1. VERIFY AGENT 1:
   git checkout origin/feature/sr/agent-1-pathfinding
   npm test -- tests/routing/Agent1-Pathfinding.test.ts
   Document results in ACCEPTANCE_TESTS.md

2. VERIFY AGENT 2:
   git checkout origin/feature/sr/agent-2-validation
   npm test
   Check TC-V1, TC-V2

3. VERIFY AGENT 3:
   git checkout origin/feature/sr/agent-3-specs
   npm test -- tests/routing/Specifications.test.ts
   Check TC-SP1, TC-SP2

4. VERIFY AGENT 6:
   git checkout origin/feature/sr/agent-6-wire-conduit-geo
   npm test -- tests/routing/CableGenerator.test.ts
   npm test -- tests/routing/ConduitGenerator.test.ts
   Check TC-W1, TC-C1

For each verified test, add to ACCEPTANCE_TESTS.md:
  Independently Verified By: Agent 10
  Verification Date: 2025-01-03 12:30 PM
  Verification Result: ✅ CONFIRMED / ❌ FAILING

✅ YOUR ACCEPTANCE TEST:
- TC-QA1: Independent verification of 5+ agents

📖 FULL INSTRUCTIONS:
docs/SMART_ROUTING/AGENTS_7_8_9_10_RESUME_INSTRUCTIONS.md (Agent 10 section)

⏱️ YOU HAVE 45 MINUTES (tokens reset 1pm)
```

---

## 📊 MASTER STATUS (For PM - George)

**Current Time:** 12:00 PM
**Agents Resume:** 12:15 PM
**Token Reset:** 1:00 PM

**Agents with Work on GitHub:**
- ✅ Agent 1: `origin/feature/sr/agent-1-pathfinding` (10 commits, in progress)
- ✅ Agent 2: `origin/feature/sr/agent-2-validation` (4 commits, appears complete)
- ✅ Agent 3: `origin/feature/sr/agent-3-specs` (2 commits, ✅ COMPLETE)
- ✅ Agent 4: `origin/feature/sr/agent-4-pipe-geo` (1 commit, standup only)
- ✅ Agent 5: `origin/feature/sr/agent-5-tray-geo` (0 commits)
- ✅ Agent 6: `origin/feature/sr/agent-6-wire-conduit-geo` (2 commits, ✅ COMPLETE)

**Agents WITHOUT Work on GitHub:**
- ❌ Agent 7: No branch found
- ❌ Agent 8: No branch found (CRITICAL PATH!)
- ❌ Agent 9: No branch found
- ❌ Agent 10: No branch found

**Critical Path:**
- 🚨 **Agent 8 MUST verify UI fixes and push branch** → Unblocks all agents

**Key Documents Created:**
1. `AGENTS_7_8_9_10_RESUME_INSTRUCTIONS.md` - Full detailed instructions
2. `AGENT_STATUS_DASHBOARD.md` - Live tracking dashboard
3. `QUICK_RESUME_CARDS.md` - Copy/paste cards for each agent (this file)

**Next Actions:**
1. Wait for 12:15 PM
2. Send each agent their resume card
3. Monitor TODO_BOARD.md for status updates
4. Check for branch pushes every 10 minutes
5. Verify Agent 8 pushes first (critical path)

**Commands to Monitor Progress:**
```bash
# Check for new branches every 10 min
git fetch origin && git branch -r | grep "agent-[7-9]\|agent-10"

# Check TODO_BOARD for updates
git pull origin feature/smart-routing-system
cat docs/SMART_ROUTING/TODO_BOARD.md | grep "Agent [7-10]"

# Check ACCEPTANCE_TESTS for new evidence
cat docs/SMART_ROUTING/ACCEPTANCE_TESTS.md | grep "Tested By"
```

---

## 🎯 Expected Timeline (12:15 - 1:00 PM)

**12:15 PM:** Agents 7-10 resume, receive cards
**12:20 PM:** Agents run status checks, verify branches
**12:25 PM:** Agent 8 posts UI verification status (CRITICAL)
**12:30 PM:** Agents 7, 9 push first commits
**12:35 PM:** Agent 10 posts first verification results
**12:45 PM:** Mid-point check - all agents should have branches pushed
**12:55 PM:** Final commits and PR creation prep
**1:00 PM:** Tokens reset, agents can continue

---

## 📝 Template for Agent Briefing Message

Use this template when messaging each agent at 12:15:

```
Hi Agent [N],

You ran out of tokens earlier. Here's your quick resume brief:

[PASTE RELEVANT CARD FROM ABOVE]

Key resources:
- Full instructions: docs/SMART_ROUTING/AGENTS_7_8_9_10_RESUME_INSTRUCTIONS.md
- Status dashboard: docs/SMART_ROUTING/AGENT_STATUS_DASHBOARD.md
- Acceptance tests: docs/SMART_ROUTING/ACCEPTANCE_TESTS.md
- TODO board: docs/SMART_ROUTING/TODO_BOARD.md

You have ~45 minutes until tokens reset at 1pm. Focus on:
1. Branch status check
2. Core implementation
3. Push to GitHub
4. Update documentation

Questions? Post in TODO_BOARD.md blockers section.

Good luck!
```
