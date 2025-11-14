// scripts/tooling-regression.ts
//
// Usage:
//   npx tsx scripts/tooling-regression.ts [--randomize-names]
//
// Runs the full pipeline on all fixtures in tooling-fixture-regression.json
// and checks invariants to ensure naming-free behavior and correctness.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

interface FixtureConfig {
  id: string;
  glb: string;
  jointsJson: string | null;
}

interface RegressionConfig {
  fixtures: FixtureConfig[];
  invariants: {
    requireBaseLink: boolean;
    requireAcyclicGraph: boolean;
    requireUnitsForJoints: boolean;
    testNameRandomization: boolean;
  };
}

interface RegressionResult {
  fixtureId: string;
  success: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    clusters: number;
    links: number;
    joints: number;
    units: number;
  };
}

const randomizeNames = process.argv.includes('--randomize-names');
const configPath = path.join(__dirname, 'tooling-fixture-regression.json');

run().catch(err => {
  console.error('Regression test failed:', err);
  process.exit(1);
});

async function run() {
  if (!fs.existsSync(configPath)) {
    console.error('Regression config not found:', configPath);
    process.exit(1);
  }

  const config: RegressionConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('===========================================================');
  console.log(' TOOLING REGRESSION TEST');
  console.log('===========================================================');
  console.log(`Fixtures: ${config.fixtures.length}`);
  console.log(`Name randomization: ${randomizeNames ? 'enabled' : 'disabled'}`);
  console.log('');

  const results: RegressionResult[] = [];

  for (const fixture of config.fixtures) {
    console.log(`\n[${fixture.id}] Running pipeline...`);
    const result = await testFixture(fixture, config.invariants);
    results.push(result);

    if (result.success) {
      console.log(`  ✓ PASSED`);
    } else {
      console.log(`  ✗ FAILED`);
      result.errors.forEach(err => console.log(`    ERROR: ${err}`));
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach(warn => console.log(`    WARN: ${warn}`));
    }
  }

  // Summary
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('\n===========================================================');
  console.log(' REGRESSION SUMMARY');
  console.log('===========================================================');
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\nFailed fixtures:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ${r.fixtureId}:`);
      r.errors.forEach(err => console.log(`    - ${err}`));
    });
    process.exit(1);
  }

  console.log('\nAll tests passed! ✓');
}

async function testFixture(
  fixture: FixtureConfig,
  invariants: RegressionConfig['invariants'],
): Promise<RegressionResult> {
  const result: RegressionResult = {
    fixtureId: fixture.id,
    success: true,
    errors: [],
    warnings: [],
    stats: {
      clusters: 0,
      links: 0,
      joints: 0,
      units: 0,
    },
  };

  try {
    // Run pipeline
    const args = ['tsx', 'scripts/tooling-pipeline.ts', fixture.glb];
    if (fixture.jointsJson) {
      args.push(fixture.jointsJson);
    }

    await runCommand('npx', args);

    // Load outputs
    const baseDir = path.dirname(fixture.glb);
    const clustersPath = path.join(baseDir, `${fixture.id}.rigid-clusters.json`);
    const unitsPath = path.join(baseDir, `${fixture.id}.units.json`);

    if (!fs.existsSync(clustersPath)) {
      result.errors.push('Missing rigid-clusters.json');
      result.success = false;
      return result;
    }

    const clusters = JSON.parse(fs.readFileSync(clustersPath, 'utf8'));
    result.stats.clusters = clusters.length;

    if (fs.existsSync(unitsPath)) {
      const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
      result.stats.links = unitsData.links?.length || 0;
      result.stats.joints = unitsData.joints?.length || 0;
      result.stats.units = unitsData.units?.length || 0;

      // Check invariants
      if (invariants.requireBaseLink) {
        const hasBaseLink = unitsData.links?.some((link: any) => {
          // Check if link contains base clusters
          const linkClusterIds = new Set(link.clusterIds || []);
          return clusters.some((c: any) => {
            const clusterId = `cluster_${c.id}`;
            return c.type === 'base' && linkClusterIds.has(clusterId);
          });
        });

        if (!hasBaseLink) {
          result.errors.push('No base link found');
          result.success = false;
        }
      }

      if (invariants.requireAcyclicGraph) {
        // Check for cycles in joint graph
        const hasCycle = checkForCycles(unitsData.joints || [], unitsData.links || []);
        if (hasCycle) {
          result.errors.push('Joint graph contains cycles');
          result.success = false;
        }
      }

      if (invariants.requireUnitsForJoints) {
        const jointIds = new Set((unitsData.joints || []).map((j: any) => j.id));
        const unitJointIds = new Set<string>();
        (unitsData.units || []).forEach((unit: any) => {
          (unit.jointIds || []).forEach((jid: string) => unitJointIds.add(jid));
        });

        const unassignedJoints = Array.from(jointIds).filter(jid => !unitJointIds.has(jid));
        if (unassignedJoints.length > 0) {
          result.warnings.push(`${unassignedJoints.length} joints not assigned to any unit`);
        }
      }
    } else {
      result.warnings.push('No units.json found (joints may be missing)');
    }

    // Name randomization test (if enabled)
    if (invariants.testNameRandomization && randomizeNames) {
      // TODO: Implement name randomization test
      // This would require modifying the GLB node names and re-running pipeline
      // to verify kinematic structure doesn't change
      result.warnings.push('Name randomization test not yet implemented');
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    result.success = false;
  }

  return result;
}

function checkForCycles(joints: any[], links: any[]): boolean {
  // Build adjacency list: link -> links connected via joints
  const linkGraph = new Map<string, Set<string>>();
  links.forEach(link => {
    linkGraph.set(link.id, new Set());
  });

  joints.forEach(joint => {
    // Find links containing parent and child clusters
    const parentLink = links.find(l => l.clusterIds?.includes(joint.parentClusterId));
    const childLink = links.find(l => l.clusterIds?.includes(joint.childClusterId));

    if (parentLink && childLink && parentLink.id !== childLink.id) {
      const neighbors = linkGraph.get(parentLink.id);
      if (neighbors) {
        neighbors.add(childLink.id);
      }
    }
  });

  // DFS to detect cycles
  const visited = new Set<string>();
  const recStack = new Set<string>();

  const hasCycleDFS = (linkId: string): boolean => {
    if (recStack.has(linkId)) return true;
    if (visited.has(linkId)) return false;

    visited.add(linkId);
    recStack.add(linkId);

    const neighbors = linkGraph.get(linkId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (hasCycleDFS(neighbor)) return true;
      }
    }

    recStack.delete(linkId);
    return false;
  };

  for (const linkId of linkGraph.keys()) {
    if (hasCycleDFS(linkId)) return true;
  }

  return false;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
    });

    let stderr = '';

    proc.stdout?.on('data', () => {
      // Discard stdout for cleaner output
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}\n${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

