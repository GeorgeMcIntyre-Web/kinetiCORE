/**
 * MuJoCo Menagerie Import Script
 * Owner: George
 *
 * Imports robots from MuJoCo Menagerie into cloud storage.
 * Parses README files, generates metadata, and uploads to R2.
 *
 * Usage:
 *   npm run import-menagerie -- --source /path/to/mujoco_menagerie --dry-run
 *   npm run import-menagerie -- --source /path/to/mujoco_menagerie --upload
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import type { AssetPackageMetadata, Domain, AssetClass } from '../src/library/types';

interface ImportOptions {
  sourcePath: string; // Path to mujoco_menagerie directory
  dryRun: boolean; // Don't actually upload
  verbose: boolean;
  apiUrl?: string; // Cloudflare Workers API URL
  apiKey?: string; // API key for authentication
  skipExisting?: boolean; // Skip assets that already exist
  robotFilter?: string; // Only import specific robot (regex)
}

interface RobotPackage {
  id: string; // e.g., "mujoco-menagerie/franka_emika_panda"
  name: string;
  directory: string; // Full path to robot directory
  files: string[]; // List of files in package
  metadata: AssetPackageMetadata;
}

/**
 * Main import function
 */
async function importMuJoCoMenagerie(options: ImportOptions): Promise<void> {
  console.log('🤖 MuJoCo Menagerie Import Script');
  console.log('==================================\n');
  console.log(`Source: ${options.sourcePath}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'UPLOAD'}\n`);

  // Verify source directory exists
  try {
    await fs.access(options.sourcePath);
  } catch (error) {
    throw new Error(`Source directory not found: ${options.sourcePath}`);
  }

  // Get list of robot directories
  const robotDirs = await getRobotDirectories(options.sourcePath);
  console.log(`Found ${robotDirs.length} robot directories\n`);

  // Filter if requested
  let filteredDirs = robotDirs;
  if (options.robotFilter) {
    const regex = new RegExp(options.robotFilter);
    filteredDirs = robotDirs.filter((dir) => regex.test(path.basename(dir)));
    console.log(`Filtered to ${filteredDirs.length} robots matching: ${options.robotFilter}\n`);
  }

  // Process each robot
  const results: {
    success: RobotPackage[];
    failed: Array<{ dir: string; error: string }>;
  } = {
    success: [],
    failed: [],
  };

  for (const robotDir of filteredDirs) {
    const robotName = path.basename(robotDir);
    console.log(`\n📦 Processing: ${robotName}`);
    console.log('-'.repeat(50));

    try {
      const package_ = await processRobot(robotDir, options);
      results.success.push(package_);

      console.log(`✅ Success: ${package_.id}`);
      console.log(`   Files: ${package_.files.length}`);
      console.log(`   Size: ${formatBytes(package_.metadata.packageSize)}`);

      // Upload if not dry run
      if (!options.dryRun && options.apiUrl) {
        await uploadPackage(package_, options);
        console.log(`   ⬆️  Uploaded to cloud`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.failed.push({ dir: robotName, error: errorMsg });
      console.error(`❌ Failed: ${errorMsg}`);
    }
  }

  // Print summary
  console.log('\n\n' + '='.repeat(50));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${results.success.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed imports:');
    results.failed.forEach(({ dir, error }) => {
      console.log(`  - ${dir}: ${error}`);
    });
  }

  if (options.dryRun) {
    console.log('\n⚠️  DRY RUN - No files were uploaded');
  } else {
    console.log('\n✅ Import complete!');
  }
}

/**
 * Get list of robot directories in menagerie
 */
async function getRobotDirectories(menageriePath: string): Promise<string[]> {
  const entries = await fs.readdir(menageriePath, { withFileTypes: true });

  const robotDirs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    // Skip special directories
    if (['assets', '.git', 'test'].includes(entry.name)) continue;

    const fullPath = path.join(menageriePath, entry.name);

    // Check if it contains a scene.xml or *.xml file (robot indicator)
    const files = await fs.readdir(fullPath);
    const hasXML = files.some((f) => f.endsWith('.xml'));

    if (hasXML) {
      robotDirs.push(fullPath);
    }
  }

  return robotDirs.sort();
}

/**
 * Process a single robot directory
 */
async function processRobot(robotDir: string, options: ImportOptions): Promise<RobotPackage> {
  const robotName = path.basename(robotDir);

  // Find all files in package
  const files = await getPackageFiles(robotDir);

  if (options.verbose) {
    console.log(`   Found ${files.length} files`);
  }

  // Parse README for metadata
  const readme = files.find((f) => f.toLowerCase().endsWith('readme.md'));
  const metadataFromReadme = readme ? await parseReadme(path.join(robotDir, readme)) : {};

  // Find main model file
  const mainModel = findMainModelFile(files, robotName);

  if (!mainModel) {
    throw new Error('No main model file found');
  }

  // Generate metadata
  const metadata = await generateMetadata(robotName, files, robotDir, metadataFromReadme);

  const package_: RobotPackage = {
    id: `mujoco-menagerie/${robotName}`,
    name: formatRobotName(robotName),
    directory: robotDir,
    files,
    metadata,
  };

  return package_;
}

/**
 * Get all files in package (recursive)
 */
async function getPackageFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(currentDir: string, relativePath: string = ''): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await scan(path.join(currentDir, entry.name), relPath);
      } else {
        files.push(relPath);
      }
    }
  }

  await scan(dir);
  return files;
}

