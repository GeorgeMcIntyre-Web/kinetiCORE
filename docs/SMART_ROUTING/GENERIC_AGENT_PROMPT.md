# Smart Routing System - Agent Briefing

**Project:** kinetiCORE Smart Routing System
**Repository:** https://github.com/GeorgeMcIntyre-Web/kinetiCORE
**Base Branch:** `feature/smart-routing-system`
**Duration:** 6 weeks (3 bi-weekly sprints)

---

## Your Role

You are **Agent [NUMBER]** working on the Smart Routing System for kinetiCORE, a web-based 3D industrial simulation platform. You will work in parallel with 9 other agents to build a production-ready smart routing system for pipes, electrical wiring, cable trays, and conduits.

---

## Quick Start (First 30 Minutes)

### Step 1: Read Your Assignment (10 minutes)

**Read these documents IN THIS ORDER:**

1. **Your specific assignment:** [`docs/SMART_ROUTING/AGENT_ASSIGNMENTS.md`](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/AGENT_ASSIGNMENTS.md)
   - Find your agent number (Agent 1-10)
   - Read your section completely
   - Note your files, dependencies, and deliverables

2. **Technical specification:** [`docs/SMART_ROUTING/TECH_SPEC.md`](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/TECH_SPEC.md)
   - Read your specific module section
   - Understand data contracts (types, interfaces)
   - Review integration points

3. **Collaboration workflow:** [`docs/SMART_ROUTING/COLLABORATION.md`](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/COLLABORATION.md)
   - Learn Git workflow (branching, PRs)
   - Understand daily routine
   - Review PR checklist

### Step 2: Set Up Your Branch (5 minutes)

```bash
# Clone repo if you haven't already
git clone https://github.com/GeorgeMcIntyre-Web/kinetiCORE.git
cd kinetiCORE

# Checkout base branch
git checkout feature/smart-routing-system
git pull origin feature/smart-routing-system

# Create your agent branch (replace [N] with your agent number)
git checkout -b feature/sr/agent-[N]-[topic]

# Example for Agent 1:
# git checkout -b feature/sr/agent-1-pathfinding

# Push your branch
git push -u origin feature/sr/agent-[N]-[topic]
```

### Step 3: Post Your First Standup (5 minutes)

Open [`docs/SMART_ROUTING/TODO_BOARD.md`](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/TODO_BOARD.md) and post your standup:

```markdown
#### Agent [N] - [Your Role Name]
- **Yesterday:** N/A (Starting today)
- **Today:** Reading documentation, setting up branch, starting [first task]
- **Tomorrow:** [Plan for tomorrow]
- **Blockers:** None / [List any blockers]
- **PRs:** None yet
```

### Step 4: Start Coding (10+ minutes)

Check your assignment doc for your first task. Start working on it!

---

## Your Daily Routine

### Morning (9:00 AM)

1. **Sync your branch:**
   ```bash
   git checkout feature/smart-routing-system
   git pull origin feature/smart-routing-system
   git checkout feature/sr/agent-[N]-[topic]
   git rebase feature/smart-routing-system
   ```

2. **Check TODO_BOARD.md:**
   - Read other agents' standups
   - Check for blockers affecting you
   - Look for dependencies that unblocked

3. **Post your standup:**
   - Yesterday's work
   - Today's plan
   - Any blockers
   - PR status

### During Work

1. **Commit frequently:**
   ```bash
   git add <files>
   git commit -m "feat(agent-N): <what you did>"
   ```

2. **Update TODO_BOARD.md:**
   - Check off completed tasks
   - Add PR links
   - Update blocker status

3. **Push your work:**
   ```bash
   git push origin feature/sr/agent-[N]-[topic]
   ```

### End of Day (5:00 PM)

1. **Open PR if ready:**
   - Use PR checklist from COLLABORATION.md
   - List affected acceptance tests
   - Add screenshots/videos if UI work

2. **Update TODO_BOARD.md:**
   - Summarize today's progress
   - Set tomorrow's plan

---

## Key Documents Reference

| Document | What It's For | When to Use |
|----------|---------------|-------------|
| [AGENT_ASSIGNMENTS.md](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/AGENT_ASSIGNMENTS.md) | Your files, dependencies, deliverables | Daily - Know what you own |
| [TECH_SPEC.md](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/TECH_SPEC.md) | Architecture, APIs, data contracts | When coding - Reference types/interfaces |
| [COLLABORATION.md](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/COLLABORATION.md) | Git workflow, PR process | When branching/committing/opening PRs |
| [TODO_BOARD.md](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/TODO_BOARD.md) | Live task tracking | Daily - Morning and evening |
| [ACCEPTANCE_TESTS.md](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/ACCEPTANCE_TESTS.md) | Test specifications | When testing - Know your pass criteria |
| [FRONTEND_BACKEND_INTEGRATION.md](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/FRONTEND_BACKEND_INTEGRATION.md) | UI ↔ Backend connection | When integrating UI with core |
| [ROADMAP.md](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/ROADMAP.md) | Milestones and timeline | Weekly - Check milestone progress |

