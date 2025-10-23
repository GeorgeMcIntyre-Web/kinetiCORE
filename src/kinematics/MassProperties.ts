/**
 * Mass Properties and Center of Mass Computation
 * Owner: George
 * Computes CoM, inertia, and mass distribution for robots
 */

import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../scene/SceneTreeManager';
import { SceneManager } from '../scene/SceneManager';
import { KinematicsManager } from './KinematicsManager';
import { ForwardKinematicsSolver } from './ForwardKinematicsSolver';

/**
 * Mass properties for a rigid body
 */
export interface MassProperties {
  mass: number; // kg
  centerOfMass: BABYLON.Vector3; // Local CoM position
  inertia: BABYLON.Matrix; // Inertia tensor
}

/**
 * Link mass data
 */
export interface LinkMassData {
  nodeId: string;
  mass: number;
  localCoM: BABYLON.Vector3; // CoM in link's local frame
  worldCoM?: BABYLON.Vector3; // CoM in world frame (computed)
}

/**
 * Mass Properties Computer
 * Computes Center of Mass for kinematic chains and whole robots
 */
export class MassPropertiesComputer {
  private static instance: MassPropertiesComputer | null = null;
  private sceneTreeManager: SceneTreeManager;
  private sceneManager: SceneManager;
  private kinematicsManager: KinematicsManager;
  private fkSolver: ForwardKinematicsSolver;

  // Default mass properties (can be overridden with actual data)
  private linkMassData: Map<string, LinkMassData> = new Map();
  private defaultLinkMass = 1.0; // kg

  private constructor() {
    this.sceneTreeManager = SceneTreeManager.getInstance();
    this.sceneManager = SceneManager.getInstance();
    this.kinematicsManager = KinematicsManager.getInstance();
    this.fkSolver = ForwardKinematicsSolver.getInstance();
  }

  static getInstance(): MassPropertiesComputer {
    if (!MassPropertiesComputer.instance) {
      MassPropertiesComputer.instance = new MassPropertiesComputer();
    }
    return MassPropertiesComputer.instance;
  }

  /**
   * Set mass data for a specific link
   */
  setLinkMass(nodeId: string, mass: number, localCoM: BABYLON.Vector3 = BABYLON.Vector3.Zero()): void {
    this.linkMassData.set(nodeId, {
      nodeId,
      mass,
      localCoM,
    });
  }

  /**
   * Load mass properties from URDF inertial data
   */
  loadFromURDF(urdfData: {
    links: Array<{
      name: string;
      inertial?: {
        mass: number;
        origin?: { x: number; y: number; z: number };
      };
    }>;
  }): void {
    urdfData.links.forEach((link) => {
      if (link.inertial) {
        const localCoM = link.inertial.origin
          ? new BABYLON.Vector3(
              link.inertial.origin.x,
              link.inertial.origin.y,
              link.inertial.origin.z
            )
          : BABYLON.Vector3.Zero();

        // Find node by name (iterate through all nodes)
        const allNodes = this.sceneTreeManager.getAllNodes();
        const node = allNodes.find((n) => n.name === link.name);
        if (node) {
          this.setLinkMass(node.id, link.inertial.mass, localCoM);
        }
      }
    });

    console.log(`[Mass Properties] Loaded ${this.linkMassData.size} link masses from URDF`);
  }

  /**
   * Compute total Center of Mass for a kinematic chain
   */
  computeChainCoM(chainName: string): BABYLON.Vector3 {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) {
      console.warn(`[CoM] Chain not found: ${chainName}`);
      return BABYLON.Vector3.Zero();
    }

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    const nodeIds = new Set<string>();

    // Collect all nodes in the chain
    joints.forEach((joint) => {
      nodeIds.add(joint.parentNodeId);
      nodeIds.add(joint.childNodeId);
    });

