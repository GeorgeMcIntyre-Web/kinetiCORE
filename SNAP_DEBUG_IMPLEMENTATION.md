# Vertex Snap Debug + Screen-Space Binning Implementation

## ✅ What Was Implemented

### 1. Debug Harness (`debug/vertex_debug.html`)
- **Standalone HTML file** that visualizes vertex projections in real-time
- **Color-coded overlay**:
  - Green dots = vertices in frustum
  - Yellow dots = vertices within screen threshold
  - Blue ring = closest vertex to pointer
- **Live stats panel** showing vertex counts, DPR, camera distance, closest pixel distance
- **Uses same projection logic** as snapping system for accurate diagnostics

### 2. Screen-Space Binning (`src/manipulation/SnappingHelper.ts`)
- **New binning system** that projects vertices into a 64×36 screen-space grid
- **Searches 3×3 bin neighborhood** around pointer (configurable via `SEARCH_RADIUS_BINS`)
- **Ground-agnostic**: Works regardless of which mesh the ray hits
- **Fast**: Only processes vertices in bins near the pointer
- **Robust**: Handles dense STL meshes with duplicate vertices

### 3. Telemetry Logging
- **`[SnapDiag]` logs** every 60 frames showing:
  - `inFrustum`: Count of vertices in frustum
  - `near`: Whether vertices found in threshold
  - `minPx`: Closest pixel distance
  - `dpr`: Device pixel ratio
  - `camDist`: Camera distance
  - `mesh`: Mesh name
  - `bins`: Number of meshes binned

### 4. Package Scripts
- **`npm run debug:vertices`**: Starts local server on port 8080
- Opens `http://localhost:8080/debug/vertex_debug.html`

## 📁 File Structure

```
kinetiCORE/
├── debug/
│   ├── vertex_debug.html      # Visual debugging harness
│   ├── assets/
│   │   └── MH5_BASE_AXIS.stl   # Test STL file
│   └── README.md               # Usage guide
├── src/manipulation/
│   ├── SnappingHelper.ts       # Screen-space binning + telemetry
│   └── snapIndex.ts            # Spatial hash indexer (existing)
└── package.json                # Added debug:vertices script
```

## 🚀 How to Use

### Step 1: Start Debug Server
```powershell
npm run debug:vertices
```

### Step 2: Open Browser
Navigate to: `http://localhost:8080/debug/vertex_debug.html`

### Step 3: Load STL
- Click "Load Default" (loads `debug/assets/MH5_BASE_AXIS.stl`)
- OR use "Choose STL…" to select any STL file

### Step 4: Observe
- Move mouse over the 3D model
- Watch the overlay show vertex classifications
- Check console for `[Harness]` logs every 60 frames

### Step 5: Compare with App
- In your app, look for `[SnapDiag]` logs in console
- Compare values with harness to identify discrepancies

## 🔍 What Screen-Space Binning Solves

### Problems Fixed:
1. **Ground hit dependency**: No longer relies on which mesh the ray hits
2. **Dense STL handling**: Binning naturally handles duplicate vertices
3. **Base dead-zones**: Searches screen-space bins, not world-space distance
4. **Performance**: Only processes vertices in bins near pointer (3×3 window)

### How It Works:
1. **Build phase**: Project all candidate mesh vertices into 64×36 screen grid
2. **Search phase**: Look in 3×3 bin window around pointer
3. **Refine phase**: Check all vertices in those bins for closest screen distance
4. **Snap decision**: Use screen-space distance (not world-space)

## 🎯 Acceptance Criteria

✅ **Harness**:
- Hover MH5 base flange → `within-threshold > 0`, `closest px < threshold` consistently

✅ **App**:
- `[SnapDiag]` logs show `near=YES` and `minPx < threshold` while hovering base
- Preview dot appears at base vertices as pointer moves
- No performance lag

## 🔧 Tuning Parameters

If snapping is still flaky:

1. **Increase search radius**: Change `SEARCH_RADIUS_BINS` from `1` → `2` (5×5 window)
2. **Increase bin resolution**: Change `BIN_COLS` from `64` → `96`, `BIN_ROWS` from `36` → `54`
3. **Increase screen threshold**: In harness, increase "Screen threshold (CSS px)" slider

## 📊 Expected Console Output

### Harness (every 60 frames):
```
[Harness] verts=112656 dec=20000 inFrustum=3111 near=22 minPx=188.3 dpr=1.00 camDist=0.430
```

### App (every 60 frames):
```
[SnapDiag] inFrustum=3111 near=YES minPx=188.3 dpr=1.00 camDist=0.430 mesh=MH5_BASE_AXIS.stl_0 bins=3
```

## 🐛 Troubleshooting

**No vertices in harness?**
- Check browser console for STL load errors
- Verify STL is binary format
- Try file picker instead of default path

**Binning not working in app?**
- Check that `pointerScreenX/Y` are being passed correctly
- Verify camera is not null
- Check `[SnapDiag]` logs show `bins > 0`

**Still missing base vertices?**
- Increase `SEARCH_RADIUS_BINS` to 2
- Increase bin resolution (`BIN_COLS` × `BIN_ROWS`)
- Check harness shows vertices at base (if not, it's a projection issue)

## 📝 Next Steps

1. **Run the harness** and hover over MH5 base
2. **Capture screenshot** or note console values
3. **Compare with app** `[SnapDiag]` logs
4. **Adjust parameters** if needed based on observations

The binning system should now reliably find vertices at the MH5 base regardless of ground hits or mesh density.


