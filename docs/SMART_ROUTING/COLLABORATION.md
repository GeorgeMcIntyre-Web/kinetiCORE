# Smart Routing - Collaboration Guide

Version: 1.0
Base Branch: `feature/smart-routing-system`
Last Updated: 2025-01-03

## Purpose

This document defines the collaboration rules, branching strategy, PR process, and daily workflow for 10 agents working in parallel on the Smart Routing System.

---

## Branching Strategy

### Base Branch
- **`feature/smart-routing-system`** - Main integration branch for all smart routing work
- Protected: Requires PR approval
- Updated daily from `main` to prevent drift

### Agent Working Branches
Each agent creates feature branches following this naming convention:

```
feature/sr/agent-<N>-<short-description>
```

Examples:
- `feature/sr/agent-1-pathfinding-astar`
- `feature/sr/agent-4-pipe-geometry`
- `feature/sr/agent-8-ui-scene-tree-fix`

### Branch Lifecycle

```
main
 └── feature/smart-routing-system (base)
      ├── feature/sr/agent-1-pathfinding-astar
      ├── feature/sr/agent-2-constraint-validator
      ├── feature/sr/agent-3-specs-data-contracts
      ├── feature/sr/agent-4-pipe-geometry
      ├── feature/sr/agent-5-cable-tray-geometry
      ├── feature/sr/agent-6-wiring-conduit-geometry
      ├── feature/sr/agent-7-connection-manager
      ├── feature/sr/agent-8-ui-workflow-fixes
      ├── feature/sr/agent-9-persistence-exports
      └── feature/sr/agent-10-qa-perf-docs
```

---

## Daily Workflow

### Morning Sync (9:00 AM)
1. **Update from base branch:**
   ```bash
   git checkout feature/smart-routing-system
   git pull origin feature/smart-routing-system
   git checkout feature/sr/agent-<N>-<topic>
   git rebase feature/smart-routing-system
   ```

2. **Check TODO_BOARD.md** for blockers and dependencies
3. **Post standup notes** at top of TODO_BOARD.md:
   ```markdown
   ## Daily Standup - YYYY-MM-DD

   ### Agent N - [Your Name]
   - **Yesterday:** Completed X, Y, Z
   - **Today:** Working on A, B
   - **Blockers:** None / Waiting on Agent M for [dependency]
   - **PR Status:** #123 ready for review, #122 merged
   ```

### During Work
1. **Commit frequently** with descriptive messages:
   ```bash
   git add <files>
   git commit -m "feat(agent-N): <what you did>"
   ```

2. **Commit Message Format:**
   ```
   <type>(agent-N): <description>

   Types:
   - feat: New feature
   - fix: Bug fix
   - refactor: Code restructuring
   - test: Adding tests
   - docs: Documentation updates
   - perf: Performance improvements
   ```

   Examples:
   ```
   feat(agent-1): implement A* pathfinding with cost functions
   fix(agent-8): resolve scene tree recursion stack overflow
   refactor(agent-4): extract pipe sizing to specification table
   test(agent-2): add constraint validator unit tests
   docs(agent-3): update TECH_SPEC with route data contract
   perf(agent-10): optimize graph node generation for 300+ obstacles
   ```

3. **Update TODO_BOARD.md** after each significant milestone:
   - Check off completed tasks
   - Add PR link in notes
   - Add any new blockers or dependencies discovered

### End of Day
1. **Push your work:**
   ```bash
   git push origin feature/sr/agent-<N>-<topic>
   ```

2. **Open PR if ready** (see PR Process below)

3. **Update TODO_BOARD.md** with tomorrow's plan

---

## Pull Request Process

### When to Create a PR

Create a PR when:
- ✅ You have a working, testable increment
- ✅ Your code compiles without TypeScript errors
- ✅ Your code passes ESLint checks
- ✅ You have completed at least one acceptance test
- ✅ You have updated relevant documentation

**DO NOT** wait until your entire agent's work is done. Small, frequent PRs are better!

### PR Checklist

