// SkeletonLinkRenderer - Visualizes kinematic chains as links between joints
// Owner: Edwin
// Implements persistent bone links with in-place updates

import * as BABYLON from '@babylonjs/core';
import { KinematicsManager } from './KinematicsManager';

export interface SkeletonLinkConfig {
  robotId: string;
  chainId: string;
  enabled: boolean;
  style: 'cylinder' | 'tube' | 'line' | 'bone';
  thicknessMm: number;
  opacity?: number;
  showJointSpheres?: boolean;
}

interface LinkNode {
  parent: BABYLON.TransformNode;
  mesh: BABYLON.Mesh;
  jointSphereA?: BABYLON.Mesh;
  jointSphereB?: BABYLON.Mesh;
}

interface ChainRenderState {
  parentContainer: BABYLON.TransformNode;
  links: Map<string, LinkNode>;
  material: BABYLON.StandardMaterial;
  boneMaterial?: BABYLON.PBRMaterial;
}

/**
 * Renders skeleton links (visual lines connecting joints) for a kinematic chain
 */
export class SkeletonLinkRenderer {
  private static instance: SkeletonLinkRenderer | null = null;
  private chainsByRobot: Map<string, Map<string, ChainRenderState>> = new Map();
  private scene: BABYLON.Scene | null = null;
  private pendingFrame: number = 0;

  private constructor() {}

  static getInstance(): SkeletonLinkRenderer {
    if (!SkeletonLinkRenderer.instance) {
      SkeletonLinkRenderer.instance = new SkeletonLinkRenderer();
    }
    return SkeletonLinkRenderer.instance;
  }

  initialize(scene: BABYLON.Scene): void {
    this.scene = scene;
    console.log('[SkeletonLinkRenderer] Initialized');
  }

  /**
   * Update or create skeleton links for a kinematic chain
   */
  updateChain(config: SkeletonLinkConfig): void {
    if (!this.scene) return;

    if (!config.enabled) {
      // Hide skeleton but don't dispose
      const chainMap = this.chainsByRobot.get(config.robotId);
      const state = chainMap?.get(config.chainId);
      if (state) {
        state.parentContainer.isVisible = false;
      }
      return;
    }

    const km = KinematicsManager.getInstance();
    const chain = km.getChainById(config.chainId);
    
    if (!chain || chain.joints.length === 0) return;

    // Get or create chain render state
    let chainMap = this.chainsByRobot.get(config.robotId);
    if (!chainMap) {
      chainMap = new Map();
      this.chainsByRobot.set(config.robotId, chainMap);
    }

    let state = chainMap.get(config.chainId);
    if (!state) {
      // First render - create container and materials
      state = this.createChainState(config);
      chainMap.set(config.chainId, state);
      console.log(`[SkeletonLinkRenderer] Created chain state for ${config.chainId}`);
    }

    // Make container visible
    state.parentContainer.isVisible = true;

    // Update all link transforms in-place
    this.updateChainLinks(config, state, km);
  }

  /**
   * Create initial chain render state
   */
  private createChainState(config: SkeletonLinkConfig): ChainRenderState {
    const container = new BABYLON.TransformNode(`skeleton_${config.robotId}_${config.chainId}`, this.scene);
    
    // Material for non-bone styles
    const standardMaterial = new BABYLON.StandardMaterial(`skeleton_mat_${config.chainId}`, this.scene);
    standardMaterial.emissiveColor = new BABYLON.Color3(0, 1, 1);
    standardMaterial.disableLighting = true;
    standardMaterial.alpha = config.opacity ?? 0.9;

    // PBR material for bone style - bright white/cream bone color
    let boneMaterial: BABYLON.PBRMaterial | undefined;
    if (config.style === 'bone') {
      boneMaterial = new BABYLON.StandardMaterial(`bone_mat_${config.chainId}`, this.scene);
      // Bright white bone color with strong emission for visibility
      boneMaterial.emissiveColor = new BABYLON.Color3(1.0, 0.95, 0.85); // Warm white
      boneMaterial.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
      boneMaterial.disableLighting = true; // Always visible regardless of lighting
      boneMaterial.alpha = config.opacity ?? 1.0;
    }

    return {
      parentContainer: container,
      links: new Map(),
      material: standardMaterial,
      boneMaterial,
    };
  }