    return this.computeCoMForNodes(Array.from(nodeIds));
  }

  /**
   * Compute total Center of Mass for entire robot
   */
  computeRobotCoM(): BABYLON.Vector3 {
    // Get all kinematic chains
    const chains = this.kinematicsManager.getAllChains();
    const allNodeIds = new Set<string>();

    chains.forEach((chain) => {
      const joints = this.kinematicsManager.getChainJoints(chain.id);
      joints.forEach((joint) => {
        allNodeIds.add(joint.parentNodeId);
        allNodeIds.add(joint.childNodeId);
      });
    });

    if (allNodeIds.size === 0) {
      console.warn('[CoM] No kinematic nodes found');
      return BABYLON.Vector3.Zero();
    }

    return this.computeCoMForNodes(Array.from(allNodeIds));
  }

  /**
   * Compute CoM for a set of nodes
   */
  private computeCoMForNodes(nodeIds: string[]): BABYLON.Vector3 {
    let totalMass = 0;
    const weightedSum = BABYLON.Vector3.Zero();

    nodeIds.forEach((nodeId) => {
      // Get mass data (use default if not specified)
      const massData = this.linkMassData.get(nodeId);
      const mass = massData?.mass ?? this.defaultLinkMass;
      const localCoM = massData?.localCoM ?? BABYLON.Vector3.Zero();

      // Get world transform for this node
      const worldCoM = this.getNodeWorldCoM(nodeId, localCoM);

      if (worldCoM) {
        weightedSum.addInPlace(worldCoM.scale(mass));
        totalMass += mass;
      }
    });

    if (totalMass === 0) {
      return BABYLON.Vector3.Zero();
    }

    return weightedSum.scale(1 / totalMass);
  }

  /**
   * Get CoM position in world frame for a node
   */
  private getNodeWorldCoM(nodeId: string, localCoM: BABYLON.Vector3): BABYLON.Vector3 | null {
    const node = this.sceneTreeManager.getNode(nodeId);
    if (!node) return null;

    const scene = this.sceneManager.getScene();
    if (!scene) return null;

    // Try to get mesh or transform node
    let transformNode: BABYLON.TransformNode | null = null;

    if (node.babylonMeshId) {
      transformNode = scene.getMeshById(node.babylonMeshId);
    } else if (node.babylonTransformNodeId) {
      transformNode = scene.getTransformNodeById(node.babylonTransformNodeId);
    }

    if (!transformNode) return null;

    // Transform local CoM to world space
    transformNode.computeWorldMatrix(true);
    const worldMatrix = transformNode.getWorldMatrix();

    return BABYLON.Vector3.TransformCoordinates(localCoM, worldMatrix);
  }

  /**
   * Compute CoM Jacobian for a chain
   * Returns how CoM changes with respect to joint angles
   */
  computeCoMJacobian(chainName: string): number[][] | null {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return null;

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    const jacobian: number[][] = [];

    // For each joint, compute how CoM changes when that joint moves
    const epsilon = 0.001; // Small angle for numerical differentiation

    joints.forEach((joint) => {
      const originalAngle = joint.position;

      // Compute CoM at current angle
      const com0 = this.computeChainCoM(chainName);

      // Perturb joint angle slightly
      this.fkSolver.updateJointPosition(joint.id, originalAngle + epsilon, false);
      const com1 = this.computeChainCoM(chainName);

      // Restore original angle
      this.fkSolver.updateJointPosition(joint.id, originalAngle, false);

      // Compute derivative: dCoM/dq
      const dCoM = com1.subtract(com0).scale(1 / epsilon);

      jacobian.push([dCoM.x, dCoM.y, dCoM.z]);
    });

    return jacobian;
  }

  /**
   * Estimate link masses from geometry (if URDF data unavailable)
   */
  estimateLinkMassesFromGeometry(density: number = 1000): void {
    // Estimate mass based on bounding box volume (simplified)
    const scene = this.sceneManager.getScene();
    if (!scene) return;

    const allNodes = this.sceneTreeManager.getAllNodes();

    allNodes.forEach((node) => {
      // Try to get mesh or transform node
      let transformNode: BABYLON.TransformNode | null = null;

      if (node.babylonMeshId) {
        transformNode = scene.getMeshById(node.babylonMeshId);
      } else if (node.babylonTransformNodeId) {
        transformNode = scene.getTransformNodeById(node.babylonTransformNodeId);
      }

      if (!transformNode) return;

      // Only compute volume for meshes
      const mesh = transformNode as BABYLON.Mesh;
      if (!mesh.getBoundingInfo) return;

      // Compute bounding box volume
      mesh.computeWorldMatrix(true);
      const boundingInfo = mesh.getBoundingInfo();
      const size = boundingInfo.boundingBox.maximumWorld.subtract(
        boundingInfo.boundingBox.minimumWorld
      );

      const volume = size.x * size.y * size.z; // m³
      const mass = volume * density; // kg (assuming density in kg/m³)

      // Use geometric center as CoM (in local space)
      const localCenter = boundingInfo.boundingBox.center;

      this.setLinkMass(node.id, Math.max(mass, 0.1), localCenter); // Minimum 0.1kg
    });

    console.log(`[Mass Properties] Estimated ${this.linkMassData.size} link masses from geometry`);
  }

  /**
   * Get total mass for a chain
   */
  getChainTotalMass(chainName: string): number {
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return 0;

    const joints = this.kinematicsManager.getChainJoints(chain.id);
    const nodeIds = new Set<string>();

    joints.forEach((joint) => {
      nodeIds.add(joint.parentNodeId);
      nodeIds.add(joint.childNodeId);
    });

    let totalMass = 0;
    nodeIds.forEach((nodeId) => {
      const massData = this.linkMassData.get(nodeId);
      totalMass += massData?.mass ?? this.defaultLinkMass;
    });

    return totalMass;
  }

  /**
   * Clear all mass data
   */
  clearMassData(): void {
    this.linkMassData.clear();
  }
}
