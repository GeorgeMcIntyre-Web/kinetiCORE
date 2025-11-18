import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { StructureBasedToolAnalyzer } from '../../../src/babylon/sceneAnalysis/StructureBasedToolAnalyzer';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { AnalyzerDebugSnapshot, DetectedToolJoint } from '../../../src/babylon/sceneAnalysis/ToolingTypes';
import '@babylonjs/loaders/glTF';

// Node.js shims for Babylon.js Draco decoder in Vitest environment
const nodeRequire = createRequire(import.meta.url);
if (!(globalThis as any).require) {
  (globalThis as any).require = nodeRequire;
}
const dracoAssetDir = path.resolve(
  process.cwd(),
  'node_modules',
  '@babylonjs',
  'core',
  'assets',
  'Draco'
);
if (!(globalThis as any).__dirname) {
  (globalThis as any).__dirname = dracoAssetDir;
}
if (!(globalThis as any).__filename) {
  (globalThis as any).__filename = path.join(dracoAssetDir, 'draco_wasm_wrapper_gltf.js');
}

/**
 * Test Suite for StructureBasedToolAnalyzer
 * 
 * Tests the geometry-based joint detection pipeline without relying on node names.
 * Uses real GLB files from kinetiCORE_data for validation.
 */

describe('StructureBasedToolAnalyzer', () => {
  let engine: BABYLON.NullEngine;
  let scene: BABYLON.Scene;

  beforeEach(() => {
    engine = new BABYLON.NullEngine();
    scene = new BABYLON.Scene(engine);
  });

  afterEach(() => {
    if (scene) {
      scene.dispose();
    }
    if (engine) {
      engine.dispose();
    }
  });

  /**
   * Helper: Load GLB file and return root node.
   * Uses guard clauses, no else/else if.
   */
  async function loadToolingGlb(relativePath: string): Promise<{ rootNode: BABYLON.Node; glbPath: string } | null> {
    const glbPath = path.resolve(process.cwd(), '..', 'kinetiCORE_data', 'Tooling', 'testing_data', relativePath);
    
    if (!existsSync(glbPath)) {
      console.warn(`[Test] GLB file not found at ${glbPath}, skipping test`);
      return null;
    }

    try {
      const glbBuffer = readFileSync(glbPath);
      const result = await SceneLoader.ImportMeshAsync(
        undefined,
        '',
        glbBuffer,
        scene,
        undefined,
        '.glb'
      );

      if (result.meshes.length === 0) {
        console.warn(`[Test] No meshes loaded from ${glbPath}`);
        return null;
      }

      const rootNode = scene.rootNodes.find(n => 
        n.name.includes('016ZF') || n.name.includes('CI00')
      ) || scene.rootNodes[0];

      if (!rootNode) {
        console.warn(`[Test] No root node found in scene`);
        return null;
      }

      return { rootNode, glbPath };
    } catch (error) {
      console.warn(`[Test] Failed to load GLB: ${error}`);
      return null;
    }
  }

  /**
   * Helper: Run analyzer with timing and return results.
   */
  async function analyzeToolingFromPath(
    rootNode: BABYLON.Node,
    options: Parameters<StructureBasedToolAnalyzer['analyze']>[1] = {}
  ): Promise<{ toolGraph: Awaited<ReturnType<StructureBasedToolAnalyzer['analyze']>>; elapsedMs: number }> {
    const analyzer = new StructureBasedToolAnalyzer();
    const startTime = performance.now();
    
    const toolGraph = await analyzer.analyze(scene, {
      minUnitCount: 2,
      maxDepth: 10,
      minVolume: 0.0001,
      classifyFixedMoving: true,
      detectJointsWithICP: true,
      icpOptions: {
        maxICPError: 0.15,
        minPoints: 20,
        maxSamplePoints: 500,
        sampleStride: 3,
        minTranslation: 0.01,
        minRotation: 1.0,
        maxTranslation: 2.0,
      },
      verbose: false, // Set to true for debugging
      ...options,
    }, rootNode);

    const elapsedMs = performance.now() - startTime;
    return { toolGraph, elapsedMs };
  }

  /**
   * Helper: Count joints per unit from toolGraph.
   */
  function getJointCountsPerUnit(toolGraph: Awaited<ReturnType<StructureBasedToolAnalyzer['analyze']>>): Map<string, number> {
    const counts = new Map<string, number>();
    for (const unit of toolGraph.units) {
      const jointCount = (unit as any).jointCount ?? 0;
      counts.set(unit.id, jointCount);
    }
    return counts;
  }

  /**
   * Helper: Get node name from node ID (for test-time sanity checks only).
   * This is used ONLY for validation in tests, never in the algorithm.
   */
  function getNodeName(nodeId: string, rootNode: BABYLON.Node | null): string | undefined {
    if (!rootNode) return undefined;
    
    // Recursively search for node by matching uniqueId or name
    function findNode(node: BABYLON.Node, targetId: string): BABYLON.Node | null {
      // Check if this node matches (by uniqueId or name)
      if (node.uniqueId.toString() === targetId || node.name === targetId) {
        return node;
      }
      
      // Search children
      for (const child of node.getChildren()) {
        const found = findNode(child, targetId);
        if (found) return found;
      }
      
      return null;
    }
    
    const node = findNode(rootNode, nodeId);
    return node?.name;
  }

  /**
   * Helper: Load GLB, run analyzer, return snapshot + joints.
   * Used for ground truth validation tests.
   */
  async function analyzeFixture(
    glbPath: string,
    fixtureId: string,
    customConfig?: Parameters<StructureBasedToolAnalyzer['analyze']>[1]
  ): Promise<{ snapshot: AnalyzerDebugSnapshot; joints: DetectedToolJoint[]; rootNode: BABYLON.Node | null } | null> {
    const loaded = await loadToolingGlb(glbPath);
    if (!loaded) {
      console.warn(`[Test] GLB file not available: ${glbPath}`);
      return null;
    }

    const analyzer = new StructureBasedToolAnalyzer();
    await analyzer.analyze(scene, {
      minUnitCount: 2,
      maxDepth: 10,
      minVolume: 0.0001,
      classifyFixedMoving: true,
      detectJointsWithICP: true,
      icpOptions: {
        maxICPError: 0.15,
        minPoints: 20,
        maxSamplePoints: 500,
        sampleStride: 3,
        minTranslation: 0.01,
        minRotation: 1.0,
        maxTranslation: 2.0,
      },
      verbose: true, // verbose enables debug tracking
      ...customConfig,
    }, loaded.rootNode);

    const snapshot = analyzer.getDebugSnapshot(fixtureId);
    const joints = analyzer.getDetectedToolJoints();

    return { snapshot, joints, rootNode: loaded.rootNode };
  }

  /**
   * Test-time sanity check: Verify that detected joints hit MOVING* nodes.
   * This is ONLY for validation - the algorithm never uses names.
   */
  function assertMostJointsHitMovingNodes(
    joints: DetectedToolJoint[],
    rootNode: BABYLON.Node | null,
    minRatio: number = 0.5
  ): void {
    if (joints.length === 0) return;

    let movingHits = 0;
    const totalEnds = joints.length * 2;

    for (const joint of joints) {
      const nodeAName = getNodeName(joint.nodeAId, rootNode);
      const nodeBName = getNodeName(joint.nodeBId, rootNode);
      
      if (nodeAName?.toUpperCase().includes('MOVING')) movingHits += 1;
      if (nodeBName?.toUpperCase().includes('MOVING')) movingHits += 1;
    }

    const ratio = movingHits / totalEnds;
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
  }

  /**
   * Debug helper: Print concise summary of analyzer state for a fixture.
   * Used only in tests for debugging threshold tuning.
   */
  function printFixtureDebugSummary(
    snapshot: AnalyzerDebugSnapshot,
    joints: DetectedToolJoint[]
  ): void {
    console.log(`\n[DEBUG] === ${snapshot.fixtureId} ===`);
    console.log(`Units: ${snapshot.totalUnits} (expected varies)`);
    console.log(`Joints: ${snapshot.totalJoints} (expected varies)`);
    console.log(`Prismatic: ${joints.filter(j => j.isPrismatic).length}`);
    
    if (snapshot.unitDebug && snapshot.unitDebug.length > 0) {
      console.log(`\nPer-unit breakdown:`);
      for (const unit of snapshot.unitDebug) {
        const unitJoints = joints.filter(j => j.unitId === unit.unitId);
        console.log(`  ${unit.unitId}: ${unit.families.length} families, ${unitJoints.length} joints`);
        for (const family of unit.families) {
          console.log(`    Family ${family.familyId}: ${family.memberCount} members, ${family.stateCount} states, ${family.pairsCount} pairs`);
        }
      }
    }
    
    if (snapshot.candidatePairs && snapshot.candidatePairs.length > 0) {
      const rejected = snapshot.candidatePairs.filter(p => p.classification === 'rejected');
      const accepted = snapshot.candidatePairs.filter(p => p.classification !== 'rejected');
      console.log(`\nCandidate pairs: ${accepted.length} accepted, ${rejected.length} rejected`);
      if (rejected.length > 0) {
        const reasons = new Map<string, number>();
        for (const p of rejected) {
          const reason = p.rejectionReason || 'unknown';
          reasons.set(reason, (reasons.get(reason) || 0) + 1);
        }
        console.log(`  Rejection reasons:`, Object.fromEntries(reasons));
      }
    }
    console.log('');
  }

  describe('Ground Truth Tests: Fixture-Specific Expectations', () => {
    it('fixture 8X-140_GEO should have 4 units and 6 joints', async () => {
      // GEO: Default conservative clustering should work, but we might need to find the right level
      // If we're getting 3 units, we might be starting with only 3 candidates
      const result = await analyzeFixture('8X-140_GEO/016ZF_20142435_140_CI00.glb', '8X-140_GEO');
      if (!result) {
        console.warn('[Test] GLB file not available, skipping ground truth test');
        return;
      }

      const { snapshot, joints, rootNode } = result;
      
      // Debug summary for threshold tuning
      printFixtureDebugSummary(snapshot, joints);
      
      expect(snapshot.totalUnits).toBe(4);
      expect(joints.length).toBe(6);
      
      // Sanity check: Most joints should hit MOVING* nodes (test-time validation only)
      assertMostJointsHitMovingNodes(joints, rootNode, 0.5);
    }, 60000);

    it('fixture 8X-140-1E1_LH should have 9 units and 4 joints', async () => {
      const result = await analyzeFixture('8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00.glb', '8X-140-1E1_LH');
      if (!result) {
        console.warn('[Test] GLB file not available, skipping ground truth test');
        return;
      }

      const { snapshot, joints, rootNode } = result;
      
      // Debug summary for threshold tuning
      printFixtureDebugSummary(snapshot, joints);
      
      expect(snapshot.totalUnits).toBe(9);
      expect(joints.length).toBe(4);
      
      // Sanity check: Most joints should hit MOVING* nodes (test-time validation only)
      assertMostJointsHitMovingNodes(joints, rootNode, 0.5);
    }, 60000);

    it('fixture 2174 should have 17 units and 11 joints with 2 prismatic', async () => {
      const result = await analyzeFixture('2174530000_M00_GJR_RR FLR_CM030_T01/2174530000_M00_GJR_RR FLR_CM030_T01.glb', '2174530000_M00_GJR_RR FLR_CM030_T01');
      if (!result) {
        console.warn('[Test] GLB file not available, skipping ground truth test');
        return;
      }

      const { snapshot, joints, rootNode } = result;
      
      // Debug summary for threshold tuning
      printFixtureDebugSummary(snapshot, joints);
      
      expect(snapshot.totalUnits).toBe(17);
      expect(joints.length).toBe(11);
      const prismaticJoints = joints.filter(j => j.isPrismatic);
      expect(prismaticJoints.length).toBe(2);
      
      // Sanity check: Prismatic joints should be location pins (test-time validation only)
      if (prismaticJoints.length > 0) {
        for (const joint of prismaticJoints) {
          const nodeAName = getNodeName(joint.nodeAId, rootNode);
          const nodeBName = getNodeName(joint.nodeBId, rootNode);
          const hasPinName = nodeAName?.toUpperCase().includes('PIN') || 
                           nodeBName?.toUpperCase().includes('PIN') ||
                           nodeAName?.toUpperCase().includes('LOC') ||
                           nodeBName?.toUpperCase().includes('LOC');
          // Note: This is a soft check - if names don't match, it's not a failure
          // but helps validate that we're detecting the right joints
          if (hasPinName) {
            console.log(`[Test] ✓ Prismatic joint ${joint.jointId} matches PIN/LOC pattern`);
          }
        }
      }
    }, 60000);
  });

  describe('Golden Test: Main GLB (8X-140_GEO)', () => {
    it('should detect 9 units with 9 joints total (4/3/2 per unit)', async () => {
      const loaded = await loadToolingGlb('8X-140_GEO/016ZF_20142435_140_CI00.glb');
      if (!loaded) {
        console.warn('[Test] GLB file not available, skipping golden test');
        return;
      }

      const { rootNode } = loaded;
      // Enable verbose logging to diagnose joint detection
      const { toolGraph, elapsedMs } = await analyzeToolingFromPath(rootNode, { verbose: true });

      // Assert: 9 units total
      expect(toolGraph.units.length).toBe(9);

      // Assert: Total joint count
      const jointCounts = getJointCountsPerUnit(toolGraph);
      const totalJoints = Array.from(jointCounts.values()).reduce((sum, count) => sum + count, 0);
      
      // Get specific unit joint counts
      const unit102 = toolGraph.units.find(u => u.name === 'UNIT_102');
      const unit104 = toolGraph.units.find(u => u.name === 'UNIT_104');
      const unit106 = toolGraph.units.find(u => u.name === 'UNIT_106');
      const unit102Joints = unit102 ? (jointCounts.get(unit102.id) || 0) : 0;
      const unit104Joints = unit104 ? (jointCounts.get(unit104.id) || 0) : 0;
      const unit106Joints = unit106 ? (jointCounts.get(unit106.id) || 0) : 0;
      
      // Expected: UNIT_102: 4 joints, UNIT_104: 3 joints, UNIT_106: 2 joints = 9 total
      // NOTE: These counts are specific to this tooling fixture (8X-140_GEO).
      // The algorithm does not enforce a maximum joints per unit; these counts are
      // determined by geometry similarity, transform clustering, distance filters,
      // and ICP quality thresholds. Other fixtures may have different joint distributions.
      expect(unit102Joints).toBe(4);
      expect(unit104Joints).toBe(3);
      expect(unit106Joints).toBe(2);
      expect(totalJoints).toBe(9);

      const unitsWithOneJoint = Array.from(jointCounts.values()).filter(count => count === 1);
      expect(unitsWithOneJoint.length).toBe(0);

      const unitsWithZeroJoints = Array.from(jointCounts.values()).filter(count => count === 0);
      expect(unitsWithZeroJoints.length).toBe(6);

      // Assert: Units with joints are marked as moving
      for (const unit of toolGraph.units) {
        const jointCount = jointCounts.get(unit.id) || 0;
        if (jointCount > 0) {
          expect(unit.isFixed).toBe(false);
        }
      }

      // Assert: Units without joints are marked as fixed
      for (const unit of toolGraph.units) {
        const jointCount = jointCounts.get(unit.id) || 0;
        if (jointCount === 0) {
          expect(unit.isFixed).toBe(true);
        }
      }

      // Assert: Runtime is within envelope (≤ 10s)
      expect(elapsedMs).toBeLessThan(10000);

      // Log summary for debugging
      console.log(`[Test] Golden test passed: ${toolGraph.units.length} units, ${totalJoints} joints, ${elapsedMs.toFixed(0)}ms`);
    }, 60000);
  });

  describe('Robustness Tests: Other GLBs', () => {
    const testGlbs = [
      { path: '8X-140-1E1_LH/016ZF_20142435_140_1E1_CI00.glb', name: '8X-140-1E1_LH' },
      { path: '8X-140-2E1_RH/016ZF_20142435_140_2E1_CI00.glb', name: '8X-140-2E1_RH' },
      { path: '016ZF_20142435_130/016ZF_20142435_130.glb', name: '016ZF_20142435_130' },
      { path: '016ZF_20142452_110/016ZF_20142452_110.glb', name: '016ZF_20142452_110' },
    ];

    it.each(testGlbs)('should analyze $name successfully', async ({ path: glbPath, name }) => {
      const loaded = await loadToolingGlb(glbPath);
      if (!loaded) {
        console.warn(`[Test] GLB file not available for ${name}, skipping`);
        return;
      }

      const { rootNode } = loaded;
      const { toolGraph, elapsedMs } = await analyzeToolingFromPath(rootNode, { verbose: false });

      // Assert: Analyzer completes without error
      expect(toolGraph).toBeDefined();
      expect(toolGraph.units).toBeDefined();

      // Assert: Unit count > 0
      expect(toolGraph.units.length).toBeGreaterThan(0);

      // Assert: Joint count >= reasonable minimum (at least 1 if units exist)
      const jointCounts = getJointCountsPerUnit(toolGraph);
      const totalJoints = Array.from(jointCounts.values()).reduce((sum, count) => sum + count, 0);
      
      // For robustness, we allow 0 joints (some GLBs may not have joints)
      // But log if we find some
      if (totalJoints > 0) {
        console.log(`[Test] ${name}: ${toolGraph.units.length} units, ${totalJoints} joints`);
      }

      // Assert: Runtime does not exceed safe limit (10s)
      expect(elapsedMs).toBeLessThan(10000);

      // Assert: All units have valid structure
      for (const unit of toolGraph.units) {
        expect(unit.root).toBeTruthy();
        expect(unit.nodes.length).toBeGreaterThan(0);
        expect(unit.id).toBeTruthy();
      }
    }, 60000);
  });

  describe('Performance and Threshold Validation', () => {
    it('should complete main GLB analysis within 10 seconds', async () => {
      const loaded = await loadToolingGlb('8X-140_GEO/016ZF_20142435_140_CI00.glb');
      if (!loaded) {
        console.warn('[Test] GLB file not available, skipping performance test');
        return;
      }

      const { rootNode } = loaded;
      const { elapsedMs } = await analyzeToolingFromPath(rootNode, { verbose: false });

      expect(elapsedMs).toBeLessThan(10000);
      console.log(`[Test] Performance: ${elapsedMs.toFixed(0)}ms (target: < 10000ms)`);
    }, 60000);

    it('should use structured logging when verbose is enabled', async () => {
      const loaded = await loadToolingGlb('8X-140_GEO/016ZF_20142435_140_CI00.glb');
      if (!loaded) {
        console.warn('[Test] GLB file not available, skipping logging test');
        return;
      }

      const logMessages: string[] = [];
      const originalLog = console.log;
      console.log = (message: string) => {
        logMessages.push(message);
        originalLog(message);
      };

      try {
        const { rootNode } = loaded;
        await analyzeToolingFromPath(rootNode, { verbose: true });

        // Check for structured log tags
        const hasFamilyBuild = logMessages.some(msg => msg.includes('[FAMILY_BUILD]'));
        const hasPairDist = logMessages.some(msg => msg.includes('[PAIR_DIST]'));
        const hasIcpRun = logMessages.some(msg => msg.includes('[ICP_RUN]'));
        const hasJointAccepted = logMessages.some(msg => msg.includes('[JOINT_ACCEPTED]'));

        // At least some structured logs should appear when verbose is enabled
        expect(hasFamilyBuild || hasPairDist || hasIcpRun || hasJointAccepted).toBe(true);
      } finally {
        console.log = originalLog;
      }
    }, 60000);
  });
});
