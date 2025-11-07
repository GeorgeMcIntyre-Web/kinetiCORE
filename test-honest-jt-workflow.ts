/**
 * Test script to show what we can ACTUALLY do with JT files
 */

import { HonestJTKinematicWorkflow } from './src/loaders/jt/HonestJTKinematicWorkflow';
import * as BABYLON from '@babylonjs/core';

async function testHonestJTWorkflow() {
    console.log('🔍 TESTING HONEST JT KINEMATIC WORKFLOW');
    console.log('=====================================');
    
    // Create a simple Babylon.js scene
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
    
    const honestWorkflow = new HonestJTKinematicWorkflow();
    
    try {
        // Run the honest workflow
        const success = await honestWorkflow.createHonestWorkflow(scene);
        
        if (success) {
            console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
            console.log('Check the browser for:');
            console.log('- GLB robot model loaded');
            console.log('- Estimated joint controls (orange labels)');
            console.log('- Warning message about estimated kinematics');
        } else {
            console.log('\n❌ TEST FAILED');
        }
        
        // Show path to real kinematics
        honestWorkflow.showPathToRealKinematics();
        
        // Start render loop
        engine.runRenderLoop(() => {
            scene.render();
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (typeof window !== 'undefined') {
    window.addEventListener('load', testHonestJTWorkflow);
} else {
    testHonestJTWorkflow().catch(console.error);
}
