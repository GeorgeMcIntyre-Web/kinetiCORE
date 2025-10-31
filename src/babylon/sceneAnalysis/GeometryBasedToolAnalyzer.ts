/**
 * Geometry-Based Tool Analyzer
 * Owner: George
 *
 * Finds retracted/extended pairs using ICP geometry matching instead of name-based detection.
 * This is robust to naming changes and structure variations.
 *
 * Algorithm:
 * 1. Collect all TransformNodes under selected root
 * 2. Sample point clouds from each node
 * 3. Run ICP between all pairs to find matches (low error = same geometry)
 * 4. Validate transform is pure translation OR rotation (not scale/shear)
 * 5. Create ToolUnit pairs from matches
 *
 * This replaces brittle string matching with geometry-based matching.
 */

import * as BABYLON from '@babylonjs/core';
import { WorldSpace } from '../utils/WorldSpace';
import { PCLICPSolver } from '../pointCloud/PCLICPSolver';
import type { ToolUnit, ToolGraph } from './ToolGraphAnalyzer';

export interface GeometryBasedAnalyzeOptions {
  /** Minimum ICP error threshold to consider geometry match (meters) */
  maxICPError?: number;

  /** Minimum point count for a node to be considered */
  minPoints?: number;

  /** Maximum points to sample per node (for performance) */
  maxSamplePoints?: number;

  /** Vertex sampling stride */
  sampleStride?: number;

  /** Minimum translation distance to consider as motion (meters) */
  minTranslation?: number;

  /** Minimum rotation angle to consider as motion (degrees) */
  minRotation?: number;

  /** Maximum translation for automotive tooling (meters) */
  maxTranslation?: number;

  /** Enable detailed logging */
  verbose?: boolean;
}

const DEFAULT_OPTIONS: Required<GeometryBasedAnalyzeOptions> = {
  maxICPError: 0.15, // 150mm - more lenient for automotive tooling (was 10mm)
  minPoints: 50,
  maxSamplePoints: 500,
  sampleStride: 10,
  minTranslation: 0.01, // 10mm minimum motion
  minRotation: 1.0, // 1° minimum rotation
  maxTranslation: 2.0, // 2m maximum for automotive
  verbose: true,
};

interface NodeCandidate {
  node: BABYLON.TransformNode;
  nodeId: string;
  pointCloud: BABYLON.Vector3[];
  centroid: BABYLON.Vector3;
}

/**
 * UUID generator for tool units
 */
function uuid(): string {
  return 'tool_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
}

/**
 * Extract rotation angle from transformation matrix (degrees)
 */
function extractRotationAngle(transform: BABYLON.Matrix): number {
  const rotation = new BABYLON.Quaternion();
  transform.decompose(new BABYLON.Vector3(), rotation, new BABYLON.Vector3());

  // Convert quaternion to angle
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, rotation.w)));
  return (angle * 180) / Math.PI;
}

/**
 * Extract translation magnitude from transformation matrix (meters)
 */
function extractTranslationMagnitude(transform: BABYLON.Matrix): number {
  const translation = new BABYLON.Vector3();
  transform.decompose(new BABYLON.Vector3(), new BABYLON.Quaternion(), translation);
  return translation.length();
}

/**
 * Check if transformation is primarily translation (not rotation)
 */
function isPureTranslation(transform: BABYLON.Matrix, opts: Required<GeometryBasedAnalyzeOptions>): boolean {
  const rotationAngle = extractRotationAngle(transform);
  const translationMag = extractTranslationMagnitude(transform);

  return translationMag >= opts.minTranslation && rotationAngle < opts.minRotation;
}

/**
 * Check if transformation is primarily rotation (not translation)
 */
function isPureRotation(transform: BABYLON.Matrix, opts: Required<GeometryBasedAnalyzeOptions>): boolean {
  const rotationAngle = extractRotationAngle(transform);
  const translationMag = extractTranslationMagnitude(transform);

  return rotationAngle >= opts.minRotation && translationMag < opts.minTranslation;
}

export class GeometryBasedToolAnalyzer {
  /**
   * Analyze scene using ICP-based geometry matching
   *
   * @param _scene - Babylon scene (unused, kept for API consistency)
   * @param rootNode - Root TransformNode to analyze
   * @param options - Analysis options
   * @returns ToolGraph with identified units
   */
  async analyze(
    _scene: BABYLON.Scene,
    rootNode: BABYLON.Node,
    options?: GeometryBasedAnalyzeOptions
  ): Promise<ToolGraph> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (opts.verbose) {
      console.log('[GeometryAnalyzer] Starting ICP-based geometry analysis...');
      console.log(`[GeometryAnalyzer] Root node: ${rootNode.name}`);
    }

    // Step 1: Collect all TransformNodes and sample their point clouds
    const candidates = this.collectNodeCandidates(rootNode, opts);

