# How to Add New Assets to the Asset Library

**Complete guide for adding robots, equipment, and other 3D assets**

---

## Quick Overview

There are **3 ways** to add assets to the library:

1. **Import from file** → Load URDF/OBJ/GLTF, then save to library
2. **Add to manifest** → For factory/default assets
3. **Create in scene** → Build with primitives, save to library

---

## Method 1: Import from File (Recommended for New Assets)

### Step-by-Step:

#### 1. Load Asset into Scene

**For URDF Robots:**
```
File Menu → Import → URDF
→ Select robot.urdf + all .stl mesh files (Ctrl+A)
→ Robot loads into scene
```

**For OBJ Models:**
```
File Menu → Import → OBJ
→ Select .obj file (and .mtl if available)
→ Model loads into scene
```

**For GLTF/GLB Models:**
```
File Menu → Import → GLTF
→ Select .gltf or .glb file
→ Model loads into scene
```

#### 2. Position & Configure

```
1. Move asset to desired position
2. Test kinematics (if robot)
3. Verify appearance
4. Set materials/colors
```

#### 3. Save to Library

**Option A: Right-Click in Scene Tree**
```
Scene Tree → Right-click asset → "Save to Library"
→ Dialog appears:
   - Name: "FANUC M-10iA"
   - Description: "Compact 6-axis robot"
   - Category: "Robots" (or custom)
   - Tags: robot, fanuc, 6-axis
   - Visibility: Private / Public
→ Click "Save"
→ Asset now in library ✅
```

**Option B: Asset Library Panel**
```
1. Select asset in scene
2. Open Asset Library
3. Click "Save Selection to Library" button
4. Fill out metadata form
5. Save
```

#### 4. Verify in Library

```
Asset Library → My Assets → Imported
→ Your asset appears
→ Click to preview
→ Click "Add to Scene" to test loading
```

---

## Method 2: Add to Manifest (For Factory Assets)

For official library assets that ship with kinetiCORE.

### File Structure:

```
public/library/manufacturing/
├── manifest.json                    ← Main manifest
└── models/
    └── fanuc/
        └── m10ia/
            ├── robot.urdf           ← Robot definition
            ├── package.xml          ← Optional ROS package
            └── meshes/
                ├── visual/
                │   ├── base.stl
                │   ├── link1.stl
                │   └── ...
                └── collision/
                    ├── base.stl
                    └── ...
```

### Update Manifest:

**File:** `public/library/manufacturing/manifest.json`

```json
{
  "domain": "manufacturing",
  "version": "1.0",
  "lastUpdated": "2025-10-27",
  "assets": [
    {
      "id": "fanuc-m10ia",
      "name": "FANUC M-10iA",
      "description": "Compact 6-axis industrial robot for assembly and material handling",
      "manufacturer": "FANUC",
      "modelNumber": "M-10iA/12",
      "version": "1.0",
      "domain": "manufacturing",
      "assetClass": "robots",
      "assetType": "articulated",
      "loaderType": "urdf",
      "filePath": "/library/manufacturing/models/fanuc/m10ia/robot.urdf",
      "thumbnail": "/library/manufacturing/models/fanuc/m10ia/thumbnail.png",
      "tags": ["robot", "fanuc", "6-axis", "assembly", "material-handling"],
      "searchKeywords": ["fanuc", "m10ia", "m10", "robot", "articulated"],
      "source": "factory",
      "capabilities": {
        "dof": 6,
        "payload": 12,
        "reach": 1420,
        "mass": 135,
        "hasKinematics": true,
        "precision": 0.03,
        "dimensions": {
          "length": 800,
          "width": 800,
          "height": 1800
        }
      },
      "documentationUrl": "https://www.fanuc.com/product/robot/m-10ia",
      "license": "proprietary",
      "attribution": "FANUC Corporation"
    }
  ]
}
```

### Metadata Fields Explained:

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| `id` | ✅ | Unique identifier | `fanuc-m10ia` |
| `name` | ✅ | Display name | `FANUC M-10iA` |
| `description` | ✅ | Short description | `Compact 6-axis robot...` |
| `manufacturer` | ❌ | Manufacturer name | `FANUC` |
| `modelNumber` | ❌ | Model number | `M-10iA/12` |
| `version` | ✅ | Asset version | `1.0` |
| `domain` | ✅ | Domain category | `manufacturing` |
| `assetClass` | ✅ | Asset class | `robots` |
| `assetType` | ✅ | Specific type | `articulated` |
| `loaderType` | ✅ | File format | `urdf`, `obj`, `glb` |
| `filePath` | ✅ | Path to main file | `/library/.../robot.urdf` |
| `thumbnail` | ❌ | Preview image | `/library/.../thumb.png` |
| `tags` | ✅ | Search tags | `["robot", "fanuc"]` |
| `searchKeywords` | ✅ | Search terms | `["m10ia", "robot"]` |
| `capabilities` | ❌ | Technical specs | See below |
| `documentationUrl` | ❌ | Docs link | `https://...` |

### Capabilities Object:

```json
"capabilities": {
  "dof": 6,                    // Degrees of freedom
  "payload": 12,               // kg
  "reach": 1420,               // mm
  "mass": 135,                 // kg
  "hasKinematics": true,       // Has kinematic chain
  "precision": 0.03,           // ±mm repeatability
  "cycleTime": 0.35,           // seconds (optional)
  "dimensions": {              // mm
    "length": 800,
    "width": 800,
    "height": 1800
  },
  "powerRequirement": "3-phase 200-230V"  // (optional)
}
```

---

## Method 3: Create from Primitives

Build assets from basic shapes and save to library.

### Steps:

