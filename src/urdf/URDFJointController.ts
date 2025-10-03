/**
 * URDF Joint Controller
 * Controls robot joint positions and velocities
 */

import * as BABYLON from '@babylonjs/core';
import type { IPhysicsEngine } from '../physics/IPhysicsEngine';
import type { URDFJointController as IURDFJointController } from './types';

/**
 * Controls URDF robot joints
 * Note: Full implementation requires joint constraint support in IPhysicsEngine
 * Current implementation provides kinematic control (direct position setting)
 */
export class URDFJointController implements IURDFJointController {
  private jointStates = new Map<string, JointState>();
  private bodyHandles: Map<string, string>;
  private physicsEngine: IPhysicsEngine;

  constructor(
    physicsEngine: IPhysicsEngine,
    bodyHandles: Map<string, string>
  ) {
    this.physicsEngine = physicsEngine;
    this.bodyHandles = bodyHandles;
  }

  /**
   * Set target angle for revolute/continuous joint
   * @param jointName - Joint name
   * @param targetAngle - Target angle in radians
   */
  setJointAngle(jointName: string, targetAngle: number): void {
    let state = this.jointStates.get(jointName);
    if (!state) {
      state = {
        targetAngle,
        currentAngle: 0,
        targetVelocity: 0,
        currentVelocity: 0,
      };
      this.jointStates.set(jointName, state);
    }

    state.targetAngle = targetAngle;

    // TODO: When IPhysicsEngine supports joints, apply motor target
    // For now, this just stores the target state
    console.log(`Joint ${jointName} target angle set to ${targetAngle} rad`);
  }

  /**
   * Set target velocity for joint
   * @param jointName - Joint name
   * @param velocity - Target velocity (rad/s for revolute, m/s for prismatic)
   */
  setJointVelocity(jointName: string, velocity: number): void {
    let state = this.jointStates.get(jointName);
    if (!state) {
      state = {
        targetAngle: 0,
        currentAngle: 0,
        targetVelocity: velocity,
        currentVelocity: 0,
      };
      this.jointStates.set(jointName, state);
    }

    state.targetVelocity = velocity;

    // TODO: When IPhysicsEngine supports joints, apply motor velocity
    console.log(`Joint ${jointName} target velocity set to ${velocity}`);
  }

  /**
   * Get current joint angle
   * @param jointName - Joint name
   * @returns Current angle in radians
   */
  getJointAngle(jointName: string): number {
    const state = this.jointStates.get(jointName);
    return state?.currentAngle || 0;

    // TODO: When IPhysicsEngine supports joints, read from joint constraint
  }

  /**
   * Get current joint velocity
   * @param jointName - Joint name
   * @returns Current velocity
   */
  getJointVelocity(jointName: string): number {
    const state = this.jointStates.get(jointName);
    return state?.currentVelocity || 0;

    // TODO: When IPhysicsEngine supports joints, read from joint constraint
  }

  /**
   * Set link pose directly (kinematic mode)
   * Useful for inverse kinematics or animation
   * @param linkName - Link name
   * @param position - Target position
   * @param rotation - Target rotation
   */
  setLinkPoseKinematic(
    linkName: string,
    position: BABYLON.Vector3,
    rotation: BABYLON.Quaternion
  ): void {
    const handle = this.bodyHandles.get(linkName);
    if (!handle) {
      console.warn(`No physics body found for link ${linkName}`);
      return;
    }

    // Update physics body transform directly
    this.physicsEngine.updateRigidBodyTransform(
      handle,
      {
        x: position.x,
        y: position.y,
        z: position.z,
      },
      {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
        w: rotation.w,
      }
    );
  }

  /**
   * Update joint states (call each frame)
   * @param deltaTime - Time step in seconds
   */
  update(deltaTime: number): void {
    // TODO: When joints are supported, update joint motors here
    // For now, this would integrate velocity to position
    this.jointStates.forEach((state, _jointName) => {
      if (state.targetVelocity !== 0) {
        state.currentAngle += state.targetVelocity * deltaTime;
        state.currentVelocity = state.targetVelocity;
      } else if (state.targetAngle !== state.currentAngle) {
        // Simple position control with damping
        const error = state.targetAngle - state.currentAngle;
        const velocity = error * 5.0; // P controller
        state.currentAngle += velocity * deltaTime;
        state.currentVelocity = velocity;
      }
    });
  }

  /**
   * Reset all joints to zero position
   */
  reset(): void {
    this.jointStates.forEach((state) => {
      state.currentAngle = 0;
      state.targetAngle = 0;
      state.currentVelocity = 0;
      state.targetVelocity = 0;
    });
  }

  /**
   * Dispose controller resources
   */
  dispose(): void {
    this.jointStates.clear();
  }
}

/**
 * Internal joint state
 */
interface JointState {
  targetAngle: number;
  currentAngle: number;
  targetVelocity: number;
  currentVelocity: number;
}