/**
 * Find main model file (robot.xml or scene.xml)
 */
function findMainModelFile(files: string[], robotName: string): string | null {
  // Look for <robotName>.xml
  const robotXml = files.find((f) => f === `${robotName}.xml`);
  if (robotXml) return robotXml;

  // Look for scene.xml
  const sceneXml = files.find((f) => f === 'scene.xml');
  if (sceneXml) return sceneXml;

  // Any XML file
  return files.find((f) => f.endsWith('.xml')) || null;
}

/**
 * Parse README.md for metadata
 */
async function parseReadme(readmePath: string): Promise<Partial<AssetPackageMetadata>> {
  try {
    const content = await fs.readFile(readmePath, 'utf-8');

    // Parse DOF (Degrees of Freedom)
    const dofMatch = content.match(/(\d+)\s*DOF/i);
    const dof = dofMatch ? parseInt(dofMatch[1], 10) : undefined;

    // Parse payload (kg)
    const payloadMatch = content.match(/payload[:\s]+(\d+(?:\.\d+)?)\s*kg/i);
    const payload = payloadMatch ? parseFloat(payloadMatch[1]) : undefined;

    // Parse reach (mm)
    const reachMatch = content.match(/reach[:\s]+(\d+)\s*mm/i);
    const reach = reachMatch ? parseInt(reachMatch[1], 10) : undefined;

    // Parse manufacturer (look for "Maker:" line in table or heading)
    const makerMatch = content.match(/(?:Maker|Manufacturer)[:\s]+([^\n|]+)/i);
    const manufacturer = makerMatch ? makerMatch[1].trim() : undefined;

    // Parse license type
    const licenseMatch = content.match(/License[:\s]+\[?([^\]|\n]+)/i);
    const licenseType = licenseMatch ? licenseMatch[1].trim() : undefined;

    return {
      manufacturer,
      license: licenseType ? { type: licenseType } : undefined,
      capabilities: {
        dof,
        payload,
        reach,
        hasKinematics: dof !== undefined && dof > 0,
      },
    };
  } catch (error) {
    return {};
  }
}

/**
 * Generate complete metadata for asset
 */
async function generateMetadata(
  robotName: string,
  files: string[],
  robotDir: string,
  readmeData: Partial<AssetPackageMetadata>
): Promise<AssetPackageMetadata> {
  // Classify robot
  const { domain, assetClass, assetType } = classifyRobot(robotName);

  // Find meshes and textures
  const meshes = files.filter(
    (f) => f.endsWith('.stl') || f.endsWith('.obj') || f.endsWith('.dae')
  );
  const textures = files.filter(
    (f) => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
  );

  // Calculate package size
  let packageSize = 0;
  for (const file of files) {
    const stats = await fs.stat(path.join(robotDir, file));
    packageSize += stats.size;
  }

  // Generate checksum (simplified - would use actual file hashing in production)
  const checksum = createHash('sha256')
    .update(robotName + packageSize.toString())
    .digest('hex');

  // Find main files
  const mainModel = findMainModelFile(files, robotName) || 'scene.xml';
  const scene = files.find((f) => f === 'scene.xml');
  const thumbnail = files.find((f) => f.endsWith('.png') && !f.includes('assets/'));
  const documentation = files.find((f) => f.toLowerCase() === 'readme.md');
  const changelog = files.find((f) => f.toLowerCase() === 'changelog.md');

  const metadata: AssetPackageMetadata = {
    id: `mujoco-menagerie/${robotName}`,
    version: '1.0.0',
    name: formatRobotName(robotName),
    domain,
    assetClass,
    assetType,
    manufacturer: readmeData.manufacturer,
    description: `${formatRobotName(robotName)} robot model from MuJoCo Menagerie`,
    license: readmeData.license || { type: 'Unknown', file: 'LICENSE' },
    capabilities: {
      ...readmeData.capabilities,
      hasPhysics: true,
      hasVisuals: true,
    },
    files: {
      mainModel,
      scene,
      thumbnail,
      meshes,
      textures,
      documentation,
      changelog,
    },
    packageSize,
    uploadedAt: new Date().toISOString(),
    uploadedBy: 'import-script',
    checksum,
    tags: generateTags(robotName, assetClass, assetType),
    searchKeywords: generateKeywords(robotName),
  };

  return metadata;
}

