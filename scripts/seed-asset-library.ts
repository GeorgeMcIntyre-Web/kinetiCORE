/**
 * Asset Library Seeding Script
 * Owner: Agent 4
 * 
 * Populates the asset library with demo assets to reach 50+ target
 * 
 * Usage:
 *   npx tsx scripts/seed-asset-library.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ========================================
// Asset Definitions
// ========================================

/**
 * Gripper Assets (10 total) - PRIORITY 1
 */
const gripperAssets = [
  {
    id: 'schunk-pgn-plus-p-100',
    name: 'Schunk PGN-plus-P 100',
    manufacturer: 'Schunk',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'parallel-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/schunk/pgn_plus_p_100/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'parallel', 'electric', 'schunk'],
    searchKeywords: ['schunk', 'gripper', 'parallel', 'electric'],
    description: 'Electric parallel gripper, 100mm stroke, 2000N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 2000,
      stroke: 100,
      weight: 2.5
    }
  },
  {
    id: 'schunk-mpg-plus-80',
    name: 'Schunk MPG-plus 80',
    manufacturer: 'Schunk',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'parallel-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/schunk/mpg_plus_80/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'parallel', 'pneumatic', 'schunk'],
    searchKeywords: ['schunk', 'gripper', 'parallel', 'pneumatic'],
    description: 'Pneumatic parallel gripper, 80mm stroke, 1500N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 1500,
      stroke: 80,
      weight: 1.8
    }
  },
  {
    id: 'robotiq-2f-85',
    name: 'Robotiq 2F-85',
    manufacturer: 'Robotiq',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'adaptive-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/robotiq/2f_85/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'adaptive', 'electric', 'robotiq', 'collaborative'],
    searchKeywords: ['robotiq', 'gripper', 'adaptive', '2f-85'],
    description: 'Adaptive 2-finger gripper, 85mm stroke, 235N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 235,
      stroke: 85,
      weight: 0.9,
      collaborative: true
    }
  },
  {
    id: 'robotiq-2f-140',
    name: 'Robotiq 2F-140',
    manufacturer: 'Robotiq',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'adaptive-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/robotiq/2f_140/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'adaptive', 'electric', 'robotiq', 'collaborative'],
    searchKeywords: ['robotiq', 'gripper', 'adaptive', '2f-140'],
    description: 'Adaptive 2-finger gripper, 140mm stroke, 125N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 125,
      stroke: 140,
      weight: 1.0,
      collaborative: true
    }
  },
  {
    id: 'robotiq-hand-e',
    name: 'Robotiq Hand-E',
    manufacturer: 'Robotiq',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'adaptive-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/robotiq/hand_e/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'adaptive', 'electric', 'robotiq', 'collaborative'],
    searchKeywords: ['robotiq', 'hand-e', 'gripper', 'collaborative'],
    description: 'Compact adaptive gripper, 50mm stroke, 130N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 130,
      stroke: 50,
      weight: 0.65,
      collaborative: true
    }
  },
  {
    id: 'onrobot-rg2',
    name: 'OnRobot RG2',
    manufacturer: 'OnRobot',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'parallel-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/onrobot/rg2/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'parallel', 'electric', 'onrobot', 'collaborative'],
    searchKeywords: ['onrobot', 'rg2', 'gripper', 'parallel'],
    description: 'Electric parallel gripper, 110mm stroke, 120N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 120,
      stroke: 110,
      weight: 0.78,
      collaborative: true
    }
  },
  {
    id: 'onrobot-rg6',
    name: 'OnRobot RG6',
    manufacturer: 'OnRobot',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'parallel-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/onrobot/rg6/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'parallel', 'electric', 'onrobot', 'collaborative'],
    searchKeywords: ['onrobot', 'rg6', 'gripper', 'parallel'],
    description: 'Electric parallel gripper, 160mm stroke, 200N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 200,
      stroke: 160,
      weight: 0.93,
      collaborative: true
    }
  },
  {
    id: 'zimmer-gep2000',
    name: 'Zimmer GEP2000',
    manufacturer: 'Zimmer',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'parallel-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/zimmer/gep2000/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'parallel', 'pneumatic', 'zimmer'],
    searchKeywords: ['zimmer', 'gep2000', 'gripper', 'parallel'],
    description: 'Pneumatic parallel gripper, 24mm stroke, 2000N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 2000,
      stroke: 24,
      weight: 1.2
    }
  },
  {
    id: 'festo-dhps-parallel',
    name: 'Festo DHPS Parallel Gripper',
    manufacturer: 'Festo',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'parallel-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/festo/dhps/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'parallel', 'pneumatic', 'festo'],
    searchKeywords: ['festo', 'dhps', 'gripper', 'parallel'],
    description: 'Pneumatic parallel gripper, 20mm stroke, 1800N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 1800,
      stroke: 20,
      weight: 0.95
    }
  },
  {
    id: 'smc-mhz2-parallel',
    name: 'SMC MHZ2 Parallel Gripper',
    manufacturer: 'SMC',
    domain: 'manufacturing',
    assetClass: 'gripper',
    assetType: 'parallel-gripper',
    loaderType: 'urdf',
    filePath: '/models/grippers/smc/mhz2/gripper.urdf',
    source: 'manufacturer',
    tags: ['gripper', 'parallel', 'pneumatic', 'smc'],
    searchKeywords: ['smc', 'mhz2', 'gripper', 'parallel'],
    description: 'Pneumatic parallel gripper, 16mm stroke, 1500N force',
    capabilities: {
      hasKinematics: true,
      dof: 1,
      gripForce: 1500,
      stroke: 16,
      weight: 0.75
    }
  }
];

