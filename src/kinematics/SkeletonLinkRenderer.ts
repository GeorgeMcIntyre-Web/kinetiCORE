// SkeletonLinkRenderer - Visualizes kinematic chains as links between joints
// Owner: Edwin
// Implements actual link rendering (cylinders/tubes/lines) between joint positions

import * as BABYLON from '@babylonjs/core';
import { KinematicsManager } from './KinematicsManager';
import { ForwardKinematicsSolver } from './ForwardKinematicsSolver';

export interface SkeletonLinkConfig {
  robotId: string;
  chainId: string;
  enabled: boolean;
  style: 'cylinder' | 'tube' | 'line';
  thicknessMm: number;
  opacity?: number;
}

/**
 * Renders skeleton links (visual lines connecting joints) for a kinematic chain
 */
export class SkeletonLinkRenderer {
  private static instance: SkeletonLinkRenderer | null = null;
  private linkMeshes: Map<string, BABYLON.Mesh[]> = new Map();
  private scene: BABYLON.Scene | null = null;

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
   * Create or update skeleton links for a kinematic chain
   */
  renderSkeleton(config: SkeletonLinkConfig): void {
    if (!this.scene) {
      console.warn('[SkeletonLinkRenderer] Scene not initialized');
      return;
    }

    if (!config.enabled) {
      this.removeSkeleton(config.robotId);
      return;
    }

    const km = KinematicsManager.getInstance();
    const chain = km.getChain(config.chainId);
    if (!chain || !chain.joints || chain.joints.length === 0) {
      console.warn('[SkeletonLinkRenderer] No chain or joints found');
      return;
    }

    console.log(`[SkeletonLinkRenderer] Rendering ${chain.joints.length} links for chain ${config.chainId}`);

    // Remove existing links
    this.removeSkeleton(config.robotId);

    const meshes: BABYLON.Mesh[] = [];
    const fk = ForwardKinematicsSolver.getInstance();

    // Render link from base to first joint
    const basePosition = new BABYLON.Vector3(0, 0, 0);
    const firstJoint = chain.joints[0];
    const firstJointWorld = this.getJointWorldPosition(firstJoint.id);
    
    if (firstJointWorld) {
      this.createLink(firstJointWorld, basePosition, config, meshes, this.scene, 'base_link');
    }

    // Render links between joints
    for (let i = 0; i < chain.joints.length - 1; i++) {
      const joint1 = chain.joints[i];
      const joint2 = chain.joints[i + 1];
      
      const pos1 = this.getJointWorldPosition(joint1.id);
      const pos2 = this.getJointWorldPosition(joint2.id);
      
      if (pos1 && pos2) {
        this.createLink(pos1, pos2, config, meshes, this.scene, `${joint1.name}_to_${joint2.name}`);
      }
    }

    this.linkMeshes.set(config.robotId, meshes);
  }

  private getJointWorldPosition(jointId: string): BABYLON.Vector3 | null {
    const km = KinematicsManager.getInstance();
    const joint = km.getJoint(jointId);
    if (!joint) return null;

    const sceneManager = (window as any).sceneManager;
    const scene = sceneManager?.getScene?.();
    if (!scene) return null;

    // Get the child mesh position in world space
    const tree = (window as any).sceneTreeManager;
    const childNode = tree?.getNode?.(joint.childNodeId);
    if (!childNode) return null;

    // Find the Babylon mesh
    let babylonMesh: BABYLON.Mesh | null = null;
    if (childNode.babylonMeshId) {
      babylonMesh = scene.getMeshByUniqueId(parseInt(childNode.babylonMeshId)) as BABYLON.Mesh;
    }
    
    if (!babylonMesh) return null;
    
    return babylonMesh.getAbsolutePosition();
  }

  private createLink(
    start: BABYLON.Vector3,
    end: BABYLON.Vector3,
    config: SkeletonLinkConfig,
    meshes: BABYLON.Mesh[],
    scene: BABYLON.Scene,
    name: string
  ): void {
    const distance = BABYLON.Vector3.Distance(start, end);
    if (distance < 0.001) return; // Skip tiny links

    const direction = end.subtract(start).normalize();
    const midpoint = BABYLON.Vector3.Center(start, end);
    const thickness = config.thicknessMm / 1000; // Convert mm to meters

    let mesh: BABYLON.Mesh;

    if (config.style === 'line') {
      // Simple line
      mesh = BABYLON.MeshBuilder.CreateBox(
        `skeleton_link_${name}`,
        { width: distance, height: thickness * 2, depth: thickness * 2 },
        scene
      );
      mesh.position = midpoint;
      mesh.lookAt(end);
    } else if (config.style === 'tube') {
      // Hollow tube
      mesh = BABYLON.MeshBuilder.CreateTube(
        `skeleton_link_${name}`,
        {
          path: [start, end],
          radius: thickness,
          tessellation: 8,
          cap: BABYLON.Mesh.CAP_ALL
        },
        scene
      );
    } else {
      // Solid cylinder (default)
      mesh = BABYLON.MeshBuilder.CreateCylinder(
        `skeleton_link_${name}`,
        {
          height: distance,
          diameter: thickness * 2,
          tessellation: 8
        },
        scene
      );
      mesh.position = midpoint;
      mesh.lookAt(end);
    }

    // Style the link
    const material = new BABYLON.StandardMaterial(`skeleton_mat_${name}`, scene);
    
    if (config.style === 'tube') {
      material.emissiveColor = new BABYLON.Color3(0.5, 0.5, 1); // Bright cyan
      material.wireframe = true;
    } else {
      material.emissiveColor = new BABYLON.Color3(0, 0.8, 1); // Cyan
    }
    
    material.opacity = config.opacity ?? 0.8;
    material.disableLighting = true;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.renderingGroupId = 2; // Render on top
    mesh.visibility = config.enabled ? 1 : 0;

    meshes.push(mesh);
  }

  removeSkeleton(robotId: string): void {
    const meshes = this.linkMeshes.get(robotId);
    if (meshes) {
      meshes.forEach(mesh => mesh.dispose());
      this.linkMeshes.delete(robotId);
      console.log(`[SkeletonLinkRenderer] Removed skeleton for ${robotId}`);
    }
  }

  cleanup(): void {
    this.linkMeshes.forEach((meshes) => {
      meshes.forEach(mesh => mesh.dispose());
    });
    this.linkMeshes.clear();
  }
}

