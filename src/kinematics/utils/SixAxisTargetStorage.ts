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
 * Robot manufacturer/vendor types
 */
export type RobotVendor = 'FANUC' | 'KUKA' | 'ABB' | 'Kawasaki' | 'Universal' | 'Motoman' | 'Generic';

/**
 * FANUC Frame definitions (like FANUC FRAME, USER_FRAME, TOOL_FRAME)
 * FUT = Frame, User Frame, Tool Frame
 */
export interface FanucFrame {
  frameType: 'FRAME' | 'USER_FRAME' | 'TOOL_FRAME';
  id: number;  // Frame number (0-9 for USER, 0-9 for TOOL)
  name?: string;
  position: [number, number, number];  // mm
  orientation: [number, number, number]; // W,P,R (degrees) - FANUC convention
  // Relationship to base/world
  parentFrame?: number;  // Parent frame ID if hierarchical
}

/**
 * KUKA Status and Turns (configuration disambiguation)
 */
export interface KukaConfiguration {
  status: {
    s1: number;  // Bit 0: Elbow (up=+/down=-)
    s2: number;  // Bit 1: Wrist (flip=+/non-flip=-) 
    s3: number;  // Bit 2: Front/Rear (front=+/rear=-)
  };
  turns: {
    t1: number;  // Full rotations for J1 (continuous joint)
    t2: number;  // Full rotations for J2 (continuous joint)
    t3: number;  // Full rotations for J3 (continuous joint)
    t5?: number; // Full rotations for J5 (if continuous)
    t6?: number; // Full rotations for J6 (if continuous)
  };
}

/**
 * ABB Configuration (similar concept to KUKA Status)
 */
export interface AbbConfiguration {
  cf1: number;  // Configuration bit 1
  cf4: number;  // Configuration bit 4 (elbow)
  cf6: number;  // Configuration bit 6 (wrist)
  cfx: number;  // Additional config flags
}

/**
 * Kawasaki configuration (Kawasaki-specific representation)
 */
export interface KawasakiConfiguration {
  config: number;  // Configuration value (model-specific encoding)
  // Kawasaki may use different representation
}

/**
 * Vendor-specific format adapters
 * These are ONLY used for import/export, not internal storage
 */

/**
 * Convert common configuration to KUKA Status/Turns format
 */
export function toKukaConfig(config: SixAxisTarget['configuration']): KukaConfiguration {
  return {
    status: {
      s1: config.elbow === 'up' ? 1 : -1,
      s2: config.wrist === 'flip' ? 1 : -1,
      s3: config.front === 'front' ? 1 : -1,
    },
    turns: {
      t1: config.turns[0],
      t2: config.turns[1],
      t3: config.turns[2],
      t5: config.turns[4],
      t6: config.turns[5],
    }
  };
}

/**
 * Convert KUKA Status/Turns to common configuration
 */
export function fromKukaConfig(kuka: KukaConfiguration): SixAxisTarget['configuration'] {
  return {
    elbow: kuka.status.s1 > 0 ? 'up' : 'down',
    wrist: kuka.status.s2 > 0 ? 'flip' : 'non-flip',
    front: kuka.status.s3 > 0 ? 'front' : 'rear',
    turns: [
      kuka.turns.t1,
      kuka.turns.t2,
      kuka.turns.t3,
      0, // J4 typically not continuous
      kuka.turns.t5 ?? 0,
      kuka.turns.t6 ?? 0,
    ]
  };
}

/**
 * Convert common configuration to ABB format
 */
export function toAbbConfig(config: SixAxisTarget['configuration']): AbbConfiguration {
  return {
    cf1: config.front === 'front' ? 1 : 0,
    cf4: config.elbow === 'up' ? 1 : 0,
    cf6: config.wrist === 'flip' ? 1 : 0,
    cfx: 0, // Additional flags
  };
}

/**
 * Convert ABB config to common configuration
 */
export function fromAbbConfig(abb: AbbConfiguration): SixAxisTarget['configuration'] {
  return {
    elbow: abb.cf4 > 0 ? 'up' : 'down',
    wrist: abb.cf6 > 0 ? 'flip' : 'non-flip',
    front: abb.cf1 > 0 ? 'front' : 'rear',
    turns: [0, 0, 0, 0, 0, 0], // ABB doesn't explicitly store turns
  };
}

