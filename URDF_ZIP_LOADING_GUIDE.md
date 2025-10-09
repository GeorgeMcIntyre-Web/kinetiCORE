# URDF Zip File Loading Guide

## How to Load URDF Files with Mesh Files

The system now supports loading URDF files with all their mesh files from a single zip file. This eliminates the need for folder selection dialogs.

### Step 1: Create a Zip File

1. **Create a folder** containing:
   - Your URDF file (e.g., `m710ic70.urdf`)
   - All mesh files referenced in the URDF (e.g., STL files)
   - Maintain the folder structure as referenced in the URDF

2. **Example folder structure:**
   ```
   fanuc_robot/
   ├── m710ic70.urdf
   └── fanuc_m710ic_description/
       └── meshes/
           └── m710ic50/
               ├── visual/
               │   ├── base_link.stl
               │   ├── link_1.stl
               │   ├── link_2.stl
               │   ├── link_3.stl
               │   ├── link_4.stl
               │   ├── link_5.stl
               │   └── link_6.stl
               └── collision/
                   ├── base_link.stl
                   ├── link_1.stl
                   ├── link_2.stl
                   ├── link_3.stl
                   ├── link_4.stl
                   ├── link_5.stl
                   └── link_6.stl
   ```

3. **Zip the folder:**
   - Right-click on the folder
   - Select "Send to" → "Compressed (zipped) folder"
   - Or use any zip utility to create a zip file

### Step 2: Load the Zip File

1. **Click "Load File"** button in the toolbar
2. **Select your zip file** (e.g., `fanuc_robot.zip`)
3. **That's it!** The system will:
   - Automatically extract the zip file
   - Find the URDF file
   - Find all mesh files
   - Load the complete robot with real 3D meshes
   - Extract kinematics automatically

### Benefits

- ✅ **No folder selection** - just select one zip file
- ✅ **Automatic extraction** - system handles everything
- ✅ **Real 3D meshes** - loads actual STL files
- ✅ **Complete robot** - with kinematics and joint relationships
- ✅ **Portable** - easy to share and distribute

### Console Output

When loading successfully, you'll see:
```
[File Import] Zip file detected: fanuc_robot.zip
[Zip Loader] Parsing zip file: fanuc_robot.zip
[Zip Loader] Found URDF file: m710ic70.urdf
[Zip Loader] Found mesh file: base_link.stl
[Zip Loader] Found mesh file: link_1.stl
...
[Zip Loader] Successfully extracted URDF and 14 mesh files
[File Import] Successfully extracted URDF and 14 mesh files from zip
✅ Kinematics extracted from URDF
Loaded m710ic70 with 14 meshes
```

### Troubleshooting

- **No URDF found**: Make sure your zip contains at least one `.urdf` file
- **No meshes loaded**: Check that your STL files are in the correct folder structure as referenced in the URDF
- **Wrong mesh paths**: Ensure the folder structure in the zip matches the `package://` paths in the URDF file
