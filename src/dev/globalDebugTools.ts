/**
 * Global Debug Tools
 *
 * Makes debugging tools available in browser console via window object.
 * Import this file in your main app to enable console debugging.
 *
 * Usage in browser console:
 * ```
 * // Analyze current scene
 * await window.analyzeGLB();
 *
 * // Compare two nodes
 * window.compareBBoxes('UNIT_118_FIXED', 'UNIT_118_MOVING');
 *
 * // Show all bounding boxes
 * window.showBBoxes('UNIT');
 * ```
 *
 * Owner: George (Agent 1 - Claude Code)
 */

import * as BABYLON from '@babylonjs/core';
import { GLBStructureAnalyzer } from './GLBStructureAnalyzer';
import { BoundingBoxDebugger } from './BoundingBoxDebugger';
import { UnitPairFinder } from './UnitPairFinder';
import { UnitPairFinderV2 } from './UnitPairFinder_v2';
import { Unit112Debugger } from './Unit112Debugger';
import { Unit112PairFinder } from './Unit112PairFinder';

interface DebugToolsAPI {
  // Scene reference
  scene: BABYLON.Scene | null;

  // GLB Analysis
  analyzeGLB: (fileName?: string) => Promise<void>;
  analyzeNode: (nodeName: string) => Promise<void>;

  // Unit Pair Finding (Auto-Kinematics)
  findUnitPairs: () => void;
  findUnitPairsV2: () => void; // NEW: Multi-joint support
  analyzeUnit: (unitName: string) => void;
  debugUnit112: () => void; // NEW: Deep debug UNIT_112
  findUnit112Pairs: () => void; // NEW: Geometry-based pair finding for UNIT_112

  // Bounding Box Debug
  showBBox: (nodeName: string, color?: string) => void;
  compareBBoxes: (node1: string, node2: string, threshold?: number) => void;
  showAllBBoxes: (pattern?: string) => void;
  findPairs: (threshold?: number) => void;
  clearBBoxes: () => void;

  // Utilities
  listNodes: (pattern?: string) => void;
  getNode: (nodeName: string) => BABYLON.TransformNode | null;
  help: () => void;
}

class DebugTools implements DebugToolsAPI {
  public scene: BABYLON.Scene | null = null;
  private bboxDebugger: BoundingBoxDebugger | null = null;
  private analyzer: GLBStructureAnalyzer | null = null;
  private unitPairFinder: UnitPairFinder | null = null;
  private unitPairFinderV2: UnitPairFinderV2 | null = null;

  constructor() {
    console.log('[DebugTools] Initialized. Type window.debugTools.help() for usage.');
  }

  /**
   * Set the active scene
   */
  setScene(scene: BABYLON.Scene): void {
    this.scene = scene;
    this.bboxDebugger = new BoundingBoxDebugger(scene);
    this.analyzer = new GLBStructureAnalyzer(scene);
    this.unitPairFinder = new UnitPairFinder(scene);
    this.unitPairFinderV2 = new UnitPairFinderV2(scene);
    console.log('[DebugTools] Scene set. Ready to use!');
  }

