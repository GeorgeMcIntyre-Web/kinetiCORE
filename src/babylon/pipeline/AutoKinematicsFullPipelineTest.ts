/**
 * Auto Kinematics Full Pipeline Test
 *
 * One-click comprehensive test for the complete auto kinematics workflow.
 * Includes full diagnostics, logging, and validation.
 *
 * Target file: 9X_110_GEO.glb
 *
 * Owner: George (Claude Code Agent 1)
 */

import * as BABYLON from '@babylonjs/core';
import { KinematicExtractionPipeline, type PipelineOptions } from './KinematicExtractionPipeline';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { KinematicModelExport } from '../io/Schemas';
import { useEditorStore } from '../../ui/store/editorStore';

/**
 * Test result for a single stage of the pipeline.
 */
interface StageResult {
  stage: string;
  success: boolean;
  duration: number; // milliseconds
  message: string;
  data?: any;
  errors: string[];
  warnings: string[];
}

/**
 * Complete test report for the full pipeline.
 */
interface TestReport {
  testName: string;
  filePath: string;
  timestamp: string;
  totalDuration: number;
  overallSuccess: boolean;
  stages: StageResult[];
  summary: {
    stagesPassed: number;
    stagesFailed: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

/**
 * Comprehensive test harness for auto kinematics pipeline.
 */
export class AutoKinematicsFullPipelineTest {
  private scene: BABYLON.Scene | null = null;
  private pipeline: KinematicExtractionPipeline | null = null;
  private loadedRootNode: BABYLON.TransformNode | null = null;
  private report: TestReport;
  private startTime: number = 0;

  constructor() {
    this.report = {
      testName: 'Auto Kinematics Full Pipeline Test',
      filePath: 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\Tooling\\9X_110_GEO.glb',
      timestamp: new Date().toISOString(),
      totalDuration: 0,
      overallSuccess: false,
      stages: [],
      summary: {
        stagesPassed: 0,
        stagesFailed: 0,
        totalErrors: 0,
        totalWarnings: 0,
      },
    };
  }

  /**
   * Run the complete test suite.
   */
  async runFullTest(): Promise<TestReport> {
    console.log('='.repeat(80));
    console.log('AUTO KINEMATICS FULL PIPELINE TEST');
    console.log('='.repeat(80));
    console.log(`Test File: ${this.report.filePath}`);
    console.log(`Start Time: ${this.report.timestamp}`);
    console.log('='.repeat(80));
    console.log('');

    this.startTime = performance.now();

    try {
      // Stage 0: Setup
      await this.testStage0_Setup();

      // Stage 1: Load GLB File
      await this.testStage1_LoadGLB();

      // Stage 2: Analyze Scene (Geometric Detection)
      await this.testStage2_AnalyzeScene();

      // Stage 3: Validate SceneTree Mapping
      await this.testStage3_ValidateSceneTree();

      // Stage 4: Simulate Retracted State Capture
      await this.testStage4_CaptureRetracted();

      // Stage 5: Simulate Extended State Capture
      await this.testStage5_CaptureExtended();

      // Stage 6: Fit Joints with ICP
      await this.testStage6_FitJoints();

      // Stage 7: Export JSON
      await this.testStage7_ExportJSON();

      // Stage 8: Validate Output
      await this.testStage8_ValidateOutput();

      this.report.overallSuccess = this.report.stages.every(s => s.success);
    } catch (error) {
      console.error('[TEST] FATAL ERROR:', error);
      this.report.stages.push({
        stage: 'Fatal Error',
        success: false,
        duration: 0,
        message: `Unhandled exception: ${error}`,
        errors: [String(error)],
        warnings: [],
      });
    } finally {
      this.report.totalDuration = performance.now() - this.startTime;
      this.printReport();
    }

    return this.report;
  }

  /**
   * Stage 0: Setup test environment.
   */
  private async testStage0_Setup(): Promise<void> {
    const stageName = 'Stage 0: Setup';
    const stageStart = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(`\n[${ stageName}] Starting...`);

    try {
      // Create Babylon scene
      const canvas = document.createElement('canvas');
      const engine = new BABYLON.Engine(canvas, true);
      this.scene = new BABYLON.Scene(engine);

      // Add camera and light
      const camera = new BABYLON.ArcRotateCamera(
        'camera',
        0,
        0,
        10,
        BABYLON.Vector3.Zero(),
        this.scene
      );
      camera.setPosition(new BABYLON.Vector3(5, 5, 5));

      new BABYLON.HemisphericLight(
        'light',
        new BABYLON.Vector3(0, 1, 0),
        this.scene
      );

      console.log(`[${stageName}] ✓ Babylon scene created`);
      console.log(`[${stageName}] ✓ Camera and light added`);

      // Initialize SceneTreeManager
      SceneTreeManager.getInstance();
      console.log(`[${stageName}] ✓ SceneTreeManager initialized`);

      this.report.stages.push({
        stage: stageName,
        success: true,
        duration: performance.now() - stageStart,
        message: 'Test environment setup complete',
        data: {
          sceneNodeCount: this.scene.rootNodes.length,
          meshCount: this.scene.meshes.length,
        },
        errors,
        warnings,
      });
    } catch (error) {
      errors.push(String(error));
      this.report.stages.push({
        stage: stageName,
        success: false,
        duration: performance.now() - stageStart,
        message: `Setup failed: ${error}`,
        errors,
        warnings,
      });
      throw error;
    }
  }

  /**
   * Register GLB nodes in SceneTree.
   * Recursively traverses Babylon node hierarchy and creates corresponding SceneTree nodes.
   *
   * @param rootNode - Root Babylon TransformNode from GLB file
   * @returns Number of nodes registered
   */
  private registerGLBInSceneTree(rootNode: BABYLON.TransformNode): number {
    const sceneTree = SceneTreeManager.getInstance();
    const sceneNode = sceneTree.getSceneNode();

    if (!sceneNode) {
      console.error('[registerGLBInSceneTree] SceneTree Scene node not found!');
      return 0;
    }

    let registeredCount = 0;

    /**
     * Recursively register a Babylon node and its children
     */
    const registerNode = (babylonNode: BABYLON.Node, parentSceneNodeId: string): void => {
      // Only process TransformNodes (not AbstractMeshes directly, they get picked up as children)
      if (!(babylonNode instanceof BABYLON.TransformNode)) {
        return;
      }

      // Skip if it's an AbstractMesh (we want container TransformNodes only)
      if (babylonNode instanceof BABYLON.AbstractMesh) {
        return;
      }

      // Check if already registered (avoid duplicates)
      const existingNode = sceneTree.getNodeByBabylonTransformNodeId(babylonNode.uniqueId.toString());
      if (existingNode) {
        // Already registered, just register children
        for (const child of babylonNode.getChildren()) {
          registerNode(child, existingNode.id);
        }
        return;
      }

      // Create SceneTree node
      let sceneTreeNode: any = null;
      try {
        sceneTreeNode = sceneTree.createNode(
          'collection',
          babylonNode.name,
          parentSceneNodeId
        );

        // Link to Babylon node
        sceneTreeNode.babylonTransformNodeId = babylonNode.uniqueId.toString();

        registeredCount++;
      } catch (error) {
        console.warn(`[registerGLBInSceneTree] Failed to register node ${babylonNode.name}:`, error);
        // Skip this node and its children if registration failed
        return;
      }

      // Recursively register children
      for (const child of babylonNode.getChildren()) {
        registerNode(child, sceneTreeNode.id);
      }
    };

    // Start recursive registration from root
    registerNode(rootNode, sceneNode.id);

    return registeredCount;
  }

  /**
   * Stage 1: Load 9X_110_GEO.glb file.
   */
  private async testStage1_LoadGLB(): Promise<void> {
    const stageName = 'Stage 1: Load GLB';
    const stageStart = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    // VERSION MARKER - Verify new code is loaded
    console.log(`[${stageName}] 🔥 CODE VERSION: 2025-10-31-v2 (WITH REGISTRATION + MOTION FIX) 🔥`);

    console.log(`\n[${stageName}] Starting...`);

    try {
      if (!this.scene) {
        throw new Error('Scene not initialized');
      }

      // Note: In a real browser environment, we'd use SceneLoader
      // For now, we'll simulate by creating a mock structure
      console.log(`[${stageName}] Loading actual GLB file...`);
      console.log(`[${stageName}] File path: ${this.report.filePath}`);

      // Load actual GLB file from public folder (served by dev server)
      const result = await BABYLON.SceneLoader.ImportMeshAsync(
        '',
        '/', // Root of public folder
        '9X_110_GEO.glb',
        this.scene
      );

      console.log(`[${stageName}] ✓ GLB file loaded`);
      console.log(`[${stageName}]   - Meshes imported: ${result.meshes.length}`);
      console.log(`[${stageName}]   - Transform nodes: ${result.transformNodes.length}`);

      // Find root node (usually __root__ or the first transform node)
      let rootNode: BABYLON.TransformNode | null = null;

      // Try to find a node named '9X_110_GEO' or similar
      for (const node of result.transformNodes) {
        if (node.name.includes('9X_110_GEO') || node.name === '__root__') {
          rootNode = node;
          break;
        }
      }

      // Fallback: use first transform node
      if (!rootNode && result.transformNodes.length > 0) {
        rootNode = result.transformNodes[0];
      }

      if (!rootNode) {
        throw new Error('No root transform node found in GLB file');
      }

      console.log(`[${stageName}] ✓ Root node identified: ${rootNode.name}`);
      console.log(`[${stageName}]   - Children: ${rootNode.getChildren().length}`);

      // Register GLB nodes in SceneTree
      console.log(`[${stageName}] Registering GLB nodes in SceneTree...`);
      let registeredCount = 0;
      try {
        registeredCount = this.registerGLBInSceneTree(rootNode);
        console.log(`[${stageName}] ✓ Registered ${registeredCount} nodes in SceneTree`);
      } catch (error) {
        console.error(`[${stageName}] ❌ Registration failed:`, error);
        warnings.push(`SceneTree registration failed: ${error}`);
      }

      // Persist for downstream stages
      this.loadedRootNode = rootNode;

      // Count meshes
      const meshCount = this.scene.meshes.length;
      const transformNodeCount = this.scene.transformNodes.length;

      console.log(`[${stageName}]   - Total meshes: ${meshCount}`);
      console.log(`[${stageName}]   - Total transform nodes: ${transformNodeCount}`);

      if (meshCount === 0) {
        warnings.push('No meshes found in scene');
      }

      this.report.stages.push({
        stage: stageName,
        success: true,
        duration: performance.now() - stageStart,
        message: 'GLB structure loaded successfully',
        data: {
          rootNodeName: rootNode.name,
          childCount: rootNode.getChildren().length,
          meshCount,
          transformNodeCount,
        },
        errors,
        warnings,
      });
    } catch (error) {
      errors.push(String(error));
      this.report.stages.push({
        stage: stageName,
        success: false,
        duration: performance.now() - stageStart,
        message: `GLB load failed: ${error}`,
        errors,
        warnings,
      });
      throw error;
    }
  }

  /**
   * Create mock 9X_110_GEO structure for testing.
   * (Currently unused - loading real GLB file instead)
   * @deprecated Use real GLB file loading instead
   */
  // @ts-expect-error - Keeping for reference, may be used for unit tests
  private _createMock9X110GEOStructure(scene: BABYLON.Scene): BABYLON.TransformNode {
    const root = new BABYLON.TransformNode('9X_110_GEO', scene);

    // Create UNIT_118 (clamp with fixed and moving jaws)
    const unit118Fixed = new BABYLON.TransformNode('UNIT_118_FIXED', scene);
    unit118Fixed.parent = root;
    unit118Fixed.position = new BABYLON.Vector3(0, 0, 0);

    // Create subdivided box for UNIT_118 fixed jaw (using sphere for better vertex count)
    const unit118FixedMesh = BABYLON.MeshBuilder.CreateSphere(
      'UNIT_118_FIXED_JAW',
      {
        diameterX: 0.2,
        diameterY: 0.1,
        diameterZ: 0.05,
        segments: 16 // Adds plenty of vertices
      },
      scene
    );
    unit118FixedMesh.parent = unit118Fixed;

    const unit118Moving = new BABYLON.TransformNode('UNIT_118_MOVING', scene);
    unit118Moving.parent = root;
    unit118Moving.position = new BABYLON.Vector3(0.15, 0, 0); // 15cm translated

    const unit118MovingMesh = BABYLON.MeshBuilder.CreateSphere(
      'UNIT_118_MOVING_JAW',
      {
        diameterX: 0.2,
        diameterY: 0.1,
        diameterZ: 0.05,
        segments: 16 // Same as fixed
      },
      scene
    );
    unit118MovingMesh.parent = unit118Moving;

    // Create UNIT_112 (pin retracted/extended)
    const unit112Fixed = new BABYLON.TransformNode('UNIT_112_FIXED', scene);
    unit112Fixed.parent = root;
    unit112Fixed.position = new BABYLON.Vector3(0.5, 0, 0);

    const unit112FixedMesh = BABYLON.MeshBuilder.CreateCylinder(
      'UNIT_112_PIN_RETRACTED',
      {
        height: 0.15,
        diameter: 0.02,
        tessellation: 64, // Higher radial subdivision for more vertices
        subdivisions: 20  // Higher height subdivision
      },
      scene
    );
    unit112FixedMesh.parent = unit112Fixed;

    const unit112Moving = new BABYLON.TransformNode('UNIT_112_MOVING', scene);
    unit112Moving.parent = root;
    unit112Moving.position = new BABYLON.Vector3(0.5, 0.1, 0); // 10cm extended

    const unit112MovingMesh = BABYLON.MeshBuilder.CreateCylinder(
      'UNIT_112_PIN_EXTENDED',
      {
        height: 0.15,
        diameter: 0.02,
        tessellation: 64, // Same as retracted
        subdivisions: 20
      },
      scene
    );
    unit112MovingMesh.parent = unit112Moving;

    // Create base fixture (large, near origin, highly connected)
    const baseFixture = new BABYLON.TransformNode('BASEPLATE', scene);
    baseFixture.parent = root;
    baseFixture.position = new BABYLON.Vector3(0, -0.2, 0);

    const baseMesh = BABYLON.MeshBuilder.CreateSphere(
      'BASEPLATE_MESH',
      {
        diameterX: 2.0,
        diameterY: 0.1,
        diameterZ: 1.5,
        segments: 16 // Large base needs vertices too
      },
      scene
    );
    baseMesh.parent = baseFixture;

    // Force world matrix computation for all nodes
    root.computeWorldMatrix(true);
    scene.meshes.forEach(m => m.computeWorldMatrix(true));

    // Log vertex counts for debugging point cloud sampling
    console.log('[Mock GLB] Mesh vertex counts:');
    console.log(`  - ${unit118FixedMesh.name}: ${unit118FixedMesh.getTotalVertices()} vertices`);
    console.log(`  - ${unit118MovingMesh.name}: ${unit118MovingMesh.getTotalVertices()} vertices`);
    console.log(`  - ${unit112FixedMesh.name}: ${unit112FixedMesh.getTotalVertices()} vertices`);
    console.log(`  - ${unit112MovingMesh.name}: ${unit112MovingMesh.getTotalVertices()} vertices`);
    console.log(`  - ${baseMesh.name}: ${baseMesh.getTotalVertices()} vertices`);

    // Register all TransformNodes in SceneTree
    const sceneTree = SceneTreeManager.getInstance();
    const sceneNodeId = sceneTree.getSceneNode()?.id;

    if (!sceneNodeId) {
      console.warn('[Mock GLB] SceneTree Scene node not found, skipping registration');
    } else {
      // Register root node
      const rootSceneNode = sceneTree.createNode('collection', root.name, sceneNodeId);
      rootSceneNode.babylonTransformNodeId = root.uniqueId.toString();
      console.log(`[Mock GLB] Registered root in SceneTree: ${root.name} (SceneNode ID: ${rootSceneNode.id}, Babylon ID: ${root.uniqueId})`);

      // Register each unit TransformNode
      const unitsToRegister = [
        { babylonNode: unit118Fixed, name: 'UNIT_118_FIXED' },
        { babylonNode: unit118Moving, name: 'UNIT_118_MOVING' },
        { babylonNode: unit112Fixed, name: 'UNIT_112_FIXED' },
        { babylonNode: unit112Moving, name: 'UNIT_112_MOVING' },
        { babylonNode: baseFixture, name: 'BASEPLATE' },
      ];

      for (const { babylonNode, name } of unitsToRegister) {
        const sceneNode = sceneTree.createNode('collection', name, rootSceneNode.id);
        sceneNode.babylonTransformNodeId = babylonNode.uniqueId.toString();
        console.log(`[Mock GLB] Registered ${name} in SceneTree (SceneNode ID: ${sceneNode.id}, Babylon ID: ${babylonNode.uniqueId})`);
      }
    }

    console.log('[Mock GLB] Created 9X_110_GEO structure:');
    console.log('  - UNIT_118: Fixed jaw + Moving jaw (prismatic, 15cm)');
    console.log('  - UNIT_112: Retracted pin + Extended pin (prismatic, 10cm)');
    console.log('  - BASEPLATE: Large fixed base');
    console.log(`[Mock GLB] Total scene meshes: ${scene.meshes.length}`);
    console.log(`[Mock GLB] Total scene transformNodes: ${scene.transformNodes.length}`);
    console.log(`[Mock GLB] Root children: ${root.getChildren().length}`);
    console.log(`[Mock GLB] Root descendants: ${root.getDescendants(true).length}`);

    return root;
  }

  /**
   * Stage 2: Analyze scene with geometric tool analyzer.
   */
  private async testStage2_AnalyzeScene(): Promise<void> {
    const stageName = 'Stage 2: Analyze Scene';
    const stageStart = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(`\n[${stageName}] Starting...`);

    try {
      if (!this.scene) {
        throw new Error('Scene not initialized');
      }

      // Initialize pipeline
      this.pipeline = new KinematicExtractionPipeline(this.scene);
      console.log(`[${stageName}] ✓ Pipeline initialized`);

      // Prefer current user selection as analysis root if available
      let rootNode: BABYLON.TransformNode | null = null;

      try {
        const selectedNodeId = useEditorStore.getState().selectedNodeId;
        if (selectedNodeId) {
          const tree = SceneTreeManager.getInstance();
          const selectedTreeNode = tree.getNode(selectedNodeId);
          const transformId = selectedTreeNode?.babylonTransformNodeId;
          if (transformId) {
            const uid = parseInt(transformId, 10);
            const candidate = this.scene.getTransformNodeByUniqueId(uid);
            if (candidate) {
              rootNode = candidate;
              console.log(`[${stageName}] Using user-selected node as root: ${candidate.name} (uid=${uid})`);
            }
          }
        }
      } catch (e) {
        console.warn(`[${stageName}] Could not resolve user selection as root:`, e);
      }

      // Fallback to the actual root node identified during GLB load
      if (!rootNode) {
        rootNode = this.loadedRootNode;
      }
      if (!rootNode) {
        throw new Error('Root node not available from GLB load stage');
      }

      // Configure options for detailed logging
      const options: PipelineOptions = {
        analysisMethod: 'geometric',
        geometric: {
          minVolume: 0.00001, // 0.01 cm³ (very sensitive)
          clusteringDistance: 0.5, // 50cm (group nearby parts)
          fixedProximityThreshold: 1.0, // 1m from origin
          fixedConnectivityThreshold: 2, // 2+ children = fixed
          similarityThreshold: 0.90, // 90% match for duplicates
        },
        fastFiltering: {
          enableDebug: true,
          bypassGeometricFilter: true, // For static GLB testing
          minPoints: 30, // Lower threshold for mock test (default is 50)
        },
        icp: {
          enableDebug: true,
        },
      };

      console.log(`[${stageName}] Analysis options:`, JSON.stringify(options.geometric, null, 2));

      // DEBUG: Log what we're passing to analyze
      console.log(`[${stageName}] DEBUG: Root node name: ${rootNode.name}`);
      console.log(`[${stageName}] DEBUG: Root node children: ${rootNode.getChildren().length}`);
      console.log(`[${stageName}] DEBUG: Root node descendants: ${rootNode.getDescendants(true).length}`);
      console.log(`[${stageName}] DEBUG: Scene meshes total: ${this.scene.meshes.length}`);
      console.log(`[${stageName}] DEBUG: Scene transformNodes total: ${this.scene.transformNodes.length}`);

      // TEST: Try new bounding box matching on UNIT_112
      console.log(`\n[${stageName}] === TESTING BOUNDING BOX MATCHING ===`);
      const { GeometricToolAnalyzer } = await import('../sceneAnalysis/GeometricToolAnalyzer');
      const analyzer = new GeometricToolAnalyzer();

      // Test at root level
      console.log(`[${stageName}] Testing at root level (${rootNode.name}):`);
      const rootPairs = analyzer.findTransformNodePairsByDimensions(
        rootNode,
        options.geometric?.similarityThreshold || 0.90
      );
      console.log(`[${stageName}] Root level pairs found: ${rootPairs.length}`);
      for (const [node1, node2] of rootPairs) {
        console.log(`[${stageName}]   - Pair: ${node1.name} ↔ ${node2.name}`);
      }

      // Test specifically on UNIT nodes (try UNIT_112, UNIT_124, or any UNIT_*)
      let unitNode: BABYLON.TransformNode | null = null;
      const unitNames = ['UNIT_112', 'UNIT_124', 'UNIT_118'];

      for (const name of unitNames) {
        unitNode = this.scene.getTransformNodeByName(name);
        if (unitNode) {
          console.log(`\n[${stageName}] Found ${name}, testing bounding box matching:`);
          const unitPairs = analyzer.findTransformNodePairsByDimensions(
            unitNode,
            options.geometric?.similarityThreshold || 0.90
          );
          console.log(`[${stageName}] ${name} pairs found: ${unitPairs.length}`);
          for (const [node1, node2] of unitPairs) {
            console.log(`[${stageName}]   - Pair: ${node1.name} ↔ ${node2.name}`);
          }
          break;
        }
      }

      if (!unitNode) {
        console.log(`[${stageName}] No UNIT_* nodes found in scene`);
        console.log(`[${stageName}] Available transform nodes (first 20):`);
        const transformNodes = this.scene.transformNodes.slice(0, 20);
        for (const node of transformNodes) {
          console.log(`[${stageName}]   - ${node.name} (uniqueId: ${node.uniqueId})`);
        }
      }

      console.log(`[${stageName}] === END BOUNDING BOX TEST ===\n`);

      // Run analysis with fallback: try name-based first, then geometric
      let toolGraph: any;
      try {
        toolGraph = await this.pipeline.analyzeScene({ analysisMethod: 'name-based' }, rootNode);
      } catch (_e) {
        toolGraph = await this.pipeline.analyzeScene(options, rootNode);
      }

      console.log(`[${stageName}] ✓ Analysis complete`);
      console.log(`[${stageName}]   - Total units: ${toolGraph.units.length}`);

      const fixedUnits = toolGraph.units.filter(u => u.isFixed);
      const movingUnits = toolGraph.units.filter(u => !u.isFixed);

      console.log(`[${stageName}]   - Fixed units: ${fixedUnits.length}`);
      console.log(`[${stageName}]   - Moving units: ${movingUnits.length}`);

      // Log each unit
      console.log(`[${stageName}] Unit details:`);
      for (const unit of toolGraph.units) {
        console.log(`[${stageName}]   ${unit.isFixed ? '🔒 FIXED' : '🔓 MOVING'}: ${unit.name}`);
        console.log(`[${stageName}]     - Type: ${unit.type}`);
        console.log(`[${stageName}]     - Root: ${unit.root}`);
        console.log(`[${stageName}]     - Nodes: ${unit.nodes.length}`);
      }

      // Validation
      if (toolGraph.units.length === 0) {
        errors.push('No tool units detected');
      }
      if (fixedUnits.length === 0) {
        warnings.push('No fixed units detected');
      }
      if (movingUnits.length === 0) {
        errors.push('No moving units detected - cannot proceed with pipeline');
      }

      this.report.stages.push({
        stage: stageName,
        success: errors.length === 0,
        duration: performance.now() - stageStart,
        message: `Detected ${toolGraph.units.length} units (${fixedUnits.length} fixed, ${movingUnits.length} moving)`,
        data: {
          totalUnits: toolGraph.units.length,
          fixedUnits: fixedUnits.length,
          movingUnits: movingUnits.length,
          units: toolGraph.units.map(u => ({
            name: u.name,
            isFixed: u.isFixed,
            type: u.type,
            nodeCount: u.nodes.length,
          })),
        },
        errors,
        warnings,
      });

      if (errors.length > 0) {
        throw new Error(`Analysis failed: ${errors.join(', ')}`);
      }
    } catch (error) {
      errors.push(String(error));
      this.report.stages.push({
        stage: stageName,
        success: false,
        duration: performance.now() - stageStart,
        message: `Analysis failed: ${error}`,
        errors,
        warnings,
      });
      throw error;
    }
  }

  /**
   * Stage 3: Validate SceneTree node mapping.
   */
  private async testStage3_ValidateSceneTree(): Promise<void> {
    const stageName = 'Stage 3: Validate SceneTree';
    const stageStart = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(`\n[${stageName}] Starting...`);

    try {
      if (!this.pipeline) {
        throw new Error('Pipeline not initialized');
      }

      const toolGraph = this.pipeline.getToolGraph();
      if (!toolGraph) {
        throw new Error('Tool graph not available');
      }

      const tree = SceneTreeManager.getInstance();

      console.log(`[${stageName}] Validating node mappings for ${toolGraph.units.length} units...`);

      let missingNodes = 0;
      let nodesWithoutTransformId = 0;

      for (const unit of toolGraph.units) {
        console.log(`[${stageName}] Checking unit: ${unit.name}`);
        console.log(`[${stageName}]   - unit.root (Babylon uniqueId): ${unit.root}`);

        // unit.root is expected to be Babylon uniqueId string; look up by babylonTransformNodeId
        const sceneNode = tree.getNodeByBabylonTransformNodeId(unit.root);
        if (!sceneNode) {
          errors.push(`Unit ${unit.name}: Root node ${unit.root} not found in SceneTree (babylonTransformNodeId lookup)`);
          missingNodes++;
          continue;
        }

        console.log(`[${stageName}]   ✓ Root node found: ${sceneNode.id}`);

        if (!sceneNode.babylonTransformNodeId) {
          warnings.push(`Unit ${unit.name}: babylonTransformNodeId missing`);
          nodesWithoutTransformId++;
        } else {
          console.log(`[${stageName}]     - babylonTransformNodeId: ${sceneNode.babylonTransformNodeId}`);
        }

        // Check child nodes (lookup by Babylon transform ID)
        let childrenFound = 0;
        let childrenMissing = 0;

        for (const nodeId of unit.nodes) {
          const childNode = tree.getNodeByBabylonTransformNodeId(nodeId);
          if (!childNode) childrenMissing++; else childrenFound++;
        }

        console.log(`[${stageName}]   - Child nodes: ${childrenFound}/${unit.nodes.length} found`);

        if (childrenMissing > 0) {
          warnings.push(`Unit ${unit.name}: ${childrenMissing}/${unit.nodes.length} child nodes missing from SceneTree`);
        }
      }

      const success = errors.length === 0;

      this.report.stages.push({
        stage: stageName,
        success,
        duration: performance.now() - stageStart,
        message: success
          ? 'All nodes validated successfully'
          : `Validation failed: ${missingNodes} units with missing root nodes`,
        data: {
          totalUnits: toolGraph.units.length,
          missingRootNodes: missingNodes,
          nodesWithoutTransformId,
        },
        errors,
        warnings,
      });

      if (!success) {
        throw new Error('SceneTree validation failed');
      }
    } catch (error) {
      errors.push(String(error));
      this.report.stages.push({
        stage: stageName,
        success: false,
        duration: performance.now() - stageStart,
        message: `Validation failed: ${error}`,
        errors,
        warnings,
      });
      throw error;
    }
  }

  /**
   * Stage 4: Capture retracted states.
   */
  private async testStage4_CaptureRetracted(): Promise<void> {
    const stageName = 'Stage 4: Capture Retracted States';
    const stageStart = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(`\n[${stageName}] Starting...`);

    try {
      if (!this.pipeline || !this.scene) {
        throw new Error('Pipeline or scene not initialized');
      }

      const toolGraph = this.pipeline.getToolGraph();
      if (!toolGraph) {
        throw new Error('Tool graph not available');
      }

      const movingUnits = toolGraph.units.filter(u => !u.isFixed);

      console.log(`[${stageName}] Positioning ${movingUnits.length} moving units in retracted state...`);

      // Position moving units in retracted state (initial position)
      for (const unit of movingUnits) {
        const node = this.scene.getTransformNodeByName(unit.name);
        if (node) {
          // Store original position (this is the retracted state)
          console.log(`[${stageName}]   - ${unit.name}: position = (${node.position.x.toFixed(3)}, ${node.position.y.toFixed(3)}, ${node.position.z.toFixed(3)})`);
        } else {
          warnings.push(`Unit ${unit.name}: Transform node not found in scene`);
        }
      }

      // Capture retracted states
      await this.pipeline.captureRetractedStates();

      console.log(`[${stageName}] ✓ Retracted states captured`);

      const statePairs = this.pipeline.getStatePairs();
      console.log(`[${stageName}]   - State pairs: ${statePairs.size}`);

      // Validate each capture
      let totalPoints = 0;
      let emptyCaptures = 0;

      for (const [_unitId, statePair] of statePairs.entries()) {
        const retracted = statePair.retracted;
        const pointCount = retracted?.pointCloud?.length || 0;

        console.log(`[${stageName}]   - ${statePair.unit.name}: ${pointCount} points captured`);

        if (pointCount === 0) {
          errors.push(`Unit ${statePair.unit.name}: Empty point cloud captured`);
          emptyCaptures++;
        }

        totalPoints += pointCount;
      }

      const success = errors.length === 0 && statePairs.size > 0;

      this.report.stages.push({
        stage: stageName,
        success,
        duration: performance.now() - stageStart,
        message: `Captured retracted states for ${statePairs.size} units (${totalPoints} total points)`,
        data: {
          unitsCaptured: statePairs.size,
          totalPoints,
          emptyCaptures,
        },
        errors,
        warnings,
      });

      if (!success) {
        throw new Error('Retracted state capture failed');
      }
    } catch (error) {
      errors.push(String(error));
      this.report.stages.push({
        stage: stageName,
        success: false,
        duration: performance.now() - stageStart,
        message: `Capture failed: ${error}`,
        errors,
        warnings,
      });
      throw error;
    }
  }

  /**
   * Stage 5: Capture extended states (simulate motion).
   */
  private async testStage5_CaptureExtended(): Promise<void> {
    const stageName = 'Stage 5: Capture Extended States';
    const stageStart = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(`\n[${stageName}] Starting...`);

    try {
      if (!this.pipeline || !this.scene) {
        throw new Error('Pipeline or scene not initialized');
      }

      const toolGraph = this.pipeline.getToolGraph();
      if (!toolGraph) {
        throw new Error('Tool graph not available');
      }

      const movingUnits = toolGraph.units.filter(u => !u.isFixed);

      console.log(`[${stageName}] Simulating motion for ${movingUnits.length} moving units...`);

      // Simulate motion: translate moving units
      let movedCount = 0;
      let notFoundCount = 0;

      for (const unit of movingUnits) {
        // Strategy: prefer unit.root; if it has no child meshes, pick the deepest transform node under unit.nodes with meshes
        let targetNode: BABYLON.TransformNode | null = null;

        // Try unit.root
        const rootUid = parseInt(unit.root, 10);
        if (!isNaN(rootUid)) {
          const rootTn = this.scene.getTransformNodeByUniqueId(rootUid);
          if (rootTn) {
            const hasMeshes = (rootTn.getChildMeshes(false) as BABYLON.AbstractMesh[]).length > 0;
            if (hasMeshes) targetNode = rootTn;
          }
        }

        // Fallback: scan unit.nodes for a transform node that owns meshes (pick the one with most meshes)
        if (!targetNode) {
          let bestCount = -1;
          for (const nodeId of unit.nodes) {
            const uid = parseInt(nodeId, 10);
            if (isNaN(uid)) continue;
            const tn = this.scene.getTransformNodeByUniqueId(uid);
            if (!tn) continue;
            const count = (tn.getChildMeshes(false) as BABYLON.AbstractMesh[]).length;
            if (count > bestCount) {
              bestCount = count;
              targetNode = tn;
            }
          }
        }

        if (targetNode) {
          const motionAmount = 0.10; // 10cm
          const rotationAmount = Math.PI / 18; // 10 degrees

          // Apply both translation and a small rotation to generate a clear transform
          targetNode.position.x += motionAmount;
          targetNode.rotate(BABYLON.Axis.Z, rotationAmount);

          // Recompute world matrices
          targetNode.computeWorldMatrix(true);
          const childMeshes = targetNode.getChildMeshes(false) as BABYLON.AbstractMesh[];
          for (const mesh of childMeshes) mesh.computeWorldMatrix(true);

          console.log(`[${stageName}]   ✓ ${unit.name}: moved node '${targetNode.name}' (+${(motionAmount * 1000).toFixed(0)}mm X, +${(rotationAmount * 180 / Math.PI).toFixed(0)}° Z), childMeshes=${childMeshes.length}`);
          movedCount++;
        } else {
          console.log(`[${stageName}]   ✗ ${unit.name}: No suitable TransformNode with meshes found (root uid: ${unit.root})`);
          warnings.push(`Unit ${unit.name}: No mesh-owning transform node found for motion`);
          notFoundCount++;
        }
      }

      console.log(`[${stageName}] Motion simulation complete: ${movedCount} moved, ${notFoundCount} not found`);

      // Force scene update to ensure all world matrices are current
      this.scene.getEngine().runRenderLoop(() => {}); // Trigger one render pass
      await new Promise(resolve => setTimeout(resolve, 16)); // Wait one frame (~16ms)

      // Capture extended states
      await this.pipeline.captureExtendedStates();

      console.log(`[${stageName}] ✓ Extended states captured`);

      const statePairs = this.pipeline.getStatePairs();
      console.log(`[${stageName}]   - State pairs: ${statePairs.size}`);

      // Validate each capture
      let totalPoints = 0;
      let emptyCaptures = 0;
      let completePairs = 0;

      for (const [_unitId, statePair] of statePairs.entries()) {
        const extended = statePair.extended;
        const pointCount = extended?.pointCloud?.length || 0;

        console.log(`[${stageName}]   - ${statePair.unit.name}: ${pointCount} points captured`);

        if (pointCount === 0) {
          errors.push(`Unit ${statePair.unit.name}: Empty extended point cloud`);
          emptyCaptures++;
        }

        if (statePair.retracted && statePair.extended) {
          completePairs++;
        }

        totalPoints += pointCount;
      }

      const success = errors.length === 0 && completePairs > 0;

      this.report.stages.push({
        stage: stageName,
        success,
        duration: performance.now() - stageStart,
        message: `Captured extended states for ${completePairs} units (${totalPoints} total points)`,
        data: {
          unitsCaptured: statePairs.size,
          completePairs,
          totalPoints,
          emptyCaptures,
        },
        errors,
        warnings,
      });

      if (!success) {
        throw new Error('Extended state capture failed');
      }
    } catch (error) {
      errors.push(String(error));
      this.report.stages.push({
        stage: stageName,
        success: false,
        duration: performance.now() - stageStart,
        message: `Capture failed: ${error}`,
        errors,
        warnings,
      });
      throw error;
    }
  }

  /**
   * Stage 6: Fit joints using ICP.
   */
  private async testStage6_FitJoints(): Promise<void> {
    const stageName = 'Stage 6: Fit Joints (ICP)';
    const stageStart = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(`\n[${stageName}] Starting...`);

    try {
      if (!this.pipeline) {
        throw new Error('Pipeline not initialized');
      }

      const options: PipelineOptions = {
        icp: {
          maxIterations: 100,
          tolerance: 1e-6,
          enableDebug: true,
        },
        jointExtraction: {
          translationThreshold: 0.001, // 1mm
          rotationThreshold: 0.05, // ~2.86°
        },
        minConfidence: 0.3, // Lower threshold for testing
        useProfessionalICP: true,
        fastFiltering: {
          // Make coarse filter permissive so low error doesn't get misclassified as "no motion"
          minPoints: 30,
          coarsePointCount: 100,
          coarseMaxIterations: 30,
          coarseErrorMin: 0.0,
          minCentroidDistance: 0.0,
          translationRange: { min: 0.0, max: 2.0 },
          rotationRange: { min: 0.0, max: 180.0 },
          enableDebug: true,
          bypassGeometricFilter: true,
        },
      };

      console.log(`[${stageName}] Running ICP with options:`, JSON.stringify(options.icp, null, 2));

      // Fit joints
      await this.pipeline.fitJoints(options);

      console.log(`[${stageName}] ✓ Joint fitting complete`);

      const icpResults = this.pipeline.getICPResults();
      console.log(`[${stageName}]   - Joints fitted: ${icpResults.size}`);

      // Analyze each joint
      let prismaticCount = 0;
      let hingeCount = 0;
      let lowConfidenceCount = 0;
      let highErrorCount = 0;

      for (const [_unitId, result] of icpResults.entries()) {
        const { unit, icpResult, jointFit } = result;

        console.log(`[${stageName}] Joint: ${unit.name}`);
        console.log(`[${stageName}]   - Type: ${jointFit.type}`);
        console.log(`[${stageName}]   - Magnitude: ${jointFit.magnitude.toFixed(4)} ${jointFit.type === 'hinge' ? 'rad' : 'm'}`);
        console.log(`[${stageName}]   - Axis: (${jointFit.axis.x.toFixed(3)}, ${jointFit.axis.y.toFixed(3)}, ${jointFit.axis.z.toFixed(3)})`);
        console.log(`[${stageName}]   - Confidence: ${jointFit.confidence.toFixed(3)}`);
        console.log(`[${stageName}]   - ICP Error: ${icpResult.rmsError.toFixed(4)}m`);
        console.log(`[${stageName}]   - ICP Iterations: ${icpResult.iterations}`);

        if (jointFit.type === 'prismatic') prismaticCount++;
        if (jointFit.type === 'hinge') hingeCount++;

        if (jointFit.confidence < 0.5) {
          warnings.push(`Unit ${unit.name}: Low confidence (${jointFit.confidence.toFixed(3)})`);
          lowConfidenceCount++;
        }

        if (icpResult.rmsError > 0.01) {
          warnings.push(`Unit ${unit.name}: High ICP error (${icpResult.rmsError.toFixed(4)}m)`);
          highErrorCount++;
        }
      }

      if (icpResults.size === 0) {
        errors.push('No joints fitted - ICP may have failed');
      }

      const success = errors.length === 0 && icpResults.size > 0;

      this.report.stages.push({
        stage: stageName,
        success,
        duration: performance.now() - stageStart,
        message: `Fitted ${icpResults.size} joints (${prismaticCount} prismatic, ${hingeCount} hinge)`,
        data: {
          totalJoints: icpResults.size,
          prismaticCount,
          hingeCount,
          lowConfidenceCount,
          highErrorCount,
          joints: Array.from(icpResults.values()).map(r => ({
            unitName: r.unit.name,
            type: r.jointFit.type,
            magnitude: r.jointFit.magnitude,
            confidence: r.jointFit.confidence,
            rmsError: r.icpResult.rmsError,
            iterations: r.icpResult.iterations,
          })),
        },
        errors,
        warnings,
      });

      if (!success) {
        throw new Error('Joint fitting failed');
      }
    } catch (error) {
      errors.push(String(error));
      this.report.stages.push({
        stage: stageName,
        success: false,
        duration: performance.now() - stageStart,
        message: `Joint fitting failed: ${error}`,
        errors,
        warnings,
      });
      throw error;
    }
  }

  /**
   * Stage 7: Export kinematic model JSON.
   */
  private async testStage7_ExportJSON(): Promise<void> {
    const stageName = 'Stage 7: Export JSON';
    const stageStart = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(`\n[${stageName}] Starting...`);

    try {
      if (!this.pipeline) {
        throw new Error('Pipeline not initialized');
      }

      const model = this.pipeline.exportToJSON();

      console.log(`[${stageName}] ✓ JSON exported`);
      console.log(`[${stageName}]   - Joints: ${model.joints.length}`);
      console.log(`[${stageName}]   - Actuator channels: ${model.actuatorProgram.channels.length}`);

      // Log each joint
      for (const joint of model.joints) {
        console.log(`[${stageName}] Joint: ${joint.id}`);
        console.log(`[${stageName}]   - Type: ${joint.type}`);
        console.log(`[${stageName}]   - Parent: ${joint.parentId}`);
        console.log(`[${stageName}]   - Child: ${joint.childId}`);
        console.log(`[${stageName}]   - Limits: [${joint.limits.lower.toFixed(4)}, ${joint.limits.upper.toFixed(4)}]`);
      }

      // Pretty print JSON
      const jsonString = JSON.stringify(model, null, 2);
      console.log(`\n[${stageName}] ===== EXPORTED JSON =====`);
      console.log(jsonString);
      console.log(`[${stageName}] ===== END JSON =====\n`);

      if (model.joints.length === 0) {
        errors.push('No joints in exported model');
      }

      const success = errors.length === 0;

      this.report.stages.push({
        stage: stageName,
        success,
        duration: performance.now() - stageStart,
        message: `Exported model with ${model.joints.length} joints`,
        data: {
          jointCount: model.joints.length,
          channelCount: model.actuatorProgram.channels.length,
          model,
        },
        errors,
        warnings,
      });

      if (!success) {
        throw new Error('JSON export failed');
      }
    } catch (error) {
      errors.push(String(error));
      this.report.stages.push({
        stage: stageName,
        success: false,
        duration: performance.now() - stageStart,
        message: `Export failed: ${error}`,
        errors,
        warnings,
      });
      throw error;
    }
  }

  /**
   * Stage 8: Validate output JSON structure.
   */
  private async testStage8_ValidateOutput(): Promise<void> {
    const stageName = 'Stage 8: Validate Output';
    const stageStart = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(`\n[${stageName}] Starting...`);

    try {
      const exportStage = this.report.stages.find(s => s.stage.includes('Export JSON'));
      if (!exportStage || !exportStage.data?.model) {
        throw new Error('No exported model found');
      }

      const model = exportStage.data.model as KinematicModelExport;

      console.log(`[${stageName}] Validating model structure...`);

      // Validate joints array
      if (!Array.isArray(model.joints)) {
        errors.push('model.joints is not an array');
      }

      // Validate each joint
      for (const joint of model.joints) {
        const jointErrors: string[] = [];

        if (!joint.id) jointErrors.push('Missing id');
        if (!joint.type || !['hinge', 'prismatic'].includes(joint.type)) {
          jointErrors.push(`Invalid type: ${joint.type}`);
        }
        if (!joint.parentId) jointErrors.push('Missing parentId');
        if (!joint.childId) jointErrors.push('Missing childId');
        if (!joint.axisWorld) jointErrors.push('Missing axisWorld');
        if (!joint.anchorWorld) jointErrors.push('Missing anchorWorld');
        if (!joint.limits) jointErrors.push('Missing limits');

        if (jointErrors.length > 0) {
          errors.push(`Joint ${joint.id}: ${jointErrors.join(', ')}`);
        } else {
          console.log(`[${stageName}]   ✓ Joint ${joint.id} valid`);
        }
      }

      // Validate actuator program
      if (!model.actuatorProgram) {
        errors.push('Missing actuatorProgram');
      } else {
        if (!Array.isArray(model.actuatorProgram.channels)) {
          errors.push('actuatorProgram.channels is not an array');
        }

        console.log(`[${stageName}]   ✓ Actuator program valid`);
      }

      const success = errors.length === 0;

      this.report.stages.push({
        stage: stageName,
        success,
        duration: performance.now() - stageStart,
        message: success ? 'Model validation passed' : `Validation failed with ${errors.length} errors`,
        data: {
          jointsValidated: model.joints.length,
          channelsValidated: model.actuatorProgram.channels.length,
        },
        errors,
        warnings,
      });

      if (!success) {
        throw new Error('Output validation failed');
      }
    } catch (error) {
      errors.push(String(error));
      this.report.stages.push({
        stage: stageName,
        success: false,
        duration: performance.now() - stageStart,
        message: `Validation failed: ${error}`,
        errors,
        warnings,
      });
      throw error;
    }
  }

  /**
   * Print formatted test report.
   */
  private printReport(): void {
    console.log('\n');
    console.log('='.repeat(80));
    console.log('TEST REPORT');
    console.log('='.repeat(80));
    console.log(`Test: ${this.report.testName}`);
    console.log(`File: ${this.report.filePath}`);
    console.log(`Timestamp: ${this.report.timestamp}`);
    console.log(`Duration: ${this.report.totalDuration.toFixed(2)}ms`);
    console.log(`Overall: ${this.report.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log('='.repeat(80));

    // Stage summary
    console.log('\nSTAGE SUMMARY:');
    console.log('-'.repeat(80));

    for (const stage of this.report.stages) {
      const status = stage.success ? '✅ PASS' : '❌ FAIL';
      const duration = stage.duration.toFixed(2).padStart(8);
      console.log(`${status}  ${duration}ms  ${stage.stage}`);
      console.log(`    ${stage.message}`);

      if (stage.warnings.length > 0) {
        console.log(`    ⚠ Warnings: ${stage.warnings.length}`);
        for (const warning of stage.warnings) {
          console.log(`      - ${warning}`);
        }
      }

      if (stage.errors.length > 0) {
        console.log(`    ❌ Errors: ${stage.errors.length}`);
        for (const error of stage.errors) {
          console.log(`      - ${error}`);
        }
      }
    }

    // Calculate summary
    this.report.summary.stagesPassed = this.report.stages.filter(s => s.success).length;
    this.report.summary.stagesFailed = this.report.stages.filter(s => !s.success).length;
    this.report.summary.totalErrors = this.report.stages.reduce((sum, s) => sum + s.errors.length, 0);
    this.report.summary.totalWarnings = this.report.stages.reduce((sum, s) => sum + s.warnings.length, 0);

    console.log('\n');
    console.log('SUMMARY:');
    console.log('-'.repeat(80));
    console.log(`Stages Passed:  ${this.report.summary.stagesPassed}`);
    console.log(`Stages Failed:  ${this.report.summary.stagesFailed}`);
    console.log(`Total Errors:   ${this.report.summary.totalErrors}`);
    console.log(`Total Warnings: ${this.report.summary.totalWarnings}`);
    console.log('='.repeat(80));
    console.log('\n');
  }

  /**
   * Export report to JSON file.
   */
  exportReportToFile(filePath: string): void {
    const json = JSON.stringify(this.report, null, 2);
    // In browser environment, trigger download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * Run the complete test (one-click entry point).
 */
export async function runAutoKinematicsFullTest(): Promise<TestReport> {
  const test = new AutoKinematicsFullPipelineTest();
  const report = await test.runFullTest();

  // Export report to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  test.exportReportToFile(`auto_kinematics_test_report_${timestamp}.json`);

  return report;
}
