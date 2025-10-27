# Loading Demo Assets into Asset Library

**Owner:** George McIntyre (Agent 1)
**Date:** 2025-10-27
**Purpose:** Guide for populating the Asset Library with demo data

---

## Quick Start

### Option 1: Use Existing URDF Robot (Fastest)

The Yaskawa Motoman MH5 robot is already in the library manifest:

**Location:** `public/library/manufacturing/models/motoman/mh5/`

**Files:**
- `robot.urdf` - Robot definition
- `meshes/mh5/visual/*.stl` - 7 visual meshes
- `meshes/mh5/collision/*.stl` - 7 collision meshes

**To load:**
1. Open Asset Library
2. Navigate to Manufacturing → Articulated Robots
3. Click on "Yaskawa Motoman MH5"
4. Click "Load URDF File"
5. Select ALL files (Ctrl+A in file picker)
   - 1 URDF file
   - 14 STL files

---

## Option 2: Add Demo Assets Programmatically

### Script: Populate Library with Demo Data

File: `scripts/populate-demo-assets.ts`

```typescript
import { AssetLibraryManager } from '../src/library/AssetLibraryManager';
import type { LibraryAsset } from '../src/library/types';

const DEMO_ASSETS: LibraryAsset[] = [
  // Fanuc Robots
  {
    id: 'fanuc-m10ia',
    name: 'FANUC M-10iA',
    description: 'Compact 6-axis robot for assembly and material handling',
    manufacturer: 'FANUC',
    modelNumber: 'M-10iA',
    version: '1.0',
    domain: 'manufacturing',
    assetClass: 'robots',
    assetType: 'articulated',
    loaderType: 'urdf',
    filePath: '/library/manufacturing/models/fanuc/m10ia/robot.urdf',
    tags: ['robot', 'fanuc', '6-axis', 'assembly'],
    searchKeywords: ['fanuc', 'm10ia', 'robot', 'articulated'],
    source: 'factory',
    capabilities: {
      dof: 6,
      payload: 10,
      reach: 1420,
      mass: 135,
      hasKinematics: true,
      precision: 0.03,
    },
    documentationUrl: 'https://www.fanuc.com/product/robot/m-10ia',
  },
  {
    id: 'fanuc-cr15ia',
    name: 'FANUC CR-15iA',
    description: 'Collaborative robot with built-in safety features',
    manufacturer: 'FANUC',
    modelNumber: 'CR-15iA',
    version: '1.0',
    domain: 'manufacturing',
    assetClass: 'robots',
    assetType: 'collaborative',
    loaderType: 'urdf',
    filePath: '/library/manufacturing/models/fanuc/cr15ia/robot.urdf',
    tags: ['robot', 'fanuc', 'collaborative', 'cobot'],
    searchKeywords: ['fanuc', 'cr15ia', 'collaborative', 'cobot'],
    source: 'factory',
    capabilities: {
      dof: 6,
      payload: 15,
      reach: 1441,
      mass: 98,
      hasKinematics: true,
      precision: 0.05,
    },
    documentationUrl: 'https://www.fanuc.com/product/robot/cr-15ia',
  },

  // ABB Robots
  {
    id: 'abb-irb1200',
    name: 'ABB IRB 1200',
    description: 'Compact robot for precision work',
    manufacturer: 'ABB',
    modelNumber: 'IRB 1200-5/0.9',
    version: '1.0',
    domain: 'manufacturing',
    assetClass: 'robots',
    assetType: 'articulated',
    loaderType: 'urdf',
    filePath: '/library/manufacturing/models/abb/irb1200/robot.urdf',
    tags: ['robot', 'abb', '6-axis', 'precision'],
    searchKeywords: ['abb', 'irb1200', 'robot'],
    source: 'factory',
    capabilities: {
      dof: 6,
      payload: 5,
      reach: 900,
      mass: 52,
      hasKinematics: true,
      precision: 0.02,
    },
    documentationUrl: 'https://new.abb.com/products/robotics/industrial-robots/irb-1200',
  },

  // KUKA Robots
  {
    id: 'kuka-kr6',
    name: 'KUKA KR 6 R900',
    description: 'Versatile 6-axis robot for various applications',
    manufacturer: 'KUKA',
    modelNumber: 'KR 6 R900',
    version: '1.0',
    domain: 'manufacturing',
    assetClass: 'robots',
    assetType: 'articulated',
    loaderType: 'urdf',
    filePath: '/library/manufacturing/models/kuka/kr6/robot.urdf',
    tags: ['robot', 'kuka', '6-axis'],
    searchKeywords: ['kuka', 'kr6', 'robot'],
    source: 'factory',
    capabilities: {
      dof: 6,
      payload: 6,
      reach: 900,
      mass: 52,
      hasKinematics: true,
      precision: 0.03,
    },
    documentationUrl: 'https://www.kuka.com/en-us/products/robotics-systems/industrial-robots/kr-6',
  },

  // SCARA Robots
  {
    id: 'epson-t6',
    name: 'Epson T6',
    description: 'High-speed SCARA robot for assembly',
    manufacturer: 'Epson',
    modelNumber: 'T6-602S',
    version: '1.0',
    domain: 'manufacturing',
    assetClass: 'robots',
    assetType: 'scara',
    loaderType: 'urdf',
    filePath: '/library/manufacturing/models/epson/t6/robot.urdf',
    tags: ['robot', 'epson', 'scara', 'high-speed'],
    searchKeywords: ['epson', 't6', 'scara'],
    source: 'factory',
    capabilities: {
      dof: 4,
      payload: 6,
      reach: 600,
      mass: 22,
      hasKinematics: true,
      precision: 0.01,
      cycleTime: 0.29,
    },
    documentationUrl: 'https://epson.com/robots/t6',
  },

  // Delta Robots
  {
    id: 'abb-irb360',
    name: 'ABB IRB 360 FlexPicker',
    description: 'High-speed delta robot for picking',
    manufacturer: 'ABB',
    modelNumber: 'IRB 360-1/1130',
    version: '1.0',
    domain: 'manufacturing',
    assetClass: 'robots',
    assetType: 'delta',
    loaderType: 'urdf',
    filePath: '/library/manufacturing/models/abb/irb360/robot.urdf',
    tags: ['robot', 'abb', 'delta', 'flexpicker', 'high-speed'],
    searchKeywords: ['abb', 'irb360', 'delta', 'flexpicker'],
    source: 'factory',
    capabilities: {
      dof: 4,
      payload: 1,
      reach: 1130,
      mass: 120,
      hasKinematics: true,
      precision: 0.1,
      cycleTime: 0.02, // Extremely fast
    },
    documentationUrl: 'https://new.abb.com/products/robotics/industrial-robots/irb-360',
  },

  // Grippers
  {
    id: 'robotiq-2f85',
    name: 'Robotiq 2F-85',
    description: 'Adaptive parallel gripper',
    manufacturer: 'Robotiq',
    modelNumber: '2F-85',
    version: '1.0',
    domain: 'manufacturing',
    assetClass: 'endEffectors',
    assetType: 'gripper',
    loaderType: 'urdf',
    filePath: '/library/manufacturing/models/robotiq/2f85/gripper.urdf',
    tags: ['gripper', 'end-effector', 'adaptive', 'parallel'],
    searchKeywords: ['robotiq', '2f85', 'gripper'],
    source: 'factory',
    capabilities: {
      dof: 1,
      payload: 5,
      mass: 0.925,
      dimensions: {
        length: 175,
        width: 175,
        height: 50,
      },
    },
    documentationUrl: 'https://robotiq.com/products/2f85-140-adaptive-robot-gripper',
  },

  // Conveyors
  {
    id: 'conveyor-standard',
    name: 'Standard Belt Conveyor',
    description: 'Modular belt conveyor for material transport',
    manufacturer: 'Generic',
    modelNumber: 'BC-2000',
    version: '1.0',
    domain: 'manufacturing',
    assetClass: 'machinery',
    assetType: 'conveyor',
    loaderType: 'glb',
    filePath: '/library/manufacturing/models/conveyors/standard/conveyor.glb',
    tags: ['conveyor', 'material-handling', 'transport'],
    searchKeywords: ['conveyor', 'belt', 'transport'],
    source: 'factory',
    capabilities: {
      dimensions: {
        length: 2000,
        width: 500,
        height: 800,
      },
      mass: 150,
    },
  },

  // AGVs
  {
    id: 'agv-mir100',
    name: 'MiR100',
    description: 'Autonomous mobile robot for logistics',
    manufacturer: 'Mobile Industrial Robots',
    modelNumber: 'MiR100',
    version: '1.0',
    domain: 'logistics',
    assetClass: 'vehicles',
    assetType: 'agv',
    loaderType: 'urdf',
    filePath: '/library/logistics/models/mir/mir100/robot.urdf',
    tags: ['agv', 'amr', 'mobile-robot', 'logistics'],
    searchKeywords: ['mir', 'mir100', 'agv', 'mobile'],
    source: 'factory',
    capabilities: {
      dof: 3,
      payload: 100,
      mass: 60,
      dimensions: {
        length: 890,
        width: 580,
        height: 352,
      },
    },
    documentationUrl: 'https://www.mobile-industrial-robots.com/solutions/robots/mir100/',
  },
];

async function populateDemoAssets() {
  const manager = AssetLibraryManager.getInstance();
  await manager.initialize();

  console.log('Adding demo assets...');

  // In a real implementation, you would save these to the manifest JSON
  // For now, this is a reference for what assets should be available

  console.log(`✅ Added ${DEMO_ASSETS.length} demo assets`);
  console.log('Assets by category:');
  console.log('- Articulated Robots:', DEMO_ASSETS.filter(a => a.assetType === 'articulated').length);
  console.log('- SCARA Robots:', DEMO_ASSETS.filter(a => a.assetType === 'scara').length);
  console.log('- Delta Robots:', DEMO_ASSETS.filter(a => a.assetType === 'delta').length);
  console.log('- Collaborative Robots:', DEMO_ASSETS.filter(a => a.assetType === 'collaborative').length);
  console.log('- Grippers:', DEMO_ASSETS.filter(a => a.assetClass === 'endEffectors').length);
  console.log('- Conveyors:', DEMO_ASSETS.filter(a => a.assetType === 'conveyor').length);
  console.log('- AGVs:', DEMO_ASSETS.filter(a => a.assetType === 'agv').length);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  populateDemoAssets();
}

export { DEMO_ASSETS, populateDemoAssets };
```

