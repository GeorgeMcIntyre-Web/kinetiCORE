# Vertex Debug Harness - Usage Guide

## Quick Start

1. **Start the debug server**:
   ```powershell
   npm run debug:vertices
   ```

2. **Open in browser**: `http://localhost:8080/debug/vertex_debug.html`

3. **Load the STL**:
   - Click "Load Default" (loads `debug/assets/MH5_BASE_AXIS.stl`)
   - OR click "Choose STL…" to select any STL file

4. **Move your mouse** over the 3D model and observe:
   - **Green dots**: Vertices inside frustum
   - **Yellow dots**: Vertices within screen threshold (default 500px)
   - **Blue ring**: Closest vertex to pointer

## What the Overlay Shows

### Legend (bottom-right):
- **in frustum**: Count of vertices that passed frustum culling
- **within threshold**: Count of vertices within screen distance threshold
- **closest px**: Pixel distance to closest vertex
- **vertices (raw)**: Total vertex count from STL
- **decimated**: Number of vertices being displayed (for performance)
- **DPR**: Device pixel ratio (for render pixel calculations)
- **camera dist (m)**: Distance from camera to target

### Console Output (every 60 frames):
```
[Harness] verts=112656 dec=20000 inFrustum=3111 near=22 minPx=188.3 dpr=1.00 camDist=0.430
```

## Interpreting Results

### ✅ Good Signs:
- **in frustum** > 0 when hovering over base
- **within threshold** increases as you get closer
- **closest px** drops to < 200px when hovering directly over base
- **minPx** consistently < threshold when visually near

### ⚠️ Problem Indicators:

**If "in frustum" = 0:**
- Vertices are being culled incorrectly
- Check camera near/far plane settings
- Verify mesh is actually in view

**If "within threshold" stays 0:**
- Threshold is too low → increase "Screen threshold (CSS px)" slider
- Projection might be wrong → check DPR and camera distance
- Vertices might be behind camera → check camera position

**If "closest px" stays > 500px:**
- Projection anchor issue (not using pointerX/Y correctly)
- Camera distance too far
- Mesh scale/transform issues

**If vertices jump around:**
- Vertex deduplication problems
- World matrix not updating
- Index cache invalidation issues

## Adjusting Parameters

- **Screen threshold (CSS px)**: Increase if vertices aren't detected (try 1000-2000px for dense meshes)
- **Decimate to ~ points**: Increase for more detail (try 50000-100000 for deep inspection)
- **Point size**: Increase to see dots better (try 3-5)

## Troubleshooting

**No vertices showing?**
- Check browser console for STL load errors
- Verify STL file is binary format (not ASCII)
- Try using file picker instead of default path
- Check CORS if loading from different origin

**Performance issues?**
- Reduce "Decimate to ~ points" (try 10000)
- Reduce "Point size" to 1
- Close other browser tabs
- Check browser console for errors

**CORS errors?**
- Use the file picker instead of default path
- Or serve via `npm run debug:vertices` (already configured)

## Next Steps

Once you can see vertex behavior:

1. **Hover over MH5 base flange/bolts**
2. **Note the values**:
   - in-frustum count
   - within-threshold count  
   - closest-px value
   - DPR
   - camera distance
3. **Take a screenshot** of the overlay
4. **Share with Cursor**: "When hovering over MH5 base, the harness shows: [values/screenshot]. Fix snapping accordingly."

The harness uses the **exact same projection logic** as your snapping system, so what you see here is what the snapping code sees.

## Integration with App

The app now has matching telemetry in `SnappingHelper.ts`:
- Look for `[SnapDiag]` logs in the browser console
- These show the same metrics as the harness
- Compare harness values with app values to identify discrepancies

