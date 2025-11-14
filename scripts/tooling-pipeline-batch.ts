// scripts/tooling-pipeline-batch.ts
//
// Usage:
//   npx tsx scripts/tooling-pipeline-batch.ts "C:/path/to/fixtures/folder"
//
// Recursively finds all .glb files in the folder and runs the full pipeline on each.
// Outputs an aggregate batch manifest with all fixtures processed.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

interface FixtureResult {
  fixtureId: string;
  glbPath: string;
  jointsJsonPath?: string;
  success: boolean;
  selectedAdapter?: string;
  errors: string[];
  invariantsOk?: boolean;
  invariantReason?: string;
  generatedFiles: {
    treeInspector?: string;
    rigidClusters?: string;
    jointSegmentation?: string;
    units?: string;
    unitFeatures?: string;
    structureProfile?: string;
    pipelineManifest?: string;
  };
}

interface BatchManifest {
  timestamp: string;
  rootFolder: string;
  fixtures: FixtureResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    adapters: Record<string, number>;
    invariantsOk: number;
    invariantsFailed: number;
  };
}

const rootFolder = process.argv[2];

if (!rootFolder) {
  console.error('Usage: npx tsx scripts/tooling-pipeline-batch.ts <path-to-fixtures-folder>');
  process.exit(1);
}

run().catch(err => {
  console.error('Batch pipeline failed:', err);
  process.exit(1);
});

async function run() {
  if (!fs.existsSync(rootFolder)) {
    console.error('Folder not found:', rootFolder);
    process.exit(1);
  }

  const stat = fs.statSync(rootFolder);
  if (!stat.isDirectory()) {
    console.error('Path is not a directory:', rootFolder);
    process.exit(1);
  }

  console.log('===========================================================');
  console.log(' TOOLING PIPELINE BATCH');
  console.log('===========================================================');
  console.log(`Root folder: ${rootFolder}`);
  console.log('');

  const glbFiles = findGlbFiles(rootFolder);
  console.log(`Found ${glbFiles.length} GLB files`);
  console.log('');

  const results: FixtureResult[] = [];

  for (let i = 0; i < glbFiles.length; i += 1) {
    const glbPath = glbFiles[i];
    const fixtureId = path.basename(glbPath, '.glb');
    
    console.log(`[${i + 1}/${glbFiles.length}] Processing: ${fixtureId}`);
    
    const result = await processFixture(glbPath);
    results.push(result);

    if (result.success) {
      console.log(`  ✓ Success (adapter: ${result.selectedAdapter || 'none'})`);
    } else {
      console.log(`  ✗ Failed: ${result.errors.join(', ')}`);
    }
    console.log('');
  }

  // Write batch manifest
  const adapters: Record<string, number> = {};
  results.forEach(r => {
    if (r.selectedAdapter) {
      adapters[r.selectedAdapter] = (adapters[r.selectedAdapter] || 0) + 1;
    }
  });

  const invariantsOk = results.filter(r => r.invariantsOk === true).length;
  const invariantsFailed = results.filter(r => r.invariantsOk === false).length;

  const batchManifest: BatchManifest = {
    timestamp: new Date().toISOString(),
    rootFolder,
    fixtures: results,
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      adapters,
      invariantsOk,
      invariantsFailed,
    },
  };

  const manifestPath = path.join(rootFolder, 'tooling-pipeline-batch.manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(batchManifest, null, 2), 'utf8');

  console.log('===========================================================');
  console.log(' BATCH COMPLETE');
  console.log('===========================================================');
  console.log(`Total fixtures: ${batchManifest.summary.total}`);
  console.log(`Successful: ${batchManifest.summary.successful}`);
  console.log(`Failed: ${batchManifest.summary.failed}`);
  console.log(`Invariants: ${batchManifest.summary.invariantsOk} OK, ${batchManifest.summary.invariantsFailed} failed`);
  console.log(`Adapters:`);
  Object.entries(adapters).forEach(([adapter, count]) => {
    console.log(`  ${adapter}: ${count}`);
  });
  console.log(`\nBatch manifest: ${manifestPath}`);
}

function findGlbFiles(dir: string): string[] {
  const glbFiles: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  entries.forEach(entry => {
    if (entry.isFile() && entry.name.endsWith('.glb')) {
      glbFiles.push(path.join(dir, entry.name));
    } else if (entry.isDirectory()) {
      const subFiles = findGlbFiles(path.join(dir, entry.name));
      glbFiles.push(...subFiles);
    }
  });

  return glbFiles;
}

async function processFixture(glbPath: string): Promise<FixtureResult> {
  const fixtureId = path.basename(glbPath, '.glb');
  const baseDir = path.dirname(glbPath);
  
  const result: FixtureResult = {
    fixtureId,
    glbPath,
    success: false,
    errors: [],
    generatedFiles: {},
  };

  try {
    // Find joints JSON (same name as GLB)
    const jointsJsonPath = path.join(baseDir, `${fixtureId}.json`);
    const hasJointsJson = fs.existsSync(jointsJsonPath);
    
    if (hasJointsJson) {
      result.jointsJsonPath = jointsJsonPath;
    }

    // Run pipeline
    const args = ['tsx', 'scripts/tooling-pipeline.ts', glbPath];
    if (hasJointsJson) {
      args.push(jointsJsonPath);
    }

    await runCommand('npx', args);

    // Load pipeline manifest to get results
    const manifestPath = path.join(baseDir, `${fixtureId}.pipeline-manifest.json`);
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      result.success = manifest.success === true;
      result.selectedAdapter = manifest.selectedAdapter;
      result.errors = manifest.errors || [];
      result.generatedFiles = {
        treeInspector: manifest.steps?.treeInspector,
        rigidClusters: manifest.steps?.rigidClusters,
        jointSegmentation: manifest.steps?.jointSegmentation,
        units: manifest.steps?.units,
        unitFeatures: manifest.steps?.unitFeatures,
        pipelineManifest: manifestPath,
      };

      // Check invariants if units.json exists
      if (result.generatedFiles.units && fs.existsSync(result.generatedFiles.units)) {
        try {
          const { checkUnitBuilderInvariants } = await import('../src/dev/tooling/PipelineInvariants');
          const unitsData = JSON.parse(fs.readFileSync(result.generatedFiles.units, 'utf8'));
          const clustersPath = result.generatedFiles.rigidClusters;
          if (clustersPath && fs.existsSync(clustersPath)) {
            const clusters = JSON.parse(fs.readFileSync(clustersPath, 'utf8'));
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
            } else {
              result.invariantsOk = true;
            }
          }
        } catch (err) {
          // Invariant check failed, but don't fail the whole pipeline
          result.invariantsOk = false;
          result.invariantReason = err instanceof Error ? err.message : String(err);
        }
      }
    } else {
      result.errors.push('Pipeline manifest not found after run');
    }

    // Check for structure profile (may be generated separately)
    const profilePath = path.join(baseDir, `${fixtureId}.structure-profile.json`);
    if (fs.existsSync(profilePath)) {
      result.generatedFiles.structureProfile = profilePath;
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