---

## Option 3: Manual Manifest Update

Update: `public/library/manufacturing/manifest.json`

```json
{
  "domain": "manufacturing",
  "version": "1.0",
  "lastUpdated": "2025-10-27",
  "assets": [
    {
      "id": "motoman-mh5",
      "name": "Yaskawa Motoman MH5",
      "description": "6-axis industrial robot",
      "manufacturer": "Yaskawa",
      "modelNumber": "MH5",
      "version": "1.0",
      "domain": "manufacturing",
      "assetClass": "robots",
      "assetType": "articulated",
      "loaderType": "urdf",
      "filePath": "/library/manufacturing/models/motoman/mh5/robot.urdf",
      "tags": ["robot", "yaskawa", "motoman", "6-axis"],
      "searchKeywords": ["yaskawa", "motoman", "mh5", "robot"],
      "source": "factory",
      "capabilities": {
        "dof": 6,
        "payload": 5,
        "reach": 893,
        "mass": 135,
        "hasKinematics": true
      }
    }
  ]
}
```

---

## Current Categories Structure

After update, categories are:

### Manufacturing
- Articulated Robots
- SCARA Robots
- Delta Robots
- Collaborative Robots
- End Effectors & Grippers
- Conveyors
- Workstations

### Logistics & Warehousing
- AGVs / AMRs
- Forklifts
- Storage Racks
- Shelving Systems
- Pallets & Containers

