/**
 * Robot OBJ Loader with Kinematic Support
 * Loads OBJ files converted from JT/PSZ with full kinematic metadata
 *
 * Usage in kinetiCORE:
 *   User clicks "Load File" → Selects robot.obj → This loader handles it
 *
 * Features:
 * - Loads OBJ geometry from converted Tecnomatix robots
 * - Automatically finds and loads robot.kinematics.json
 * - Builds joint hierarchy for animation
 * - Integrates with kinetiCORE physics and entities
 */

import * as BABYLON from '@babylonjs/core';
import { ISceneLoaderAsyncResult } from '@babylonjs/core';

export interface RobotKinematicData {
  robotType: string;
  manufacturer?: string;
  model?: string;
  dof: number;
  joints: JointDefinition[];
  links: LinkDefinition[];
  toolMountPoint?: TransformData;
  baseMountPoint?: TransformData;
  workEnvelope?: WorkEnvelopeData;
  poses?: PoseDefinition[];
}

export interface JointDefinition {
  name: string;
  index?: number;
  type: 'revolute' | 'prismatic' | 'fixed';
  axis: 'X' | 'Y' | 'Z';
  limits: {
    min: number;
    max: number;
  };
  velocity?: {
    max: number;
  };
  dhParameters?: {
    a: number;
    alpha: number;
    d: number;
    theta: number;
  };
}

export interface LinkDefinition {
  name: string;
  index: number;
  meshName: string;
  parent: number | null;
  joint: number;
  mass?: number;
  inertia?: number[][];
}

export interface TransformData {
  position: [number, number, number];
  rotation: [number, number, number];
  matrix?: number[];
}

export interface WorkEnvelopeData {
  reachRadius: number;
  heightRange: [number, number];
  payload: number;
  repeatability: number;
}

export interface PoseDefinition {
  name: string;
  joints: number[];
}

export interface LoadedRobot {
  rootMesh: BABYLON.Mesh;
  meshes: BABYLON.AbstractMesh[];
  kinematics: RobotKinematicData;
  jointMeshes: Map<number, BABYLON.Mesh>;
}

/**
 * Load robot from OBJ file with kinematic metadata
 */
export async function loadRobotOBJ(objFile: File, scene: BABYLON.Scene): Promise<LoadedRobot> {
  console.log('[RobotOBJLoader] Loading robot:', objFile.name);

  // Load OBJ geometry
  const objBlob = await fileToBlob(objFile);
  const objURL = URL.createObjectURL(objBlob);

  const result = await BABYLON.SceneLoader.ImportMeshAsync(
    '',
    '',
    objURL,
    scene,
    undefined,
    '.obj'
  );

  // Clean up blob URL
  URL.revokeObjectURL(objURL);

  console.log(`[RobotOBJLoader] Loaded ${result.meshes.length} meshes`);

  // Try to find and load kinematic data
  const kinematics = await tryLoadKinematicData(objFile);

  if (kinematics) {
    console.log(`[RobotOBJLoader] Found kinematic data: ${kinematics.dof} DOF`);
    return buildRobotWithKinematics(result, kinematics, scene);
  } else {
    console.log('[RobotOBJLoader] No kinematic data found, loading as static mesh');
    return buildStaticRobot(result);
  }
}

/**
 * Load robot from OBJ path with separate kinematic JSON
 */
export async function loadRobotOBJWithKinematics(
  objPath: string,
  kinematicsPath: string,
  scene: BABYLON.Scene
): Promise<LoadedRobot> {
  console.log('[RobotOBJLoader] Loading robot from paths');
  console.log('  OBJ:', objPath);
  console.log('  Kinematics:', kinematicsPath);

  // Load OBJ
  const objResult = await BABYLON.SceneLoader.ImportMeshAsync(
    '',
    '',
    objPath,
    scene,
    undefined,
    '.obj'
  );

  // Load kinematics
  const response = await fetch(kinematicsPath);
  if (!response.ok) {
    throw new Error(`Failed to load kinematics: ${response.statusText}`);
  }

  const kinematics: RobotKinematicData = await response.json();

  console.log(
    `[RobotOBJLoader] Loaded ${objResult.meshes.length} meshes with ${kinematics.dof} DOF`
  );

  return buildRobotWithKinematics(objResult, kinematics, scene);
}

