/**
 * Joint Detection Validation Script
 * 
 * Loads real GLB models, runs ICP-based joint detection via StructureBasedToolAnalyzer,
 * and generates JSON reports for debugging and validation.
 * 
 * Usage:
 *   KINETICORE_DATA_ROOT=C:\path\to\data npx tsx scripts/validateJointDetection.ts [fixtureId]
 * 
 * NO "car line" concepts - all in tooling/model origin space.
 */

// Babylon.js Node.js polyfills
import xhr2 from 'xhr2';
if (!(globalThis as any).XMLHttpRequest) {
    (globalThis as any).XMLHttpRequest = xhr2;
}

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
if (!(globalThis as any).require) {
    (globalThis as any).require = require;
}

import path from 'node:path';
const dracoAssetDir = path.resolve(process.cwd(), 'node_modules', '@babylonjs', 'core', 'assets', 'Draco');
if (!(globalThis as any).__dirname) {
    (globalThis as any).__dirname = dracoAssetDir;
}
if (!(globalThis as any).__filename) {
    (globalThis as any).__filename = path.join(dracoAssetDir, 'draco_wasm_wrapper_gltf.js');
}

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import * as fs from 'node:fs';
import { StructureBasedToolAnalyzer } from '../src/babylon/sceneAnalysis/StructureBasedToolAnalyzer';

type JointReport = {
    fixtureId: string;
    timestamp: string;
    modelPath: string;
    joints: Array<{
        unitId: string;
        unitName: string;
        jointId: string;
        type: 'revolute' | 'prismatic' | 'unknown';
        axis: [number, number, number] | null;
        anchor: [number, number, number] | null;
        magnitude: number | null;
        confidence: number | null;
        rmsError: number | null;
        familyId: string;
    }>;
    summary: {
        totalJoints: number;
        revolute: number;
        prismatic: number;
        unknown: number;
        byConfidence: { high: number; medium: number; low: number };
    };
};

const FIXTURES = [
    { id: '016ZF_140_CI00', path: 'Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_CI00.glb' },
    { id: '8X_140_1E1_LH', path: 'Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_1E1_LH.glb' },
    { id: '8X_140_2E1_RH', path: 'Tooling/testing_data/8X-140_GEO/016ZF_20142435_140_2E1_CI00.glb' },
];

async function createHeadlessScene(): Promise<{ engine: BABYLON.NullEngine; scene: BABYLON.Scene }> {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    return { engine, scene };
}

async function loadGLB(scene: BABYLON.Scene, glbPath: string): Promise<BABYLON.TransformNode | null> {
    return new Promise((resolve) => {
        BABYLON.SceneLoader.ImportMesh('', '', `file://${glbPath}`, scene, (meshes) => {
            const root = scene.getTransformNodeByName('__root__') ||
                scene.transformNodes.find(n => n.name.includes('Scene') || n.name.includes('ROOT'));

            if (!root) {
                console.warn('No root node found');
                resolve(null);
                return;
            }

            resolve(root);
        }, undefined, (scene, message) => {
            console.error('GLB load error:', message);
            resolve(null);
        });
    });
}

async function validateFixture(fixtureId: string, fixturePath: string): Promise<JointReport | null> {
    const dataRoot = process.env.KINETICORE_DATA_ROOT;
    if (!dataRoot) {
        console.error('KINETICORE_DATA_ROOT not set');
        return null;
    }

    const fullPath = path.join(dataRoot, fixturePath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`Fixture not found: ${fullPath}`);
        return null;
    }

    console.log(`\n[ValidateJoints] Loading: ${fixtureId}`);
    console.log(`[ValidateJoints] Path: ${fullPath}`);

    const { engine, scene } = await createHeadlessScene();
    const root = await loadGLB(scene, fullPath);

    if (!root) {
        engine.dispose();
        return null;
    }

    console.log(`[ValidateJoints] Running StructureBasedToolAnalyzer...`);

    const analyzer = new StructureBasedToolAnalyzer();
    await analyzer.analyze(scene, { verbose: false }, root);

    const detectedJoints = analyzer.getDetectedToolJoints();
    console.log(`[ValidateJoints] Detected ${detectedJoints.length} joints`);

    // Build report
    const joints = detectedJoints.map(j => ({
        unitId: j.unitId,
        unitName: j.unitId, // Unit name not exposed, use ID
        jointId: j.jointId,
        type: j.deltaType,
        axis: j.axis ? [j.axis.x, j.axis.y, j.axis.z] as [number, number, number] : null,
        anchor: j.fromCenter ? [j.fromCenter.x, j.fromCenter.y, j.fromCenter.z] as [number, number, number] : null,
        magnitude: j.angleDeg ?? j.translationMagnitude ?? null,
        confidence: null, // Not exposed in DetectedToolJoint
        rmsError: j.icpError,
        familyId: j.familyId,
    }));

    // Compute summary
    const revolute = joints.filter(j => j.type === 'revolute').length;
    const prismatic = joints.filter(j => j.type === 'prismatic').length;
    const unknown = joints.filter(j => j.type === 'unknown').length;

    // Confidence bins (using RMS error as proxy)
    const high = joints.filter(j => j.rmsError !== null && j.rmsError < 0.005).length;
    const medium = joints.filter(j => j.rmsError !== null && j.rmsError >= 0.005 && j.rmsError < 0.01).length;
    const low = joints.filter(j => j.rmsError !== null && j.rmsError >= 0.01).length;

    const report: JointReport = {
        fixtureId,
        timestamp: new Date().toISOString(),
        modelPath: fixturePath,
        joints,
        summary: {
            totalJoints: joints.length,
            revolute,
            prismatic,
            unknown,
            byConfidence: { high, medium, low },
        },
    };

    // Log per-unit summary
    const byUnit = new Map<string, typeof joints>();
    for (const joint of joints) {
        const list = byUnit.get(joint.unitId) || [];
        list.push(joint);
        byUnit.set(joint.unitId, list);
    }

    for (const [unitId, unitJoints] of byUnit) {
        const r = unitJoints.filter(j => j.type === 'revolute').length;
        const p = unitJoints.filter(j => j.type === 'prismatic').length;
        const u = unitJoints.filter(j => j.type === 'unknown').length;
        console.log(`[Joints] unit=${unitId} revolute=${r} prismatic=${p} unknown=${u}`);
    }

    engine.dispose();
    return report;
}

async function main() {
    const targetFixture = process.argv[2];

    const fixturesToRun = targetFixture
        ? FIXTURES.filter(f => f.id === targetFixture)
        : FIXTURES;

    if (fixturesToRun.length === 0) {
        console.error(`Fixture not found: ${targetFixture}`);
        console.log('Available fixtures:', FIXTURES.map(f => f.id).join(', '));
        process.exit(1);
    }

    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    for (const fixture of fixturesToRun) {
        const report = await validateFixture(fixture.id, fixture.path);

        if (!report) {
            console.warn(`Skipped: ${fixture.id}`);
            continue;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(reportsDir, `joints_${fixture.id}_${timestamp}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`[ValidateJoints] Report saved: ${reportPath}\n`);
    }

    console.log('[ValidateJoints] Validation complete');
}

main().catch(console.error);