/**
 * Factory Fixture Assets (13 total) - PRIORITY 1
 */
const fixtureAssets = [
  // Safety Fencing (3 variants)
  {
    id: 'safety-fence-straight-2m',
    name: 'Safety Fence Panel 2m',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'safety-fence',
    loaderType: 'gltf',
    filePath: '/models/fixtures/safety_fence_straight_2m.gltf',
    source: 'generic',
    tags: ['safety', 'fence', 'barrier', 'fixture'],
    searchKeywords: ['safety fence', 'barrier', 'guard'],
    description: 'Straight safety fence panel, 2000x1800mm, yellow',
    capabilities: { hasKinematics: false, length: 2000, height: 1800 }
  },
  {
    id: 'safety-fence-corner',
    name: 'Safety Fence Corner',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'safety-fence',
    loaderType: 'gltf',
    filePath: '/models/fixtures/safety_fence_corner.gltf',
    source: 'generic',
    tags: ['safety', 'fence', 'corner', 'fixture'],
    searchKeywords: ['safety fence', 'corner', 'barrier'],
    description: 'Corner safety fence panel, 1800mm height, yellow',
    capabilities: { hasKinematics: false, height: 1800 }
  },
  {
    id: 'safety-fence-gate',
    name: 'Safety Fence Gate',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'safety-fence',
    loaderType: 'gltf',
    filePath: '/models/fixtures/safety_fence_gate.gltf',
    source: 'generic',
    tags: ['safety', 'fence', 'gate', 'fixture'],
    searchKeywords: ['safety fence', 'gate', 'access'],
    description: 'Safety fence gate with lock, 1000x1800mm, yellow',
    capabilities: { hasKinematics: true, width: 1000, height: 1800 }
  },

  // Tool Racks (2 variants)
  {
    id: 'tool-rack-wall-mount',
    name: 'Wall-Mount Tool Rack',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'tool-rack',
    loaderType: 'gltf',
    filePath: '/models/fixtures/tool_rack_wall.gltf',
    source: 'generic',
    tags: ['tool', 'rack', 'storage', 'fixture'],
    searchKeywords: ['tool rack', 'storage', 'organization'],
    description: 'Wall-mount tool rack, 1200x600mm, 20 tool capacity',
    capabilities: { hasKinematics: false, capacity: 20 }
  },
  {
    id: 'tool-rack-mobile',
    name: 'Mobile Tool Rack',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'tool-rack',
    loaderType: 'gltf',
    filePath: '/models/fixtures/tool_rack_mobile.gltf',
    source: 'generic',
    tags: ['tool', 'rack', 'mobile', 'storage', 'fixture'],
    searchKeywords: ['tool rack', 'mobile', 'cart'],
    description: 'Mobile tool rack with wheels, 800x500mm, 15 tool capacity',
    capabilities: { hasKinematics: true, capacity: 15 }
  },

  // Part Bins (3 variants)
  {
    id: 'part-bin-small',
    name: 'Small Part Bin',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'part-bin',
    loaderType: 'gltf',
    filePath: '/models/fixtures/part_bin_small.gltf',
    source: 'generic',
    tags: ['bin', 'parts', 'storage', 'fixture'],
    searchKeywords: ['part bin', 'storage', 'container'],
    description: 'Stackable part bin, 300x200x150mm, plastic',
    capabilities: { hasKinematics: false, volume: 9 }
  },
  {
    id: 'part-bin-medium',
    name: 'Medium Part Bin',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'part-bin',
    loaderType: 'gltf',
    filePath: '/models/fixtures/part_bin_medium.gltf',
    source: 'generic',
    tags: ['bin', 'parts', 'storage', 'fixture'],
    searchKeywords: ['part bin', 'storage', 'container'],
    description: 'Stackable part bin, 400x300x200mm, plastic',
    capabilities: { hasKinematics: false, volume: 24 }
  },
  {
    id: 'part-bin-large',
    name: 'Large Part Bin',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'part-bin',
    loaderType: 'gltf',
    filePath: '/models/fixtures/part_bin_large.gltf',
    source: 'generic',
    tags: ['bin', 'parts', 'storage', 'fixture'],
    searchKeywords: ['part bin', 'storage', 'container'],
    description: 'Stackable part bin, 600x400x300mm, plastic',
    capabilities: { hasKinematics: false, volume: 72 }
  },

  // Assembly Jigs (2 variants)
  {
    id: 'assembly-jig-basic',
    name: 'Basic Assembly Jig',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'assembly-jig',
    loaderType: 'gltf',
    filePath: '/models/fixtures/assembly_jig_basic.gltf',
    source: 'generic',
    tags: ['jig', 'assembly', 'fixture'],
    searchKeywords: ['assembly jig', 'fixture', 'assembly'],
    description: 'Basic assembly jig with clamps, 500x500mm base',
    capabilities: { hasKinematics: true }
  },
  {
    id: 'assembly-jig-rotary',
    name: 'Rotary Assembly Jig',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'assembly-jig',
    loaderType: 'gltf',
    filePath: '/models/fixtures/assembly_jig_rotary.gltf',
    source: 'generic',
    tags: ['jig', 'assembly', 'rotary', 'fixture'],
    searchKeywords: ['assembly jig', 'rotary', 'fixture'],
    description: 'Rotary assembly jig, 360° rotation, 400mm diameter',
    capabilities: { hasKinematics: true, rotation: 360 }
  },

  // Workstation Tables (2 variants)
  {
    id: 'assembly-table-esd',
    name: 'ESD Assembly Table',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'workstation',
    loaderType: 'gltf',
    filePath: '/models/fixtures/assembly_table_esd.gltf',
    source: 'generic',
    tags: ['table', 'assembly', 'esd', 'fixture'],
    searchKeywords: ['assembly table', 'esd', 'workstation'],
    description: 'ESD-safe assembly table, 1500x900mm, adjustable height',
    capabilities: { hasKinematics: true }
  },
  {
    id: 'inspection-table',
    name: 'Inspection Table',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'workstation',
    loaderType: 'gltf',
    filePath: '/models/fixtures/inspection_table.gltf',
    source: 'generic',
    tags: ['table', 'inspection', 'quality', 'fixture'],
    searchKeywords: ['inspection table', 'quality control'],
    description: 'Inspection table with lighting, 1200x800mm',
    capabilities: { hasKinematics: false }
  },

  // Storage Cabinet (1 variant)
  {
    id: 'storage-cabinet-industrial',
    name: 'Industrial Storage Cabinet',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'fixture',
    assetType: 'storage',
    loaderType: 'gltf',
    filePath: '/models/fixtures/storage_cabinet.gltf',
    source: 'generic',
    tags: ['cabinet', 'storage', 'fixture'],
    searchKeywords: ['storage cabinet', 'tool cabinet'],
    description: 'Industrial storage cabinet, 1000x500x2000mm, lockable',
    capabilities: { hasKinematics: true, shelves: 5 }
  }
];

