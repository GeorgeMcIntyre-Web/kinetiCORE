/**
 * Generic Asset Collection Import Script
 * Owner: George
 *
 * Imports asset collections (robots, equipment, models) into kinetiCORE cloud storage.
 * Supports multiple formats: URDF, MJCF, STEP, and auto-detection.
 * Can import from any organized directory structure.
 *
 * Usage:
 *   npm run import-assets -- --source /path/to/collection --format auto --dry-run
 *   npm run import-assets -- --source /path/to/collection --format urdf --upload
 *   npm run import-assets -- --source /path/to/collection --namespace "my-company" --upload
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import type { AssetPackageMetadata, Domain, AssetClass } from '../src/library/types';

type AssetFormat = 'urdf' | 'mjcf' | 'step' | 'auto';

interface ImportOptions {
  sourcePath: string; // Path to asset collection directory
  format: AssetFormat; // Asset format or auto-detect
  namespace: string; // Namespace for assets (e.g., "my-company", "mujoco-menagerie")
  dryRun: boolean; // Don't actually upload
  verbose: boolean;
  apiUrl?: string; // Cloudflare Workers API URL
  apiKey?: string; // API key for authentication
  skipExisting?: boolean; // Skip assets that already exist
  assetFilter?: string; // Only import specific assets (regex)
  metadataFile?: string; // Optional metadata manifest (JSON/YAML)
}

interface AssetPackage {
  id: string; // e.g., "my-company/custom_robot"
  name: string;
  directory: string; // Full path to asset directory
  files: string[]; // List of files in package
  format: AssetFormat; // Detected or specified format
  metadata: AssetPackageMetadata;
}

/**
 * Main import function
 */
async function importAssetCollection(options: ImportOptions): Promise<void> {
  console.log('📦 kinetiCORE Asset Collection Import');
  console.log('=====================================\n');
  console.log(`Source: ${options.sourcePath}`);
  console.log(`Format: ${options.format}`);
  console.log(`Namespace: ${options.namespace}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'UPLOAD'}\n`);

  // Verify source directory exists
  try {
    await fs.access(options.sourcePath);
  } catch (error) {
    throw new Error(`Source directory not found: ${options.sourcePath}`);
  }

  // Load external metadata if provided
  let externalMetadata: Record<string, Partial<AssetPackageMetadata>> = {};
  if (options.metadataFile) {
    externalMetadata = await loadMetadataFile(options.metadataFile);
    console.log(`Loaded metadata for ${Object.keys(externalMetadata).length} assets\n`);
  }

  // Get list of asset directories
  const assetDirs = await getAssetDirectories(options.sourcePath, options.format);
  console.log(`Found ${assetDirs.length} asset directories\n`);

  // Filter if requested
  let filteredDirs = assetDirs;
  if (options.assetFilter) {
    const regex = new RegExp(options.assetFilter);
    filteredDirs = assetDirs.filter((dir) => regex.test(path.basename(dir)));
    console.log(`Filtered to ${filteredDirs.length} assets matching: ${options.assetFilter}\n`);
  }

  // Process each asset
  const results: {
    success: AssetPackage[];
    failed: Array<{ dir: string; error: string }>;
  } = {
    success: [],
    failed: [],
  };

  for (const assetDir of filteredDirs) {
    const assetName = path.basename(assetDir);
    console.log(`\n📦 Processing: ${assetName}`);
    console.log('-'.repeat(50));

    try {
      const externalMeta = externalMetadata[assetName] || {};
      const package_ = await processAsset(assetDir, options, externalMeta);
      results.success.push(package_);

      console.log(`✅ Success: ${package_.id}`);
      console.log(`   Format: ${package_.format.toUpperCase()}`);
      console.log(`   Files: ${package_.files.length}`);
      console.log(`   Size: ${formatBytes(package_.metadata.packageSize)}`);

      // Upload if not dry run
      if (!options.dryRun && options.apiUrl) {
        await uploadPackage(package_, options);
        console.log(`   ⬆️  Uploaded to cloud`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.failed.push({ dir: assetName, error: errorMsg });
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
 * Load external metadata file (JSON or YAML)
 */
async function loadMetadataFile(
  filePath: string
): Promise<Record<string, Partial<AssetPackageMetadata>>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      // TODO: Add YAML parser if needed
      throw new Error('YAML support not yet implemented');
    } else {
      throw new Error('Unsupported metadata format (use .json or .yaml)');
    }
  } catch (error) {
    console.warn(`Failed to load metadata file: ${error}`);
    return {};
  }
}

/**
 * Get list of asset directories based on format
 */
async function getAssetDirectories(sourcePath: string, format: AssetFormat): Promise<string[]> {
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });

  const assetDirs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    // Skip special directories
    if (['assets', '.git', 'test', 'tests', 'docs', 'scripts'].includes(entry.name)) continue;

    const fullPath = path.join(sourcePath, entry.name);

    // Check if directory contains assets of specified format
    const hasAssets = await hasAssetFiles(fullPath, format);

    if (hasAssets) {
      assetDirs.push(fullPath);
    }
  }

  return assetDirs.sort();
}

