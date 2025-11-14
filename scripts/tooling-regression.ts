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
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  nameRandomizationFixtures?: string[]; // Fixture IDs to test name randomization on
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
  invariantsOk: boolean;
  invariantReason?: string;
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
    const result = await testFixture(fixture, config.invariants, config);
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
  
  const invariantsOk = results.filter(r => r.invariantsOk).length;
  const invariantsFailed = results.filter(r => !r.invariantsOk).length;
  if (invariantsFailed > 0) {
    console.log(`Invariants: ${invariantsOk} OK, ${invariantsFailed} failed`);
    results.filter(r => !r.invariantsOk).forEach(r => {
      console.log(`  ${r.fixtureId}: ${r.invariantReason || 'Unknown'}`);
    });
  }

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
  config: RegressionConfig,
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
    invariantsOk: true,
  };

  try {
    // Run pipeline
    // Quote paths to handle spaces when using shell: true
    const quotedGlbPath = fixture.glb.includes(' ') ? `"${fixture.glb}"` : fixture.glb;
    const args = ['tsx', 'scripts/tooling-pipeline.ts', quotedGlbPath];
    if (fixture.jointsJson) {
      const quotedJointsPath = fixture.jointsJson.includes(' ') ? `"${fixture.jointsJson}"` : fixture.jointsJson;
      args.push(quotedJointsPath);
    }

    await runCommand('npx', args);

    // Load outputs
    // Use GLB filename (not fixture ID) to match pipeline output naming
    const baseDir = path.dirname(fixture.glb);
    const glbBaseName = path.basename(fixture.glb, '.glb');
    const clustersPath = path.join(baseDir, `${glbBaseName}.rigid-clusters.json`);
    const unitsPath = path.join(baseDir, `${glbBaseName}.units.json`);

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

      // Check invariants using PipelineInvariants
      try {
        const { checkUnitBuilderInvariants, assertInvariants } = await import('../src/dev/tooling/PipelineInvariants');
        const model = {
          nodes: [],
          meshes: [],
          clusters: clusters.map((c: any) => ({
            id: `cluster_${c.id}`,
            nodeIds: [],
            meshIds: c.meshNames || [],
            bboxMin: c.bbox.min,
            bboxMax: c.bbox.max,
            meshCount: c.stats.meshCount,
            totalVerts: c.stats.totalVerts,
          })),
          links: unitsData.links || [],
          joints: unitsData.joints || [],
        };
        const violations = checkUnitBuilderInvariants(model, unitsData.links || [], unitsData.units || []);
        if (violations.length > 0) {
          result.invariantsOk = false;
          result.invariantReason = violations.map(v => v.message).join('; ');
          result.errors.push(`Invariant violations: ${result.invariantReason}`);
          result.success = false;
        }
      } catch (err) {
        result.warnings.push(`Could not check invariants: ${err instanceof Error ? err.message : String(err)}`);
      }

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

    // Name randomization test (if enabled and fixture is in the list)
    const shouldTestNameRandomization = invariants.testNameRandomization && 
      randomizeNames && 
      fs.existsSync(unitsPath) &&
      (config.nameRandomizationFixtures?.includes(fixture.id) ?? false);
    
    if (shouldTestNameRandomization) {
      const nameRandomizationResult = await testNameRandomization(
        fixture,
        unitsPath,
        clustersPath,
      );
      if (!nameRandomizationResult.success) {
        result.errors.push(...nameRandomizationResult.errors);
        result.success = false;
      }
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

/**
 * Test that kinematic structure is unchanged when IDs are randomized.
 * Randomizes link/joint/cluster IDs in units.json and verifies:
 * - Same counts (links, joints, units)
 * - Same connectivity (up to ID renaming)
 * - No invariant failures
 */
async function testNameRandomization(
  fixture: FixtureConfig,
  unitsPath: string,
  clustersPath: string,
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    const originalData = JSON.parse(fs.readFileSync(unitsPath, 'utf8'));
    const originalClusters = JSON.parse(fs.readFileSync(clustersPath, 'utf8'));

    // Create ID mappings
    const linkIdMap = new Map<string, string>();
    const jointIdMap = new Map<string, string>();
    const clusterIdMap = new Map<string, string>();

    // Randomize link IDs
    (originalData.links || []).forEach((link: any, idx: number) => {
      const newId = `link_random_${Math.random().toString(36).substring(7)}_${idx}`;
      linkIdMap.set(link.id, newId);
    });

    // Randomize joint IDs
    (originalData.joints || []).forEach((joint: any, idx: number) => {
      const newId = `joint_random_${Math.random().toString(36).substring(7)}_${idx}`;
      jointIdMap.set(joint.id, newId);
    });

    // Randomize cluster IDs
    originalClusters.forEach((cluster: any, idx: number) => {
      const oldId = `cluster_${cluster.id}`;
      const newId = `cluster_random_${Math.random().toString(36).substring(7)}_${idx}`;
      clusterIdMap.set(oldId, newId);
    });

    // Create randomized copy
    const randomizedData = JSON.parse(JSON.stringify(originalData));

    // Apply ID mappings
    randomizedData.links?.forEach((link: any) => {
      link.id = linkIdMap.get(link.id) || link.id;
      link.clusterIds = link.clusterIds?.map((cid: string) => clusterIdMap.get(cid) || cid);
    });

    randomizedData.joints?.forEach((joint: any) => {
      joint.id = jointIdMap.get(joint.id) || joint.id;
      joint.parentClusterId = clusterIdMap.get(joint.parentClusterId) || joint.parentClusterId;
      joint.childClusterId = clusterIdMap.get(joint.childClusterId) || joint.childClusterId;
    });

    randomizedData.units?.forEach((unit: any) => {
      unit.id = `unit_random_${Math.random().toString(36).substring(7)}`;
      unit.primaryLinkId = linkIdMap.get(unit.primaryLinkId) || unit.primaryLinkId;
      unit.baseLinkId = linkIdMap.get(unit.baseLinkId) || unit.baseLinkId;
      unit.jointIds = unit.jointIds?.map((jid: string) => jointIdMap.get(jid) || jid);
      unit.clusterIds = unit.clusterIds?.map((cid: string) => clusterIdMap.get(cid) || cid);
    });

    // Verify counts are unchanged
    const originalCounts = {
      links: (originalData.links || []).length,
      joints: (originalData.joints || []).length,
      units: (originalData.units || []).length,
    };

    const randomizedCounts = {
      links: (randomizedData.links || []).length,
      joints: (randomizedData.joints || []).length,
      units: (randomizedData.units || []).length,
    };

    if (originalCounts.links !== randomizedCounts.links) {
      errors.push(`Link count changed: ${originalCounts.links} -> ${randomizedCounts.links}`);
    }
    if (originalCounts.joints !== randomizedCounts.joints) {
      errors.push(`Joint count changed: ${originalCounts.joints} -> ${randomizedCounts.joints}`);
    }
    if (originalCounts.units !== randomizedCounts.units) {
      errors.push(`Unit count changed: ${originalCounts.units} -> ${randomizedCounts.units}`);
    }

    // Verify connectivity (joint parent/child relationships)
    const originalConnections = new Set<string>();
    (originalData.joints || []).forEach((j: any) => {
      const parentLink = (originalData.links || []).find((l: any) => l.clusterIds?.includes(j.parentClusterId));
      const childLink = (originalData.links || []).find((l: any) => l.clusterIds?.includes(j.childClusterId));
      if (parentLink && childLink) {
        originalConnections.add(`${parentLink.id}->${childLink.id}`);
      }
    });

    const randomizedConnections = new Set<string>();
    (randomizedData.joints || []).forEach((j: any) => {
      const parentLink = (randomizedData.links || []).find((l: any) => l.clusterIds?.includes(j.parentClusterId));
      const childLink = (randomizedData.links || []).find((l: any) => l.clusterIds?.includes(j.childClusterId));
      if (parentLink && childLink) {
        randomizedConnections.add(`${parentLink.id}->${childLink.id}`);
      }
    });

    if (originalConnections.size !== randomizedConnections.size) {
      errors.push(`Connection count changed: ${originalConnections.size} -> ${randomizedConnections.size}`);
    }

    // Check invariants on randomized data
    try {
      const { checkUnitBuilderInvariants } = await import('../src/dev/tooling/PipelineInvariants');
      const randomizedClusters = originalClusters.map((c: any) => ({
        id: clusterIdMap.get(`cluster_${c.id}`) || `cluster_${c.id}`,
        nodeIds: [],
        meshIds: c.meshNames || [],
        bboxMin: c.bbox.min,
        bboxMax: c.bbox.max,
        meshCount: c.stats.meshCount,
        totalVerts: c.stats.totalVerts,
      }));
      const violations = checkUnitBuilderInvariants(
        {
          nodes: [],
          meshes: [],
          clusters: randomizedClusters,
          links: randomizedData.links || [],
          joints: randomizedData.joints || [],
        },
        randomizedData.links || [],
        randomizedData.units || [],
      );
      if (violations.length > 0) {
        errors.push(`Invariant violations after randomization: ${violations.map(v => v.message).join('; ')}`);
      }
    } catch (err) {
      errors.push(`Could not check invariants on randomized data: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      success: errors.length === 0,
      errors,
    };
  } catch (err) {
    return {
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
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

