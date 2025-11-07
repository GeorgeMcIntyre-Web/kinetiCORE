# Professional Mode Routing System - Fixes TODO

**Date:** 2025-11-03
**Reporter:** George
**Priority:** HIGH
**Branch:** `feature/smart-routing-system`

---

## Confirmed Issues from User Testing

### ❌ ISSUE 1: Wrong Route Type Created
**Symptom:** Clicking "Pipe" preset button creates "ELECTRICAL" routes instead of "PIPE" routes

**Evidence:**
- User clicked "Pipe" button
- Warning panel shows: "ELECTRICAL c2189beb" (not PIPE)
- User clicked "Electrical" preset
- Warning panel shows: "PIPE fda9a8e5" (not ELECTRICAL)

**Possible Causes:**
1. Button onClick handlers swapped (Pipe calls electrical, Electrical calls pipe)?
2. `setCurrentRouteType()` not working correctly
3. RoutingWorkflowHandler using wrong type
4. Route.createWithType() using wrong parameter

**Files to Check:**
- [src/ui/layouts/ProfessionalModeLayout.tsx:588-599](../src/ui/layouts/ProfessionalModeLayout.tsx) - Button onClick handlers
- [src/routing/ui/QuickRoutePresets.ts:23-30](../src/routing/ui/QuickRoutePresets.ts) - setCurrentRouteType call
- [src/routing/ui/RoutingWorkflowHandler.ts](../src/routing/ui/RoutingWorkflowHandler.ts) - Route creation logic
- [src/routing/core/Route.ts](../src/routing/core/Route.ts) - Route.createWithType method

**Fix Steps:**
1. Add console.log in button onClick to verify correct type passed
2. Add console.log in createPresetRoute to verify type parameter
3. Add console.log in CreateConnectionPointCommand to verify type
4. Add console.log in RoutingWorkflowHandler to verify route type
5. Fix incorrect type mapping

**Priority:** 🔴 CRITICAL (Breaks core functionality)

---

### ❌ ISSUE 2: Excessive Validation Warnings
**Symptom:** Single route generates 20+ duplicate warnings flooding the UI

**Evidence:**
```
✗ ELECTRICAL c2189beb Bend radius 0.42 is less than minimum 0.50
✗ ELECTRICAL c2189beb Bend radius 0.49 is less than minimum 0.50
✗ ELECTRICAL c2189beb Clearance 0.00 is less than required 0.20
✗ ELECTRICAL c2189beb Clearance 0.00 is less than required 0.20
... (20+ lines of warnings)
```

**Causes:**
1. **Duplicate warnings**: Same warning appears multiple times (e.g., "Clearance 0.00" appears 4 times)
2. **Ground plane collision**: All routes detect collision with "ground" and "gridOverlay" meshes
3. **Strict clearance**: 0.20m (20cm) clearance requirement is too high for typical routes
4. **Bend radius**: Preset routes have bends with 0.42m radius, but minimum is 0.50m

**Files to Check:**
- [src/routing/validation/RouteValidator.ts](../src/routing/validation/RouteValidator.ts) - Validation logic
- [src/routing/validation/RouteVisualWarnings.ts](../src/routing/validation/RouteVisualWarnings.ts) - Warning display
- [src/routing/ui/RouteWarningsPanel.tsx](../src/routing/ui/RouteWarningsPanel.tsx) - Warning panel UI

**Fix Steps:**
1. **Deduplicate warnings**: Hash violation messages, only show unique warnings
2. **Exclude scene infrastructure**: Don't check collisions with "ground", "gridOverlay", "skybox"
3. **Reduce clearance requirement**: Change from 0.20m → 0.05m (5cm) for most route types
4. **Adjust bend radius**: Either reduce minimum bend radius OR increase preset route bend radius

**Priority:** 🔴 CRITICAL (Makes UI unusable)

---

### ❌ ISSUE 3: Ground Plane False Positives
**Symptom:** Every route shows collision warnings with "ground" and "gridOverlay"

**Evidence:**
```
✗ Collision detected with obstacle "ground" (clearance: 0.00m < required: 0.20m)
✗ Collision detected with obstacle "ground" (clearance: 0.05m < required: 0.20m)
✗ Collision detected with obstacle "gridOverlay" (clearance: 0.00m < required: 0.20m)
```