  /**
   * Analyze entire GLB structure
   */
  async analyzeGLB(fileName: string = 'current_scene.glb'): Promise<void> {
    if (!this.scene || !this.analyzer) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    // Find root node (first transform node or __root__)
    let rootNode: BABYLON.TransformNode | null = null;
    for (const node of this.scene.transformNodes) {
      if (node.name === '__root__' || node.parent === null) {
        rootNode = node;
        break;
      }
    }

    if (!rootNode && this.scene.transformNodes.length > 0) {
      rootNode = this.scene.transformNodes[0];
    }

    if (!rootNode) {
      console.error('[DebugTools] No root transform node found');
      return;
    }

    console.log(`[DebugTools] Analyzing GLB structure from root: ${rootNode.name}`);
    const report = await this.analyzer.analyzeGLB(rootNode, fileName);

    // Print summary
    console.log('\n========================================');
    console.log('GLB ANALYSIS COMPLETE');
    console.log('========================================');
    console.log(`Total Nodes: ${report.metadata.totalNodes}`);
    console.log(`Total Meshes: ${report.metadata.totalMeshes}`);
    console.log(`Potential Pairs: ${report.potentialPairs.length}`);
    console.log('');
    console.log('RECOMMENDATIONS:');
    for (const rec of report.recommendations) {
      console.log(`  ${rec}`);
    }
    console.log('');
    console.log('TOP PAIRS:');
    for (const pair of report.potentialPairs.slice(0, 5)) {
      console.log(`  ${pair.node1.name} ↔ ${pair.node2.name}`);
      console.log(`    Confidence: ${(pair.confidence * 100).toFixed(0)}%, Type: ${pair.matchType}`);
    }
    console.log('========================================');

    // Export files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.analyzer.exportToFile(report, `glb_analysis_${timestamp}.json`);

    const markdown = this.analyzer.exportToMarkdown(report);
    const mdBlob = new Blob([markdown], { type: 'text/markdown' });
    const mdUrl = URL.createObjectURL(mdBlob);
    const mdLink = document.createElement('a');
    mdLink.href = mdUrl;
    mdLink.download = `glb_analysis_${timestamp}.md`;
    mdLink.click();
    URL.revokeObjectURL(mdUrl);

    console.log(`\n✅ Exported: glb_analysis_${timestamp}.json`);
    console.log(`✅ Exported: glb_analysis_${timestamp}.md`);
  }

  /**
   * Analyze a specific node
   */
  async analyzeNode(nodeName: string): Promise<void> {
    if (!this.scene || !this.analyzer) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    const node = this.scene.getTransformNodeByName(nodeName);
    if (!node) {
      console.error(`[DebugTools] Node not found: ${nodeName}`);
      return;
    }

    console.log(`[DebugTools] Analyzing node: ${nodeName}`);
    const report = await this.analyzer.analyzeGLB(node, `[Node: ${nodeName}]`);

    console.log('\n========================================');
    console.log(`NODE ANALYSIS: ${nodeName}`);
    console.log('========================================');
    console.log(`Total Nodes: ${report.metadata.totalNodes}`);
    console.log(`Potential Pairs: ${report.potentialPairs.length}`);
    console.log('========================================');

    this.analyzer.exportToFile(report, `node_analysis_${nodeName}.json`);
  }

  /**
   * Find all UNIT_xxx nodes and their FIXED/MOVING pairs
   */
  findUnitPairs(): void {
    if (!this.unitPairFinder) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    console.log('[DebugTools] Finding UNIT_xxx pairs...');
    const report = this.unitPairFinder.findAllUnitPairs();

    console.log('\n========================================');
    console.log('UNIT PAIR ANALYSIS');
    console.log('========================================');
    console.log(`Total Units: ${report.totalUnits}`);
    console.log(`Units with Valid Pairs: ${report.unitsWithPairs}`);
    console.log(`Units without Pairs: ${report.unitsWithoutPairs}`);
    console.log('');

    if (report.warnings.length > 0) {
      console.log('WARNINGS:');
      for (const warning of report.warnings) {
        console.log(`  ⚠️ ${warning}`);
      }
      console.log('');
    }

    console.log('PAIRS:');
    for (const pair of report.pairs) {
      const status =
        pair.fixedNode && pair.movingNode
          ? '✅'
          : !pair.fixedNode && !pair.movingNode
            ? '❌'
            : '⚠️';
      console.log(
        `  ${status} ${pair.unitName}: FIXED=${pair.fixedNode?.name ?? 'NONE'}, MOVING=${pair.movingNode?.name ?? 'NONE'} (${(pair.confidence * 100).toFixed(0)}%)`
      );
    }
    console.log('========================================\n');

    // Export files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const jsonFileName = `unit_pairs_${timestamp}.json`;
    const mdFileName = `unit_pairs_${timestamp}.md`;

    // Export JSON
    const jsonBlob = new Blob([this.unitPairFinder.exportToJSON(report)], {
      type: 'application/json',
    });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = jsonFileName;
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);

