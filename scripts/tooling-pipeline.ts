// scripts/tooling-pipeline.ts
//
// Usage:
//   npx tsx scripts/tooling-pipeline.ts "C:/path/to/fixture.glb" [optional: "C:/path/to/fixture.json"]
//
// Orchestrates the full tooling analysis pipeline:
//   1. Tree inspector
//   2. Rigid clusters
//   3. Joint segmentation (if JSON provided)
//   4. Unit builder
//
// Outputs a pipeline manifest JSON with all generated files.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FordFidesJointAdapter, TmsNxJointAdapter, type JointAdapter } from '../src/dev/tooling/JointAdapters';
import { ToolingStructureAnalyzer } from '../src/dev/tooling/ToolingStructureAnalyzer';
import type { ToolingMetadata } from '../src/dev/tooling/JointAdapters';

interface PipelineManifest {
  fixture: string;
  glb: string;
  jointsJson?: string;
  selectedAdapter?: string;
  steps: {
    treeInspector?: string;
    rigidClusters?: string;
    jointSegmentation?: string;
    units?: string;
    unitFeatures?: string;
  };
  timestamp: string;
  success: boolean;
  errors?: string[];
}

const glbPath = process.argv[2];
const jointsJsonPath = process.argv[3];

if (!glbPath) {
  console.error('Usage: npx tsx scripts/tooling-pipeline.ts <path-to-glb> [optional: path-to-joints-json]');
  process.exit(1);
}

run().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});