/**
 * Coordinate frame reference (properly defined relative to base)
 */
export interface CoordinateFrame {
  type: 'WORLD' | 'BASE' | 'TOOL' | 'USER';
  frameId?: number;  // Frame number (for FANUC: USER 0-9, TOOL 0-9)
  frameName?: string;
  // Transform relative to parent frame (BASE by default)
  position: [number, number, number];  // mm
  rotation: [number, number, number];  // W,P,R (degrees) - standard robot convention
  // For FANUC: stores the full FRAME/USER_FRAME/TOOL_FRAME definition
  fanucFrame?: FanucFrame;
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
 * UNIFIED TARGET FORMAT - Single Source of Truth for All 6-Axis Robots
 * 
 * Core format that works for all vendors. Joint array is PRIMARY.
 * Model-specific data is stored separately and only used for export/import translation.
 */
export interface SixAxisTarget {
  id: string;
  name: string;
  
  // ============================================================
  // PRIMARY STORAGE - Joint array (common across ALL robots)
  // ============================================================
  // Real robots operate primarily in joint space
  // This is the canonical representation
  joints: [number, number, number, number, number, number]; // J1, J2, J3, J4, J5, J6 in degrees
  
  // ============================================================
  // COMMON CONFIGURATION (computed from joints, stored for efficiency)
  // ============================================================
  // Configuration flags that resolve redundancy (8 solutions for same Cartesian pose)
  // Stored in common format, converted to vendor-specific when needed
  configuration: {
    elbow: 'up' | 'down';        // J3 configuration
    wrist: 'flip' | 'non-flip';  // J5 configuration  
    front: 'front' | 'rear';      // J1/arm orientation
    // Turns for continuous joints (how many full 360° rotations)
    turns: [number, number, number, number, number, number]; // T1-T6 full rotations
  };
  
  // ============================================================
  // COMMON FRAME REFERENCE
  // ============================================================
  // Frame this target is relative to (common across all robots)
  frame: {
    type: 'WORLD' | 'BASE' | 'USER' | 'TOOL';
    frameId?: number;  // Frame number (0-9 for USER/TOOL in most robots)
    frameName?: string;
  };
  
  // ============================================================
  // MOTION PARAMETERS (common across all robots)
  // ============================================================
  motionType: MotionType;
  speed?: SpeedSettings;
  acceleration?: AccelerationSettings;
  
  // ============================================================
  // OPTIONAL: Cartesian (computed from joints, cached for efficiency)
  // ============================================================
  // Only computed/stored when needed for calculations or visualization
  // NOT the source of truth - joints are
  cartesian?: {
    position: [number, number, number];  // mm (x, y, z)
    orientation: [number, number, number]; // W, P, R (degrees)
    quaternion?: [number, number, number, number]; // For internal calculations
  };
  
  // ============================================================
  // VENDOR-SPECIFIC METADATA (stored separately, only for export/import)
  // ============================================================
  // This is NOT used internally - only for translating to/from vendor formats
  // Stored as raw data to avoid loss during round-trip conversion
  vendorMetadata?: {
    vendor: RobotVendor;
    originalFormat?: any;  // Original vendor-specific format (FANUC PR, KUKA Status, etc.)
  };
  
  // ============================================================
  // METADATA
  // ============================================================
  timestamp?: number;
  description?: string;
  taughtBy?: string;
  programLine?: number;
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
  
  // Frame definitions (like FANUC USER_FRAME, TOOL_FRAME)
  // Hierarchical: BASE → USER → TOOL
  frames: {
    userFrames: FanucFrame[];  // USER frames (0-9)
    toolFrames: FanucFrame[];  // TOOL frames (0-9)
    worldFrame?: FanucFrame;   // World/WORK frame if defined
  };
  
  // Target points (like PR[] variables in FANUC, or position registers in other systems)
  // PRIMARY storage: Joint array [J1-J6] + configuration
  // These are taught/defined positions that can be used in sequences
  targets: SixAxisTarget[];
  
