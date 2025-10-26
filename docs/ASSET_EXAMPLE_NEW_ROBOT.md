# Example: Adding a New Robot to Asset Library

## Real-World Example: Adding a Doosan M0609 Robot

Let's walk through adding a complete new robot step-by-step.

### What We're Adding
- **Robot:** Doosan M0609
- **Type:** 6-axis collaborative robot
- **File:** GLB format
- **Domain:** Manufacturing

---

## Step 1: Prepare Your File

You have a file: `doosan-m0609.glb`

Place it in:
```
public/library/manufacturing/models/doosan/m0609/robot.glb
```

## Step 2: Open the Manifest

Open: `public/library/manufacturing/manifest.json`

## Step 3: Add the Entry

Add this entry to the `assets` array:

```json
{
  "id": "doosan-m0609",
  "name": "Doosan M0609",
  "manufacturer": "Doosan Robotics",
  "modelNumber": "M0609",
  "domain": "manufacturing",
  "assetClass": "robot",
  "assetType": "collaborative-robot",
  "loaderType": "glb",
  "filePath": "/models/doosan/m0609/robot.glb",
  "source": "manufacturer",
  "tags": [
    "robot",
    "collaborative",
    "cobot",
    "6-axis",
    "precision"
  ],
  "searchKeywords": [
    "doosan",
    "m0609",
    "cobot",
    "collaborative"
  ],
  "description": "Compact 6-axis collaborative robot, 6kg payload, 900mm reach, ideal for precision assembly tasks",
  "capabilities": {
    "hasKinematics": true,
    "dof": 6,
    "payload": 6,
    "reach": 900,
    "repeatability": 0.05,
    "collaborative": true,
    "dimensions": {
      "length": 350,
      "width": 350,
      "height": 870
    },
    "mass": 24,
    "powerRequirement": "100-240V AC",
    "cycleTime": 12
  },
  "documentationUrl": "https://www.doosanrobotics.com/en/products/series/m0609",
  "categories": [
    "6-axis-arms"
  ]
}
```

## Step 4: Update Counts

In `public/library/manufacturing/manifest.json`, change:
```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-26T12:30:00.000Z",
  "totalAssets": 42,  // ← Was 41, now 42
  "assets": [
    // ... all your assets including new one
  ]
}
```

In `public/library/manifest.json`, change:
```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-26T12:30:00.000Z",
  "totalAssets": 66,  // ← Was 65, now 66
  "domains": [
    {
      "id": "manufacturing",
      "name": "Manufacturing & Robotics",
      "assetCount": 42,  // ← Was 41, now 42
      "manifestPath": "manufacturing/manifest.json"
    },
    // ... other domains
  ]
}
```

## Step 5: Test It

```bash
# Rebuild
npm run build

# Start dev server
npm run dev
```

Open browser → Asset Library → Search "Doosan" → Should see your robot!

## Step 6: Commit

```bash
git add public/library/
git commit -m "feat: Add Doosan M0609 collaborative robot to asset library"
git push origin main
```

---

## Quick Copy-Paste Template

Here's a blank template you can copy and fill in:

```json
{
  "id": "YOUR-ROBOT-ID",
  "name": "Display Name Here",
  "manufacturer": "Manufacturer Name",
  "modelNumber": "MODEL-123",
  "domain": "manufacturing",
  "assetClass": "robot",
  "assetType": "industrial-robot",
  "loaderType": "glb",
  "filePath": "/models/YOUR-BRAND/YOUR-MODEL/robot.glb",
  "source": "manufacturer",
  "tags": [
    "robot",
    "industrial",
    "6-axis"
  ],
  "searchKeywords": [
    "keyword1",
    "keyword2"
  ],
  "description": "Brief description of the robot",
  "capabilities": {
    "hasKinematics": true,
    "dof": 6,
    "payload": 10,
    "reach": 1000,
    "repeatability": 0.05,
    "mass": 50
  },
  "categories": [
    "6-axis-arms"
  ]
}
```

Just fill in the values and you're done!

---

## Common Values Reference

### Asset Types
- `"industrial-robot"` - Traditional industrial robots
- `"collaborative-robot"` - Cobots, safe for human interaction
- `"scara"` - SCARA robots (Selective Compliance Assembly Robot Arm)
- `"delta"` - Delta/parallel robots
- `"cartesian"` - Cartesian/gantry robots

### Loader Types
- `"glb"` - Best for most cases (single file, binary)
- `"gltf"` - Text-based glTF
- `"urdf"` - For robots with kinematics (requires mesh files)
- `"stl"` - For simple meshes
- `"obj"` - For meshes with textures

### Categories (Manufacturing Domain)
- `"6-axis-arms"` - 6-axis robots
- `"scara-arms"` - SCARA robots
- `"grippers"` - End effectors
- `"conveyors"` - Conveyor systems

### Tags (Common)
- `"robot"`, `"industrial"`, `"collaborative"`, `"cobot"`
- `"6-axis"`, `"4-axis"`, `"scara"`, `"delta"`
- `"welding"`, `"assembly"`, `"palletizing"`, `"picking"`
- `"precision"`, `"high-speed"`, `"heavy-duty"`

---

That's it! Your new robot is now in the Asset Library! 🎉
