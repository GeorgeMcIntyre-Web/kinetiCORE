/**
 * Complete Joint Analysis Summary
 *
 * Shows comprehensive results combining:
 * 1. Unit detection from Statistical Pairing Engine
 * 2. Moving node identification
 * 3. Joint extraction with ICP RMSE (where available)
 * 4. Estimated joint parameters for fixtures without full ICP
 */

import * as fs from 'fs';

interface FixtureData {
  name: string;
  hasICP: boolean;
  icpDataPath?: string;
  treeDataPath?: string;
}

const FIXTURES: FixtureData[] = [
  {
    name: '9X Station 110',
    hasICP: true,
    icpDataPath: 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/9X_110_GEO.json',
  },
  {
    name: '8X Station 140',
    hasICP: false,
    treeDataPath: 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_CI00_tree.json',
  },
  {
    name: '5X Station 110',
    hasICP: false,
    treeDataPath: 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/016ZF_20142452_110/016ZF_20142452_110_tree.json',
  },
  {
    name: '8X Station 130',
    hasICP: false,
    treeDataPath: 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/testing_data/016ZF_20142435_130/016ZF_20142435_130_tree.json',
  },
];

/**
 * Format RMSE
 */
function formatRMSE(rmse: number): string {
  const formatted = rmse < 0.0001 ? rmse.toExponential(2) : rmse.toFixed(6);
  if (rmse < 1e-6) return `${formatted.padStart(12)} ★★★`;
  if (rmse < 1e-5) return `${formatted.padStart(12)} ★★ `;
  if (rmse < 1e-4) return `${formatted.padStart(12)} ★  `;
  return `${formatted.padStart(12)} ⚠  `;
}

/**
 * Show ICP-verified fixture
 */
function showICPFixture(name: string, jsonPath: string): void {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`\n${'='.repeat(100)}`);
  console.log(`${name} [ICP-VERIFIED]`.padEnd(100));
  console.log(`${'='.repeat(100)}`);

  const totalUnits = data.length;
  const totalJoints = data.reduce((sum: number, u: any) => sum + u.Joints.length, 0);
  const avgRMSE = data.reduce((sum: number, u: any) =>
    sum + u.Joints.reduce((s: number, j: any) => s + j.RmsError, 0), 0) / totalJoints;

  console.log(`Units: ${totalUnits}  |  Joints: ${totalJoints}  |  Avg RMSE: ${avgRMSE.toExponential(2)}\n`);

  console.log(`${'Unit'.padEnd(15)} ${'Joint'.padEnd(15)} ${'Type'.padEnd(12)} ${'Range'.padEnd(25)} ${'Points'.padStart(10)} ${'RMSE'.padStart(15)}`);
  console.log(`${'-'.repeat(100)}`);

  data.forEach((unit: any) => {
    unit.Joints.forEach((joint: any, idx: number) => {
      const type = joint.Type === 0 ? 'Prismatic' : 'Revolute';
      const range = joint.Type === 0
        ? `${joint.MinValue.toFixed(3)}m → ${joint.MaxValue.toFixed(3)}m`
        : `${joint.MinValue.toFixed(1)}° → ${joint.MaxValue.toFixed(1)}°`;

      const unitName = idx === 0 ? unit.UnitName : '';
      const jointName = joint.ElectricalName;
      const points = joint.PointCountClose.toLocaleString();
      const rmse = formatRMSE(joint.RmsError);

      console.log(`${unitName.padEnd(15)} ${jointName.padEnd(15)} ${type.padEnd(12)} ${range.padEnd(25)} ${points.padStart(10)} ${rmse}`);
    });
  });
}

/**
 * Show estimated fixture (tree-based analysis)
 */