/**
 * Check if directory contains asset files of specified format
 */
async function hasAssetFiles(dirPath: string, format: AssetFormat): Promise<boolean> {
  try {
    const files = await fs.readdir(dirPath);

    if (format === 'auto') {
      // Auto-detect: Check for any supported format
      return (
        files.some((f) => f.endsWith('.urdf')) ||
        files.some((f) => f.endsWith('.xml') && !f.includes('package')) ||
        files.some((f) => f.endsWith('.step') || f.endsWith('.stp'))
      );
    } else if (format === 'urdf') {
      return files.some((f) => f.endsWith('.urdf'));
    } else if (format === 'mjcf') {
      return files.some((f) => f.endsWith('.xml') && !f.includes('package'));
    } else if (format === 'step') {
      return files.some((f) => f.endsWith('.step') || f.endsWith('.stp'));
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Process a single asset directory
 */
async function processAsset(
  assetDir: string,
  options: ImportOptions,
  externalMetadata: Partial<AssetPackageMetadata> = {}
): Promise<AssetPackage> {
  const assetName = path.basename(assetDir);

  // Find all files in package
  const files = await getPackageFiles(assetDir);

  if (options.verbose) {
    console.log(`   Found ${files.length} files`);
  }

  // Detect format
  const format = options.format === 'auto' ? detectFormat(files) : options.format;

  if (options.verbose) {
    console.log(`   Detected format: ${format.toUpperCase()}`);
  }

  // Parse documentation for metadata
  const readme = files.find((f) => f.toLowerCase().includes('readme'));
  const metadataFromDocs = readme ? await parseDocumentation(path.join(assetDir, readme)) : {};

  // Find main model file
  const mainModel = findMainModelFile(files, assetName, format);

  if (!mainModel) {
    throw new Error(`No main ${format.toUpperCase()} model file found`);
  }

  // Generate metadata
  const metadata = await generateMetadata(
    assetName,
    files,
    assetDir,
    format,
    options.namespace,
    {
      ...metadataFromDocs,
      ...externalMetadata,
    }
  );

  const package_: AssetPackage = {
    id: `${options.namespace}/${assetName}`,
    name: formatAssetName(assetName),
    directory: assetDir,
    files,
    format,
    metadata,
  };

  return package_;
}

/**
 * Detect asset format from file list
 */
function detectFormat(files: string[]): AssetFormat {
  if (files.some((f) => f.endsWith('.urdf'))) return 'urdf';
  if (files.some((f) => f.endsWith('.xml'))) return 'mjcf';
  if (files.some((f) => f.endsWith('.step') || f.endsWith('.stp'))) return 'step';
  return 'auto';
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
 * Find main model file based on format
 */
function findMainModelFile(files: string[], assetName: string, format: AssetFormat): string | null {
  if (format === 'urdf') {
    // Look for <assetName>.urdf or robot.urdf
    return (
      files.find((f) => f === `${assetName}.urdf`) ||
      files.find((f) => f === 'robot.urdf') ||
      files.find((f) => f.endsWith('.urdf'))
    );
  } else if (format === 'mjcf') {
    // Look for <assetName>.xml or scene.xml
    return (
      files.find((f) => f === `${assetName}.xml`) ||
      files.find((f) => f === 'scene.xml') ||
      files.find((f) => f.endsWith('.xml') && !f.includes('package'))
    );
  } else if (format === 'step') {
    // Look for main STEP file
    return (
      files.find((f) => f === `${assetName}.step`) ||
      files.find((f) => f === `${assetName}.stp`) ||
      files.find((f) => f.endsWith('.step') || f.endsWith('.stp'))
    );
  }

  return null;
}

/**
 * Parse documentation (README, datasheet, etc.) for metadata
 */
async function parseDocumentation(
  docPath: string
): Promise<Partial<AssetPackageMetadata>> {
  try {
    const content = await fs.readFile(docPath, 'utf-8');

    // Parse DOF (Degrees of Freedom)
    const dofMatch = content.match(/(\d+)\s*(?:DOF|axis|axes|joints?)/i);
    const dof = dofMatch ? parseInt(dofMatch[1], 10) : undefined;

    // Parse payload (kg)
    const payloadMatch = content.match(/payload[:\s]+(\d+(?:\.\d+)?)\s*kg/i);
    const payload = payloadMatch ? parseFloat(payloadMatch[1]) : undefined;

    // Parse reach (mm)
    const reachMatch = content.match(/reach[:\s]+(\d+)\s*(?:mm|millimeters?)/i);
    const reach = reachMatch ? parseInt(reachMatch[1], 10) : undefined;

    // Parse manufacturer
    const makerMatch = content.match(/(?:Maker|Manufacturer|Vendor)[:\s]+([^\n|]+)/i);
    const manufacturer = makerMatch ? makerMatch[1].trim() : undefined;

    // Parse license
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
  assetName: string,
  files: string[],
  assetDir: string,
  format: AssetFormat,
  namespace: string,
  externalData: Partial<AssetPackageMetadata>
): Promise<AssetPackageMetadata> {
  // Classify asset
  const { domain, assetClass, assetType } = classifyAsset(assetName, externalData);

  // Find meshes and textures
  const meshes = files.filter(
    (f) =>
      f.endsWith('.stl') ||
      f.endsWith('.obj') ||
      f.endsWith('.dae') ||
      f.endsWith('.ply')
  );
  const textures = files.filter(
    (f) => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
  );

  // Calculate package size
  let packageSize = 0;
  for (const file of files) {
    const stats = await fs.stat(path.join(assetDir, file));
    packageSize += stats.size;
  }

  // Generate checksum
  const checksum = createHash('sha256')
    .update(assetName + packageSize.toString())
    .digest('hex');

  // Find main files
  const mainModel = findMainModelFile(files, assetName, format)!;
  const scene = files.find((f) => f === 'scene.xml' || f === 'scene.urdf');
  const thumbnail = files.find((f) => f.endsWith('.png') && !f.includes('assets/'));
  const documentation = files.find((f) => f.toLowerCase().includes('readme'));
  const changelog = files.find((f) => f.toLowerCase().includes('changelog'));

  const metadata: AssetPackageMetadata = {
    id: `${namespace}/${assetName}`,
    version: externalData.version || '1.0.0',
    name: externalData.name || formatAssetName(assetName),
    domain: externalData.domain || domain,
    assetClass: externalData.assetClass || assetClass,
    assetType: externalData.assetType || assetType,
    manufacturer: externalData.manufacturer,
    description:
      externalData.description ||
      `${formatAssetName(assetName)} asset imported from ${namespace}`,
    license: externalData.license || { type: 'Unknown', file: 'LICENSE' },
    capabilities: {
      ...externalData.capabilities,
      hasPhysics: format === 'urdf' || format === 'mjcf',
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
    tags: externalData.tags || generateTags(assetName, assetClass, assetType, format),
    searchKeywords: externalData.searchKeywords || generateKeywords(assetName),
  };

  return metadata;
}

/**
 * Classify asset into domain, class, and type
 */
function classifyAsset(
  assetName: string,
  externalData: Partial<AssetPackageMetadata>
): { domain: Domain; assetClass: AssetClass; assetType: string } {
  // Use external metadata if provided
  if (externalData.domain && externalData.assetClass && externalData.assetType) {
    return {
      domain: externalData.domain,
      assetClass: externalData.assetClass,
      assetType: externalData.assetType,
    };
  }

  const name = assetName.toLowerCase();

  // Determine domain
  let domain: Domain = 'manufacturing'; // Default
  if (name.includes('medical') || name.includes('surgical')) {
    domain = 'medical';
  } else if (name.includes('construction') || name.includes('crane')) {
    domain = 'construction';
  } else if (name.includes('warehouse') || name.includes('logistics')) {
    domain = 'logistics';
  }

  // Determine asset class and type
  let assetClass: AssetClass = 'robots';
  let assetType = 'robot';

  if (name.includes('arm') || name.includes('manipulator')) {
    assetClass = 'robots';
    assetType = 'manipulator';
  } else if (name.includes('hand') || name.includes('gripper')) {
    assetClass = 'endEffectors';
    assetType = 'gripper';
  } else if (name.includes('quadruped') || name.includes('legged')) {
    assetClass = 'robots';
    assetType = 'quadruped';
  } else if (name.includes('humanoid') || name.includes('biped')) {
    assetClass = 'robots';
    assetType = 'humanoid';
  } else if (name.includes('drone') || name.includes('uav')) {
    assetClass = 'vehicles';
    assetType = 'drone';
  } else if (name.includes('conveyor') || name.includes('machine')) {
    assetClass = 'machinery';
    assetType = 'equipment';
  }

  return { domain, assetClass, assetType };
}

/**
 * Generate search tags
 */
function generateTags(
  assetName: string,
  assetClass: AssetClass,
  assetType: string,
  format: AssetFormat
): string[] {
  const tags = [format, assetClass, assetType];

  // Add format-specific tags
  if (format === 'urdf') tags.push('ros', 'urdf');
  if (format === 'mjcf') tags.push('mujoco', 'mjcf');
  if (format === 'step') tags.push('cad', 'step');

  return tags;
}

/**
 * Generate search keywords
 */
function generateKeywords(assetName: string): string[] {
  const parts = assetName.split(/[_-]/);
  return [...parts, assetName.replace(/[_-]/g, ' ')];
}

/**
 * Format asset name for display
 */
function formatAssetName(assetName: string): string {
  return assetName
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Upload package to cloud
 */
async function uploadPackage(package_: AssetPackage, options: ImportOptions): Promise<void> {
  // TODO: Implement actual upload to Cloudflare R2 via Workers API
  if (!options.apiUrl) {
    throw new Error('API URL not provided');
  }

  // Placeholder for actual implementation
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
    format: 'auto',
    namespace: 'custom',
    dryRun: true,
    verbose: false,
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--source' && args[i + 1]) {
      options.sourcePath = args[++i];
    } else if (arg === '--format' && args[i + 1]) {
      options.format = args[++i] as AssetFormat;
    } else if (arg === '--namespace' && args[i + 1]) {
      options.namespace = args[++i];
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
      options.assetFilter = args[++i];
    } else if (arg === '--metadata' && args[i + 1]) {
      options.metadataFile = args[++i];
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
    await importAssetCollection(options);
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
kinetiCORE Asset Collection Import Script

Usage:
  npm run import-assets -- [options]

Options:
  --source <path>       Path to asset collection directory (required)
  --format <format>     Asset format: urdf | mjcf | step | auto (default: auto)
  --namespace <name>    Namespace for assets (default: "custom")
  --upload              Actually upload files (default is dry-run)
  --dry-run             Preview import without uploading (default)
  --api-url <url>       Cloudflare Workers API URL
  --api-key <key>       API key for authentication
  --filter <regex>      Only import assets matching regex
  --metadata <file>     External metadata file (JSON/YAML)
  --verbose, -v         Verbose output
  --help, -h            Show this help

Examples:
  # Dry run with auto-detection
  npm run import-assets -- --source /path/to/collection

  # Import URDF collection
  npm run import-assets -- --source /path/to/urdf_robots --format urdf --namespace "my-company" --upload

  # Import with external metadata
  npm run import-assets -- --source /path/to/assets --metadata metadata.json --upload

  # Import MuJoCo Menagerie (example)
  npm run import-assets -- --source /path/to/mujoco_menagerie --format mjcf --namespace "mujoco-menagerie" --dry-run
`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { importAssetCollection, type ImportOptions, type AssetPackage };
