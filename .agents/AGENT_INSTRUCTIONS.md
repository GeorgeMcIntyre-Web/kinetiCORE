# Agent System Instructions - Smart Routing Feature Completion

## Overview
This directory contains task specifications for completing the smart-routing-system feature branch UI. Each agent file represents a focused work package that can be executed independently using different agent nodes.

---

## 📋 Agent Files

### 1. **routing-geometry-test-agent.md** (Worktree + Local) 🔴 **START HERE**
**Owner**: Cole (3D) + Edwin (UI verification)
**Time**: 4-5 hours
**Priority**: 🔴 **CRITICAL**

**What it does**:
- Test all 4 route type geometries (electrical, pipe, cable tray, conduit)
- Verify mesh generation for each type
- Test material/color rendering
- Validate geometry editing and updates
- Performance benchmarking
- Create geometry test report with screenshots

**Why First**: User specifically requested testing electrical mesh, piping, wiring, water pipes, and cable trays
**Dependencies**: Routing backend complete ✅
**Best for**: Worktree agent with full 3D scene access

---

### 2. **ui-polish-agent.md** (Local Node)
**Owner**: Edwin (UI/UX Specialist)
**Time**: 2-3 hours
**Priority**: 🔴 High

**What it does**:
- Polish ExpertModeLayout quad viewport
- Refine Professional mode ribbon toolbar
- Enhance MeasurementTools panel visuals
- Improve ExportDialog design
- Add smooth mode switching animations

**Dependencies**: None
**Best for**: Cursor agent with live preview

---

### 3. **routing-workflow-agent.md** (Worktree Node)
**Owner**: Cole (3D/Scene Management)
**Time**: 3-4 hours
**Priority**: 🟡 Medium-High

**What it does**:
- Test end-to-end routing workflow
- Enhance RoutingToolbar visual feedback
- Improve connection point indicators
- Add route preview animations
- Verify RouteInspector integration
- Performance testing with multiple routes

**Dependencies**: Requires routing-geometry-test-agent complete
**Best for**: Worktree agent with full scene testing

---

### 4. **documentation-agent.md** (Cloud Node)
**Owner**: Any team member
**Time**: 2 hours
**Priority**: 🟢 Medium

**What it does**:
- Capture feature screenshots
- Create animated GIFs
- Update README.md with demo materials
- Enhance smart routing documentation
- Create PR description template
- Optional: Record video tutorial

**Dependencies**: Completed geometry tests + UI polish for best screenshots
**Best for**: Cloud agent (async work, no dev server needed for most tasks)

---

## 🎯 Execution Strategy

### **PHASE 1: Geometry Testing** 🔴 START HERE
```bash
# Terminal 1 - CRITICAL: Geometry Testing (Cole)
# Execute routing-geometry-test-agent.md
npm run dev
# Test all 4 route types:
#   1. Electrical (yellow wire mesh)
#   2. Pipe (blue cylinder + elbows)
#   3. Cable Tray (orange rectangular channel)
#   4. Conduit (green tube + junction boxes)
# Create test report + screenshots (4-5 hours)
```

**Why First**: User specifically wants to verify mesh generation for electrical, piping, wiring, water pipes, and cable trays. This validates the core routing feature.

**Deliverables**:
- [x] All 4 geometry types working
- [x] Test report: `docs/ROUTING_GEOMETRY_TEST_RESULTS.md`
- [x] Screenshots: `docs/images/routing-{type}-*.png`

---

### **PHASE 2: Parallel UI + Workflow** (After geometry passes)
Run 2 agents simultaneously:

```bash
# Terminal 1 - Local Node (Edwin via Cursor)
# Open ui-polish-agent.md in Cursor
npm run dev
# Polish layouts, components, animations (2-3 hours)

# Terminal 2 - Worktree Node (Cole via Claude Code)
# Execute routing-workflow-agent.md
npm run dev
# Test full workflow integration (3-4 hours)
```

---

### **PHASE 3: Documentation** (Final step)
After UI polish and workflow tests complete:

```bash
# Terminal 3 - Cloud Node (Any team member)
# Execute documentation-agent.md
# Capture screenshots of polished UI
# Create GIFs of working geometry
# Update README/docs (2 hours)
```

---

### Sequential Execution (Solo)
If one person working alone, follow this order:

1. **FIRST** 🔴: `routing-geometry-test-agent.md` ← **CRITICAL - START HERE**
   - 4-5 hours
   - Validates core feature (geometry generation)
   - User priority: electrical, pipe, cable tray, conduit

2. **Second**: `ui-polish-agent.md`
   - 2-3 hours
   - Makes everything look professional

3. **Third**: `routing-workflow-agent.md`
   - 3-4 hours
   - Verifies end-to-end integration

