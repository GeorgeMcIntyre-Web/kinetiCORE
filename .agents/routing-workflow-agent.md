# Routing Workflow Integration Agent

**Agent Type**: Worktree
**Priority**: Medium-High
**Estimated Time**: 3-4 hours
**Owner**: Cole (3D/Scene Management Specialist)

## Context
Smart routing backend is complete ([src/routing/](../src/routing/)). RoutingToolbar is integrated into RibbonToolbar, but the full workflow needs testing and visual enhancement.

## Tasks

### 1. RoutingToolbar Visual Feedback
**File**: [src/routing/ui/RoutingToolbar.tsx](../src/routing/ui/RoutingToolbar.tsx)

**Current State**: Buttons work, but no clear workflow guidance

**Required Changes**:
- [ ] Add status text showing current mode
  ```tsx
  {routingMode === 'placing_connector' && (
    <div className="routing-status">📍 Click in scene to place connector</div>
  )}
  {routingMode === 'selecting_source' && (
    <div className="routing-status">🎯 Click source connection point</div>
  )}
  {routingMode === 'selecting_dest' && (
    <div className="routing-status">🎯 Click destination connection point</div>
  )}
  ```
- [ ] Add cancel button to exit routing mode (ESC key)
- [ ] Show active route type with color coding
- [ ] Add button badge showing # of connectors placed

**New CSS File**: Create `src/routing/ui/RoutingToolbar.css`

---

### 2. RouteInspector Integration Testing
**File**: [src/routing/ui/RouteInspector.tsx](../src/routing/ui/RouteInspector.tsx)

**Current State**: Component exists but needs integration verification

**Required Changes**:
- [ ] Verify inspector appears when route is selected
- [ ] Test "Generate Geometry" button for all route types
  - Pipe → Should create cylindrical mesh
  - Electrical → Should create thin wire mesh
  - Cable Tray → Should create rectangular channel mesh
  - Conduit → Should create protective tube mesh
- [ ] Polish validation display
  ```tsx
  {violations.map(v => (
    <div className={`violation violation-${v.severity}`}>
      {v.severity === 'error' && '❌'}
      {v.severity === 'warning' && '⚠️'}
      {v.severity === 'info' && 'ℹ️'}
      {v.message}
    </div>
  ))}
  ```
- [ ] Add visual preview of constraint violations in 3D scene

**Integration Point**: Should show in Professional/Expert mode inspector panel

---

### 3. ConnectionPointIndicator Enhancement
**File**: [src/routing/ui/ConnectionPointIndicator.tsx](../src/routing/ui/ConnectionPointIndicator.tsx)

**Current State**: Basic sphere indicators

**Required Changes**:
- [ ] Make connection points more visible
  ```typescript
  const sphere = BABYLON.MeshBuilder.CreateSphere('connector', {
    diameter: 0.1, // Larger size
    segments: 16
  }, scene);

  const mat = new BABYLON.StandardMaterial('connector-mat', scene);
  mat.emissiveColor = BABYLON.Color3.FromHexString('#00D9FF');
  mat.alpha = 0.7;
  sphere.material = mat;

  // Add glow effect
  const glow = new BABYLON.GlowLayer('connector-glow', scene);
  glow.addIncludedOnlyMesh(sphere);
  ```
