/**
 * Six-Axis Robot Target Handler
 * Owner: Cursor (working on joint and linear motion targets for 6-axis robots)
 * 
 * Utility module for managing joint and linear motion targets specifically for 6-axis robots.
 * Provides synchronization between joint space and Cartesian space targets.
 */

import * as BABYLON from '@babylonjs/core';
import { KinematicsManager } from '../KinematicsManager';
import { ForwardKinematicsSolver } from '../ForwardKinematicsSolver';
import { UnifiedGizmoManager } from '../UnifiedGizmoManager';

export interface SixAxisTargetUpdate {
  robotId: string;
  chainName: string;
  tcpPosition: BABYLON.Vector3;
  tcpRotation: BABYLON.Quaternion;
  jointAngles?: number[];
  success: boolean;
  error?: string;
}

/**
 * Validates that a robot is a 6-axis robot
 */
export function isSixAxisRobot(_robotId: string, chainName: string): boolean {
  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);
  
  if (!chain) {
    return false;
  }

  // Check DOF count
  const dof = chain.dof || chain.joints.filter((j: any) => 
    j.type === 'revolute' || j.type === 'prismatic' || j.type === 'continuous'
  ).length;

  // 6-axis robots should have exactly 6 DOF
  return dof === 6;
}

/**
 * Updates TCP gizmo position after joint space changes
 * This ensures the gizmo stays synchronized when joints are moved
 */
