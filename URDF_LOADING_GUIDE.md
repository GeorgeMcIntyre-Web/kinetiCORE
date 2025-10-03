# kinetiCORE - URDF Robot Loading Guide

**Complete Guide to Loading URDF Files with STL Meshes**

---

## 🎯 Quick Start

### **Method 1: Load Entire Folder** ⭐ RECOMMENDED

1. **Open kinetiCORE** at: http://localhost:5178
2. **Look for TWO buttons** under IMPORT in Toolbar:
   - 📤 **Load File** (for single files)
   - 📁 **Load Folder** (for URDF with meshes)
3. **Click "Load Folder"**
4. **Select your URDF folder**:
   ```
   C:\Users\georgem\source\repos\kinetiCORE_data\urdf\fanuc\urdf
   ```
5. **Robot loads with STL meshes!** ✅

### **Method 2: Load Single File** (Placeholders Only)

1. Click **"Load File"**
2. Select just the `.urdf` file
3. Robot loads with **orange wireframe placeholders**
4. Console shows which STL files are needed

---

## 📂 Your Fanuc Robot Structure

```
C:\Users\georgem\source\repos\kinetiCORE_data\urdf\fanuc\
└── urdf/                                    ← SELECT THIS FOLDER
    ├── m710ic70.urdf                        ← URDF file
    └── fanuc_m710ic_description/
        └── meshes/
            └── m710ic50/
                ├── visual/
                │   ├── base_link.stl        ← Referenced meshes
                │   ├── link_1.stl
                │   ├── link_2.stl
                │   ├── link_3.stl
                │   ├── link_4.stl
                │   ├── link_5.stl
                │   └── link_6.stl
                └── collision/
                    └── (collision meshes)
```

---

## 🔍 URDF Path Matching

### **How References Work:**

Your URDF contains:
```xml
<mesh filename="package://fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl"/>
```

The loader:
1. **Strips** `package://` prefix
2. **Searches** for: `fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl`
3. **Matches** against uploaded file paths
4. **Finds**: `urdf/fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl`
5. **Loads** the STL file ✅

### **Matching Strategies (in order):**

The loader tries multiple strategies to find meshes:

1. **Exact match** - Full path matches exactly
2. **Filename only** - Just `link_1.stl`
3. **Case-insensitive** - Ignores case differences
4. **Ends with** - Path ends with the URDF path
5. **Contains** - Path contains the URDF path
6. **Structure match** - Last 2+ components match (e.g., `visual/link_1.stl`)

---

## 🖥️ Console Output Examples

### **✅ SUCCESS - Folder Upload with Meshes:**

```
Found URDF: m710ic70.urdf
Total files: 15
File map created with paths:
  - urdf/m710ic70.urdf
  - urdf/fanuc_m710ic_description/meshes/m710ic50/visual/base_link.stl
  - urdf/fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl
  - urdf/fanuc_m710ic_description/meshes/m710ic50/visual/link_2.stl
  ... etc

Looking for mesh: fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl
  Searching for: fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl
  ✓ Found (contains): urdf/fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl

✓ URDF loaded: 7 meshes created
```

### **⚠️ PLACEHOLDERS - Single File Upload:**

```
Parsed URDF: {robotName: 'm710ic70', links: Array(10), joints: Array(9)}
⚠️ URDF References External Mesh Files:
The following mesh files need to be in the correct paths:
  - package://fanuc_m710ic_description/meshes/m710ic50/visual/base_link.stl
  - package://fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl
  ... etc
💡 Tip: Place STL/DAE files relative to the URDF file location
For now, placeholders (small boxes) will be created.
```

---

## 🎨 Visual Indicators

| Mesh Type | Appearance | Meaning |
|-----------|------------|---------|
| **Solid gray** | Normal 3D mesh | ✅ STL file loaded successfully |
| **Orange wireframe** | Semi-transparent | ⚠️ Placeholder (no STL in folder) |
| **Red wireframe** | Semi-transparent | ❌ File not found in upload |
| **Green box/cylinder** | Solid primitive | ✅ Primitive geometry (defined in URDF) |