**Cause:**
- Ground plane and grid overlay are scene infrastructure, not obstacles
- Validation system treats them as obstacles
- Routes that start at Z=0 will always be "on" the ground

**Files to Check:**
- [src/routing/core/RoutingUtils.ts](../src/routing/core/RoutingUtils.ts) - `getObstacles()` function
- [src/routing/validation/RouteValidator.ts](../src/routing/validation/RouteValidator.ts) - Collision detection

**Fix Steps:**
1. Add obstacle exclusion list: `['ground', 'gridOverlay', 'skybox', 'grid', 'axes']`
2. Filter obstacles before passing to validator:
   ```typescript
   const SCENE_INFRASTRUCTURE = new Set(['ground', 'gridOverlay', 'skybox', 'grid', 'axes']);
   const obstacles = getObstacles(scene).filter(mesh =>
     !SCENE_INFRASTRUCTURE.has(mesh.name.toLowerCase())
   );
   ```
3. OR: Add `metadata.isObstacle = false` to scene infrastructure meshes
4. OR: Add `metadata.ignoreCollision = true` to ground/grid meshes

**Priority:** 🟠 HIGH (Causes false warnings)

---

### ⚠️ ISSUE 4: Bend Radius Violations
**Symptom:** Preset routes have bend radius 0.42m and 0.49m, but minimum is 0.50m

**Evidence:**
```
✗ Bend radius 0.42 is less than minimum 0.50
✗ Bend radius 0.49 is less than minimum 0.50
```

**Cause:**
- Preset routes create paths with tight bends
- Minimum bend radius set too high (0.50m = 50cm)
- Industrial pipes can typically bend to 1.5× pipe diameter (e.g., 40mm pipe → 60mm = 0.06m radius)

**Files to Check:**
- [src/routing/ui/QuickRoutePresets.ts](../src/routing/ui/QuickRoutePresets.ts) - Preset route paths
- [src/routing/specifications/RouteSpecifications.ts](../src/routing/specifications/RouteSpecifications.ts) - minBendRadius values
- [src/routing/core/types.ts](../src/routing/core/types.ts) - DEFAULT_MIN_BEND_RADIUS

**Fix Options:**
**Option A: Reduce minimum bend radius (RECOMMENDED)**
```typescript
// Current:
DEFAULT_MIN_BEND_RADIUS = 0.50; // 50cm

// Change to:
DEFAULT_MIN_BEND_RADIUS = 0.15; // 15cm (more realistic for industrial)

// Per-type minimums:
PIPE: 1.5 × pipeRadius (e.g., 40mm pipe → 60mm = 0.06m)
ELECTRICAL: 0.10m (4 inches, NEC code)
CABLE_TRAY: 0.30m (12 inches, typical)
CONDUIT: 0.15m (6 inches, typical)
```

**Option B: Increase preset route bend radius**
- Change preset route paths to have smoother bends
- May make routes look less compact

**Priority:** 🟡 MEDIUM (Validation working correctly, but rules too strict)

---

### ⚠️ ISSUE 5: Clearance Requirements Too Strict
**Symptom:** Routes show clearance violations even when not near obstacles

**Evidence:**
```
✗ Clearance 0.05 is less than required 0.20
✗ Clearance 0.14 is less than required 0.20
```

**Cause:**
- Required clearance: 0.20m (20cm = 8 inches)
- This is industrial plant standard (walkways, maintenance access)
- Too strict for office/lab environments or small equipment

**Fix:**
Adjust clearance by route type and context:

```typescript
// Current: One size fits all
CLEARANCE_REQUIRED = 0.20; // 20cm

// Proposed: Type-specific
const CLEARANCE_BY_TYPE = {
  pipe: 0.10,        // 10cm (4 inches) for small pipes
  electrical: 0.05,  // 5cm (2 inches) for conduits
  cable_tray: 0.15,  // 15cm (6 inches) for cable trays
  conduit: 0.08,     // 8cm (3 inches) for electrical conduit
};

// OR: Context-based
const CLEARANCE_BY_CONTEXT = {
  industrial_plant: 0.20,  // 8 inches (OSHA standard)
  office: 0.10,            // 4 inches
  equipment_rack: 0.05,    // 2 inches
  outdoor: 0.30,           // 12 inches (weather + maintenance)
};
```

