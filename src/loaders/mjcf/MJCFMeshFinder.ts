/**
 * MJCF Mesh File Discovery
 * Owner: George
 *
 * Finds STL/mesh files referenced by MJCF files in the same directory
 */

/**
 * Find mesh files for MJCF by looking in the same directory or meshdir
 */
export async function findMeshFilesForMJCF(
  mjcfFile: File,
  lastUsedDirectory: string | null
): Promise<Map<string, File>> {
  const meshFiles = new Map<string, File>();

  // Parse MJCF to find mesh references
  const mjcfContent = await mjcfFile.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(mjcfContent, 'text/xml');

  // Get meshdir from compiler
  const compilerEl = xmlDoc.querySelector('compiler');
  const meshDir = compilerEl?.getAttribute('meshdir') || '';

  // Get all mesh asset references
  const meshAssets = xmlDoc.querySelectorAll('asset mesh');
  const meshFileNames = new Set<string>();

  meshAssets.forEach(meshEl => {
    const file = meshEl.getAttribute('file');
    if (file) {
      meshFileNames.add(file);
    }
  });

  console.log(`[MJCF Mesh Finder] Found ${meshFileNames.size} mesh references in MJCF:`, Array.from(meshFileNames));
  console.log(`[MJCF Mesh Finder] Mesh directory: "${meshDir}"`);

  // Try to find these files
  if (lastUsedDirectory) {
    console.log(`[MJCF Mesh Finder] Last used directory: ${lastUsedDirectory}`);

    // Try using File System Access API if available
    if ('showDirectoryPicker' in window) {
      console.log(`[MJCF Mesh Finder] File System Access API available - user will need to grant access`);
    }
  }

  // Note: We cannot automatically access file system files for security reasons
  // The files must be provided by the user through file input
  console.log(`[MJCF Mesh Finder] Browser security prevents automatic file access`);
  console.log(`[MJCF Mesh Finder] User must upload mesh files manually or use directory upload`);

  return meshFiles;
}

/**
 * Process uploaded mesh files and map them to MJCF asset names
 */
export function mapMeshFilesToAssets(
  uploadedFiles: File[],
  meshDir: string = ''
): Map<string, File> {
  const meshMap = new Map<string, File>();

  uploadedFiles.forEach(file => {
    const fileName = file.name;
    const extension = fileName.toLowerCase().split('.').pop();

    // Only process mesh files
    if (extension === 'stl' || extension === 'obj' || extension === 'dae') {
      // Remove mesh directory prefix if present
      const key = meshDir && fileName.startsWith(meshDir + '/')
        ? fileName.substring(meshDir.length + 1)
        : fileName;

      meshMap.set(key, file);
      console.log(`[MJCF Mesh Finder] Mapped "${key}" -> ${file.name}`);
    }
  });

  return meshMap;
}