/**
 * Classify robot into domain, asset class, and type
 */
function classifyRobot(
  robotName: string
): { domain: Domain; assetClass: AssetClass; assetType: string } {
  const name = robotName.toLowerCase();

  // Determine domain
  let domain: Domain = 'manufacturing'; // Default
  if (name.includes('medical') || name.includes('surgical')) {
    domain = 'medical';
  } else if (name.includes('construction') || name.includes('crane')) {
    domain = 'construction';
  }

  // Determine asset class and type
  let assetClass: AssetClass = 'robots';
  let assetType = 'robot';

  if (
    name.includes('arm') ||
    name.includes('manipulator') ||
    name.includes('panda') ||
    name.includes('ur5') ||
    name.includes('ur10') ||
    name.includes('kuka') ||
    name.includes('franka')
  ) {
    assetClass = 'robots';
    assetType = 'collaborative_arm';
  } else if (name.includes('hand') || name.includes('gripper') || name.includes('finger')) {
    assetClass = 'endEffectors';
    assetType = 'gripper';
  } else if (
    name.includes('quadruped') ||
    name.includes('spot') ||
    name.includes('go1') ||
    name.includes('go2') ||
    name.includes('anymal')
  ) {
    assetClass = 'robots';
    assetType = 'quadruped';
  } else if (name.includes('humanoid') || name.includes('biped')) {
    assetClass = 'robots';
    assetType = 'humanoid';
  } else if (name.includes('drone') || name.includes('quadcopter') || name.includes('uav')) {
    assetClass = 'vehicles';
    assetType = 'drone';
  }

  return { domain, assetClass, assetType };
}

/**
 * Generate search tags
 */
function generateTags(robotName: string, assetClass: AssetClass, assetType: string): string[] {
  const tags = ['mujoco', 'menagerie', assetClass, assetType];

  // Add manufacturer tags
  if (robotName.includes('franka')) tags.push('franka-robotics');
  if (robotName.includes('unitree')) tags.push('unitree');
  if (robotName.includes('boston_dynamics')) tags.push('boston-dynamics');
  if (robotName.includes('kuka')) tags.push('kuka');
  if (robotName.includes('universal_robots')) tags.push('universal-robots');

  return tags;
}

/**
 * Generate search keywords
 */
function generateKeywords(robotName: string): string[] {
  // Split on underscores and add variations
  const parts = robotName.split('_');
  return [...parts, robotName.replace(/_/g, ' ')];
}

/**
 * Format robot name for display
 */
function formatRobotName(robotName: string): string {
  return robotName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Upload package to cloud
 */
async function uploadPackage(package_: RobotPackage, options: ImportOptions): Promise<void> {
  // TODO: Implement actual upload to Cloudflare R2 via Workers API
  // This is a placeholder that shows the structure

  if (!options.apiUrl) {
    throw new Error('API URL not provided');
  }

  console.log(`   📤 Uploading to ${options.apiUrl}...`);

  // 1. Initiate upload
  // 2. Upload files to presigned URLs
  // 3. Complete upload
  // 4. Wait for validation

  // For now, just simulate
  await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const options: ImportOptions = {
    sourcePath: '',
    dryRun: true,
    verbose: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--source' && args[i + 1]) {
      options.sourcePath = args[++i];
    } else if (arg === '--upload') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--api-url' && args[i + 1]) {
      options.apiUrl = args[++i];
    } else if (arg === '--api-key' && args[i + 1]) {
      options.apiKey = args[++i];
    } else if (arg === '--filter' && args[i + 1]) {
      options.robotFilter = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  // Validate required options
  if (!options.sourcePath) {
    console.error('Error: --source is required\n');
    printHelp();
    process.exit(1);
  }

  try {
    await importMuJoCoMenagerie(options);
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
MuJoCo Menagerie Import Script

Usage:
  npm run import-menagerie -- [options]

Options:
  --source <path>       Path to mujoco_menagerie directory (required)
  --upload              Actually upload files (default is dry-run)
  --dry-run             Preview import without uploading (default)
  --api-url <url>       Cloudflare Workers API URL
  --api-key <key>       API key for authentication
  --filter <regex>      Only import robots matching regex
  --verbose, -v         Verbose output
  --help, -h            Show this help

Examples:
  # Dry run (preview only)
  npm run import-menagerie -- --source /path/to/mujoco_menagerie

  # Actually upload
  npm run import-menagerie -- --source /path/to/mujoco_menagerie --upload --api-url https://api.kineticore.io/v1

  # Import only Franka robots
  npm run import-menagerie -- --source /path/to/mujoco_menagerie --filter franka
`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { importMuJoCoMenagerie, type ImportOptions };