**Files to Fix:**
- [src/routing/validation/RouteValidator.ts](../src/routing/validation/RouteValidator.ts) - Clearance checks
- [src/routing/specifications/RouteSpecifications.ts](../src/routing/specifications/RouteSpecifications.ts) - Clearance constants

**Priority:** 🟡 MEDIUM (Makes validation too sensitive)

---

### ❓ ISSUE 6: "Strange Pipe Shapes" (User Report)
**Symptom:** User reports pipes look strange when created

**Possible Causes:**
1. **Elbow geometry**: Bends show as full torus rings instead of 90° elbows
2. **Support geometry**: Hangers/clamps add unexpected visual elements
3. **Coordinate conversion**: Z-up → Y-up conversion might cause orientation issues
4. **Multiple meshes**: Routes combine tubes + elbows + supports into one mesh

**User didn't provide screenshot**, but likely seeing:
- Donut/ring shapes at bends (torus geometry)
- U-shaped brackets at support points (hangers)
- Pipes not aligned with expected direction

**Investigation Needed:**
1. Get screenshot from user showing "strange shapes"
2. Check console logs for geometry generation
3. Verify coordinate conversions:
   ```typescript
   // Z-up {x, y, z} → Y-up {x, z, -y}
   ```

**Files to Check:**
- [src/routing/geometry/PipeGenerator.ts:242-280](../src/routing/geometry/PipeGenerator.ts) - Elbow creation
- [src/routing/geometry/PipeGenerator.ts:282-403](../src/routing/geometry/PipeGenerator.ts) - Support creation
- [src/routing/geometry/RouteGeometryGenerator.ts:30-62](../src/routing/geometry/RouteGeometryGenerator.ts) - Coordinate conversion

**Fix Options:**
1. **Replace torus with arc**: Create partial torus (90° arc) instead of full ring
2. **Hide supports by default**: Add toggle for support visibility
3. **Simplify elbow geometry**: Use bent cylinder instead of torus
4. **Add preview mode**: Show simplified geometry during editing, full detail in final render

**Priority:** 🟡 MEDIUM (Functional but not visually polished)

---

### ✅ ISSUE 7: Panel Integration (Working)
**Status:** User confirms panels are working

**Evidence:**
- Warning panel shows validation messages
- Routing toolbar buttons visible
- Labels toggle working (eye icon)

**No action needed** - This is working correctly.

---

### ✅ ISSUE 8: Route Creation (Working)
**Status:** Routes ARE being created (just wrong type)

**Evidence:**
- Routes appear in warning panel
- Validation runs successfully
- Geometry generated (user can see routes)

**No action needed** - Core pipeline works, just type mapping issue.

---

## Recommended Fix Order

### Phase 1: Critical Bugs (Block usage)
1. **Fix route type bug** (Issue 1) - 1 hour
2. **Deduplicate warnings** (Issue 2) - 1 hour
3. **Exclude ground plane from collision** (Issue 3) - 30 minutes

**Total Time:** ~2.5 hours
**Impact:** Makes system usable

---

### Phase 2: Validation Tuning (Improves UX)
4. **Reduce bend radius minimum** (Issue 4) - 30 minutes
5. **Adjust clearance requirements** (Issue 5) - 30 minutes

**Total Time:** ~1 hour
**Impact:** Reduces false warnings

---

### Phase 3: Visual Polish (Nice to have)
6. **Investigate "strange shapes"** (Issue 6) - Needs screenshot first
7. **Improve elbow geometry** - 2-3 hours
8. **Add support visibility toggle** - 1 hour

**Total Time:** ~3-4 hours (after user provides screenshots)
**Impact:** Better visual quality

---

## Testing Checklist (After Fixes)

### Test 1: Route Type Correctness
- [ ] Click "Electrical" → Creates ELECTRICAL route (yellow wire)
- [ ] Click "Pipe" → Creates PIPE route (gray cylinder)
- [ ] Click "Tray" → Creates CABLE_TRAY route (orange ladder)
- [ ] Click "Conduit" → Creates CONDUIT route (green tube)
- [ ] Warning panel shows correct type for each route

### Test 2: Validation Warnings
- [ ] Create route → Max 5-8 warnings (not 20+)
- [ ] No duplicate warnings (same message only appears once)
- [ ] No collision warnings for "ground" or "gridOverlay"
- [ ] Clearance warnings only for actual obstacles

