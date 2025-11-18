# Quick Reference: UI/UX Improvement Tasks

**Full Details**: See `MEGA_PROMPT_UI_IMPROVEMENTS.md`

---

## Task Summary

### 1️⃣ Snap Coordinate Display ⭐ HIGH VALUE
**Goal**: Show snapped coordinates in UI for easy retrieval

**Quick Steps**:
1. Add `lastSnapResult` to editorStore
2. Create `<SnapCoordinateDisplay />` component
3. Position bottom-right corner
4. Add "Copy Coordinates" button
5. Make toggleable in settings

**Files**:
- `src/ui/store/editorStore.ts`
- `src/ui/components/SnapCoordinateDisplay.tsx` (NEW)
- `src/manipulation/SnappingHelper.ts`

**Estimated Time**: 4-6 hours

---

### 2️⃣ Boolean Operations Testing 🧪
**Goal**: Comprehensive testing and UI improvements

**Quick Steps**:
1. Create test suite in `tests/scene/BooleanOperations.test.ts`
2. Test union, subtract, intersect operations
3. Add loading indicators
4. Add ribbon toolbar buttons
5. Implement keyboard shortcuts (Ctrl+U, Ctrl+Shift+U, Ctrl+I)

**Files**:
- `tests/scene/BooleanOperations.test.ts` (NEW)
- `src/scene/BooleanOperations.ts`
- `src/ui/layouts/EssentialModeLayout.tsx`
- `src/ui/components/RibbonToolbar.tsx`

**Estimated Time**: 8-10 hours

---

### 3️⃣ Measurement Billboard Labels 🏷️ BUG FIX REQUIRED
**Goal**: Add billboard labels + fix disposal issue

**Quick Steps**:
1. Create `createBillboardLabel()` helper function
2. Add labels at measurement points
3. Add midpoint distance label
4. **FIX**: Properly dispose ALL artifacts when closed
5. Add measurement history to store

**Files**:
- `src/ui/components/MeasurementTools.tsx`
- `src/ui/store/editorStore.ts`

**Critical Bug**: Lines/spheres not deleted when measurement tool closed!

**Estimated Time**: 6-8 hours

---

### 4️⃣ Gizmo Default Off ⚡ QUICK WIN
**Goal**: Disable transform gizmo by default

**Quick Steps**:
1. Change `transformGizmoEnabled: false` in editorStore
2. Add localStorage persistence
3. Add `T` keyboard shortcut to toggle
4. Update ribbon button to show state
5. Add toast notification on toggle

**Files**:
- `src/ui/store/editorStore.ts` (line 664)
- `src/ui/layouts/EssentialModeLayout.tsx`
- `src/ui/components/RibbonToolbar.tsx`

**Estimated Time**: 2-3 hours

---

### 5️⃣ Expert Mode Redesign 🎨
**Goal**: Unify visual design with Essential/Pro modes

**Quick Steps**:
1. Update color scheme to match (cyan theme)
2. Replace custom header with standard Header component
3. Add ribbon toolbar below header
4. Update multi-viewport styling
5. Preserve all expert features (command palette, etc.)

**Files**:
- `src/ui/layouts/ExpertModeLayout.tsx`
- `src/ui/layouts/ExpertModeLayout.css`

**Color Changes**:
- Background: `#0a0e14` → `#1a202c`
- Header: `#161b22` → `#2d3748`
- Accent: Purple → Cyan `#00D9FF`

**Estimated Time**: 10-12 hours

---

## Priority Order

1. **Task 4** (Gizmo off) - 2-3 hours - Quick win
2. **Task 3** (Billboards) - 6-8 hours - Bug fix required
3. **Task 1** (Snap coords) - 4-6 hours - High value
4. **Task 5** (Expert mode) - 10-12 hours - Can do in parallel
5. **Task 2** (Boolean ops) - 8-10 hours - Testing focus

**Total Estimated Time**: 30-39 hours

---

## Key Files Reference

### State Management
- `src/ui/store/editorStore.ts` - Main Zustand store

### Layouts
- `src/ui/layouts/EssentialModeLayout.tsx` - Beginner interface
- `src/ui/layouts/ProfessionalModeLayout.tsx` - Advanced interface
- `src/ui/layouts/ExpertModeLayout.tsx` - Power user interface

### Core Features
- `src/manipulation/SnappingHelper.ts` - Snapping system
- `src/scene/BooleanOperations.ts` - CSG2 Boolean ops
- `src/ui/components/MeasurementTools.tsx` - Measurement tools

### UI Components
- `src/ui/components/Header.tsx` - Standard header
- `src/ui/components/RibbonToolbar.tsx` - Main toolbar
- `src/manipulation/TransformGizmo.ts` - Transform gizmo

---

## Testing Checklist

For each task:
- [ ] Unit tests written
- [ ] Integration tests pass
- [ ] ESLint passes (0 errors)
- [ ] TypeScript compiles
- [ ] Visual design matches mockup
- [ ] No memory leaks
- [ ] Documentation updated
- [ ] Keyboard shortcuts work
- [ ] Accessibility considered

---

## Git Branch Strategy

```bash
# Create separate branch for each task
git checkout -b feature/snap-coordinates
git checkout -b feature/boolean-improvements
git checkout -b feature/measurement-billboards
git checkout -b feature/gizmo-default-off
git checkout -b feature/expert-mode-redesign

# After completion, merge to main via PR
```

---

## Success Criteria

### User Experience
- ✅ Fewer clicks to accomplish tasks
- ✅ Visual consistency across all modes
- ✅ Features are discoverable
- ✅ Professional appearance

### Technical Quality
- ✅ 80%+ test coverage
- ✅ Zero memory leaks
- ✅ Zero ESLint errors
- ✅ Performance maintained

---

## Questions?

- **Full Details**: `MEGA_PROMPT_UI_IMPROVEMENTS.md`
- **Project Context**: `CLAUDE.md`
- **Architecture**: `docs/architecture.md`
- **Team Lead**: George (for technical questions)

---

**Ready to start? Begin with Task 4 (Gizmo default off) for a quick win!** 🚀