- [ ] Add hover tooltip showing connector type and status
- [ ] Color-code by connection type:
  - Pipe: Blue (#00D9FF)
  - Electrical: Yellow (#FFD700)
  - Cable Tray: Orange (#FF8C00)
  - Conduit: Green (#00FF00)
- [ ] Add label above connector (text mesh or sprite)

---

### 4. RoutePreview Visual Enhancement
**File**: [src/routing/ui/RoutePreview.tsx](../src/routing/ui/RoutePreview.tsx)

**Current State**: Basic line rendering

**Required Changes**:
- [ ] Animate route preview (dashed line animation)
  ```typescript
  const line = BABYLON.MeshBuilder.CreateLines('route-preview', {
    points: waypoints,
    updatable: true
  }, scene);
  line.color = new BABYLON.Color3(0, 0.85, 1); // Cyan

  // Add animation
  scene.registerBeforeRender(() => {
    line.color.a = 0.5 + 0.5 * Math.sin(Date.now() / 200);
  });
  ```
- [ ] Show violation markers as red spheres at violation points
- [ ] Add distance labels along route segments
- [ ] Show bend radius arcs at corners
- [ ] Add "ghost" preview of final geometry

---

### 5. End-to-End Workflow Testing
**Test Scenario**: Complete routing workflow

**Steps to Test**:
1. Switch to Professional mode
2. Click "Add Connector" button
3. Click in 3D scene → Should place blue sphere connector
4. Place second connector elsewhere
5. Click "Route Between Points"
6. Click first connector → Should highlight it
7. Click second connector → Should show preview line
8. Confirm route → Should create route object in scene tree
9. Select route in scene tree → Inspector should show route details
10. Click "Generate Geometry" in inspector → Should create 3D mesh
11. Click "Edit Route" → Should show draggable control points
12. Drag control point → Route should update in real-time
13. Undo (Ctrl+Z) → Should revert route edit
14. Delete route → Should remove from scene

**Document Results**:
- [ ] Record screen capture of full workflow (GIF or video)
- [ ] Note any bugs/issues in [docs/ROUTING_ISSUES.md](../docs/ROUTING_ISSUES.md)
- [ ] Verify undo/redo works for all operations

---

### 6. Routing Store State Management
**File**: [src/ui/store/routingStore.ts](../src/ui/store/routingStore.ts)

**Verify**:
- [ ] State persists correctly during mode
- [ ] No memory leaks when switching modes
- [ ] State resets properly when exiting routing mode
- [ ] Multiple routes managed correctly

**Debug Console Check**:
```typescript
// Add to RoutingToolbar for debugging
useEffect(() => {
  console.log('Routing Mode:', routingMode);
  console.log('Route Type:', currentRouteType);
  console.log('Active Routes:', useRoutingStore.getState().routes.length);
}, [routingMode, currentRouteType]);
```

---

## Integration with Scene Management

### SceneManager Integration
**File**: [src/scene/SceneManager.ts](../src/scene/SceneManager.ts)

**Verify**:
- [ ] Connection point indicators render in correct Z-up coordinate system
- [ ] Routes respect scene coordinate transformations
- [ ] Generated geometry appears in correct location
- [ ] Collision detection works with routing obstacles

### EntityRegistry Integration
**File**: [src/entities/EntityRegistry.ts](../src/entities/EntityRegistry.ts)

**Verify**:
- [ ] Route entities registered correctly
- [ ] Connector entities tracked properly
- [ ] Physics bodies created for generated geometry (if enabled)
- [ ] Entities disposed properly on delete

---

## Performance Testing

### Stress Test Scenarios
- [ ] Test with 50+ connectors in scene
- [ ] Test with 20+ active routes
- [ ] Test pathfinding with 100+ obstacle meshes
- [ ] Measure FPS during route editing (target: 60 FPS)
- [ ] Check memory usage (should not grow indefinitely)

**Profiling**:
```bash
# Run dev server with profiling
npm run dev
# Open Chrome DevTools → Performance → Record
# Perform routing operations
# Stop recording and analyze
```

---

## Known Issues to Verify

From [docs/SMART_ROUTING_LIMITATIONS.md](../docs/SMART_ROUTING_LIMITATIONS.md):

1. **Coordinate System**: Verify Z-up conversions work correctly
2. **Pathfinding Performance**: Test with complex scenes
3. **Undo/Redo**: Verify all routing operations are undoable
4. **Multi-Route Selection**: Test selecting multiple routes

---

## Success Criteria

✅ Complete workflow works end-to-end without errors
✅ Visual feedback clear at every step
✅ Connection points easily visible and labeled
✅ Route preview shows violations clearly
✅ Generated geometry matches route type
✅ Performance acceptable with 20+ routes
✅ Undo/redo works for all operations
✅ No console errors or warnings

---

## Handoff

When complete:
1. Record full workflow demo (5-10 min video)
2. Create test report: [docs/ROUTING_TEST_RESULTS.md](../docs/ROUTING_TEST_RESULTS.md)
3. Update [docs/SMART_ROUTING_WORKFLOW.md](../docs/SMART_ROUTING_WORKFLOW.md) with screenshots
4. Commit with message: `test(routing): verify end-to-end workflow and enhance visuals`

