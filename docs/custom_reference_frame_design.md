# Custom Reference Frame - Implementation Design

## Overview
Allow users to select mesh features (object, face, edge, vertex) as custom coordinate frames with visual feedback showing RGB axes.

## User Flow

### 1. Initial Selection
1. User clicks **"Custom"** button in Inspector
2. UI shows: "Click an object to set as reference frame"
3. User clicks on any mesh in the 3D scene
4. Object gets selected

### 2. Feature Selection
After object selected, UI shows 4 buttons:
- **Object** - Use object's origin and orientation
- **Face** - Select a face on the mesh
- **Edge** - Select an edge on the mesh
- **Vertex** - Select a corner/vertex on the mesh

### 3. Sub-Feature Selection (Face/Edge/Vertex)
If user clicks Face/Edge/Vertex:
- Enable hover highlighting in 3D viewport
- **Face mode**: Hover shows semi-transparent highlight on faces
- **Edge mode**: Hover shows thick line on edges
- **Vertex mode**: Hover shows sphere marker on vertices
- User clicks to confirm selection

### 4. Visual Feedback
Once feature selected:
- RGB axes appear at the selected feature:
  - **Red** arrow = X-axis
  - **Green** arrow = Y-axis
  - **Blue** arrow = Z-axis
- Axes persist until user changes mode or selects different frame
- Axes render on top of geometry (always visible)

## Coordinate Frame Calculation

### Object Frame
- **Origin**: Object's pivot point
- **Axes**: Object's local rotation

### Face Frame
- **Origin**: Face center (average of 3 vertices)
- **Z-axis**: Face normal (pointing outward)
- **X-axis**: Along first edge (tangent to surface)
- **Y-axis**: Cross product (Z × X)

### Edge Frame
- **Origin**: Edge midpoint
- **X-axis**: Along edge direction
- **Z-axis**: Average of adjacent face normals
- **Y-axis**: Cross product (Z × X)

### Vertex Frame
- **Origin**: Vertex position
- **Z-axis**: Vertex normal
- **X/Y-axis**: Perpendicular tangent vectors

## Implementation Components

### 1. Data Structures (✅ Complete)
- `CustomFrameFeatureType`: 'object' | 'face' | 'edge' | 'vertex'
- `CustomFrameFeature`: Stores feature info + calculated frame
- Located in: `src/core/types.ts`

### 2. Geometry Helper (✅ Complete)
- `CustomFrameHelper` class
- Methods:
  - `calculateObjectFrame()`
  - `calculateFaceFrame()`
  - `calculateEdgeFrame()`
  - `calculateVertexFrame()`
  - `findClosestFace()`, `findClosestEdge()`, `findClosestVertex()`
- Located in: `src/scene/CustomFrameHelper.ts`

### 3. Visual Widget (✅ Complete)
- `CoordinateFrameWidget` class
- Renders RGB axes with arrow heads
- Methods:
  - `show(frame)` - Display axes
  - `hide()` - Remove axes
  - `isVisible()` - Check if showing
- Located in: `src/scene/CoordinateFrameWidget.ts`

### 4. Inspector UI (🔄 In Progress)
Need to add:
- State for selection workflow:
  ```typescript
  const [selectionStep, setSelectionStep] = useState<'none' | 'object' | 'feature'>('none');
  const [featureType, setFeatureType] = useState<CustomFrameFeatureType>('object');
  const [customFrame, setCustomFrame] = useState<CustomFrameFeature | null>(null);
  ```

- UI for feature type selection:
  ```tsx
  {selectionStep === 'feature' && (
    <div className="feature-selector">
      <button onClick={() => selectFeatureType('object')}>Object</button>
      <button onClick={() => selectFeatureType('face')}>Face</button>
      <button onClick={() => selectFeatureType('edge')}>Edge</button>
      <button onClick={() => selectFeatureType('vertex')}>Vertex</button>
    </div>
  )}
  ```