  // Sequences - ordered groups of targets/motions within a program
  // Programs contain sequences, sequences contain targets (or instructions)
  sequences: Array<{
    id: string;
    name: string;
    description?: string;
    // What goes in a sequence? Ordered targets? Motion instructions?
    targetIds: string[];  // Ordered list of target IDs in this sequence
    // OR should it be:
    // instructions: Array<...>  // Actual motion/instruction data?
  }>;
  
  // Program structure - how sequences are executed
  // Programs call/execute sequences in order
  program?: {
    sequenceIds: string[];  // Order in which to execute sequences
    // OR program lines that reference sequences/targets?
  };
  
  // Current active settings
  activeTool?: string;
  activeWorkFrame?: string;
}

/**
 * Capture current robot state as target
 * PRIMARY: Joint array [J1-J6]
 * OPTIONAL: Cartesian computed and stored for reference
 */
export function captureCurrentTarget(
  chainName: string,
  targetName: string,
  motionType: MotionType = 'PTP',
  vendor: RobotVendor = 'Generic',
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

  // PRIMARY: Get joint angles (degrees) - this is what real robots store
  const jointConfig = getSixAxisJointConfiguration(chainName);
  if (!jointConfig) {
    return null;
  }

  const joints: [number, number, number, number, number, number] = [
    jointConfig.jointAngles[0] * 180 / Math.PI,
    jointConfig.jointAngles[1] * 180 / Math.PI,
    jointConfig.jointAngles[2] * 180 / Math.PI,
    jointConfig.jointAngles[3] * 180 / Math.PI,
    jointConfig.jointAngles[4] * 180 / Math.PI,
    jointConfig.jointAngles[5] * 180 / Math.PI,
  ];

  // OPTIONAL: Compute Cartesian from joints (if needed for calculations)
  const tcpPose = fkSolver.getTCPPose?.(chainName) || fkSolver.getNullTCPPose(chainName);
  let cartesian: SixAxisTarget['cartesian'] | undefined;
  
  if (tcpPose) {
    // Convert to user space (Z-up, mm)
    const position: [number, number, number] = [
      tcpPose.position.x * 1000,
      tcpPose.position.y * 1000,
      tcpPose.position.z * 1000,
    ];

    // Convert quaternion to W,P,R (robot convention)
    const euler = tcpPose.rotation.toEulerAngles();
    const orientation: [number, number, number] = [
      euler.x * 180 / Math.PI,  // W (roll)
      euler.y * 180 / Math.PI,  // P (pitch)
      euler.z * 180 / Math.PI,  // R (yaw)
    ];

    cartesian = {
      position,
      orientation,
      quaternion: [tcpPose.rotation.x, tcpPose.rotation.y, tcpPose.rotation.z, tcpPose.rotation.w]
    };
  }

  // Calculate common configuration from joint angles
  // This is the single source of truth - works for all robots
  const configuration: SixAxisTarget['configuration'] = {
    elbow: joints[2] > 0 ? 'up' : 'down',  // J3 sign determines elbow
    wrist: Math.abs(joints[4]) < 90 ? 'flip' : 'non-flip',  // J5 angle determines wrist
    front: joints[0] > 0 ? 'front' : 'rear',  // J1 sign determines front/rear
    turns: [
      Math.floor(joints[0] / 360),  // Full rotations for continuous joints
      Math.floor(joints[1] / 360),
      Math.floor(joints[2] / 360),
      0,  // J4 typically not continuous
      Math.floor(joints[4] / 360),
      Math.floor(joints[5] / 360),
    ]
  };

  // Store vendor metadata if provided (for export/import round-trip)
  let vendorMetadata: SixAxisTarget['vendorMetadata'] | undefined;
  if (vendor !== 'Generic') {
    vendorMetadata = {
      vendor,
      // Original format computed on-demand when exporting
    };
  }

  return {
    id: `target_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: targetName,
    joints,  // PRIMARY storage - single source of truth
    configuration,  // Common format computed from joints
    frame: {
      type: 'BASE',
      frameId: undefined,
      frameName: undefined
    },
    motionType,
    cartesian,  // OPTIONAL: computed from joints for efficiency
    vendorMetadata,  // OPTIONAL: only for export/import translation
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
    frames: {
      userFrames: [],
      toolFrames: [],
    },
    targets: [],
    // Program lines will be added as needed - no "sequences", just sequential execution
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
 * Shows PRIMARY data: Joint array + common configuration
 * Shows OPTIONAL: Cartesian if available
 */
export function formatTargetForDisplay(target: SixAxisTarget, showVendorFormat: boolean = false): string {
  const joints = target.joints;
  let output = `${target.name}:\n`;
  
  // PRIMARY: Joints (what real robots show first)
  output += `  Joints: J1=${joints[0].toFixed(1)}° J2=${joints[1].toFixed(1)}° J3=${joints[2].toFixed(1)}° ` +
           `J4=${joints[3].toFixed(1)}° J5=${joints[4].toFixed(1)}° J6=${joints[5].toFixed(1)}°\n`;
  
  // Common configuration (works for all robots)
  const config = target.configuration;
  output += `  Config: Elbow=${config.elbow} Wrist=${config.wrist} Front=${config.front}\n`;
  if (config.turns.some(t => t !== 0)) {
    output += `  Turns: T1=${config.turns[0]} T2=${config.turns[1]} T3=${config.turns[2]} T5=${config.turns[4]} T6=${config.turns[5]}\n`;
  }
  
  // Show vendor-specific format if requested (for export preview)
  if (showVendorFormat && target.vendorMetadata) {
    const vendor = target.vendorMetadata.vendor;
    if (vendor === 'KUKA') {
      const kuka = toKukaConfig(target.configuration);
      output += `  [KUKA] Status: S1=${kuka.status.s1} S2=${kuka.status.s2} S3=${kuka.status.s3}\n`;
    } else if (vendor === 'ABB') {
      const abb = toAbbConfig(target.configuration);
      output += `  [ABB] Config: CF1=${abb.cf1} CF4=${abb.cf4} CF6=${abb.cf6}\n`;
    }
  }
  
  // OPTIONAL: Cartesian (shown if available, but secondary)
  if (target.cartesian) {
    const pos = target.cartesian.position;
    const orient = target.cartesian.orientation;
    output += `  Cartesian: X=${pos[0].toFixed(2)} Y=${pos[1].toFixed(2)} Z=${pos[2].toFixed(2)} mm\n`;
    output += `  Orientation: W=${orient[0].toFixed(1)}° P=${orient[1].toFixed(1)}° R=${orient[2].toFixed(1)}°\n`;
  }
  
  output += `  Motion: ${target.motionType}\n`;
  output += `  Frame: ${target.frame.type}`;
  if (target.frame.frameId !== undefined) {
    output += ` ${target.frame.frameId}`;
  }
  
  return output;
}

/**
 * Export target to vendor-specific format (for compatibility/import into real robots)
 */
export function exportToVendorFormat(target: SixAxisTarget, vendor: RobotVendor): any {
  // Start with common data
  const vendorTarget: any = {
    name: target.name,
    joints: [...target.joints],
    motionType: target.motionType,
  };

  // Add vendor-specific formatting
  switch (vendor) {
    case 'KUKA':
      vendorTarget.status = toKukaConfig(target.configuration).status;
      vendorTarget.turns = toKukaConfig(target.configuration).turns;
      if (target.cartesian) {
        vendorTarget.x = target.cartesian.position[0];
        vendorTarget.y = target.cartesian.position[1];
        vendorTarget.z = target.cartesian.position[2];
        vendorTarget.a = target.cartesian.orientation[0];
        vendorTarget.b = target.cartesian.orientation[1];
        vendorTarget.c = target.cartesian.orientation[2];
      }
      break;
    case 'ABB':
      vendorTarget.config = toAbbConfig(target.configuration);
      if (target.cartesian) {
        vendorTarget.trans = target.cartesian.position;
        vendorTarget.rot = target.cartesian.orientation; // ABB uses quaternion typically
      }
      break;
    case 'FANUC':
      // FANUC PR format
      vendorTarget.pr = {
        j1: target.joints[0],
        j2: target.joints[1],
        j3: target.joints[2],
        j4: target.joints[3],
        j5: target.joints[4],
        j6: target.joints[5],
        // FANUC also stores config flags and optional Cartesian
      };
      if (target.frame.frameId !== undefined) {
        vendorTarget.userFrame = target.frame.frameId;
      }
      if (target.cartesian) {
        vendorTarget.pr.x = target.cartesian.position[0];
        vendorTarget.pr.y = target.cartesian.position[1];
        vendorTarget.pr.z = target.cartesian.position[2];
        vendorTarget.pr.w = target.cartesian.orientation[0];
        vendorTarget.pr.p = target.cartesian.orientation[1];
        vendorTarget.pr.r = target.cartesian.orientation[2];
      }
      break;
    case 'Kawasaki':
      // Kawasaki typically stores as pure joint array
      vendorTarget.joints = target.joints;
      vendorTarget.config = target.configuration; // Simplified for now
      break;
    default:
      // Generic: just return common format
      return target;
  }

  return vendorTarget;
}

/**
 * Import target from vendor-specific format (convert to common format)
 */
export function importFromVendorFormat(vendorData: any, vendor: RobotVendor, targetName: string): SixAxisTarget | null {
  let joints: [number, number, number, number, number, number];
  let configuration: SixAxisTarget['configuration'];

  switch (vendor) {
    case 'KUKA':
      // Extract from KUKA format
      if (!vendorData.joints || !vendorData.status) {
        return null;
      }
      joints = vendorData.joints;
      configuration = fromKukaConfig({
        status: vendorData.status,
        turns: vendorData.turns || { t1: 0, t2: 0, t3: 0, t5: 0, t6: 0 }
      });
      break;
    case 'ABB':
      // Extract from ABB format
      if (!vendorData.trans || !vendorData.config) {
        return null;
      }
      // ABB stores Cartesian, need to solve IK to get joints
      // For now, assume joints provided separately or need IK
      joints = vendorData.joints || [0, 0, 0, 0, 0, 0];
      configuration = fromAbbConfig(vendorData.config);
      break;
    case 'FANUC':
      // Extract from FANUC PR format
      if (vendorData.pr) {
        joints = [
          vendorData.pr.j1 || 0,
          vendorData.pr.j2 || 0,
          vendorData.pr.j3 || 0,
          vendorData.pr.j4 || 0,
          vendorData.pr.j5 || 0,
          vendorData.pr.j6 || 0,
        ];
      } else {
        return null;
      }
      // FANUC config calculation needed
      configuration = {
        elbow: joints[2] > 0 ? 'up' : 'down',
        wrist: Math.abs(joints[4]) < 90 ? 'flip' : 'non-flip',
        front: joints[0] > 0 ? 'front' : 'rear',
        turns: [0, 0, 0, 0, 0, 0], // FANUC doesn't store turns explicitly
      };
      break;
    case 'Kawasaki':
      // Kawasaki pure joint array
      if (Array.isArray(vendorData) && vendorData.length === 6) {
        joints = vendorData as [number, number, number, number, number, number];
      } else if (vendorData.joints && Array.isArray(vendorData.joints)) {
        joints = vendorData.joints as [number, number, number, number, number, number];
      } else {
        return null;
      }
      configuration = {
        elbow: joints[2] > 0 ? 'up' : 'down',
        wrist: Math.abs(joints[4]) < 90 ? 'flip' : 'non-flip',
        front: joints[0] > 0 ? 'front' : 'rear',
        turns: [0, 0, 0, 0, 0, 0], // Kawasaki stores config separately if needed
      };
      break;
    default:
      return null;
  }

  return {
    id: `target_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: targetName,
    joints,
    configuration,
    frame: {
      type: vendorData.frame?.type || 'BASE',
      frameId: vendorData.frame?.frameId,
      frameName: vendorData.frame?.frameName,
    },
    motionType: vendorData.motionType || 'PTP',
    cartesian: vendorData.cartesian,
    vendorMetadata: {
      vendor,
      originalFormat: vendorData,
    },
    timestamp: Date.now(),
  };
}

