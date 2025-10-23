/**
 * Kinematics Target Structure Types
 * Owner: George (Agent 1 - Project Manager)
 * 
 * Unified transformation array structure with metadata for all robot types
 * Supports: 6-axis industrial robots, humanoids, quadrupeds, collaborative robots, mobile manipulators
 */

import * as BABYLON from '@babylonjs/core';

/**
 * Supported robot types
 */
export type RobotType = 
  | 'serial-6axis'          // FANUC, ABB, KUKA industrial arms
  | 'humanoid'              // Full-body robots with multiple limbs
  | 'quadruped'             // Boston Dynamics Spot, Unitree Go1
  | 'collaborative'         // UR10, Franka Emika
  | 'mobile-manipulator'    // TurtleBot with arm
  | 'dual-arm'              // Robots with two arms (e.g., YuMi, Baxter)
  | 'custom';               // User-defined robot configurations

/**
 * Target type classification
 */
export type TargetType = 
  | 'end-effector'  // End of kinematic chain (tool, gripper)
  | 'base'          // Robot base/pelvis
  | 'foot'          // For legged robots
  | 'hand'          // For humanoids
  | 'head'          // For humanoids with head tracking
  | 'elbow'         // Intermediate joint constraint
  | 'knee'          // Intermediate joint constraint
  | 'custom';       // User-defined target

/**
 * Transform data (homogeneous transformation matrix)
 */
export interface Transform {
  position: [number, number, number];           // [x, y, z] in meters
  rotation: [number, number, number, number];   // Quaternion [x, y, z, w]
  scale?: [number, number, number];             // Optional scale (default: [1, 1, 1])
}

/**
 * Translation constraints (min/max bounds in meters)
 */
export interface TranslationLimits {
  min: [number, number, number];  // [x_min, y_min, z_min]
  max: [number, number, number];  // [x_max, y_max, z_max]
}

/**
 * Rotation constraints (min/max bounds in radians)
 */
export interface RotationLimits {
  min: [number, number, number];  // [roll_min, pitch_min, yaw_min] in radians
  max: [number, number, number];  // [roll_max, pitch_max, yaw_max] in radians
}

/**
 * Constraint metadata for IK solver
 */
export interface ConstraintMetadata {
  translationLimits?: TranslationLimits;
  rotationLimits?: RotationLimits;
  priority?: number;  // For multi-target IK (0 = highest priority, 1 = lower, etc.)
  weight?: number;    // Weight for weighted IK (0.0 - 1.0, default: 1.0)
}

/**
 * Visual metadata for 3D gizmo display
 */
export interface VisualMetadata {
  color?: string;      // Hex color (e.g., '#FF5733')
  size?: number;       // Gizmo size multiplier (default: 1.0)
  visible?: boolean;   // Show/hide gizmo in viewport
  label?: string;      // Display label (e.g., 'Left Hand', 'Right Foot')
  icon?: string;       // Icon identifier for UI (e.g., 'hand', 'foot', 'tool')
}

/**
 * Robot-specific metadata
 */
export interface RobotMetadata {
  robotType: RobotType;
  chainId: string;           // Reference to kinematic chain ID
  jointIndices?: number[];   // Affected joint indices in chain
  dofCount?: number;         // Degrees of freedom controlled by this target
}

/**
 * Kinematic Target
 * Represents a single target position/orientation for IK solving
 */
export interface KinematicTarget {
  // Unique identifier
  id: string;

  // Target type metadata
  type: TargetType;

  // Transform data (homogeneous transformation matrix)
  transform: Transform;

  // Parent reference (for hierarchical targets)
  parentId?: string;

  // Constraint metadata
  constraints?: ConstraintMetadata;

  // Visual metadata
  visual?: VisualMetadata;

  // Robot-specific metadata
  robotMetadata: RobotMetadata;

  // User-defined metadata (flexible for custom applications)
  userData?: Record<string, any>;
}

/**
 * Target Array
 * Collection of targets for a specific robot with metadata
 */
export interface TargetArray {
  // Robot identification
  robotId: string;
  robotName: string;
  robotType: RobotType;

  // Target collection
  targets: KinematicTarget[];

  // Metadata
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;  // Schema version (e.g., '1.0.0')
    description?: string;
  };

  // Optional: Pre-defined poses (keyframes)
  keyframes?: RobotKeyframe[];
}

/**
 * Robot Keyframe (named pose)
 */
export interface RobotKeyframe {
  id: string;
  name: string;
  description?: string;
  targets: KinematicTarget[];  // Snapshot of all targets at this pose
  timestamp: Date;
}