### 5. Scene Click Handling (⏳ Pending)
Need to add click handler in scene:
- Listen for scene pointer events
- Ray cast to find picked mesh and pick point
- If in feature selection mode:
  - For 'face': Find closest face, calculate frame, show axes
  - For 'edge': Find closest edge, calculate frame, show axes
  - For 'vertex': Find closest vertex, calculate frame, show axes

### 6. Hover Highlighting (⏳ Pending)
Add hover preview in 3D viewport:
- Create highlight overlays
- Update on mouse move
- Different styles for face/edge/vertex

### 7. Transform Integration (⏳ Pending)
Update transform calculations to use custom frame:
- Convert position/rotation from custom frame to local
- Update gizmo orientation to match custom frame
- Located in: `src/ui/store/editorStore.ts`

## Technical Challenges

### Challenge 1: Scene Event Integration
**Problem**: Inspector is a React component, but scene events happen in Babylon.js
**Solution**: Use Zustand store as bridge:
```typescript
// In editorStore.ts
customFrameSelectionMode: 'none' | 'object' | 'face' | 'edge' | 'vertex';
setCustomFrameSelectionMode: (mode) => { ... };
handleSceneClick: (pickInfo) => { ... };
```

### Challenge 2: Feature Detection Accuracy
**Problem**: Edges and vertices are small, hard to click precisely
**Solution**:
- Use distance threshold for selection
- Show preview on hover
- Allow zoom in for precision

### Challenge 3: Axes Scale
**Problem**: Axes might be too big or too small depending on model size
**Solution**:
- Auto-scale based on mesh bounding box
- Make axis length configurable (default 10% of bounding box diagonal)

### Challenge 4: Memory Management
**Problem**: Creating/destroying highlight meshes on every hover
**Solution**:
- Reuse single highlight mesh per type
- Just update position/visibility
- Dispose on mode exit

## Next Steps

1. ✅ Add data types to `types.ts`
2. ✅ Create `CustomFrameHelper` utility class
3. ✅ Create `CoordinateFrameWidget` visual component
4. **→ Update Inspector with hierarchical selection UI**
5. Add scene click handler for feature picking
6. Add hover highlighting system
7. Integrate custom frame into transform calculations
8. Add configuration for axes scale
9. Test with different mesh types (box, sphere, complex GLB)
10. Document user guide for custom frames

## Example User Workflow

```
User: "I want to position this robot arm relative to the corner of that table"

1. Select robot arm in scene tree
2. Click "Custom" in reference frame selector
3. Click on table mesh → table highlights
4. Click "Vertex" button
5. Hover over table corners → see spheres at each corner
6. Click on desired corner → RGB axes appear
7. Now position inputs in Inspector are relative to that corner
8. Move robot arm using the inputs → positioned relative to table corner
```

## Visual Mockup

```
┌─────────────────────────────────┐
│ Inspector                       │
├─────────────────────────────────┤
│ Transform                       │
│                                 │
│ [Local] [World] [Custom]←       │
│                         Active  │
│                                 │
│ Custom Frame: Table Corner      │
│ ┌─────────────────────────────┐ │
│ │ [Object] [Face] [Edge] [•]  │ │
│ │              Vertex selected │ │
│ └─────────────────────────────┘ │
│                                 │
│ Position (mm)                   │
│ X [-][100.0][+] Y...            │
│                                 │
└─────────────────────────────────┘

3D Viewport:
         [Table]
           │
           └─[Selected Vertex]
              ├──→ (Red X)
              ├──→ (Green Y)
              └──→ (Blue Z)
```

## API Summary

```typescript
// Create frame from feature
const frame = CustomFrameHelper.calculateFaceFrame(mesh, nodeId, faceIndex);

// Show visual axes
const widget = new CoordinateFrameWidget(scene);
widget.show(frame, 0.1); // 0.1m axes length

// Hide axes
widget.hide();

// Transform point from custom frame to world
const worldPos = transformFromCustomFrame(localPos, frame);
```

## Dependencies
- Babylon.js ray casting (`scene.pick()`)
- Babylon.js line mesh for axes
- Babylon.js highlight layer for previews
- React state for UI workflow
- Zustand store for scene-React bridge
