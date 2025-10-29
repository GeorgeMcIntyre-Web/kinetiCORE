/**
 * TransformDebugVisualizer.ts
 * Visual debugging system for 3D transforms and coordinate spaces
 *
 * Purpose: Help understand where mesh transforms diverge from computed poses
 * Shows: Joint frames, FK vs mesh positions, coordinate space conversions
 */

import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import type { ForwardKinematicsSolver } from './ForwardKinematicsSolver';
import type { KinematicsManager } from './KinematicsManager';

export interface TransformDebugOptions {
  showJointFrames: boolean;      // Show XYZ axes at each joint
  showMeshFrames: boolean;        // Show actual mesh world transforms
  showFKFrames: boolean;          // Show FK computed transforms
  showDivergence: boolean;        // Highlight divergence between mesh and FK
  showBaseFrame: boolean;         // Show robot base world frame
  showTCPFrame: boolean;          // Show TCP frame (both mesh and FK)
  frameSize: number;              // Size of axis arrows (meters)
  divergenceThreshold: number;    // Distance to trigger divergence warning (meters)
}

interface DebugFrame {
  position: BABYLON.Vector3;
  rotation: BABYLON.Quaternion;
  label: string;
  type: 'mesh' | 'fk' | 'base' | 'tcp';
  divergence?: number;
}

export class TransformDebugVisualizer {
  private static instance: TransformDebugVisualizer;
  private scene: BABYLON.Scene | null = null;
  private fkSolver: ForwardKinematicsSolver | null = null;
  private kinematicsManager: KinematicsManager | null = null;

  // Debug mesh containers
  private debugMeshes: Map<string, BABYLON.Mesh[]> = new Map();
  private debugLabels: Map<string, GUI.TextBlock[]> = new Map();
  private advancedTexture: GUI.AdvancedDynamicTexture | null = null;

  // Default options
  private options: TransformDebugOptions = {
    showJointFrames: true,
    showMeshFrames: true,
    showFKFrames: true,
    showDivergence: true,
    showBaseFrame: true,
    showTCPFrame: true,
    frameSize: 0.1, // 10cm
    divergenceThreshold: 0.001, // 1mm
  };

  private enabled = false;

  private constructor() {}

  static getInstance(): TransformDebugVisualizer {
    if (!TransformDebugVisualizer.instance) {
      TransformDebugVisualizer.instance = new TransformDebugVisualizer();
    }
    return TransformDebugVisualizer.instance;
  }

  /**
   * Initialize the debug visualizer
   */
  initialize(
    scene: BABYLON.Scene,
    fkSolver: ForwardKinematicsSolver,
    kinematicsManager: KinematicsManager
  ): void {
    this.scene = scene;
    this.fkSolver = fkSolver;
    this.kinematicsManager = kinematicsManager;

    // Create GUI overlay for labels
    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('TransformDebugUI');

    console.log('[TransformDebugVisualizer] Initialized');
  }

  /**
   * Enable/disable debug visualization
   */
  setEnabled(enabled: boolean, options?: Partial<TransformDebugOptions>): void {
    this.enabled = enabled;
    if (options) {
      this.options = { ...this.options, ...options };
    }

    if (enabled) {
      console.log('[TransformDebugVisualizer] Enabled with options:', this.options);
      this.update();
    } else {
      console.log('[TransformDebugVisualizer] Disabled');
      this.clear();
    }
  }

  /**
   * Update options without changing enabled state
   */
  setOptions(options: Partial<TransformDebugOptions>): void {
    this.options = { ...this.options, ...options };
    if (this.enabled) {
      this.update();
    }
  }

  /**
   * Main update loop - call this every frame or on-demand
   */
  update(): void {
    if (!this.enabled || !this.scene || !this.fkSolver || !this.kinematicsManager) {
      return;
    }

    // Clear previous debug meshes
    this.clear();

    const chains = this.kinematicsManager.getAllChains();

    for (const chain of chains) {
      const frames = this.collectFrames(chain.name);
      this.visualizeFrames(chain.name, frames);
      this.detectAndVisualizeDivergence(chain.name, frames);
    }
  }

