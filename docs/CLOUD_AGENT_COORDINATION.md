# Cloud Agent Coordination Guide

## Repository Setup

**Before starting ANY work, ALL agents must:**

1. **Clone the correct repository:**
   ```bash
   git clone https://github.com/GeorgeMcIntyre-Web/kinetiCORE.git
   cd kinetiCORE
   ```

2. **Verify you're on the right repo:**
   ```bash
   git remote -v
   # Should show: origin  https://github.com/GeorgeMcIntyre-Web/kinetiCORE.git
   ```

3. **Pull latest main:**
   ```bash
   git checkout main
   git pull origin main
   ```

4. **Create your feature branch:**
   ```bash
   # Agent 1
   git checkout -b feature/playwright-test-updates

   # Agent 2
   git checkout -b feature/panel-state-persistence

   # Agent 3
   git checkout -b feature/connector-compatibility

   # ... etc (see branch names in prompts)
   ```

## DevTools Testing (REQUIRED)

**ALL agents MUST use browser DevTools for debugging:**

1. **Open DevTools:** Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)

2. **Console Tab - Check for:**
   - `[QuickRoutePresets]` logs when clicking preset buttons
   - `[RouteValidator]` logs for validation
   - `[CollisionDetector]` logs for collision detection
   - Error messages (red text)
   - Warning messages (yellow text)

3. **Network Tab - Check for:**
   - Failed API requests (red entries)
   - Slow requests (>1s load time)
   - 404 errors for missing resources

4. **Performance Tab - Check for:**
   - Frame rate (should be 60 FPS)
   - Long tasks (>50ms)
   - Memory leaks (increasing memory over time)

5. **Elements Tab - Check for:**
   - Panel visibility (z-index issues)
   - Layout problems (overlapping elements)
   - CSS class application

## Working Together - Merge Coordination

### Phase 1: Parallel Development (Agents 1-10)
**Days 1-3:** All agents work in parallel on their feature branches

```bash
# Each agent works independently:
git checkout feature/your-feature-name
# ... make changes ...
git add .
git commit -m "feat: your changes"
git push origin feature/your-feature-name
```

### Phase 2: Integration Testing (Agent 11)
**Day 4:** Agent 11 merges and tests

**Merge Order (Agent 11 follows this sequence):**

```bash
# 1. Start with fresh main
git checkout main
git pull origin main

# 2. Merge foundation features first
git merge origin/feature/panel-state-persistence
npm run type-check && npm run lint && npm run build
git merge origin/feature/material-library-enhancement
npm run type-check && npm run lint && npm run build

# 3. Merge validation features
git merge origin/feature/connector-compatibility
npm run type-check && npm run lint && npm run build
git merge origin/feature/collision-detection
npm run type-check && npm run lint && npm run build
git merge origin/feature/advanced-warnings
npm run type-check && npm run lint && npm run build

# 4. Merge UI enhancements
git merge origin/feature/route-editing-enhancements
npm run type-check && npm run lint && npm run build
git merge origin/feature/waypoint-system
npm run type-check && npm run lint && npm run build
git merge origin/feature/template-expansion
npm run type-check && npm run lint && npm run build

# 5. Merge testing and validation
git merge origin/feature/pre-flight-validation
npm run type-check && npm run lint && npm run build
git merge origin/feature/playwright-test-updates
npm run type-check && npm run lint && npm run build

# 6. Final integration test
npm run lint && npm run type-check && npm test && npm run build
```

### Handling Merge Conflicts

**If you encounter conflicts:**

```bash
# 1. See which files have conflicts
git status

# 2. Open each conflicting file
# Look for conflict markers:
<<<<<<< HEAD
your changes
=======
their changes
>>>>>>> feature/other-branch

# 3. Resolve by keeping the correct code
# Remove conflict markers and unwanted code

# 4. Test after resolving
npm run type-check
npm run lint
npm run build

# 5. Complete the merge
git add .
git commit -m "merge: resolve conflicts with feature/other-branch"
```

**Common Conflict Areas:**
- `src/routing/stores/routingStore.ts` - Multiple agents may add new state
- `src/routing/types/Route.ts` - Multiple agents may add new properties
- `package.json` - Multiple agents may add dependencies

**Resolution Strategy:**
- Keep ALL new state additions from both sides
- Keep ALL new properties from both sides
- Keep ALL new dependencies from both sides
- Test thoroughly after merging

## Communication Protocol

### Before Starting Work:
1. Announce in team chat: "Agent X starting work on feature Y"
2. Pull latest main: `git pull origin main`
3. Create feature branch: `git checkout -b feature/your-name`

### During Work:
1. Commit frequently (every 30-60 minutes)
2. Push to your branch: `git push origin feature/your-name`
3. If blocked, announce in team chat immediately

### After Completing Work:
1. Run full CI checks locally:
   ```bash
   npm run lint && npm run type-check && npm test && npm run build
   ```
2. Push final changes
3. Announce in team chat: "Agent X completed feature Y - ready for integration"
4. Wait for Agent 11 to merge

## Success Checklist

**Each agent must verify:**
- [ ] Cloned correct repo (GeorgeMcIntyre-Web/kinetiCORE)
- [ ] Working on correct feature branch
- [ ] All changes committed and pushed
- [ ] DevTools console shows no errors
- [ ] DevTools network tab shows no failed requests
- [ ] Frame rate is 60 FPS (DevTools Performance tab)
- [ ] All TypeScript errors fixed (`npm run type-check`)
- [ ] All lint errors fixed (`npm run lint`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Announced completion in team chat

## Quick Reference

**Start work:**
```bash
git checkout main && git pull origin main
git checkout -b feature/your-name
npm install
npm run dev
# Open http://localhost:5173
# Press F12 to open DevTools
```

**During work:**
```bash
# Save progress every hour
git add .
git commit -m "feat: progress on feature"
git push origin feature/your-name

# Check for errors
npm run type-check
npm run lint
```

**Finish work:**
```bash
# Final checks
npm run lint && npm run type-check && npm test && npm run build

# Push
git add .
git commit -m "feat: complete feature implementation"
git push origin feature/your-name

# Announce completion
echo "Agent X completed - ready for integration"
```

## Troubleshooting

**Problem: "Already on main"**
```bash
git checkout -b feature/your-name
```

**Problem: "Branch already exists"**
```bash
git checkout feature/your-name
git pull origin feature/your-name
```

**Problem: "Cannot push - behind remote"**
```bash
git pull origin feature/your-name
# Resolve conflicts if any
git push origin feature/your-name
```

**Problem: "DevTools shows errors"**
1. Read the error message in Console tab
2. Click the file:line link to see the code
3. Fix the error
4. Refresh browser (Ctrl+R)
5. Verify error is gone

**Problem: "Build fails"**
```bash
npm run type-check  # See TypeScript errors
npm run lint        # See ESLint errors
# Fix all errors shown
npm run build       # Verify fixed
```
