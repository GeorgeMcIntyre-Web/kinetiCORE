/**
 * URDF Physics Integration
 * Integrates URDF robot models with kinetiCORE physics abstraction
 * Owner: George (physics integration)
 */

import * as BABYLON from '@babylonjs/core';
import type { IPhysicsEngine } from '../physics/IPhysicsEngine';
import type { BodyDescriptor } from '../core/types';
import type {
  BabylonRobotModel,
  JointInfo,
  LinkInfo,
} from './types';

/**
 * Joint constraint handle and metadata
 */
interface JointConstraint {
  jointInfo: JointInfo;
  parentBodyHandle: string;
  childBodyHandle: string;
}

/**
 * Integrates URDF robot with physics engine
 */
export class URDFPhysicsIntegration {
  private physicsEngine: IPhysicsEngine;
  private bodyHandles = new Map<string, string>(); // linkName -> physics handle
  private jointConstraints = new Map<string, JointConstraint>();

  constructor(physicsEngine: IPhysicsEngine) {
    this.physicsEngine = physicsEngine;
  }

  /**
   * Create physics bodies for all robot links
   * @param robotModel - Babylon robot model
   * @param linkInfos - URDF link information with inertial properties
   */
  createPhysicsBodies(
    robotModel: BabylonRobotModel,
    linkInfos: LinkInfo[]
  ): void {
    const linkInfoMap = new Map(linkInfos.map(l => [l.name, l]));

    // Create rigid body for each link
    robotModel.links.forEach((mesh, linkName) => {
      const linkInfo = linkInfoMap.get(linkName);
      if (!linkInfo) {
        console.warn(`No link info found for ${linkName}`);
        return;
      }

      // Determine body type (static for base, dynamic for others)
      const isBase = linkName.includes('base') || linkName === 'world';
      const bodyType = isBase ? 'static' : 'dynamic';

      // Get mesh world position and rotation
      mesh.computeWorldMatrix(true);
      const position = mesh.getAbsolutePosition();
      const rotation = mesh.absoluteRotationQuaternion || BABYLON.Quaternion.Identity();

      // Create body descriptor
      const bodyDesc: BodyDescriptor = {
        type: bodyType,
        position: {
          x: position.x,
          y: position.y,
          z: position.z,
        },
        rotation: {
          x: rotation.x,
          y: rotation.y,
          z: rotation.z,
          w: rotation.w,
        },
        mass: linkInfo.inertial?.mass || 1.0,
        shape: this.determineCollisionShape(mesh, linkInfo),
      };

      // Create physics body
      const handle = this.physicsEngine.createRigidBody(bodyDesc);
      this.bodyHandles.set(linkName, handle);
    });

    // Create joint constraints
    this.createJointConstraints(robotModel);
  }

  /**
   * Create physics constraints for joints
   * Note: This is a placeholder - full joint constraint implementation
   * requires extending IPhysicsEngine to support joints
   */
  private createJointConstraints(robotModel: BabylonRobotModel): void {
    robotModel.joints.forEach((jointInfo, jointName) => {
      const parentHandle = this.bodyHandles.get(jointInfo.parent);
      const childHandle = this.bodyHandles.get(jointInfo.child);

      if (!parentHandle || !childHandle) {
        console.warn(
          `Cannot create joint ${jointName}: missing body handles`
        );
        return;
      }

      // Store joint constraint info
      // TODO: Extend IPhysicsEngine to support joint constraints
      this.jointConstraints.set(jointName, {
        jointInfo,
        parentBodyHandle: parentHandle,
        childBodyHandle: childHandle,
      });

      // For now, we can only note that joints would be created here
      // Full implementation requires adding joint methods to IPhysicsEngine
      console.log(
        `Joint ${jointName} (${jointInfo.type}) would be created ` +
        `between ${jointInfo.parent} and ${jointInfo.child}`
      );
    });
  }

  /**
   * Determine appropriate collision shape for link
   */
  private determineCollisionShape(
    mesh: BABYLON.Mesh,
    linkInfo: LinkInfo
  ): 'box' | 'sphere' | 'cylinder' | 'trimesh' {
    // If link has collision geometry specified, use it
    if (linkInfo.collision && linkInfo.collision.length > 0) {
      const collisionGeom = linkInfo.collision[0].geometry;

      switch (collisionGeom.type) {
        case 'box':
          return 'box';
        case 'sphere':
          return 'sphere';
        case 'cylinder':
          return 'cylinder';
        case 'mesh':
          return 'trimesh';
      }
    }

    // Otherwise, analyze mesh to determine best fit
    const boundingInfo = mesh.getBoundingInfo();
    const extents = boundingInfo.boundingBox.extendSize;

    // Check if roughly spherical
    const avgSize = (extents.x + extents.y + extents.z) / 3;
    const maxDeviation = Math.max(
      Math.abs(extents.x - avgSize),
      Math.abs(extents.y - avgSize),
      Math.abs(extents.z - avgSize)
    );

    if (maxDeviation / avgSize < 0.2) {
      return 'sphere';
    }

    // Check if roughly cylindrical (one axis much larger)
    const sizes = [extents.x, extents.y, extents.z].sort((a, b) => b - a);
    if (sizes[0] > sizes[1] * 2 && Math.abs(sizes[1] - sizes[2]) < sizes[1] * 0.2) {
      return 'cylinder';
    }

    // Default to box for simple collision
    // Use trimesh for complex shapes if needed
    if (mesh.getTotalVertices() > 1000) {
      return 'trimesh';
    }

    return 'box';
  }

  /**
   * Synchronize Babylon meshes with physics bodies
   * Call this after physics step
   */
  syncMeshesWithPhysics(robotModel: BabylonRobotModel): void {
    robotModel.links.forEach((mesh, linkName) => {
      const handle = this.bodyHandles.get(linkName);
      if (!handle) return;

      const transform = this.physicsEngine.getRigidBodyTransform(handle);
      if (!transform) return;

      // Update mesh position and rotation
      mesh.position.set(
        transform.position.x,
        transform.position.y,
        transform.position.z
      );

      mesh.rotationQuaternion = new BABYLON.Quaternion(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z,
        transform.rotation.w
      );
    });
  }

  /**
   * Get physics body handle for link
   */
  getBodyHandle(linkName: string): string | undefined {
    return this.bodyHandles.get(linkName);
  }

  /**
   * Get all body handles
   */
  getBodyHandles(): Map<string, string> {
    return this.bodyHandles;
  }

  /**
   * Get joint constraint info
   */
  getJointConstraint(jointName: string): JointConstraint | undefined {
    return this.jointConstraints.get(jointName);
  }

  /**
   * Get all joint constraints
   */
  getJointConstraints(): Map<string, JointConstraint> {
    return this.jointConstraints;
  }

  /**
   * Dispose physics resources
   */
  dispose(): void {
    // Remove all rigid bodies
    this.bodyHandles.forEach((handle) => {
      this.physicsEngine.removeRigidBody(handle);
    });

    this.bodyHandles.clear();
    this.jointConstraints.clear();
  }
}