/**
 * Additional Conveyor Assets (3 total) - PRIORITY 2
 */
const conveyorAssets = [
  {
    id: 'conveyor-chain-4m',
    name: 'Chain Conveyor 4m',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'material-handling',
    assetType: 'conveyor',
    loaderType: 'gltf',
    filePath: '/models/conveyors/chain_conveyor_4m.gltf',
    source: 'generic',
    tags: ['conveyor', 'chain', 'material-handling'],
    searchKeywords: ['chain conveyor', 'material handling'],
    description: '4-meter chain conveyor, 800mm width, heavy-duty',
    capabilities: {
      hasKinematics: false,
      length: 4000,
      width: 800,
      maxLoad: 500
    }
  },
  {
    id: 'conveyor-belt-6m',
    name: 'Belt Conveyor 6m',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'material-handling',
    assetType: 'conveyor',
    loaderType: 'gltf',
    filePath: '/models/conveyors/belt_conveyor_6m.gltf',
    source: 'generic',
    tags: ['conveyor', 'belt', 'material-handling'],
    searchKeywords: ['belt conveyor', 'material handling'],
    description: '6-meter belt conveyor, 600mm width, variable speed',
    capabilities: {
      hasKinematics: false,
      length: 6000,
      width: 600,
      maxLoad: 300
    }
  },
  {
    id: 'conveyor-spiral',
    name: 'Spiral Conveyor',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'material-handling',
    assetType: 'conveyor',
    loaderType: 'gltf',
    filePath: '/models/conveyors/spiral_conveyor.gltf',
    source: 'generic',
    tags: ['conveyor', 'spiral', 'vertical', 'material-handling'],
    searchKeywords: ['spiral conveyor', 'vertical conveyor'],
    description: 'Spiral conveyor, 3m height, 1.5m diameter, vertical transport',
    capabilities: {
      hasKinematics: false,
      height: 3000,
      diameter: 1500,
      maxLoad: 200
    }
  }
];

