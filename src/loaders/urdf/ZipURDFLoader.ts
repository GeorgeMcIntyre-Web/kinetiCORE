// Zip File URDF Loader
// Owner: George
// Loads URDF files with mesh files from zip archives
// No user interaction required - everything is packaged in one zip file

/**
 * Parse zip file and extract URDF and mesh files
 */
export async function parseZipFile(zipFile: File): Promise<{
  urdfFile: File | null;
  meshFiles: File[];
}> {
  console.log(`[Zip Loader] Parsing zip file: ${zipFile.name}`);
  
  try {
    // Use JSZip library to parse the zip file
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipFile);
    
    const urdfFiles: File[] = [];
    const meshFiles: File[] = [];
    
    // Process all files in the zip
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue; // Skip directories
      
      // Get file content
      const content = await zipEntry.async('blob');
      const fileName = relativePath.split('/').pop() || relativePath;
      
      // Create File object
      const file = new File([content], fileName, { 
        type: getMimeType(fileName)
      });
      
      // Categorize files
      if (fileName.toLowerCase().endsWith('.urdf')) {
        urdfFiles.push(file);
        console.log(`[Zip Loader] Found URDF file: ${fileName}`);
      } else if (fileName.toLowerCase().endsWith('.stl') || fileName.toLowerCase().endsWith('.dae')) {
        meshFiles.push(file);
        console.log(`[Zip Loader] Found mesh file: ${fileName}`);
      }
    }
    
    // Find the main URDF file (prefer the one with the most mesh references)
    let mainUrdfFile: File | null = null;
    if (urdfFiles.length === 1) {
      mainUrdfFile = urdfFiles[0];
    } else if (urdfFiles.length > 1) {
      // Find the URDF file that references the most mesh files
      let maxReferences = 0;
      for (const urdfFile of urdfFiles) {
        const urdfContent = await urdfFile.text();
        const meshReferences = (urdfContent.match(/<mesh\s+filename=/g) || []).length;
        if (meshReferences > maxReferences) {
          maxReferences = meshReferences;
          mainUrdfFile = urdfFile;
        }
      }
    }
    
    console.log(`[Zip Loader] Found ${urdfFiles.length} URDF files, ${meshFiles.length} mesh files`);
    console.log(`[Zip Loader] Main URDF file: ${mainUrdfFile?.name || 'none'}`);
    
    return {
      urdfFile: mainUrdfFile,
      meshFiles
    };
    
  } catch (error) {
    console.error('[Zip Loader] Error parsing zip file:', error);
    return {
      urdfFile: null,
      meshFiles: []
    };
  }
}

/**
 * Get MIME type for file extension
 */
function getMimeType(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop();
  switch (extension) {
    case 'urdf':
      return 'application/xml';
    case 'stl':
      return 'model/stl';
    case 'dae':
      return 'model/vnd.collada+xml';
    case 'obj':
      return 'model/obj';
    case 'gltf':
      return 'model/gltf+json';
    case 'glb':
      return 'model/gltf-binary';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Check if file is a zip file
 */
export function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip') || 
         file.type === 'application/zip' ||
         file.type === 'application/x-zip-compressed';
}

/**
 * Load URDF from zip file
 */
export async function loadURDFFromZip(zipFile: File): Promise<{
  urdfFile: File | null;
  meshFiles: File[];
  success: boolean;
  error?: string;
}> {
  console.log(`[Zip Loader] Loading URDF from zip: ${zipFile.name}`);
  
  try {
    const { urdfFile, meshFiles } = await parseZipFile(zipFile);
    
    if (!urdfFile) {
      return {
        urdfFile: null,
        meshFiles: [],
        success: false,
        error: 'No URDF file found in zip archive'
      };
    }
    
    console.log(`[Zip Loader] Successfully extracted URDF and ${meshFiles.length} mesh files`);
    
    return {
      urdfFile,
      meshFiles,
      success: true
    };
    
  } catch (error) {
    console.error('[Zip Loader] Error loading URDF from zip:', error);
    return {
      urdfFile: null,
      meshFiles: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