  /**
   * Update all link transforms in-place
   */
  private updateChainLinks(config: SkeletonLinkConfig, state: ChainRenderState, km: KinematicsManager): void {
    const chain = km.getChainById(config.chainId);
    if (!chain) return;

    const frames = km.getOrderedJointFrames(config.chainId);
    const terminalFrame = km.getTerminalFrame(config.chainId);

    if (frames.length === 0) return;

    const processedLinks = new Set<string>();

    // Update or create links between joints
    for (let i = 0; i < frames.length; i++) {
      const startFrame = frames[i];
      let endFrame: { origin: BABYLON.Vector3 } | null = null;

      if (i < frames.length - 1) {
        endFrame = { origin: frames[i + 1].origin };
      } else if (terminalFrame) {
        endFrame = terminalFrame;
      }

      if (!endFrame) continue; // Skip last link if no terminal frame

      const linkKey = `${startFrame.id}_to_${endFrame.origin ? 'end' : frames[i + 1]?.id || 'end'}`;
      processedLinks.add(linkKey);

      let linkNode = state.links.get(linkKey);

      if (!linkNode) {
        // Create new link node (first time only)
        linkNode = this.createLinkNode(startFrame.origin, endFrame.origin, config, state, linkKey);
        state.links.set(linkKey, linkNode);
      } else {
        // Update existing link transforms in-place
        this.updateLinkTransform(linkNode, startFrame.origin, endFrame.origin, state);
      }

      // Update joint spheres if enabled
      if (config.showJointSpheres) {
        this.updateJointSpheres(linkNode, startFrame.origin, endFrame.origin, state);
      }
    }

    // Hide links that are no longer needed (handles chain changes)
    state.links.forEach((linkNode, key) => {
      if (!processedLinks.has(key)) {
        linkNode.parent.isVisible = false;
      }
    });

    // Update once per frame (throttle to avoid spam)
    if (this.pendingFrame) return;
    this.pendingFrame = requestAnimationFrame(() => {
      console.log(`[SkeletonLinkRenderer] Updated chain ${config.chainId} with ${state.links.size} bones`);
      this.pendingFrame = 0;
    });
  }

  /**
   * Create a new link node
   */
  private createLinkNode(start: BABYLON.Vector3, end: BABYLON.Vector3, config: SkeletonLinkConfig, state: ChainRenderState, key: string): LinkNode {
    const distance = BABYLON.Vector3.Distance(start, end);
    if (distance < 0.001) {
      // Return placeholder for tiny links
      const parent = new BABYLON.TransformNode(`link_${key}`, this.scene);
      parent.isVisible = false;
      parent.parent = state.parentContainer;
      return { parent, mesh: null as any };
    }

    const parent = new BABYLON.TransformNode(`link_${key}`, this.scene);
    parent.parent = state.parentContainer;

    let mesh: BABYLON.Mesh;

    const baseRadius = Math.max(config.thicknessMm / 1000, 0.01); // At least 1cm radius
    
    if (config.style === 'bone') {
      // Bone: thicker at bottom (joint), thinner at top for visual bone effect
      mesh = BABYLON.MeshBuilder.CreateCylinder(`bone_${key}`, {
        height: 1,
        diameterTop: baseRadius * 0.7,    // Thinner at top
        diameterBottom: baseRadius * 1.2, // Thicker at bottom (joint)
        tessellation: 16,
      }, this.scene);
      mesh.material = state.boneMaterial;
    } else if (config.style === 'tube') {
      mesh = BABYLON.MeshBuilder.CreateCylinder(`cylinder_${key}`, {
        height: 1,
        diameterTop: baseRadius * 2,
        diameterBottom: baseRadius * 2,
        tessellation: 8,
      }, this.scene);
      mesh.material = state.material;
    } else if (config.style === 'line') {
      // Thin line
      mesh = BABYLON.MeshBuilder.CreateCylinder(`cylinder_${key}`, {
        height: 1,
        diameter: baseRadius * 0.5,
        tessellation: 8
      }, this.scene);
      mesh.material = state.material;
    } else {
      // Default cylinder
      mesh = BABYLON.MeshBuilder.CreateCylinder(`cylinder_${key}`, {
        height: 1,
        diameterTop: baseRadius * 2,
        diameterBottom: baseRadius * 2,
        tessellation: 8
      }, this.scene);
      mesh.material = state.material;
    }

    mesh.parent = parent;
    mesh.isPickable = false;
    mesh.renderingGroupId = 2;

    const linkNode: LinkNode = { parent, mesh };

    // Create joint spheres if enabled - make them more visible
    if (config.showJointSpheres) {
      const sphereRadius = baseRadius * 0.6; // Larger spheres
      const sphereA = BABYLON.MeshBuilder.CreateSphere(`sphere_a_${key}`, { diameter: sphereRadius * 2 }, this.scene);
      const sphereB = BABYLON.MeshBuilder.CreateSphere(`sphere_b_${key}`, { diameter: sphereRadius * 2 }, this.scene);
      
      sphereA.material = state.boneMaterial || state.material;
      sphereB.material = state.boneMaterial || state.material;
      sphereA.parent = parent;
      sphereB.parent = parent;
      sphereA.isPickable = false;
      sphereB.isPickable = false;
      sphereA.renderingGroupId = 2;
      sphereB.renderingGroupId = 2;

      linkNode.jointSphereA = sphereA;
      linkNode.jointSphereB = sphereB;
    }

    // Set initial transform
    this.updateLinkTransform(linkNode, start, end, state);

    return linkNode;
  }