/**
 * Mobile/Humanoid Robot Assets (6 total) - PRIORITY 2
 */
const mobileRobotAssets = [
  {
    id: 'boston-dynamics-spot',
    name: 'Boston Dynamics Spot',
    manufacturer: 'Boston Dynamics',
    domain: 'manufacturing',
    assetClass: 'robot',
    assetType: 'quadruped',
    loaderType: 'mjcf',
    filePath: '/models/robots/boston_dynamics/spot/robot.xml',
    source: 'manufacturer',
    tags: ['robot', 'quadruped', 'mobile', 'boston-dynamics'],
    searchKeywords: ['spot', 'boston dynamics', 'quadruped', 'dog robot'],
    description: 'Quadruped mobile robot, 12 DOF, autonomous navigation',
    capabilities: {
      hasKinematics: true,
      dof: 12,
      maxSpeed: 1.6,
      payload: 14
    }
  },
  {
    id: 'unitree-go1',
    name: 'Unitree Go1',
    manufacturer: 'Unitree',
    domain: 'manufacturing',
    assetClass: 'robot',
    assetType: 'quadruped',
    loaderType: 'mjcf',
    filePath: '/models/robots/unitree/go1/robot.xml',
    source: 'manufacturer',
    tags: ['robot', 'quadruped', 'mobile', 'unitree'],
    searchKeywords: ['unitree', 'go1', 'quadruped', 'robot dog'],
    description: 'Quadruped mobile robot, 12 DOF, AI-powered',
    capabilities: {
      hasKinematics: true,
      dof: 12,
      maxSpeed: 3.5,
      payload: 5
    }
  },
  {
    id: 'turtlebot3-burger',
    name: 'TurtleBot3 Burger',
    manufacturer: 'ROBOTIS',
    domain: 'manufacturing',
    assetClass: 'robot',
    assetType: 'mobile-robot',
    loaderType: 'urdf',
    filePath: '/models/robots/turtlebot3/burger/robot.urdf',
    source: 'open-source',
    tags: ['robot', 'mobile', 'ros', 'turtlebot'],
    searchKeywords: ['turtlebot', 'ros', 'mobile robot', 'research'],
    description: 'Compact mobile robot platform, ROS-compatible, education/research',
    capabilities: {
      hasKinematics: true,
      dof: 2,
      maxSpeed: 0.22,
      diameter: 138
    }
  },
  {
    id: 'humanoid-generic',
    name: 'Generic Humanoid',
    manufacturer: 'Generic',
    domain: 'manufacturing',
    assetClass: 'robot',
    assetType: 'humanoid',
    loaderType: 'mjcf',
    filePath: '/models/robots/humanoid/generic/robot.xml',
    source: 'generic',
    tags: ['robot', 'humanoid', 'fullbody', 'ik'],
    searchKeywords: ['humanoid', 'bipedal', 'full-body ik'],
    description: 'Generic humanoid robot for IK testing, 28 DOF',
    capabilities: {
      hasKinematics: true,
      dof: 28,
      height: 1700,
      fullBodyIK: true
    }
  },
  {
    id: 'nao-robot',
    name: 'NAO Humanoid',
    manufacturer: 'SoftBank Robotics',
    domain: 'manufacturing',
    assetClass: 'robot',
    assetType: 'humanoid',
    loaderType: 'urdf',
    filePath: '/models/robots/softbank/nao/robot.urdf',
    source: 'manufacturer',
    tags: ['robot', 'humanoid', 'educational', 'nao'],
    searchKeywords: ['nao', 'humanoid', 'softbank', 'educational'],
    description: 'Educational humanoid robot, 25 DOF, 574mm height',
    capabilities: {
      hasKinematics: true,
      dof: 25,
      height: 574,
      fullBodyIK: true
    }
  },
  {
    id: 'pepper-robot',
    name: 'Pepper Humanoid',
    manufacturer: 'SoftBank Robotics',
    domain: 'manufacturing',
    assetClass: 'robot',
    assetType: 'humanoid',
    loaderType: 'urdf',
    filePath: '/models/robots/softbank/pepper/robot.urdf',
    source: 'manufacturer',
    tags: ['robot', 'humanoid', 'service', 'pepper'],
    searchKeywords: ['pepper', 'humanoid', 'softbank', 'service robot'],
    description: 'Service humanoid robot, 20 DOF, 1210mm height, mobile base',
    capabilities: {
      hasKinematics: true,
      dof: 20,
      height: 1210,
      mobile: true
    }
  }
];

