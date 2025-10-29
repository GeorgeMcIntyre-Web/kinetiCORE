/**
 * Six-Axis Robot Target Storage
 * Owner: Cursor (working on joint and linear motion targets for 6-axis robots)
 * 
 * Storage format compatible with real robot programming (FANUC, ABB, KUKA)
 * Stores targets with both Cartesian and joint configurations
 */

import { KinematicsManager } from '../KinematicsManager';
import { ForwardKinematicsSolver } from '../ForwardKinematicsSolver';
import { 
  SixAxisJointConfiguration, 
  getSixAxisJointConfiguration,
  isSixAxisRobot 
} from './SixAxisRobotTargetHandler';
import * as BABYLON from '@babylonjs/core';

/**
 * Real robot motion types
 */
export type MotionType = 
  | 'JOINT'      // Joint interpolation (move joints simultaneously)
  | 'LINEAR'     // Linear interpolation (straight-line TCP motion)
  | 'CIRCULAR'   // Circular interpolation (arc motion)
  | 'PTP';       // Point-to-point (fastest path, may not be linear)

/**
 * Coordinate frame reference
 */
export interface CoordinateFrame {
  type: 'WORLD' | 'BASE' | 'TOOL' | 'USER';
  id?: string;
  name?: string;
  offset?: {
    position: [number, number, number];
    rotation: [number, number, number, number]; // Quaternion
  };
}

/**
 * Speed settings (like real robots)
 */
export interface SpeedSettings {
  linear?: number;     // mm/s for linear motion
  angular?: number;   // deg/s for joint motion
  tcp?: number;       // mm/s TCP velocity (for LINEAR motion)
  override?: number;  // Speed override (0-100%)
}

/**
 * Acceleration settings
 */
export interface AccelerationSettings {
  linear?: number;    // mm/s²
  angular?: number;   // deg/s²
  override?: number;  // Accel override (0-100%)
}

/**
 * Target point for 6-axis robot (like FANUC PR[], ABB robtarget, KUKA PTP/LIN)
 */
export interface SixAxisTarget {
  id: string;
  name: string;
  
  // Cartesian coordinates (in specified frame)
  position: {
    x: number;  // mm
    y: number;  // mm
    z: number;  // mm
  };
  
  // Orientation (Euler angles or quaternion)
  orientation: {
    // Euler angles (degrees) - most common in real robots
    rx?: number;  // Roll (degrees)
    ry?: number;  // Pitch (degrees)
    rz?: number;  // Yaw (degrees)
    // Or quaternion
    quaternion?: [number, number, number, number]; // [x, y, z, w]
  };
  
  // Joint configuration (when target was taught)
  // Real robots store this for each target point
  jointConfiguration?: {
    j1: number;  // degrees
    j2: number;
    j3: number;
    j4: number;
    j5: number;
    j6: number;
  };
  
  // Motion parameters
  motionType: MotionType;
  coordinateFrame: CoordinateFrame;
  speed?: SpeedSettings;
  acceleration?: AccelerationSettings;
  
  // Configuration flags (like real robots)
  configuration?: {
    flip?: boolean;      // Elbow up/down
    front?: boolean;     // Front/rear
    wrist?: number;      // Wrist configuration index
  };
  
  // Metadata
  timestamp?: number;
  description?: string;
  createdBy?: string;
  programPosition?: number;  // Position in program sequence
}

/**
 * Complete target storage for 6-axis robot
 * Similar to FANUC program, ABB module, or KUKA SRC file
 */
export interface SixAxisTargetProgram {
  robotId: string;
  robotName: string;
  robotModel?: string;  // e.g., "FANUC M-20iA", "ABB IRB 2600"
  
  // Program metadata
  programName: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  author?: string;
  description?: string;
  
  // Tool/TCP definitions (like TOOL_DATA)
  tools: Array<{
    id: string;
    name: string;
    tcpOffset: {
      position: [number, number, number];  // mm
      rotation: [number, number, number, number]; // Quaternion
    };
    weight?: number;  // kg
    cog?: [number, number, number];  // Center of gravity (mm)
  }>;
  
