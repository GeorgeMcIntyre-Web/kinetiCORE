# Cursor Agents Coordination - Smart Routing System

**Date:** 2025-11-01
**Active Agents:** 5 parallel Cursor agents
**Codex:** Manual screenshot capture (geometry + labels)

---

## 🎯 Agent Assignments

### **Agent 1: Fix Geometry Test Failures** ⭐
**Priority:** CRITICAL
**Time:** 1-2 hours
**Branch:** `feature/fix-playwright-geometry-tests` (create from `feature/smart-routing-system`)

**Task:**
Rewrite geometry test functions to use UI interactions instead of programmatic commands.

**Files to Modify:**
- `tests/visual/routing-screenshots.spec.ts` (lines 49-166)

**Key Changes:**
- Remove `page.evaluate()` block entirely
- Add UI interaction functions:
  - `clickRoutingToolbarButton(page, routeType)`
  - `placeConnectionPoint(page, x, y, z)`
  - `clickGenerateRoute(page)`
  - `waitForRouteMesh(page, routeType)`
  - `pressKeyD(page)` for debug labels
- Wait for visual elements instead of command execution
- Add retry logic for timing issues

**Success Criteria:**
- All 10 tests passing (5 UI + 5 geometry)
- No timeouts
- Screenshots captured automatically

**Merge Order:** #1 (merge first - highest priority)

---

### **Agent 2: Add Route Editing UI** ⭐
**Priority:** HIGH
**Time:** 2-3 hours
**Branch:** `feature/route-editing-ui` (create from `feature/smart-routing-system`)

**Task:**
Create route editing panel and selection workflow.

**Files to Create:**
- `src/routing/ui/RouteEditPanel.tsx` (~300 lines)
- `src/routing/ui/RouteEditPanel.css` (~150 lines)
- `src/routing/ui/RouteSelectionManager.ts` (~200 lines)

**Files to Modify:**
- `src/ui/layouts/ProfessionalModeLayout.tsx` (add RouteEditPanel)
- `src/ui/store/routingStore.ts` (add selectedRouteId state)
- `src/routing/commands/EditRouteCommand.ts` (enhance if needed)

**Key Features:**
- Click route mesh → select (cyan glow)
- Edit panel shows route properties
- Change route type dropdown
- Update specifications (voltage, diameter, etc.)
- "Update Route" button → EditRouteCommand
- Full undo/redo support

**Avoid Conflicts With:**
- Agent 3 (validation) - coordinate on label updates
- Agent 4 (templates) - coordinate on toolbar space

**Merge Order:** #3 (after Agent 1, can merge before/after Agent 3)

---

### **Agent 3: Route Validation & Warnings** ⭐
**Priority:** MEDIUM-HIGH
**Time:** 1-2 hours
**Branch:** `feature/route-validation` (create from `feature/smart-routing-system`)

**Task:**
Add validation system with visual warnings.

**Files to Create:**
- `src/routing/validation/RouteValidator.ts` (~250 lines)
- `src/routing/validation/ValidationRules.ts` (~200 lines)
- `src/routing/ui/RouteWarningsPanel.tsx` (~200 lines)

**Files to Modify:**
- `src/routing/ui/RouteDebugLabels.ts` (add validation status to labels)
- `src/routing/commands/GenerateRouteGeometryCommand.ts` (validate before generation)
- `src/ui/layouts/ProfessionalModeLayout.tsx` (add warnings panel)

**Validation Rules:**
- Min length: 0.1m, Max length: 100m
- Bend radius: Type-specific minimums
- Collision detection with scene objects
- Connection point type compatibility
- Bounds checking

**Visual Warnings:**
- Red route segments for errors
- Yellow for warnings
- Label icons: ✓ (valid), ⚠ (warning), ✗ (error)
- Label border colors: green/yellow/red

**Avoid Conflicts With:**
- Agent 2 (editing) - coordinate on label color changes
- Coordinate on RouteDebugLabels.ts modifications

**Merge Order:** #4 (merge after Agent 2 for clean integration)

---

### **Agent 4: Route Library/Templates** ⭐
**Priority:** MEDIUM
**Time:** 2-3 hours
**Branch:** `feature/route-templates` (create from `feature/smart-routing-system`)

**Task:**
Create template library with drag-and-drop.

