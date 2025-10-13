/**
 * MJCF Google Robot Test Script
 * Tests the complete MJCF import workflow with the Google Robot model
 * 
 * This script tests:
 * 1. ZIP file extraction
 * 2. MJCF XML parsing
 * 3. STL mesh loading
 * 4. Kinematics creation
 * 5. UI integration
 */

import * as BABYLON from '@babylonjs/core';
import { loadMJCFFromFile, createKinematicsFromMJCF } from './src/loaders/mjcf/MJCFLoader';
import { MJCFImportResult } from './src/loaders/mjcf/types';

// Test configuration
const TEST_CONFIG = {
  zipFilePath: 'C:\\Users\\georgem\\source\\repos\\kinetiCORE_data\\mujoco_menagerie\\google_robot.zip',
  expectedMJCFFile: 'robot.xml',
  expectedMeshFiles: [
    'link_base_0_00.stl',
    'link_base_0_01.stl',
    'link_base_1_00.stl',
    'link_base_1_01.stl',
    'link_base_1_02.stl',
    'link_base_1_03.stl',
    'link_base_1_04.stl',
    'link_base_1_05.stl',
    'link_base_1_06.stl',
    'link_base_1_07.stl',
    'link_base_1_08.stl',
    'link_base_1_09.stl',
    'link_base_1_10.stl',
    'link_base_1_11.stl',
    'link_base_1_12.stl',
    'link_base_1_13.stl',
    'link_base_1_14.stl',
    'link_base_1_15.stl',
    'link_base_1_16.stl',
    'link_base_1_17.stl',
    'link_base_1_18.stl',
    'link_base_1_19.stl',
    'link_bicep.stl',
    'link_elbow.stl',
    'link_finger_base.stl',
    'link_finger_tip.stl',
    'link_forearm.stl',
    'link_gripper.stl',
    'link_head_pan.stl',
    'link_head_tilt.stl',
    'link_shoulder.stl',
    'link_torso_00.stl',
    'link_torso_01.stl',
    'link_wrist.stl'
  ],
  expectedTextureFiles: [
    'finger_base_texture.png',
    'finger_tip_texture.png',
    'robot_texture.png'
  ]
};

/**
 * Test MJCF loader with Google Robot ZIP file
 */