async function run() {
  if (!fs.existsSync(glbPath)) {
    console.error('GLB not found:', glbPath);
    process.exit(1);
  }

  const fixtureName = path.basename(glbPath, path.extname(glbPath));
  const baseDir = path.dirname(glbPath);
  const manifest: PipelineManifest = {
    fixture: fixtureName,
    glb: glbPath,
    steps: {},
    timestamp: new Date().toISOString(),
    success: false,
    errors: [],
  };

  if (jointsJsonPath) {
    if (!fs.existsSync(jointsJsonPath)) {
      console.error('Joints JSON not found:', jointsJsonPath);
      process.exit(1);
    }
    manifest.jointsJson = jointsJsonPath;
  }

  console.log('===========================================================');
  console.log(' TOOLING PIPELINE');
  console.log('===========================================================');
  console.log(`Fixture: ${fixtureName}`);
  console.log(`GLB: ${glbPath}`);
  if (jointsJsonPath) {
    console.log(`Joints JSON: ${jointsJsonPath}`);
  }
  console.log('');

  try {
    // Step 1: Tree Inspector
    const treeOutputPath = path.join(baseDir, `${fixtureName}_tree_output.txt`);
    const treeNeedsRun = !fs.existsSync(treeOutputPath);
    
    if (treeNeedsRun) {
      console.log('[1/4] Running tree inspector...');
      await runTreeInspector(glbPath);
      if (fs.existsSync(treeOutputPath)) {
        manifest.steps.treeInspector = treeOutputPath;
        console.log(`  ✓ Tree output: ${treeOutputPath}`);
      }
    } else {
      console.log('[1/4] Tree inspector output exists, skipping');
      manifest.steps.treeInspector = treeOutputPath;
    }

    // Step 2: Rigid Clusters
    const clustersPath = path.join(baseDir, `${fixtureName}.rigid-clusters.json`);
    const clustersNeedsRun = !fs.existsSync(clustersPath);
    
    if (clustersNeedsRun) {
      console.log('[2/4] Running rigid clusters...');
      await runRigidClusters(glbPath);
      if (fs.existsSync(clustersPath)) {
        manifest.steps.rigidClusters = clustersPath;
        console.log(`  ✓ Clusters: ${clustersPath}`);
      }
    } else {
      console.log('[2/4] Rigid clusters exist, skipping');
      manifest.steps.rigidClusters = clustersPath;
    }

    // Step 3: Auto-detect adapter and run joint segmentation (if JSON provided)
    if (jointsJsonPath) {
      const jointsPath = path.join(baseDir, `${fixtureName}.joint-segmentation.json`);
      const jointsNeedsRun = !fs.existsSync(jointsPath);
      
      if (jointsNeedsRun) {
        // Auto-detect adapter
        const adapter = await detectAdapter(fixtureName, glbPath, baseDir, jointsJsonPath);
        if (adapter) {
          manifest.selectedAdapter = adapter.id;
          console.log(`[3/4] Detected adapter: ${adapter.id}`);
        } else {
          console.log('[3/4] No adapter detected, using default joint segmentation');
        }

        console.log('[3/4] Running joint segmentation...');
        await runJointSegmentation(glbPath, jointsJsonPath);
        if (fs.existsSync(jointsPath)) {
          manifest.steps.jointSegmentation = jointsPath;
          console.log(`  ✓ Joint segmentation: ${jointsPath}`);
        }
      } else {
        console.log('[3/4] Joint segmentation exists, skipping');
        manifest.steps.jointSegmentation = jointsPath;
        
        // Still try to detect adapter for manifest
        const adapter = await detectAdapter(fixtureName, glbPath, baseDir, jointsJsonPath);
        if (adapter) {
          manifest.selectedAdapter = adapter.id;
        }
      }
    } else {
      console.log('[3/4] Skipping joint segmentation (no JSON provided)');
    }

    // Step 4: Unit Builder (requires clusters + joints)
    if (manifest.steps.rigidClusters && manifest.steps.jointSegmentation) {
      const unitsPath = path.join(baseDir, `${fixtureName}.units.json`);
      const featuresPath = path.join(baseDir, `${fixtureName}.unit-features.json`);
      const unitsNeedsRun = !fs.existsSync(unitsPath) || !fs.existsSync(featuresPath);
      
      if (unitsNeedsRun) {
        console.log('[4/4] Running unit builder...');
        await runUnitBuilder(glbPath);
        if (fs.existsSync(unitsPath)) {
          manifest.steps.units = unitsPath;
          console.log(`  ✓ Units: ${unitsPath}`);
        }
        if (fs.existsSync(featuresPath)) {
          manifest.steps.unitFeatures = featuresPath;
          console.log(`  ✓ Unit features: ${featuresPath}`);
        }
      } else {
        console.log('[4/4] Units exist, skipping');
        manifest.steps.units = unitsPath;
        manifest.steps.unitFeatures = featuresPath;
      }
    } else {
      console.log('[4/4] Skipping unit builder (missing clusters or joints)');
      if (!manifest.steps.rigidClusters) {
        manifest.errors?.push('Missing rigid clusters JSON');
      }
      if (!manifest.steps.jointSegmentation) {
        manifest.errors?.push('Missing joint segmentation JSON');
      }
    }

    manifest.success = manifest.errors?.length === 0;
    
    // Write manifest
    const manifestPath = path.join(baseDir, `${fixtureName}.pipeline-manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('');
    console.log('===========================================================');
    console.log(' PIPELINE COMPLETE');
    console.log('===========================================================');
    console.log(`Manifest: ${manifestPath}`);
    console.log(`Success: ${manifest.success}`);
    if (manifest.selectedAdapter) {
      console.log(`Adapter: ${manifest.selectedAdapter}`);
    }
    if (manifest.errors && manifest.errors.length > 0) {
      console.log(`Warnings: ${manifest.errors.length}`);
      manifest.errors.forEach(err => console.log(`  - ${err}`));
    }
  } catch (err) {
    manifest.success = false;
    const errorMsg = err instanceof Error ? err.message : String(err);
    manifest.errors?.push(errorMsg);
    
    const manifestPath = path.join(baseDir, `${fixtureName}.pipeline-manifest.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    
    throw err;
  }
}

async function runTreeInspector(glbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Quote path to handle spaces when using shell: true
    const quotedPath = glbPath.includes(' ') ? `"${glbPath}"` : glbPath;
    const proc = spawn('npx', ['tsx', 'scripts/tooling-tree-inspector.ts', quotedPath], {
      stdio: 'inherit',
      shell: true,
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Tree inspector exited with code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function runRigidClusters(glbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Quote path to handle spaces when using shell: true
    const quotedPath = glbPath.includes(' ') ? `"${glbPath}"` : glbPath;
    const proc = spawn('npx', ['tsx', 'scripts/tooling-rigid-clusters.ts', quotedPath], {
      stdio: 'inherit',
      shell: true,
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Rigid clusters exited with code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function runJointSegmentation(glbPath: string, jointsJsonPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Quote paths to handle spaces when using shell: true
    const quotedGlbPath = glbPath.includes(' ') ? `"${glbPath}"` : glbPath;
    const quotedJointsPath = jointsJsonPath.includes(' ') ? `"${jointsJsonPath}"` : jointsJsonPath;
    const proc = spawn('npx', ['tsx', 'scripts/tooling-joint-segmentation.ts', quotedGlbPath, quotedJointsPath], {
      stdio: 'inherit',
      shell: true,
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Joint segmentation exited with code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function runUnitBuilder(glbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Quote path to handle spaces when using shell: true
    const quotedPath = glbPath.includes(' ') ? `"${glbPath}"` : glbPath;
    const proc = spawn('npx', ['tsx', 'scripts/tooling-unit-builder.ts', quotedPath], {
      stdio: 'inherit',
      shell: true,
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Unit builder exited with code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Auto-detect which joint adapter to use for this fixture.
 * Returns the first adapter that can handle the fixture, or null if none match.
 */
async function detectAdapter(
  fixtureId: string,
  glbPath: string,
  baseDir: string,
  jointsJsonPath: string,
): Promise<JointAdapter | null> {
  // Try to load structure profile if available
  let structureProfile;
  const profilePath = path.join(baseDir, `${fixtureId}.structure-profile.json`);
  if (fs.existsSync(profilePath)) {
    try {
      const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      structureProfile = profileData;
    } catch {
      // Profile exists but couldn't parse - that's okay
    }
  }

  // If no profile exists, try to generate one quickly (just clusters needed)
  if (!structureProfile) {
    const clustersPath = path.join(baseDir, `${fixtureId}.rigid-clusters.json`);
    if (fs.existsSync(clustersPath)) {
      try {
        structureProfile = await ToolingStructureAnalyzer.analyzeFromPipeline(fixtureId, baseDir);
      } catch {
        // Analysis failed - continue without profile
      }
    }
  }

  // Build metadata
  const auxJsonPaths: string[] = [];
  if (jointsJsonPath && fs.existsSync(jointsJsonPath)) {
    auxJsonPaths.push(jointsJsonPath);
  }

  // Also check for JSON files in same directory with similar name
  const baseName = path.basename(glbPath, '.glb');
  const dirFiles = fs.readdirSync(baseDir);
  dirFiles.forEach(file => {
    if (file.endsWith('.json') && file.startsWith(baseName)) {
      const fullPath = path.join(baseDir, file);
      if (fullPath !== jointsJsonPath && !auxJsonPaths.includes(fullPath)) {
        auxJsonPaths.push(fullPath);
      }
    }
  });

  const metadata: ToolingMetadata = {
    fixtureId,
    glbPath,
    auxJsonPaths,
    structureProfile,
  };

  // Try each adapter
  const adapters: JointAdapter[] = [
    new FordFidesJointAdapter(),
    new TmsNxJointAdapter(),
  ];

  for (const adapter of adapters) {
    if (adapter.canHandle(metadata)) {
      return adapter;
    }
  }

  return null;
}

