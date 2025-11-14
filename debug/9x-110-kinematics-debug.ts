/**
 * 9X_110_GEO Kinematics Debug Page
 * 
 * Loads the GLB model + rigid-clusters JSON + joint-segmentation JSON
 * - Colors meshes by type (base/unit/loose)
 * - Visualizes joint axes and origins
 * - Exposes window.kinDebug API to scrub joint values
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { DEFAULT_TOOLING_CONFIG } from '../src/dev/tooling/ToolingConfig';

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
let jointSegData: JointSegmentationData | null = null;
let meshNameToCluster = new Map<string, RigidClusterJson>();
let unitTransforms = new Map<string, BABYLON.TransformNode>();
let jointAxes: BABYLON.AbstractMesh[] = [];
let axesVisible = true;

// Colors for cluster types
const BASE_COLOR = new BABYLON.Color3(0.3, 0.3, 0.8);      // Blue
const UNIT_COLOR = new BABYLON.Color3(0.8, 0.5, 0.2);      // Orange
const LOOSE_COLOR = new BABYLON.Color3(0.5, 0.5, 0.5);     // Gray
const AXIS_COLOR = new BABYLON.Color3(1, 0, 0);            // Red
const ORIGIN_COLOR = new BABYLON.Color3(0, 1, 0);          // Green

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
    
    updateInfo(`
      <div>
        <strong>9X_110_GEO Kinematics Debug</strong><br/>
        Loaded: ${rigidClustersData?.clusters.length ?? 0} clusters<br/>
        Units: ${jointSegData?.units.length ?? 0}<br/>
        <br/>
        <strong>Use console API:</strong><br/>
        kinDebug.listUnits()<br/>
        kinDebug.setJoint(unitName, jointName, value)
      </div>
    `);
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

  // Load joint-segmentation JSON
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
    if (!jointsResponse.ok) {
      throw new Error(`Failed to load joints JSON: ${jointsResponse.statusText}`);
    }
    jointSegData = await jointsResponse.json() as JointSegmentationData;
    console.log('[Kinematics Debug] Loaded', jointSegData.units.length, 'units');
  } catch (err) {
    console.warn('[Kinematics Debug] Could not load joints JSON:', err);
    console.warn('[Kinematics Debug] Continuing without joint visualization...');
  }
}

function applyClusterColors() {
  if (!rigidClustersData) return;

  const meshes = scene.meshes.filter(m => m instanceof BABYLON.Mesh) as BABYLON.Mesh[];
  
  meshes.forEach(mesh => {
    const cluster = meshNameToCluster.get(mesh.name);
    if (!cluster) return;

    let color: BABYLON.Color3;
    if (cluster.type === 'base') {
      color = BASE_COLOR;
    } else if (cluster.type === 'unit') {
      color = UNIT_COLOR;
    } else {
      color = LOOSE_COLOR;
    }

    // Create or update material
    let mat = mesh.material as BABYLON.StandardMaterial;
    if (!mat || !(mat instanceof BABYLON.StandardMaterial)) {
      mat = new BABYLON.StandardMaterial(`mat_${mesh.name}`, scene);
      mesh.material = mat;
    }

    mat.diffuseColor = color;
    mat.specularColor = color.scale(0.3);
    mat.emissiveColor = color.scale(0.1);
  });

  console.log('[Kinematics Debug] Applied colors to meshes');
}

function createJointVisualizations() {
  if (!jointSegData) return;

  // Clear existing axes
  jointAxes.forEach(axis => axis.dispose());
  jointAxes = [];

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

    // Find or create transform node for this unit (for kinematics)
    // Try to find the unit root node from nodePaths
    let unitNode: BABYLON.TransformNode | null = null;
    
    if (unit.nodePaths.length > 0) {
      // Try to find the first node path
      const pathParts = unit.nodePaths[0].split('/');
      const unitNodeName = pathParts[pathParts.length - 1];
      unitNode = scene.getTransformNodeByName(unitNodeName);
    }
    
    if (!unitNode) {
      // Fallback: try unit name directly
      unitNode = scene.getTransformNodeByName(unit.unitName);
    }
    
    if (!unitNode) {
      // Create a dummy transform node if unit node not found
      unitNode = new BABYLON.TransformNode(unit.unitName, scene);
      console.warn(`[Kinematics Debug] Unit node not found, created dummy: ${unit.unitName}`);
    }
    
    unitTransforms.set(unit.unitName, unitNode);
  });

  console.log('[Kinematics Debug] Created', jointAxes.length, 'joint visualizations');
}

function setupKinematicsAPI() {
  (window as any).kinDebug = {
    listUnits: () => {
      if (!jointSegData) {
        console.log('No joint segmentation data loaded');
        return;
      }
      console.log('Units:');
      jointSegData.units.forEach(unit => {
        console.log(`  ${unit.unitName}:`);
        unit.joints.forEach(joint => {
          console.log(`    - ${joint.name} (${joint.type}): ${joint.min} to ${joint.max}`);
        });
      });
    },

    setJoint: (unitName: string, jointName: string, value: number) => {
      if (!jointSegData) {
        console.error('No joint segmentation data loaded');
        return;
      }

      const unit = jointSegData.units.find(u => u.unitName === unitName);
      if (!unit) {
        console.error(`Unit not found: ${unitName}`);
        return;
      }

      const joint = unit.joints.find(j => j.name === jointName);
      if (!joint) {
        console.error(`Joint not found: ${jointName} in unit ${unitName}`);
        return;
      }

      // Clamp value to joint limits
      const clampedValue = Math.max(joint.min, Math.min(joint.max, value));
      
      // Get unit transform node
      const unitNode = unitTransforms.get(unitName);
      if (!unitNode) {
        console.warn(`Unit transform node not found: ${unitName}`);
        return;
      }

      // Apply joint transformation
      const axis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z);
      const origin = new BABYLON.Vector3(joint.origin.x, joint.origin.y, joint.origin.z);
      
      if (joint.type === 'revolute') {
        // Rotate around axis at origin
        const angle = clampedValue * (Math.PI / 180); // Convert degrees to radians
        const rotation = BABYLON.Quaternion.RotationAxis(axis, angle);
        
        // Get current position relative to origin
        const currentPos = unitNode.getAbsolutePosition();
        const localPos = currentPos.subtract(origin);
        
        // Rotate the local position
        const rotationMatrix = BABYLON.Matrix.RotationQuaternion(rotation);
        const rotatedPos = BABYLON.Vector3.TransformCoordinates(localPos, rotationMatrix);
        
        // Set new position and rotation
        unitNode.position = origin.add(rotatedPos);
        unitNode.rotationQuaternion = rotation;
        
      } else if (joint.type === 'prismatic') {
        // Translate along axis from origin
        const translation = axis.scale(clampedValue);
        unitNode.position = origin.add(translation);
        unitNode.rotationQuaternion = null;
      }

      console.log(`Set ${unitName}.${jointName} = ${clampedValue}`);
    },

    resetAllJoints: () => {
      unitTransforms.forEach((node, unitName) => {
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
    }
  };

  console.log('[Kinematics Debug] API available at window.kinDebug');
}

// Initialize on load
initializeScene().catch(err => {
  console.error('[Kinematics Debug] Initialization failed:', err);
});

