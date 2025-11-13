/**
 * Test script for GLBStructureAnalyzer
 *
 * Usage in browser console:
 * ```typescript
 * import { testGLBAnalyzer } from './src/dev/testGLBAnalyzer';
 * await testGLBAnalyzer();
 * ```
 */

import * as BABYLON from '@babylonjs/core';
import { GLBStructureAnalyzer } from './GLBStructureAnalyzer';

/**
 * Run GLB analysis on current scene
 */
export async function testGLBAnalyzer(
  scene?: BABYLON.Scene,
  glbPath: string = '/9X_110_GEO.glb'
): Promise<void> {
  console.log('[TestGLBAnalyzer] Starting...');

  // Create scene if not provided
  if (!scene) {
    const canvas = document.createElement('canvas');
    const engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);

    // Add camera and light
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      0,
      0,
      10,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.setPosition(new BABYLON.Vector3(5, 5, 5));

    new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  }

  // Load GLB file
  console.log(`[TestGLBAnalyzer] Loading GLB: ${glbPath}`);
  const result = await BABYLON.SceneLoader.ImportMeshAsync('', '/', glbPath, scene);

  console.log(`[TestGLBAnalyzer] Loaded ${result.meshes.length} meshes`);

  // Find root node
  let rootNode: BABYLON.TransformNode | null = null;

  // Try to find a node with the GLB name
  const glbName = glbPath.replace(/^.*\//, '').replace('.glb', '');
  for (const node of result.transformNodes) {
    if (node.name.includes(glbName) || node.name === '__root__') {
      rootNode = node;
      break;
    }
  }

  if (!rootNode && result.transformNodes.length > 0) {
    rootNode = result.transformNodes[0];
  }

  if (!rootNode) {
    throw new Error('No root transform node found');
  }

  console.log(`[TestGLBAnalyzer] Root node: ${rootNode.name}`);

  // Create analyzer
  const analyzer = new GLBStructureAnalyzer(scene);

  // Run analysis
  console.log('[TestGLBAnalyzer] Running analysis...');
  const report = await analyzer.analyzeGLB(rootNode, glbPath);

  // Log summary
  console.log('\n========================================');
  console.log('GLB ANALYSIS REPORT');
  console.log('========================================');
  console.log(`File: ${report.metadata.fileName}`);
  console.log(`Total Nodes: ${report.metadata.totalNodes}`);
  console.log(`Total Meshes: ${report.metadata.totalMeshes}`);
  console.log(
    `Bounding Box: ${report.metadata.boundingBox.size.map(v => (v * 1000).toFixed(0)).join(' x ')} mm`
  );
  console.log('');

  console.log('RECOMMENDATIONS:');
  for (const rec of report.recommendations) {
    console.log(`  ${rec}`);
  }
  console.log('');

  console.log(`POTENTIAL PAIRS: ${report.potentialPairs.length} found`);
  for (const pair of report.potentialPairs.slice(0, 5)) {
    console.log(`  ${pair.node1.name} ↔ ${pair.node2.name}`);
    console.log(`    Confidence: ${(pair.confidence * 100).toFixed(0)}%, Type: ${pair.matchType}`);
  }
  console.log('');

  console.log(`NAMING PATTERNS: ${report.namingPatterns.patterns.length} detected`);
  for (const pattern of report.namingPatterns.patterns) {
    console.log(`  ${pattern.pattern}: ${pattern.matches.length} matches`);
  }
  console.log('');

  console.log('========================================\n');

  // Export JSON
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonFileName = `glb_analysis_${timestamp}.json`;
  analyzer.exportToFile(report, jsonFileName);
  console.log(`[TestGLBAnalyzer] Exported JSON: ${jsonFileName}`);

  // Export Markdown
  const markdown = analyzer.exportToMarkdown(report);
  const mdBlob = new Blob([markdown], { type: 'text/markdown' });
  const mdUrl = URL.createObjectURL(mdBlob);
  const mdLink = document.createElement('a');
  mdLink.href = mdUrl;
  mdLink.download = `glb_analysis_${timestamp}.md`;
  mdLink.click();
  URL.revokeObjectURL(mdUrl);
  console.log(`[TestGLBAnalyzer] Exported Markdown: glb_analysis_${timestamp}.md`);

  // Log full report to console
  console.log('[TestGLBAnalyzer] Full report:');
  console.log(JSON.stringify(report, null, 2));

  console.log('[TestGLBAnalyzer] Done!');
}

/**
 * Analyze a specific node (not the whole GLB)
 */
export async function analyzeNode(
  scene: BABYLON.Scene,
  nodeName: string
): Promise<void> {
  const node = scene.getTransformNodeByName(nodeName);
  if (!node) {
    throw new Error(`Node not found: ${nodeName}`);
  }

  const analyzer = new GLBStructureAnalyzer(scene);
  const report = await analyzer.analyzeGLB(node, `[Node: ${nodeName}]`);

  console.log(JSON.stringify(report, null, 2));
  analyzer.exportToFile(report, `node_analysis_${nodeName}.json`);
}

/**
 * Compare two nodes geometrically
 */
export async function compareNodes(
  scene: BABYLON.Scene,
  nodeName1: string,
  nodeName2: string
): Promise<void> {
  const analyzer = new GLBStructureAnalyzer(scene);

  const node1 = scene.getTransformNodeByName(nodeName1);
  const node2 = scene.getTransformNodeByName(nodeName2);

  if (!node1 || !node2) {
    throw new Error('One or both nodes not found');
  }

  // Create temporary root to hold both nodes
  const tempRoot = new BABYLON.TransformNode('__temp_root__', scene);
  node1.parent = tempRoot;
  node2.parent = tempRoot;

  const report = await analyzer.analyzeGLB(tempRoot, `[Compare: ${nodeName1} vs ${nodeName2}]`);

  // Restore original parents
  node1.parent = null;
  node2.parent = null;
  tempRoot.dispose();

  // Find the pair analysis
  const pair = report.potentialPairs.find(
    p =>
      (p.node1.name === nodeName1 && p.node2.name === nodeName2) ||
      (p.node1.name === nodeName2 && p.node2.name === nodeName1)
  );

  if (pair) {
    console.log(`\n========================================`);
    console.log(`COMPARISON: ${nodeName1} vs ${nodeName2}`);
    console.log(`========================================`);
    console.log(`Similarity: ${(pair.similarity * 100).toFixed(1)}%`);
    console.log(`Confidence: ${(pair.confidence * 100).toFixed(0)}%`);
    console.log(`Match Type: ${pair.matchType}`);
    console.log(`\nReasons:`);
    for (const reason of pair.reasons) {
      console.log(`  - ${reason}`);
    }
    console.log(`========================================\n`);
  } else {
    console.log(`No match found between ${nodeName1} and ${nodeName2}`);
  }
}