// ========================================
// Seeding Functions
// ========================================

/**
 * Update domain manifest with new assets
 */
function updateDomainManifest(
  domainPath: string,
  newAssets: any[],
  domainName: string
): void {
  const manifestPath = path.join(domainPath, 'manifest.json');

  // Read existing manifest
  let manifest: any = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    totalAssets: 0,
    assets: []
  };

  if (fs.existsSync(manifestPath)) {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  }

  // Add new assets (avoid duplicates)
  const existingIds = new Set(manifest.assets.map((a: any) => a.id));
  const assetsToAdd = newAssets.filter(a => !existingIds.has(a.id));

  manifest.assets.push(...assetsToAdd);
  manifest.totalAssets = manifest.assets.length;
  manifest.lastUpdated = new Date().toISOString();

  // Write back
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`✅ Updated ${domainName} manifest: +${assetsToAdd.length} assets (total: ${manifest.totalAssets})`);
}

/**
 * Update main manifest with new asset counts
 */
function updateMainManifest(publicLibraryPath: string): void {
  const manifestPath = path.join(publicLibraryPath, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.warn('⚠️ Main manifest not found, creating new one');
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);

  // Recalculate asset counts for each domain
  let totalAssets = 0;
  for (const domain of manifest.domains) {
    const domainManifestPath = path.join(publicLibraryPath, domain.manifestPath);
    if (fs.existsSync(domainManifestPath)) {
      const domainManifest = JSON.parse(fs.readFileSync(domainManifestPath, 'utf-8'));
      domain.assetCount = domainManifest.totalAssets;
      totalAssets += domain.assetCount;
    }
  }

  manifest.totalAssets = totalAssets;
  manifest.lastUpdated = new Date().toISOString();

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`✅ Updated main manifest: ${totalAssets} total assets`);
}