Every PR must include:

```markdown
## PR Checklist

### Code Quality
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] No console errors in browser dev tools
- [ ] Code follows project coding standards (CLAUDE.md)

### Testing
- [ ] Affected acceptance tests pass (list test IDs: TC-XXX)
- [ ] Unit tests added/updated for new functionality
- [ ] Manual testing completed in demo scenes

### Documentation
- [ ] TECH_SPEC.md updated if contracts/APIs changed
- [ ] TODO_BOARD.md updated (tasks checked off, PR link added)
- [ ] Code comments added for complex logic
- [ ] Type definitions exported if needed by other agents

### Integration
- [ ] No breaking changes to other agents' interfaces
- [ ] Dependencies documented in PR description
- [ ] Related agents notified in PR comments

### Acceptance Tests Affected
List the acceptance test IDs this PR addresses:
- TC-XXX: [Description]
- TC-YYY: [Description]

### Screenshots/Videos (if UI changes)
[Add screenshots or video showing the feature working]

### Dependencies
This PR depends on:
- [ ] None / This is independent
- [ ] Agent X: PR #123 (must be merged first)

This PR enables:
- [ ] Agent Y: Can now implement [feature]
```

### PR Title Format

```
[Agent N] <type>: <short description>
```

Examples:
```
[Agent 1] feat: implement A* pathfinding algorithm
[Agent 8] fix: resolve scene tree stack overflow error
[Agent 4] refactor: extract pipe sizing to specification table
```

### PR Review Process

1. **Self-Review:** Review your own PR first
   - Check for commented-out code
   - Check for TODO/FIXME comments that should be addressed
   - Check for debug console.log statements

2. **Assign Reviewers:**
   - PM (George) as primary reviewer
   - Any dependent agents as secondary reviewers

3. **Response Time:**
   - **Goal:** PRs reviewed within 4 hours
   - **Critical/Blocking PRs:** Reviewed within 1 hour (mark with `[URGENT]` in title)

4. **Addressing Feedback:**
   - Respond to each comment (even if just "fixed")
   - Push additional commits to address feedback
   - Re-request review when ready

5. **Merge:**
   - **Squash and merge** (preferred for clean history)
   - Delete branch after merge

---

## File Ownership & Editing Rules

### Single-Owner Files (Edit Freely)
Each agent owns specific files and can edit them without coordination:

**Agent 1:**
- `src/routing/pathfinding/SearchGraph.ts`
- `src/routing/pathfinding/RouteOptimizer.ts`
- `src/routing/pathfinding/CostFunctions.ts`

**Agent 2:**
- `src/routing/validation/ConstraintValidator.ts`
- `src/routing/validation/ValidationResult.ts`

**Agent 3:**
- `src/routing/specifications/PipeSpecifications.ts`
- `src/routing/specifications/CableTraySpecifications.ts`
- `src/routing/specifications/ConduitSpecifications.ts`
- `src/routing/specifications/WiringSpecifications.ts`

**Agent 4:**
- `src/routing/geometry/PipeGenerator.ts`

**Agent 5:**
- `src/routing/geometry/CableTrayGenerator.ts`

**Agent 6:**
- `src/routing/geometry/CableGenerator.ts`
- `src/routing/geometry/ConduitGenerator.ts`

**Agent 7:**
- `src/routing/core/ConnectionManager.ts`
- `src/routing/core/ConnectionPoint.ts`

**Agent 8:**
- `src/routing/ui/RoutingControlPanel.tsx`
- `src/routing/ui/RoutingWorkflowHandler.ts`
- `src/ui/components/SceneTree.tsx`
- `src/ui/layouts/ProfessionalModeLayout.tsx`

**Agent 9:**
- `src/scene/WorldSerializer.ts`
- `src/exports/BOMExporter.ts`
- `src/exports/GLBExporter.ts`

**Agent 10:**
- `tests/routing/*.test.ts`
- `docs/SMART_ROUTING/ACCEPTANCE_TESTS.md`
- `docs/SMART_ROUTING/PERF_HARNESS.md`