    if (opts.verbose) {
      console.log(`[GeometryAnalyzer] Collected ${candidates.length} node candidates`);
    }

    if (candidates.length < 2) {
      console.warn('[GeometryAnalyzer] Need at least 2 nodes to find pairs');
      return { units: [], anchors: {} };
    }

    // Step 2: Find matching geometry pairs using ICP
    const pairs = await this.findGeometryMatchingPairs(candidates, opts);

    if (opts.verbose) {
      console.log(`[GeometryAnalyzer] ===== ICP MATCHING RESULTS =====`);
      console.log(`[GeometryAnalyzer] Total candidate nodes: ${candidates.length}`);
      console.log(`[GeometryAnalyzer] Total pairs tested: ${(candidates.length * (candidates.length - 1)) / 2}`);
      console.log(`[GeometryAnalyzer] Matching pairs found: ${pairs.length}`);
      console.log(`[GeometryAnalyzer] ================================`);
    }

    // Step 3: Create ToolUnits from pairs
    const units = this.createToolUnits(pairs, opts);

    if (opts.verbose) {
      console.log(`[GeometryAnalyzer] Created ${units.length} tool units`);
    }

    // Step 4: Create anchors (world-space position/rotation for each unit root)
    const anchors: Record<string, { position: BABYLON.Vector3; rotation: BABYLON.Quaternion }> = {};
    for (const unit of units) {
      const nodeId = unit.root;
      const candidate = candidates.find(c => c.nodeId === nodeId);
      if (candidate) {
        const worldMatrix = candidate.node.getWorldMatrix();
        const position = new BABYLON.Vector3();
        const rotation = new BABYLON.Quaternion();
        const scale = new BABYLON.Vector3();
        worldMatrix.decompose(scale, rotation, position);

        anchors[unit.id] = { position, rotation };
      }
    }

