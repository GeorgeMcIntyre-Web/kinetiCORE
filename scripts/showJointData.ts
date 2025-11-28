/**
 * Show Joint Data from Analysis Results
 *
 * Displays RMSE, joint count, and joint types in a clean, readable format.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Joint data structure from Python analysis
 */
interface Joint {
  Name: string;
  ElectricalName: string;
  NodeId: string;
  Type: number; // 0 = prismatic, 1 = revolute
  MaxValue: number;
  MinValue: number;
  PointCountClose: number;
  PointCountOpen: number;
  RmsError: number;
  MaxError: number;
}

interface UnitJoints {
  UnitName: string;
  Joints: Joint[];
}

/**
 * Format scientific notation to readable string
 */
function formatScientific(value: number): string {
  if (value < 0.0001) {
    return value.toExponential(2);
  }
  return value.toFixed(6);
}

/**
 * Format RMSE with color coding (conceptual - CLI output)
 */
function formatRMSE(rmse: number): string {
  const formatted = formatScientific(rmse);

  // Quality indicators
  if (rmse < 1e-6) return `${formatted.padStart(12)} ★★★ (excellent)`;
  if (rmse < 1e-5) return `${formatted.padStart(12)} ★★  (good)`;
  if (rmse < 1e-4) return `${formatted.padStart(12)} ★   (acceptable)`;
  return `${formatted.padStart(12)} ⚠   (review)`;
}

/**
 * Get joint type name
 */
function getJointType(type: number): string {
  switch (type) {
    case 0: return 'Prismatic';
    case 1: return 'Revolute';
    default: return 'Unknown';
  }
}

/**
 * Format range for display
 */
function formatRange(min: number, max: number, type: number): string {
  if (type === 0) {
    // Prismatic - linear distance
    return `${min.toFixed(3)}m → ${max.toFixed(3)}m`;
  } else {
    // Revolute - angular
    return `${min.toFixed(1)}° → ${max.toFixed(1)}°`;
  }
}

/**
 * Display fixture joint data
 */
function displayFixture(fixtureName: string, jsonPath: string): void {
  console.log(`\n${'='.repeat(90)}`);
  console.log(`FIXTURE: ${fixtureName}`);
  console.log(`${'='.repeat(90)}\n`);

  // Load joint data
  const data: UnitJoints[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const totalUnits = data.length;
  const totalJoints = data.reduce((sum, unit) => sum + unit.Joints.length, 0);

  console.log(`Units:  ${totalUnits}`);
  console.log(`Joints: ${totalJoints}\n`);

  console.log(`${'-'.repeat(90)}`);
  console.log('JOINT ANALYSIS RESULTS:');
  console.log(`${'-'.repeat(90)}\n`);

  data.forEach((unit, unitIndex) => {
    console.log(`Unit ${(unitIndex + 1).toString().padStart(2)}: ${unit.UnitName} (${unit.Joints.length} joint${unit.Joints.length !== 1 ? 's' : ''})`);
    console.log(`${'-'.repeat(90)}`);

    if (unit.Joints.length === 0) {
      console.log('  (No joints detected)\n');
      return;
    }

    unit.Joints.forEach((joint, jointIndex) => {
      const jointNum = unit.Joints.length > 1 ? ` #${jointIndex + 1}` : '';
      console.log(`  Joint${jointNum}: ${joint.ElectricalName}`);
      console.log(`    Type:        ${getJointType(joint.Type).padEnd(12)} ${formatRange(joint.MinValue, joint.MaxValue, joint.Type)}`);
      console.log(`    Points:      ${joint.PointCountClose.toLocaleString().padStart(12)} (close) / ${joint.PointCountOpen.toLocaleString()} (open)`);
      console.log(`    RMSE:        ${formatRMSE(joint.RmsError)}`);
      console.log(`    Max Error:   ${formatScientific(joint.MaxError).padStart(12)}`);
      console.log(`    Node Path:   ${joint.NodeId}`);
      console.log();
    });
  });

  // Summary statistics
  const allJoints = data.flatMap(u => u.Joints);
  const revoluteCount = allJoints.filter(j => j.Type === 1).length;
  const prismaticCount = allJoints.filter(j => j.Type === 0).length;
  const avgRMSE = allJoints.reduce((sum, j) => sum + j.RmsError, 0) / allJoints.length;
  const maxRMSE = Math.max(...allJoints.map(j => j.RmsError));
  const minRMSE = Math.min(...allJoints.map(j => j.RmsError));
  const avgPoints = allJoints.reduce((sum, j) => sum + j.PointCountClose, 0) / allJoints.length;

  console.log(`${'-'.repeat(90)}`);
  console.log('SUMMARY STATISTICS:');
  console.log(`${'-'.repeat(90)}`);
  console.log(`Total joints:      ${totalJoints}`);
  console.log(`  Revolute:        ${revoluteCount} (${((revoluteCount / totalJoints) * 100).toFixed(1)}%)`);
  console.log(`  Prismatic:       ${prismaticCount} (${((prismaticCount / totalJoints) * 100).toFixed(1)}%)`);
  console.log();
  console.log(`RMSE Statistics:`);
  console.log(`  Average:         ${formatScientific(avgRMSE)}`);
  console.log(`  Min:             ${formatScientific(minRMSE)}`);
  console.log(`  Max:             ${formatScientific(maxRMSE)}`);
  console.log();
  console.log(`Avg points/joint:  ${Math.round(avgPoints).toLocaleString()}`);
  console.log();
}

/**
 * Main runner
 */
function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    Joint Extraction Analysis - ICP Results                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════╝');

  // Available fixtures
  const fixtures = [
    {
      name: '9X Station 110 (110mm)',
      path: 'C:/Users/georgem/source/repos/kinetiCORE_data/Tooling/9X_110_GEO.json',
    },
  ];

  for (const fixture of fixtures) {
    if (!fs.existsSync(fixture.path)) {
      console.log(`\n⚠️  SKIPPING ${fixture.name}: File not found`);
      console.log(`   ${fixture.path}\n`);
      continue;
    }

    try {
      displayFixture(fixture.name, fixture.path);
    } catch (error) {
      console.error(`\n❌ ERROR analyzing ${fixture.name}:`, error);
    }
  }

  console.log(`${'='.repeat(90)}`);
  console.log('Analysis Complete');
  console.log(`${'='.repeat(90)}\n`);
  console.log('Legend:');
  console.log('  ★★★ = RMSE < 1e-6  (excellent alignment)');
  console.log('  ★★  = RMSE < 1e-5  (good alignment)');
  console.log('  ★   = RMSE < 1e-4  (acceptable alignment)');
  console.log('  ⚠   = RMSE >= 1e-4 (needs review)\n');
}

// Run
main();
