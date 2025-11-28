# SceneTree Mapping & Diagnostics

**Goal**: Ensure every `ToolUnit` detected by analyzers (Structure, Geometry, Name-based) is correctly mapped to a `SceneTreeNode` in the `SceneTreeManager`.

## The Problem
Previously, mapping relied on string IDs or names, which were brittle and caused "Unit not found" errors when Babylon's internal IDs didn't match the SceneTree's IDs.

## The Solution: `babylonUniqueId`
We now use Babylon.js's `uniqueId` (number) as the canonical identifier.
1. **Analyzers** (`StructureBasedToolAnalyzer`, `ToolGraphAnalyzer`) capture the `uniqueId` from the source Babylon node (TransformNode or Mesh) and store it in `ToolUnit.babylonUniqueId`.
2. **SceneTree** nodes store this ID in `babylonTransformNodeId` or `babylonMeshId`.
3. **Mapping Helper** (`findSceneTreeNodeForToolUnit`) uses a robust strategy to match them.

## Mapping Strategy
The `findSceneTreeNodeForToolUnit` helper (in `src/scene/SceneTreeMapping.ts`) attempts to find a match in this order:

1.  **Transform Node UID** (Preferred): Matches `unit.babylonUniqueId` against `SceneTreeNode.babylonTransformNodeId`.
2.  **Mesh UID** (Fallback): Matches `unit.babylonUniqueId` against `SceneTreeNode.babylonMeshId`.
3.  **Root Node ID** (Legacy): Matches `unit.root` against `SceneTreeNode.id`.
4.  **Name Match** (Last Resort): Matches `unit.name` against `SceneTreeNode.name`.

> [!WARNING]
> Name matching is considered legacy and brittle. It logs a warning when used.

## Diagnostics
If you encounter "Unit not found" errors, use the diagnostic report tool in `KinematicExtractionPipeline`:

```typescript
const report = pipeline.generateSceneTreeMappingReport();
console.log(report);
```

This outputs a CSV-formatted string with:
- `toolUnitId`
- `name`
- `babylonUniqueId`
- `strategy` (e.g., 'transform-uid', 'name-match', 'not-found')
- `sceneNodeId`
- `sceneNodeName`

## Developer Notes
- **Always** ensure `babylonUniqueId` is populated when creating `ToolUnit`s in new analyzers.
- **Do not** rely on `unit.root` (string ID) for critical lookups if possible.
- **Tests**: 
  - Unit: `tests/scene/SceneTreeMapping.test.ts` (Mapping strategies)
  - Integration: `tests/scene/PipelineMappingIntegration.test.ts` (Pipeline logging & flow)
