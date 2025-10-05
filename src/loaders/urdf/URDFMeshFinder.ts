// URDF Mesh File Finder
// Owner: George
// Automatically discovers STL/DAE mesh files relative to URDF file
//
// Standard URDF folder structures supported:
// 1. ROS package structure:
//    robot_description/
//      urdf/robot.urdf
//      meshes/visual/*.stl
//      meshes/collision/*.stl
//
// 2. Flat structure:
//    robot/
//      robot.urdf
//      *.stl
//
// 3. Visual subfolder:
//    robot/
//      robot.urdf
//      visual/*.stl

/**
 * Search for mesh files relative to URDF file location
 * Uses File System Access API when available (Chrome/Edge)
 */
export async function findMeshFilesForURDF(urdfFile: File): Promise<File[]> {
  const meshFiles: File[] = [];

  // Check if File System Access API is available
  if ('showDirectoryPicker' in window) {
    try {
      // Try to get directory handle from the URDF file
      // Note: This requires the file to have been selected via File System Access API
      // If the file came from a regular <input type="file">, this won't work
      console.log('[URDF Mesh Finder] Attempting to use File System Access API...');

      // Since we can't get the directory from a File object directly,
      // we need to ask the user to select the folder
      const message =
        `To load STL mesh files for this robot, please select the folder containing:\n` +
        `- ${urdfFile.name}\n` +
        `- STL mesh files (*.stl)\n\n` +
        `Standard folder structures are supported (e.g., meshes/visual/*.stl)`;

      console.log(message);

      // Show directory picker
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read',
        startIn: 'downloads', // Hint to start in downloads folder
      });

      console.log(`[URDF Mesh Finder] Selected directory: ${dirHandle.name}`);

      // Recursively search for .stl and .dae files
      await scanDirectory(dirHandle, meshFiles, 0, 3); // Max depth 3

      console.log(`[URDF Mesh Finder] Found ${meshFiles.length} mesh files`);
      return meshFiles;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[URDF Mesh Finder] User cancelled directory selection');
      } else {
        console.warn('[URDF Mesh Finder] File System Access API failed:', error);
      }
      return [];
    }
  }

  // Fallback: File System Access API not available
  console.warn('[URDF Mesh Finder] File System Access API not available');
  console.log('[URDF Mesh Finder] Placeholders will be used for meshes');
  console.log('[URDF Mesh Finder] Tip: Use Chrome/Edge or select folder instead of single file');

  return [];
}

/**
 * Recursively scan directory for mesh files
 */
async function scanDirectory(
  dirHandle: any,
  meshFiles: File[],
  currentDepth: number,
  maxDepth: number
): Promise<void> {
  if (currentDepth > maxDepth) return;

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const name = entry.name.toLowerCase();
      if (name.endsWith('.stl') || name.endsWith('.dae')) {
        const file = await entry.getFile();
        meshFiles.push(file);
        console.log(`  Found mesh: ${entry.name}`);
      }
    } else if (entry.kind === 'directory') {
      // Skip common non-mesh directories
      const skipDirs = ['node_modules', '.git', 'build', 'dist', 'src'];
      if (!skipDirs.includes(entry.name)) {
        await scanDirectory(entry, meshFiles, currentDepth + 1, maxDepth);
      }
    }
  }
}

/**
 * Check if browser supports File System Access API
 */
export function supportsFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window;
}
