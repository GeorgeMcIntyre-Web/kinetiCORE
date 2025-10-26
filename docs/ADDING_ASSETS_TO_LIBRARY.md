# How to Add New Assets to the Asset Library

This guide explains how to add new devices, robots, or other 3D models to the kinetiCORE Asset Library.

## Overview

The Asset Library uses a **manifest-based system** where:
1. 3D model files are placed in organized folders
2. JSON manifest files describe each asset's metadata
3. The library automatically loads and indexes all assets

## Quick Start

To add a new asset, you need to:
1. ✅ Place your 3D model file in the appropriate domain folder
2. ✅ Add an entry to the domain's `manifest.json`
3. ✅ Update the main manifest's asset count
4. ✅ (Optional) Add thumbnail images

## File Structure

```
public/library/
├── manifest.json              # Main library index
├── manufacturing/
│   ├── manifest.json         # Manufacturing domain assets
│   └── models/               # 3D model files
│       ├── abb/
│       │   └── irb1200/
│       │       └── robot.urdf
│       └── fanuc/
│           └── m20ia/
│               └── robot.urdf
├── logistics/
│   └── manifest.json
├── medical/
│   └── manifest.json
└── construction/
    └── manifest.json
```

## Step-by-Step Guide

### Step 1: Choose the Domain

Pick the appropriate domain for your asset:
- `manufacturing` - Industrial robots, CNC machines, assembly equipment
- `logistics` - AGVs, conveyors, warehouse equipment, forklifts
- `medical` - Hospital beds, surgical robots, medical devices
- `construction` - Cranes, excavators, construction equipment
- `primitives` - Basic shapes (cube, sphere, cylinder)

### Step 2: Prepare Your 3D Model

**Supported Formats:**
- ✅ **GLB** (recommended) - Binary glTF, single file
- ✅ **GLTF** - Text-based glTF
- ✅ **URDF** - Robot Description Format (for robots with kinematics)
- ✅ **STL** - STereoLithography
- ✅ **OBJ** - Wavefront Object
- ⏳ **JT** - Coming soon
- ⏳ **STEP** - Coming soon

**Best Practices:**
- Use **GLB format** for best performance
- Keep file size under 10MB if possible
- Use proper units (kinetiCORE uses millimeters)
- Include materials/textures in GLB if possible

### Step 3: Place Your File

Create a folder structure for your asset:

```bash
# Example: Adding a new Fanuc robot
public/library/manufacturing/models/fanuc/m20ia/
├── robot.urdf          # Main model file
├── meshes/             # Mesh files (for URDF)
│   ├── base_link.stl
│   ├── link1.stl
│   └── ...
└── thumbnail.png       # Optional preview image
```

Or for a simple GLB:

```bash
# Example: Adding a conveyor belt
public/library/logistics/models/conveyors/
└── belt-conveyor-3m.glb
```

### Step 4: Add Manifest Entry

Open the domain's `manifest.json` and add your asset entry.

**Example: Adding a new robot to manufacturing/manifest.json**

```json
{
  "id": "my-new-robot",                    // Unique ID (lowercase, hyphens)
  "name": "My New Robot Model XYZ",        // Display name
  "manufacturer": "Acme Robotics",         // Manufacturer name
  "modelNumber": "XYZ-1000",               // Optional model number
  "domain": "manufacturing",               // Must match folder
  "assetClass": "robot",                   // Asset classification
  "assetType": "industrial-robot",         // Specific type
  "loaderType": "glb",                     // File format: glb, urdf, stl, obj
  "filePath": "/models/acme/xyz1000/robot.glb",  // Path from domain root
  "source": "manufacturer",                // Where it came from
  "tags": [
    "robot",
    "industrial",
    "6-axis",
    "welding"
  ],
  "searchKeywords": [
    "acme",
    "xyz1000",
    "welding",
    "robot"
  ],
  "description": "6-axis industrial welding robot, 25kg payload, 2000mm reach",
  "capabilities": {
    "hasKinematics": true,                 // Does it have moving joints?
    "dof": 6,                              // Degrees of freedom
    "payload": 25,                         // Max payload in kg
    "reach": 2000,                         // Max reach in mm
    "repeatability": 0.05,                 // Optional: position repeatability in mm
    "maxSpeed": 5.0,                       // Optional: max joint speed
    "collaborative": false,                // Is it a cobot?
    "dimensions": {                        // Optional: physical dimensions
      "length": 800,
      "width": 600,
      "height": 1500
    },
    "mass": 250,                           // Mass in kg
    "powerRequirement": "3-phase 400V",    // Optional
    "cycleTime": 15                        // Optional: typical cycle time in seconds
  },
  "documentationUrl": "https://acme.com/docs/xyz1000",  // Optional
  "thumbnail": "/models/acme/xyz1000/thumbnail.png",    // Optional
  "categories": [                          // Categorization
    "6-axis-arms"
  ]
}
```