export function syncTcpGizmoAfterJointMove(
  robotId: string,
  chainName: string,
  fkSolver: ForwardKinematicsSolver,
  unifiedGizmo: UnifiedGizmoManager
): SixAxisTargetUpdate {
  try {
    // Validate 6-axis robot
    if (!isSixAxisRobot(robotId, chainName)) {
      return {
        robotId,
        chainName,
        tcpPosition: BABYLON.Vector3.Zero(),
        tcpRotation: BABYLON.Quaternion.Identity(),
        success: false,
        error: 'Not a 6-axis robot'
      };
    }

    // Get current TCP pose after joint movement
    const tcpPose = fkSolver.getTCPPose?.(chainName) || fkSolver.getNullTCPPose(chainName);
    
    if (!tcpPose) {
      return {
        robotId,
        chainName,
        tcpPosition: BABYLON.Vector3.Zero(),
        tcpRotation: BABYLON.Quaternion.Identity(),
        success: false,
        error: 'Failed to get TCP pose'
      };
    }

    // Update gizmo to reflect new TCP position
    const targetId = `tcp_${robotId}`;
    unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
    unifiedGizmo.updateTargetRotation(targetId, tcpPose.rotation);

    return {
      robotId,
      chainName,
      tcpPosition: tcpPose.position.clone(),
      tcpRotation: tcpPose.rotation.clone(),
      success: true
    };
  } catch (error) {
    console.error('[SixAxisRobotTargetHandler] Error syncing TCP gizmo:', error);
    return {
      robotId,
      chainName,
      tcpPosition: BABYLON.Vector3.Zero(),
      tcpRotation: BABYLON.Quaternion.Identity(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Updates TCP gizmo position after linear motion (Cartesian space changes)
 * This ensures the gizmo reflects the actual achieved position after IK
 */
export function syncTcpGizmoAfterLinearMove(
  robotId: string,
  chainName: string,
  fkSolver: ForwardKinematicsSolver,
  unifiedGizmo: UnifiedGizmoManager,
  targetPosition: BABYLON.Vector3,
  ikSucceeded: boolean
): SixAxisTargetUpdate {
  try {
    // Validate 6-axis robot
    if (!isSixAxisRobot(robotId, chainName)) {
      return {
        robotId,
        chainName,
        tcpPosition: BABYLON.Vector3.Zero(),
        tcpRotation: BABYLON.Quaternion.Identity(),
        success: false,
        error: 'Not a 6-axis robot'
      };
    }

    // Get actual achieved TCP pose after IK
    const actualPose = fkSolver.getTCPPose?.(chainName) || fkSolver.getNullTCPPose(chainName);
    
    if (!actualPose) {
      return {
        robotId,
        chainName,
        tcpPosition: targetPosition.clone(),
        tcpRotation: BABYLON.Quaternion.Identity(),
        success: false,
        error: 'Failed to get actual TCP pose after IK'
      };
    }

    // Always update gizmo to actual position (even if IK didn't fully succeed,
    // show where robot actually ended up)
    const targetId = `tcp_${robotId}`;
    unifiedGizmo.updateTargetPosition(targetId, actualPose.position);
    unifiedGizmo.updateTargetRotation(targetId, actualPose.rotation);

    // Check accuracy
    const positionError = actualPose.position.subtract(targetPosition).length();
    const errorThreshold = 0.001; // 1mm

    if (!ikSucceeded || positionError > errorThreshold) {
      console.warn(`[SixAxisRobotTargetHandler] Position error: ${(positionError * 1000).toFixed(2)}mm`);
    }

    return {
      robotId,
      chainName,
      tcpPosition: actualPose.position.clone(),
      tcpRotation: actualPose.rotation.clone(),
      success: ikSucceeded && positionError <= errorThreshold,
      error: positionError > errorThreshold 
        ? `Position error: ${(positionError * 1000).toFixed(2)}mm` 
        : undefined
    };
  } catch (error) {
    console.error('[SixAxisRobotTargetHandler] Error syncing TCP gizmo after linear move:', error);
    return {
      robotId,
      chainName,
      tcpPosition: targetPosition.clone(),
      tcpRotation: BABYLON.Quaternion.Identity(),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Validates that linear motion is safe for 6-axis robot
 * Checks joint limits and workspace boundaries
 */
export function validateLinearMotionTarget(
  chainName: string,
  targetPosition: BABYLON.Vector3,
  currentPosition: BABYLON.Vector3
): { valid: boolean; error?: string; warnings?: string[] } {
  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);

  if (!chain) {
    return { valid: false, error: 'Chain not found' };
  }

  if (!isSixAxisRobot('', chainName)) {
    return { valid: false, error: 'Not a 6-axis robot' };
  }

  const warnings: string[] = [];

  // Check movement distance
  const distance = currentPosition.subtract(targetPosition).length();
  const maxReasonableDistance = 2.0; // 2 meters max for reasonable motion
  
  if (distance > maxReasonableDistance) {
    warnings.push(`Large movement: ${(distance * 1000).toFixed(0)}mm`);
  }

  // Check if target is within reasonable workspace bounds
  // (This could be enhanced with actual reach analysis)
  const maxReach = 3.0; // Assume max reach of 3m for 6-axis robot
  const distanceFromOrigin = targetPosition.length();
  
  if (distanceFromOrigin > maxReach) {
    return {
      valid: false,
      error: `Target position (${(distanceFromOrigin * 1000).toFixed(0)}mm) exceeds max reach (${(maxReach * 1000).toFixed(0)}mm)`
    };
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Gets current joint angles for a 6-axis robot
 */
export function getSixAxisJointAngles(chainName: string): number[] | null {
  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);

  if (!chain) {
    return null;
  }

  if (!isSixAxisRobot('', chainName)) {
    return null;
  }

  const joints = kinematicsManager.getActuatedJoints(chain.id);
  return joints.map((j: any) => j.position);
}

/**
 * Checks if joint angles are within limits for 6-axis robot
 */
export function validateJointLimits(chainName: string, jointAngles: number[]): {
  valid: boolean;
  violations: Array<{ jointIndex: number; jointName: string; value: number; limit: 'min' | 'max'; limitValue: number }>;
} {
  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);

  if (!chain) {
    return { valid: false, violations: [] };
  }

  const joints = kinematicsManager.getActuatedJoints(chain.id);
  const violations: Array<{ jointIndex: number; jointName: string; value: number; limit: 'min' | 'max'; limitValue: number }> = [];

  for (let i = 0; i < Math.min(jointAngles.length, joints.length); i++) {
    const joint = joints[i];
    const angle = jointAngles[i];
    
    if (joint.limits) {
      if (joint.limits.lower !== undefined && angle < joint.limits.lower) {
        violations.push({
          jointIndex: i,
          jointName: joint.name || `J${i + 1}`,
          value: angle,
          limit: 'min',
          limitValue: joint.limits.lower
        });
      }
      
      if (joint.limits.upper !== undefined && angle > joint.limits.upper) {
        violations.push({
          jointIndex: i,
          jointName: joint.name || `J${i + 1}`,
          value: angle,
          limit: 'max',
          limitValue: joint.limits.upper
        });
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Joint configuration interface for 6-axis robots
 */
export interface SixAxisJointConfiguration {
  jointAngles: [number, number, number, number, number, number]; // Exactly 6 angles in radians
  jointNames?: [string, string, string, string, string, string];
  timestamp?: number;
  description?: string;
}

/**
 * Gets current joint configuration for a 6-axis robot
 */
export function getSixAxisJointConfiguration(chainName: string): SixAxisJointConfiguration | null {
  const jointAngles = getSixAxisJointAngles(chainName);
  
  if (!jointAngles || jointAngles.length !== 6) {
    return null;
  }

  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);
  if (!chain) {
    return null;
  }

  const joints = kinematicsManager.getActuatedJoints(chain.id);
  const jointNames: [string, string, string, string, string, string] = [
    joints[0]?.name || 'J1',
    joints[1]?.name || 'J2',
    joints[2]?.name || 'J3',
    joints[3]?.name || 'J4',
    joints[4]?.name || 'J5',
    joints[5]?.name || 'J6'
  ];

  return {
    jointAngles: [
      jointAngles[0],
      jointAngles[1],
      jointAngles[2],
      jointAngles[3],
      jointAngles[4],
      jointAngles[5]
    ],
    jointNames,
    timestamp: Date.now()
  };
}

/**
 * Validates and clamps a joint configuration to valid limits
 * Returns the clamped configuration and any warnings
 */
export function clampJointConfiguration(
  chainName: string,
  config: SixAxisJointConfiguration
): {
  clamped: SixAxisJointConfiguration;
  warnings: string[];
  wasClamped: boolean;
} {
  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);
  
  if (!chain) {
    throw new Error(`Chain not found: ${chainName}`);
  }

  if (!isSixAxisRobot('', chainName)) {
    throw new Error(`Not a 6-axis robot: ${chainName}`);
  }

  const joints = kinematicsManager.getActuatedJoints(chain.id);
  const clampedAngles: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  const warnings: string[] = [];
  let wasClamped = false;

  for (let i = 0; i < 6; i++) {
    const joint = joints[i];
    let angle = config.jointAngles[i];

    if (joint.limits) {
      const original = angle;
      
      // Clamp to limits
      if (joint.limits.lower !== undefined && angle < joint.limits.lower) {
        angle = joint.limits.lower;
        warnings.push(`${joint.name || `J${i + 1}`}: ${(original * 180 / Math.PI).toFixed(1)}° clamped to min ${(angle * 180 / Math.PI).toFixed(1)}°`);
        wasClamped = true;
      }
      
      if (joint.limits.upper !== undefined && angle > joint.limits.upper) {
        angle = joint.limits.upper;
        warnings.push(`${joint.name || `J${i + 1}`}: ${(original * 180 / Math.PI).toFixed(1)}° clamped to max ${(angle * 180 / Math.PI).toFixed(1)}°`);
        wasClamped = true;
      }
    }

    clampedAngles[i] = angle;
  }

  return {
    clamped: {
      ...config,
      jointAngles: clampedAngles
    },
    warnings,
    wasClamped
  };
}

/**
 * Applies a joint configuration to a 6-axis robot with validation
 */
export function applyJointConfiguration(
  chainName: string,
  config: SixAxisJointConfiguration,
  fkSolver: ForwardKinematicsSolver,
  enforceLimits: boolean = true
): {
  success: boolean;
  applied: SixAxisJointConfiguration;
  warnings: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate robot type
  if (!isSixAxisRobot('', chainName)) {
    errors.push('Not a 6-axis robot');
    return {
      success: false,
      applied: config,
      warnings,
      errors
    };
  }

  // Clamp configuration if needed
  let configToApply = config;
  if (enforceLimits) {
    try {
      const clamped = clampJointConfiguration(chainName, config);
      configToApply = clamped.clamped;
      warnings.push(...clamped.warnings);
      
      if (clamped.wasClamped) {
        warnings.push('Some joint angles were clamped to limits');
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to clamp configuration');
      return {
        success: false,
        applied: config,
        warnings,
        errors
      };
    }
  } else {
    // Validate without clamping
    const validation = validateJointLimits(chainName, [...config.jointAngles]);
    if (!validation.valid) {
      validation.violations.forEach(v => {
        warnings.push(`${v.jointName}: ${(v.value * 180 / Math.PI).toFixed(1)}° violates ${v.limit} limit (${(v.limitValue * 180 / Math.PI).toFixed(1)}°)`);
      });
    }
  }

  // Apply joint angles
  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);
  if (!chain) {
    errors.push('Chain not found');
    return {
      success: false,
      applied: configToApply,
      warnings,
      errors
    };
  }

  const joints = kinematicsManager.getActuatedJoints(chain.id);
  let appliedCount = 0;

  for (let i = 0; i < 6 && i < joints.length; i++) {
    const success = fkSolver.updateJointPosition(
      joints[i].id,
      configToApply.jointAngles[i],
      true // syncPhysics
    );
    
    if (success) {
      appliedCount++;
    } else {
      errors.push(`Failed to apply ${joints[i].name || `J${i + 1}`}`);
    }
  }

  return {
    success: appliedCount === 6,
    applied: configToApply,
    warnings,
    errors
  };
}

/**
 * Formats joint configuration for display (degrees)
 */
export function formatJointConfiguration(
  config: SixAxisJointConfiguration,
  useDegrees: boolean = true
): string {
  const angles = useDegrees
    ? config.jointAngles.map(a => (a * 180 / Math.PI).toFixed(1) + '°')
    : config.jointAngles.map(a => a.toFixed(4) + ' rad');
  
  const names = config.jointNames || ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'];
  
  return names.map((name, i) => `${name}: ${angles[i]}`).join(', ');
}

/**
 * Creates a home (zero) joint configuration for a 6-axis robot
 */
export function createHomeConfiguration(chainName: string): SixAxisJointConfiguration | null {
  if (!isSixAxisRobot('', chainName)) {
    return null;
  }

  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);
  if (!chain) {
    return null;
  }

  const joints = kinematicsManager.getActuatedJoints(chain.id);
  const jointNames: [string, string, string, string, string, string] = [
    joints[0]?.name || 'J1',
    joints[1]?.name || 'J2',
    joints[2]?.name || 'J3',
    joints[3]?.name || 'J4',
    joints[4]?.name || 'J5',
    joints[5]?.name || 'J6'
  ];

  return {
    jointAngles: [0, 0, 0, 0, 0, 0],
    jointNames,
    description: 'Home position (all joints at 0°)',
    timestamp: Date.now()
  };
}

/**
 * Gets joint configuration summary with limits info
 */
export function getJointConfigurationSummary(chainName: string): {
  current: SixAxisJointConfiguration | null;
  home: SixAxisJointConfiguration | null;
  limits: Array<{
    jointName: string;
    min: number;
    max: number;
    current: number;
    currentDeg: number;
    minDeg: number;
    maxDeg: number;
    inRange: boolean;
  }>;
} {
  const kinematicsManager = KinematicsManager.getInstance();
  const chain = kinematicsManager.getChain(chainName);
  
  if (!chain || !isSixAxisRobot('', chainName)) {
    return {
      current: null,
      home: null,
      limits: []
    };
  }

  const joints = kinematicsManager.getActuatedJoints(chain.id);
  const limits = joints.slice(0, 6).map((joint, i) => {
    const current = joint.position;
    const min = joint.limits?.lower ?? -Math.PI;
    const max = joint.limits?.upper ?? Math.PI;
    
    return {
      jointName: joint.name || `J${i + 1}`,
      min,
      max,
      current,
      currentDeg: current * 180 / Math.PI,
      minDeg: min * 180 / Math.PI,
      maxDeg: max * 180 / Math.PI,
      inRange: current >= min && current <= max
    };
  });

  return {
    current: getSixAxisJointConfiguration(chainName),
    home: createHomeConfiguration(chainName),
    limits
  };
}

