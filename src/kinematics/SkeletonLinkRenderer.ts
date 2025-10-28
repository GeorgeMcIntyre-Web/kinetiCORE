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

    console.log(`[SkeletonLinkRenderer] Rendering ${chain.joints.length} links for chain ${config.chainId}`);
    console.log('[SkeletonLinkRenderer] Chain info:', { chainId: config.chainId, jointCount: chain.joints.length });

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
      
      if (!pos1 || !pos2) {
        console.warn(`[SkeletonLinkRenderer] Missing positions for link ${i}: ${joint1.name}->${joint2.name}`);
        continue;
      }
      
      const distance = BABYLON.Vector3.Distance(pos1, pos2);
      console.log(`[SkeletonLinkRenderer] Link ${i} (${joint1.name}->${joint2.name}) distance: ${distance.toFixed(4)}m`);
      
      if (distance < 0.001) {
        console.warn(`[SkeletonLinkRenderer] Skipping tiny link ${i}: distance=${distance.toFixed(4)}m`);
        continue;
      }
      
      this.createLink(pos1, pos2, config, meshes, this.scene, `${joint1.name}_to_${joint2.name}`);
    }

    this.linkMeshes.set(config.robotId, meshes);
  }

  private getJointWorldPosition(jointId: string): BABYLON.Vector3 | null {
    const km = KinematicsManager.getInstance();
    const fk = ForwardKinematicsSolver.getInstance();
    const joint = km.getJoint(jointId);
    if (!joint) return null;

    const sceneManager = (window as any).sceneManager;
    const scene = sceneManager?.getScene?.();
    if (!scene) return null;

    // Get the parent node
    const tree = (window as any).sceneTreeManager;
    const parentNode = tree?.getNode?.(joint.parentNodeId);
    if (!parentNode) return null;

    // Find the parent Babylon node
    let parentBabylonNode: BABYLON.TransformNode | null = null;
    if (parentNode.babylonMeshId) {
      parentBabylonNode = scene.getMeshByUniqueId(parseInt(parentNode.babylonMeshId)) as BABYLON.TransformNode;
    }
    if (!parentBabylonNode && parentNode.babylonTransformNodeId) {
      parentBabylonNode = scene.transformNodes.find(tn => tn.uniqueId === parseInt(parentNode.babylonTransformNodeId!)) || null;
    }
    if (!parentBabylonNode && parentNode.type === 'collection') {
      parentBabylonNode = scene.transformNodes.find(tn => tn.name === parentNode.name) || null;
    }
    if (!parentBabylonNode) return null;

    // Compute world matrix
    parentBabylonNode.computeWorldMatrix(true);
    const parentWorldMatrix = parentBabylonNode.getWorldMatrix();

    // Joint origin (mm -> meters conversion)
    const originLocal = new BABYLON.Vector3(
      joint.origin.x / 1000, // mm to meters
      joint.origin.y / 1000,
      joint.origin.z / 1000
    );

    // Transform to world space
    const originWorld = BABYLON.Vector3.TransformCoordinates(originLocal, parentWorldMatrix);
    
    return originWorld;
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
      const rotation = BABYLON.Vector3.GetAngleBetweenVectors(BABYLON.Vector3.Up(), direction);
      mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), direction).normalize(), rotation);
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
    } else {
      material.emissiveColor = new BABYLON.Color3(0, 1, 1); // Bright cyan
    }
    
    material.opacity = config.opacity ?? 0.9;
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