function showEstimatedFixture(name: string, jsonPath: string): void {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const { unitCandidates, totalPointCount } = data.summary;

  console.log(`\n${'='.repeat(100)}`);
  console.log(`${name} [ESTIMATED - Needs ICP]`.padEnd(100));
  console.log(`${'='.repeat(100)}`);

  if (!unitCandidates || unitCandidates.length === 0) {
    console.log('No units detected\n');
    return;
  }

  // Count moving nodes
  let totalMoving = 0;
  const findMoving = (node: any): number => {
    let count = 0;
    const name = (node.name || '').toLowerCase();
    if (name.includes('moving') && node.subtreePointCount > 0) count++;
    if (node.children) {
      node.children.forEach((child: any) => {
        count += findMoving(child);
      });
    }
    return count;
  };

  data.tree.forEach((root: any) => {
    totalMoving += findMoving(root);
  });

  console.log(`Units: ${unitCandidates.length}  |  Moving Nodes: ${totalMoving}  |  Total Points: ${totalPointCount.toLocaleString()}\n`);

  console.log(`${'Unit'.padEnd(20)} ${'Point Count'.padStart(15)} ${'% of Total'.padStart(12)} ${'Moving Nodes'.padStart(15)}`);
  console.log(`${'-'.repeat(100)}`);

  unitCandidates.forEach((unit: any) => {
    // Find moving nodes under this unit
    const findUnitNode = (nodes: any[]): any => {
      for (const node of nodes) {
        if (node.index === unit.index) return node;
        if (node.children) {
          const found = findUnitNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const unitNode = findUnitNode(data.tree);
    const movingCount = unitNode ? findMoving(unitNode) : 0;

    const name = unit.name;
    const points = unit.subtreePointCount.toLocaleString();
    const percent = unit.percentOfTotal.toFixed(1) + '%';
    const moving = movingCount > 0 ? movingCount.toString() : '-';

    console.log(`${name.padEnd(20)} ${points.padStart(15)} ${percent.padStart(12)} ${moving.padStart(15)}`);
  });
}

/**
 * Main runner
 */
function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                         COMPLETE JOINT ANALYSIS - ALL FIXTURES                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════╝');

  let totalWithICP = 0;
  let totalEstimated = 0;
  let totalJointsVerified = 0;
  let totalMovingNodesEstimated = 0;

  for (const fixture of FIXTURES) {
    if (fixture.hasICP && fixture.icpDataPath && fs.existsSync(fixture.icpDataPath)) {
      showICPFixture(fixture.name, fixture.icpDataPath);
      totalWithICP++;
      const data = JSON.parse(fs.readFileSync(fixture.icpDataPath, 'utf-8'));
      totalJointsVerified += data.reduce((sum: number, u: any) => sum + u.Joints.length, 0);
    } else if (fixture.treeDataPath && fs.existsSync(fixture.treeDataPath)) {
      showEstimatedFixture(fixture.name, fixture.treeDataPath);
      totalEstimated++;
      const data = JSON.parse(fs.readFileSync(fixture.treeDataPath, 'utf-8'));
      const findMoving = (node: any): number => {
        let count = 0;
        const name = (node.name || '').toLowerCase();
        if (name.includes('moving') && node.subtreePointCount > 0) count++;
        if (node.children) {
          node.children.forEach((child: any) => {
            count += findMoving(child);
          });
        }
        return count;
      };
      data.tree.forEach((root: any) => {
        totalMovingNodesEstimated += findMoving(root);
      });
    } else {
      console.log(`\n⚠️  SKIPPING ${fixture.name}: Data files not found`);
    }
  }

  console.log(`\n\n${'='.repeat(100)}`);
  console.log('OVERALL SUMMARY');
  console.log(`${'='.repeat(100)}`);
  console.log(`Total fixtures analyzed:           ${totalWithICP + totalEstimated}`);
  console.log(`  With ICP verification:           ${totalWithICP} (${totalJointsVerified} joints with RMSE)`);
  console.log(`  Needs ICP verification:          ${totalEstimated} (${totalMovingNodesEstimated} moving nodes detected)`);
  console.log();
  console.log(`Legend:`);
  console.log(`  ★★★ = RMSE < 1e-6  (excellent alignment - production ready)`);
  console.log(`  ★★  = RMSE < 1e-5  (good alignment)`);
  console.log(`  ★   = RMSE < 1e-4  (acceptable alignment)`);
  console.log(`  ⚠   = RMSE >= 1e-4 (needs review)`);
  console.log(`${'='.repeat(100)}\n`);
}

// Run
main();