### Shared Files (Announce Before Editing)

These files require coordination. Post in TODO_BOARD.md before editing:

**Core Types:**
- `src/routing/core/types.ts` - Shared type definitions
- `src/routing/geometry/GeometryGeneratorFactory.ts` - Factory for all geometry generators

**Store Files:**
- `src/ui/store/routingStore.ts` - Routing state management

**Command Files:**
- `src/routing/commands/*.ts` - Command pattern implementations

**Documentation:**
- `docs/SMART_ROUTING/TECH_SPEC.md` - Technical specification (Agent 3 maintains, others contribute)
- `docs/SMART_ROUTING/TODO_BOARD.md` - All agents update

### Coordination Protocol for Shared Files

1. **Post intent in TODO_BOARD.md:**
   ```markdown
   ### Agent N - Planning to Edit Shared File
   **File:** `src/routing/core/types.ts`
   **Reason:** Need to add `ValidationSeverity` enum
   **ETA:** Today 2:00 PM
   **Blocks:** Agent 2 (needs this type)
   ```

2. **Wait 30 minutes** for objections/conflicts

3. **Make your edit** and immediately commit + push

4. **Notify affected agents** in TODO_BOARD.md:
   ```markdown
   ### Agent N - Shared File Updated
   **File:** `src/routing/core/types.ts`
   **Change:** Added `ValidationSeverity` enum
   **PR:** #123
   **Affected Agents:** Agent 2 (can now use this type)
   ```

---

## Conflict Resolution

### Merge Conflicts

If you encounter merge conflicts:

1. **Rebase from base branch:**
   ```bash
   git checkout feature/smart-routing-system
   git pull origin feature/smart-routing-system
   git checkout feature/sr/agent-<N>-<topic>
   git rebase feature/smart-routing-system
   ```

2. **Resolve conflicts** in your code editor

3. **Test thoroughly** after resolving

4. **Push force (with lease):**
   ```bash
   git push --force-with-lease origin feature/sr/agent-<N>-<topic>
   ```

### Design Conflicts

If you discover a design conflict with another agent:

1. **Stop work** on the conflicting area
2. **Post in TODO_BOARD.md** with `[BLOCKER]` tag
3. **@mention the PM** (George) to mediate
4. **Switch to non-conflicting work** while waiting

Example:
```markdown
### [BLOCKER] Agent 4 - Design Conflict

**Issue:** PipeGenerator needs `ValidationResult` but Agent 2's API doesn't match expected interface.

**Agents Involved:** Agent 2, Agent 4
**PM:** @George - Please mediate

**Proposed Solutions:**
1. Agent 2 updates API to match Agent 4's needs
2. Agent 4 adapts to Agent 2's existing API
3. Create adapter layer

**Workaround:** Temporarily using mock validation results
```

---

## Communication Guidelines

### Where to Communicate

**TODO_BOARD.md (Primary)**
- Daily standup notes
- Blockers and dependencies
- File edit announcements
- Quick updates

**PR Comments (Secondary)**
- Code-specific discussions
- Review feedback
- Technical clarifications

**Slack (Optional)**
- Urgent blockers only
- PM escalations

### Communication Style

✅ **DO:**
- Be specific: "Need `ValidationResult` type from Agent 2 by EOD"
- Be concise: Use bullet points
- Be timely: Update TODO_BOARD.md at least twice daily
- Be helpful: Share solutions to common problems

❌ **DON'T:**
- Be vague: "Need some help with routing stuff"
- Be verbose: Long paragraphs in TODO_BOARD.md
- Be silent: Disappearing without updates
- Be negative: Focus on solutions, not blame

---

## Integration Points & Handoffs

### Critical Integration Points

**Agent 1 → Agent 2:**
- Pathfinding waypoints → Constraint validation input

**Agent 2 → Agent 8:**
- Validation results → UI warning display

**Agent 3 → Agents 2, 4, 5, 6:**
- Specifications → Constraint thresholds and geometry sizing

