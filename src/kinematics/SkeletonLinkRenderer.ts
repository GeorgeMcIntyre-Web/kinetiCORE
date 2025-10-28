// SkeletonLinkRenderer - Visualizes kinematic chains as links between joints
// Owner: Edwin
// Implements actual link rendering (cylinders/tubes/lines) between joint positions

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

    console.log('[SkeletonLinkRenderer] Looking for chain:', config.chainId);
    const km = KinematicsManager.getInstance();
    
    // List all available chains for debugging
    const chainIds = km.debugListChains();
    console.log('[SkeletonLinkRenderer] Available chains:', chainIds);
    
    // Try to get chain by ID (chain is stored by its ID in the chains Map)
    const chain = km.getChainById(config.chainId);
    
    if (!chain) {
      console.warn('[SkeletonLinkRenderer] Chain not found', { 
        chainId: config.chainId,
        available: chainIds
      });
      return;
    }
    
    if (!chain.joints || chain.joints.length === 0) {
      console.warn('[SkeletonLinkRenderer] Chain has no joints', { 
        chainId: config.chainId,
        jointCount: chain.joints?.length
      });
      return;
    }

    // Get adjacent joint world poses from KinematicsManager
    const pairs = km.getAdjacentJointWorldPoses(config.chainId);
    
    if (pairs.length === 0) {
      console.warn('[SkeletonLinkRenderer] No adjacent joint poses found', { chainId: config.chainId });
      return;
    }

    console.log(`[SkeletonLinkRenderer] Rendering ${pairs.length} links for chain ${config.chainId}`);

    // Remove existing links
    this.removeSkeleton(config.robotId);

    const meshes: BABYLON.Mesh[] = [];

    // Render links between joints using world poses
    pairs.forEach((pair, i) => {
      const distance = BABYLON.Vector3.Distance(pair.a, pair.b);
      
      console.log(`[SkeletonLinkRenderer] Link ${i} (${pair.aId}->${pair.bId}) distance: ${distance.toFixed(4)}m`);
      
      if (distance < 0.001) {
        console.warn(`[SkeletonLinkRenderer] Skipping tiny link ${i}: distance=${distance.toFixed(4)}m`);
        return;
      }
      
      const joint1 = chain.joints.find(j => j.id === pair.aId);
      const joint2 = chain.joints.find(j => j.id === pair.bId);
      const linkName = joint1 && joint2 ? `${joint1.name}_to_${joint2.name}` : `${pair.aId}_to_${pair.bId}`;
      
      if (this.scene) {
        this.createLink(pair.a, pair.b, config, meshes, this.scene, linkName);
      }
    });

    this.linkMeshes.set(config.robotId, meshes);
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
      // Box orientation (align with direction)
      const up = BABYLON.Vector3.Up();
      const cross = BABYLON.Vector3.Cross(up, direction).normalize();
      const angle = BABYLON.Vector3.Dot(up, direction);
      mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(cross, Math.acos(angle));
    } else if (config.style === 'tube') {
      // Hollow tube (simple path-based)
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
    } else if (config.style === 'bone') {
      // Tapered bone - thicker at start, thinner at end
      const diameterTop = thickness * 0.5; // thinner at top
      const diameterBottom = thickness; // thicker at bottom
      
      mesh = BABYLON.MeshBuilder.CreateCylinder(
        `skeleton_link_${name}`,
        {
          height: distance,
          diameterTop: diameterTop * 2,
          diameterBottom: diameterBottom * 2,
          tessellation: 8
        },
        scene
      );
      
      mesh.position = midpoint;
      
      // Properly orient cylinder to point from start to end
      const up = BABYLON.Vector3.Up();
      const cylinderDirection = direction;
      
      // Calculate rotation to align cylinder's +Y with direction
      const cross = BABYLON.Vector3.Cross(up, cylinderDirection);
      if (cross.length() < 1e-6) {
        // Vectors are parallel (up or down)
        mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
      } else {
        cross.normalize();
        const angle = Math.acos(BABYLON.Vector3.Dot(up, cylinderDirection));
        mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(cross, angle);
      }
    } else {
      // Solid cylinder (default) - align Y axis with direction
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
      
      // Properly orient cylinder to point from start to end
      const up = BABYLON.Vector3.Up();
      const cylinderDirection = direction;
      
      // Calculate rotation to align cylinder's +Y with direction
      const cross = BABYLON.Vector3.Cross(up, cylinderDirection);
      if (cross.length() < 1e-6) {
        // Vectors are parallel (up or down)
        mesh.rotationQuaternion = BABYLON.Quaternion.Identity();
      } else {
        cross.normalize();
        const angle = Math.acos(BABYLON.Vector3.Dot(up, cylinderDirection));
        mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(cross, angle);
      }
    }

    // Style the link with bright, visible material
    const material = new BABYLON.StandardMaterial(`skeleton_mat_${name}`, scene);
    
    if (config.style === 'tube') {
      material.emissiveColor = new BABYLON.Color3(0, 1, 1); // Bright cyan
      material.wireframe = true;
    } else if (config.style === 'bone') {
      material.emissiveColor = new BABYLON.Color3(0.8, 0.8, 0.9); // Subtle bone color
      material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Low specular
    } else {
      material.emissiveColor = new BABYLON.Color3(0, 1, 1); // Bright cyan
    }
    
    material.disableLighting = true;
    material.alpha = config.opacity ?? 0.9;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.renderingGroupId = 2; // Render on top of robot
    mesh.visibility = config.enabled ? 1 : 0;

    meshes.push(mesh);
    console.log(`[SkeletonLinkRenderer] Created link mesh "${name}" at distance ${distance.toFixed(4)}m`);
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