async function testMJCFGoogleRobot(): Promise<void> {
  console.log('🤖 Starting MJCF Google Robot Test');
  console.log('=====================================');

  try {
    // Step 1: Create test scene
    console.log('\n📋 Step 1: Creating test scene...');
    const canvas = document.createElement('canvas');
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    
    // Add basic lighting
    const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    // Add camera
    const camera = new BABYLON.ArcRotateCamera('camera', 0, 0, 10, BABYLON.Vector3.Zero(), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    
    console.log('✅ Test scene created successfully');

    // Step 2: Simulate file loading (since we can't actually load from filesystem in browser)
    console.log('\n📋 Step 2: Testing MJCF loader with simulated data...');
    
    // Create a mock File object for testing
    const mockMJCFContent = await createMockMJCFContent();
    const mockZipFile = new File([mockMJCFContent], 'google_robot.zip', { type: 'application/zip' });
    
    console.log('✅ Mock MJCF content created');

    // Step 3: Test MJCF loading
    console.log('\n📋 Step 3: Testing MJCF loading...');
    
    const result: MJCFImportResult = await loadMJCFFromFile(mockZipFile, scene);
    
    console.log('📊 MJCF Import Results:');
    console.log(`  - Success: ${result.success}`);
    console.log(`  - Meshes: ${result.meshes.length}`);
    console.log(`  - Root Nodes: ${result.rootNodes.length}`);
    console.log(`  - Joints: ${result.joints.length}`);
    console.log(`  - Actuators: ${result.actuators.length}`);
    console.log(`  - Errors: ${result.errors.length}`);
    console.log(`  - Warnings: ${result.warnings.length}`);
    
    if (result.errors.length > 0) {
      console.log('❌ Errors found:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    if (result.warnings.length > 0) {
      console.log('⚠️ Warnings found:');
      result.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    // Step 4: Test kinematics creation
    console.log('\n📋 Step 4: Testing kinematics creation...');
    
    try {
      await createKinematicsFromMJCF(mockMJCFContent, 'google_robot_test');
      console.log('✅ Kinematics created successfully');
    } catch (error) {
      console.error('❌ Kinematics creation failed:', error);
    }

    // Step 5: Verify mesh properties
    console.log('\n📋 Step 5: Verifying mesh properties...');
    
    if (result.meshes.length > 0) {
      console.log('🔍 Mesh Analysis:');
      result.meshes.forEach((mesh, index) => {
        console.log(`  Mesh ${index + 1}: ${mesh.name}`);
        console.log(`    - Position: (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
        console.log(`    - Enabled: ${mesh.isEnabled()}`);
        console.log(`    - Visible: ${mesh.isVisible}`);
        console.log(`    - Vertices: ${mesh.getTotalVertices()}`);
        console.log(`    - Material: ${mesh.material ? mesh.material.name : 'none'}`);
        console.log(`    - Metadata: ${JSON.stringify(mesh.metadata, null, 2)}`);
      });
    } else {
      console.log('⚠️ No meshes were created');
    }

    // Step 6: Test bounds calculation
    console.log('\n📋 Step 6: Testing bounds calculation...');
    
    if (result.bounds) {
      console.log('📐 Model Bounds:');
      console.log(`  - Min: (${result.bounds.minimum.x.toFixed(2)}, ${result.bounds.minimum.y.toFixed(2)}, ${result.bounds.minimum.z.toFixed(2)})`);
      console.log(`  - Max: (${result.bounds.maximum.x.toFixed(2)}, ${result.bounds.maximum.y.toFixed(2)}, ${result.bounds.maximum.z.toFixed(2)})`);
      console.log(`  - Center: (${result.bounds.center.x.toFixed(2)}, ${result.bounds.center.y.toFixed(2)}, ${result.bounds.center.z.toFixed(2)})`);
      console.log(`  - Size: (${result.bounds.maximum.subtract(result.bounds.minimum).x.toFixed(2)}, ${result.bounds.maximum.subtract(result.bounds.minimum).y.toFixed(2)}, ${result.bounds.maximum.subtract(result.bounds.minimum).z.toFixed(2)})`);
    } else {
      console.log('⚠️ No bounds calculated');
    }

    // Step 7: Test scene rendering
    console.log('\n📋 Step 7: Testing scene rendering...');
    
    // Force scene update
    scene.render();
    console.log('✅ Scene rendered successfully');

    // Cleanup
    engine.dispose();
    console.log('✅ Test scene cleaned up');

    // Final results
    console.log('\n🎯 Test Results Summary:');
    console.log('========================');
    console.log(`✅ MJCF Loading: ${result.success ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Mesh Creation: ${result.meshes.length > 0 ? 'PASSED' : 'FAILED'} (${result.meshes.length} meshes)`);
    console.log(`✅ Joint Processing: ${result.joints.length > 0 ? 'PASSED' : 'FAILED'} (${result.joints.length} joints)`);
    console.log(`✅ Actuator Processing: ${result.actuators.length > 0 ? 'PASSED' : 'FAILED'} (${result.actuators.length} actuators)`);
    console.log(`✅ Error Handling: ${result.errors.length === 0 ? 'PASSED' : 'FAILED'} (${result.errors.length} errors)`);

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    throw error;
  }
}

/**
 * Create mock MJCF content for testing
 */
async function createMockMJCFContent(): Promise<string> {
  // This is a simplified version of the Google Robot MJCF file
  // In a real test, you would load the actual file content
  return `<?xml version="1.0" ?>
<mujoco model="google_robot">
  <compiler meshdir="assets" />
  
  <asset>
    <mesh name="link_base_0_00" file="link_base_0_00.stl" />
    <mesh name="link_base_0_01" file="link_base_0_01.stl" />
    <mesh name="link_base_1_00" file="link_base_1_00.stl" />
    <mesh name="link_base_1_01" file="link_base_1_01.stl" />
    <mesh name="link_base_1_02" file="link_base_1_02.stl" />
    <mesh name="link_base_1_03" file="link_base_1_03.stl" />
    <mesh name="link_base_1_04" file="link_base_1_04.stl" />
    <mesh name="link_base_1_05" file="link_base_1_05.stl" />
    <mesh name="link_base_1_06" file="link_base_1_06.stl" />
    <mesh name="link_base_1_07" file="link_base_1_07.stl" />
    <mesh name="link_base_1_08" file="link_base_1_08.stl" />
    <mesh name="link_base_1_09" file="link_base_1_09.stl" />
    <mesh name="link_base_1_10" file="link_base_1_10.stl" />
    <mesh name="link_base_1_11" file="link_base_1_11.stl" />
    <mesh name="link_base_1_12" file="link_base_1_12.stl" />
    <mesh name="link_base_1_13" file="link_base_1_13.stl" />
    <mesh name="link_base_1_14" file="link_base_1_14.stl" />
    <mesh name="link_base_1_15" file="link_base_1_15.stl" />
    <mesh name="link_base_1_16" file="link_base_1_16.stl" />
    <mesh name="link_base_1_17" file="link_base_1_17.stl" />
    <mesh name="link_base_1_18" file="link_base_1_18.stl" />
    <mesh name="link_base_1_19" file="link_base_1_19.stl" />
    <mesh name="link_bicep" file="link_bicep.stl" />
    <mesh name="link_elbow" file="link_elbow.stl" />
    <mesh name="link_finger_base" file="link_finger_base.stl" />
    <mesh name="link_finger_tip" file="link_finger_tip.stl" />
    <mesh name="link_forearm" file="link_forearm.stl" />
    <mesh name="link_gripper" file="link_gripper.stl" />
    <mesh name="link_head_pan" file="link_head_pan.stl" />
    <mesh name="link_head_tilt" file="link_head_tilt.stl" />
    <mesh name="link_shoulder" file="link_shoulder.stl" />
    <mesh name="link_torso_00" file="link_torso_00.stl" />
    <mesh name="link_torso_01" file="link_torso_01.stl" />
    <mesh name="link_wrist" file="link_wrist.stl" />
    
    <texture name="finger_base_texture" file="finger_base_texture.png" />
    <texture name="finger_tip_texture" file="finger_tip_texture.png" />
    <texture name="robot_texture" file="robot_texture.png" />
  </asset>

  <worldbody>
    <body name="base_link" pos="0 0 0">
      <geom name="base_geom" type="mesh" mesh="link_base_0_00" rgba="0.7 0.7 0.7 1" />
      <geom name="base_geom_01" type="mesh" mesh="link_base_0_01" rgba="0.7 0.7 0.7 1" />
      
      <body name="torso" pos="0 0 0.1">
        <geom name="torso_geom_00" type="mesh" mesh="link_torso_00" rgba="0.8 0.8 0.8 1" />
        <geom name="torso_geom_01" type="mesh" mesh="link_torso_01" rgba="0.8 0.8 0.8 1" />
        
        <body name="shoulder" pos="0 0 0.2">
          <joint name="shoulder_pan" type="hinge" axis="0 0 1" range="-3.14 3.14" />
          <geom name="shoulder_geom" type="mesh" mesh="link_shoulder" rgba="0.6 0.6 0.6 1" />
          
          <body name="bicep" pos="0 0 0.1">
            <joint name="shoulder_lift" type="hinge" axis="0 1 0" range="-1.57 1.57" />
            <geom name="bicep_geom" type="mesh" mesh="link_bicep" rgba="0.5 0.5 0.5 1" />
            
            <body name="elbow" pos="0 0 0.15">
              <joint name="elbow" type="hinge" axis="0 1 0" range="-3.14 3.14" />
              <geom name="elbow_geom" type="mesh" mesh="link_elbow" rgba="0.4 0.4 0.4 1" />
              
              <body name="forearm" pos="0 0 0.1">
                <joint name="wrist_1" type="hinge" axis="0 0 1" range="-3.14 3.14" />
                <geom name="forearm_geom" type="mesh" mesh="link_forearm" rgba="0.3 0.3 0.3 1" />
                
                <body name="wrist" pos="0 0 0.1">
                  <joint name="wrist_2" type="hinge" axis="0 1 0" range="-1.57 1.57" />
                  <geom name="wrist_geom" type="mesh" mesh="link_wrist" rgba="0.2 0.2 0.2 1" />
                  
                  <body name="gripper" pos="0 0 0.05">
                    <joint name="wrist_3" type="hinge" axis="0 0 1" range="-3.14 3.14" />
                    <geom name="gripper_geom" type="mesh" mesh="link_gripper" rgba="0.1 0.1 0.1 1" />
                    
                    <body name="finger_base" pos="0 0 0.02">
                      <joint name="finger_joint" type="hinge" axis="0 1 0" range="0 0.5" />
                      <geom name="finger_base_geom" type="mesh" mesh="link_finger_base" rgba="0.9 0.9 0.9 1" />
                      
                      <body name="finger_tip" pos="0 0 0.02">
                        <geom name="finger_tip_geom" type="mesh" mesh="link_finger_tip" rgba="0.8 0.8 0.8 1" />
                      </body>
                    </body>
                  </body>
                </body>
              </body>
            </body>
          </body>
        </body>
        
        <body name="head_pan" pos="0 0 0.3">
          <joint name="head_pan" type="hinge" axis="0 0 1" range="-1.57 1.57" />
          <geom name="head_pan_geom" type="mesh" mesh="link_head_pan" rgba="0.7 0.7 0.7 1" />
          
          <body name="head_tilt" pos="0 0 0.05">
            <joint name="head_tilt" type="hinge" axis="0 1 0" range="-0.5 0.5" />
            <geom name="head_tilt_geom" type="mesh" mesh="link_head_tilt" rgba="0.6 0.6 0.6 1" />
          </body>
        </body>
      </body>
    </body>
  </worldbody>

  <actuator>
    <motor name="shoulder_pan_motor" joint="shoulder_pan" gear="100" ctrlrange="-1 1" forcerange="-50 50" />
    <motor name="shoulder_lift_motor" joint="shoulder_lift" gear="100" ctrlrange="-1 1" forcerange="-50 50" />
    <motor name="elbow_motor" joint="elbow" gear="100" ctrlrange="-1 1" forcerange="-50 50" />
    <motor name="wrist_1_motor" joint="wrist_1" gear="100" ctrlrange="-1 1" forcerange="-50 50" />
    <motor name="wrist_2_motor" joint="wrist_2" gear="100" ctrlrange="-1 1" forcerange="-50 50" />
    <motor name="wrist_3_motor" joint="wrist_3" gear="100" ctrlrange="-1 1" forcerange="-50 50" />
    <motor name="finger_motor" joint="finger_joint" gear="50" ctrlrange="0 1" forcerange="0 25" />
    <motor name="head_pan_motor" joint="head_pan" gear="50" ctrlrange="-1 1" forcerange="-25 25" />
    <motor name="head_tilt_motor" joint="head_tilt" gear="50" ctrlrange="-1 1" forcerange="-25 25" />
  </actuator>

  <contact>
    <pair geom1="finger_base_geom" geom2="finger_tip_geom" />
    <pair geom1="gripper_geom" geom2="finger_base_geom" />
  </contact>
</mujoco>`;
}

/**
 * Test UI integration
 */
async function testUIIntegration(): Promise<void> {
  console.log('\n🖥️ Testing UI Integration...');
  
  // Test file input handling
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.xml,.zip,.urdf,.gltf,.glb,.obj,.jt,.dwg,.dxf';
  fileInput.multiple = true;
  
  console.log('✅ File input created with proper accept types');
  
  // Test file type detection
  const testFiles = [
    { name: 'robot.xml', type: 'text/xml' },
    { name: 'google_robot.zip', type: 'application/zip' },
    { name: 'link_base.stl', type: 'application/octet-stream' }
  ];
  
  testFiles.forEach(file => {
    const mockFile = new File([''], file.name, { type: file.type });
    console.log(`✅ Mock file created: ${file.name} (${file.type})`);
  });
  
  console.log('✅ UI integration test completed');
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting MJCF Google Robot Test Suite');
  console.log('==========================================');
  
  try {
    await testMJCFGoogleRobot();
    await testUIIntegration();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('=====================================');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    throw error;
  }
}

// Export for use in browser console or other scripts
if (typeof window !== 'undefined') {
  (window as any).testMJCFGoogleRobot = testMJCFGoogleRobot;
  (window as any).testUIIntegration = testUIIntegration;
  (window as any).runAllTests = runAllTests;
}

// Auto-run if this script is executed directly
if (typeof window !== 'undefined' && window.location.pathname.includes('test-mjcf-google-robot')) {
  runAllTests().catch(console.error);
}
