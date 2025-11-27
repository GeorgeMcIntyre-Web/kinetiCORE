/**
 * 8X-140 Joint Validation Helper
 *
 * Quick script to load and validate joint detection on 8X-140 tooling fixtures.
 * Can be run in dev mode to inspect detected joints interactively.
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { KinematicExtractionPipeline } from '../babylon/pipeline/KinematicExtractionPipeline';
import type { DetectedToolJoint } from '../babylon/sceneAnalysis/ToolingTypes';
import * as fs from 'fs';

/**
 * Load and analyze a single 8X-140 fixture
 */
export async function validate8X140Fixture(
    glbPath: string,
    fixtureName: string = 'Unknown'
): Promise<{
    success: boolean;
    units: number;
    joints: DetectedToolJoint[];
    errors: string[];
}> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`8X-140 JOINT VALIDATION: ${fixtureName}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`File: ${glbPath}\n`);

    const errors: string[] = [];

    try {
        // Check file exists
        if (!fs.existsSync(glbPath)) {
            errors.push(`File not found: ${glbPath}`);
            return { success: false, units: 0, joints: [], errors };
        }

        // Create Babylon scene
        const engine = new BABYLON.NullEngine();
        const scene = new BABYLON.Scene(engine);
        const pipeline = new KinematicExtractionPipeline(scene);

        // Load GLB
        console.log('📦 Loading GLB...');
        const data = fs.readFileSync(glbPath);
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

        container.addAllToScene();
        const root = container.rootNodes[0] || scene.rootNodes[0];
        if (root) {
            root.computeWorldMatrix(true);
        }

        console.log('✅ GLB loaded\n');

        // Analyze scene
        console.log('🔍 Stage 1: Scene Analysis');
        const toolGraph = await pipeline.analyzeScene({}, root);
        console.log(`   Units detected: ${toolGraph.units.length}`);

        toolGraph.units.forEach((unit, i) => {
            console.log(`   - Unit ${i + 1}: ${unit.id} (${unit.nodeCount} nodes)`);
        });

        // Detect joints
        console.log('\n🔍 Stage 2: Statistical Joint Detection');
        const joints = await pipeline.detectJointsStatistically({
            minConfidence: 0.1,
            useProfessionalICP: false,
        });

        console.log(`   Joints detected: ${joints.length}\n`);

        // Classify joints
        const revolute = joints.filter(j => j.deltaType === 'revolute');
        const prismatic = joints.filter(j => j.deltaType === 'prismatic');

        console.log('📊 Joint Classification:');
        console.log(`   Revolute: ${revolute.length}`);
        console.log(`   Prismatic: ${prismatic.length}\n`);

        // Detailed joint report
        if (joints.length > 0) {
            console.log('📋 Detailed Joint Report:');
            console.log(`${'─'.repeat(80)}`);
            console.log(`${'ID'.padEnd(6)} | ${'Type'.padEnd(10)} | ${'From Node'.padEnd(20)} | ${'To Node'.padEnd(20)} | ${'Motion'.padEnd(12)} | ${'Conf'.padEnd(6)}`);
            console.log(`${'─'.repeat(80)}`);

            joints.forEach((j, i) => {
                const id = `J${i + 1}`.padEnd(6);
                const type = j.deltaType.toUpperCase().padEnd(10);
                const fromNode = j.nodeAId.slice(0, 20).padEnd(20);
                const toNode = j.nodeBId.slice(0, 20).padEnd(20);

                let motion = '';
                if (j.deltaType === 'revolute') {
                    motion = `${(j.angleDeg ?? 0).toFixed(1)}°`.padEnd(12);
                } else {
                    motion = `${((j.travelWorld ?? 0) * 1000).toFixed(1)}mm`.padEnd(12);
                }

                const conf = j.confidence.toFixed(2).padEnd(6);

                console.log(`${id} | ${type} | ${fromNode} | ${toNode} | ${motion} | ${conf}`);
            });

            console.log(`${'─'.repeat(80)}\n`);
        } else {
            console.log('⚠️  No joints detected - possible reasons:');
            console.log('   - ICP alignment threshold too strict');
            console.log('   - Insufficient geometric similarity between states');
            console.log('   - Model may not have moving parts in this configuration\n');
        }

        // Validation checks
        console.log('✓ Validation Checks:');

        if (toolGraph.units.length === 0) {
            errors.push('No units detected');
            console.log('   ❌ No units detected');
        } else {
            console.log(`   ✅ Units detected: ${toolGraph.units.length}`);
        }

        if (joints.length === 0) {
            errors.push('No joints detected (may need tuning)');
            console.log('   ⚠️  No joints detected (may need ICP threshold tuning)');
        } else {
            console.log(`   ✅ Joints detected: ${joints.length}`);
        }

        // Check joint validity
        let invalidJoints = 0;
        joints.forEach((j, i) => {
            if (!j.jointId || !j.unitId || !j.nodeAId || !j.nodeBId) {
                errors.push(`Joint ${i + 1} has missing IDs`);
                invalidJoints++;
            }
            if (j.confidence < 0 || j.confidence > 1) {
                errors.push(`Joint ${i + 1} has invalid confidence: ${j.confidence}`);
                invalidJoints++;
            }
        });

        if (invalidJoints === 0 && joints.length > 0) {
            console.log(`   ✅ All joints have valid properties`);
        } else if (invalidJoints > 0) {
            console.log(`   ❌ ${invalidJoints} joints have invalid properties`);
        }

        console.log('');

        // Summary
        console.log('📊 Summary:');
        console.log(`   Fixture: ${fixtureName}`);
        console.log(`   Units: ${toolGraph.units.length}`);
        console.log(`   Joints: ${joints.length} (${revolute.length} revolute, ${prismatic.length} prismatic)`);
        console.log(`   Avg Confidence: ${joints.length > 0 ? (joints.reduce((sum, j) => sum + j.confidence, 0) / joints.length).toFixed(2) : 'N/A'}`);
        console.log(`   Errors: ${errors.length}`);

        console.log(`\n${'='.repeat(80)}\n`);

        return {
            success: errors.length === 0,
            units: toolGraph.units.length,
            joints,
            errors,
        };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Exception: ${errorMsg}`);
        console.error('❌ Error during validation:', error);

        return {
            success: false,
            units: 0,
            joints: [],
            errors,
        };
    }
}

