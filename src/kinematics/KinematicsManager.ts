// src/kinematics/KinematicsManager.ts
// Kinematics System - Phase 1: Grounding and Structure Definition
// Owner: George

import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../scene/SceneTreeManager';
import type { SceneNode } from '../scene/SceneTreeNode';
import type { JointType } from '../scene/SceneTreeNode';
import type { IKinematicsManager } from './IKinematicsManager';
// ActuatorSystem is imported via dynamic import() in getActuatorSystem() to break circular dependency

// Re-export JointType for convenience
export type { JointType };

// Export interface for breaking circular dependencies
export type { IKinematicsManager };

/**
 * Kinematic chain types
 */
export type KinematicChainType =
  | 'serial'      // Linear chain (robot arm)
  | 'parallel'    // Parallel mechanism (delta robot)
  | 'tree'        // Branching chain (hand with fingers)
  | 'closed';     // Closed loop (four-bar linkage)

/**
 * Joint configuration
 */
export interface JointConfig {
  id: string;
  name: string;
  type: JointType;

  // Connected parts
  parentNodeId: string;
  childNodeId: string;

  // Joint axis (in parent's local space)
  axis: { x: number; y: number; z: number };

  // Joint origin (in parent's local space)
  origin: { x: number; y: number; z: number };
  originRotation?: { x: number; y: number; z: number; w: number }; // Quaternion

  // Limits
  limits: {
    lower: number;  // Radians for revolute, mm for prismatic
    upper: number;
    velocity: number; // Max velocity
    effort: number;   // Max torque/force
  };

  // Current state
  position: number;  // Current angle or position
  velocity: number;
  effort: number;

  // Visual feedback
  showAxis: boolean;
  showLimits: boolean;
}

/**
 * Grounding configuration - defines which part is fixed to world
 */
export interface GroundingConfig {
  nodeId: string;
  grounded: boolean;
  groundPosition?: { x: number; y: number; z: number };
  groundRotation?: { x: number; y: number; z: number };
}

/**
 * TCP (Tool Center Point) frame configuration
 */
export interface TCPFrame {
  id: string;
  name: string;
  linkId: string;  // Which link this TCP is attached to
  offset: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}

/**
 * Base frame configuration for robot reference
 */
export interface BaseFrame {
  linkId: string;  // Usually the grounded base link
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}

/**
 * Keyframe/Pose definition - stores named robot configurations
 */
export interface RobotKeyframe {
  id: string;
  name: string;
  chainId: string; // Which kinematic chain this pose belongs to
  jointPositions: Record<string, number>; // jointId → position (radians or meters)
  timestamp?: number; // When this keyframe was created
  description?: string;
}

/**
 * Kinematic chain - collection of joints forming a mechanism
 */
export interface KinematicChain {
  id: string;
  name: string;
  type: KinematicChainType;
  rootNodeId: string; // Base link (usually grounded)
  joints: JointConfig[];
  dof: number; // Degrees of freedom
  tcpFrames: TCPFrame[];  // Tool center points
  baseFrame?: BaseFrame;   // Robot base reference frame
}

/**
 * KinematicsManager - Central system for kinematic chains
 */
export class KinematicsManager implements IKinematicsManager {
  private static instance: KinematicsManager | null = null;
  private chains = new Map<string, KinematicChain>();
  private groundedNodes = new Set<string>();
  private joints = new Map<string, JointConfig>();
  // private actuatorSystem: any | null = null; // TEMP DISABLED
  private keyframes = new Map<string, RobotKeyframe>();

  // Visual helpers
  private jointAxisVisualizers = new Map<string, BABYLON.Mesh[]>();
  private limitVisualizers = new Map<string, BABYLON.Mesh[]>();

  // FK update event listeners
  private fkUpdateListeners = new Set<(chainId: string) => void>();

  // Cache of last FK world matrices per joint (chainId -> jointId -> worldMatrix)
  private _lastJointWorld = new Map<string, Map<string, BABYLON.Matrix>>();

  private constructor() {}

  static getInstance(): KinematicsManager {
    if (!KinematicsManager.instance) {
      KinematicsManager.instance = new KinematicsManager();
    }
    return KinematicsManager.instance;
  }

  /**
   * Get the actuator system for hardware control
   * Note: ActuatorSystem is lazily loaded to avoid circular dependency
   */
  getActuatorSystem(): any {
    // TEMPORARILY DISABLED - require() not supported in browser
    // TODO: Fix circular dependency properly without require()
    return null;
  }

  /**
   * Ground a node - fix it to world space
   * This is the FIRST step in defining kinematics
   */
  groundNode(nodeId: string, lockPosition = true): boolean {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);

    if (!node) return false;

    // Mark as grounded
    this.groundedNodes.add(nodeId);

    // Lock the node in the tree
    if (lockPosition) {
      node.locked = true;
    }

    // Update node metadata to indicate it's grounded
    node.userData = node.userData || {};
    node.userData.grounded = true;
    node.userData.groundPosition = { ...node.position };
    node.userData.groundRotation = { ...node.rotation };

