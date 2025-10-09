// Automatic URDF Mesh Loader
// Owner: George
// Automatically loads mesh files based on URDF file structure
// Uses File System Access API to load entire directory structure

/**
 * Parse URDF file to extract mesh file paths
 */
export function parseURDFMeshPaths(urdfContent: string): string[] {
  const meshPaths: string[] = [];
  
  // Regular expression to match mesh filename attributes
  const meshRegex = /<mesh\s+filename="([^"]+)"/g;
  let match;
  
  while ((match = meshRegex.exec(urdfContent)) !== null) {
    const meshPath = match[1];
    meshPaths.push(meshPath);
  }
  
  console.log(`[URDF Parser] Found ${meshPaths.length} mesh references:`, meshPaths);
  return meshPaths;
}

/**
 * Convert package:// URLs to relative file paths
 */
export function convertPackageUrlToPath(packageUrl: string): string {
  // Remove package:// prefix and convert to relative path
  const relativePath = packageUrl.replace(/^package:\/\//, '');
  
  // Convert forward slashes to backslashes for Windows compatibility
  const normalizedPath = relativePath.replace(/\//g, '\\');
  
  console.log(`[URDF Parser] Converted ${packageUrl} to ${normalizedPath}`);
  return normalizedPath;
}

/**
 * Find mesh file in directory structure using File System Access API
 */
export async function findMeshInDirectory(dirHandle: any, meshPath: string, depth: number = 0, maxDepth: number = 5): Promise<File | null> {
  if (depth > maxDepth) return null;
  
  try {
    // Split path into parts
    const pathParts = meshPath.split(/[/\\]/);
    const fileName = pathParts[pathParts.length - 1];
    const remainingPath = pathParts.slice(0, -1);
    
    // If we're at the target directory level
    if (remainingPath.length === 0) {
      // Look for the file in current directory
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name === fileName) {
          console.log(`[URDF Parser] Found mesh file: ${fileName}`);
          return await entry.getFile();
        }
      }
      return null;
    }
    
    // Navigate to subdirectory
    const nextDirName = remainingPath[remainingPath.length - 1];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory' && entry.name === nextDirName) {
        const nextPath = remainingPath.slice(0, -1).join('/');
        return await findMeshInDirectory(entry, nextPath + '/' + fileName, depth + 1, maxDepth);
      }
    }
    
    return null;
  } catch (error) {
    console.log(`[URDF Parser] Error finding mesh ${meshPath}:`, error);
    return null;
  }
}

/**
 * Automatically load mesh files for URDF by scanning subdirectories
 * Uses File System Access API to automatically find and load mesh files
 */
export async function autoLoadURDFMeshes(urdfFile: File): Promise<File[]> {
  console.log(`[Auto URDF Loader] Starting automatic mesh loading for: ${urdfFile.name}`);
  
  try {
    // Read URDF content
    const urdfContent = await urdfFile.text();
    
    // Parse mesh paths from URDF
    const meshPaths = parseURDFMeshPaths(urdfContent);
    
    if (meshPaths.length === 0) {
      console.log('[Auto URDF Loader] No mesh files found in URDF');
      return [];
    }
    
    console.log(`[Auto URDF Loader] Found ${meshPaths.length} mesh references in URDF`);
    
    // Show directory picker to get the root directory containing the URDF file
    console.log('[Auto URDF Loader] Opening directory picker to scan for mesh files...');
    
    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'read',
      startIn: 'downloads',
    });
    
    console.log(`[Auto URDF Loader] Selected directory: ${dirHandle.name}`);
    
    // Load each mesh file by scanning the directory structure
    const meshFiles: File[] = [];
    
    for (const meshPath of meshPaths) {
      const relativePath = convertPackageUrlToPath(meshPath);
      console.log(`[Auto URDF Loader] Looking for mesh: ${relativePath}`);
      
      const meshFile = await findMeshInDirectory(dirHandle, relativePath);
      if (meshFile) {
        meshFiles.push(meshFile);
        console.log(`[Auto URDF Loader] Successfully loaded: ${meshFile.name}`);
      } else {
        console.log(`[Auto URDF Loader] Mesh not found: ${relativePath}`);
      }
    }
    
    console.log(`[Auto URDF Loader] Successfully loaded ${meshFiles.length}/${meshPaths.length} mesh files`);
    return meshFiles;
    
  } catch (error) {
    console.error('[Auto URDF Loader] Error during automatic mesh loading:', error);
    return [];
  }
}