---

## 🐛 Troubleshooting

### **Problem: "No URDF file found"**
**Solution:** Make sure the folder contains a `.urdf` file

### **Problem: Only see "Load File" button (no "Load Folder")**
**Solutions:**
1. Refresh page: `Ctrl+R` or `F5`
2. Hard refresh: `Ctrl+Shift+R`
3. Clear cache and refresh
4. Check you're on the correct port: http://localhost:5178

### **Problem: Robot has placeholders (orange wireframes)**
**Cause:** Used "Load File" instead of "Load Folder"
**Solution:** Use "Load Folder" button to upload entire directory

### **Problem: Some links missing (red wireframes)**
**Solutions:**
1. Check console for "✗ Not found" messages
2. Verify STL files are in the selected folder
3. Try selecting the parent folder (e.g., `fanuc/` instead of `fanuc/urdf/`)

### **Problem: Console shows "Total files: 1"**
**Cause:** Browser didn't upload all files from folder
**Solutions:**
1. Use Chrome or Edge (Firefox/Safari have limited folder support)
2. Select the folder, not individual files
3. Make sure you clicked "Select Folder" in the file picker

---

## 🌐 Browser Compatibility

| Browser | Folder Upload | Status |
|---------|---------------|--------|
| **Chrome** | ✅ Full support | Recommended |
| **Edge** | ✅ Full support | Recommended |
| **Opera** | ✅ Full support | Works |
| **Firefox** | ⚠️ Limited | May not upload files |
| **Safari** | ❌ No support | Use Chrome/Edge |

---

## 📊 What Gets Loaded

When you load the Fanuc M-710iC/70 robot:

```
✅ 1 URDF file (m710ic70.urdf)
✅ 7 visual STL meshes (base_link + links 1-6)
✅ 7 collision STL meshes (optional, if present)
✅ 9 joints (with types, axes, limits)
✅ 10 links (with inertial properties)
✅ Complete robot hierarchy
✅ Ready for kinematics simulation
```

---

## 🔧 Technical Details

### **Files Created:**

1. **URDFLoader.ts** - Parses URDF XML, creates placeholders
2. **URDFLoaderWithMeshes.ts** - Loads URDF + STL files from folder
3. **editorStore.ts** - Added `importURDFFolder()` function
4. **Toolbar.tsx** - Added "Load Folder" button with folder input

### **How Folder Upload Works:**

```typescript
// HTML5 folder input
<input
  type="file"
  webkitdirectory=""  // Non-standard but widely supported
  multiple
  onChange={handleFolderChange}
/>

// Browser uploads ALL files in folder
// Each file has: file.name and file.webkitRelativePath
// Loader creates a Map<path, File> for fast lookups
```

### **Path Normalization:**

```typescript
// URDF says: package://fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl
// Loader strips: fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl
// Uploaded as: urdf/fanuc_m710ic_description/meshes/m710ic50/visual/link_1.stl
// Match found! ✅
```

---

## 🚀 Next Steps

After loading your robot:

1. **Explore in 3D viewport** - Rotate, zoom, pan
2. **Open Kinematics Panel** - Click "Setup" under KINEMATICS
3. **Ground the base** - Make link immovable
4. **Create joints** - Define motion relationships
5. **Test motion** - Simulate robot movement
6. **Export scene** - Save your configured robot

---

## 📝 Summary

| Feature | Single File | Folder Upload |
|---------|------------|---------------|
| **Button** | Load File 📤 | Load Folder 📁 |
| **Visual** | Placeholders | Real STL meshes |
| **Setup** | None | Browser folder select |
| **Browsers** | All | Chrome/Edge only |
| **Use Case** | Quick preview | Production work |

**Always use "Load Folder" for working with URDF robots that have external mesh files!**

---

**Last Updated:** 2025-10-03
**Port:** http://localhost:5178 (check console for current port)
**Status:** ✅ Production Ready
