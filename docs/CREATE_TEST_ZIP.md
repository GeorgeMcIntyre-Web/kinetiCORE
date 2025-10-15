# Create Test ZIP for MJCF + GLB Integration

**Date:** 2025-01-27  
**Owner:** AI Assistant  
**Status:** ✅ Ready for Testing  

## Quick Setup Guide

### 1. Create Your ZIP Structure

Create a ZIP file with this structure:

```
your_robot_model.zip
├── robot_model.xml          # Your MJCF file (primary)
└── assets/                  # GLB assets folder
    ├── UNIT_101.glb
    ├── UNIT_102.glb
    ├── UNIT_104L_F.glb
    ├── UNIT_104R_F.glb
    ├── UNIT_106_F.glb
    ├── UNIT_107_M.glb
    └── UNIT_108_M.glb
```

### 2. What Happens When You Import

When you import this ZIP through the "Import Model" button:

1. **MJCF Processing**: 
   - ✅ `robot_model.xml` is loaded with full kinematic data
   - ✅ Joints, actuators, and sensors are created
   - ✅ Physics properties are applied

2. **GLB Asset Processing**:
   - ✅ All GLB files in `assets/` folder are detected
   - ✅ Each GLB is loaded as a visual mesh
   - ✅ GLB meshes are integrated with the MJCF model
   - ✅ No kinematic data for GLB files (visual only)

3. **Console Output**:
```
[MJCF Import] Extracting ZIP file: your_robot_model.zip
[MJCF Import] Found MJCF file in ZIP: robot_model.xml
[MJCF Import] Detected robot model in: robot_model.xml
[MJCF Import] Selected primary MJCF file: robot_model.xml
[MJCF Import] Found mesh file in ZIP: UNIT_101.glb (from assets/UNIT_101.glb)
[MJCF Import] Found mesh file in ZIP: UNIT_102.glb (from assets/UNIT_102.glb)
[MJCF Import] Found mesh file in ZIP: UNIT_104L_F.glb (from assets/UNIT_104L_F.glb)
[MJCF Import] Found mesh file in ZIP: UNIT_104R_F.glb (from assets/UNIT_104R_F.glb)
[MJCF Import] Found mesh file in ZIP: UNIT_106_F.glb (from assets/UNIT_106_F.glb)
[MJCF Import] Found mesh file in ZIP: UNIT_107_M.glb (from assets/UNIT_107_M.glb)
[MJCF Import] Found mesh file in ZIP: UNIT_108_M.glb (from assets/UNIT_108_M.glb)
[MJCF Import] Extracted 7 mesh files from ZIP
[MJCF Import] Starting import of robot_model.xml (45.2KB)
[MJCF Import] Loading GLB file: UNIT_101.glb
[MJCF Import] Successfully loaded GLB: UNIT_101.glb (1 meshes)
[MJCF Import] Loading GLB file: UNIT_102.glb
[MJCF Import] Successfully loaded GLB: UNIT_102.glb (1 meshes)
... (repeated for each GLB file)
[MJCF Import] Loaded 5 joints, 3 actuators, 2 sensors
[MJCF Import] robot_model.xml loaded successfully - Model type: STL-based + GLB assets, Bodies: 8, Meshes: 7 (0 OBJ, 0 STL, 7 GLB), Joints: 5, Keyframes: None found
```

### 3. Expected Result

- ✅ **Full robot functionality** from MJCF file
- ✅ **High-quality visual representation** from GLB assets
- ✅ **All meshes appear in scene**
- ✅ **Kinematic controls work** for MJCF-defined joints
- ✅ **GLB assets are visual-only** (no kinematic controls)

## Testing Steps

1. **Create the ZIP file** with your MJCF + GLB assets
2. **Open kinetiCORE** in your browser
3. **Click "Import Model"** button
4. **Select your ZIP file**
5. **Watch the console** for loading progress
6. **Verify the result** in the 3D scene

## Troubleshooting

### If GLB files don't load:
- Check file extensions are `.glb` (not `.GLB`)
- Verify GLB files are not corrupted
- Check console for error messages

### If MJCF doesn't load:
- Ensure `robot_model.xml` is at the root of the ZIP
- Check MJCF file is valid XML
- Verify file references in MJCF match GLB filenames

### If nothing loads:
- Check ZIP file is not corrupted
- Verify ZIP contains both MJCF and GLB files
- Check browser console for errors

## What's Different Now

**Before**: GLB files in ZIP were ignored
**Now**: GLB files are loaded as visual assets alongside MJCF kinematic data

This gives you the best of both worlds:
- **Precise robot control** from MJCF
- **High-quality visuals** from GLB assets
