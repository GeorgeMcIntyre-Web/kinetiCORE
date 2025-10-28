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
    if (!this.scene || !config.enabled) return;

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
    }

    // Update all link transforms
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

    // PBR material for bone style
    let boneMaterial: BABYLON.PBRMaterial | undefined;
    if (config.style === 'bone') {
      boneMaterial = new BABYLON.PBRMaterial(`bone_mat_${config.chainId}`, this.scene);
      boneMaterial.baseColor = new BABYLON.Color3(0.85, 0.85, 0.9);
      boneMaterial.metallic = 0.2;
      boneMaterial.roughness = 0.3;
      boneMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.4);
      boneMaterial.alpha = config.opacity ?? 0.9;
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

      const linkKey = `link_${i}`;
      let linkNode = state.links.get(linkKey);

      if (!linkNode) {
        // Create new link node
        linkNode = this.createLinkNode(startFrame.origin, endFrame.origin, config, state, linkKey);
        state.links.set(linkKey, linkNode);
      } else {
        // Update existing link transforms
        this.updateLinkTransform(linkNode, startFrame.origin, endFrame.origin, state);
      }

      // Update joint spheres if enabled
      if (config.showJointSpheres) {
        this.updateJointSpheres(linkNode, startFrame.origin, endFrame.origin, state);
      }
    }

    console.log(`[SkeletonLinkRenderer] Updated chain ${config.chainId} with ${state.links.size} bones`);
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

    if (config.style === 'bone') {
      // Bone: tapered cylinder (capsule-like)
      const radius = config.thicknessMm / 1000;
      mesh = BABYLON.MeshBuilder.CreateCylinder(`bone_${key}`, {
        height: 1,
        diameterTop: radius * 1.2,
        diameterBottom: radius * 0.7,
        tessellation: 16,
      }, this.scene);
      mesh.material = state.boneMaterial;
    } else if (config.style === 'tube') {
      mesh = BABYLON.MeshBuilder.CreateTube(`tube_${key}`, {
        path: [BABYLON.Vector3.Zero(), BABYLON.Vector3.Up()],
        radius: config.thicknessMm / 1000,
        tessellation: 8,
        cap: BABYLON.Mesh.CAP_ALL
      }, this.scene);
      mesh.material = state.material;
    } else {
      // Cylinder or line
      mesh = BABYLON.MeshBuilder.CreateCylinder(`cylinder_${key}`, {
        height: 1,
        diameter: config.thicknessMm / 1000 * 2,
        tessellation: 8
      }, this.scene);
      mesh.material = state.material;
    }

    mesh.parent = parent;
    mesh.isPickable = false;
    mesh.renderingGroupId = 2;

    const linkNode: LinkNode = { parent, mesh };

    // Create joint spheres if enabled
    if (config.showJointSpheres) {
      const sphereRadius = config.thicknessMm / 1000 * 0.5;
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
    
    // Compute midpoint and direction
    const midpoint = BABYLON.Vector3.Center(start, end);
    const dir = end.subtract(start);
    const dirNorm = dir.normalize();

    // Orientation: rotate up-axis to direction
    const up = BABYLON.Vector3.Up();
    const q = BABYLON.Quaternion.FromUnitVectors(up, dirNorm);

    // Update parent transform
    linkNode.parent.position = midpoint;
    linkNode.parent.rotationQuaternion = q;

    // Scale mesh along Y axis (cylinder's long axis)
    const radius = 0.01; // base radius in meters
    linkNode.mesh.scaling = new BABYLON.Vector3(radius, distance, radius);

    // Update joint spheres
    if (linkNode.jointSphereA) {
      linkNode.jointSphereA.position = BABYLON.Vector3.Zero();
    }
    if (linkNode.jointSphereB) {
      linkNode.jointSphereB.position = new BABYLON.Vector3(0, distance, 0);
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
