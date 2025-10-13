# Testing MJCF Mesh Loading

## Implementation Summary

The system now supports loading MJCF files with real STL mesh geometry in two ways:
1. ✅ **ZIP Archive** (Recommended) - Upload a single `.zip` file containing MJCF + all mesh files
2. Multiple File Selection - Upload MJCF XML + all STL files together (requires Ctrl+Click)

## Test Instructions

### Method 1: ZIP File (RECOMMENDED)

1. Click "Import Model" button in kinetiCORE
2. Select the ZIP file: `C:\Users\George\source\repos\kinetiCORE_DATA\MuJoCo\humanoids\unitree_g1.zip`
3. The loader will automatically:
   - Extract all files from ZIP
   - Find the MJCF XML file
   - Find all STL mesh files
   - Load the robot with real geometry

**Console Output:**
```
[MJCF Import] Extracting ZIP file: unitree_g1.zip
[MJCF Import] Found MJCF file in ZIP: g1_with_hands.xml
[MJCF Import] Found mesh file in ZIP: pelvis.STL
[MJCF Import] Found mesh file in ZIP: pelvis_contour_link.STL
... (49 mesh files)
[MJCF Import] Extracted 49 mesh files from ZIP
```

### Method 2: Multiple File Selection (ALTERNATIVE)

### Step 1: Select Multiple Files

1. Click the "Import Model" button in kinetiCORE
2. In the file picker, **select multiple files**:
   - The MJCF XML file: `g1_with_hands.xml`
   - ALL the STL files from the `assets/` folder

**How to select multiple files:**
- Windows: Hold `Ctrl` and click each file
- Mac: Hold `Cmd` and click each file
- Or: Click first file, hold `Shift`, click last file

### Step 2: Verify Upload

Check the browser console for these messages:

```
[File Upload] Model: g1_with_hands.xml, Mesh files: 49
[EditorStore] Passing 49 mesh files to loader
[ModelLoader] Converted 49 mesh files to map
[MJCF Import] Using 49 uploaded mesh files
```

### Step 3: Check Mesh Loading

For each mesh, you should see:

**✅ SUCCESS (Real STL loaded):**
```
[MJCF Import] Looking up mesh asset: "pelvis"
[MJCF Import] Found mesh asset: "pelvis" -> "pelvis.STL"
[MJCF Import] Loading STL from File object: pelvis.STL (125634 bytes)
[MJCF Import] ✅ Successfully loaded STL mesh: pelvis.STL (1 meshes, 5432 vertices)
```

**❌ FAILURE (File not found):**
```
[MJCF Import] Looking up mesh asset: "pelvis"
[MJCF Import] Found mesh asset: "pelvis" -> "pelvis.STL"
[MJCF Import] Failed to load STL pelvis.STL, creating blue placeholder
```

### Step 4: Visual Verification

**What you should see:**
- 🔵 **Blue solid meshes** = Real STL geometry loaded successfully
- 🔵 **Blue wireframe boxes** = STL file not found, placeholder created
- ⬜ **Gray boxes** = Not a mesh type (collision geometry, etc.)

## Expected Results

With all 49 STL files uploaded:
- ✅ All robot parts should show as blue solid 3D meshes
- ✅ Robot should have proper geometry (not primitive boxes)
- ✅ Console should show "Successfully loaded STL mesh" for each part

## Troubleshooting

### Problem: Still seeing gray boxes

**Cause:** Mesh files not being passed through
**Solution:** Check console for "[File Upload] Mesh files: X" message

### Problem: Blue wireframe boxes

**Cause:** STL file names don't match MJCF references
**Solution:**
1. Check console error for filename
2. Verify the STL file is included in upload
3. Ensure filename matches exactly (case-sensitive!)

### Problem: No mesh files detected

**Cause:** File input doesn't have `multiple` attribute
**Solution:** Verify `EssentialModeLayout.tsx` line 618 has `multiple` attribute

## File Structure Required

```
Upload these files together:
├── g1_with_hands.xml           ← MJCF file (required)
└── From assets/ folder:
    ├── pelvis.STL
    ├── pelvis_contour_link.STL
    ├── left_hip_pitch_link.STL
    ├── left_hip_roll_link.STL
    └── ... (49 total STL files)
```

## Code Flow

```
User selects multiple files
    ↓
EssentialModeLayout.handleFileChange()
    ↓
editorStore.importModel(mjcfFile, stlFiles[])
    ↓
ModelLoader.loadModelFromFile(mjcfFile, scene, stlFiles[])
    ↓
MJCFLoader.loadMJCFFromFile(mjcfFile, scene, meshFilesMap)
    ↓
For each geometry:
    1. Detect type='mesh' (from mesh attribute)
    2. Look up mesh name in assets → get STL filename
    3. Find STL file in meshFilesMap
    4. Load as Blob URL with Babylon.js
    5. Apply blue material
    6. Display real 3D geometry
```

## Next Steps

If this works:
- ✅ MJCF loading is complete
- ✅ Ready to test with Unitree G1 robot
- ✅ Can extend to other MJCF models

If this doesn't work:
- Check console logs at each step
- Verify file input has `multiple` attribute
- Confirm STL files are being detected
