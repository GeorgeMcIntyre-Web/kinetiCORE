# Custom Reference Frame - Remaining Integration Work

## ✅ Completed (This Commit)

1. **EditorStore State** - Added custom frame state management
   - `customFrameSelectionMode`: Track what feature type user is selecting
   - `customFrame`: Store the calculated custom frame data
   - `coordinateFrameWidget`: Widget instance for visual axes

2. **EditorStore Actions** - Implemented all custom frame actions
   - `setCustomFrameSelectionMode()`: Set selection mode (object/face/edge/vertex)
   - `setCustomFrame()`: Set frame + show/hide widget
   - `initializeCoordinateFrameWidget()`: Create widget on scene init
   - `handleSceneClickForCustomFrame()`: Process scene clicks to calculate frames

3. **Feature Detection** - Full implementation
   - Detects clicked object/face/edge/vertex
   - Calculates coordinate frame for each feature type
   - Shows RGB axes at selected feature

## ⏳ Remaining Work

### 1. Scene Click Handler Integration (HIGH PRIORITY)
**File**: `src/scene/SceneManager.ts`

Add pointer observable in `initialize()` method:

```typescript
// After scene creation, add click handler for custom frames
this.scene.onPointerObservable.add((pointerInfo) => {
  if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
    if (pointerInfo.event.button === 0) { // Left click
      const pickInfo = this.scene!.pick(
        this.scene!.pointerX,
        this.scene!.pointerY
      );

      // Dynamically import to avoid circular dependency
      import('../ui/store/editorStore').then((module) => {
        const store = module.useEditorStore.getState();
        store.handleSceneClickForCustomFrame(pickInfo);
      });
    }
  }
});
```

### 2. Initialize Widget (HIGH PRIORITY)
**File**: `src/App.tsx` or wherever scene is initialized

After SceneManager.initialize():

```typescript
import { useEditorStore } from './ui/store/editorStore';

// After scene initialized
SceneManager.getInstance().initialize(canvas).then(() => {
  useEditorStore.getState().initializeCoordinateFrameWidget();
});
```

### 3. Known Issues to Fix

#### Issue A: GUI values not updating when moving via gizmo
**Problem**: Inspector polling reads from scene tree, but gizmo moves mesh directly without updating tree
**Solution**: Update gizmo drag handlers to call `updateNodePosition()` on drag

**File**: Wherever gizmos are set up (likely `src/manipulation/GizmoManager.ts`)

```typescript
gizmo.onDragEndObservable.add(() => {
  const mesh = gizmo.attachedMesh;
  if (mesh) {
    const tree = SceneTreeManager.getInstance();
    const node = tree.findNodeByMeshId(mesh.uniqueId.toString());
    if (node) {
      const pos = babylonToUser(mesh.position);
      useEditorStore.getState().updateNodePosition(node.id, pos);
    }
  }
});
```

#### Issue B: Rotation not working
**Problem**: Likely rotation order or coordinate system mismatch
**Solutions to try**:
1. Check if mesh uses quaternion vs Euler angles
2. Try `mesh.rotation.set()` vs `mesh.rotation = new Vector3()`
3. Verify degrees→radians conversion
4. Check if physics body rotation sync is working

**Debug**: Add console.log in `updateNodeRotation()`:
```typescript
console.log('Setting rotation:', { rotation, radiansX, radiansY, radiansZ });
console.log('Mesh rotation before:', mesh.rotation.asArray());
mesh.rotation.set(radiansX, radiansY, radiansZ);
console.log('Mesh rotation after:', mesh.rotation.asArray());
```

### 4. Coordinate Frame Transform Integration (MEDIUM PRIORITY)
Currently transforms are always in local coordinates. Need to support custom frame:

**File**: `src/ui/store/editorStore.ts`

Modify `updateNodePosition()` to convert from custom frame to local:

```typescript
updateNodePosition: (nodeId, position) => {
  const { customFrame } = get();

  let localPos = position;

  if (customFrame) {
    // Transform from custom frame coordinates to local
    localPos = transformFromCustomFrameToLocal(position, customFrame);
  }

  // Rest of existing code...
}
```

Helper function:
```typescript
function transformFromCustomFrameToLocal(
  posInCustomFrame: Vec3,
  customFrame: CustomFrameFeature
): Vec3 {
  // Build transform matrix from custom frame axes
  const xAxis = new BABYLON.Vector3(...);
  const yAxis = new BABYLON.Vector3(...);
  const zAxis = new BABYLON.Vector3(...);
  const origin = new BABYLON.Vector3(...);

  // Transform point
  const localPoint = origin
    .add(xAxis.scale(posInCustomFrame.x))
    .add(yAxis.scale(posInCustomFrame.y))
    .add(zAxis.scale(posInCustomFrame.z));

  return babylonToUser(localPoint);
}
```

### 5. Testing Checklist

Once integrated:

- [ ] Click "Custom" → Select "Object" → Click mesh → RGB axes appear at origin
- [ ] Click "Custom" → Select "Face" → Click face → RGB axes at face center
- [ ] Click "Custom" → Select "Edge" → Click edge → RGB axes at edge midpoint
- [ ] Click "Custom" → Select "Vertex" → Click corner → RGB axes at corner
- [ ] Move object via gizmo → Inspector values update
- [ ] Change rotation via Inspector → Object rotates
- [ ] Custom frame stays visible when switching objects
- [ ] Clear button removes frame and axes
- [ ] Axes scale appropriately with mesh size

### 6. File Map

**Core Logic**:
- `src/scene/CustomFrameHelper.ts` - Geometry calculations ✅
- `src/scene/CoordinateFrameWidget.ts` - Visual widget ✅
- `src/core/types.ts` - Type definitions ✅

**State Management**:
- `src/ui/store/editorStore.ts` - Store integration ✅

**UI**:
- `src/ui/components/Inspector.tsx` - Selection UI ✅
- `src/ui/components/Inspector.css` - Styling ✅

**Integration Points** (⏳ Remaining):
- `src/scene/SceneManager.ts` - Add click handler
- `src/App.tsx` - Initialize widget
- `src/manipulation/GizmoManager.ts` - Fix gizmo→Inspector updates

### 7. Quick Start After Integration

```bash
# Build
npm run build

# Test workflow
1. Click object to select
2. Click "Custom" in Inspector
3. Click "Vertex" button
4. Click on a corner of the mesh
5. RGB axes should appear
6. Position inputs now relative to that corner
```

## Estimated Time
- Scene click handler: 15 min
- Widget initialization: 5 min
- Fix gizmo updates: 30 min
- Fix rotation: 30 min
- Testing: 30 min
- **Total: ~2 hours**

## Dependencies
No new npm packages needed. All using existing Babylon.js APIs.
