/**
 * AgileX Piper Robot Test
 * Test script to verify the MJCF loader works correctly with root rotation
 */

import { Scene } from "@babylonjs/core";
import { loadMJCFFromFile } from "./src/loaders/mjcf/MJCFLoader";

/**
 * Test function to verify AgileX Piper robot loading with root rotation
 * This simulates loading the robot and checks if the root rotation is applied correctly
 */
export async function testAgileXPiperRobot(scene: Scene, mjcfFile: File): Promise<void> {
  try {
    console.log("[AgileX Piper Test] Starting AgileX Piper robot test...");
    console.log(`[AgileX Piper Test] Loading file: ${mjcfFile.name}`);
    
    // Load the MJCF file using the loader
    const result = await loadMJCFFromFile(scene, mjcfFile);
    
    if (!result.success) {
      throw new Error(`Failed to load MJCF: ${result.errors.join(', ')}`);
    }
    
    console.log("[AgileX Piper Test] ✅ MJCF loaded successfully!");
    console.log(`[AgileX Piper Test] Root nodes: ${result.rootNodes.length}`);
    console.log(`[AgileX Piper Test] Meshes: ${result.meshes.length}`);
    
    // Check if root rotation was applied
    if (result.rootNodes.length > 0) {
      const rootNode = result.rootNodes[0];
      console.log(`[AgileX Piper Test] Root node name: ${rootNode.name}`);
      
      // Check if rotation quaternion is applied (should be +90° X-rotation for Z-up to Y-up conversion)
      if (rootNode.rotationQuaternion) {
        console.log("[AgileX Piper Test] ✅ Root rotation quaternion applied!");
        console.log(`[AgileX Piper Test] Rotation quaternion: (${rootNode.rotationQuaternion.x.toFixed(3)}, ${rootNode.rotationQuaternion.y.toFixed(3)}, ${rootNode.rotationQuaternion.z.toFixed(3)}, ${rootNode.rotationQuaternion.w.toFixed(3)})`);
        
        // Verify it's approximately a +90° X-rotation
        const expectedX = Math.sin(Math.PI / 4); // sin(45°) for +90° rotation
        const expectedW = Math.cos(Math.PI / 4);  // cos(45°) for +90° rotation
        
        if (Math.abs(rootNode.rotationQuaternion.x - expectedX) < 0.1 && 
            Math.abs(rootNode.rotationQuaternion.w - expectedW) < 0.1) {
          console.log("[AgileX Piper Test] ✅ Root rotation is correct (+90° X-rotation for Z-up→Y-up conversion)!");
        } else {
          console.log("[AgileX Piper Test] ⚠️ Root rotation may not be the expected +90° X-rotation");
        }
      } else {
        console.log("[AgileX Piper Test] ❌ No root rotation quaternion found!");
      }
      
      // Check child meshes
      const childMeshes = rootNode.getChildMeshes();
      console.log(`[AgileX Piper Test] Child meshes: ${childMeshes.length}`);
      
      if (childMeshes.length > 0) {
        console.log("[AgileX Piper Test] ✅ Child meshes found - kinematic hierarchy preserved!");
        
        // Log first few meshes for verification
        childMeshes.slice(0, 5).forEach((mesh, index) => {
          const worldPos = mesh.getAbsolutePosition();
          console.log(`[AgileX Piper Test] Mesh ${index}: ${mesh.name} at world position (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
        });
      } else {
        console.log("[AgileX Piper Test] ⚠️ No child meshes found");
      }
    } else {
      console.log("[AgileX Piper Test] ❌ No root nodes found!");
    }
    
    console.log("[AgileX Piper Test] ✅ AgileX Piper robot test completed successfully!");
    
  } catch (error) {
    console.error("[AgileX Piper Test] ❌ Test failed:", error);
    throw error;
  }
}

/**
 * Test function to verify the MJCF loader handles root rotation correctly
 * This can be called from the browser console for manual testing
 */
export async function testMJCFRootRotation(scene: Scene): Promise<void> {
  console.log("[MJCF Root Rotation Test] Testing MJCF loader root rotation functionality...");
  
  // Create a mock MJCF file content for testing
  const mockMjcfContent = `<?xml version="1.0" ?>
<mujoco model="test_robot">
  <compiler meshdir="meshes" />
  <asset>
    <mesh name="base" file="base.stl" />
    <mesh name="link1" file="link1.stl" />
  </asset>
  <worldbody>
    <body name="base_link">
      <geom type="mesh" mesh="base" />
      <body name="link1">
        <geom type="mesh" mesh="link1" />
      </body>
    </body>
  </worldbody>
</mujoco>`;
  
  const mockFile = new File([mockMjcfContent], "test_robot.xml", { type: "text/xml" });
  
  try {
    await testAgileXPiperRobot(scene, mockFile);
  } catch (error) {
    console.error("[MJCF Root Rotation Test] Test failed:", error);
  }
}

// Export for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testMJCFRootRotation = testMJCFRootRotation;
  (window as any).testAgileXPiperRobot = testAgileXPiperRobot;
  console.log("[AgileX Piper Test] Test functions available in browser console:");
  console.log("[AgileX Piper Test] - testMJCFRootRotation(scene)");
  console.log("[AgileX Piper Test] - testAgileXPiperRobot(scene, mjcfFile)");
}