```
1. Create → Box/Sphere/Cylinder
2. Combine shapes into assembly
3. Set colors/materials
4. Group into collection
5. Right-click → "Save to Library"
6. Name it: "Custom Fixture 1"
7. Export as GLB to library
```

---

## Asset Types & Categories

### Asset Classes:

| assetClass | Description | Examples |
|-----------|-------------|----------|
| `robots` | All robots | Articulated, SCARA, Delta, Collaborative |
| `machinery` | Equipment | Conveyors, presses, CNC machines |
| `endEffectors` | End effectors | Grippers, suction cups, tools |
| `vehicles` | Mobile equipment | AGVs, forklifts, cranes |
| `structures` | Buildings | Racks, frames, panels, buildings |
| `tools` | Accessories | Sensors, fasteners, misc tools |
| `custom` | User-created | Imported or built in-scene |

### Asset Types (for robots):

| assetType | Description |
|-----------|-------------|
| `articulated` | 6-axis industrial robots |
| `scara` | SCARA robots (4-axis) |
| `delta` | Delta/parallel robots |
| `collaborative` | Collaborative robots (cobots) |
| `cartesian` | Cartesian/gantry robots |
| `parallel` | Other parallel mechanisms |

---

## Loading & Testing Assets

### Load from Library:

```
1. Open Asset Library (Ctrl+L)
2. Search or browse categories
3. Click asset thumbnail
4. Details pane shows specs
5. Click "Add to Scene"
6. Asset loads ✅
```

### Verify Asset Works:

**For Robots:**
```
✅ Kinematics work (joints move)
✅ Meshes visible
✅ No console errors
✅ TCP position correct
✅ Can save/load poses
```

**For Static Assets:**
```
✅ Mesh renders correctly
✅ Materials applied
✅ Physics collider (if needed)
✅ No missing textures
```

---

## Troubleshooting

### Asset Not Appearing in Library

**Check:**
1. Manifest syntax valid JSON
2. File paths correct (relative to `public/`)
3. Files actually exist at specified paths
4. Browser console for errors
5. Refresh asset library (click Reset button)

### URDF Robot Not Loading

**Common Issues:**
- Missing STL mesh files
- Incorrect mesh paths in URDF
- File encoding (UTF-8 required)
- URDF syntax errors

**Fix:**
```bash
# Validate URDF
roslaunch urdf_tutorial display.launch model:=robot.urdf

# Or use online validator
# https://mymodelrobot.appspot.com/5629499534213120
```

### Mesh Not Visible

**Check:**
- Mesh file format supported (STL, OBJ, GLTF)
- Mesh not at origin (0,0,0)
- Scale correct (meters in kinetiCORE)
- Normals facing outward
- Materials applied

---

## Best Practices

### File Organization:

```
public/library/
├── manufacturing/
│   ├── manifest.json
│   └── models/
│       ├── fanuc/
│       │   ├── m10ia/
│       │   └── ...
│       ├── abb/
│       └── kuka/
├── logistics/
│   ├── manifest.json
│   └── models/
└── custom/
    ├── my-imports/
    └── generated/
```

### Naming Conventions:

- **IDs:** lowercase-with-dashes (`fanuc-m10ia`)
- **Names:** Title Case (`FANUC M-10iA`)
- **Files:** lowercase_with_underscores (`robot.urdf`, `base_link.stl`)
- **Tags:** lowercase, singular (`robot`, `fanuc`, not `Robots`, `FANUC`)

### URDF Coordinate System:

kinetiCORE uses **ROS standard** (Z-up, right-handed):
- X: Forward
- Y: Left
- Z: Up

**No conversion needed** when importing ROS URDF files ✅

### File Size:

- **Meshes:** Keep under 5MB per STL
- **Textures:** Max 2K resolution (2048x2048)
- **Total:** Keep robot under 50MB total

---

## Example: Adding a New Robot

### Complete Workflow:

```bash
# 1. Download robot URDF
cd ~/Downloads
wget https://github.com/ros-industrial/fanuc/archive/refs/heads/melodic-devel.zip
unzip fanuc-melodic-devel.zip

# 2. Copy to kinetiCORE library
cd kinetiCORE
mkdir -p public/library/manufacturing/models/fanuc/m10ia
cp ~/Downloads/fanuc-melodic-devel/fanuc_m10ia_support/urdf/* \
   public/library/manufacturing/models/fanuc/m10ia/

# 3. Update manifest
# Edit public/library/manufacturing/manifest.json
# Add entry as shown above

# 4. Test
npm run dev
# Open browser → Asset Library → Search "FANUC"
# Click M-10iA → Load to scene ✅
```

---

## Quick Reference

### Add New Robot (URDF):
1. Copy URDF + meshes to `public/library/manufacturing/models/[manufacturer]/[model]/`
2. Update `manifest.json`
3. Test in Asset Library

### Add Custom Asset (Import):
1. Import file to scene
2. Right-click in Scene Tree → "Save to Library"
3. Fill metadata → Save
4. Find in "My Assets" category

### Categories:
- Use generic top-level: "Robots", "Equipment & Machinery", "Vehicles"
- Create custom categories with **[+]** button
- Filter by asset type checkboxes

---

## Next Steps

1. **Try loading the Motoman MH5 robot** (already in library)
2. **Import your own URDF** (follow Method 1)
3. **Create custom category** for your project
4. **Build assembly** from library assets

---

**Ready to add assets!** 🚀

See also:
- [LOADING_DEMO_ASSETS.md](LOADING_DEMO_ASSETS.md) - Demo robot catalog
- [ASSET_CATEGORY_REDESIGN.md](ASSET_CATEGORY_REDESIGN.md) - Category system
- [ASSET_LIBRARY_CRUD_IMPLEMENTATION.md](ASSET_LIBRARY_CRUD_IMPLEMENTATION.md) - CRUD operations