  /**
   * Collect all transform frames for a kinematic chain
   */
  private collectFrames(chainName: string): DebugFrame[] {
    if (!this.fkSolver || !this.kinematicsManager) return [];

    const frames: DebugFrame[] = [];
    const chain = this.kinematicsManager.getChain(chainName);
    if (!chain) return frames;

    // 1. Base frame (WORLD)
    if (this.options.showBaseFrame) {
      const baseMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
      frames.push({
        position: baseMatrix.getTranslation(),
        rotation: BABYLON.Quaternion.FromRotationMatrix(baseMatrix.getRotationMatrix()),
        label: `${chainName}_BASE`,
        type: 'base',
      });
    }

    // 2. Get current joint angles from the kinematic chain (FIX: was undefined before)
    const joints = this.kinematicsManager.getActuatedJoints(chain.id);
    const jointAngles = joints.map(j => j.position);

    // 3. FK computed frames (ROBOT-LOCAL, then transform to WORLD)
    if (this.options.showFKFrames) {
      const fkPoseLocal = this.fkSolver.solve(chainName, jointAngles);
      if (fkPoseLocal) {
        const baseMatrix = this.kinematicsManager.getBaseWorldMatrix(chain.id) || BABYLON.Matrix.Identity();
        const fkPosWorld = BABYLON.Vector3.TransformCoordinates(fkPoseLocal.position, baseMatrix);
        const baseRot = BABYLON.Quaternion.FromRotationMatrix(baseMatrix.getRotationMatrix());
        const fkRotWorld = baseRot.multiply(fkPoseLocal.rotation);

        frames.push({
          position: fkPosWorld,
          rotation: fkRotWorld,
          label: `${chainName}_FK_TCP`,
          type: 'fk',
        });
      }
    }

    // 4. Mesh actual frames (WORLD - read from scene)
    if (this.options.showMeshFrames) {
      const meshPose = this.fkSolver.getNullTCPPose(chainName);
      if (meshPose) {
        frames.push({
          position: meshPose.position.clone(),
          rotation: meshPose.rotation.clone(),
          label: `${chainName}_MESH_TCP`,
          type: 'mesh',
        });
      }
    }

    // 5. TCP frame (with offset/rotation if defined)
    if (this.options.showTCPFrame) {
      const tcpPose = this.fkSolver.getTCPPose?.(chainName);
      if (tcpPose) {
        frames.push({
          position: tcpPose.position.clone(),
          rotation: tcpPose.rotation.clone(),
          label: `${chainName}_TCP_OFFSET`,
          type: 'tcp',
        });
      }
    }

    // 6. Individual joint frames (optional, can be expensive)
    if (this.options.showJointFrames) {
      // TODO: Add per-joint frame visualization
      // Would require FK solver to return intermediate transforms
    }

    return frames;
  }

  /**
   * Visualize coordinate frames as RGB XYZ axes
   */
  private visualizeFrames(chainName: string, frames: DebugFrame[]): void {
    if (!this.scene) return;

    const chainMeshes: BABYLON.Mesh[] = [];

    console.log(`[TransformDebugVisualizer] Visualizing ${frames.length} frames for ${chainName}`);

    for (const frame of frames) {
      console.log(`  - ${frame.type} at position: ${frame.position.toString()}`);

      // Create XYZ axes
      const axesMeshes = this.createAxes(
        frame.position,
        frame.rotation,
        this.options.frameSize,
        frame.type
      );

      chainMeshes.push(...axesMeshes);

      // Create label
      this.createLabel(frame.position, frame.label, frame.type);
    }

    console.log(`[TransformDebugVisualizer] Created ${chainMeshes.length} debug meshes`);
    this.debugMeshes.set(chainName, chainMeshes);
  }