    // Export Markdown
    const markdown = this.unitPairFinder.exportToMarkdown(report);
    const mdBlob = new Blob([markdown], { type: 'text/markdown' });
    const mdUrl = URL.createObjectURL(mdBlob);
    const mdLink = document.createElement('a');
    mdLink.href = mdUrl;
    mdLink.download = mdFileName;
    mdLink.click();
    URL.revokeObjectURL(mdUrl);

    console.log(`✅ Exported: ${jsonFileName}`);
    console.log(`✅ Exported: ${mdFileName}`);
  }

  /**
   * Find all UNIT_xxx nodes and their joints (v2 - Multi-joint support)
   */
  findUnitPairsV2(): void {
    if (!this.unitPairFinderV2) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    console.log('[DebugTools] Finding UNIT_xxx joints (v2 - multi-joint)...');
    const report = this.unitPairFinderV2.findAllUnitPairs();

    console.log('\n========================================');
    console.log('UNIT JOINT ANALYSIS (v2)');
    console.log('========================================');
    console.log(`Total Units: ${report.totalUnits}`);
    console.log(`Total Joints: ${report.totalJoints}`);
    console.log(`Units with Joints: ${report.unitsWithJoints}`);
    console.log(`Units without Joints: ${report.unitsWithoutJoints}`);
    console.log('');

    if (report.warnings.length > 0) {
      console.log('WARNINGS:');
      for (const warning of report.warnings) {
        console.log(`  ⚠️ ${warning}`);
      }
      console.log('');
    }

    console.log('UNITS:');
    for (const unit of report.units) {
      if (unit.joints.length === 0) {
        console.log(`  ❌ ${unit.unitName}: No joints`);
      } else if (unit.joints.length === 1) {
        const joint = unit.joints[0];
        console.log(`  ✅ ${unit.unitName}: 1 joint`);
        console.log(`     ${joint.fixedPath} ↔ ${joint.movingPath}`);
        if (joint.geometricSimilarity !== undefined) {
          console.log(`     Similarity: ${(joint.geometricSimilarity * 100).toFixed(1)}%`);
        }
      } else {
        console.log(`  ✅ ${unit.unitName}: ${unit.joints.length} joints (multi-joint)`);
        for (const joint of unit.joints) {
          console.log(`     - ${joint.jointName}:`);
          console.log(`       ${joint.fixedPath} ↔ ${joint.movingPath}`);
          if (joint.geometricSimilarity !== undefined) {
            console.log(`       Similarity: ${(joint.geometricSimilarity * 100).toFixed(1)}%`);
          }
        }
      }
    }
    console.log('========================================\n');

    // Export files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const jsonFileName = `unit_joints_v2_${timestamp}.json`;
    const mdFileName = `unit_joints_v2_${timestamp}.md`;

    // Export JSON
    const jsonBlob = new Blob([this.unitPairFinderV2.exportToJSON(report)], {
      type: 'application/json',
    });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = jsonFileName;
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);

    // Export Markdown
    const markdown = this.unitPairFinderV2.exportToMarkdown(report);
    const mdBlob = new Blob([markdown], { type: 'text/markdown' });
    const mdUrl = URL.createObjectURL(mdBlob);
    const mdLink = document.createElement('a');
    mdLink.href = mdUrl;
    mdLink.download = mdFileName;
    mdLink.click();
    URL.revokeObjectURL(mdUrl);

    console.log(`✅ Exported: ${jsonFileName}`);
    console.log(`✅ Exported: ${mdFileName}`);
  }

  /**
   * Analyze a specific unit
   */
  analyzeUnit(unitName: string): void {
    if (!this.unitPairFinder) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    const unitNode = this.scene!.getTransformNodeByName(unitName);
    if (!unitNode) {
      console.error(`[DebugTools] Unit not found: ${unitName}`);
      return;
    }

    console.log(`[DebugTools] Analyzing unit: ${unitName}`);
    const pair = this.unitPairFinder.findPairForUnit(unitNode);

    console.log('\n========================================');
    console.log(`UNIT ANALYSIS: ${unitName}`);
    console.log('========================================');
    console.log(`FIXED: ${pair.fixedNode?.name ?? 'NONE'}`);
    console.log(`MOVING: ${pair.movingNode?.name ?? 'NONE'}`);
    console.log(`Confidence: ${(pair.confidence * 100).toFixed(0)}%`);
    console.log(`Method: ${pair.method}`);
    if (pair.geometricSimilarity !== undefined) {
      console.log(`Geometric Similarity: ${(pair.geometricSimilarity * 100).toFixed(1)}%`);
    }
    console.log('');
    console.log('Notes:');
    for (const note of pair.notes) {
      console.log(`  - ${note}`);
    }
    console.log('========================================\n');
  }

  /**
   * Deep debug UNIT_112 - shows complete geometry distribution
   */
  debugUnit112(): void {
    if (!this.scene) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    const unit112Debugger = new Unit112Debugger(this.scene);
    unit112Debugger.analyzeUnit112();
  }

  /**
   * Find joint pairs in UNIT_112 using geometry-based analysis
   */
  findUnit112Pairs(): void {
    if (!this.scene) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    const pairFinder = new Unit112PairFinder(this.scene);
    pairFinder.findPairs();
  }

  /**
   * Show bounding box for a node
   */
  showBBox(nodeName: string, colorName: string = 'green'): void {
    if (!this.bboxDebugger) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    const colorMap: Record<string, BABYLON.Color3> = {
      red: BABYLON.Color3.Red(),
      green: BABYLON.Color3.Green(),
      blue: BABYLON.Color3.Blue(),
      yellow: BABYLON.Color3.Yellow(),
      magenta: BABYLON.Color3.Magenta(),
      cyan: new BABYLON.Color3(0, 1, 1),
      white: BABYLON.Color3.White(),
    };

    const color = colorMap[colorName.toLowerCase()] || BABYLON.Color3.Green();
    this.bboxDebugger.showBoundingBox(nodeName, color);
  }

  /**
   * Compare bounding boxes of two nodes
   */
  compareBBoxes(node1: string, node2: string, threshold: number = 0.90): void {
    if (!this.bboxDebugger) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    this.bboxDebugger.compareBoundingBoxes(node1, node2, threshold);
  }

  /**
   * Show all bounding boxes matching a pattern
   */
  showAllBBoxes(pattern?: string): void {
    if (!this.bboxDebugger) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    this.bboxDebugger.showAllBoundingBoxes(pattern);
  }

  /**
   * Find all potential pairs by bounding box similarity
   */
  findPairs(threshold: number = 0.90): void {
    if (!this.bboxDebugger) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    this.bboxDebugger.findAllPairs(threshold);
  }

  /**
   * Clear all bounding box visualizations
   */
  clearBBoxes(): void {
    if (!this.bboxDebugger) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    this.bboxDebugger.clear();
  }

  /**
   * List all nodes (optionally filtered by pattern)
   */
  listNodes(pattern?: string): void {
    if (!this.scene) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return;
    }

    const nodes = this.scene.transformNodes.filter(n => {
      if (!pattern) return true;
      return n.name.toLowerCase().includes(pattern.toLowerCase());
    });

    console.log(`\n========================================`);
    console.log(`NODES${pattern ? ` (filter: "${pattern}")` : ''}: ${nodes.length} found`);
    console.log(`========================================`);

    for (const node of nodes) {
      const meshes = node.getChildMeshes(false);
      const hasMeshes = meshes.length > 0;
      const icon = hasMeshes ? '📦' : '📁';
      console.log(`${icon} ${node.name} (id: ${node.uniqueId}, meshes: ${meshes.length})`);
    }
    console.log(`========================================\n`);
  }

  /**
   * Get a node by name
   */
  getNode(nodeName: string): BABYLON.TransformNode | null {
    if (!this.scene) {
      console.error('[DebugTools] No scene set. Use window.debugTools.setScene(scene) first.');
      return null;
    }

    const node = this.scene.getTransformNodeByName(nodeName);
    if (node) {
      console.log(`Found node: ${node.name} (id: ${node.uniqueId})`);
      console.log(`  Parent: ${node.parent?.name || 'null'}`);
      console.log(`  Children: ${node.getChildren().length}`);
      console.log(`  Meshes: ${node.getChildMeshes(false).length}`);
    } else {
      console.error(`Node not found: ${nodeName}`);
    }
    return node;
  }

  /**
   * Show help
   */
  help(): void {
    console.log(`
========================================
DEBUG TOOLS - HELP
========================================

SETUP:
  window.debugTools.setScene(scene)
    Set the active scene (do this first!)

AUTO-KINEMATICS (UNIT PAIR FINDING):
  window.debugTools.findUnitPairsV2()
    ⭐⭐ RECOMMENDED: Find all joints (supports multi-joint units like LH/RH)
    Handles complex hierarchies (UNIT_112/LH/FIXED, UNIT_112/RH/MOVING, etc.)
    Exports JSON and Markdown reports
    USE THIS for auto-kinematics analysis!

  window.debugTools.findUnit112Pairs()
    ⭐ NEW: Geometry-based pair finding for UNIT_112
    Uses ONLY geometric similarity (NO naming assumptions)
    Finds revolute joints by comparing shape + position
    Immune to Container Node Fallacy (CNF)

  window.debugTools.debugUnit112()
    Deep debug UNIT_112 structure with geometry distribution
    Shows complete tree with mesh counts and vertex totals

  window.debugTools.findUnitPairs()
    Legacy: Simple single FIXED/MOVING per unit (may miss LH/RH joints)

  window.debugTools.analyzeUnit('UNIT_118')
    Analyze a specific unit's FIXED/MOVING pair (legacy)

GLB ANALYSIS:
  await window.debugTools.analyzeGLB()
    Analyze entire GLB structure
    Exports JSON and Markdown reports

  await window.debugTools.analyzeNode('UNIT_118')
    Analyze a specific node

BOUNDING BOX DEBUG:
  window.debugTools.showBBox('UNIT_118_FIXED', 'green')
    Show bounding box for a node
    Colors: red, green, blue, yellow, magenta, cyan, white

  window.debugTools.compareBBoxes('UNIT_118_FIXED', 'UNIT_118_MOVING')
    Compare two nodes (shows similarity, differences)
    Optional threshold: compareBBoxes('A', 'B', 0.90)

  window.debugTools.showAllBBoxes('UNIT')
    Show all bounding boxes matching pattern

  window.debugTools.findPairs(0.90)
    Find all pairs with similarity >= 90%

  window.debugTools.clearBBoxes()
    Clear all bounding box visualizations

UTILITIES:
  window.debugTools.listNodes('UNIT')
    List all nodes (filtered by pattern)

  window.debugTools.getNode('UNIT_118')
    Get info about a specific node

  window.debugTools.help()
    Show this help

========================================

QUICK START (AUTO-KINEMATICS):
  1. Load your GLB file in the UI
  2. Open browser console (F12)
  3. window.debugTools.findUnitPairsV2()
     → This finds ALL joints including multi-joint units (LH/RH)!
  4. Review the exported reports
  5. Check similarity scores (should be >80% for valid pairs)

QUICK START (GENERAL):
  1. window.debugTools.listNodes()
  2. window.debugTools.showBBox('UNIT_118_FIXED')
  3. await window.debugTools.analyzeGLB()

========================================
    `);
  }
}

// Create singleton instance
const debugTools = new DebugTools();

// Expose to window
if (typeof window !== 'undefined') {
  (window as any).debugTools = debugTools;
}

export { DebugTools, debugTools };