4. **Fourth**: `documentation-agent.md`
   - 2 hours
   - Documents tested, polished features

---

## ✅ Completion Checklist

Track overall feature branch progress:

### Code Quality
- [x] TypeScript errors fixed ✅
- [x] ESLint warnings resolved ✅
- [x] All imports working ✅
- [ ] No console errors in browser
- [ ] Build passes (`npm run build`)

### Routing Geometry Tests (routing-geometry-test-agent.md) 🔴 **PRIORITY 1**
- [ ] **Electrical**: Wire mesh generation tested
- [ ] **Pipe**: Cylinder + elbow geometry tested
- [ ] **Cable Tray**: Rectangular channel tested
- [ ] **Conduit**: Tube + junction box tested
- [ ] Mixed route types in same scene tested
- [ ] Geometry editing/updates tested
- [ ] Performance benchmarks completed
- [ ] Test report created (`docs/ROUTING_GEOMETRY_TEST_RESULTS.md`)

### UI Polish (ui-polish-agent.md)
- [ ] ExpertModeLayout quad viewport styled
- [ ] Professional ribbon toolbar refined
- [ ] MeasurementTools panel enhanced
- [ ] ExportDialog improved
- [ ] Mode switcher animations added

### Routing Workflow (routing-workflow-agent.md)
- [ ] End-to-end workflow tested
- [ ] RoutingToolbar visual feedback added
- [ ] Connection indicators enhanced
- [ ] Route preview animated
- [ ] RouteInspector verified
- [ ] Performance tested

### Documentation (documentation-agent.md)
- [ ] Screenshots captured (7+ images)
- [ ] GIFs created (4 animations)
- [ ] README.md updated
- [ ] Smart routing docs enhanced
- [ ] CHANGELOG.md entry added
- [ ] PR template created

### Final Review
- [ ] All agent tasks completed
- [ ] Manual testing passed
- [ ] Screenshots/GIFs committed
- [ ] Documentation reviewed
- [ ] Ready for PR to main

---

## 📦 Deliverables

When all agents complete, you should have:

1. **Polished UI**
   - Professional-grade layouts
   - Smooth animations
   - Clear visual feedback

2. **Tested Workflow**
   - End-to-end routing works
   - No bugs or console errors
   - Performance acceptable

3. **Complete Documentation**
   - README showcases features
   - Quick start guide has screenshots
   - Demo materials ready

4. **Production Ready**
   - All CI checks pass
   - Build succeeds
   - Ready to merge to main

---

## 🚀 Getting Started

### For Local Node (Cursor)
```bash
# Open project in Cursor
# Open .agents/ui-polish-agent.md
# Start dev server
npm run dev
# Follow checklist, tick boxes as you complete tasks
```

### For Worktree Node (Claude Code)
```bash
# Create worktree for isolated testing
git worktree add ../kineticore-routing feature/smart-routing-system
cd ../kineticore-routing
npm install
npm run dev
# Execute routing-workflow-agent.md
```

### For Cloud Node (Any editor)
```bash
# No dev server needed for most tasks
# Open .agents/documentation-agent.md
# Work through screenshot/GIF creation
# Update docs files
# Commit when ready
```

---

## 📞 Communication

### Update Progress
As you complete tasks, update this file:

```markdown
## Progress (Last Updated: 2025-11-01)

**ui-polish-agent**: ⏳ In Progress (Edwin)
- [x] Quad viewport styled
- [ ] Ribbon toolbar refined
- [ ] ... (rest pending)

**routing-workflow-agent**: 🚀 Started (Cole)
- [x] End-to-end test passed
- [ ] ... (rest pending)

**documentation-agent**: ⏸️ Waiting for screenshots

**Blockers**: None
```

### Handoff
When agent completes:
1. Update this file with ✅ status
2. Commit your changes
3. Push to feature/smart-routing-system
4. Notify team in Slack #dev channel

---

## 🔧 Troubleshooting

### "I can't find the file mentioned in the agent task"
- Ensure you're on `feature/smart-routing-system` branch
- Pull latest: `git pull origin feature/smart-routing-system`

### "Dev server won't start"
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### "Type errors after pulling latest"
```bash
npm run type-check
# If errors, check if you need to revert local changes
git status
```

### "GIF file too large"
- Use ScreenToGif compression settings
- Target 15 fps, 720p resolution
- Limit duration to 10-15 seconds

---

## ✨ Success!

When all agents complete:
1. Run full CI checks locally:
   ```bash
   npm run lint && npm run type-check && npm run build
   ```
2. Create PR using `.github/PULL_REQUEST_TEMPLATE/feature_smart_routing.md`
3. Tag George for review
4. Celebrate! 🎉

