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
 * Automatically loads mesh files using File System Access API
 */
export async function findMeshFilesForURDF(urdfFile: File, _lastUsedDirectory?: string | null): Promise<File[]> {
  console.log('[URDF Mesh Finder] Starting automatic mesh discovery...');
  
  try {
    // Check if File System Access API is available
    if (!('showDirectoryPicker' in window)) {
      console.log('[URDF Mesh Finder] File System Access API not available - cannot auto-scan directories');
      return [];
    }
    
    // Import the automatic mesh loader
    const { autoLoadURDFMeshes } = await import('./AutoURDFMeshLoader');
    
    // Try automatic loading with directory picker
    const meshFiles = await autoLoadURDFMeshes(urdfFile);
    
    if (meshFiles.length > 0) {
      console.log(`[URDF Mesh Finder] Successfully loaded ${meshFiles.length} mesh files automatically`);
      return meshFiles;
    }
    
    console.log('[URDF Mesh Finder] No mesh files found - URDF will load with basic structure');
    return [];
    
  } catch (error) {
    console.error('[URDF Mesh Finder] Error during automatic mesh loading:', error);
    return [];
  }
}

/**
 * Check if browser supports File System Access API
 */
export function supportsFileSystemAccess(): boolean {
  return 'showDirectoryPicker' in window;
}
