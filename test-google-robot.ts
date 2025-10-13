/**
 * Google Robot Loader Test
 * Simple test file to demonstrate the Google Robot MJCF loader with ZIP support
 */

import { Scene } from "@babylonjs/core";
import { loadGoogleRobot, extractGoogleRobotZip, type GoogleRobotLoadOptions } from "./src/loaders/mjcf/googleRobot";

/**
 * Test function to load Google Robot from ZIP file
 * This is for testing purposes to verify the ZIP loader works correctly
 */
export async function testGoogleRobotFromZip(scene: Scene, zipFile: File): Promise<void> {
  try {
    console.log("[Google Robot Test] Starting Google Robot ZIP loader test...");
    
    // Extract mesh files from ZIP
    const meshFiles = await extractGoogleRobotZip(zipFile);
    console.log(`[Google Robot Test] Extracted ${meshFiles.size} mesh files from ZIP`);
    
    // Test configuration
    const options: GoogleRobotLoadOptions = {
      rootUrl: "/google_robot", // Path where google_robot folder is served
      bakePivots: false, // Don't bake pivots for initial test
      meshFilesMap: meshFiles // Use extracted mesh files
    };
    
    // Load the Google Robot
    const robotRoot = await loadGoogleRobot(scene, options);
    
    console.log("[Google Robot Test] ✅ Google Robot loaded successfully from ZIP!");
    console.log(`[Google Robot Test] Root node: ${robotRoot.name}`);
    console.log(`[Google Robot Test] Child meshes: ${robotRoot.getChildMeshes().length}`);
    
    // Log all child meshes for debugging
    robotRoot.getChildMeshes().forEach((mesh, index) => {
      console.log(`[Google Robot Test] Mesh ${index}: ${mesh.name} (${mesh.getTotalVertices()} vertices)`);
    });
    
    // Position the robot for better visibility
    robotRoot.position.set(0, 0, 0);
    
    return robotRoot;
    
  } catch (error) {
    console.error("[Google Robot Test] ❌ Failed to load Google Robot from ZIP:", error);
    throw error;
  }
}

/**
 * Test function to load Google Robot in a Babylon.js scene (fallback to URL loading)
 * This is for testing purposes to verify the loader works correctly
 */
export async function testGoogleRobotLoader(scene: Scene): Promise<void> {
  try {
    console.log("[Google Robot Test] Starting Google Robot loader test...");
    
    // Test configuration
    const options: GoogleRobotLoadOptions = {
      rootUrl: "/google_robot", // Path where google_robot folder is served
      bakePivots: false // Don't bake pivots for initial test
    };
    
    // Load the Google Robot
    const robotRoot = await loadGoogleRobot(scene, options);
    
    console.log("[Google Robot Test] ✅ Google Robot loaded successfully!");
    console.log(`[Google Robot Test] Root node: ${robotRoot.name}`);
    console.log(`[Google Robot Test] Child meshes: ${robotRoot.getChildMeshes().length}`);
    
    // Log all child meshes for debugging
    robotRoot.getChildMeshes().forEach((mesh, index) => {
      console.log(`[Google Robot Test] Mesh ${index}: ${mesh.name} (${mesh.getTotalVertices()} vertices)`);
    });
    
    // Position the robot for better visibility
    robotRoot.position.set(0, 0, 0);
    
    return robotRoot;
    
  } catch (error) {
    console.error("[Google Robot Test] ❌ Failed to load Google Robot:", error);
    throw error;
  }
}

/**
 * Test function with different configurations
 */
export async function testGoogleRobotWithOptions(scene: Scene, options: GoogleRobotLoadOptions): Promise<void> {
  try {
    console.log("[Google Robot Test] Testing with custom options:", options);
    
    const robotRoot = await loadGoogleRobot(scene, options);
    
    console.log("[Google Robot Test] ✅ Custom options test successful!");
    console.log(`[Google Robot Test] Root node: ${robotRoot.name}`);
    
    return robotRoot;
    
  } catch (error) {
    console.error("[Google Robot Test] ❌ Custom options test failed:", error);
    throw error;
  }
}

/**
 * Example usage in your main application:
 * 
 * ```typescript
 * import { testGoogleRobotFromZip, testGoogleRobotLoader } from './test-google-robot';
 * 
 * // With ZIP file (recommended for web)
 * const robotRoot = await testGoogleRobotFromZip(scene, zipFile);
 * 
 * // Fallback to URL loading
 * const robotRoot = await testGoogleRobotLoader(scene);
 * 
 * // Or with custom options
 * const robotRoot = await testGoogleRobotWithOptions(scene, {
 *   rootUrl: "/my-custom-path/google_robot",
 *   bakePivots: true,
 *   meshFilesMap: extractedMeshFiles
 * });
 * ```
 */
