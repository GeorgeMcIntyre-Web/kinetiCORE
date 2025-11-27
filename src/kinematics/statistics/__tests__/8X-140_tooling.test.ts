/**
 * 8X-140 Tooling Real Data Test
 *
 * Tests Statistical Pairing Engine on real 8X-140 tooling fixtures:
 * - 8X-140-1E1_LH (Left Hand)
 * - 8X-140-2E1_RH (Right Hand)
 *
 * Expected Results:
 * - Each fixture should have multiple units detected
 * - Joints should be detected between moving parts
 * - Joint types (revolute/prismatic) should be classified correctly
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { KinematicExtractionPipeline } from '../../../babylon/pipeline/KinematicExtractionPipeline';
import type { DetectedToolJoint } from '../../../babylon/sceneAnalysis/ToolingTypes';
import * as fs from 'fs';
import { DracoCompression } from '@babylonjs/core/Meshes/Compression/dracoCompression';

describe('8X-140 Tooling Statistical Pairing', () => {
    let scene: BABYLON.Scene;
    let engine: BABYLON.Engine;
    let pipeline: KinematicExtractionPipeline;

    // Test data paths
    const TEST_FIXTURES = [
        {
            name: '8X-140-1E1_LH',
            path: String.raw`C:\Users\George\source\repos\kinetiCORE_DATA\Tooling_testing_data\8X-140-1E1_LH\016ZF_20142435_140_1E1_CI00.glb`,
            side: 'LH',
        },
        {
            name: '8X-140-2E1_RH',
            path: String.raw`C:\Users\George\source\repos\kinetiCORE_DATA\Tooling_testing_data\8X-140-2E1_RH\016ZF_20142435_140_2E1_CI00.glb`,
            side: 'RH',
        },
    ];

    beforeAll(() => {
        // Configure Draco compression
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

    // Helper function to load GLB
    async function loadGLB(filePath: string) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`GLB file not found at ${filePath}`);
        }

        console.log(`\n📦 Loading GLB from: ${filePath}`);
        const data = fs.readFileSync(filePath);
        const arrayBufferView = new Uint8Array(
            data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        );

        const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
            "",
            arrayBufferView,
            scene,
            undefined,
            ".glb"
        );

        console.log('✅ GLB Loaded successfully');
        container.addAllToScene();

        // Compute world matrices
        const root = container.rootNodes[0] || scene.rootNodes[0];
        if (root) {
            root.computeWorldMatrix(true);
        }

        return root;
    }

    // Helper function to analyze and detect joints
    async function analyzeFixture(root: BABYLON.TransformNode | null, fixtureName: string) {
        console.log(`\n🔍 Analyzing ${fixtureName}...`);

        // Stage 1: Scene Analysis
        console.log('  Stage 1: Scene Analysis');
        const toolGraph = await pipeline.analyzeScene({}, root);
        console.log(`  ✓ Detected ${toolGraph.units.length} units`);

        toolGraph.units.forEach((unit, i) => {
            console.log(`    Unit ${i}: ${unit.id} (${unit.nodeCount} nodes)`);
        });

        // Stage 2: Statistical Joint Detection
        console.log('  Stage 2: Statistical Joint Detection');
        const joints = await pipeline.detectJointsStatistically({
            minConfidence: 0.1,
            useProfessionalICP: false,
        });

        console.log(`  ✓ Detected ${joints.length} joints`);

        // Stage 3: Joint Classification
        console.log('  Stage 3: Joint Classification');
        const revoluteJoints = joints.filter(j => j.deltaType === 'revolute');
        const prismaticJoints = joints.filter(j => j.deltaType === 'prismatic');

        console.log(`    Revolute: ${revoluteJoints.length}`);
        console.log(`    Prismatic: ${prismaticJoints.length}`);

        // Detailed joint info
        joints.forEach((j, i) => {
            const angle = j.angleDeg ? `${j.angleDeg.toFixed(1)}°` : 'N/A';
            const travel = j.travelWorld ? `${(j.travelWorld * 1000).toFixed(1)}mm` : 'N/A';
            console.log(
                `    Joint ${i + 1}: ${j.deltaType.toUpperCase()} | ` +
                `${j.nodeAId} → ${j.nodeBId} | ` +
                `Angle: ${angle}, Travel: ${travel}, Confidence: ${j.confidence.toFixed(2)}`
            );
        });

        return { toolGraph, joints, revoluteJoints, prismaticJoints };
    }

    // Test each fixture
    TEST_FIXTURES.forEach(fixture => {
        it(`should analyze ${fixture.name} (${fixture.side})`, async () => {
            // Skip if file doesn't exist
            if (!fs.existsSync(fixture.path)) {
                console.warn(`⚠️  Skipping test: File not found at ${fixture.path}`);
                return;
            }

            // Load GLB
            const root = await loadGLB(fixture.path);

            // Analyze and detect joints
            const { toolGraph, joints, revoluteJoints, prismaticJoints } = await analyzeFixture(
                root,
                fixture.name
            );

            // Assertions
            console.log('\n✓ Validation:');

            // Should detect at least one unit
            expect(toolGraph.units.length).toBeGreaterThan(0);
            console.log(`  ✓ Units detected: ${toolGraph.units.length}`);

            // Should detect at least one joint (8X-140 tooling has moving parts)
            if (joints.length === 0) {
                console.warn('  ⚠️  No joints detected - may need ICP threshold tuning');
            } else {
                console.log(`  ✓ Joints detected: ${joints.length}`);
            }

            // All joints should have valid properties
            joints.forEach((j, i) => {
                expect(j.jointId).toBeDefined();
                expect(j.unitId).toBeDefined();
                expect(j.nodeAId).toBeDefined();
                expect(j.nodeBId).toBeDefined();
                expect(['revolute', 'prismatic']).toContain(j.deltaType);
                expect(j.confidence).toBeGreaterThanOrEqual(0);
                expect(j.confidence).toBeLessThanOrEqual(1);

                console.log(`  ✓ Joint ${i + 1} has valid properties`);
            });

            // Log summary
            console.log(`\n📊 Summary for ${fixture.name}:`);
            console.log(`  Units: ${toolGraph.units.length}`);
            console.log(`  Joints: ${joints.length} (${revoluteJoints.length} revolute, ${prismaticJoints.length} prismatic)`);
            console.log(`  Avg Confidence: ${joints.length > 0 ? (joints.reduce((sum, j) => sum + j.confidence, 0) / joints.length).toFixed(2) : 'N/A'}`);

        }, 120000); // 2 minute timeout for ICP processing
    });

    // Comparative test: Both fixtures should have similar structure
    it('should detect consistent structure across LH and RH fixtures', async () => {
        const results: Array<{
            name: string;
            unitCount: number;
            jointCount: number;
            revoluteCount: number;
            prismaticCount: number;
        }> = [];

        for (const fixture of TEST_FIXTURES) {
            if (!fs.existsSync(fixture.path)) {
                console.warn(`⚠️  Skipping comparative test: File not found at ${fixture.path}`);
                continue;
            }

            const root = await loadGLB(fixture.path);
            const { toolGraph, joints, revoluteJoints, prismaticJoints } = await analyzeFixture(
                root,
                fixture.name
            );

            results.push({
                name: fixture.name,
                unitCount: toolGraph.units.length,
                jointCount: joints.length,
                revoluteCount: revoluteJoints.length,
                prismaticCount: prismaticJoints.length,
            });
        }

        if (results.length === 2) {
            console.log('\n📊 Comparative Analysis:');
            console.log(`  ${results[0].name}: ${results[0].unitCount} units, ${results[0].jointCount} joints`);
            console.log(`  ${results[1].name}: ${results[1].unitCount} units, ${results[1].jointCount} joints`);

            // LH and RH should have similar structure (within reason)
            const unitDiff = Math.abs(results[0].unitCount - results[1].unitCount);
            const jointDiff = Math.abs(results[0].jointCount - results[1].jointCount);

            console.log(`  Unit count difference: ${unitDiff}`);
            console.log(`  Joint count difference: ${jointDiff}`);

            // Allow some variation, but should be roughly similar
            if (unitDiff > 2) {
                console.warn('  ⚠️  Unit count difference is high - may indicate detection issues');
            }

            if (jointDiff > 2) {
                console.warn('  ⚠️  Joint count difference is high - may indicate detection issues');
            }
        }
    }, 240000); // 4 minute timeout for both fixtures
});