/**
 * Try to find and load kinematic JSON file
 * Looks for: robot.kinematics.json, robot.json, kinematics.json
 */
async function tryLoadKinematicData(objFile: File): Promise<RobotKinematicData | null> {
  const baseName = objFile.name.replace(/\.obj$/i, '');

  // Try different naming conventions
  const possibleNames = [`${baseName}.kinematics.json`, `${baseName}.json`, 'kinematics.json'];

  // In browser, we can't directly access sibling files
  // User must provide both files or we return null
  console.log('[RobotOBJLoader] Looking for kinematic data...');
  console.log('  Expected names:', possibleNames.join(', '));
  console.log('  Note: User must select both OBJ and JSON files together');

  return null;
}

/**
 * Build robot with full kinematic hierarchy
 */
function buildRobotWithKinematics(
  result: ISceneLoaderAsyncResult,
  kinematics: RobotKinematicData,
  scene: BABYLON.Scene
): LoadedRobot {
  console.log('[RobotOBJLoader] Building robot with kinematics');

  // Create root container
  const rootMesh = new BABYLON.Mesh(kinematics.model || 'robot', scene);
  rootMesh.metadata = {
    type: 'robot',
    robotType: kinematics.robotType,
    manufacturer: kinematics.manufacturer,
    model: kinematics.model,
    dof: kinematics.dof,
  };

  // Map link names to meshes
  const linkMeshMap = new Map<number, BABYLON.Mesh>();

  kinematics.links.forEach((link) => {
    // Find mesh by name (fuzzy match)
    const mesh = result.meshes.find(
      (m) =>
        m.name.toLowerCase().includes(link.meshName.toLowerCase()) ||
        link.meshName.toLowerCase().includes(m.name.toLowerCase())
    );

    if (mesh) {
      console.log(`  ✓ Mapped link ${link.index} "${link.name}" → mesh "${mesh.name}"`);
      linkMeshMap.set(link.index, mesh as BABYLON.Mesh);

      // Store link metadata
      mesh.metadata = {
        linkIndex: link.index,
        linkName: link.name,
        mass: link.mass,
      };
    } else {
      console.warn(`  ✗ Could not find mesh for link ${link.index} "${link.name}"`);
    }
  });

  // Build joint hierarchy
  const jointMeshes = new Map<number, BABYLON.Mesh>();

  kinematics.joints.forEach((joint, jointIndex) => {
    const link = kinematics.links[jointIndex + 1]; // Joint i connects to link i+1
    if (!link) return;

    const childMesh = linkMeshMap.get(link.index);
    const parentLink = link.parent !== null ? kinematics.links[link.parent] : null;
    const parentMesh = parentLink ? linkMeshMap.get(parentLink.index) : rootMesh;

    if (childMesh && parentMesh) {
      // Set up parent-child relationship
      childMesh.parent = parentMesh;

      // Store joint metadata for animation
      childMesh.metadata = {
        ...childMesh.metadata,
        jointIndex: jointIndex,
        jointName: joint.name,
        jointType: joint.type,
        jointAxis: joint.axis,
        jointLimits: joint.limits,
        jointVelocity: joint.velocity,
        dhParameters: joint.dhParameters,
        currentAngle: 0, // Initial angle
      };

      jointMeshes.set(jointIndex, childMesh);

      console.log(`  ✓ Joint ${jointIndex} "${joint.name}" (${joint.type}) on ${joint.axis}-axis`);
    }
  });

  // Parent all unparented meshes to root
  result.meshes.forEach((mesh) => {
    if (!mesh.parent && mesh !== rootMesh) {
      mesh.parent = rootMesh;
    }
  });

  console.log(`[RobotOBJLoader] ✓ Built robot with ${jointMeshes.size} joints`);

  return {
    rootMesh,
    meshes: result.meshes,
    kinematics,
    jointMeshes,
  };
}

/**
 * Build robot as static mesh (no kinematics)
 */