**Files to Create:**
- `src/routing/templates/RouteTemplates.ts` (~300 lines)
- `src/routing/templates/TemplateDefinitions.ts` (~400 lines)
- `src/routing/ui/RouteTemplatesPanel.tsx` (~350 lines)
- `src/routing/ui/RouteTemplatesPanel.css` (~200 lines)

**Files to Modify:**
- `src/ui/layouts/ProfessionalModeLayout.tsx` (add Templates button + panel)
- `src/routing/commands/CreateRouteFromTemplateCommand.ts` (new command)

**Built-in Templates:**
1. Straight Run (simple A→B)
2. 90° Elbow
3. T-Junction (3-way)
4. Cross (4-way)
5. Vertical Riser
6. Parallel Bundle (3 routes)

**Features:**
- Card-based UI (like ExportDialog)
- Drag template into viewport
- Parametric (adjust after placement)
- "Save as Template" button on routes
- Export/import templates (JSON)

**Avoid Conflicts With:**
- Agent 2 (editing) - coordinate on toolbar button placement
- Use different panel position (left side?)

**Merge Order:** #5 (merge last - can be independent feature)

---

### **Agent 5: Route Statistics Dashboard** ⭐
**Priority:** LOW-MEDIUM
**Time:** 1-2 hours
**Branch:** `feature/route-stats-dashboard` (create from `feature/smart-routing-system`)

**Task:**
Create statistics dashboard with charts.

**Files to Create:**
- `src/routing/ui/RouteStatsPanel.tsx` (~400 lines)
- `src/routing/ui/RouteStatsPanel.css` (~150 lines)
- `src/routing/utils/RouteStatistics.ts` (~200 lines)
- `src/routing/utils/CostEstimator.ts` (~150 lines)

**Files to Modify:**
- `src/ui/layouts/ProfessionalModeLayout.tsx` (add stats panel, bottom right)
- `src/ui/store/routingStore.ts` (add statistics selectors)

**Statistics to Show:**
- Total routes by type (4 counts with icons)
- Total length per type (meters)
- Cost estimates ($/m × length)
- Connection points count
- Validation summary (✓/⚠/✗ counts)

**Charts:**
- Bar chart: Length by type (simple CSS bars)
- Pie chart: Route distribution (SVG or Chart.js)
- List: Top 5 longest routes
- List: Routes with warnings

**Export Options:**
- CSV export (route list)
- PDF report (jsPDF library)

**Avoid Conflicts With:**
- All agents - use bottom-right panel position (unique)
- Minimal file overlap

**Merge Order:** #2 or #6 (can merge early or last - independent)

---

## 📋 Conflict Prevention

### File Access Matrix

| File | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 |
|------|---------|---------|---------|---------|---------|
| `ProfessionalModeLayout.tsx` | ❌ | ✅ Edit | ✅ Warnings | ✅ Templates | ✅ Stats |
| `routingStore.ts` | ❌ | ✅ Selection | ❌ | ✅ Templates | ✅ Stats |
| `RouteDebugLabels.ts` | ❌ | ❌ | ✅ Validation | ❌ | ❌ |
| `GenerateRouteGeometryCommand.ts` | ❌ | ✅ Maybe | ✅ Validation | ❌ | ❌ |
| `routing-screenshots.spec.ts` | ✅ Rewrite | ❌ | ❌ | ❌ | ❌ |

### Conflict Resolutions

**ProfessionalModeLayout.tsx - All 4 agents modify:**
- **Solution:** Use different panel positions:
  - Agent 2 (Edit): Right side panel
  - Agent 3 (Warnings): Top bar notification area
  - Agent 4 (Templates): Left side panel
  - Agent 5 (Stats): Bottom right panel
- **Merge Strategy:** Merge in order (2→3→4→5), resolve conflicts by combining panels

**routingStore.ts - 3 agents modify:**
- **Agent 2:** Add `selectedRouteId` state
- **Agent 4:** Add `templates` state
- **Agent 5:** Add `statistics` selectors
- **Solution:** Non-overlapping state additions, easy merge

**RouteDebugLabels.ts - Agent 3 only:**
- **No conflicts** - only Agent 3 modifies

