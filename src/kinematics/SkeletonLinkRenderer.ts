// SkeletonLinkRenderer - Visualizes kinematic chains as links between joints
// Owner: Edwin
// Implements persistent bone links with in-place updates

import * as BABYLON from '@babylonjs/core';
import { KinematicsManager } from './KinematicsManager';
import { SceneTreeManager } from '../scene/SceneTreeManager';

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
  mesh: BABYLON.Mesh;
  jointSphereA?: BABYLON.Mesh;
  jointSphereB?: BABYLON.Mesh;
  id: string; // stable link id for logging
}

interface ChainRenderState {
  parentContainer: BABYLON.TransformNode;
  links: Map<string, LinkNode>;
  material: BABYLON.StandardMaterial;
  boneMaterial?: BABYLON.StandardMaterial;
  sphereMaterial?: BABYLON.StandardMaterial; // Yellow material for joint spheres
}

/**
 * Helper: Compute quaternion from unit vector a to b (robust version)
 */
function quatFromUnitVectors(a: BABYLON.Vector3, b: BABYLON.Vector3): BABYLON.Quaternion {
  const v = BABYLON.Vector3.Cross(a, b);
  const d = BABYLON.Vector3.Dot(a, b);
  
  // Handle 180° case (opposite directions)
  if (d <= -0.999999) {
    // Pick any orthogonal axis to a (prefer X unless almost parallel)
    const axis = Math.abs(a.x) < 0.9 ? new BABYLON.Vector3(1, 0, 0) : new BABYLON.Vector3(0, 1, 0);
    const ortho = BABYLON.Vector3.Cross(a, axis).normalize();
    return BABYLON.Quaternion.RotationAxis(ortho, Math.PI);
  }
  
  // Standard case: compute rotation quaternion
  const s = Math.sqrt((1 + d) * 2);
  return new BABYLON.Quaternion(
    v.x / s,
    v.y / s,
    v.z / s,
    s * 0.5
  ).normalize();
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
   * Get robot model root TransformNode from robotId
   * robotId is the scene tree node ID representing the robot collection
   */
  private getRobotModelRoot(robotId: string): BABYLON.TransformNode | null {
    if (!this.scene) return null;

    const tree = SceneTreeManager.getInstance();
    const sceneTreeNode = tree.getNode(robotId);
    if (!sceneTreeNode) {
      console.warn(`[SkeletonLinkRenderer] Scene tree node not found for robotId: ${robotId}`);
      return null;
    }

    // Get Babylon TransformNode associated with this scene tree node
    let babylonNode: BABYLON.TransformNode | null = null;

    // Try as TransformNode first (for collection nodes)
    if (sceneTreeNode.babylonTransformNodeId) {
      babylonNode = this.scene.transformNodes.find(tn => tn.uniqueId === parseInt(sceneTreeNode.babylonTransformNodeId!)) || null;
    }

    // Fallback: Try as mesh (in case robot root is a mesh)
    if (!babylonNode && sceneTreeNode.babylonMeshId) {
      babylonNode = this.scene.getMeshByUniqueId(parseInt(sceneTreeNode.babylonMeshId)) as BABYLON.TransformNode;
    }

    // Fallback: Try by name (for backward compatibility)
    if (!babylonNode) {
      babylonNode = this.scene.transformNodes.find(tn => tn.name === sceneTreeNode.name) || null;
    }

    if (!babylonNode) {
      console.warn(`[SkeletonLinkRenderer] Could not find Babylon node for robotId: ${robotId}, node: ${sceneTreeNode.name}`);
      return null;
    }

    console.log(`[SkeletonLinkRenderer] Found robot model root: ${babylonNode.name} (uniqueId: ${babylonNode.uniqueId})`);
    return babylonNode;
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
    
    // Get robot model root and parent skeleton container to it
    // This ensures bones move with the robot when it's moved/rotated
    const robotRoot = this.getRobotModelRoot(config.robotId);
    if (robotRoot) {
      container.parent = robotRoot;
      console.log(`[SkeletonLinkRenderer] Parenting skeleton container to robot root: ${robotRoot.name}`);
    } else {
      console.warn(`[SkeletonLinkRenderer] Could not find robot root for robotId: ${config.robotId}, skeleton will not follow robot`);
    }
    
    // Material for non-bone styles
    const standardMaterial = new BABYLON.StandardMaterial(`skeleton_mat_${config.chainId}`, this.scene);
    standardMaterial.emissiveColor = new BABYLON.Color3(0, 1, 1);
    standardMaterial.disableLighting = true;
    standardMaterial.alpha = config.opacity ?? 0.9;

    // PBR material for bone style - realistic bone color with lighting
    let boneMaterial: BABYLON.StandardMaterial | undefined;
    if (config.style === 'bone') {
      boneMaterial = new BABYLON.StandardMaterial(`bone_mat_${config.chainId}`, this.scene);
      // Pink emissive-only color to ensure exact tone regardless of lighting
      const pink = BABYLON.Color3.FromHexString("#FF4DA6");
      boneMaterial.diffuseColor = BABYLON.Color3.Black();
      boneMaterial.emissiveColor = pink;
      boneMaterial.specularColor = BABYLON.Color3.Black();
      boneMaterial.disableLighting = true;
      boneMaterial.alpha = config.opacity ?? 1.0;
    }

    // Yellow material for joint spheres (if spheres enabled)
    let sphereMaterial: BABYLON.StandardMaterial | undefined;
    if (config.showJointSpheres) {
      sphereMaterial = new BABYLON.StandardMaterial(`sphere_mat_${config.chainId}`, this.scene);
      sphereMaterial.diffuseColor = new BABYLON.Color3(1, 0.9, 0); // Yellow
      sphereMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.4, 0); // Warm yellow glow
      sphereMaterial.specularColor = new BABYLON.Color3(0.8, 0.8, 0);
      sphereMaterial.disableLighting = false;
      sphereMaterial.alpha = config.opacity ?? 1.0;
    }

    return {
      parentContainer: container,
      links: new Map(),
      material: standardMaterial,
      boneMaterial,
      sphereMaterial,
    };
  }

  /**
   * Update all link transforms in-place
   * Reads directly from cached joint world matrices (fresh from FK)
   * Builds pairs: [base→J1], [J1→J2], ..., [Jn-1→Jn], [Jn→TCP?]
   */
  private updateChainLinks(config: SkeletonLinkConfig, state: ChainRenderState, km: KinematicsManager): void {
    const chain = km.getChainById(config.chainId);
    if (!chain) return;

    if (chain.joints.length === 0) return;

    // Get robot model root for coordinate conversion
    const parent = state.parentContainer.parent;
    if (!parent) {
      console.warn('[SkeletonLinkRenderer] Container has no parent, cannot convert to local space');
      return;
    }

    const parentWorldInv = parent.getWorldMatrix(true).clone().invert();

    // Build list of world points: [base, J1, J2, ..., Jn, (TCP?)]
    const worldPoints: BABYLON.Matrix[] = [];
    
    // Try to get base frame - if not available, use first joint's matrix as fallback
    let baseMatrix = km.getBaseWorldMatrix(config.chainId);
    if (!baseMatrix) {
      // Fallback: use first joint's cached matrix as base
      const firstJointMatrix = km.getJointWorldMatrix(config.chainId, chain.joints[0].id);
      if (firstJointMatrix) {
        console.log('[SkeletonLinkRenderer] Using first joint matrix as base fallback');
        baseMatrix = firstJointMatrix;
      } else {
        console.error('[SkeletonLinkRenderer] Could not get base matrix or first joint matrix');
        return;
      }
    }
    worldPoints.push(baseMatrix);

    // Add all joint world matrices
    for (const joint of chain.joints) {
      const matrix = km.getJointWorldMatrix(config.chainId, joint.id);
      if (!matrix) {
        console.warn(`[SkeletonLinkRenderer] Could not get matrix for joint ${joint.id}`);
        continue;
      }
      worldPoints.push(matrix);
    }

    // Optionally add TCP frame
    const tcpMatrix = km.getTcpWorldMatrix(config.chainId);
    if (tcpMatrix) {
      worldPoints.push(tcpMatrix);
    }

    if (worldPoints.length < 2) {
      console.warn('[SkeletonLinkRenderer] Not enough points to create links');
      return;
    }

    // Build link pairs: [p0→p1], [p1→p2], ..., [pn-2→pn-1]
    const expectedLinks = worldPoints.length - 1;
    const processedLinks = new Set<string>();

    // Check if we need to recreate links (count mismatch)
    if (state.links.size !== expectedLinks) {
      console.log(`[SkeletonLinkRenderer] Recreating links: expected ${expectedLinks}, got ${state.links.size}`);
      // Dispose existing links
      state.links.forEach(linkNode => {
        if (linkNode.mesh) linkNode.mesh.dispose();
        linkNode.jointSphereA?.dispose();
        linkNode.jointSphereB?.dispose();
      });
      state.links.clear();
    }

    for (let i = 0; i < worldPoints.length - 1; i++) {
      const matrixA = worldPoints[i];
      const matrixB = worldPoints[i + 1];

      // Extract world positions
      const aW = matrixA.getTranslation();
      const bW = matrixB.getTranslation();

      // Convert world -> local space
      const aL = BABYLON.Vector3.TransformCoordinates(aW, parentWorldInv);
      const bL = BABYLON.Vector3.TransformCoordinates(bW, parentWorldInv);

      const linkKey = `link_${i}_to_${i + 1}`;
      processedLinks.add(linkKey);

      let linkNode = state.links.get(linkKey);

      if (!linkNode) {
        // Create new link node
        linkNode = this.createLinkNode(aW, bW, config, state, linkKey);
        state.links.set(linkKey, linkNode);
        console.log(`[SkeletonLinkRenderer] Created link ${i}:`, { key: linkKey, hasMesh: !!linkNode.mesh });
      }

      // Update transform in-place
      this.updateLinkTransform(linkNode, aL, bL, state, config);
      
      // Debug first segment
      if (i === 0 && processedLinks.has(`link_${i}_to_${i + 1}`)) {
        const dir = bL.subtract(aL);
        console.log(`[SkeletonLinkRenderer] seg0:`, {
          len: dir.length().toFixed(4),
          start: aL.toString(),
          end: bL.toString(),
          bonePos: linkNode.mesh.position.toString(),
          boneScale: linkNode.mesh.scaling.toString()
        });
      }
    }

    // Hide links that are no longer needed (handles chain changes)
    state.links.forEach((linkNode, key) => {
      if (!processedLinks.has(key) && linkNode.mesh) {
        linkNode.mesh.isVisible = false;
      }
    });

    // Summarize update (throttled to once per frame)
    if (!this.pendingFrame) {
      this.pendingFrame = requestAnimationFrame(() => {
        try {
          const validLinks = Array.from(state.links.values()).filter(ln => ln.mesh && ln.mesh.scaling.y > 0.001);
          const lengths = validLinks.map(ln => ln.mesh.scaling.y);
          const minLen = lengths.length > 0 ? Math.min(...lengths) : 0;
          const maxLen = lengths.length > 0 ? Math.max(...lengths) : 0;
          
          console.log(`[SkeletonLinkRenderer] '${config.chainId}' updated`, { 
            links: state.links.size, 
            expected: expectedLinks,
            joints: chain.joints.length,
            lengths: lengths.length > 0 ? `${minLen.toFixed(3)}..${maxLen.toFixed(3)}` : 'none'
          });
        } finally {
          this.pendingFrame = 0;
        }
      });
    }
  }

  /**
   * Create a new link node
   */
  private createLinkNode(start: BABYLON.Vector3, end: BABYLON.Vector3, config: SkeletonLinkConfig, state: ChainRenderState, key: string): LinkNode {
    const distance = BABYLON.Vector3.Distance(start, end);
    if (distance < 0.001) {
      // Return placeholder for tiny links  
      return { mesh: null as any, id: key };
    }

    let mesh: BABYLON.Mesh;

    // Use 20mm diameter for bones (half of 40mm)
    const boneDiameter = 0.020; // 20mm diameter
    const sphereDiameter = 0.026; // 26mm diameter for spheres (20% larger than 22mm)
    
    console.log(`[CreateBoneMesh] Creating bone with diameter: ${boneDiameter * 1000}mm`);
    
    if (config.style === 'bone') {
      // Use a uniform cylinder
      mesh = BABYLON.MeshBuilder.CreateCylinder(`bone_${key}`, {
        height: 1,
        diameter: boneDiameter, // 20mm diameter
        tessellation: 24,
      }, this.scene);
      mesh.material = state.boneMaterial;
    } else if (config.style === 'tube') {
      mesh = BABYLON.MeshBuilder.CreateCylinder(`cylinder_${key}`, {
        height: 1,
        diameterTop: boneDiameter * 2,
        diameterBottom: boneDiameter * 2,
        tessellation: 8,
      }, this.scene);
      mesh.material = state.material;
    } else if (config.style === 'line') {
      // Thin line
      mesh = BABYLON.MeshBuilder.CreateCylinder(`cylinder_${key}`, {
        height: 1,
        diameter: boneDiameter * 0.5,
        tessellation: 8
      }, this.scene);
      mesh.material = state.material;
    } else {
      // Default cylinder
      mesh = BABYLON.MeshBuilder.CreateCylinder(`cylinder_${key}`, {
        height: 1,
        diameterTop: boneDiameter * 2,
        diameterBottom: boneDiameter * 2,
        tessellation: 8
      }, this.scene);
      mesh.material = state.material;
    }

    // Parent bone mesh directly to skeleton container (same as spheres)
    mesh.parent = state.parentContainer;
    mesh.isPickable = false;
    mesh.renderingGroupId = 2;
    mesh.rotationQuaternion = BABYLON.Quaternion.Identity();

    const linkNode: LinkNode = { mesh, id: key };

    // Create joint spheres if enabled - make them yellow and at bone ends
    if (config.showJointSpheres) {
      const sphereRadius = sphereDiameter / 2; // Sphere radius
      const sphereA = BABYLON.MeshBuilder.CreateSphere(`sphere_a_${key}`, { 
        diameter: sphereRadius * 2 
      }, this.scene);
      const sphereB = BABYLON.MeshBuilder.CreateSphere(`sphere_b_${key}`, { 
        diameter: sphereRadius * 2 
      }, this.scene);
      
      // Use yellow sphere material
      if (state.sphereMaterial) {
        sphereA.material = state.sphereMaterial;
        sphereB.material = state.sphereMaterial;
      } else {
        // Fallback if no sphere material (shouldn't happen)
        sphereA.material = state.material;
        sphereB.material = state.material;
      }
      
      sphereA.parent = state.parentContainer; // Parent to skeleton container
      sphereB.parent = state.parentContainer;  // Parent to skeleton container
      sphereA.isPickable = false;
      sphereB.isPickable = false;
      sphereA.renderingGroupId = 2;
      sphereB.renderingGroupId = 2;

      linkNode.jointSphereA = sphereA;
      linkNode.jointSphereB = sphereB;
    }

    // Note: createLinkNode receives world coords (start/end) but updateLinkTransform expects local coords
    // The conversion to local happens in updateChainLinks, so we don't call updateLinkTransform here
    // It will be called with the correct local coords after creation
    
    return linkNode;
  }

  /**
   * Update link transform in-place
   * start and end are in LOCAL space of the skeleton container
   */
  private updateLinkTransform(linkNode: LinkNode, startLocal: BABYLON.Vector3, endLocal: BABYLON.Vector3, state: ChainRenderState, config?: SkeletonLinkConfig): void {
    // Check if mesh is valid
    if (!linkNode.mesh) {
      console.warn('[SkeletonLinkRenderer] Cannot update transform: mesh is null');
      return;
    }

    // Compute direction and length (already in local space)
    const dirLocal = endLocal.subtract(startLocal);
    const len = dirLocal.length();
    
    if (len < 1e-6) {
      linkNode.mesh.isVisible = false;
      return;
    }

    linkNode.mesh.isVisible = true;

    // Position cylinder: Babylon cylinders are Y-up, centered at origin
    // When scaled by 'len' in Y, the cylinder extends from -len/2 to +len/2 in local Y space
    // To connect from startLocal to endLocal:
    // - Position at startLocal 
    // - Orient +Y along dir (points towards endLocal)
    // - The cylinder will then extend from startLocal to endLocal
    
    const dirN = dirLocal.normalize();
    
    // Offset by half-length so the cylinder starts at startLocal
    const offset = dirN.scale(len * 0.5);
    const meshPos = startLocal.add(offset);
    
    linkNode.mesh.position.copyFrom(meshPos);

    // Orient cylinder: cylinder's +Y axis should point along dir
    const up = BABYLON.Vector3.Up();
    const dot = BABYLON.Vector3.Dot(up, dirN);
    
    let q: BABYLON.Quaternion;
    if (Math.abs(dot) > 0.98) {
      // Nearly aligned with Y axis
      q = BABYLON.Quaternion.Identity();
    } else {
      // Rotate from +Y (cylinder's local Y) to dirN (segment direction)
      const cross = BABYLON.Vector3.Cross(up, dirN).normalize();
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      q = BABYLON.Quaternion.RotationAxis(cross, angle);
    }
    linkNode.mesh.rotationQuaternion = q;

    // Scale: X/Z scale the cylinder diameter, Y scales the length
    // No scaling needed - created at 20mm diameter
    linkNode.mesh.scaling.set(1.0, len, 1.0);

    // Update joint spheres to be positioned at the bone ends in WORLD space
    // Spheres are parented to skeleton container, so we need to convert world -> container local
    if (linkNode.jointSphereA) {
      // Position sphere A at the start position (in container local space)
      linkNode.jointSphereA.position = startLocal;
      linkNode.jointSphereA.isVisible = true;
    }
    if (linkNode.jointSphereB) {
      // Position sphere B at the end position (in container local space)  
      linkNode.jointSphereB.position = endLocal;
      linkNode.jointSphereB.isVisible = true;
    }

    // No per-link logging - reduces spam, use frame-level summary instead
  }

  /**
   * Update joint sphere positions
   * Note: Spheres are already positioned in updateLinkTransform, this is just for completeness
   */
  private updateJointSpheres(linkNode: LinkNode, start: BABYLON.Vector3, end: BABYLON.Vector3, state: ChainRenderState): void {
    // Spheres are updated in updateLinkTransform, no need to duplicate here
    // This method kept for compatibility
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
        if (linkNode.mesh) linkNode.mesh.dispose();
        linkNode.jointSphereA?.dispose();
        linkNode.jointSphereB?.dispose();
      });
      state.material.dispose();
      state.boneMaterial?.dispose();
      state.sphereMaterial?.dispose();
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
    state.sphereMaterial?.dispose();
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
        state.sphereMaterial?.dispose();
      });
    });
    this.chainsByRobot.clear();
  }
}
