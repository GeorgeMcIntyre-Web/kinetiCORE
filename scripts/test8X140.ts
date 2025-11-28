/**
 * Direct test script for ALL tooling fixtures
 * Tests Statistical Pairing Engine on real production tooling models
 *
 * Models tested:
 * - 8X-140-1E1_LH (Side tooling, left hand)
 * - 8X-140-2E1_RH (Side tooling, right hand)
 * - GJR_RR_FLOOR_CM030 (Floor tooling)
 * - 016ZF_110 (110 series tooling)
 *
 * Run with: npx tsx scripts/testAllTooling.ts
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { GLTF2 } from '@babylonjs/loaders';
import { KinematicExtractionPipeline } from '../src/babylon/pipeline/KinematicExtractionPipeline';
import type { DetectedToolJoint } from '../src/babylon/sceneAnalysis/ToolingTypes';
import * as fs from 'fs';

console.log('⚙️  Configuring glTF loader for Node.js environment...');

// Disable Draco compression extension (not supported in Node.js)
GLTF2.GLTFLoader.RegisterExtension('KHR_draco_mesh_compression', () => null);

const TEST_FIXTURES = [
    {
        name: '8X-140-1E1_LH',
        path: String.raw`C:\Users\George\source\repos\kinetiCORE_DATA\Tooling_testing_data\8X-140-1E1_LH\016ZF_20142435_140_1E1_CI00.glb`,
        type: '8X-140 Side Tooling (LH)',
    },
    {
        name: '8X-140-2E1_RH',
        path: String.raw`C:\Users\George\source\repos\kinetiCORE_DATA\Tooling_testing_data\8X-140-2E1_RH\016ZF_20142435_140_2E1_CI00.glb`,
        type: '8X-140 Side Tooling (RH)',
    },
    {
        name: 'GJR_RR_FLOOR_CM030',
        path: String.raw`C:\Users\George\source\repos\kinetiCORE_DATA\Tooling_testing_data\2174530000_M00_GJR_RR FLR_CM030_T01\2174530000_M00_GJR_RR FLR_CM030_T01.glb`,
        type: 'Floor Tooling (GJR RR)',
    },
    {
        name: '016ZF_110',
        path: String.raw`C:\Users\George\source\repos\kinetiCORE_DATA\Tooling_testing_data\016ZF_20142452_110\016ZF_20142452_110.glb`,
        type: '110 Series Tooling',
    },
];

async function loadGLB(scene: BABYLON.Scene, filePath: string) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    console.log(`\n📦 Loading: ${filePath}`);
    const data = fs.readFileSync(filePath);
    const arrayBufferView = new Uint8Array(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    );

    // Disable Draco compression for Node.js environment
    const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
        "",
        arrayBufferView,
        scene,
        (evt) => {
            // Optional progress callback
        },
        ".glb"
    );

    // Note: If models use Draco compression, they won't load in Node.js
    // Consider re-exporting models without Draco compression for testing
    console.log('   ✅ GLB loaded');
    container.addAllToScene();

    const root = container.rootNodes[0] || scene.rootNodes[0];
    if (root) {
        root.computeWorldMatrix(true);
    }

    return root;
}

async function analyzeFixture(fixtureName: string, filePath: string) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`ANALYZING: ${fixtureName}`);
    console.log(`${'='.repeat(80)}`);

    try {
        // Setup
        const engine = new BABYLON.NullEngine();
        const scene = new BABYLON.Scene(engine);
        const pipeline = new KinematicExtractionPipeline(scene);

        // Load
        const root = await loadGLB(scene, filePath);

        // Analyze
        console.log('\n🔍 Stage 1: Scene Analysis');
        const toolGraph = await pipeline.analyzeScene({}, root);
        console.log(`   Units detected: ${toolGraph.units.length}`);

        toolGraph.units.forEach((unit, i) => {
            console.log(`   - Unit ${i + 1}: ${unit.id} (${unit.nodeCount} nodes)`);
        });

        // Detect Joints
        console.log('\n🔍 Stage 2: Joint Detection');
        const joints = await pipeline.detectJointsStatistically({
            minConfidence: 0.1,
            useProfessionalICP: false,
        });

        console.log(`   Joints detected: ${joints.length}`);

        // Classify
        const revolute = joints.filter(j => j.deltaType === 'revolute');
        const prismatic = joints.filter(j => j.deltaType === 'prismatic');

        console.log(`   - Revolute: ${revolute.length}`);
        console.log(`   - Prismatic: ${prismatic.length}`);

        // Details
        if (joints.length > 0) {
            console.log('\n📋 Joint Details:');
            console.log(`${'─'.repeat(80)}`);
            joints.forEach((j, i) => {
                const angle = j.angleDeg ? `${j.angleDeg.toFixed(1)}°` : 'N/A';
                const travel = j.travelWorld ? `${(j.travelWorld * 1000).toFixed(1)}mm` : 'N/A';
                console.log(
                    `   J${i + 1}: ${j.deltaType.toUpperCase().padEnd(10)} | ` +
                    `${j.nodeAId.slice(0, 20).padEnd(20)} → ${j.nodeBId.slice(0, 20).padEnd(20)} | ` +
                    `Motion: ${angle}/${travel} | Conf: ${j.confidence.toFixed(2)}`
                );
            });
            console.log(`${'─'.repeat(80)}`);
        }

        // Summary
        console.log('\n📊 Summary:');
        console.log(`   Units: ${toolGraph.units.length}`);
        console.log(`   Joints: ${joints.length} (${revolute.length} revolute, ${prismatic.length} prismatic)`);
        console.log(`   Avg Confidence: ${joints.length > 0 ? (joints.reduce((sum, j) => sum + j.confidence, 0) / joints.length).toFixed(2) : 'N/A'}`);

        return {
            success: true,
            units: toolGraph.units.length,
            joints: joints.length,
            revoluteJoints: revolute.length,
            prismaticJoints: prismatic.length,
            avgConfidence: joints.length > 0 ? joints.reduce((sum, j) => sum + j.confidence, 0) / joints.length : 0,
        };

    } catch (error) {
        console.error(`\n❌ Error analyzing ${fixtureName}:`, error);
        return {
            success: false,
            units: 0,
            joints: 0,
            revoluteJoints: 0,
            prismaticJoints: 0,
            avgConfidence: 0,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function main() {
    console.log('\n' + '='.repeat(80));
    console.log('STATISTICAL PAIRING ENGINE - FULL TOOLING TEST SUITE');
    console.log('Testing on 4 real production tooling models');
    console.log('='.repeat(80));

    const results = [];

    for (const fixture of TEST_FIXTURES) {
        const result = await analyzeFixture(fixture.name, fixture.path);
        results.push({ ...fixture, ...result });
    }

    // Comparative Analysis
    console.log('\n' + '='.repeat(80));
    console.log('COMPARATIVE ANALYSIS - ALL FIXTURES');
    console.log('='.repeat(80));

    // Table header
    console.log('\n' + '─'.repeat(100));
    console.log(`${'Fixture'.padEnd(25)} | ${'Type'.padEnd(25)} | ${'Units'.padEnd(6)} | ${'Joints'.padEnd(8)} | ${'Rev'.padEnd(4)} | ${'Pris'.padEnd(4)} | ${'Conf'.padEnd(5)} | ${'Status'.padEnd(8)}`);
    console.log('─'.repeat(100));

    results.forEach(r => {
        const name = r.name.slice(0, 24).padEnd(25);
        const type = r.type.slice(0, 24).padEnd(25);
        const units = String(r.units).padEnd(6);
        const joints = String(r.joints).padEnd(8);
        const rev = String(r.revoluteJoints).padEnd(4);
        const pris = String(r.prismaticJoints).padEnd(4);
        const conf = r.avgConfidence.toFixed(2).padEnd(5);
        const status = (r.success ? '✅ OK' : '❌ FAIL').padEnd(8);

        console.log(`${name} | ${type} | ${units} | ${joints} | ${rev} | ${pris} | ${conf} | ${status}`);
    });

    console.log('─'.repeat(100));

    // Summary statistics
    const successCount = results.filter(r => r.success).length;
    const totalUnits = results.reduce((sum, r) => sum + r.units, 0);
    const totalJoints = results.reduce((sum, r) => sum + r.joints, 0);
    const avgConfidence = results.length > 0
        ? results.filter(r => r.joints > 0).reduce((sum, r) => sum + r.avgConfidence, 0) / results.filter(r => r.joints > 0).length
        : 0;

    console.log('\n📊 Overall Statistics:');
    console.log(`   Fixtures Tested: ${results.length}`);
    console.log(`   Successful: ${successCount} / ${results.length} (${(successCount / results.length * 100).toFixed(0)}%)`);
    console.log(`   Total Units Detected: ${totalUnits}`);
    console.log(`   Total Joints Detected: ${totalJoints}`);
    console.log(`   Average Confidence: ${avgConfidence > 0 ? avgConfidence.toFixed(2) : 'N/A'}`);

    // Error summary
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
        console.log('\n⚠️  Errors:');
        errors.forEach(e => {
            console.log(`   ${e.name}: ${e.error}`);
        });
    }

    console.log('\n' + '='.repeat(80));
    console.log(`TEST ${successCount === results.length ? 'PASSED' : 'COMPLETED WITH ERRORS'}`);
    console.log('='.repeat(80) + '\n');

    // Exit code
    const allSuccess = results.every(r => r.success);
    process.exit(allSuccess ? 0 : 1);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