/**
 * Validate both LH and RH fixtures
 */
export async function validateBoth8X140Fixtures() {
    const fixtures = [
        {
            name: '8X-140-1E1_LH',
            path: String.raw`C:\Users\George\source\repos\kinetiCORE_DATA\Tooling_testing_data\8X-140-1E1_LH\016ZF_20142435_140_1E1_CI00.glb`,
        },
        {
            name: '8X-140-2E1_RH',
            path: String.raw`C:\Users\George\source\repos\kinetiCORE_DATA\Tooling_testing_data\8X-140-2E1_RH\016ZF_20142435_140_2E1_CI00.glb`,
        },
    ];

    const results = [];

    for (const fixture of fixtures) {
        const result = await validate8X140Fixture(fixture.path, fixture.name);
        results.push({ ...fixture, ...result });
    }

    // Comparative summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('COMPARATIVE ANALYSIS');
    console.log(`${'='.repeat(80)}\n`);

    results.forEach(r => {
        console.log(`${r.name}:`);
        console.log(`  Units: ${r.units}`);
        console.log(`  Joints: ${r.joints.length}`);
        console.log(`  Success: ${r.success ? '✅' : '❌'}`);
        if (r.errors.length > 0) {
            console.log(`  Errors:`);
            r.errors.forEach(e => console.log(`    - ${e}`));
        }
        console.log('');
    });

    if (results.length === 2) {
        const unitDiff = Math.abs(results[0].units - results[1].units);
        const jointDiff = Math.abs(results[0].joints.length - results[1].joints.length);

        console.log('Differences:');
        console.log(`  Unit count difference: ${unitDiff} ${unitDiff > 2 ? '⚠️' : '✅'}`);
        console.log(`  Joint count difference: ${jointDiff} ${jointDiff > 2 ? '⚠️' : '✅'}`);
    }

    console.log(`\n${'='.repeat(80)}\n`);

    return results;
}

// Export for use in dev console
if (typeof window !== 'undefined') {
    (window as any).validate8X140Fixture = validate8X140Fixture;
    (window as any).validateBoth8X140Fixtures = validateBoth8X140Fixtures;
}
