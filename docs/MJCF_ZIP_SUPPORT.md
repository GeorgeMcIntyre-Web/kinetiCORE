# MJCF ZIP Archive Support

## Overview

Added ZIP file support to the MJCF (MuJoCo XML) loader, allowing users to upload a single ZIP file containing the MJCF XML and all mesh files, rather than selecting multiple files individually.

## Changes Made

### 1. MJCFLoader.ts

**Added JSZip import:**
```typescript
import JSZip from 'jszip';
```

**Added `extractZipFile` function** (lines 214-258):
- Extracts ZIP file contents using JSZip
- Finds MJCF XML file (`.xml` extension)
- Finds all mesh files (`.stl`, `.obj`, `.dae` extensions)
- Returns File objects for MJCF and Map of mesh files
- Handles nested directory structures (extracts basename)

**Updated `loadMJCFFromFile` function** (lines 272-276):
- Detects ZIP files by `.zip` extension
- Calls `extractZipFile` to unpack contents
- Recursively calls itself with extracted MJCF file and mesh files

### 2. ModelLoader.ts

**Updated format detection** (line 123):
```typescript
if (extension === '.xml' || extension === '.zip') {
```
Now treats ZIP files the same as XML files for MJCF loading.

## Usage

### Option 1: ZIP Archive (Recommended)
```
1. Click "Import Model"
2. Select unitree_g1.zip
3. Done! All mesh files are automatically extracted and loaded
```

### Option 2: Multiple Files (Alternative)
```
1. Click "Import Model"
2. Hold Ctrl and select:
   - g1_with_hands.xml
   - pelvis.STL
   - pelvis_contour_link.STL
   - ... (all 49 STL files)
3. Done!
```

## Console Output

When loading a ZIP file, you'll see:
```
[MJCF Import] Extracting ZIP file: unitree_g1.zip
[MJCF Import] Found MJCF file in ZIP: g1_with_hands.xml
[MJCF Import] Found mesh file in ZIP: pelvis.STL
[MJCF Import] Found mesh file in ZIP: pelvis_contour_link.STL
... (repeated for each mesh file)
[MJCF Import] Extracted 49 mesh files from ZIP
[MJCF Import] Starting import of g1_with_hands.xml (35.0KB)
... (normal MJCF loading continues)
```

## Technical Details

### Extraction Process
1. Read ZIP file as ArrayBuffer
2. Parse with JSZip
3. Iterate through all entries
4. Skip directories
5. Extract basename from paths (handles subdirectories)
6. Create File objects from Blob data
7. Build Map<string, File> for mesh files

### File Matching
- MJCF references meshes by name: `mesh="pelvis"`
- Assets define filenames: `<mesh name="pelvis" file="pelvis.STL"/>`
- Loader extracts basename from ZIP paths to match filenames
- Example: `assets/pelvis.STL` → `pelvis.STL`

### Error Handling
- Throws `MJCFImportError` if no XML file found in ZIP
- Continues with placeholder meshes if STL files missing
- Same error handling as non-ZIP loading

## Benefits

1. **Easier file distribution** - Single file instead of 50+ files
2. **Faster uploads** - Compressed file size
3. **No multi-select issues** - Works on all browsers/OS
4. **Preserves directory structure** - But extracts basenames correctly
5. **Backward compatible** - Multiple file selection still works

## Dependencies

- `jszip` (v3.10.1) - Already installed in project

## Testing

Test file location:
```
C:\Users\George\source\repos\kinetiCORE_DATA\MuJoCo\humanoids\unitree_g1.zip
```

See [TEST_MJCF_MESH_LOADING.md](../TEST_MJCF_MESH_LOADING.md) for detailed testing instructions.

## Future Enhancements

Possible improvements:
1. Support ZIP files with nested MJCF includes
2. Auto-detect mesh directory structure
3. Progress bar for large ZIP extraction
4. Drag-and-drop ZIP upload
5. Support for other robotics archives (ROS bags, etc.)
