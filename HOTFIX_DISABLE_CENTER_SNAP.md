# Emergency Hotfix: Disable Center Snapping on Hover

## Problem
The snap system runs expensive circle-fitting on every mouse move, freezing the UI on robot models.

## Quick Fix (Apply Now)

Edit `src/manipulation/SnappingHelper.ts` line ~1796:

```typescript
// BEFORE:
private snapToCenter(
  position: BABYLON.Vector3,
  snapDistance: number,
  excludeMeshIds: string[],
  camera?: BABYLON.Camera,
  screenSpacePixels?: number
): SnapResult {
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) return { snapped: false, position: position.clone() };

  // NOTE: Global mesh-count gates removed - will be replaced with per-mesh budgeting
  // and worker-based queries in upcoming refactor. Current implementation processes
  // all meshes but caps complexity per-mesh (see MAX_FACES_PER_MESH below).

// AFTER:
private snapToCenter(
  position: BABYLON.Vector3,
  snapDistance: number,
  excludeMeshIds: string[],
  camera?: BABYLON.Camera,
  screenSpacePixels?: number
): SnapResult {
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) return { snapped: false, position: position.clone() };

  // HOTFIX: Disable center snapping on hover to prevent freeze
  // Re-enable after worker-based snap system is integrated
  return { snapped: false, position: position.clone() };

  // NOTE: Global mesh-count gates removed - will be replaced with per-mesh budgeting
  // and worker-based queries in upcoming refactor. Current implementation processes
  // all meshes but caps complexity per-mesh (see MAX_FACES_PER_MESH below).
```

## Permanent Fix
The worker-based snap system I just built will fix this properly. See implementation plan below.
