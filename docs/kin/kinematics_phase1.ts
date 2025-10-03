// src/kinematics/KinematicsManager.ts
// Kinematics System - Phase 1: Grounding and Structure Definition
// Owner: George

import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../scene/SceneTreeManager';
import type { SceneNode } from '../scene/SceneTreeNode';

/**
 * Kinematic chain types
 */
export type KinematicChainType = 
  | 'serial'      // Linear chain (robot arm)
  | 'parallel'    // Parallel mechanism (delta robot)
  | 'tree'        // Branching chain (hand with fingers)
  | 'closed';     // Closed loop (four-bar linkage)

/**
 * Joint types
 */
export type JointType = 
  | 'revolute'    // Rotation around axis (hinge)
  | 'prismatic'   // Linear sliding
  | 'fixed'       // No movement (rigid connection)
  | 'spherical'   // Ball joint (3DOF rotation)
  | 'cylindrical' // Rotation + translation
  | 'planar';     // 2D motion in plane

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
 * Kinematic chain - collection of joints forming a mechanism
 */
export interface KinematicChain {
  id: string;
  name: string;
  type: KinematicChainType;
  rootNodeId: string; // Base link (usually grounded)
  joints: JointConfig[];
  dof: number; // Degrees of freedom
}

/**
 * KinematicsManager - Central system for kinematic chains
 */
export class KinematicsManager {
  private static instance: KinematicsManager | null = null;
  private chains = new Map<string, KinematicChain>();
  private groundedNodes = new Set<string>();
  private joints = new Map<string, JointConfig>();
  
  // Visual helpers
  private jointAxisVisualizers = new Map<string, BABYLON.Mesh[]>();
  private limitVisualizers = new Map<string, BABYLON.Mesh[]>();

  private constructor() {}

  static getInstance(): KinematicsManager {
    if (!KinematicsManager.instance) {
      KinematicsManager.instance = new KinematicsManager();
    }
    return KinematicsManager.instance;
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

    // Create joint with defaults
    const joint: JointConfig = {
      id: config.id || `joint_${Date.now()}`,
      name: config.name || `Joint_${this.joints.size + 1}`,
      type: config.type || 'revolute',
      parentNodeId: config.parentNodeId,
      childNodeId: config.childNodeId,
      axis: config.axis || { x: 0, y: 0, z: 1 }, // Default: Z-axis (up)
      origin: config.origin || { x: 0, y: 0, z: 0 },
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
    };

    this.chains.set(chain.id, chain);
    
    console.log(`Created kinematic chain: ${name} with ${chain.dof} DOF`);
    return chain;
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
    if (!parentNode?.babylonMeshId) return;

    // Create axis visualizer
    const axisLength = 0.1; // 100mm
    const axisDir = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z).normalize();
    const origin = new BABYLON.Vector3(joint.origin.x, joint.origin.y, joint.origin.z);

    // Create arrow for axis
    const arrow = BABYLON.MeshBuilder.CreateLines(
      `jointAxis_${jointId}`,
      {
        points: [origin, origin.add(axisDir.scale(axisLength))],
      },
      scene
    );
    arrow.color = new BABYLON.Color3(1, 1, 0); // Yellow
    arrow.isPickable = false;

    this.jointAxisVisualizers.set(jointId, [arrow]);
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
   * Clear all kinematics data
   */
  reset(): void {
    this.chains.clear();
    this.groundedNodes.clear();
    this.joints.clear();
    this.jointAxisVisualizers.forEach(visuals => 
      visuals.forEach(v => v.dispose())
    );
    this.jointAxisVisualizers.clear();
    this.limitVisualizers.clear();
  }
}