/**
 * Create new domain if it doesn't exist
 */
function ensureDomainExists(
  publicLibraryPath: string,
  domainId: string,
  domainName: string
): string {
  const domainPath = path.join(publicLibraryPath, domainId);

  if (!fs.existsSync(domainPath)) {
    fs.mkdirSync(domainPath, { recursive: true });
    console.log(`📁 Created new domain: ${domainId}`);
  }

  // Check if domain is in main manifest
  const mainManifestPath = path.join(publicLibraryPath, 'manifest.json');
  const mainManifest = JSON.parse(fs.readFileSync(mainManifestPath, 'utf-8'));

  const domainExists = mainManifest.domains.some((d: any) => d.id === domainId);
  if (!domainExists) {
    mainManifest.domains.push({
      id: domainId,
      name: domainName,
      assetCount: 0,
      manifestPath: `${domainId}/manifest.json`
    });
    fs.writeFileSync(mainManifestPath, JSON.stringify(mainManifest, null, 2), 'utf-8');
    console.log(`📋 Added ${domainId} to main manifest`);
  }

  return domainPath;
}

/**
 * Main seeding function
 */
function seedAssetLibrary(): void {
  console.log('🌱 Starting asset library seeding...\n');

  const publicLibraryPath = path.join(process.cwd(), 'public', 'library');

  // Ensure public/library exists
  if (!fs.existsSync(publicLibraryPath)) {
    console.error('❌ Error: public/library directory not found');
    process.exit(1);
  }

  // 1. Add Gripper Assets
  console.log('\n📦 Adding Gripper Assets (10)...');
  const manufacturingPath = ensureDomainExists(publicLibraryPath, 'manufacturing', 'Manufacturing & Robotics');
  updateDomainManifest(manufacturingPath, gripperAssets, 'Manufacturing');

  // 2. Add Factory Fixture Assets
  console.log('\n🏭 Adding Factory Fixture Assets (13)...');
  updateDomainManifest(manufacturingPath, fixtureAssets, 'Manufacturing');

  // 3. Add Conveyor Assets
  console.log('\n🔄 Adding Additional Conveyor Assets (3)...');
  updateDomainManifest(manufacturingPath, conveyorAssets, 'Manufacturing');

  // 4. Add Mobile/Humanoid Robots
  console.log('\n🤖 Adding Mobile/Humanoid Robot Assets (6)...');
  updateDomainManifest(manufacturingPath, mobileRobotAssets, 'Manufacturing');

  // 5. Update main manifest
  console.log('\n📊 Updating main manifest...');
  updateMainManifest(publicLibraryPath);

  console.log('\n✅ Asset library seeding complete!');
  console.log('\nSummary:');
  console.log('  - Grippers: +10 assets');
  console.log('  - Fixtures: +13 assets');
  console.log('  - Conveyors: +3 assets');
  console.log('  - Mobile/Humanoid Robots: +6 assets');
  console.log('  - TOTAL: +32 new assets\n');
}

// ========================================
// Run Seeding
// ========================================

// ESM-compatible entry point
seedAssetLibrary();

export { seedAssetLibrary };
