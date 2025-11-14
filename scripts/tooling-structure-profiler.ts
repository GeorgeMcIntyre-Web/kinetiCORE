// scripts/tooling-structure-profiler.ts
//
// Usage:
//   npx tsx scripts/tooling-structure-profiler.ts <glb-path-or-folder>
//
// Options:
//   - Single GLB: analyzes that fixture
//   - Folder of GLBs: analyzes all GLBs in folder
//   - Folder of tree outputs: fast mode (uses existing tree outputs)
//
// Outputs:
//   - Per-fixture: <fixture>.structure-profile.json
//   - Aggregate: tooling-structure-report.json

import fs from 'node:fs';
import path from 'node:path';
import { ToolingStructureAnalyzer, type ToolingStructureProfile } from '../src/dev/tooling/ToolingStructureAnalyzer';

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: npx tsx scripts/tooling-structure-profiler.ts <glb-path-or-folder>');
  process.exit(1);
}

run().catch(err => {
  console.error('Structure profiler failed:', err);
  process.exit(1);
});

async function run() {
  if (!fs.existsSync(inputPath)) {
    console.error('Path not found:', inputPath);
    process.exit(1);
  }

  const stat = fs.statSync(inputPath);
  const profiles: ToolingStructureProfile[] = [];

  if (stat.isFile() && inputPath.endsWith('.glb')) {
    // Single GLB
    console.log('Analyzing single fixture:', inputPath);
    const profile = await analyzeSingleFixture(inputPath);
    profiles.push(profile);
  } else if (stat.isDirectory()) {
    // Folder - find all GLBs or tree outputs
    console.log('Scanning folder:', inputPath);
    const fixtures = findFixtures(inputPath);
    console.log(`Found ${fixtures.length} fixtures`);

    for (const fixture of fixtures) {
      console.log(`\nAnalyzing: ${fixture.id}`);
      const profile = await analyzeSingleFixture(fixture.glbPath, fixture.baseDir);
      profiles.push(profile);
    }
  } else {
    console.error('Input must be a GLB file or a directory');
    process.exit(1);
  }

  // Write per-fixture profiles
  profiles.forEach(profile => {
    const baseDir = path.dirname(inputPath);
    const profilePath = path.join(baseDir, `${profile.fixtureId}.structure-profile.json`);
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
    console.log(`  ✓ Profile: ${profilePath}`);
  });

  // Write aggregate report
  const reportPath = path.join(path.dirname(inputPath), 'tooling-structure-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    fixtureCount: profiles.length,
    profiles: profiles.map(p => ({
      fixtureId: p.fixtureId,
      suspectedFixtureType: p.suspectedFixtureType,
      clusterStats: {
        totalClusters: p.clusterStats.totalClusters,
        baseClusters: p.clusterStats.baseClusters,
        unitClusters: p.clusterStats.unitClusters,
      },
      jointStats: p.jointStats ? {
        totalJoints: p.jointStats.totalJoints,
        revoluteCount: p.jointStats.revoluteCount,
        prismaticCount: p.jointStats.prismaticCount,
      } : null,
    })),
    histograms: computeHistograms(profiles),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nAggregate report: ${reportPath}`);
  console.log(`\nSummary:`);
  console.log(`  Total fixtures: ${profiles.length}`);
  console.log(`  GEO fixtures: ${profiles.filter(p => p.suspectedFixtureType === 'geo_fixture').length}`);
  console.log(`  Grippers: ${profiles.filter(p => p.suspectedFixtureType === 'gripper').length}`);
  console.log(`  Dashboards: ${profiles.filter(p => p.suspectedFixtureType === 'dashboard').length}`);
  console.log(`  Transfers: ${profiles.filter(p => p.suspectedFixtureType === 'transfer').length}`);
  console.log(`  Unknown: ${profiles.filter(p => p.suspectedFixtureType === 'unknown').length}`);
}

interface FixtureInfo {
  id: string;
  glbPath: string;
  baseDir: string;
}

function findFixtures(dir: string): FixtureInfo[] {
  const fixtures: FixtureInfo[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(entry => {
    if (entry.isFile() && entry.name.endsWith('.glb')) {
      const fixtureId = path.basename(entry.name, '.glb');
      fixtures.push({
        id: fixtureId,
        glbPath: path.join(dir, entry.name),
        baseDir: dir,
      });
    } else if (entry.isDirectory()) {
      // Recursively search subdirectories
      const subFixtures = findFixtures(path.join(dir, entry.name));
      fixtures.push(...subFixtures);
    }
  });

  return fixtures;
}

async function analyzeSingleFixture(
  glbPath: string,
  baseDir?: string,
): Promise<ToolingStructureProfile> {
  const fixtureId = path.basename(glbPath, '.glb');
  const actualBaseDir = baseDir || path.dirname(glbPath);

  return ToolingStructureAnalyzer.analyzeFromPipeline(fixtureId, actualBaseDir);
}

function computeHistograms(profiles: ToolingStructureProfile[]): any {
  const clusterCounts = profiles.map(p => p.clusterStats.totalClusters);
  const jointCounts = profiles.map(p => p.jointStats?.totalJoints || 0).filter(c => c > 0);
  const baseMass = profiles.map(p => p.clusterStats.weldedBaseMass);
  const movingMass = profiles.map(p => p.clusterStats.movingMass);

  return {
    clusterCount: {
      min: clusterCounts.length > 0 ? Math.min(...clusterCounts) : 0,
      max: clusterCounts.length > 0 ? Math.max(...clusterCounts) : 0,
      avg: clusterCounts.length > 0 ? clusterCounts.reduce((a, b) => a + b, 0) / clusterCounts.length : 0,
    },
    jointCount: jointCounts.length > 0 ? {
      min: Math.min(...jointCounts),
      max: Math.max(...jointCounts),
      avg: jointCounts.reduce((a, b) => a + b, 0) / jointCounts.length,
    } : null,
    baseMass: {
      min: baseMass.length > 0 ? Math.min(...baseMass) : 0,
      max: baseMass.length > 0 ? Math.max(...baseMass) : 0,
      avg: baseMass.length > 0 ? baseMass.reduce((a, b) => a + b, 0) / baseMass.length : 0,
    },
    movingMass: {
      min: movingMass.length > 0 ? Math.min(...movingMass) : 0,
      max: movingMass.length > 0 ? Math.max(...movingMass) : 0,
      avg: movingMass.length > 0 ? movingMass.reduce((a, b) => a + b, 0) / movingMass.length : 0,
    },
  };
}

