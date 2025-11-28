# Vertex Debug Harness - Visual Snapping Diagnostics

## Quick Start

1. **Copy the STL file** to the same directory as `vertex_debug.html`:
   ```
   cp public/library/manufacturing/models/motoman/mh5/meshes/mh5/visual/MH5_BASE_AXIS.stl ./MH5_BASE_AXIS.stl
   ```

2. **Open in browser**: Double-click `vertex_debug.html` or open it in Chrome/Firefox

3. **Load the STL**:
   - Click "Load Default" (if file is at `./MH5_BASE_AXIS.stl`), OR
   - Click "Choose STL…" and select your file

4. **Move your mouse** over the 3D model - the overlay will show:
   - **Green dots**: Vertices inside frustum
   - **Yellow dots**: Vertices within screen threshold (default 500px)
   - **Blue ring**: Closest vertex to pointer

## What to Look For

### If snapping fails at the base:

1. **Check "in frustum" count**: Should be > 0 when hovering over base
   - If 0: Vertices are being culled incorrectly
   - If very low: Frustum check is too strict

2. **Check "within threshold" count**: Should increase as you get closer
   - If stays 0: Threshold is too low or projection is wrong
   - Try increasing "Screen threshold (CSS px)" to 1000-2000

3. **Check "closest px"**: Should drop to < 100px when hovering directly over base
   - If stays > 500px: Projection anchor is wrong (not using pointerX/Y)
   - If jumps around: Vertex deduplication or index issues

4. **Check DPR**: Should match your monitor's device pixel ratio
   - If wrong: Hardware scaling issue

5. **Check camera distance**: Should be reasonable (0.1-2.0m for close inspection)
   - If too far: Increase zoom
   - If too close: Vertices may be behind near plane

## Adjusting Parameters

- **Screen threshold**: Increase if vertices aren't being detected (try 1000-2000px)
- **Decimate to ~ points**: Increase for more detail (try 50000-100000 for dense meshes)
- **Point size**: Increase to see dots better (try 3-5)

## Console Output

Every 60 frames, the console logs:
- Total vertices (raw)
- Decimated count
- In-frustum count
- Within-threshold count
- Closest pixel distance
- DPR
- Camera distance

## Troubleshooting

**No vertices showing?**
- Check console for STL load errors
- Try using file picker instead of default path
- Check that STL file is binary format (not ASCII)

**Vertices show but no yellow/blue?**
- Increase "Screen threshold" slider
- Check that you're hovering over the actual mesh (not empty space)
- Zoom in closer to the mesh

**Performance issues?**
- Reduce "Decimate to ~ points" (try 10000)
- Reduce "Point size" to 1
- Close other browser tabs

## Next Steps

Once you can see the vertex behavior:

1. **Screenshot the overlay** when hovering over the base
2. **Note the console values** (in-frustum, within-threshold, closest-px)
3. **Share with Cursor**: "Here's what the debug harness shows when hovering over MH5 base: [screenshot/values]. Fix the snapping accordingly."

The harness uses the **exact same projection logic** as your snapping system, so what you see here is what the snapping code sees.