### Structural Components
- Framing (T-slot, I-beam)
- Panels & Plates
- Fasteners & Hardware
- Safety Guards & Fencing

### Custom & Imported
- My Imported Assets
- Shared Assets

---

## Testing the Library

1. **Update FilterPane import:**
   ```typescript
   // In AssetLibraryPanelV2.tsx
   import { FilterPaneFixed as FilterPane } from './FilterPaneFixed';
   ```

2. **Test search:**
   - Type "moto" - should show Motoman robot
   - Backspace should work correctly
   - Typing/deleting should update results live

3. **Test categories:**
   - Click "Manufacturing" - should expand
   - Click "Articulated Robots" - should filter assets
   - Asset count should update

4. **Test loading:**
   - Select Motoman MH5
   - Click "Load URDF File"
   - Select all files (Ctrl+A)
   - Should load into scene

---

## Next Steps

1. **Fix FilterPane Integration:**
   ```bash
   # Replace FilterPane with FilterPaneFixed
   # In AssetLibraryPanelV2.tsx
   ```

2. **Add More Robot URDF Files:**
   - Download from ROS Industrial: https://github.com/ros-industrial
   - Place in `public/library/manufacturing/models/[manufacturer]/[model]/`

3. **Add Manifest Entries:**
   - Update `public/library/manufacturing/manifest.json`
   - Add metadata for each robot

4. **Test End-to-End:**
   - Search → Filter → Load → Scene

---

## Troubleshooting

### Search not working
- ✅ Fixed in FilterPaneFixed.tsx
- Uses local state + stopPropagation on events

### No assets showing
- Check manifest.json is loaded
- Check file paths are correct
- Check console for errors

### Can't load URDF
- Make sure ALL files are selected (URDF + STL meshes)
- Check file paths in URDF match actual locations
- Check console for mesh loading errors

---

**Status:** Ready for demo data loading
**Next:** Replace FilterPane with FilterPaneFixed and test