### Test 3: Bend Radius
- [ ] Create route with gentle bend → No warning
- [ ] Create route with tight bend → Warning appears
- [ ] Minimum bend radius realistic for route type

### Test 4: Visual Quality
- [ ] Pipes look like pipes (straight cylinders)
- [ ] Elbows look reasonable (not full donuts)
- [ ] Supports visible but not overwhelming
- [ ] Routes aligned correctly in 3D space

---

## Implementation Notes

### For Issue 1 (Route Type Bug):
```typescript
// Add debug logging to trace type through pipeline:

// 1. ProfessionalModeLayout.tsx button onClick:
onClick={() => {
  console.log('[Button] Creating pipe preset');
  void createPresetRoute('pipe', { x: 0, y: 0, z: 0 }, { x: 2, y: 0.5, z: 0.5 })
}}

// 2. QuickRoutePresets.ts createPresetRoute:
console.log(`[QuickRoutePresets] Type parameter: ${type}`);

// 3. CreateConnectionPointCommand execute:
console.log(`[CreateConnectionPointCommand] Creating ${this.config.type} connection point`);

// 4. RoutingWorkflowHandler createRouteBetweenPoints:
console.log(`[RoutingWorkflowHandler] Creating route type: ${routeType}`);

// 5. Route.createWithType:
console.log(`[Route.createWithType] Creating route with type: ${type}`);
```

### For Issue 2 (Duplicate Warnings):
```typescript
// In RouteValidator.ts or RouteWarningsPanel.tsx:

// Deduplicate violations by creating unique key
function deduplicateViolations(violations: ValidationViolation[]): ValidationViolation[] {
  const seen = new Set<string>();
  return violations.filter(v => {
    const key = `${v.type}:${v.message}:${v.segment?.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Usage:
const uniqueViolations = deduplicateViolations(validationResult.violations);
```

### For Issue 3 (Ground Plane Exclusion):
```typescript
// In RoutingUtils.ts getObstacles():

const SCENE_INFRASTRUCTURE = new Set([
  'ground',
  'gridoverlay',
  'skybox',
  'grid',
  'axes',
  'helper',
  'gizmo'
]);

export function getObstacles(scene: Scene): AbstractMesh[] {
  return scene.meshes.filter((mesh) => {
    // Skip scene infrastructure
    const nameLower = mesh.name.toLowerCase();
    if (SCENE_INFRASTRUCTURE.has(nameLower)) return false;

    // Skip if explicitly marked non-obstacle
    if (mesh.metadata?.isSceneInfrastructure) return false;
    if (mesh.metadata?.ignoreCollision) return false;

    // Include everything else
    return mesh.isEnabled() && mesh.isVisible;
  });
}
```

---

## Communication

**To User (George):**
1. Confirmed issues:
   - ✅ Route type bug identified
   - ✅ Excessive warnings confirmed
   - ✅ Ground plane collision false positives
   - ❓ "Strange shapes" needs screenshot

2. Fixes prioritized:
   - Phase 1: Critical (2.5 hours) → Makes usable
   - Phase 2: Tuning (1 hour) → Reduces annoyance
   - Phase 3: Polish (3-4 hours) → Improves quality

3. Request from user:
   - Screenshot of "strange pipe shapes"
   - Browser console logs when clicking preset buttons
   - Confirmation of which fixes to prioritize

**Next Steps:**
- Await user feedback
- Start Phase 1 fixes if approved
- Create PR with fixes
- Update testing documentation

---

## References

- **Status Doc:** [PROFESSIONAL_MODE_STATUS.md](PROFESSIONAL_MODE_STATUS.md)
- **Testing Prompts:** [CURSOR_5_AGENT_TESTING_PROMPTS.md](CURSOR_5_AGENT_TESTING_PROMPTS.md)
- **Workflow Guide:** [ROUTING_WORKFLOW_GUIDE.md](ROUTING_WORKFLOW_GUIDE.md)
- **Diagnostic Script:** [ROUTING_DIAGNOSTIC_TEST.md](ROUTING_DIAGNOSTIC_TEST.md)

---

**Last Updated:** 2025-11-03
**Status:** Ready for fixes
**Awaiting:** User approval to proceed