**Agent 7 → Agents 1, 8:**
- Connection points → Pathfinding start/end and UI selection

**Agents 4, 5, 6 → Agent 9:**
- Geometry + BOM data → Export outputs

**Agent 10 → All:**
- Acceptance tests → Definition of done

### Handoff Protocol

When you complete work that unblocks another agent:

1. **Merge your PR**
2. **Update TODO_BOARD.md:**
   ```markdown
   ### Agent N - Handoff to Agent M
   **Completed:** [Feature/API]
   **PR:** #123
   **Next Agent:** Agent M can now implement [dependent feature]
   **Documentation:** See TECH_SPEC.md section [X]
   **Example Usage:** See `tests/examples/agent-N-example.test.ts`
   ```
3. **@mention the next agent** in PR comments

---

## Weekly Integration

### End of Week Integration (Friday 4:00 PM)

1. **All agents merge pending PRs** (green PRs only)
2. **PM runs full acceptance suite**
3. **PM updates ROADMAP.md** with milestone progress
4. **Team review:** What worked, what didn't
5. **Plan for next week:** Adjust priorities if needed

---

## Emergency Procedures

### Broken Base Branch

If `feature/smart-routing-system` is broken:

1. **PM announces in TODO_BOARD.md:** `[BROKEN BUILD]`
2. **All agents stop merging PRs**
3. **Agent who broke it fixes immediately** or reverts
4. **PM announces:** `[BUILD FIXED]` when resolved
5. **All agents rebase and continue**

### Blocking Bug

If you discover a blocking bug:

1. **Document in TODO_BOARD.md:**
   ```markdown
   ### [BLOCKING BUG] Agent N

   **Issue:** [Description]
   **Reproduction:** [Steps]
   **Workaround:** [If any]
   **Owner:** [Who should fix]
   **Priority:** Critical / High / Medium
   ```

2. **Switch to non-blocked work**
3. **PM triages within 1 hour**

---

## Success Metrics

### Individual Agent Metrics

Track your own velocity:
- PRs opened per day (target: 1-2)
- Acceptance tests completed (per ACCEPTANCE_TESTS.md)
- Blockers resolved (target: <4 hours)

### Team Metrics

PM tracks:
- Integration success rate (target: 95%)
- Average PR review time (target: <4 hours)
- Milestone progress (per ROADMAP.md)
- Build health (target: green 95% of time)

---

## Tools & Commands Quick Reference

### Git Commands

```bash
# Daily sync
git checkout feature/smart-routing-system && git pull
git checkout feature/sr/agent-<N>-<topic> && git rebase feature/smart-routing-system

# Create new branch
git checkout -b feature/sr/agent-<N>-<new-topic>

# Commit work
git add . && git commit -m "feat(agent-N): <description>"

# Push work
git push origin feature/sr/agent-<N>-<topic>

# Force push after rebase (use --force-with-lease for safety)
git push --force-with-lease origin feature/sr/agent-<N>-<topic>
```

### Project Commands

```bash
# Run dev server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Run tests
npm test

# Run specific test file
npm test -- tests/routing/Agent1.test.ts

# Full CI check
npm run lint && npm run type-check && npm test && npm run build
```

---

## FAQ

**Q: Can I merge my own PR?**
A: No. All PRs require PM approval.

**Q: What if I need to edit a file owned by another agent?**
A: Post in TODO_BOARD.md and coordinate. Create adapter/wrapper if needed.

**Q: How do I know if my work is blocked?**
A: Check AGENT_EXECUTION_PLAN.md dependencies and TODO_BOARD.md for blockers.

**Q: What if I finish early?**
A: Check TODO_BOARD.md for tasks marked `[HELP WANTED]` or help with code reviews.

**Q: What if I'm stuck?**
A: Post in TODO_BOARD.md with `[HELP]` tag. PM will triage within 1 hour.

---

**Last Updated:** 2025-01-03
**Version:** 1.0
**Maintained By:** PM (George)