  // Work object/coordinate frame definitions (like USER_FRAME)
  workFrames: Array<{
    id: string;
    name: string;
    position: [number, number, number];
    rotation: [number, number, number, number];
  }>;
  
  // Target points (like PR[] variables in FANUC)
  targets: SixAxisTarget[];
  
  // Motion sequences (program structure)
  sequences: Array<{
    id: string;
    name: string;
    targetIds: string[];  // Sequence of target IDs
    loop?: boolean;
    repeatCount?: number;
  }>;
  
  // Current active settings
  activeTool?: string;
  activeWorkFrame?: string;
}

/**
 * Convert current robot state to SixAxisTarget
 */
export function captureCurrentTarget(
  chainName: string,
  targetName: string,
  motionType: MotionType = 'PTP',
  fkSolver: ForwardKinematicsSolver
): SixAxisTarget | null {
  if (!isSixAxisRobot('', chainName)) {
    return null;
  }

  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);
  if (!chain) {
    return null;
  }

  // Get TCP pose (Cartesian)
  const tcpPose = fkSolver.getTCPPose?.(chainName) || fkSolver.getNullTCPPose(chainName);
  if (!tcpPose) {
    return null;
  }

  // Get joint configuration
  const jointConfig = getSixAxisJointConfiguration(chainName);
  if (!jointConfig) {
    return null;
  }

  // Convert to user space (Z-up, mm)
  const userPos = {
    x: tcpPose.position.x * 1000,  // meters to mm
    y: tcpPose.position.y * 1000,
    z: tcpPose.position.z * 1000,
  };

  // Convert quaternion to Euler angles (degrees)
  const euler = tcpPose.rotation.toEulerAngles();

  // Convert joint angles to degrees
  const jointAnglesDeg = jointConfig.jointAngles.map(a => a * 180 / Math.PI);

  return {
    id: `target_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: targetName,
    position: userPos,
    orientation: {
      rx: euler.x * 180 / Math.PI,
      ry: euler.y * 180 / Math.PI,
      rz: euler.z * 180 / Math.PI,
      quaternion: [tcpPose.rotation.x, tcpPose.rotation.y, tcpPose.rotation.z, tcpPose.rotation.w]
    },
    jointConfiguration: {
      j1: jointAnglesDeg[0],
      j2: jointAnglesDeg[1],
      j3: jointAnglesDeg[2],
      j4: jointAnglesDeg[3],
      j5: jointAnglesDeg[4],
      j6: jointAnglesDeg[5],
    },
    motionType,
    coordinateFrame: {
      type: 'BASE'
    },
    timestamp: Date.now()
  };
}

/**
 * Export target program to JSON (for saving/sharing)
 */
export function exportTargetProgram(program: SixAxisTargetProgram): string {
  // Create serializable version (convert Dates to ISO strings)
  const serializable = {
    ...program,
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
    targets: program.targets.map(t => ({
      ...t,
      timestamp: t.timestamp || undefined
    }))
  };

  return JSON.stringify(serializable, null, 2);
}

/**
 * Import target program from JSON
 */
export function importTargetProgram(jsonString: string): SixAxisTargetProgram | null {
  try {
    const parsed = JSON.parse(jsonString);
    
    // Restore Date objects
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
    } as SixAxisTargetProgram;
  } catch (error) {
    console.error('[SixAxisTargetStorage] Failed to import program:', error);
    return null;
  }
}

/**
 * Convert SixAxisTarget to Babylon space (for IK solving)
 */
export function targetToBabylonSpace(target: SixAxisTarget): {
  position: BABYLON.Vector3;
  rotation: BABYLON.Quaternion;
} {
  // Convert from user space (Z-up, mm) to Babylon space (Y-up, meters)
  const position = new BABYLON.Vector3(
    target.position.x / 1000,      // mm to meters
    target.position.z / 1000,      // Z-up to Y-up
    -target.position.y / 1000       // Y to -Z
  );

  let rotation: BABYLON.Quaternion;

  if (target.orientation.quaternion) {
    // Use quaternion directly (convert if needed from user space)
    const [x, y, z, w] = target.orientation.quaternion;
    rotation = new BABYLON.Quaternion(x, z, -y, w); // Convert Z-up to Y-up
  } else {
    // Build quaternion from Euler angles
    const rx = (target.orientation.rx || 0) * Math.PI / 180;
    const ry = (target.orientation.ry || 0) * Math.PI / 180;
    const rz = (target.orientation.rz || 0) * Math.PI / 180;

    // Create quaternion from Euler angles (ZYX convention for user space)
    const qx = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Right(), rx);
    const qy = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Forward(), ry);
    const qz = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), rz);
    
    rotation = qz.multiply(qy).multiply(qx);
    
    // Convert to Y-up (Babylon)
    // This is a simplified conversion - may need adjustment based on your coordinate system
    rotation = new BABYLON.Quaternion(rotation.x, rotation.z, -rotation.y, rotation.w);
  }

  return { position, rotation };
}

/**
 * Convert from Babylon space to SixAxisTarget format
 */
export function babylonToTarget(
  position: BABYLON.Vector3,
  rotation: BABYLON.Quaternion,
  targetName: string = 'Target',
  motionType: MotionType = 'PTP'
): Omit<SixAxisTarget, 'id' | 'jointConfiguration'> {
  // Convert from Babylon (Y-up, meters) to user space (Z-up, mm)
  const userPos = {
    x: position.x * 1000,
    y: -position.z * 1000,  // Convert Y-up to Z-up
    z: position.y * 1000,
  };

  // Convert quaternion to Euler
  const euler = rotation.toEulerAngles();

  return {
    name: targetName,
    position: userPos,
    orientation: {
      rx: euler.x * 180 / Math.PI,
      ry: euler.y * 180 / Math.PI,
      rz: euler.z * 180 / Math.PI,
      quaternion: [rotation.x, rotation.z, -rotation.y, rotation.w]
    },
    motionType,
    coordinateFrame: {
      type: 'BASE'
    }
  };
}

/**
 * Create a new target program for a 6-axis robot
 */
export function createTargetProgram(
  robotId: string,
  robotName: string,
  programName: string,
  robotModel?: string
): SixAxisTargetProgram {
  return {
    robotId,
    robotName,
    robotModel,
    programName,
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    tools: [],
    workFrames: [],
    targets: [],
    sequences: []
  };
}

/**
 * Add target to program
 */
export function addTargetToProgram(
  program: SixAxisTargetProgram,
  target: SixAxisTarget
): SixAxisTargetProgram {
  return {
    ...program,
    targets: [...program.targets, target],
    updatedAt: new Date()
  };
}

/**
 * Get target by ID
 */
export function getTargetById(
  program: SixAxisTargetProgram,
  targetId: string
): SixAxisTarget | undefined {
  return program.targets.find(t => t.id === targetId);
}

/**
 * Format target for display (like robot teach pendant)
 */
export function formatTargetForDisplay(target: SixAxisTarget): string {
  const pos = target.position;
  const orient = target.orientation;
  
  return `${target.name}:\n` +
    `  Position: X=${pos.x.toFixed(2)} Y=${pos.y.toFixed(2)} Z=${pos.z.toFixed(2)} mm\n` +
    `  Orientation: Rx=${orient.rx?.toFixed(1)}° Ry=${orient.ry?.toFixed(1)}° Rz=${orient.rz?.toFixed(1)}°\n` +
    (target.jointConfiguration ? 
      `  Joints: J1=${target.jointConfiguration.j1.toFixed(1)}° J2=${target.jointConfiguration.j2.toFixed(1)}° J3=${target.jointConfiguration.j3.toFixed(1)}° ` +
      `J4=${target.jointConfiguration.j4.toFixed(1)}° J5=${target.jointConfiguration.j5.toFixed(1)}° J6=${target.jointConfiguration.j6.toFixed(1)}°\n` :
      '') +
    `  Motion: ${target.motionType}\n` +
    `  Frame: ${target.coordinateFrame.type}`;
}

