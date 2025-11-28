import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { KinematicExtractionPipeline } from '../../../babylon/pipeline/KinematicExtractionPipeline';
import * as fs from 'fs';
import * as path from 'path';
import { DracoCompression } from '@babylonjs/core/Meshes/Compression/dracoCompression';

// Polyfill XMLHttpRequest for Node.js environment (needed for Draco loader)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XHR2 = require('xhr2');
(global as any).XMLHttpRequest = XHR2;

describe('Real GLB Data Integration', () => {
    let scene: BABYLON.Scene;
    let engine: BABYLON.Engine;
    let pipeline: KinematicExtractionPipeline;

    // Path to a real GLB file
    const GLB_PATH = String.raw`C:\Users\George\source\repos\kinetiCORE_DATA\Tooling_testing_data\016ZF_20142435_130\016ZF_20142435_130.glb`;

    beforeAll(() => {
        // Configure Draco
        // @ts-ignore - Ignoring type mismatch for now to match ModelLoader usage
        DracoCompression.Configuration = {
            wasmUrl: 'https://preview.babylonjs.com/draco_wasm_wrapper_gltf.js',
            wasmBinaryUrl: 'https://preview.babylonjs.com/draco_decoder_gltf.wasm',
            fallbackUrl: 'https://preview.babylonjs.com/draco_decoder_gltf.js',
        };
    });

    beforeEach(() => {
        engine = new BABYLON.NullEngine();
        scene = new BABYLON.Scene(engine);
        pipeline = new KinematicExtractionPipeline(scene);
    });

    it('should load a real GLB and detect joints', async () => {
        if (!fs.existsSync(GLB_PATH)) {
            console.warn(`Skipping test: GLB file not found at ${GLB_PATH}`);
            return;
        }

        console.log(`Loading GLB from: ${GLB_PATH}`);
        const data = fs.readFileSync(GLB_PATH);

        // Convert Buffer to Uint8Array (ArrayBufferView) for Babylon loader
        const arrayBufferView = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

        // Load Asset Container
        const container = await BABYLON.SceneLoader.LoadAssetContainerAsync("", arrayBufferView, scene, undefined, ".glb");

        console.log('GLB Loaded successfully.');
        container.addAllToScene();

        // Ensure world matrices are computed for the root
        const root = container.rootNodes[0] || scene.rootNodes[0];
        if (root) {
            root.computeWorldMatrix(true);
        }

        // Run Analysis
        console.log('Running Scene Analysis...');
        const toolGraph = await pipeline.analyzeScene({}, root);
        console.log(`Detected ${toolGraph.units.length} units.`);

        // Run Joint Detection
        console.log('Running Joint Detection...');
        const joints = await pipeline.detectJointsStatistically({ minConfidence: 0.1 });

        console.log(`Detected ${joints.length} joints.`);

        // Log details for manual verification
        joints.forEach((j, i) => {
            console.log(`Joint ${i}: ${j.deltaType} between ${j.nodeAId} and ${j.nodeBId}, Angle: ${(j.angleDeg ?? 0).toFixed(2)} deg`);
        });

        // Basic assertions
        expect(toolGraph.units.length).toBeGreaterThan(0);

        // Note: We don't strictly assert joint count > 0 yet as we don't know if this specific file has joints
        // But we check that it runs without error.
    }, 60000); // Increase timeout for network/parsing
});
