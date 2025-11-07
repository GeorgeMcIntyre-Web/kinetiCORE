/**
 * JT Kinematic Workflow Test Script
 * Run this to test the JT→kinematic→GLB workflow
 */

import { JTKinematicWorkflowTest } from './src/loaders/jt/JTKinematicWorkflowTest';
import { JTKinematicIntegrationService } from './src/loaders/jt/JTKinematicIntegrationService';
import * as BABYLON from '@babylonjs/core';

async function testJTKinematicWorkflow() {
    console.log('🚀 Starting JT Kinematic Workflow Test...');
    
    // Create a simple Babylon.js scene for testing
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    
    // Add basic lighting
    new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
    const camera = new BABYLON.ArcRotateCamera('camera', 0, Math.PI / 2, 10, BABYLON.Vector3.Zero(), scene);
    camera.attachControls(canvas, true);
    
    try {
        // Test 1: Simple conversion
        console.log('📋 Test 1: Simple conversion...');
        const workflowTest = new JTKinematicWorkflowTest();
        const simpleSuccess = await workflowTest.testSimpleConversion(scene);
        console.log(`✅ Simple conversion: ${simpleSuccess ? 'PASSED' : 'FAILED'}`);
        
        // Test 2: r2000ic workflow
        console.log('📋 Test 2: r2000ic workflow...');
        const r2000icSuccess = await workflowTest.testR2000icWorkflow(scene);
        console.log(`✅ r2000ic workflow: ${r2000icSuccess ? 'PASSED' : 'FAILED'}`);
        
        // Test 3: Integration service
        console.log('📋 Test 3: Integration service...');
        const integrationService = new JTKinematicIntegrationService();
        
        // Create a mock JT file
        const mockJTFile = new File(['mock'], 'test.jt', { type: 'application/octet-stream' });
        
        const integrationResult = await integrationService.loadJTWithKinematics(
            mockJTFile,
            scene,
            { extractKinematics: true, createPhysicsJoints: false, applyToGLB: false }
        );
        
        console.log(`✅ Integration service: ${integrationResult.success ? 'PASSED' : 'FAILED'}`);
        
        if (!integrationResult.success) {
            console.error('❌ Integration error:', integrationResult.error);
        }
        
        console.log('🎉 All tests completed!');
        
        // Start render loop
        engine.runRenderLoop(() => {
            scene.render();
        });
        
        console.log('🎮 Scene is now running. Check the browser for 3D visualization.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test when the page loads
if (typeof window !== 'undefined') {
    window.addEventListener('load', testJTKinematicWorkflow);
} else {
    // Node.js environment
    testJTKinematicWorkflow().catch(console.error);
}
