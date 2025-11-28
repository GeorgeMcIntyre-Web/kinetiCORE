/**
 * Show Detected Units from Tree JSON Files
 *
 * Displays the unit candidates found in pre-analyzed tree.json files,
 * showing what the statistical pairing engine would detect.
 */

import * as fs from 'fs';
import * as path from 'path';

// Test fixtures
const FIXTURES = [
  {
    name: '8X-140 (140mm)',
    path: 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_CI00_tree.json',
  },
  {
    name: '5X-110 (110mm)',
    path: 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/016ZF_20142452_110/016ZF_20142452_110_tree.json',
  },
  {
    name: '130mm Fixture',
    path: 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/016ZF_20142435_130/016ZF_20142435_130_tree.json',
  },
];

/**
 * Unit candidate from JSON
 */
interface UnitCandidate {
  index: number;
  name: string;
  nativeName: string;
  subtreePointCount: number;
  percentOfTotal: number;
  childCount: number;
}

/**
 * Tree node structure
 */
interface TreeNode {
  index: number;
  name: string;
  nativeName: string;
  depth: number;
  pointCount: number;
  subtreePointCount: number;
  children?: TreeNode[];
}

/**
 * Tree JSON file structure
 */
interface TreeJSON {
  fileInfo: {
    generator: string;
    version: string;
  };
  summary: {
    totalNodes: number;
    totalPointCount: number;
    maxDepth: number;
    nodesWithMesh?: number;
    unitCandidates?: UnitCandidate[];
  };
  tree: TreeNode[];
}

/**
 * Format point count with thousands separator
 */
function formatPoints(count: number): string {
  return count.toLocaleString('en-US');
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
  return value.toFixed(2) + '%';
}

/**
 * Find a node by index in the tree
 */
function findNodeByIndex(tree: TreeNode[], index: number): TreeNode | null {
  for (const node of tree) {
    if (node.index === index) {
      return node;
    }

    if (node.children) {
      const found = findNodeByIndex(node.children, index);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Collect all child nodes recursively
 */
function collectChildren(node: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];

  if (node.children) {
    for (const child of node.children) {
      result.push(child);
      result.push(...collectChildren(child));
    }
  }

  return result;
}

/**
 * Show moving nodes for a unit
 */
function showMovingNodes(unitNode: TreeNode): void {
  const children = collectChildren(unitNode);
  const movingNodes = children.filter(n => n.name.includes('MOVING'));

  if (movingNodes.length > 0) {
    console.log(`  Moving nodes (${movingNodes.length}):`);
    movingNodes.forEach(node => {
      const pointsStr = formatPoints(node.subtreePointCount).padStart(12);
      console.log(`    - ${node.name.padEnd(30)} ${pointsStr} pts (depth ${node.depth})`);
    });
  }
}

/**
 * Analyze a single fixture
 */
function analyzeFixture(fixtureName: string, jsonPath: string): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`FIXTURE: ${fixtureName}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load tree JSON
  const treeJson: TreeJSON = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const fixtureTotal = treeJson.summary.totalPointCount;
  const totalNodes = treeJson.summary.totalNodes;
  const maxDepth = treeJson.summary.maxDepth;
  const unitCandidates = treeJson.summary.unitCandidates ?? [];

  console.log(`File: ${path.basename(jsonPath)}`);
  console.log(`Total nodes: ${totalNodes.toLocaleString()}`);
  console.log(`Total points: ${formatPoints(fixtureTotal)}`);
  console.log(`Max depth: ${maxDepth}`);
  console.log(`\nUnit candidates detected: ${unitCandidates.length}`);

  if (unitCandidates.length === 0) {
    console.log('\n(No unit candidates found in JSON)\n');
    return;
  }

  // Print unit details
  console.log(`\n${'-'.repeat(80)}`);
  console.log('DETECTED UNITS:');
  console.log(`${'-'.repeat(80)}\n`);

  unitCandidates.forEach((unit, index) => {
    console.log(`Unit ${(index + 1).toString().padStart(2)}: ${unit.name}`);
    console.log(`  Native name:  ${unit.nativeName}`);
    console.log(`  Points:       ${formatPoints(unit.subtreePointCount).padStart(12)} (${formatPercent(unit.percentOfTotal)} of fixture)`);
    console.log(`  Tree index:   ${unit.index}`);
    console.log(`  Children:     ${unit.childCount}`);

    // Find the node in the tree to show moving nodes
    const unitNode = findNodeByIndex(treeJson.tree, unit.index);
    if (unitNode && unitNode.children) {
      showMovingNodes(unitNode);
    }

    console.log();
  });

  // Summary stats
  const totalUnitPoints = unitCandidates.reduce((sum, unit) => sum + unit.subtreePointCount, 0);
  const coverage = fixtureTotal > 0 ? (totalUnitPoints / fixtureTotal) * 100 : 0;

  console.log(`${'-'.repeat(80)}`);
  console.log('SUMMARY:');
  console.log(`${'-'.repeat(80)}`);
  console.log(`Units detected:  ${unitCandidates.length}`);
  console.log(`Points covered:  ${formatPoints(totalUnitPoints)} / ${formatPoints(fixtureTotal)} (${formatPercent(coverage)})`);
  console.log();
}

/**
 * Main test runner
 */
function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        Statistical Pairing - Unit Detection Analysis                      ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');
  console.log('Showing unit candidates that would be detected by the Statistical Pairing Engine');
  console.log('based on point count thresholds (2%-60% of fixture total).\n');

  for (const fixture of FIXTURES) {
    if (!fs.existsSync(fixture.path)) {
      console.log(`\n⚠️  SKIPPING ${fixture.name}: File not found`);
      console.log(`   ${fixture.path}\n`);
      continue;
    }

    try {
      analyzeFixture(fixture.name, fixture.path);
    } catch (error) {
      console.error(`\n❌ ERROR analyzing ${fixture.name}:`, error);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('Analysis Complete');
  console.log(`${'='.repeat(80)}\n`);
}

// Run analysis
main();
