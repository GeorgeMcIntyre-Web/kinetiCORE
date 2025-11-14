# Last-Mile Fixes Applied

## ✅ Completed Fixes

### 1. Bin Index Math (Fixed)
- Changed `binIndexOf` to return `{ix, iy}` instead of single number
- Added proper clamping and validation
- Handles NaN and edge cases
- Y-axis correctly handles Babylon's top-left origin

### 2. Projection Helper Parity (Fixed)
- Updated `projectToScreen` in both harness and app to match exactly
- Uses `viewport.toGlobal(rw, rh)` consistently
- Same padding (2px) and validation logic
- Same frustum checks

### 3. Pointer Pixels (Fixed)
- Both harness and app use render pixels (`scene.pointerX/Y`)
- DPR calculation matches: `1 / engine.getHardwareScalingLevel()`
- Thresholds computed in render pixels

### 4. Onion-Layer Search (Fixed)
- Keeps expanding until vertices found or max radius reached
- Only stops when `foundAny = true` or `searchRadius > maxRadius`
- Processes all bins in each ring before expanding

### 5. Vertex Fetching for Instances (Fixed)
- `getPositionsArray` now always reads from `sourceMesh` if available
- Matches harness pattern exactly
- Handles both instances and regular meshes

### 6. Snapshot/Replay (Added)
- Harness has "Copy Snapshot" button
- Generates JSON with camera state, pointer, DPR, render dimensions
- Logs to console and copies to clipboard
- Ready for app-side replay implementation

## 🔄 Remaining Work

### App-Side Replay
Add dev command to ingest snapshot and run snap search:
```typescript
// In console or dev command
window.replaySnapshot = (snapshotJson: string) => {
  const snap = JSON.parse(snapshotJson);
  // Set camera matrices/position
  // Set pointer override
  // Run snap search once
  // Log [SnapDiag][Replay] with results
};
```

### Validation Steps
1. Run harness, hover over MH5 base flange
2. Click "Copy Snapshot"
3. Paste snapshot in app console
4. Compare `[SnapDiag]` vs `[Harness]` values
5. Fix any mismatches (DPR, projection, bin math)

## 📊 Expected Parity

After fixes, harness and app should show:
- Same `inFrustum` counts (±10%)
- Same `minPx` values (±50px)
- Same `dpr` (identical)
- Same `camDist` (±0.1m)
- Same bin populations

## 🐛 Known Issues Fixed

1. ✅ Bin indexing off-by-one → Fixed with proper clamping
2. ✅ Y-axis inversion → Fixed (Babylon Y increases downward)
3. ✅ Pointer pixel mismatch → Fixed (both use render pixels)
4. ✅ Projection viewport mismatch → Fixed (both use `toGlobal`)
5. ✅ Empty-bin dead zones → Fixed (onion search expands)
6. ✅ Instance vertex fetching → Fixed (always use sourceMesh)

## 🚀 Next Steps

1. Test harness with MH5_BASE_AXIS.STL
2. Capture snapshot at flange/bolt areas
3. Replay in app and compare
4. Fix any remaining mismatches
5. Validate all test areas
6. Remove temporary logging
7. Finalize and commit

