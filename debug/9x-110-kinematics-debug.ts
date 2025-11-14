/**
 * 9X_110_GEO Kinematics Debug Page
 * 
 * Loads the GLB model + rigid-clusters JSON + units JSON (or joint-segmentation JSON for backward compat)
 * - Colors meshes by units (each unit gets unique color)
 * - Visualizes joint axes and origins
 * - Exposes window.kinDebug API to scrub joint values and inspect units
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { DEFAULT_TOOLING_CONFIG } from '../src/dev/tooling/ToolingConfig';
import type { KinematicUnit, KinematicJoint, UnitFeatures } from '../src/dev/tooling/MechanicalModel';

type RigidClusterJson = {
  id: number;
  name: string;
  type: 'base' | 'unit' | 'loose';
  attachedToBaseId: number | null;
  meshNames: string[];
  bbox: { min: [number, number, number]; max: [number, number, number] };
};

type RigidClustersData = {
  clusters: RigidClusterJson[];
};

// New units.json format
type UnitsData = {
  links: Array<{ id: string; clusterIds: string[] }>;
  joints: KinematicJoint[];
  units: KinematicUnit[];
};

type UnitFeaturesData = {
  units: UnitFeatures[];
};

// Legacy joint-segmentation.json format (for backward compat)
type SegmentedJoint = {
  name: string;
  electricalName: string;
  nodePath: string;
  type: 'prismatic' | 'revolute' | 'unknown';
  min: number;
  max: number;
  axis: { x: number; y: number; z: number };
  origin: { x: number; y: number; z: number };
  matrix4x4: number[];
};

type SegmentedUnit = {
  unitName: string;
  meshIds: number[];
  nodePaths: string[];
  joints: SegmentedJoint[];
};

type JointSegmentationData = {
  fixtureName: string;
  units: SegmentedUnit[];
};

let scene: BABYLON.Scene;
let camera: BABYLON.ArcRotateCamera;
let engine: BABYLON.Engine;
let rigidClustersData: RigidClustersData | null = null;
let unitsData: UnitsData | null = null;
let unitsDataV2: UnitsData | null = null; // V2 units
let unitFeaturesData: UnitFeaturesData | null = null;
let unitFeaturesDataV2: UnitFeaturesData | null = null; // V2 features
let jointSegData: JointSegmentationData | null = null; // Legacy format
const meshNameToCluster = new Map<string, RigidClusterJson>();
const clusterIdToUnit = new Map<string, KinematicUnit>();
const clusterIdToUnitV2 = new Map<string, KinematicUnit>();
const unitTransforms = new Map<string, BABYLON.TransformNode>();
let jointAxes: BABYLON.AbstractMesh[] = [];
let axesVisible = true;
let highlightedUnitId: string | null = null;
let currentMode: 'v1' | 'v2' = 'v1';

// Colors
const BASE_COLOR = new BABYLON.Color3(0.3, 0.3, 0.8);      // Blue
const LOOSE_COLOR = new BABYLON.Color3(0.5, 0.5, 0.5);     // Gray
const AXIS_COLOR = new BABYLON.Color3(1, 0, 0);            // Red
const ORIGIN_COLOR = new BABYLON.Color3(0, 1, 0);          // Green
const HIGHLIGHT_COLOR = new BABYLON.Color3(1, 1, 0);      // Yellow

// Generate distinct colors for units
function generateUnitColor(index: number): BABYLON.Color3 {
  const hue = (index * 137.508) % 360; // Golden angle for good distribution
  const saturation = 0.7;
  const lightness = 0.5;
  
  // HSL to RGB conversion
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  
  let r = 0, g = 0, b = 0;
  if (hue < 60) {
    r = c; g = x; b = 0;
  } else if (hue < 120) {
    r = x; g = c; b = 0;
  } else if (hue < 180) {
    r = 0; g = c; b = x;
  } else if (hue < 240) {
    r = 0; g = x; b = c;
  } else if (hue < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }
  
  return new BABYLON.Color3(r + m, g + m, b + m);
}

function updateInfo(text: string) {
  const infoDiv = document.getElementById('info');
  if (infoDiv) {
    infoDiv.innerHTML = text;
  }
}

async function initializeScene() {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[Kinematics Debug] Canvas not found');
    return;
  }

  // Create engine and scene
  engine = new BABYLON.Engine(canvas, true);
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.15);

  // Camera
  camera = new BABYLON.ArcRotateCamera(
    'camera',
    Math.PI / 4,
    Math.PI / 3,
    10,
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 50;
  camera.minZ = 0.0001;
  camera.maxZ = 10000;

  // Lights
  new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
  new BABYLON.DirectionalLight('light2', new BABYLON.Vector3(-1, -1, -1), scene);

  updateInfo('Loading GLB and JSON files...');

  try {
    await loadGLBModel();
    await loadJsonFiles();
    applyClusterColors();
    createJointVisualizations();
    setupKinematicsAPI();
    
    updateInfoDisplay();
  } catch (err) {
    console.error('[Kinematics Debug] Error:', err);
    updateInfo(`<div style="color: red;">Error: ${err instanceof Error ? err.message : String(err)}</div>`);
    return;
  }

  // Render loop
  engine.runRenderLoop(() => {
    scene.render();
  });

  // Handle resize
  window.addEventListener('resize', () => {
    engine.resize();
  });
}

async function loadGLBModel() {
  const glbPath = DEFAULT_TOOLING_CONFIG.glbPath;
  
  let url: string;
  if (glbPath.startsWith('C:/') || glbPath.startsWith('c:/')) {
    url = 'file:///' + glbPath.replace(/\\/g, '/');
  } else {
    url = glbPath;
  }

  console.log('[Kinematics Debug] Loading GLB from:', url);

  const result = await BABYLON.SceneLoader.ImportMeshAsync('', '', url, scene);
  
  if (!result.meshes || result.meshes.length === 0) {
    throw new Error('No meshes loaded from GLB');
  }

  console.log('[Kinematics Debug] Loaded', result.meshes.length, 'meshes');

  // Center camera on model
  let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
  let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

  for (const mesh of result.meshes) {
    if (!(mesh instanceof BABYLON.Mesh)) {
      continue;
    }
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    min = BABYLON.Vector3.Minimize(min, bbox.minimumWorld);
    max = BABYLON.Vector3.Maximize(max, bbox.maximumWorld);
  }

  if (min.x !== Infinity) {
    const center = min.add(max).scale(0.5);
    const extent = max.subtract(min).length();
    camera.setTarget(center);
    camera.radius = extent * 1.5;
  }
}

async function loadJsonFiles() {
  const glbPath = DEFAULT_TOOLING_CONFIG.glbPath;
  const basePath = glbPath.substring(0, glbPath.lastIndexOf('.'));
  
  // Load rigid-clusters JSON
  const clustersPath = basePath + '.rigid-clusters.json';
  console.log('[Kinematics Debug] Loading clusters from:', clustersPath);
  
  let clustersUrl: string;
  if (clustersPath.startsWith('C:/') || clustersPath.startsWith('c:/')) {
    clustersUrl = 'file:///' + clustersPath.replace(/\\/g, '/');
  } else {
    clustersUrl = clustersPath;
  }

  try {
    const clustersResponse = await fetch(clustersUrl);
    if (!clustersResponse.ok) {
      throw new Error(`Failed to load clusters JSON: ${clustersResponse.statusText}`);
    }
    rigidClustersData = await clustersResponse.json() as RigidClustersData;
    console.log('[Kinematics Debug] Loaded', rigidClustersData.clusters.length, 'clusters');
    
    // Build mesh name to cluster map
    rigidClustersData.clusters.forEach(cluster => {
      cluster.meshNames.forEach(meshName => {
        meshNameToCluster.set(meshName, cluster);
      });
    });
  } catch (err) {
    console.warn('[Kinematics Debug] Could not load clusters JSON:', err);
    console.warn('[Kinematics Debug] Continuing without cluster colors...');
  }

  // Try to load v1 units.json format
  const unitsPath = basePath + '.units.json';
  let unitsUrl: string;
  if (unitsPath.startsWith('C:/') || unitsPath.startsWith('c:/')) {
    unitsUrl = 'file:///' + unitsPath.replace(/\\/g, '/');
  } else {
    unitsUrl = unitsPath;
  }

  try {
    const unitsResponse = await fetch(unitsUrl);
    if (unitsResponse.ok) {
      unitsData = await unitsResponse.json() as UnitsData;
      console.log('[Kinematics Debug] Loaded', unitsData.units.length, 'units (v1)');
      
      // Build cluster to unit map
      unitsData.units.forEach(unit => {
        unit.clusterIds.forEach(clusterId => {
          clusterIdToUnit.set(clusterId, unit);
        });
      });
      
      // Try to load unit features
      const featuresPath = basePath + '.unit-features.json';
      let featuresUrl: string;
      if (featuresPath.startsWith('C:/') || featuresPath.startsWith('c:/')) {
        featuresUrl = 'file:///' + featuresPath.replace(/\\/g, '/');
      } else {
        featuresUrl = featuresPath;
      }
      
      try {
        const featuresResponse = await fetch(featuresUrl);
        if (featuresResponse.ok) {
          unitFeaturesData = await featuresResponse.json() as UnitFeaturesData;
          console.log('[Kinematics Debug] Loaded unit features (v1)');
        }
      } catch (err) {
        console.warn('[Kinematics Debug] Could not load unit features:', err);
      }
    }
  } catch (err) {
    console.warn('[Kinematics Debug] Could not load v1 units JSON:', err);
  }

  // Try to load v2 units.json format
  const unitsPathV2 = basePath + '.units-v2.json';
  let unitsUrlV2: string;
  if (unitsPathV2.startsWith('C:/') || unitsPathV2.startsWith('c:/')) {
    unitsUrlV2 = 'file:///' + unitsPathV2.replace(/\\/g, '/');
  } else {
    unitsUrlV2 = unitsPathV2;
  }

  try {
    const unitsResponseV2 = await fetch(unitsUrlV2);
    if (unitsResponseV2.ok) {
      unitsDataV2 = await unitsResponseV2.json() as UnitsData;
      console.log('[Kinematics Debug] Loaded', unitsDataV2.units.length, 'units (v2)');
      
      // Build cluster to unit map for v2
      unitsDataV2.units.forEach(unit => {
        unit.clusterIds.forEach(clusterId => {
          clusterIdToUnitV2.set(clusterId, unit);
        });
      });
      
      // Try to load v2 unit features
      const featuresPathV2 = basePath + '.unit-features-v2.json';
      let featuresUrlV2: string;
      if (featuresPathV2.startsWith('C:/') || featuresPathV2.startsWith('c:/')) {
        featuresUrlV2 = 'file:///' + featuresPathV2.replace(/\\/g, '/');
      } else {
        featuresUrlV2 = featuresPathV2;
      }
      
      try {
        const featuresResponseV2 = await fetch(featuresUrlV2);
        if (featuresResponseV2.ok) {
          unitFeaturesDataV2 = await featuresResponseV2.json() as UnitFeaturesData;
          console.log('[Kinematics Debug] Loaded unit features (v2)');
        }
      } catch (err) {
        console.warn('[Kinematics Debug] Could not load v2 unit features:', err);
      }
    }
  } catch (err) {
    console.warn('[Kinematics Debug] Could not load v2 units JSON:', err);
  }

  // Fallback to legacy joint-segmentation JSON
  if (!unitsData) {
    const jointsPath = basePath + '.joint-segmentation.json';
    console.log('[Kinematics Debug] Loading joints from:', jointsPath);
    
    let jointsUrl: string;
    if (jointsPath.startsWith('C:/') || jointsPath.startsWith('c:/')) {
      jointsUrl = 'file:///' + jointsPath.replace(/\\/g, '/');
    } else {
      jointsUrl = jointsPath;
    }

    try {
      const jointsResponse = await fetch(jointsUrl);
      if (jointsResponse.ok) {
        jointSegData = await jointsResponse.json() as JointSegmentationData;
        console.log('[Kinematics Debug] Loaded', jointSegData.units.length, 'units (legacy format)');
      }
    } catch (err) {
      console.warn('[Kinematics Debug] Could not load joints JSON:', err);
      console.warn('[Kinematics Debug] Continuing without joint visualization...');
    }
  }
}

function applyClusterColors() {
  if (!rigidClustersData) return;

  const meshes = scene.meshes.filter(m => m instanceof BABYLON.Mesh) as BABYLON.Mesh[];
  
  // Use current mode to select units data
  const activeUnitsData = currentMode === 'v2' ? unitsDataV2 : unitsData;
  const activeClusterToUnit = currentMode === 'v2' ? clusterIdToUnitV2 : clusterIdToUnit;
  
  // Build unit color map
  const unitColorMap = new Map<string, BABYLON.Color3>();
  if (activeUnitsData) {
    activeUnitsData.units.forEach((unit, index) => {
      unitColorMap.set(unit.id, generateUnitColor(index));
    });
  }
  
  meshes.forEach(mesh => {
    const cluster = meshNameToCluster.get(mesh.name);
    if (!cluster) return;

    let color: BABYLON.Color3;
    let isHighlighted = false;
    
    // Check if this cluster belongs to a unit
    const clusterId = `cluster_${cluster.id}`;
    const unit = activeClusterToUnit.get(clusterId);
    
    if (unit && unitColorMap.has(unit.id)) {
      color = unitColorMap.get(unit.id)!;
      isHighlighted = highlightedUnitId === unit.id;
    } else if (cluster.type === 'base') {
      color = BASE_COLOR;
    } else {
      color = LOOSE_COLOR;
    }
    
    // Apply highlight if needed
    if (isHighlighted) {
      color = HIGHLIGHT_COLOR;
    }

    // Create or update material
    let mat = mesh.material as BABYLON.StandardMaterial;
    if (!mat || !(mat instanceof BABYLON.StandardMaterial)) {
      mat = new BABYLON.StandardMaterial(`mat_${mesh.name}`, scene);
      mesh.material = mat;
    }

    mat.diffuseColor = color;
    mat.specularColor = color.scale(0.3);
    mat.emissiveColor = isHighlighted ? color.scale(0.5) : color.scale(0.1);
  });

  console.log(`[Kinematics Debug] Applied colors to meshes (${currentMode})`);
}

function updateInfoDisplay() {
  const activeUnitsData = currentMode === 'v2' ? unitsDataV2 : unitsData;
  const unitCount = activeUnitsData?.units.length ?? jointSegData?.units.length ?? 0;
  const linkCount = activeUnitsData?.links.length ?? 0;
  const jointCount = activeUnitsData?.joints.length ?? 0;
  
  const v1Count = unitsData?.units.length ?? 0;
  const v2Count = unitsDataV2?.units.length ?? 0;
  
  updateInfo(`
    <div>
      <strong>9X_110_GEO Kinematics Debug</strong><br/>
      Mode: <button onclick="kinDebug.toggleMode()" style="padding: 2px 8px; margin: 2px;">${currentMode.toUpperCase()}</button><br/>
      <br/>
      <strong>Current (${currentMode}):</strong><br/>
      Clusters: ${rigidClustersData?.clusters.length ?? 0}<br/>
      Units: ${unitCount}<br/>
      Links: ${linkCount}<br/>
      Joints: ${jointCount}<br/>
      <br/>
      <strong>Summary:</strong><br/>
      V1: ${v1Count} units<br/>
      V2: ${v2Count} units<br/>
      <br/>
      <strong>Console API:</strong><br/>
      kinDebug.toggleMode()<br/>
      kinDebug.listUnits()<br/>
      kinDebug.highlightUnit(unitId)<br/>
      kinDebug.setJoint(unitId, jointId, value)
    </div>
  `);
}

function createJointVisualizations() {
  // Clear existing axes
  jointAxes.forEach(axis => axis.dispose());
  jointAxes = [];

  // Use current mode to select units data
  const activeUnitsData = currentMode === 'v2' ? unitsDataV2 : unitsData;

  if (activeUnitsData) {
    // New format: use units.json
    activeUnitsData.joints.forEach(joint => {
      const origin = new BABYLON.Vector3(joint.origin[0], joint.origin[1], joint.origin[2]);
      const originSphere = BABYLON.MeshBuilder.CreateSphere(
        `joint_origin_${joint.id}`,
        { diameter: 0.02 },
        scene
      );
      originSphere.position = origin;
      
      const originMat = new BABYLON.StandardMaterial(`mat_origin_${joint.id}`, scene);
      originMat.diffuseColor = ORIGIN_COLOR;
      originMat.emissiveColor = ORIGIN_COLOR.scale(0.5);
      originSphere.material = originMat;
      jointAxes.push(originSphere);

      // Create axis line
      const axis = new BABYLON.Vector3(joint.axis[0], joint.axis[1], joint.axis[2]);
      const axisLength = 0.1; // 100mm
      const axisEnd = origin.add(axis.scale(axisLength));
      
      const axisLine = BABYLON.MeshBuilder.CreateLines(
        `joint_axis_${joint.id}`,
        {
          points: [origin, axisEnd],
          colors: [AXIS_COLOR.toColor4(1), AXIS_COLOR.toColor4(1)]
        },
        scene
      );
      jointAxes.push(axisLine);
    });

    // Create transform nodes for units
    activeUnitsData.units.forEach(unit => {
      const unitNode = new BABYLON.TransformNode(unit.id, scene);
      unitTransforms.set(unit.id, unitNode);
    });
  } else if (jointSegData) {
    // Legacy format: use joint-segmentation.json
    jointSegData.units.forEach(unit => {
      unit.joints.forEach(joint => {
        // Create origin sphere
        const origin = new BABYLON.Vector3(joint.origin.x, joint.origin.y, joint.origin.z);
        const originSphere = BABYLON.MeshBuilder.CreateSphere(
          `joint_origin_${unit.unitName}_${joint.name}`,
          { diameter: 0.02 },
          scene
        );
        originSphere.position = origin;
        
        const originMat = new BABYLON.StandardMaterial(`mat_origin_${joint.name}`, scene);
        originMat.diffuseColor = ORIGIN_COLOR;
        originMat.emissiveColor = ORIGIN_COLOR.scale(0.5);
        originSphere.material = originMat;
        jointAxes.push(originSphere);

        // Create axis line
        const axis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z);
        const axisLength = 0.1; // 100mm
        const axisEnd = origin.add(axis.scale(axisLength));
        
        const axisLine = BABYLON.MeshBuilder.CreateLines(
          `joint_axis_${unit.unitName}_${joint.name}`,
          {
            points: [origin, axisEnd],
            colors: [AXIS_COLOR.toColor4(1), AXIS_COLOR.toColor4(1)]
          },
          scene
        );
        jointAxes.push(axisLine);
      });

      // Find or create transform node for this unit
      let unitNode: BABYLON.TransformNode | null = null;
      
      if (unit.nodePaths.length > 0) {
        const pathParts = unit.nodePaths[0].split('/');
        const unitNodeName = pathParts[pathParts.length - 1];
        unitNode = scene.getTransformNodeByName(unitNodeName);
      }
      
      if (!unitNode) {
        unitNode = scene.getTransformNodeByName(unit.unitName);
      }
      
      if (!unitNode) {
        unitNode = new BABYLON.TransformNode(unit.unitName, scene);
        console.warn(`[Kinematics Debug] Unit node not found, created dummy: ${unit.unitName}`);
      }
      
      unitTransforms.set(unit.unitName, unitNode);
    });
  }

  console.log('[Kinematics Debug] Created', jointAxes.length, 'joint visualizations');
}

function setupKinematicsAPI() {
  (window as any).kinDebug = {
    toggleMode: () => {
      currentMode = currentMode === 'v1' ? 'v2' : 'v1';
      console.log(`Switched to ${currentMode.toUpperCase()} mode`);
      applyClusterColors();
      createJointVisualizations();
      updateInfoDisplay();
    },

    listUnits: () => {
      const activeUnitsData = currentMode === 'v2' ? unitsDataV2 : unitsData;
      const activeFeaturesData = currentMode === 'v2' ? unitFeaturesDataV2 : unitFeaturesData;
      
      if (activeUnitsData) {
        console.log(`Units (${currentMode}):`);
        activeUnitsData.units.forEach((unit) => {
          const features = activeFeaturesData?.units.find(f => f.unitId === unit.id);
          console.log(`  ${unit.id}:`);
          console.log(`    Joints: ${unit.jointIds.length}`);
          console.log(`    Clusters: ${unit.clusterIds.length}`);
          if (features) {
            console.log(`    Height: ${features.height.toFixed(3)}m`);
            console.log(`    Extent: ${features.extentX.toFixed(3)} x ${features.extentY.toFixed(3)} x ${features.extentZ.toFixed(3)}m`);
            console.log(`    Joints: ${features.revoluteCount} revolute, ${features.prismaticCount} prismatic`);
          }
          unit.jointIds.forEach(jointId => {
            const joint = activeUnitsData!.joints.find(j => j.id === jointId);
            if (joint) {
              console.log(`      - ${jointId} (${joint.type}): ${joint.min} to ${joint.max}`);
            }
          });
        });
        return;
      }
      
      if (jointSegData) {
        console.log('Units (legacy format):');
        jointSegData.units.forEach(unit => {
          console.log(`  ${unit.unitName}:`);
          unit.joints.forEach(joint => {
            console.log(`    - ${joint.name} (${joint.type}): ${joint.min} to ${joint.max}`);
          });
        });
        return;
      }
      
      console.log('No unit data loaded');
    },

    highlightUnit: (unitId: string) => {
      if (highlightedUnitId === unitId) {
        highlightedUnitId = null;
        console.log('Cleared unit highlight');
      } else {
        highlightedUnitId = unitId;
        console.log(`Highlighted unit: ${unitId}`);
      }
      applyClusterColors();
    },

    setJoint: (unitId: string, jointId: string, value: number) => {
      const activeUnitsData = currentMode === 'v2' ? unitsDataV2 : unitsData;
      
      if (activeUnitsData) {
        // New format
        const joint = activeUnitsData.joints.find(j => j.id === jointId);
        if (!joint) {
          console.error(`Joint not found: ${jointId}`);
          return;
        }

        const unit = activeUnitsData.units.find(u => u.id === unitId);
        if (!unit) {
          console.error(`Unit not found: ${unitId}`);
          return;
        }

        if (!unit.jointIds.includes(jointId)) {
          console.error(`Joint ${jointId} does not belong to unit ${unitId}`);
          return;
        }

        const clampedValue = Math.max(joint.min, Math.min(joint.max, value));
        const unitNode = unitTransforms.get(unitId);
        if (!unitNode) {
          console.warn(`Unit transform node not found: ${unitId}`);
          return;
        }

        const axis = new BABYLON.Vector3(joint.axis[0], joint.axis[1], joint.axis[2]);
        const origin = new BABYLON.Vector3(joint.origin[0], joint.origin[1], joint.origin[2]);
        
        if (joint.type === 'revolute') {
          const angle = clampedValue * (Math.PI / 180);
          const rotation = BABYLON.Quaternion.RotationAxis(axis, angle);
          const currentPos = unitNode.getAbsolutePosition();
          const localPos = currentPos.subtract(origin);
          const rotationMatrix = BABYLON.Matrix.RotationQuaternion(rotation);
          const rotatedPos = BABYLON.Vector3.TransformCoordinates(localPos, rotationMatrix);
          unitNode.position = origin.add(rotatedPos);
          unitNode.rotationQuaternion = rotation;
        } else if (joint.type === 'prismatic') {
          const translation = axis.scale(clampedValue);
          unitNode.position = origin.add(translation);
          unitNode.rotationQuaternion = null;
        }

        console.log(`Set ${unitId}.${jointId} = ${clampedValue}`);
        return;
      }

      // Legacy format
      if (!jointSegData) {
        console.error('No joint data loaded');
        return;
      }

      const unit = jointSegData.units.find(u => u.unitName === unitId);
      if (!unit) {
        console.error(`Unit not found: ${unitId}`);
        return;
      }

      const joint = unit.joints.find(j => j.name === jointId);
      if (!joint) {
        console.error(`Joint not found: ${jointId} in unit ${unitId}`);
        return;
      }

      const clampedValue = Math.max(joint.min, Math.min(joint.max, value));
      const unitNode = unitTransforms.get(unitId);
      if (!unitNode) {
        console.warn(`Unit transform node not found: ${unitId}`);
        return;
      }

      const axis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z);
      const origin = new BABYLON.Vector3(joint.origin.x, joint.origin.y, joint.origin.z);
      
      if (joint.type === 'revolute') {
        const angle = clampedValue * (Math.PI / 180);
        const rotation = BABYLON.Quaternion.RotationAxis(axis, angle);
        const currentPos = unitNode.getAbsolutePosition();
        const localPos = currentPos.subtract(origin);
        const rotationMatrix = BABYLON.Matrix.RotationQuaternion(rotation);
        const rotatedPos = BABYLON.Vector3.TransformCoordinates(localPos, rotationMatrix);
        unitNode.position = origin.add(rotatedPos);
        unitNode.rotationQuaternion = rotation;
      } else if (joint.type === 'prismatic') {
        const translation = axis.scale(clampedValue);
        unitNode.position = origin.add(translation);
        unitNode.rotationQuaternion = null;
      }

      console.log(`Set ${unitId}.${jointId} = ${clampedValue}`);
    },

    resetAllJoints: () => {
      unitTransforms.forEach((node) => {
        node.rotationQuaternion = null;
        node.rotation = BABYLON.Vector3.Zero();
        node.position = BABYLON.Vector3.Zero();
      });
      console.log('Reset all joint transforms');
    },

    toggleAxes: () => {
      axesVisible = !axesVisible;
      jointAxes.forEach(axis => {
        axis.setEnabled(axesVisible);
      });
      console.log(`Joint axes ${axesVisible ? 'visible' : 'hidden'}`);
    },

    describeFixture: () => {
      const glbPath = DEFAULT_TOOLING_CONFIG.glbPath;
      const basePath = glbPath.substring(0, glbPath.lastIndexOf('.'));
      const lastSlash = Math.max(glbPath.lastIndexOf('/'), glbPath.lastIndexOf('\\'));
      const fileName = glbPath.substring(lastSlash + 1);
      const fixtureId = fileName.substring(0, fileName.lastIndexOf('.'));
      
      // Try to load structure profile
      const profilePath = basePath + '.structure-profile.json';
      let profileUrl: string;
      if (profilePath.startsWith('C:/') || profilePath.startsWith('c:/')) {
        profileUrl = 'file:///' + profilePath.replace(/\\/g, '/');
      } else {
        profileUrl = profilePath;
      }

      fetch(profileUrl)
        .then(res => res.ok ? res.json() : null)
        .then(profile => {
          if (profile) {
            console.log('Fixture Description:');
            console.log(`  ID: ${fixtureId}`);
            console.log(`  Type: ${profile.suspectedFixtureType || 'unknown'}`);
            console.log(`  Base clusters: ${profile.clusterStats?.baseClusters || 0}`);
            console.log(`  Unit clusters: ${profile.clusterStats?.unitClusters || 0}`);
            console.log(`  Loose clusters: ${profile.clusterStats?.looseClusters || 0}`);
            if (profile.jointStats) {
              console.log(`  Joints: ${profile.jointStats.totalJoints} (${profile.jointStats.revoluteCount} revolute, ${profile.jointStats.prismaticCount} prismatic)`);
            }
          } else {
            console.log('Structure profile not found');
          }
        })
        .catch(() => {
          console.log('Could not load structure profile');
        });

      // Also show from loaded data
      if (unitsData) {
        console.log('\nFrom loaded units.json (v1):');
        console.log(`  Units: ${unitsData.units.length}`);
        console.log(`  Links: ${unitsData.links.length}`);
        console.log(`  Joints: ${unitsData.joints.length}`);
        const baseLinks = unitsData.links.filter(link => {
          // Check if link contains base clusters
          return rigidClustersData?.clusters.some(c => {
            const clusterId = `cluster_${c.id}`;
            return c.type === 'base' && link.clusterIds.includes(clusterId);
          });
        });
        console.log(`  Base links: ${baseLinks.length}`);
      }
      
      if (unitsDataV2) {
        console.log('\nFrom loaded units-v2.json (v2):');
        console.log(`  Units: ${unitsDataV2.units.length}`);
        console.log(`  Links: ${unitsDataV2.links.length}`);
        console.log(`  Joints: ${unitsDataV2.joints.length}`);
        const baseLinks = unitsDataV2.links.filter(link => {
          // Check if link contains base clusters
          return rigidClustersData?.clusters.some(c => {
            const clusterId = `cluster_${c.id}`;
            return c.type === 'base' && link.clusterIds.includes(clusterId);
          });
        });
        console.log(`  Base links: ${baseLinks.length}`);
      }
    }
  };

  console.log('[Kinematics Debug] API available at window.kinDebug');
}

// Initialize on load
initializeScene().catch(err => {
  console.error('[Kinematics Debug] Initialization failed:', err);
});