    return { units, anchors };
  }

  /**
   * Collect all TransformNodes under root and sample their point clouds
   */
  private collectNodeCandidates(
    rootNode: BABYLON.Node,
    opts: Required<GeometryBasedAnalyzeOptions>
  ): NodeCandidate[] {
    const candidates: NodeCandidate[] = [];
    const nodes = this.getAllTransformNodes(rootNode);

    for (const node of nodes) {
      // Sample point cloud from all child meshes IN LOCAL SPACE
      // CRITICAL: Use local space so FIXED and MOVING parts can be compared geometrically
      // even if they're positioned differently in the scene
      const pointCloud: BABYLON.Vector3[] = [];
      const meshes = (node as any).getChildMeshes?.() as BABYLON.AbstractMesh[] || [];

      for (const mesh of meshes) {
        const points = WorldSpace.sampleMeshLocalPoints(mesh, {
          stride: opts.sampleStride,
          maxPoints: opts.maxSamplePoints,
        });
        pointCloud.push(...points);
      }

      // Filter: must have minimum points
      if (pointCloud.length < opts.minPoints) {
        if (opts.verbose) {
          console.log(`[GeometryAnalyzer] Skipping ${node.name}: only ${pointCloud.length} points`);
        }
        continue;
      }

      // Compute centroid
      const centroid = pointCloud
        .reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero())
        .scale(1 / pointCloud.length);

      candidates.push({
        node: node as BABYLON.TransformNode,
        nodeId: String(node.uniqueId),
        pointCloud,
        centroid,
      });

      if (opts.verbose) {
        console.log(`[GeometryAnalyzer] Candidate: ${node.name} (${pointCloud.length} points)`);
      }
    }

    return candidates;
  }

  /**
   * Find pairs of nodes with matching geometry using ICP
   */
  private async findGeometryMatchingPairs(
    candidates: NodeCandidate[],
    opts: Required<GeometryBasedAnalyzeOptions>
  ): Promise<Array<{ fixed: NodeCandidate; moving: NodeCandidate; transform: BABYLON.Matrix; error: number }>> {
    const pairs: Array<{ fixed: NodeCandidate; moving: NodeCandidate; transform: BABYLON.Matrix; error: number }> = [];

    // Test all pairs (N^2 but typically small N for automotive tooling)
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const candA = candidates[i];
        const candB = candidates[j];

        if (opts.verbose) {
          console.log(`[GeometryAnalyzer] Testing pair: ${candA.node.name} ↔ ${candB.node.name}`);
        }

        // Run ICP to test if geometry matches
        const icpResult = await PCLICPSolver.align(candA.pointCloud, candB.pointCloud, {
          maxIterations: 100,
          errorTolerance: 1e-6,
          enableDebug: false,
        });

        if (opts.verbose) {
          console.log(`  - ICP error: ${(icpResult.error * 1000).toFixed(2)}mm`);
        }

        // Check if geometry matches (low ICP error)
        if (icpResult.error > opts.maxICPError) {
          if (opts.verbose) {
            console.log(`  - ❌ Rejected: error too high (${(icpResult.error * 1000).toFixed(2)}mm > ${(opts.maxICPError * 1000).toFixed(2)}mm)`);
          }
          continue;
        }

        // Check if transform is valid motion (translation or rotation)
        const isPrismatic = isPureTranslation(icpResult.transform, opts);
        const isRevolute = isPureRotation(icpResult.transform, opts);

        if (!isPrismatic && !isRevolute) {
          if (opts.verbose) {
            const transMag = extractTranslationMagnitude(icpResult.transform);
            const rotAngle = extractRotationAngle(icpResult.transform);
            console.log(`  - ❌ Rejected: neither pure translation nor rotation (trans: ${(transMag * 1000).toFixed(2)}mm, rot: ${rotAngle.toFixed(2)}°)`);
          }
          continue;
        }

        // Check translation is within bounds
        const translationMag = extractTranslationMagnitude(icpResult.transform);
        if (translationMag > opts.maxTranslation) {
          if (opts.verbose) {
            console.log(`  - ❌ Rejected: translation too large (${(translationMag * 1000).toFixed(2)}mm > ${(opts.maxTranslation * 1000).toFixed(2)}mm)`);
          }
          continue;
        }

        if (opts.verbose) {
          const jointType = isPrismatic ? 'PRISMATIC' : 'REVOLUTE';
          console.log(`  - ✅ MATCH FOUND: ${jointType} joint (error: ${(icpResult.error * 1000).toFixed(2)}mm)`);
        }

        // Determine which is fixed/moving based on naming
        // Priority: 1) Check for "FIXED" or "MOVING" in name, 2) Fall back to alphabetical
        let fixed: NodeCandidate, moving: NodeCandidate;

        const aHasFixed = candA.node.name.toUpperCase().includes('FIXED');
        const bHasFixed = candB.node.name.toUpperCase().includes('FIXED');
        const aHasMoving = candA.node.name.toUpperCase().includes('MOVING');
        const bHasMoving = candB.node.name.toUpperCase().includes('MOVING');

        if (aHasFixed && bHasMoving) {
          fixed = candA;
          moving = candB;
        } else if (bHasFixed && aHasMoving) {
          fixed = candB;
          moving = candA;
        } else {
          // Fallback to alphabetical order
          fixed = candA.node.name < candB.node.name ? candA : candB;
          moving = candA.node.name < candB.node.name ? candB : candA;

          if (opts.verbose) {
            console.log(`  - ⚠️  No FIXED/MOVING in names, using alphabetical heuristic`);
          }
        }

        pairs.push({
          fixed,
          moving,
          transform: icpResult.transform,
          error: icpResult.error,
        });
      }
    }

    return pairs;
  }

  /**
   * Create ToolUnits from matched pairs
   */
  private createToolUnits(
    pairs: Array<{ fixed: NodeCandidate; moving: NodeCandidate; transform: BABYLON.Matrix; error: number }>,
    opts: Required<GeometryBasedAnalyzeOptions>
  ): ToolUnit[] {
    const units: ToolUnit[] = [];

    for (const pair of pairs) {
      // Determine joint type from transform
      const isPrismatic = isPureTranslation(pair.transform, opts);
      const jointType = isPrismatic ? 'prismatic' : 'revolute';

      // Create FIXED unit
      const fixedUnit: ToolUnit = {
        id: uuid(),
        name: `${pair.fixed.node.name}_FIXED`,
        type: jointType as any,
        isFixed: true,
        root: pair.fixed.nodeId,
        nodes: [pair.fixed.nodeId],
      };

      // Create MOVING unit
      const movingUnit: ToolUnit = {
        id: uuid(),
        name: `${pair.moving.node.name}_MOVING`,
        type: jointType as any,
        isFixed: false,
        root: pair.moving.nodeId,
        nodes: [pair.moving.nodeId],
      };

      units.push(fixedUnit, movingUnit);

      if (opts.verbose) {
        console.log(`[GeometryAnalyzer] Created unit pair:`);
        console.log(`  - FIXED: ${fixedUnit.name} (${pair.fixed.node.name})`);
        console.log(`  - MOVING: ${movingUnit.name} (${pair.moving.node.name})`);
        console.log(`  - Joint type: ${jointType}`);
        console.log(`  - ICP error: ${(pair.error * 1000).toFixed(2)}mm`);
      }
    }

    return units;
  }

  /**
   * Get all TransformNodes recursively under a root node
   */
  private getAllTransformNodes(root: BABYLON.Node): BABYLON.TransformNode[] {
    const nodes: BABYLON.TransformNode[] = [];
    const stack: BABYLON.Node[] = [root];

    while (stack.length > 0) {
      const node = stack.pop()!;

      if (node instanceof BABYLON.TransformNode) {
        nodes.push(node);
      }

      const children = (node as any).getChildren?.() as BABYLON.Node[] || [];
      stack.push(...children);
    }

    return nodes;
  }
}
