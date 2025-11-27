/**
 * Test for Hierarchical Tool Analyzer
 *
 * Loads 9X_110_GEO.glb and analyzes with the new hierarchical analyzer
 * Should detect 5 units with 7 joints total
 */

// DEPRECATED: This file is no longer used. HierarchicalToolAnalyzer has been replaced
// by the Statistical Pairing Engine in src/kinematics/statisticalPairing/
//
// import * as BABYLON from '@babylonjs/core';
// import '@babylonjs/loaders/glTF';
// import { HierarchicalToolAnalyzer } from '../babylon/sceneAnalysis/HierarchicalToolAnalyzer';

export {}; // Make this a module

/**
 * Test the hierarchical analyzer with a loaded GLB file
 */
export async function testHierarchicalAnalyzer(glbFilename: string = '9X_110_GEO.glb'): Promise<{
  success: boolean;
  unitsFound: number;
  jointsFound: number;
  report: string;
}> {
  console.log('================================================================================');
  console.log('HIERARCHICAL ANALYZER TEST');
  console.log('================================================================================');
  console.log(`File: ${glbFilename}`);
  console.log('Start Time:', new Date().toISOString());
  console.log('================================================================================\n');

  // Create a test scene
  console.log('[SETUP] Creating test scene...');
  const engine = new BABYLON.NullEngine();
  const scene = new BABYLON.Scene(engine);
  console.log('[SETUP] ✓ Scene created\n');

  // Load GLB
  console.log(`[LOAD] Loading ${glbFilename}...`);
  let rootNode: BABYLON.TransformNode | null = null;

  try {
    const result = await BABYLON.SceneLoader.ImportMeshAsync(
      '',
      '/', // Load from public folder
      glbFilename,
      scene
    );

    console.log(`[LOAD] ✓ Loaded successfully`);
    console.log(`[LOAD]   - Meshes: ${result.meshes.length}`);
    console.log(`[LOAD]   - Transform nodes: ${result.transformNodes.length}\n`);

    // Find root node
    for (const node of result.transformNodes) {
      if (node.name.includes('9X_110_GEO') || !node.parent) {
        rootNode = node;
        console.log(`[LOAD] ✓ Root node: ${node.name}\n`);
        break;
      }
    }

    if (!rootNode) {
      throw new Error('Root node not found');
    }
  } catch (error) {
    console.error('[LOAD] ✗ Failed to load GLB:', error);
    return {
      success: false,
      unitsFound: 0,
      jointsFound: 0,
      report: `Failed to load GLB: ${error}`
    };
  }

  // Run hierarchical analyzer
  console.log('[ANALYZE] Running hierarchical analyzer...\n');
  const analyzer = new HierarchicalToolAnalyzer();
  const graph = analyzer.analyze(scene, rootNode);

  console.log('[ANALYZE] ✓ Analysis complete\n');

  // Validation
  console.log('================================================================================');
  console.log('VALIDATION');
  console.log('================================================================================\n');

  // Determine expected values based on filename
  const isUnit112Only = glbFilename.includes('UNIT_112');
  const expectedUnits = isUnit112Only ? 1 : 5;
  const expectedJoints = isUnit112Only ? 2 : 7;

  const unitsMatch = graph.units.length === expectedUnits;
  const jointsMatch = graph.totalJoints === expectedJoints;

  console.log(`Units detected: ${graph.units.length} (expected: ${expectedUnits}) ${unitsMatch ? '✓' : '✗'}`);
  console.log(`Joints detected: ${graph.totalJoints} (expected: ${expectedJoints}) ${jointsMatch ? '✓' : '✗'}`);
  console.log('');

  // Detailed breakdown
  console.log('BREAKDOWN BY UNIT:');
  graph.units.forEach(unit => {
    console.log(`  ${unit.unitName}: ${unit.joints.length} joint(s)`);
    unit.joints.forEach(joint => {
      const type = joint.type === 0 ? 'Prismatic' : 'Revolute';
      console.log(`    - ${joint.name}: ${joint.electricalName} (${type})`);
      console.log(`      NodeId: ${joint.nodeId}`);
      console.log(`      UniqueId: ${joint.uniqueId}`);
    });
  });
  console.log('');

  const success = unitsMatch && jointsMatch;

  console.log('================================================================================');
  console.log('RESULT');
  console.log('================================================================================');
  console.log(success ? '✅ TEST PASSED' : '❌ TEST FAILED');
  console.log('================================================================================\n');

  // Generate report
  const report = [
    'HIERARCHICAL ANALYZER TEST REPORT',
    '='.repeat(80),
    `File: ${glbFilename}`,
    `Timestamp: ${new Date().toISOString()}`,
    ``,
    `RESULTS:`,
    `  Units: ${graph.units.length} (expected ${expectedUnits}) ${unitsMatch ? 'PASS' : 'FAIL'}`,
    `  Joints: ${graph.totalJoints} (expected ${expectedJoints}) ${jointsMatch ? 'PASS' : 'FAIL'}`,
    ``,
    `BREAKDOWN:`,
    ...graph.units.map(u => `  ${u.unitName}: ${u.joints.length} joint(s)`),
    ``,
    `OVERALL: ${success ? 'PASS' : 'FAIL'}`,
    '='.repeat(80)
  ].join('\n');

  // Cleanup
  scene.dispose();
  engine.dispose();

  return {
    success,
    unitsFound: graph.units.length,
    jointsFound: graph.totalJoints,
    report
  };
}

/**
 * Export to window for browser console
 */
if (typeof window !== 'undefined') {
  (window as any).testHierarchicalAnalyzer = testHierarchicalAnalyzer;
}