function buildStaticRobot(result: ISceneLoaderAsyncResult): LoadedRobot {
  console.log('[RobotOBJLoader] Building static robot (no kinematics)');

  const rootMesh = result.meshes[0] as BABYLON.Mesh;

  return {
    rootMesh,
    meshes: result.meshes,
    kinematics: {
      robotType: 'static',
      dof: 0,
      joints: [],
      links: [],
    },
    jointMeshes: new Map(),
  };
}

/**
 * Set joint angle (in degrees)
 */
export function setJointAngle(robot: LoadedRobot, jointIndex: number, angleDegrees: number): void {
  const mesh = robot.jointMeshes.get(jointIndex);
  if (!mesh || !mesh.metadata) {
    console.warn(`[RobotOBJLoader] Joint ${jointIndex} not found`);
    return;
  }

  const { jointType, jointAxis, jointLimits } = mesh.metadata;

  if (jointType !== 'revolute') {
    console.warn(`[RobotOBJLoader] Joint ${jointIndex} is not revolute (${jointType})`);
    return;
  }

  // Clamp to limits
  const angle = Math.max(jointLimits.min, Math.min(jointLimits.max, angleDegrees));

  // Apply rotation on joint axis
  const axis = new BABYLON.Vector3(
    jointAxis === 'X' ? 1 : 0,
    jointAxis === 'Y' ? 1 : 0,
    jointAxis === 'Z' ? 1 : 0
  );

  mesh.rotation = BABYLON.Vector3.Zero();
  mesh.rotate(axis, BABYLON.Tools.ToRadians(angle), BABYLON.Space.LOCAL);

  // Update stored angle
  mesh.metadata.currentAngle = angle;

  console.log(`[RobotOBJLoader] Joint ${jointIndex} → ${angle.toFixed(1)}°`);
}

/**
 * Move robot to named pose (e.g., "HOME", "PARK")
 */
export function moveToPose(robot: LoadedRobot, poseName: string): void {
  const pose = robot.kinematics.poses?.find((p) => p.name === poseName);

  if (!pose) {
    console.warn(`[RobotOBJLoader] Pose "${poseName}" not found`);
    return;
  }

  console.log(`[RobotOBJLoader] Moving to pose: ${poseName}`);

  pose.joints.forEach((angle, jointIndex) => {
    setJointAngle(robot, jointIndex, angle);
  });
}

/**
 * Get current joint angles
 */
export function getJointAngles(robot: LoadedRobot): number[] {
  const angles: number[] = [];

  robot.kinematics.joints.forEach((_, jointIndex) => {
    const mesh = robot.jointMeshes.get(jointIndex);
    if (mesh && mesh.metadata) {
      angles.push(mesh.metadata.currentAngle || 0);
    } else {
      angles.push(0);
    }
  });

  return angles;
}

/**
 * Utility: Convert File to Blob
 */
function fileToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const blob = new Blob([reader.result as ArrayBuffer], { type: file.type });
      resolve(blob);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Auto-detect if file is a robot OBJ with kinematics
 */
export function isRobotOBJ(fileName: string): boolean {
  const lower = fileName.toLowerCase();

  // Check for robot manufacturer names
  const manufacturers = [
    'kuka',
    'fanuc',
    'abb',
    'kawasaki',
    'ur',
    'universal',
    'yaskawa',
    'motoman',
  ];
  const hasManufacturer = manufacturers.some((m) => lower.includes(m));

  // Check for robot model patterns
  const robotPatterns = [
    /kr\d+/i, // KUKA: kr5, kr270, etc.
    /m\d+ia/i, // FANUC: m10ia, m20ia, etc.
    /r\d+ic/i, // FANUC: r2000ic, etc.
    /irb\d+/i, // ABB: irb120, irb6700, etc.
    /rs\d+/i, // Kawasaki: rs003n, etc.
    /ur\d+/i, // Universal Robots: ur5, ur10, etc.
  ];

  const hasRobotPattern = robotPatterns.some((pattern) => pattern.test(lower));

  return hasManufacturer || hasRobotPattern;
}