  /**
   * Update link transform in-place
   */
  private updateLinkTransform(linkNode: LinkNode, start: BABYLON.Vector3, end: BABYLON.Vector3, state: ChainRenderState): void {
    const distance = BABYLON.Vector3.Distance(start, end);
    
    if (distance < 0.001) {
      linkNode.parent.isVisible = false;
      return;
    }

    linkNode.parent.isVisible = true;
    
    // Compute midpoint and direction
    const dir = end.subtract(start);
    const dirNorm = dir.normalize();
    const midpoint = BABYLON.Vector3.Center(start, end);

    // Orientation: rotate cylinder's +Y to direction
    // Babylon cylinders are aligned to +Y
    const up = BABYLON.Vector3.Up();
    const dot = BABYLON.Vector3.Dot(up, dirNorm);
    
    let q: BABYLON.Quaternion;
    
    if (Math.abs(dot) > 0.98) {
      // Nearly parallel - use identity or near-identity rotation
      q = BABYLON.Quaternion.Identity();
    } else {
      // Build rotation from Up to dirNorm
      const cross = BABYLON.Vector3.Cross(up, dirNorm).normalize();
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      q = BABYLON.Quaternion.RotationAxis(cross, angle);
    }

    // Update parent transform
    linkNode.parent.position = midpoint;
    linkNode.parent.rotationQuaternion = q;

    // Scale mesh: Y is length, X/Z are diameter
    // Keep original proportions from create time
    linkNode.mesh.scaling = new BABYLON.Vector3(1, distance, 1);

    // Update joint spheres (in local space of parent)
    if (linkNode.jointSphereA) {
      linkNode.jointSphereA.position = BABYLON.Vector3.Zero();
      linkNode.jointSphereA.isVisible = true;
    }
    if (linkNode.jointSphereB) {
      // Position at the end in local space
      linkNode.jointSphereB.position = new BABYLON.Vector3(0, distance, 0);
      linkNode.jointSphereB.isVisible = true;
    }
  }

  /**
   * Update joint sphere positions
   */
  private updateJointSpheres(linkNode: LinkNode, start: BABYLON.Vector3, end: BABYLON.Vector3, state: ChainRenderState): void {
    const distance = BABYLON.Vector3.Distance(start, end);
    
    if (linkNode.jointSphereA) {
      linkNode.jointSphereA.position = BABYLON.Vector3.Zero();
    }
    if (linkNode.jointSphereB) {
      linkNode.jointSphereB.position = new BABYLON.Vector3(0, distance, 0);
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  renderSkeleton(config: SkeletonLinkConfig): void {
    this.updateChain(config);
  }

  /**
   * Remove skeleton for a robot
   */
  removeSkeleton(robotId: string): void {
    const chainMap = this.chainsByRobot.get(robotId);
    if (!chainMap) return;

    chainMap.forEach((state) => {
      state.links.forEach((linkNode) => {
        linkNode.mesh.dispose();
        linkNode.jointSphereA?.dispose();
        linkNode.jointSphereB?.dispose();
        linkNode.parent.dispose();
      });
      state.material.dispose();
      state.boneMaterial?.dispose();
    });

    chainMap.clear();
    this.chainsByRobot.delete(robotId);
  }

  /**
   * Remove single chain
   */
  disposeChain(chainId: string, robotId: string): void {
    const chainMap = this.chainsByRobot.get(robotId);
    if (!chainMap) return;

    const state = chainMap.get(chainId);
    if (!state) return;

    state.links.forEach((linkNode) => {
      linkNode.mesh.dispose();
      linkNode.jointSphereA?.dispose();
      linkNode.jointSphereB?.dispose();
      linkNode.parent.dispose();
    });
    
    state.material.dispose();
    state.boneMaterial?.dispose();
    chainMap.delete(chainId);
  }

  cleanup(): void {
    this.chainsByRobot.forEach((chainMap) => {
      chainMap.forEach((state) => {
        state.links.forEach((linkNode) => {
          linkNode.mesh.dispose();
          linkNode.jointSphereA?.dispose();
          linkNode.jointSphereB?.dispose();
          linkNode.parent.dispose();
        });
        state.material.dispose();
        state.boneMaterial?.dispose();
      });
    });
    this.chainsByRobot.clear();
  }
}