**GenerateRouteGeometryCommand.ts - 2 agents:**
- **Agent 2:** Might enhance for editing
- **Agent 3:** Add validation before generation
- **Solution:** Agent 3 adds validation at start of execute(), Agent 2 works with existing command

---

## 🔄 Merge Order Recommendation

### Phase 1: Critical Functionality
1. **Agent 1** - Fix Playwright tests (MERGE FIRST)
   - Unblocks CI/CD
   - No conflicts with others

### Phase 2: Core Features
2. **Agent 5** - Stats Dashboard (can merge early, independent)
3. **Agent 2** - Route Editing (high value, some conflicts)
4. **Agent 3** - Validation (depends on Agent 2 for smooth integration)

### Phase 3: Enhancement Features
5. **Agent 4** - Templates (can merge last, mostly independent)

---

## 🚨 Conflict Warning Signs

Watch for these during development:

1. **ProfessionalModeLayout.tsx:**
   - Multiple agents adding panels
   - **Solution:** Use unique CSS classes, different positions

2. **RouteDebugLabels color changes:**
   - Agent 2: Selection glow (cyan)
   - Agent 3: Validation colors (green/yellow/red)
   - **Solution:** Agent 3 should check if route is selected, preserve cyan if selected

3. **Toolbar button placement:**
   - Agent 2: Edit button
   - Agent 4: Templates button
   - **Solution:** Coordinate button order in Routing toolbar

4. **Store state:**
   - Multiple agents adding state
   - **Solution:** Use separate slices, non-overlapping names

---

## ✅ Testing Strategy

### Each Agent Should:
1. Run locally: `npm run dev`
2. Test their feature thoroughly
3. Run checks: `npm run type-check && npm run lint`
4. Create PR with screenshots
5. Mark conflicts clearly in PR description

### Integration Testing:
After all PRs merged:
1. Full regression test
2. All 10 Playwright tests passing
3. All features work together
4. No performance degradation

---

## 📝 PR Template for Each Agent

**Title Format:**
```
feat(routing): [Agent Feature Name]
```

**Description Template:**
```markdown
## Agent: [1-5] - [Feature Name]

**Branch:** feature/[branch-name]
**Time Taken:** [X hours]
**Status:** ✅ Complete

### Changes
- Created: [list new files]
- Modified: [list modified files]

### Features Added
- [Feature 1]
- [Feature 2]

### Testing
- ✅ TypeScript: 0 errors
- ✅ ESLint: Acceptable
- ✅ Manual testing: [describe]

### Screenshots
[Include 2-3 screenshots]

### Conflicts
- [List any known conflicts with other agents]
- [Suggest resolution strategy]

### Merge After
- [ ] Agent [X] (if dependent)
- [x] Independent (if no dependencies)
```

---

## 📊 Progress Tracking

| Agent | Status | Branch | PR | Merged | Notes |
|-------|--------|--------|----|----|-------|
| 1 - Tests | 🔄 In Progress | `feature/fix-playwright-geometry-tests` | - | - | Critical path |
| 2 - Edit UI | 🔄 In Progress | `feature/route-editing-ui` | - | - | High value |
| 3 - Validation | 🔄 In Progress | `feature/route-validation` | - | - | Depends on #2 |
| 4 - Templates | 🔄 In Progress | `feature/route-templates` | - | - | Independent |
| 5 - Stats | 🔄 In Progress | `feature/route-stats-dashboard` | - | - | Independent |
| Codex - Screenshots | 🔄 In Progress | (manual) | - | - | 5 images |

**Legend:**
- 🔄 In Progress
- ✅ Complete
- 🔀 PR Open
- ✔️ Merged

---

## 🎯 Success Criteria

**All 5 agents complete when:**
- ✅ All TypeScript errors fixed
- ✅ All ESLint warnings acceptable
- ✅ All features tested and working
- ✅ All PRs created with screenshots
- ✅ Conflicts documented and resolved
- ✅ Merged to `feature/smart-routing-system`

**Timeline Estimate:**
- Parallel development: 2-3 hours
- Sequential merging: 1 hour
- Integration testing: 30 minutes
- **Total:** 3.5-4.5 hours

---

**Coordination Lead:** Claude Code (monitoring, conflict resolution, integration)
**Development:** 5 Cursor Agents (parallel)
**Testing:** Codex (manual screenshots)

**Let's ship this! 🚀**
