/**
 * Joint Visualization Tool
 *
 * Creates 3D gizmos to visualize detected joints:
 * - Joint axis (FromVector → ToVector)
 * - Rotation gizmo for revolute joints
 * - Translation arrow for prismatic joints
 * - Labels with joint info
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { extractJointTransforms, type JointTransform } from './extractJointTransforms';
import { SceneManager } from '../scene/SceneManager';

export class JointVisualizer {
  private scene: BABYLON.Scene;
  private gizmos: BABYLON.Mesh[] = [];
  private labels: BABYLON.Mesh[] = [];

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /**
   * Clear all visualization gizmos
   */
  clear(): void {
    this.gizmos.forEach(mesh => mesh.dispose());
    this.labels.forEach(mesh => mesh.dispose());
    this.gizmos = [];
    this.labels = [];
    console.log('[JointVisualizer] Cleared all gizmos');
  }

  /**
   * Visualize joints from a GLB file
   */
  async visualizeFromGLB(glbFilename: string): Promise<void> {
    console.log('[JointVisualizer] Starting visualization...');

    // Extract joint transforms using ICP analysis
    const result = await extractJointTransforms(glbFilename);

    console.log(`[JointVisualizer] Visualizing ${result.totalJoints} joints from ${result.units.length} units`);

    // Find the actual GLB root node in the real scene
    const glbRootNode = this.findGLBRootInScene(glbFilename);
    const worldTransform = glbRootNode ? glbRootNode.getWorldMatrix() : BABYLON.Matrix.Identity();

    if (glbRootNode) {
      console.log(`[JointVisualizer] Found GLB root node: ${glbRootNode.name}`);
      const pos = glbRootNode.getAbsolutePosition();
      console.log(`[JointVisualizer] GLB position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    } else {
      console.warn('[JointVisualizer] GLB root node not found in scene - gizmos will use local coordinates');
    }

    // Clear previous gizmos
    this.clear();

    // Visualize each unit's joints
    for (const unit of result.units) {
      for (const joint of unit.joints) {
        this.visualizeJoint(unit.unitName, joint, worldTransform);
      }
    }

    console.log(`[JointVisualizer] ✓ Created ${this.gizmos.length} visualization objects`);
  }

  /**
   * Find the GLB root node in the current scene
   */
  private findGLBRootInScene(glbFilename: string): BABYLON.TransformNode | null {
    // Try to find by filename (without extension)
    const baseName = glbFilename.replace(/\.glb$/i, '');

    console.log(`[JointVisualizer] Searching for GLB root node matching: "${baseName}" or "9X_110_GEO"`);
    console.log(`[JointVisualizer] Total transform nodes in scene: ${this.scene.transformNodes.length}`);

    // Search ALL nodes in the scene (not just transformNodes)
    const allNodes = this.scene.getNodes();
    console.log(`[JointVisualizer] Total nodes in scene: ${allNodes.length}`);

    // First pass: Look for exact root node name
    for (const node of allNodes) {
      if (node.name === '9X_110_GEO' || node.name === baseName) {
        console.log(`[JointVisualizer] Found exact match: ${node.name}`);
        if (node instanceof BABYLON.TransformNode) {
          return node;
        }
      }
    }

    // Second pass: Search transform nodes with partial match
    for (const node of this.scene.transformNodes) {
      if (node.name.includes(baseName) ||
          node.name.includes('9X_110_GEO') ||
          node.name.includes('UNIT_112')) {
        console.log(`[JointVisualizer] Found partial match: ${node.name}, parent: ${node.parent?.name || 'none'}`);
        // Check if this is a root node (no parent)
        if (!node.parent) {
          return node;
        }
      }
    }

    console.warn('[JointVisualizer] No matching GLB root node found');
    return null;
  }

  /**
   * Visualize a single joint
   */
  private visualizeJoint(unitName: string, joint: JointTransform, worldTransform: BABYLON.Matrix): void {
    const fromVec = joint.fromVector;
    const toVec = joint.toVector;

    if (!fromVec || !toVec) {
      console.warn(`[JointVisualizer] Skipping ${unitName}/${joint.jointName} - missing vectors`);
      return;
    }

    // Transform from local coordinates to world coordinates
    const fromLocal = new BABYLON.Vector3(fromVec.x, fromVec.y, fromVec.z);
    const toLocal = new BABYLON.Vector3(toVec.x, toVec.y, toVec.z);

    const from = BABYLON.Vector3.TransformCoordinates(fromLocal, worldTransform);
    const to = BABYLON.Vector3.TransformCoordinates(toLocal, worldTransform);

    console.log(`[JointVisualizer] Creating gizmo for ${unitName}/${joint.jointName} (${joint.type})`);

    // 1. Create joint axis line (FromVector → ToVector)
    this.createAxisLine(from, to, joint.type);

    // 2. Create sphere markers at FromVector and ToVector
    this.createSphereMarker(from, 0.05, BABYLON.Color3.Green()); // FromVector = Green
    this.createSphereMarker(to, 0.05, BABYLON.Color3.Red());     // ToVector = Red

    // 3. Create rotation gizmo or translation arrow
    if (joint.type === 'revolute') {
      this.createRevoluteGizmo(from, to, joint);
    } else {
      this.createPrismaticGizmo(from, to, joint);
    }

    // 4. Create text label
    this.createLabel(to, `${unitName}/${joint.jointName}`, joint);
  }

  /**
   * Create axis line from FromVector to ToVector
   */
  private createAxisLine(from: BABYLON.Vector3, to: BABYLON.Vector3, type: 'revolute' | 'prismatic'): void {
    const line = BABYLON.MeshBuilder.CreateLines(
      'joint_axis',
      {
        points: [from, to]
      },
      this.scene
    );

    // Color: Yellow for revolute, Cyan for prismatic
    line.color = type === 'revolute'
      ? new BABYLON.Color3(1, 1, 0)  // Yellow
      : new BABYLON.Color3(0, 1, 1); // Cyan

    this.gizmos.push(line);
  }

  /**
   * Create sphere marker at a point
   */
  private createSphereMarker(position: BABYLON.Vector3, diameter: number, color: BABYLON.Color3): void {
    const sphere = BABYLON.MeshBuilder.CreateSphere(
      'joint_marker',
      { diameter },
      this.scene
    );

    sphere.position = position;

    const material = new BABYLON.StandardMaterial('marker_mat', this.scene);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.5);
    sphere.material = material;

    this.gizmos.push(sphere);
  }

  /**
   * Create revolute (rotation) gizmo
   */
  private createRevoluteGizmo(from: BABYLON.Vector3, _to: BABYLON.Vector3, joint: JointTransform): void {
    if (!joint.axis) return;

    const axis = new BABYLON.Vector3(joint.axis.x, joint.axis.y, joint.axis.z);
    const center = from; // Rotation center

    // Create torus to show rotation plane
    const torus = BABYLON.MeshBuilder.CreateTorus(
      'rotation_gizmo',
      {
        diameter: 0.3,
        thickness: 0.02,
        tessellation: 32
      },
      this.scene
    );

    torus.position = center;

    // Align torus perpendicular to rotation axis
    const up = BABYLON.Vector3.Up();
    const rotationAxis = BABYLON.Vector3.Cross(up, axis);
    if (rotationAxis.length() > 0.001) {
      const angle = Math.acos(BABYLON.Vector3.Dot(up, axis));
      torus.rotationQuaternion = BABYLON.Quaternion.RotationAxis(rotationAxis.normalize(), angle);
    }

    const material = new BABYLON.StandardMaterial('revolute_mat', this.scene);
    material.diffuseColor = new BABYLON.Color3(1, 0.5, 0); // Orange
    material.emissiveColor = new BABYLON.Color3(0.3, 0.15, 0);
    material.alpha = 0.7;
    torus.material = material;

    this.gizmos.push(torus);

    // Create arrow showing rotation direction
    this.createRotationArrow(center, axis, 0.2);
  }

  /**
   * Create rotation arrow
   */
  private createRotationArrow(center: BABYLON.Vector3, axis: BABYLON.Vector3, radius: number): void {
    // Suppress unused variable warning - to parameter not needed for current implementation
    void center;
    // Create curved arrow (simplified as straight arrow for now)
    const perpendicular = BABYLON.Vector3.Cross(axis, BABYLON.Vector3.Up());
    if (perpendicular.length() < 0.001) {
      perpendicular.set(1, 0, 0);
    }
    perpendicular.normalize();

    const arrowStart = center.add(perpendicular.scale(radius));
    const arrowEnd = center.add(perpendicular.scale(radius * 1.3));

    const arrow = BABYLON.MeshBuilder.CreateLines(
      'rotation_arrow',
      {
        points: [arrowStart, arrowEnd]
      },
      this.scene
    );

    arrow.color = new BABYLON.Color3(1, 0.5, 0); // Orange
    this.gizmos.push(arrow);
  }

  /**
   * Create prismatic (translation) gizmo
   */
  private createPrismaticGizmo(from: BABYLON.Vector3, to: BABYLON.Vector3, _joint: JointTransform): void {
    // Create arrow showing translation direction
    const direction = to.subtract(from);
    const length = direction.length();

    if (length < 0.001) return;

    const arrow = BABYLON.MeshBuilder.CreateCylinder(
      'translation_arrow',
      {
        height: length,
        diameterTop: 0,
        diameterBottom: 0.05,
        tessellation: 16
      },
      this.scene
    );

    // Position and orient arrow
    arrow.position = BABYLON.Vector3.Lerp(from, to, 0.5);

    const up = BABYLON.Vector3.Up();
    const rotationAxis = BABYLON.Vector3.Cross(up, direction.normalize());
    if (rotationAxis.length() > 0.001) {
      const angle = Math.acos(BABYLON.Vector3.Dot(up, direction.normalize()));
      arrow.rotationQuaternion = BABYLON.Quaternion.RotationAxis(rotationAxis.normalize(), angle);
    }

    const material = new BABYLON.StandardMaterial('prismatic_mat', this.scene);
    material.diffuseColor = new BABYLON.Color3(0, 1, 1); // Cyan
    material.emissiveColor = new BABYLON.Color3(0, 0.3, 0.3);
    arrow.material = material;

    this.gizmos.push(arrow);
  }

  /**
   * Create text label
   */
  private createLabel(position: BABYLON.Vector3, text: string, joint: JointTransform): void {
    // Create a simple plane with text texture
    const plane = BABYLON.MeshBuilder.CreatePlane(
      'joint_label',
      { size: 0.3 },
      this.scene
    );

    plane.position = position.add(new BABYLON.Vector3(0, 0.2, 0)); // Offset above joint
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    // Create dynamic texture for text
    const texture = new BABYLON.DynamicTexture(
      'label_texture',
      { width: 512, height: 256 },
      this.scene
    );

    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 512, 256);

    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 60);

    ctx.font = '30px Arial';
    ctx.fillStyle = joint.type === 'revolute' ? '#ff8800' : '#00ffff';
    ctx.fillText(
      joint.type === 'revolute'
        ? `Revolute: ${joint.maxValue.toFixed(1)}°`
        : `Prismatic: ${joint.maxValue.toFixed(3)}m`,
      256,
      120
    );

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '24px Arial';
    ctx.fillText(`Points: ${joint.pointCountFixed}/${joint.pointCountMoving}`, 256, 160);
    ctx.fillText(`RMS: ${joint.rmsError.toExponential(2)}`, 256, 200);

    texture.update();

    const material = new BABYLON.StandardMaterial('label_mat', this.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.opacityTexture = texture;
    material.backFaceCulling = false;
    plane.material = material;

    this.labels.push(plane);
  }
}

/**
 * Global visualizer instance
 */
let globalVisualizer: JointVisualizer | null = null;

/**
 * Wait for scene to be ready
 */
async function waitForScene(maxWaitMs: number = 5000): Promise<BABYLON.Scene> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      if (scene) {
        console.log('[JointVisualizer] Scene ready!');
        return scene;
      }
    } catch (e) {
      // SceneManager not yet initialized, keep waiting
    }

    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error('Scene not initialized after waiting. Please ensure the editor has loaded.');
}

/**
 * Visualize joints in the scene
 */
export async function visualizeJoints(
  glbFilename: string = '9X_110_GEO_UNIT_112.glb',
  scene?: BABYLON.Scene
): Promise<void> {
  console.log('🚀 [visualizeJoints] FUNCTION CALLED with file:', glbFilename);

  // Get scene from editor store if not provided
  if (!scene) {
    console.log('[JointVisualizer] Waiting for scene to initialize...');
    scene = await waitForScene();
  }

  console.log('[JointVisualizer] Scene obtained:', !!scene);

  // Create or reuse visualizer
  if (!globalVisualizer || globalVisualizer['scene'] !== scene) {
    console.log('[JointVisualizer] Creating new visualizer...');
    globalVisualizer = new JointVisualizer(scene);
  }

  console.log('[JointVisualizer] About to call visualizeFromGLB...');
  // Visualize joints
  await globalVisualizer.visualizeFromGLB(glbFilename);
  console.log('[JointVisualizer] ✅ COMPLETED');
}

/**
 * Clear joint visualizations
 */
export function clearJointVisualizations(): void {
  if (globalVisualizer) {
    globalVisualizer.clear();
  }
}
