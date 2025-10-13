# How to Load MJCF Files with STL Meshes

## Problem
MJCF files reference external STL mesh files, but browsers cannot access your local file system for security reasons.

## Solution: Upload Directory with All Files

### Method 1: Drag & Drop Folder (Recommended)
1. **Open the MJCF directory** in File Explorer:
   - Example: `C:\Users\George\source\repos\kinetiCORE_DATA\MuJoCo\humanoids\unitree_g1\`

2. **Select ALL files** in the directory:
   - The `.xml` MJCF file
   - The `assets/` folder with all `.STL` files
   - Or select the parent folder containing everything

3. **Drag the entire folder** onto the kinetiCORE upload area

### Method 2: Use Directory Upload
1. Click the upload button in kinetiCORE
2. **Enable "Select Folder" or "Choose Directory"** if your browser supports it
3. Select the folder containing:
   - The MJCF `.xml` file
   - All referenced `.STL` files

### What Happens
- kinetiCORE will:
  1. Parse the MJCF XML file
  2. Extract mesh references from `<asset>` tags
  3. Look for matching `.STL` files in the uploaded files
  4. Load actual 3D geometry from the STL files
  5. Display the complete robot model

## Expected Results

✅ **Success**: You'll see blue 3D meshes loaded from actual STL files
❌ **Failure**: You'll see blue wireframe boxes (STL file not found)

### Console Messages

**Working Correctly:**
```
[MJCF Import] Using 49 uploaded mesh files
[MJCF Import] Found mesh asset: "pelvis" -> "pelvis.STL"
[MJCF Import] Loading STL from File object: pelvis.STL (125634 bytes)
[MJCF Import] ✅ Successfully loaded STL mesh: pelvis.STL (1 meshes, 5432 vertices)
```

**Missing Files:**
```
[MJCF Import] Found mesh asset: "pelvis" -> "pelvis.STL"
[MJCF Import] Loading STL from URL: assets/pelvis.STL
[MJCF Import] Failed to load STL pelvis.STL, creating blue placeholder
```

## File Structure Example

```
unitree_g1/
├── g1_with_hands.xml          ← MJCF file
└── assets/                     ← Mesh directory (meshdir="assets")
    ├── pelvis.STL
    ├── torso_link.STL
    ├── left_hip_pitch_link.STL
    └── ... (49 total STL files)
```

## Current Limitations

- You must upload **all files together** (MJCF + STLs)
- Individual file upload won't work - need directory upload
- Browser security prevents automatic file discovery

## Future Improvements (To Be Implemented)

1. **Better file picker** - Automatically request all files in directory
2. **File caching** - Remember uploaded meshes for reuse
3. **Public folder support** - Copy meshes to `public/assets/` for URL access
