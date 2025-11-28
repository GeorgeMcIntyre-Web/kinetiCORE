import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { KinematicExtractionPipeline } from '../../../babylon/pipeline/KinematicExtractionPipeline';
import { PCLICPSolver } from '../../../babylon/pointCloud/PCLICPSolver';

// Mock PCLICPSolver
vi.mock('../../../babylon/pointCloud/PCLICPSolver', () => ({
    PCLICPSolver: {
        align: vi.fn()
    }
}));

describe('KinematicExtractionPipeline Integration', () => {
    let scene: BABYLON.Scene;
    let engine: BABYLON.Engine;
    let pipeline: KinematicExtractionPipeline;

    beforeEach(() => {
        // Setup headless Babylon scene
        engine = new BABYLON.NullEngine();
        scene = new BABYLON.Scene(engine);
        pipeline = new KinematicExtractionPipeline(scene);
        vi.clearAllMocks();
    });

    it('should detect a revolute joint between two units (simulating two states)', async () => {
        // 1. Setup Scene Graph with TWO states (Open/Closed)
        // Structure:
        // Root
        //  |- State1_Base (100 pts)
        //  |- State1_Arm  (50 pts)
        //  |- State2_Base (100 pts)
        //  |- State2_Arm  (50 pts)
        const root = new BABYLON.TransformNode('root', scene);

        // Helper to create a unit
        const createUnit = (name: string, points: number, parent: BABYLON.Node) => {
            const mesh = new BABYLON.Mesh(name, scene);
            mesh.parent = parent;
            const data = new Float32Array(points * 3);
            // Fill with some dummy data so bounds are valid
            for (let i = 0; i < data.length; i++) data[i] = Math.random();
            mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, data);
            return mesh;
        };

        // State 1 (Reference)
        const base1 = createUnit('base_1', 100, root);
        const arm1 = createUnit('arm_1', 50, root);

        // State 2 (Moved)
        const base2 = createUnit('base_2', 100, root);
        const arm2 = createUnit('arm_2', 50, root);

        // Apply transformation to Arm 2 to simulate rotation
        arm2.rotation.y = Math.PI / 4;

        // 2. Mock ICP Response
        (PCLICPSolver.align as any).mockImplementation(async (ptsA: any[], ptsB: any[]) => {
            if (ptsA.length === 50) {
                // Arm Pair -> Rotation
                return {
                    success: true,
                    transform: BABYLON.Matrix.RotationY(Math.PI / 4),
                    error: 0.01,
                    iterations: 10
                };
            } else {
                // Base Pair -> Identity (or close to it)
                return {
                    success: true,
                    transform: BABYLON.Matrix.Identity(),
                    error: 0.001,
                    iterations: 5
                };
            }
        });

        // 3. Run Analysis
        const toolGraph = await pipeline.analyzeScene({}, root);
        expect(toolGraph.units.length).toBe(4);

        // 4. Run Joint Detection
        const joints = await pipeline.detectJointsStatistically({ minConfidence: 0.1 });

        // 5. Verify
        const armJoint = joints.find(j => (j.angleDeg ?? 0) > 10); // Look for the one with rotation
        expect(armJoint).toBeDefined();
        expect(armJoint?.deltaType).toBe('revolute');
        expect(armJoint?.angleDeg).toBeCloseTo(45, 1);
    });
});
