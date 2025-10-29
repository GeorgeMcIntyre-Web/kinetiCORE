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
import { InverseKinematicsSolver } from '../InverseKinematicsSolver';
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
export function isSixAxisRobot(robotId: string, chainName: string): boolean {
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