    console.log(`Grounded node: ${node.name}`);
    return true;
  }

  /**
   * Unground a node
   */
  ungroundNode(nodeId: string): boolean {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);

    if (!node) return false;

    this.groundedNodes.delete(nodeId);
    node.locked = false;

    if (node.userData) {
      delete node.userData.grounded;
      delete node.userData.groundPosition;
      delete node.userData.groundRotation;
    }

    console.log(`Ungrounded node: ${node.name}`);
    return true;
  }

  /**
   * Check if node is grounded
   */
  isGrounded(nodeId: string): boolean {
    return this.groundedNodes.has(nodeId);
  }

  /**
   * Get all grounded nodes
   */
  getGroundedNodes(): string[] {
    return Array.from(this.groundedNodes);
  }

  /**
   * Auto-detect potential base/ground part
   * Heuristic: largest mesh at bottom of hierarchy
   */
  suggestGroundNode(rootNodeId: string): string | null {
    const tree = SceneTreeManager.getInstance();
    const rootNode = tree.getNode(rootNodeId);

    if (!rootNode) return null;

    const descendants = this.getAllDescendants(rootNodeId);

    // Find meshes
    const meshNodes = descendants.filter(n => n.type === 'mesh');

    if (meshNodes.length === 0) return null;

    // Heuristic: lowest Z position (closest to ground) + largest volume
    let bestCandidate: SceneNode | null = null;
    let bestScore = -Infinity;

    for (const node of meshNodes) {
      const zPos = node.position.z; // User space Z = height
      const volume = this.estimateNodeVolume(node);

      // Lower Z is better (negative score), larger volume is better
      const score = -zPos + volume * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = node;
      }
    }

    return bestCandidate?.id || null;
  }

  /**
   * Create a joint between two nodes
   */
  createJoint(config: Partial<JointConfig>): JointConfig | null {
    if (!config.parentNodeId || !config.childNodeId) {
      console.error('Parent and child nodes required');
      return null;
    }

    const tree = SceneTreeManager.getInstance();
    const parentNode = tree.getNode(config.parentNodeId);
    const childNode = tree.getNode(config.childNodeId);

    if (!parentNode || !childNode) {
      console.error('Invalid parent or child node');
      return null;
    }

    // Debug: Log originRotation from config
    if (config.name?.includes('tool0')) {
      console.log(`[KinematicsManager] Creating joint ${config.name}, originRotation from config:`, config.originRotation);
    }

    // Create joint with defaults
    // Use joint name as ID if provided (URDF joints have unique names)
    // Otherwise generate unique ID with timestamp + random component
    const joint: JointConfig = {
      id: config.id || (config.name ? `joint_${config.name}` : `joint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
      name: config.name || `Joint_${this.joints.size + 1}`,
      type: config.type || 'revolute',
      parentNodeId: config.parentNodeId,
      childNodeId: config.childNodeId,
      axis: config.axis || { x: 0, y: 0, z: 1 }, // Default: Z-axis (up)
      origin: config.origin || { x: 0, y: 0, z: 0 },
      originRotation: config.originRotation, // FIXED: Include originRotation from config
      limits: config.limits || {
        lower: -Math.PI,
        upper: Math.PI,
        velocity: 1.0,
        effort: 10.0,
      },
      position: 0,
      velocity: 0,
      effort: 0,
      showAxis: true,
      showLimits: true,
    };

    this.joints.set(joint.id, joint);

    // Update child node to track its joint
    childNode.jointData = {
      jointType: joint.type,
      axis: joint.axis,
      limits: {
        min: joint.limits.lower * (joint.type === 'revolute' ? 180 / Math.PI : 1),
        max: joint.limits.upper * (joint.type === 'revolute' ? 180 / Math.PI : 1),
      },
      currentValue: 0,
    };

    console.log(`Created joint: ${joint.name}`);
    return joint;
  }

  /**
   * Delete a joint
   */
  deleteJoint(jointId: string): boolean {
    const joint = this.joints.get(jointId);
    if (!joint) return false;

    // Clean up visualizers
    this.hideJointVisuals(jointId);

    this.joints.delete(jointId);

    // Remove joint data from child node
    const tree = SceneTreeManager.getInstance();
    const childNode = tree.getNode(joint.childNodeId);
    if (childNode) {
      delete childNode.jointData;
    }

    console.log(`Deleted joint: ${joint.name}`);
    return true;
  }

  /**
   * Get joint by ID
   */
  getJoint(jointId: string): JointConfig | undefined {
    return this.joints.get(jointId);
  }

  /**
   * Get all joints
   */
  getAllJoints(): JointConfig[] {
    return Array.from(this.joints.values());
  }

  /**
   * Get joints for a specific node (as parent or child)
   */
  getNodeJoints(nodeId: string): JointConfig[] {
    return this.getAllJoints().filter(
      j => j.parentNodeId === nodeId || j.childNodeId === nodeId
    );
  }

  /**
   * Create kinematic chain from joints
   */
  createChain(
    name: string,
    rootNodeId: string,
    type: KinematicChainType = 'serial'
  ): KinematicChain {
    // Find all joints starting from root
    const chainJoints = this.findChainJoints(rootNodeId);

    const chain: KinematicChain = {
      id: `chain_${Date.now()}`,
      name,
      type,
      rootNodeId,
      joints: chainJoints,
      dof: chainJoints.filter(j => j.type !== 'fixed').length,
      tcpFrames: [],  // Initialize empty TCP frames
      baseFrame: undefined,  // Will be set when base link is grounded
    };

    this.chains.set(chain.id, chain);

    console.log(`Created kinematic chain: ${name} with ${chain.dof} DOF`);
    return chain;
  }

  /**
   * Get a kinematic chain by name
   */
  getChain(name: string): KinematicChain | undefined {
    return Array.from(this.chains.values()).find(chain => chain.name === name);
  }

  /**
   * Get a kinematic chain by ID
   */
  getChainById(chainId: string): KinematicChain | undefined {
    return this.chains.get(chainId);
  }

  /**
   * Debug helper: list all chain IDs
   */
  debugListChains(): string[] {
    return Array.from(this.chains.keys());
  }

  /**
   * Joint frame info
   */
  getOrderedJointFrames(chainId: string): Array<{ id: string; parentId: string; world: BABYLON.Matrix; origin: BABYLON.Vector3; zAxis: BABYLON.Vector3 }> {
    const chain = this.getChainById(chainId);
    if (!chain) return [];

    const result: Array<{ id: string; parentId: string; world: BABYLON.Matrix; origin: BABYLON.Vector3; zAxis: BABYLON.Vector3 }> = [];
    const cache = this._lastJointWorld.get(chainId);

    for (const joint of chain.joints) {
      const cachedMatrix = cache?.get(joint.id);
      if (!cachedMatrix) continue;

      const worldMatrix = cachedMatrix;
      const origin = worldMatrix.getTranslation();
      const zAxis = BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.Up(), worldMatrix).subtract(origin).normalize();

      result.push({
        id: joint.id,
        parentId: joint.parentNodeId,
        world: worldMatrix.clone(),
        origin,
        zAxis,
      });
    }

    return result;
  }

  /**
   * Get active chain handle for a robot
   */
  getActiveChainHandle(robotId: string): { chain: KinematicChain; key: string } | undefined {
    for (const [key, chain] of this.chains) {
      // Check if any joint in the chain belongs to this robot
      if (chain.joints.some(j => j.id.startsWith(robotId))) {
        return { chain, key };
      }
    }
    return undefined;
  }

  /**
   * Subscribe to FK update events
   */
  onFkUpdated(callback: (chainId: string) => void): () => void {
    this.fkUpdateListeners.add(callback);
    return () => {
      this.fkUpdateListeners.delete(callback);
    };
  }

  /**
   * Emit FK update event (called after joint position updates)
   */
  emitFkUpdated(chainId: string): void {
    this.fkUpdateListeners.forEach(cb => cb(chainId));
  }

  /**
   * Get joint world pose (position and rotation)
   */
  getJointWorldPose(chainId: string, jointId: string): { pos: BABYLON.Vector3; rot: BABYLON.Quaternion } | undefined {
    const chain = this.getChainById(chainId);
    if (!chain) return undefined;

    const joint = chain.joints.find(j => j.id === jointId);
    if (!joint) return undefined;

    const sceneManager = (window as any).sceneManager;
    const scene = sceneManager?.getScene?.();
    if (!scene) return undefined;

    const tree = (window as any).sceneTreeManager;
    const childNode = tree?.getNode?.(joint.childNodeId);
    if (!childNode) return undefined;

    // Find the Babylon mesh/transform node
    let babylonNode: BABYLON.TransformNode | null = null;
    if (childNode.babylonMeshId) {
      babylonNode = scene.getMeshByUniqueId(parseInt(childNode.babylonMeshId)) as BABYLON.TransformNode;
    }
          if (!babylonNode && childNode.babylonTransformNodeId) {
            babylonNode = scene.transformNodes.find((tn: any) => tn.uniqueId === parseInt(childNode.babylonTransformNodeId!)) || null;
          }
          if (!babylonNode && childNode.type === 'collection') {
            babylonNode = scene.transformNodes.find((tn: any) => tn.name === childNode.name) || null;
          }
    if (!babylonNode) return undefined;

    // Get world transformation
    babylonNode.computeWorldMatrix(true);
    const worldMatrix = babylonNode.getWorldMatrix();
    const pos = worldMatrix.getTranslation();
    const rot = BABYLON.Quaternion.FromRotationMatrix(worldMatrix);

    return { pos, rot };
  }

  /**
   * Cache joint world matrix (called by FK solver after updating transforms)
   */
  setJointWorldMatrix(chainId: string, jointId: string, m: BABYLON.Matrix): void {
    let chainCache = this._lastJointWorld.get(chainId);
    if (!chainCache) {
      chainCache = new Map();
      this._lastJointWorld.set(chainId, chainCache);
    }
    chainCache.set(jointId, m.clone());
  }

  /**
   * Get ordered joint world positions for a chain (with cache and fallbacks)
   */
  getOrderedJointWorldPositions(chainId: string): Array<{ id: string; pos: BABYLON.Vector3 }> {
    const chain = this.getChainById(chainId);
    if (!chain) return [];

    const result: Array<{ id: string; pos: BABYLON.Vector3 }> = [];
    const cache = this._lastJointWorld.get(chainId);

    const sceneManager = (window as any).sceneManager;
    const scene = sceneManager?.getScene?.();
    const tree = (window as any).sceneTreeManager;

    for (const joint of chain.joints) {
      let worldPos: BABYLON.Vector3 | null = null;

      // 1) Prefer the cached FK world matrix
      const cachedMatrix = cache?.get(joint.id);
      if (cachedMatrix) {
        worldPos = cachedMatrix.getTranslation();
      }

      // 2) Fallback: try to get world position from scene node
      if (!worldPos && scene && tree) {
        const childNode = tree.getNode(joint.childNodeId);
        if (childNode) {
          let babylonNode: BABYLON.TransformNode | null = null;
          if (childNode.babylonMeshId) {
            babylonNode = scene.getMeshByUniqueId(parseInt(childNode.babylonMeshId)) as BABYLON.TransformNode;
          }
          if (!babylonNode && childNode.babylonTransformNodeId) {
            babylonNode = scene.transformNodes.find((tn: any) => tn.uniqueId === parseInt(childNode.babylonTransformNodeId!)) || null;
          }
          if (!babylonNode && childNode.type === 'collection') {
            babylonNode = scene.transformNodes.find((tn: any) => tn.name === childNode.name) || null;
          }
          if (babylonNode) {
            babylonNode.computeWorldMatrix(true);
            const worldMatrix = babylonNode.getWorldMatrix();
            worldPos = worldMatrix.getTranslation();
          }
        }
      }

      if (worldPos) {
        result.push({ id: joint.id, pos: worldPos });
      }
    }

    return result;
  }

  /**
   * Get adjacent joint world poses for a chain
   */
  getAdjacentJointWorldPoses(chainId: string): Array<{ aId: string; bId: string; a: BABYLON.Vector3; b: BABYLON.Vector3 }> {
    const positions = this.getOrderedJointWorldPositions(chainId);
    if (positions.length === 0) return [];

    const pairs: Array<{ aId: string; bId: string; a: BABYLON.Vector3; b: BABYLON.Vector3 }> = [];
    for (let i = 0; i < positions.length - 1; i++) {
      pairs.push({
        aId: positions[i].id,
        bId: positions[i + 1].id,
        a: positions[i].pos,
        b: positions[i + 1].pos,
      });
    }
    return pairs;
  }


  /**
   * Get terminal frame (TCP or last link tip)
   */
  getTerminalFrame(chainId: string): { origin: BABYLON.Vector3; world: BABYLON.Matrix } | null {
    const chain = this.getChainById(chainId);
    if (!chain || chain.joints.length === 0) return null;

    // Check for TCP frames first
    if (chain.tcpFrames && chain.tcpFrames.length > 0) {
      // TODO: Get TCP world transform from FK solver
      // For now, fall through to last link
    }

    // Use the last joint's child link world transform
    const lastJoint = chain.joints[chain.joints.length - 1];
    const childLinkWorld = this.getJointChildLinkWorld(chainId, lastJoint.id);
    
    if (childLinkWorld) {
      const origin = childLinkWorld.getTranslation();
      return { origin, world: childLinkWorld };
    }

    return null;
  }

  /**
   * Get child link world matrix for a joint
   */
  getJointChildLinkWorld(chainId: string, jointId: string): BABYLON.Matrix | null {
    const chain = this.getChainById(chainId);
    if (!chain) return null;

    const joint = chain.joints.find(j => j.id === jointId);
    if (!joint) return null;

    const sceneManager = (window as any).sceneManager;
    const scene = sceneManager?.getScene?.();
    const tree = (window as any).sceneTreeManager;
    
    if (!scene || !tree) return null;

    const childNode = tree.getNode(joint.childNodeId);
    if (!childNode) return null;

    // Find the child Babylon node
    let babylonNode: BABYLON.TransformNode | null = null;
    if (childNode.babylonMeshId) {
      babylonNode = scene.getMeshByUniqueId(parseInt(childNode.babylonMeshId)) as BABYLON.TransformNode;
    }
    if (!babylonNode && childNode.babylonTransformNodeId) {
      babylonNode = scene.transformNodes.find((tn: any) => tn.uniqueId === parseInt(childNode.babylonTransformNodeId!)) || null;
    }
    if (!babylonNode && childNode.type === 'collection') {
      babylonNode = scene.transformNodes.find((tn: any) => tn.name === childNode.name) || null;
    }
    
    if (!babylonNode) return null;

    babylonNode.computeWorldMatrix(true);
    return babylonNode.getWorldMatrix().clone();
  }

  /**
   * Get all kinematic chains
   */
  getAllChains(): KinematicChain[] {
    return Array.from(this.chains.values());
  }

  /**
   * Get joints for a specific chain
   */
  getChainJoints(chainId: string): JointConfig[] {
    const chain = this.chains.get(chainId);
    return chain ? chain.joints : [];
  }

  /**
   * Get only actuated joints (excludes fixed joints)
   */
  getActuatedJoints(chainId: string): JointConfig[] {
    const chain = this.chains.get(chainId);
    if (!chain) return [];
    
    return chain.joints.filter(joint => 
      joint.type === 'revolute' || 
      joint.type === 'prismatic' || 
      joint.type === 'spherical'
    );
  }

  /**
   * Find all joints in chain starting from root
   */
  private findChainJoints(rootNodeId: string): JointConfig[] {
    const joints: JointConfig[] = [];
    const visited = new Set<string>();

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      // Find joints where this node is parent
      const childJoints = this.getAllJoints().filter(j => j.parentNodeId === nodeId);

      for (const joint of childJoints) {
        joints.push(joint);
        traverse(joint.childNodeId);
      }
    };

    traverse(rootNodeId);
    return joints;
  }

  /**
   * Show/hide joint axis visualization
   */
  showJointAxis(jointId: string, scene: BABYLON.Scene): void {
    const joint = this.joints.get(jointId);
    if (!joint) return;

    // Clean up existing visuals
    this.hideJointVisuals(jointId);

    const tree = SceneTreeManager.getInstance();
    const parentNode = tree.getNode(joint.parentNodeId);
    const childNode = tree.getNode(joint.childNodeId);
    if (!parentNode || !childNode) return;

    const visualizers: BABYLON.Mesh[] = [];

    // Get parent mesh world position
    let parentMesh: BABYLON.Mesh | null = null;
    if (parentNode.babylonMeshId) {
      parentMesh = scene.getMeshByUniqueId(parseInt(parentNode.babylonMeshId)) as BABYLON.Mesh;
    }

    if (!parentMesh) return;

    const parentWorldMatrix = parentMesh.computeWorldMatrix(true);
    const jointOriginLocal = new BABYLON.Vector3(
      joint.origin.x * 0.001, // mm to meters
      joint.origin.y * 0.001,
      joint.origin.z * 0.001
    );
    const jointOriginWorld = BABYLON.Vector3.TransformCoordinates(
      jointOriginLocal,
      parentWorldMatrix
    );

    // Create joint origin marker (sphere)
    const originMarker = BABYLON.MeshBuilder.CreateSphere(
      `jointOrigin_${jointId}`,
      { diameter: 0.02 }, // 20mm diameter
      scene
    );
    originMarker.position.copyFrom(jointOriginWorld);
    originMarker.isPickable = false;

    const markerMaterial = new BABYLON.StandardMaterial(`jointOriginMat_${jointId}`, scene);
    markerMaterial.emissiveColor = new BABYLON.Color3(1, 0.5, 0); // Orange
    originMarker.material = markerMaterial;
    visualizers.push(originMarker);

    // Create axis visualizer
    const axisLength = 0.15; // 150mm
    const axisDir = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z).normalize();
    const axisWorldDir = BABYLON.Vector3.TransformNormal(axisDir, parentWorldMatrix);

    // Create arrow for axis (using cylinder + cone)
    const axisLine = BABYLON.MeshBuilder.CreateCylinder(
      `jointAxis_${jointId}`,
      {
        height: axisLength,
        diameter: 0.005, // 5mm diameter
      },
      scene
    );

    // Position and orient the axis
    const axisEndPoint = jointOriginWorld.add(axisWorldDir.scale(axisLength / 2));
    axisLine.position.copyFrom(axisEndPoint);

    // Orient cylinder along axis
    const up = BABYLON.Vector3.Up();
    const angle = Math.acos(BABYLON.Vector3.Dot(up, axisWorldDir));
    const rotAxis = BABYLON.Vector3.Cross(up, axisWorldDir).normalize();
    if (rotAxis.length() > 0) {
      axisLine.rotationQuaternion = BABYLON.Quaternion.RotationAxis(rotAxis, angle);
    }

    axisLine.isPickable = false;
    const axisMaterial = new BABYLON.StandardMaterial(`jointAxisMat_${jointId}`, scene);
    axisMaterial.emissiveColor = new BABYLON.Color3(1, 1, 0); // Yellow
    axisLine.material = axisMaterial;
    visualizers.push(axisLine);

    // Create arrowhead (cone)
    const arrowhead = BABYLON.MeshBuilder.CreateCylinder(
      `jointArrow_${jointId}`,
      {
        height: 0.02,
        diameterTop: 0,
        diameterBottom: 0.015,
      },
      scene
    );

    const arrowTip = jointOriginWorld.add(axisWorldDir.scale(axisLength));
    arrowhead.position.copyFrom(arrowTip);
    if (rotAxis.length() > 0) {
      arrowhead.rotationQuaternion = BABYLON.Quaternion.RotationAxis(rotAxis, angle);
    }

    arrowhead.isPickable = false;
    arrowhead.material = axisMaterial;
    visualizers.push(arrowhead);

    // Show rotation limits for revolute joints
    if (joint.type === 'revolute' && joint.showLimits) {
      const limitVisualizer = this.createRevoluteLimitVisualizer(
        joint,
        jointOriginWorld,
        axisWorldDir,
        scene
      );
      if (limitVisualizer) {
        visualizers.push(limitVisualizer);
      }
    }

    this.jointAxisVisualizers.set(jointId, visualizers);
  }

  /**
   * Create a visual indicator for revolute joint limits
   */
  private createRevoluteLimitVisualizer(
    joint: JointConfig,
    origin: BABYLON.Vector3,
    _axis: BABYLON.Vector3,
    scene: BABYLON.Scene
  ): BABYLON.Mesh | null {
    // Create a partial disc/arc showing the joint limits
    const radius = 0.08; // 80mm radius
    const segments = 32;
    const angleRange = joint.limits.upper - joint.limits.lower;

    const points: BABYLON.Vector3[] = [];
    points.push(origin); // Center point

    for (let i = 0; i <= segments; i++) {
      const angle = joint.limits.lower + (angleRange * i) / segments;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      // Create point in local plane perpendicular to axis
      // TODO: Proper 3D orientation based on axis
      const point = origin.add(new BABYLON.Vector3(x, 0, y));
      points.push(point);
    }

    points.push(origin); // Close the arc

    const limitArc = BABYLON.MeshBuilder.CreateLines(
      `jointLimits_${joint.id}`,
      { points },
      scene
    );

    limitArc.color = new BABYLON.Color3(0, 1, 1); // Cyan
    limitArc.alpha = 0.5;
    limitArc.isPickable = false;

    return limitArc;
  }

  /**
   * Show joint axis visualization with 3D half-circle torus and arrow meshes
   * Uses proper 3D geometry with renderingGroupId=2 to render on top of robot
   * - Cyan torus: Shows rotation range from joint limits
   * - Yellow arrow: Points at current joint angle (radial from arc)
   * - Red arrow: Shows rotation axis (normal to arc plane)
   */
  showJointDebugFrame(jointId: string, scene: BABYLON.Scene): void {
    const joint = this.joints.get(jointId);
    if (!joint) return;

    // Only visualize revolute joints
    if (joint.type !== 'revolute') return;

    const tree = SceneTreeManager.getInstance();

    // Get PARENT node (joint is defined in parent's local space)
    const parentNode = tree.getNode(joint.parentNodeId);
    if (!parentNode) {
      console.error(`[JointGizmo] Parent node not found for joint ${joint.name}`);
      return;
    }

    // Get parent's Babylon node
    let parentBabylonNode: BABYLON.TransformNode | null = null;
    if (parentNode.babylonMeshId) {
      parentBabylonNode = scene.getMeshByUniqueId(parseInt(parentNode.babylonMeshId)) as BABYLON.TransformNode;
    }
    if (!parentBabylonNode && parentNode.babylonTransformNodeId) {
      parentBabylonNode = scene.transformNodes.find(tn =>
        tn.uniqueId === parseInt(parentNode.babylonTransformNodeId!)
      ) || null;
    }
    if (!parentBabylonNode && parentNode.type === 'collection') {
      parentBabylonNode = scene.transformNodes.find(tn => tn.name === parentNode.name) || null;
    }

    if (!parentBabylonNode) {
      console.error(`[JointGizmo] Parent Babylon node not found for joint ${joint.name}`);
      return;
    }

    // Joint origin and axis in parent's LOCAL space (per URDF spec)
    const jointOriginLocal = new BABYLON.Vector3(
      joint.origin.x,
      joint.origin.y,
      joint.origin.z
    );

    // Joint axis in parent's local space
    const localAxis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z).normalize();

    // Get parent's world matrix for transformations
    parentBabylonNode.computeWorldMatrix(true);
    const parentWorldMatrix = parentBabylonNode.getWorldMatrix();

    // Transform joint origin to world space
    const jointOriginWorld = BABYLON.Vector3.TransformCoordinates(
      jointOriginLocal,
      parentWorldMatrix
    );

    // Transform joint axis to world space
    const worldAxis = BABYLON.Vector3.TransformNormal(localAxis, parentWorldMatrix);

    // Create visualization meshes
    const existing = this.jointAxisVisualizers.get(jointId) || [];

    const arcRadius = 0.05; // 50mm radius for the arc

    // Get joint limits and current position
    const lowerLimit = joint.limits?.lower || -Math.PI;
    const upperLimit = joint.limits?.upper || Math.PI;
    const currentAngle = joint.position || 0;

    // Clamp arc range to reasonable values
    let arcStart = Math.max(lowerLimit, -2 * Math.PI);
    let arcEnd = Math.min(upperLimit, 2 * Math.PI);

    // If range is too large, show half circle centered on current angle
    if (arcEnd - arcStart > Math.PI) {
      arcStart = currentAngle - Math.PI / 2;
      arcEnd = currentAngle + Math.PI / 2;
    }

    // Find perpendicular vectors for the arc plane in WORLD space
    let perpVector = new BABYLON.Vector3(1, 0, 0);
    if (Math.abs(BABYLON.Vector3.Dot(perpVector, worldAxis)) > 0.9) {
      perpVector = new BABYLON.Vector3(0, 1, 0);
    }
    let arcU = BABYLON.Vector3.Cross(worldAxis, perpVector).normalize();
    let arcV = BABYLON.Vector3.Cross(arcU, worldAxis).normalize();

    // Rotate arc plane by 90 degrees around joint axis to fix scaling issue
    const rotationAngle = Math.PI / 2; // 90 degrees
    const cosAngle = Math.cos(rotationAngle);
    const sinAngle = Math.sin(rotationAngle);
    const arcURotated = arcU.scale(cosAngle).add(arcV.scale(sinAngle));
    const arcVRotated = arcV.scale(cosAngle).subtract(arcU.scale(sinAngle));
    arcU = arcURotated;
    arcV = arcVRotated;

    // Create 3D arc with FIXED length (half-circle, doesn't scale) in WORLD space
    const tubeRadius = 0.002; // 2mm tube thickness
    const arrowThickness = 0.003; // 3mm arrow shaft

    const arcPoints: BABYLON.Vector3[] = [];
    const numSegments = 40;
    // Fixed half-circle arc (180 degrees)
    const fixedArcLength = Math.PI; // Half circle
    for (let i = 0; i <= numSegments; i++) {
      const angle = (i / numSegments) * fixedArcLength - (fixedArcLength / 2); // -90° to +90°
      const x = Math.cos(angle) * arcRadius;
      const y = Math.sin(angle) * arcRadius;
      const point = jointOriginWorld.clone()
        .add(arcU.scale(x))
        .add(arcV.scale(y));
      arcPoints.push(point);
    }

    const arcTube = BABYLON.MeshBuilder.CreateTube(
      `joint_arc_${jointId}`,
      {
        path: arcPoints,
        radius: tubeRadius,
        cap: BABYLON.Mesh.CAP_ALL,
        updatable: false
      },
      scene
    );

    const arcMat = new BABYLON.StandardMaterial(`joint_arc_mat_${jointId}`, scene);
    arcMat.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red
    arcMat.emissiveColor = new BABYLON.Color3(0.5, 0, 0); // Self-illuminated
    arcMat.disableLighting = true; // Always bright
    arcTube.material = arcMat;
    arcTube.isPickable = false;
    arcTube.renderingGroupId = 2; // Render on top of robot
    existing.push(arcTube);

    // Create arrow at the OTHER end of the arc line (at -90°)
    const arcEndAngle = -fixedArcLength / 2; // Other end of arc at -90°
    const arcEndX = Math.cos(arcEndAngle) * arcRadius;
    const arcEndY = Math.sin(arcEndAngle) * arcRadius;
    const arcEndPos = jointOriginWorld.clone()
      .add(arcU.scale(arcEndX))
      .add(arcV.scale(arcEndY));

    // Tangent direction at end of arc (pointing in + rotation direction)
    // Negate the direction to flip the arrow
    const tangentDir = arcU.scale(Math.sin(arcEndAngle)).add(arcV.scale(-Math.cos(arcEndAngle))).normalize();

    // Arrow head only (0 length shaft, just the cone)
    const arrowHead = BABYLON.MeshBuilder.CreateCylinder(
      `joint_arc_arrow_head_${jointId}`,
      { diameterTop: 0, diameterBottom: 0.01, height: 0.02 },
      scene
    );
    arrowHead.position = arcEndPos;

    // Orient arrow along tangent
    const arrowUpVec = new BABYLON.Vector3(0, 1, 0);
    const angleToUp = Math.acos(BABYLON.Vector3.Dot(tangentDir, arrowUpVec));
    const crossProduct = BABYLON.Vector3.Cross(arrowUpVec, tangentDir).normalize();
    if (crossProduct.length() > 0.01) {
      arrowHead.rotationQuaternion = BABYLON.Quaternion.RotationAxis(crossProduct, angleToUp);
    }
    arrowHead.material = arcMat;
    arrowHead.isPickable = false;
    arrowHead.renderingGroupId = 2;
    existing.push(arrowHead);

    // Create normal vector arrow (axis arrow - 3D cylinder along rotation axis)
    const normalLength = 0.07; // 70mm
    const normalShaftLength = normalLength * 0.8;
    const normalEnd = jointOriginWorld.clone().add(worldAxis.scale(normalShaftLength));

    // Normal shaft (3D cylinder)
    const normalShaft = BABYLON.MeshBuilder.CreateCylinder(
      `joint_normal_shaft_${jointId}`,
      { height: normalShaftLength, diameter: arrowThickness * 1.2 },
      scene
    );
    normalShaft.position = jointOriginWorld.clone().add(worldAxis.scale(normalShaftLength / 2));

    // Orient normal shaft along worldAxis
    const normalUpVec = new BABYLON.Vector3(0, 1, 0);
    const normalAngleToUp = Math.acos(BABYLON.Vector3.Dot(worldAxis, normalUpVec));
    const normalCross = BABYLON.Vector3.Cross(normalUpVec, worldAxis).normalize();
    if (normalCross.length() > 0.01) {
      normalShaft.rotationQuaternion = BABYLON.Quaternion.RotationAxis(normalCross, normalAngleToUp);
    }

    const normalMat = new BABYLON.StandardMaterial(`joint_normal_mat_${jointId}`, scene);
    normalMat.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red
    normalMat.emissiveColor = new BABYLON.Color3(0.5, 0, 0); // Self-illuminated
    normalMat.disableLighting = true; // Always bright
    normalShaft.material = normalMat;
    normalShaft.isPickable = false;
    normalShaft.renderingGroupId = 2; // Render on top of robot
    existing.push(normalShaft);

    // Normal arrow head (cone)
    const normalHead = BABYLON.MeshBuilder.CreateCylinder(
      `joint_normal_head_${jointId}`,
      { diameterTop: 0, diameterBottom: 0.012, height: 0.025 },
      scene
    );
    normalHead.position = normalEnd;
    if (normalCross.length() > 0.01) {
      normalHead.rotationQuaternion = BABYLON.Quaternion.RotationAxis(normalCross, normalAngleToUp);
    }
    normalHead.material = normalMat;
    normalHead.isPickable = false;
    normalHead.renderingGroupId = 2; // Render on top of robot
    existing.push(normalHead);

    // Store for later updates
    this.jointAxisVisualizers.set(jointId, existing);

    console.log(`[JointGizmo] Created gizmo for ${joint.name} at angle ${(currentAngle * 180 / Math.PI).toFixed(1)}°`);
  }

  /**
   * Show all joint frames for debugging
   */
  showAllJointDebugFrames(chainId: string, scene: BABYLON.Scene): void {
    const chain = this.chains.get(chainId);
    if (!chain) return;

    const joints = this.getChainJoints(chain.id);
    joints.forEach(joint => {
      if (joint.type === 'revolute' || joint.type === 'prismatic') {
        this.showJointDebugFrame(joint.id, scene);
      }
    });

    console.log(`[DEBUG] Showing ${joints.length} joint debug frames for chain ${chainId}`);
  }

  /**
   * Hide joint visuals
   */
  hideJointVisuals(jointId: string): void {
    const visuals = this.jointAxisVisualizers.get(jointId);
    if (visuals) {
      visuals.forEach(v => v.dispose());
      this.jointAxisVisualizers.delete(jointId);
    }
  }

  /**
   * Hide all joint visuals/gizmos
   */
  hideAllJointVisuals(): void {
    this.jointAxisVisualizers.forEach((visuals) => {
      visuals.forEach(v => v.dispose());
    });
    this.jointAxisVisualizers.clear();
  }

  /**
   * Update joint gizmo to reflect current joint angle
   * Called when joint position changes
   */
  updateJointGizmo(jointId: string, scene: BABYLON.Scene): void {
    const joint = this.joints.get(jointId);
    if (!joint || joint.type !== 'revolute') return;

    // Check if gizmo exists
    const visuals = this.jointAxisVisualizers.get(jointId);
    if (!visuals || visuals.length === 0) return;

    // Hide old gizmo and recreate with new angle
    this.hideJointVisuals(jointId);
    this.showJointDebugFrame(jointId, scene);
  }

  /**
   * Helper: Get all descendants of a node
   */
  private getAllDescendants(nodeId: string): SceneNode[] {
    const tree = SceneTreeManager.getInstance();
    const descendants: SceneNode[] = [];

    const traverse = (id: string) => {
      const node = tree.getNode(id);
      if (!node) return;

      descendants.push(node);
      node.childIds.forEach(childId => traverse(childId));
    };

    traverse(nodeId);
    return descendants;
  }

  /**
   * Helper: Estimate node volume for heuristics
   */
  private estimateNodeVolume(node: SceneNode): number {
    // Simple estimation based on scale
    return node.scale.x * node.scale.y * node.scale.z;
  }

  /**
   * Add TCP frame to a kinematic chain
   */
  addTCPFrame(chainId: string, tcpFrame: TCPFrame): boolean {
    const chain = this.chains.get(chainId);
    if (!chain) return false;

    chain.tcpFrames.push(tcpFrame);
    console.log(`Added TCP frame: ${tcpFrame.name} to chain: ${chain.name}`);
    return true;
  }

  /**
   * Set base frame for a kinematic chain
   */
  setBaseFrame(chainId: string, baseFrame: BaseFrame): boolean {
    const chain = this.chains.get(chainId);
    if (!chain) return false;

    chain.baseFrame = baseFrame;
    console.log(`Set base frame for chain: ${chain.name}`);
    return true;
  }

  /**
   * Get TCP frames for a kinematic chain
   */
  getTCPFrames(chainId: string): TCPFrame[] {
    const chain = this.chains.get(chainId);
    return chain?.tcpFrames || [];
  }

  /**
   * Get base frame for a kinematic chain
   */
  getBaseFrame(chainId: string): BaseFrame | undefined {
    const chain = this.chains.get(chainId);
    return chain?.baseFrame;
  }

  /**
   * Add a keyframe/pose
   */
  addKeyframe(keyframe: RobotKeyframe): void {
    this.keyframes.set(keyframe.id, keyframe);
    console.log(`[KinematicsManager] Added keyframe: ${keyframe.name} for chain: ${keyframe.chainId}`);
  }

  /**
   * Get keyframe by ID
   */
  getKeyframe(keyframeId: string): RobotKeyframe | undefined {
    return this.keyframes.get(keyframeId);
  }

  /**
   * Get all keyframes for a specific chain
   */
  getKeyframesForChain(chainId: string): RobotKeyframe[] {
    return Array.from(this.keyframes.values()).filter(kf => kf.chainId === chainId);
  }

  /**
   * Get all keyframes
   */
  getAllKeyframes(): RobotKeyframe[] {
    return Array.from(this.keyframes.values());
  }

  /**
   * Delete a keyframe
   */
  deleteKeyframe(keyframeId: string): boolean {
    const deleted = this.keyframes.delete(keyframeId);
    if (deleted) {
      console.log(`[KinematicsManager] Deleted keyframe: ${keyframeId}`);
    }
    return deleted;
  }

  /**
   * Create keyframe from current robot state
   */
  captureCurrentPose(chainId: string, name: string, description?: string): RobotKeyframe {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }

    const jointPositions: Record<string, number> = {};

    for (const joint of chain.joints) {
      jointPositions[joint.id] = joint.position;
    }

    const keyframe: RobotKeyframe = {
      id: `keyframe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      chainId,
      jointPositions,
      timestamp: Date.now(),
      description,
    };

    this.addKeyframe(keyframe);
    return keyframe;
  }

  /**
   * Clear all kinematics data
   */
  reset(): void {
    this.chains.clear();
    this.groundedNodes.clear();
    this.joints.clear();
    this.keyframes.clear();
    this.jointAxisVisualizers.forEach(visuals =>
      visuals.forEach(v => v.dispose())
    );
    this.jointAxisVisualizers.clear();
    this.limitVisualizers.clear();
  }
}