  /**
   * Create XYZ axes at a given position/rotation
   */
  private createAxes(
    position: BABYLON.Vector3,
    rotation: BABYLON.Quaternion,
    size: number,
    type: 'mesh' | 'fk' | 'base' | 'tcp'
  ): BABYLON.Mesh[] {
    if (!this.scene) return [];

    const meshes: BABYLON.Mesh[] = [];

    // Color coding:
    // - mesh: bright RGB (actual scene state)
    // - fk: cyan/magenta/yellow (computed state)
    // - base: white/gray (reference)
    // - tcp: bright with glow (target)
    const colorScheme = {
      mesh: [
        new BABYLON.Color3(1, 0, 0),   // X: red
        new BABYLON.Color3(0, 1, 0),   // Y: green
        new BABYLON.Color3(0, 0, 1),   // Z: blue
      ],
      fk: [
        new BABYLON.Color3(0, 1, 1),   // X: cyan
        new BABYLON.Color3(1, 0, 1),   // Y: magenta
        new BABYLON.Color3(1, 1, 0),   // Z: yellow
      ],
      base: [
        new BABYLON.Color3(0.8, 0.8, 0.8), // X: light gray
        new BABYLON.Color3(0.6, 0.6, 0.6), // Y: gray
        new BABYLON.Color3(0.4, 0.4, 0.4), // Z: dark gray
      ],
      tcp: [
        new BABYLON.Color3(1, 0.5, 0),   // X: orange
        new BABYLON.Color3(0.5, 1, 0),   // Y: lime
        new BABYLON.Color3(0, 0.5, 1),   // Z: sky blue
      ],
    };

    const colors = colorScheme[type];
    const axes = [
      new BABYLON.Vector3(1, 0, 0), // X
      new BABYLON.Vector3(0, 1, 0), // Y
      new BABYLON.Vector3(0, 0, 1), // Z
    ];

    for (let i = 0; i < 3; i++) {
      // Rotate axis by frame rotation
      const axisWorld = axes[i].rotateByQuaternionToRef(rotation, new BABYLON.Vector3());
      const end = position.add(axisWorld.scale(size));

      // Create arrow
      const arrow = BABYLON.MeshBuilder.CreateLines(
        `debugAxis_${type}_${i}`,
        {
          points: [position, end],
        },
        this.scene
      );

      arrow.color = colors[i];
      arrow.isPickable = false;

      // Add arrowhead cone
      const cone = BABYLON.MeshBuilder.CreateCylinder(
        `debugAxisCone_${type}_${i}`,
        {
          diameterTop: 0,
          diameterBottom: size * 0.15,
          height: size * 0.3,
        },
        this.scene
      );

      cone.position = end;
      cone.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
        BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), axisWorld).normalize(),
        Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), axisWorld.normalize()))
      );

      const material = new BABYLON.StandardMaterial(`debugAxisMat_${type}_${i}`, this.scene);
      material.emissiveColor = colors[i];
      material.disableLighting = true;
      cone.material = material;
      cone.isPickable = false;

      meshes.push(arrow, cone);
    }

    return meshes;
  }

  /**
   * Create floating label at position
   */
  private createLabel(
    _position: BABYLON.Vector3,
    text: string,
    type: 'mesh' | 'fk' | 'base' | 'tcp'
  ): void {
    if (!this.advancedTexture || !this.scene) return;

    const label = new GUI.TextBlock();
    label.text = text;
    label.fontSize = 12;
    label.color = type === 'mesh' ? 'white' : type === 'fk' ? 'cyan' : type === 'tcp' ? 'orange' : 'gray';
    label.outlineWidth = 2;
    label.outlineColor = 'black';

    this.advancedTexture.addControl(label);

    // Link to 3D position
    label.linkWithMesh(BABYLON.MeshBuilder.CreateSphere(`debugLabel_${text}`, { diameter: 0.01 }, this.scene));
    label.linkOffsetY = -30;

    // Store for cleanup
    if (!this.debugLabels.has(text)) {
      this.debugLabels.set(text, []);
    }
    this.debugLabels.get(text)!.push(label);
  }

  /**
   * Detect divergence between mesh and FK computed poses
   */
  private detectAndVisualizeDivergence(chainName: string, frames: DebugFrame[]): void {
    if (!this.options.showDivergence || !this.scene) return;

    // Find mesh and FK TCP frames
    const meshFrame = frames.find(f => f.type === 'mesh' && f.label.includes('TCP'));
    const fkFrame = frames.find(f => f.type === 'fk' && f.label.includes('TCP'));

    if (!meshFrame || !fkFrame) return;

    // Compute divergence
    const divergence = BABYLON.Vector3.Distance(meshFrame.position, fkFrame.position);
    meshFrame.divergence = divergence;
    fkFrame.divergence = divergence;

    if (divergence > this.options.divergenceThreshold) {
      // Draw warning line between divergent frames
      const line = BABYLON.MeshBuilder.CreateLines(
        `divergence_${chainName}`,
        {
          points: [meshFrame.position, fkFrame.position],
        },
        this.scene
      );

      line.color = new BABYLON.Color3(1, 0, 0); // Red warning
      line.isPickable = false;

      // Add to debug meshes
      const chainMeshes = this.debugMeshes.get(chainName) || [];
      chainMeshes.push(line);
      this.debugMeshes.set(chainName, chainMeshes);

      // Log warning
      console.warn(
        `[TransformDebugVisualizer] DIVERGENCE DETECTED: ${chainName}`,
        `\n  Mesh TCP: ${meshFrame.position.toString()}`,
        `\n  FK TCP:   ${fkFrame.position.toString()}`,
        `\n  Distance: ${(divergence * 1000).toFixed(2)}mm`
      );
    } else {
      console.log(
        `[TransformDebugVisualizer] ${chainName} transforms aligned:`,
        `${(divergence * 1000).toFixed(3)}mm`
      );
    }
  }

  /**
   * Clear all debug visualizations
   */
  clear(): void {
    // Dispose all debug meshes
    for (const [, meshes] of this.debugMeshes) {
      for (const mesh of meshes) {
        mesh.dispose();
      }
    }
    this.debugMeshes.clear();

    // Remove all labels
    for (const [, textBlocks] of this.debugLabels) {
      for (const textBlock of textBlocks) {
        this.advancedTexture?.removeControl(textBlock);
      }
    }
    this.debugLabels.clear();
  }

  /**
   * Get divergence report for all chains
   */
  getDivergenceReport(): string {
    if (!this.fkSolver || !this.kinematicsManager) {
      return 'Visualizer not initialized';
    }

    const chains = this.kinematicsManager.getAllChains();
    let report = '=== Transform Divergence Report ===\n\n';

    for (const chain of chains) {
      const frames = this.collectFrames(chain.name);
      const meshFrame = frames.find(f => f.type === 'mesh' && f.label.includes('TCP'));
      const fkFrame = frames.find(f => f.type === 'fk' && f.label.includes('TCP'));

      if (meshFrame && fkFrame) {
        const divergence = BABYLON.Vector3.Distance(meshFrame.position, fkFrame.position);
        const status = divergence < this.options.divergenceThreshold ? '✅' : '❌';

        report += `${status} ${chain.name}:\n`;
        report += `  Mesh TCP: ${meshFrame.position.toString()}\n`;
        report += `  FK TCP:   ${fkFrame.position.toString()}\n`;
        report += `  Divergence: ${(divergence * 1000).toFixed(3)}mm\n\n`;
      }
    }

    return report;
  }
}