/**
 * Helper: Convert Transform to BABYLON transformation
 */
export function transformToBabylon(transform: Transform): {
  position: BABYLON.Vector3;
  rotation: BABYLON.Quaternion;
  scale: BABYLON.Vector3;
} {
  return {
    position: new BABYLON.Vector3(...transform.position),
    rotation: new BABYLON.Quaternion(...transform.rotation),
    scale: transform.scale 
      ? new BABYLON.Vector3(...transform.scale)
      : new BABYLON.Vector3(1, 1, 1),
  };
}

/**
 * Helper: Convert BABYLON transformation to Transform
 */
export function babylonToTransform(
  position: BABYLON.Vector3,
  rotation: BABYLON.Quaternion,
  scale?: BABYLON.Vector3
): Transform {
  return {
    position: [position.x, position.y, position.z],
    rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
    scale: scale ? [scale.x, scale.y, scale.z] : undefined,
  };
}

/**
 * Helper: Create default visual metadata
 */
export function createDefaultVisual(type: TargetType): VisualMetadata {
  const colors: Record<TargetType, string> = {
    'end-effector': '#FF5733',  // Orange-red
    'base': '#3498DB',          // Blue
    'foot': '#2ECC71',          // Green
    'hand': '#F39C12',          // Yellow-orange
    'head': '#9B59B6',          // Purple
    'elbow': '#95A5A6',         // Gray
    'knee': '#95A5A6',          // Gray
    'custom': '#ECF0F1',        // Light gray
  };

  return {
    color: colors[type],
    size: 1.0,
    visible: true,
    label: type.charAt(0).toUpperCase() + type.slice(1),
  };
}

/**
 * Helper: Validate target array schema
 */
export function validateTargetArray(targetArray: TargetArray): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate robot ID
  if (!targetArray.robotId || targetArray.robotId.trim() === '') {
    errors.push('Robot ID is required');
  }

  // Validate targets
  if (!Array.isArray(targetArray.targets)) {
    errors.push('Targets must be an array');
  } else {
    targetArray.targets.forEach((target, index) => {
      // Validate target ID
      if (!target.id || target.id.trim() === '') {
        errors.push(`Target at index ${index} missing ID`);
      }

      // Validate transform
      if (!target.transform) {
        errors.push(`Target ${target.id} missing transform`);
      } else {
        if (!Array.isArray(target.transform.position) || target.transform.position.length !== 3) {
          errors.push(`Target ${target.id} has invalid position (must be [x, y, z])`);
        }
        if (!Array.isArray(target.transform.rotation) || target.transform.rotation.length !== 4) {
          errors.push(`Target ${target.id} has invalid rotation (must be [x, y, z, w])`);
        }
      }

      // Validate robot metadata
      if (!target.robotMetadata) {
        errors.push(`Target ${target.id} missing robot metadata`);
      } else {
        if (!target.robotMetadata.chainId) {
          errors.push(`Target ${target.id} missing chain ID`);
        }
      }

      // Validate priority (if specified)
      if (target.constraints?.priority !== undefined) {
        if (target.constraints.priority < 0) {
          errors.push(`Target ${target.id} has negative priority (must be >= 0)`);
        }
      }

      // Validate weight (if specified)
      if (target.constraints?.weight !== undefined) {
        if (target.constraints.weight < 0 || target.constraints.weight > 1) {
          errors.push(`Target ${target.id} has invalid weight (must be 0.0 - 1.0)`);
        }
      }
    });
  }

  // Validate metadata
  if (!targetArray.metadata) {
    errors.push('Metadata is required');
  } else {
    if (!targetArray.metadata.version) {
      errors.push('Metadata version is required');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Helper: Clone a target array (deep copy)
 */
export function cloneTargetArray(targetArray: TargetArray): TargetArray {
  return JSON.parse(JSON.stringify(targetArray));
}

/**
 * Helper: Merge two target arrays
 * Targets in `updates` will override targets with same ID in `base`
 */
export function mergeTargetArrays(base: TargetArray, updates: TargetArray): TargetArray {
  const merged = cloneTargetArray(base);

  // Update robot metadata
  merged.robotName = updates.robotName;
  merged.robotType = updates.robotType;
  merged.metadata.updatedAt = new Date();

  // Merge targets
  const targetMap = new Map<string, KinematicTarget>();
  
  // Add base targets
  merged.targets.forEach(target => {
    targetMap.set(target.id, target);
  });

  // Override with updates
  updates.targets.forEach(target => {
    targetMap.set(target.id, target);
  });

  merged.targets = Array.from(targetMap.values());

  return merged;
}