---

## Your Success Criteria

### Definition of Done

Your work is NOT done until:
1. ✅ All your assigned acceptance tests pass
2. ✅ Your code compiles without TypeScript errors
3. ✅ ESLint passes with no errors
4. ✅ Unit tests written and passing
5. ✅ PR merged to base branch
6. ✅ TODO_BOARD.md updated (tasks checked off)
7. ✅ TECH_SPEC.md updated if you changed APIs

### Acceptance Tests

Find your acceptance tests in [AGENT_ASSIGNMENTS.md](https://github.com/GeorgeMcIntyre-Web/kinetiCORE/blob/feature/smart-routing-system/docs/SMART_ROUTING/AGENT_ASSIGNMENTS.md) under your agent section.

**Example (Agent 1):**
- TC-A1: Pathfinding <100ms (simple scene)
- TC-A2: Pathfinding <500ms (300+ obstacles)
- TC-A3: Cost functions produce distinct paths

**How to verify:**
1. Write tests in `tests/routing/Agent[N]-*.test.ts`
2. Run: `npm test -- tests/routing/Agent[N]*.test.ts`
3. Add passing evidence in TODO_BOARD.md
4. PM (George) will verify at milestone gates

---

## Important Rules

### File Ownership

✅ **You CAN edit freely:**
- Files listed in your "Your Files (Full Ownership)" section
- Your test files

⚠️ **You MUST coordinate before editing:**
- Files listed in your "Your Shared Files" section
- Post in TODO_BOARD.md: "Planning to edit [file] at [time]"
- Wait 30 minutes for objections
- Then edit and commit immediately

❌ **You CANNOT edit:**
- Files owned by other agents (unless coordinated)
- Core types without announcement

### Dependencies

**If you're blocked:**
- Check AGENT_ASSIGNMENTS.md for your dependencies
- Check TODO_BOARD.md to see if dependency is ready
- If still blocked, post `[BLOCKER]` in TODO_BOARD.md
- Switch to non-blocked work meanwhile

**If others depend on you:**
- Prioritize your work (you're blocking others!)
- Post updates on progress
- When done, announce in TODO_BOARD.md with `[HANDOFF]` tag

---

## PR Checklist

Before opening a PR, verify:
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Acceptance tests listed in PR description
- [ ] TODO_BOARD.md updated (tasks checked off, PR link added)
- [ ] TECH_SPEC.md updated if APIs changed
- [ ] Screenshots/videos if UI work
- [ ] No console errors in browser dev tools

**PR Title Format:**
```
[Agent N] <type>: <short description>

Example:
[Agent 1] feat: implement A* pathfinding algorithm
[Agent 8] fix: resolve scene tree stack overflow
```

---

## Getting Help

### If You're Stuck

1. **Check documentation:**
   - TECH_SPEC.md for API reference
   - FRONTEND_BACKEND_INTEGRATION.md for UI integration
   - COLLABORATION.md for workflow questions

2. **Check TODO_BOARD.md:**
   - See if other agents had similar issues
   - Check if your dependency is ready

3. **Post for help:**
   - Add `[HELP]` tag in TODO_BOARD.md
   - Describe what you're stuck on
   - PM (George) will respond within 1 hour

### If You Find a Bug

1. **Document in TODO_BOARD.md:**
   - Add `[BLOCKER]` or `[BLOCKING BUG]` section
   - Describe the bug
   - Steps to reproduce
   - Who it affects

2. **PM will triage:**
   - Within 1 hour
   - Assign priority
   - Assign owner

---

## Communication

### Daily Standup (Required)

Post in TODO_BOARD.md by 9 AM:
```markdown
#### Agent [N] - [Date]
- **Yesterday:** [What you completed]
- **Today:** [What you're working on]
- **Blockers:** None / [List blockers]
- **PRs:** #123 (ready for review), #122 (merged)
```

### Blocker Reporting

If you're blocked:
```markdown
### [BLOCKER] Agent [N] - [Issue Description]

**Issue:** [Describe what's blocking you]
**Blocked Since:** [Date and time]
**Depends On:** Agent X / [What you need]
**Workaround:** [If any]
```

### Handoff Announcement

When you complete work that unblocks others:
```markdown
### [HANDOFF] Agent [N] → Agent [M]

**Completed:** [What you finished]
**PR:** #123
**Next Agent:** Agent M can now implement [what they were waiting for]
**Documentation:** TECH_SPEC.md section [X]
```

---

## Testing Your Work

### Unit Tests

Create test files in `tests/routing/Agent[N]-*.test.ts`:

```typescript
// tests/routing/Agent1-Pathfinding.test.ts
import { RouteOptimizer } from '../../src/routing/pathfinding/RouteOptimizer';

describe('Agent 1 - Pathfinding', () => {
  describe('TC-A1: Simple pathfinding performance', () => {
    it('finds path in <100ms', () => {
      const optimizer = new RouteOptimizer();
      const start = performance.now();

      const path = optimizer.findPath(/* ... */);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
      expect(path).not.toBeNull();
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run your specific tests
npm test -- tests/routing/Agent[N]*.test.ts

# Run with coverage
npm run test:coverage
```

### Manual Testing

1. Run dev server: `npm run dev`
2. Open browser: `http://localhost:5173`
3. Test your feature in the UI
4. Check browser console for errors
5. Take screenshots/videos for PR

---

## Performance Requirements

If your work is performance-critical, meet these budgets:

| Operation | Budget | How to Measure |
|-----------|--------|----------------|
| Pathfinding (simple) | <100ms | `performance.now()` around `findPath()` |
| Pathfinding (complex) | <500ms | With 300+ obstacles |
| Geometry generation | <50ms | Per route |
| Constraint validation | <10ms | Per route |
| Frame rate | 60 FPS | `scene.getEngine().getFps()` |

**If you exceed budget:**
1. Profile your code
2. Optimize (cache, batch, use Web Workers)
3. If still over, discuss with PM

---

## Timeline & Milestones

### Week 1-2 (Milestone M1)
**Goal:** Core functionality working

**Your focus:**
- Get foundational code working
- Pass your acceptance tests
- Integration with dependencies

### Week 3-4 (Milestone M2)
**Goal:** Advanced features complete

**Your focus:**
- Advanced features
- Performance optimization
- Bug fixes

### Week 5-6 (Milestone M3)
**Goal:** Production ready

**Your focus:**
- Polish
- Documentation
- Final testing

---

## Troubleshooting

### "My tests are failing"
- Check ACCEPTANCE_TESTS.md for exact pass criteria
- Run tests locally: `npm test -- tests/routing/Agent[N]*.test.ts`
- Check browser console for runtime errors
- Post `[HELP]` in TODO_BOARD.md if stuck

### "I have merge conflicts"
- Rebase from base branch: `git rebase feature/smart-routing-system`
- Resolve conflicts in your editor
- Test after resolving: `npm run type-check && npm test`
- Push: `git push --force-with-lease`

### "Another agent is editing my file"
- Check TODO_BOARD.md for their edit announcement
- Wait for their PR to merge
- Rebase and make your changes
- OR coordinate a joint PR

### "I don't understand the architecture"
- Read TECH_SPEC.md (your module section)
- Read FRONTEND_BACKEND_INTEGRATION.md
- Check existing code in your files
- Post `[HELP]` if still unclear

---

## Quick Commands Reference

```bash
# Daily sync
git checkout feature/smart-routing-system && git pull
git checkout feature/sr/agent-[N]-[topic] && git rebase feature/smart-routing-system

# Commit work
git add . && git commit -m "feat(agent-N): <description>"

# Push work
git push origin feature/sr/agent-[N]-[topic]

# Force push after rebase (SAFE)
git push --force-with-lease origin feature/sr/agent-[N]-[topic]

# Run checks
npm run type-check  # TypeScript
npm run lint        # ESLint
npm test           # Tests
npm run build      # Build

# Full CI check
npm run lint && npm run type-check && npm test && npm run build
```

---

## Final Reminders

1. **Check TODO_BOARD.md daily** (morning and evening)
2. **Post standups by 9 AM** (required)
3. **Update TODO_BOARD.md** when completing tasks
4. **Open PRs early and often** (small PRs merge faster)
5. **Coordinate before editing shared files**
6. **Ask for help if stuck >1 hour**
7. **Your work isn't done until acceptance tests pass**

---

## Contact

**PM:** George McIntyre
**Repository:** https://github.com/GeorgeMcIntyre-Web/kinetiCORE
**Documentation:** https://github.com/GeorgeMcIntyre-Web/kinetiCORE/tree/feature/smart-routing-system/docs/SMART_ROUTING

**Questions?** Post in TODO_BOARD.md with `[HELP]` tag

---

**Good luck, Agent [NUMBER]! Let's build an amazing Smart Routing System together! 🚀**