### Step 5: Update Asset Count

After adding your entry, update the `totalAssets` count in the domain manifest:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-26T12:00:00.000Z",
  "totalAssets": 42,   // ← Increment this
  "assets": [
    // ... your assets
  ]
}
```

Also update the main `public/library/manifest.json`:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-26T12:00:00.000Z",
  "totalAssets": 66,   // ← Increment this
  "domains": [
    {
      "id": "manufacturing",
      "name": "Manufacturing & Robotics",
      "assetCount": 42,  // ← Update domain count
      "manifestPath": "manufacturing/manifest.json"
    },
    // ... other domains
  ]
}
```

### Step 6: Verify Your Asset

1. **Rebuild the project:**
   ```bash
   npm run build
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Open Asset Library:**
   - Navigate to http://localhost:5173
   - Open the Asset Library panel
   - Search for your new asset
   - Click to preview
   - Click "Add to Scene" to test loading

## Asset Entry Reference

### Required Fields

```typescript
{
  id: string;              // Unique identifier (lowercase-with-hyphens)
  name: string;            // Display name
  domain: string;          // Domain: manufacturing, logistics, medical, etc.
  assetClass: string;      // Class: robot, equipment, structure, etc.
  loaderType: string;      // Loader: glb, urdf, stl, obj, gltf
  filePath: string;        // Path to model file
  tags: string[];          // Searchable tags
  categories: string[];    // Category classification
}
```

### Optional Fields

```typescript
{
  manufacturer?: string;
  modelNumber?: string;
  assetType?: string;
  source?: string;
  searchKeywords?: string[];
  description?: string;
  thumbnail?: string;
  documentationUrl?: string;
  capabilities?: {
    hasKinematics?: boolean;
    dof?: number;
    payload?: number;
    reach?: number;
    repeatability?: number;
    maxSpeed?: number;
    collaborative?: boolean;
    dimensions?: { length: number; width: number; height: number };
    mass?: number;
    powerRequirement?: string;
    cycleTime?: number;
    precision?: number;
  };
}
```

## Common Asset Classes

### Robots
- `assetClass: "robot"`
- `assetType: "industrial-robot" | "collaborative-robot" | "scara" | "delta" | "cartesian"`
- Use `loaderType: "urdf"` for robots with kinematics

### Equipment
- `assetClass: "equipment"`
- `assetType: "cnc-machine" | "conveyor" | "gripper" | "tool"`
- Use `loaderType: "glb"` for static equipment

### Structures
- `assetClass: "structures"`
- `assetType: "building" | "rack" | "table" | "wall"`
- Use `loaderType: "glb"` for buildings/structures

### Vehicles
- `assetClass: "vehicle"`
- `assetType: "agv" | "forklift" | "crane" | "amr"`
- Use `loaderType: "glb"` or `urdf` with kinematics

## Examples

### Example 1: Simple GLB Asset

```json
{
  "id": "pallet-standard",
  "name": "Standard EUR Pallet",
  "manufacturer": "Generic",
  "domain": "logistics",
  "assetClass": "structures",
  "assetType": "pallet",
  "loaderType": "glb",
  "filePath": "/models/pallets/eur-pallet.glb",
  "source": "library",
  "tags": ["pallet", "logistics", "warehouse"],
  "searchKeywords": ["pallet", "eur", "euro"],
  "description": "Standard EUR pallet, 1200x800x144mm",
  "capabilities": {
    "dimensions": {
      "length": 1200,
      "width": 800,
      "height": 144
    },
    "mass": 25
  }
}
```

### Example 2: Robot with URDF

```json
{
  "id": "ur10e",
  "name": "Universal Robots UR10e",
  "manufacturer": "Universal Robots",
  "modelNumber": "UR10e",
  "domain": "manufacturing",
  "assetClass": "robot",
  "assetType": "collaborative-robot",
  "loaderType": "urdf",
  "filePath": "/models/universal_robots/ur10e/robot.urdf",
  "source": "manufacturer",
  "tags": ["robot", "collaborative", "cobot", "6-axis"],
  "searchKeywords": ["ur10e", "cobot", "universal", "robots"],
  "description": "6-axis collaborative robot, 12.5kg payload, 1300mm reach",
  "capabilities": {
    "hasKinematics": true,
    "dof": 6,
    "payload": 12.5,
    "reach": 1300,
    "repeatability": 0.05,
    "collaborative": true,
    "powerRequirement": "100-240V AC",
    "mass": 33.5
  },
  "documentationUrl": "https://www.universal-robots.com/products/ur10-robot/",
  "thumbnail": "/models/universal_robots/ur10e/thumbnail.png"
}
```

### Example 3: Medical Device

```json
{
  "id": "surgical-robot-davinci",
  "name": "da Vinci Surgical System",
  "manufacturer": "Intuitive Surgical",
  "domain": "medical",
  "assetClass": "robot",
  "assetType": "surgical-robot",
  "loaderType": "glb",
  "filePath": "/models/intuitive/davinci/system.glb",
  "source": "manufacturer",
  "tags": ["surgical", "robot", "medical", "precision"],
  "searchKeywords": ["davinci", "surgical", "robot", "intuitive"],
  "description": "Multi-arm robotic surgical system with 3D visualization",
  "capabilities": {
    "hasKinematics": true,
    "dof": 28,
    "precision": 0.1,
    "powerRequirement": "120V AC"
  },
  "documentationUrl": "https://www.intuitive.com/products/davinci"
}
```

## Testing Your Asset

After adding your asset, test it thoroughly:

### 1. Search Test
```bash
# In Asset Library search bar, type:
- Asset name
- Manufacturer name
- Tags/keywords
```

### 2. Load Test
- Click the asset card
- Verify specifications display correctly
- Click "Add to Scene"
- Confirm asset loads without errors
- Check camera auto-frames the asset

### 3. Visual Test
- Verify thumbnail displays (if provided)
- Check 3D preview renders correctly
- Ensure materials/textures appear properly

## Troubleshooting

### Asset Not Appearing in Library

**Check:**
1. ✅ Manifest JSON is valid (no syntax errors)
2. ✅ `filePath` is correct and file exists
3. ✅ Asset count updated in both domain and main manifest
4. ✅ Domain ID matches folder name
5. ✅ Rebuild project: `npm run build`

### Asset Won't Load

**Check:**
1. ✅ `loaderType` matches file extension
2. ✅ File path is accessible from public folder
3. ✅ For URDF: all mesh files referenced exist
4. ✅ Check browser console for errors

### Thumbnail Not Displaying

**Check:**
1. ✅ Thumbnail path starts with `/` (absolute path)
2. ✅ Image file exists in public folder
3. ✅ Image format is PNG, JPG, or WebP
4. ✅ Image dimensions reasonable (e.g., 256x256)

## Advanced Topics

### Adding a New Domain

If you need a completely new domain (e.g., "agriculture"):

1. Create folder: `public/library/agriculture/`
2. Create: `public/library/agriculture/manifest.json`
3. Add domain entry to main `public/library/manifest.json`
4. Follow standard asset addition process

### Batch Adding Assets

For adding many assets at once:

1. Prepare all 3D model files
2. Create a script or use JSON editor
3. Add all entries to manifest
4. Update counts
5. Test with: `npm run dev`

### Using External URLs

You can reference models from external URLs:

```json
{
  "filePath": "https://cdn.example.com/models/robot.glb",
  "loaderType": "glb"
}
```

Note: CORS headers must be properly configured on external server.

## Best Practices

1. ✅ **Use descriptive IDs** - `abb-irb1200` not `robot1`
2. ✅ **Add comprehensive tags** - Helps users find assets
3. ✅ **Include specifications** - Payload, reach, DOF, etc.
4. ✅ **Provide thumbnails** - Better UX
5. ✅ **Test before committing** - Always verify loading works
6. ✅ **Document sources** - Credit manufacturers/creators
7. ✅ **Keep file sizes reasonable** - <10MB preferred
8. ✅ **Use proper units** - Millimeters for dimensions

## Need Help?

- Check existing assets in `public/library/manufacturing/manifest.json` for examples
- See type definitions in `src/library/types.ts`
- Review Asset Library code in `src/library/AssetLibraryManager.ts`

## Quick Checklist

Before committing your new asset:

- [ ] 3D model file placed in correct folder
- [ ] Manifest entry added with all required fields
- [ ] Asset count updated in domain manifest
- [ ] Asset count updated in main manifest
- [ ] Tested in dev mode (`npm run dev`)
- [ ] Asset appears in library
- [ ] Asset loads successfully
- [ ] Thumbnail displays (if provided)
- [ ] Specifications display correctly
- [ ] Search/filter works with tags

---

**Happy asset adding!** 🎨🤖
