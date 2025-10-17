// Debug script for up-axis detection
// This can be run in the browser console to debug specific files

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { loadGLBFromFile } from './src/loaders/glb/GLBLoader.js';
import { diagnoseUpAxis } from './src/loaders/glb/upAxis.js';

// Debug function to test a specific file
window.debugUpAxis = async function(file) {
    console.group(`🔍 Debugging ${file.name}`);
    
    try {
        // Create a simple scene for testing
        const canvas = document.createElement('canvas');
        canvas.style.width = '400px';
        canvas.style.height = '300px';
        canvas.style.border = '1px solid #ccc';
        document.body.appendChild(canvas);
        
        const engine = new BABYLON.Engine(canvas, true);
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.ArcRotateCamera("camera", 0, Math.PI / 3, 10, BABYLON.Vector3.Zero(), scene);
        camera.attachControls(canvas, true);
        
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;
        
        // Load the file
        const result = await loadGLBFromFile(file, scene, {
            enableUpAxisDetection: true,
            upAxisVerbose: true,
            enableBoundsCalculation: true
        });
        
        if (!result.success) {
            console.error('Failed to load file:', result.errors);
            return;
        }
        
        console.log('✅ File loaded successfully');
        
        // Get the root node
        const rootNode = result.rootNodes[0];
        if (!rootNode) {
            console.error('No root node found');
            return;
        }
        
        console.log('Root node:', rootNode.name);
        console.log('Position:', rootNode.position.toString());
        
        // Get all meshes
        const meshes = rootNode.getChildMeshes(false);
        console.log(`Found ${meshes.length} meshes`);
        
        // Calculate extents manually
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        
        meshes.forEach(mesh => {
            mesh.computeWorldMatrix(true);
            const boundingInfo = mesh.getBoundingInfo();
            const min = boundingInfo.boundingBox.minimumWorld;
            const max = boundingInfo.boundingBox.maximumWorld;
            
            minX = Math.min(minX, min.x);
            minY = Math.min(minY, min.y);
            minZ = Math.min(minZ, min.z);
            maxX = Math.max(maxX, max.x);
            maxY = Math.max(maxY, max.y);
            maxZ = Math.max(maxZ, max.z);
        });
        
        const extX = maxX - minX;
        const extY = maxY - minY;
        const extZ = maxZ - minZ;
        
        console.log('Manual extents calculation:');
        console.log(`  X: ${extX.toFixed(3)} (${minX.toFixed(2)} to ${maxX.toFixed(2)})`);
        console.log(`  Y: ${extY.toFixed(3)} (${minY.toFixed(2)} to ${maxY.toFixed(2)})`);
        console.log(`  Z: ${extZ.toFixed(3)} (${minZ.toFixed(2)} to ${maxZ.toFixed(2)})`);
        
        const tallest = Math.max(extX, extY, extZ);
        const expectedUp = tallest === extY ? 'Y' : tallest === extZ ? 'Z' : 'X';
        console.log(`Expected up-axis from extents: ${expectedUp}-up (tallest dimension)`);
        
        // Run the detection
        const detection = result.upAxisDetection;
        if (detection) {
            console.log('Detection result:');
            console.log(`  Detected: ${detection.detected}-up`);
            console.log(`  Confidence: ${Math.round(detection.confidence * 100)}%`);
            console.log(`  Method: ${detection.method}`);
            console.log(`  Applied: ${detection.applied}`);
        }
        
        // Run detailed diagnosis
        console.log('\nDetailed diagnosis:');
        const diagnosis = diagnoseUpAxis(rootNode);
        console.log('Diagnosis result:', diagnosis);
        
        // Check for wrapper
        const hasWrapper = rootNode.parent && 
                          rootNode.parent.metadata && 
                          rootNode.parent.metadata.__axisWrapper;
        console.log(`Has wrapper: ${hasWrapper}`);
        
        if (hasWrapper) {
            const wrapper = rootNode.parent;
            const rotation = wrapper.rotationQuaternion?.toEulerAngles() || wrapper.rotation;
            console.log(`Wrapper rotation: X=${(rotation.x * 180 / Math.PI).toFixed(1)}°, Y=${(rotation.y * 180 / Math.PI).toFixed(1)}°, Z=${(rotation.z * 180 / Math.PI).toFixed(1)}°`);
        }
        
        // Check bounds
        if (result.bounds) {
            console.log('Bounds:');
            console.log(`  Center: ${result.bounds.center.toString()}`);
            console.log(`  Size: ${result.bounds.maximum.subtract(result.bounds.minimum).toString()}`);
        }
        
        // Determine expected from filename
        const expectedFromFilename = file.name.toLowerCase().includes('_yup') ? 'Y' : 
                                   file.name.toLowerCase().includes('_zup') ? 'Z' : 'UNKNOWN';
        console.log(`Expected from filename: ${expectedFromFilename}-up`);
        
        // Check if detection is correct
        if (expectedFromFilename !== 'UNKNOWN') {
            const isCorrect = detection?.detected === expectedFromFilename;
            console.log(`Detection ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
        }
        
    } catch (error) {
        console.error('Error during debugging:', error);
    }
    
    console.groupEnd();
};

// Make it available globally
console.log('Debug function available: window.debugUpAxis(file)');
console.log('Usage: Select a file input, then call debugUpAxis(fileInput.files[0])');
