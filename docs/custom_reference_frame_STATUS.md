# Custom Reference Frame - Implementation Status

## ✅ Completed Components

### 1. Data Structures (`src/core/types.ts`)
- `CustomFrameFeatureType`: Type for feature selection ('object' | 'face' | 'edge' | 'vertex')
- `CustomFrameFeature`: Complete interface storing:
  - Feature type and geometric data (face index, edge vertices, vertex index)
  - Calculated coordinate frame (origin + X/Y/Z axes)

### 2. Geometry Helper (`src/scene/CustomFrameHelper.ts`)
- **calculateObjectFrame()**: Computes frame from mesh origin
- **calculateFaceFrame()**: Frame at face center with normal as Z-axis
- **calculateEdgeFrame()**: Frame at edge midpoint along edge direction
- **calculateVertexFrame()**: Frame at vertex with vertex normal
- **findClosestFace/Edge/Vertex()**: Ray picking helpers for feature detection

### 3. Visual Widget (`src/scene/CoordinateFrameWidget.ts`)
- Renders RGB axes (Red=X, Green=Y, Blue=Z) at selected feature
- Arrow heads on axes for clear direction indication
- Always renders on top of geometry (renderingGroupId=3)
- Clean show/hide/dispose API

### 4. Inspector UI (`src/ui/components/Inspector.tsx`)
- Feature type selection buttons (Object/Face/Edge/Vertex)
- Dynamic instructions based on selection mode
- Custom frame info display with Clear button
- Proper state management for selection workflow

### 5. Styling (`src/ui/components/Inspector.css`)
- Grid layout for feature type buttons (2x2)
- Active state styling for selected feature
- Green info box when frame is set
- Red Clear button for removing frame

## ⏳ Remaining Work

### 1. EditorStore Integration (HIGH PRIORITY)
Need to add to `src/ui/store/editorStore.ts`:
```typescript
// State
customFrameSelectionMode: 'none' | 'object' | 'face' | 'edge' | 'vertex';
customFrame: CustomFrameFeature | null;
coordin ateFrameWidget: CoordinateFrameWidget | null;

// Actions
setCustomFrameSelectionMode: (mode) => void;
setCustomFrame: (frame) => void;
handleSceneClickForCustomFrame: (pickInfo) => void;
```

### 2. Scene Click Handler (HIGH PRIORITY)
Add pointer event listener in scene setup:
```typescript
scene.onPointerObservable.add((pointerInfo) => {
  if (customFrameSelectionMode !== 'none') {
    const pickInfo = pointerInfo.pickInfo;
    if (pickInfo?.hit && pickInfo.pickedMesh) {
      handleCustomFrameSelection(pickInfo);
    }
  }
});
```

### 3. Feature Selection Logic
Implement `handleCustomFrameSelection()`:
- For 'object': Use CustomFrameHelper.calculateObjectFrame()
- For 'face': Find closest face, calculate frame, show axes
- For 'edge': Find closest edge, calculate frame, show axes
- For 'vertex': Find closest vertex, calculate frame, show axes
- Create CoordinateFrameWidget and call widget.show(frame)

### 4. Hover Highlighting (MEDIUM PRIORITY)
Add preview overlays when hovering:
- Face: Semi-transparent highlight layer
- Edge: Thick colored line
- Vertex: Sphere marker
- Update on pointermove events

### 5. Transform Integration (LOW PRIORITY)
Update transform calculations to use custom frame:
- Convert position inputs from custom frame to local/world
- Orient gizmo to match custom frame axes
- This requires matrix math for coordinate transformations

### 6. Widget Lifecycle Management
- Create widget when custom frame set
- Dispose widget when frame cleared or mode changed
- Update widget if mesh transforms
- Handle widget visibility in different scenes

## Testing Checklist

- [ ] Click "Custom" button → UI appears
- [ ] Select "Object" → click mesh → frame shows at origin
- [ ] Select "Face" → click face → frame shows at face center with normal
- [ ] Select "Edge" → click edge → frame shows at edge midpoint
- [ ] Select "Vertex" → click vertex → frame shows at corner
- [ ] Clear button removes frame and axes
- [ ] Cancel button exits selection mode
- [ ] Axes are always visible (render on top)
- [ ] Axes scale appropriately with mesh size
- [ ] Multiple frame selections work sequentially

## Integration Points

### Scene Setup (src/scene/SceneManager.ts)
- Initialize CoordinateFrameWidget instance
- Add to editorStore
- Set up pointer event handlers

### Physics Sync
- Custom frame should not affect physics calculations
- Physics always uses world coordinates
- Frame is purely for user input convenience

### Gizmo Integration (Optional)
- Could orient translate/rotate gizmos to match custom frame
- Requires updating GizmoManager to read custom frame from store
- Low priority - can be added later

## Known Limitations

1. **Single Frame**: Only one custom frame at a time
   - Could extend to multiple named frames later

2. **Static Geometry**: Frame doesn't update if mesh deforms
   - Acceptable for rigid bodies in industrial simulation

3. **No Persistence**: Frame lost on page refresh
   - Could save to scene tree node metadata

4. **Manual Axis Scale**: Fixed 0.1m axes length
   - Could auto-scale based on mesh bounding box

## Next Steps for Completion

1. Add state/actions to editorStore (30 min)
2. Implement scene click handler (45 min)
3. Connect widget lifecycle (30 min)
4. Test with different mesh types (30 min)
5. Add hover highlighting (optional, 1 hour)
6. Document user workflow (15 min)

**Estimated time to MVP**: 2-3 hours
**Estimated time to full feature**: 4-5 hours

## User Workflow (Once Complete)

```
1. User selects object in scene
2. User clicks "Custom" in Inspector
3. UI shows 4 feature type buttons
4. User selects "Vertex"
5. Instruction appears: "Click near a vertex in the 3D viewport"
6. User hovers over mesh → vertices highlight
7. User clicks corner → RGB axes appear at that point
8. Green info box shows "Frame: vertex (vertex 42)"
9. Position inputs now relative to that corner
10. User can move object using those inputs
11. Click "Clear" to remove frame
```

## Files Modified

- ✅ `src/core/types.ts` - Type definitions
- ✅ `src/scene/CustomFrameHelper.ts` - NEW FILE - Geometry calculations
- ✅ `src/scene/CoordinateFrameWidget.ts` - NEW FILE - Visual axes
- ✅ `src/ui/components/Inspector.tsx` - UI workflow
- ✅ `src/ui/components/Inspector.css` - Styling
- ⏳ `src/ui/store/editorStore.ts` - State management (NEEDED)
- ⏳ `src/scene/SceneManager.ts` - Event handlers (NEEDED)
- 📝 `docs/custom_reference_frame_design.md` - Design doc
- 📝 `docs/custom_reference_frame_STATUS.md` - This file

## Commit Message

```
feat: Add custom reference frame UI foundation

- Add hierarchical feature selection (Object/Face/Edge/Vertex)
- Implement geometry helpers for frame calculation
- Create visual RGB axes widget for frame display
- Add Inspector UI with feature type buttons
- Support frame info display and clearing

Technical components:
- CustomFrameHelper: Calculate frames from mesh features
- CoordinateFrameWidget: Render RGB axes at frame origin
- Inspector: Feature selection workflow UI
- Types: CustomFrameFeature, CustomFrameFeatureType

Remaining work:
- EditorStore integration for state management
- Scene click handler for feature picking
- Hover highlighting system
- Transform coordinate conversions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```
