import { describe, it, expect } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { solvePivotPoint } from '../../src/babylon/kinematics/JointMath';

/**
 * Circle Fit Solver Verification Tests
 * 
 * Strictly verifies the mathematical correctness of the solvePivotPoint function
 * using synthetic data with known ground truth.
 */
describe('Circle Fit Solver (solvePivotPoint)', () => {
    it('should correctly identify pivot for 90-degree rotation around offset axis', () => {
        // 1. Setup Ground Truth
        const pivotTrue = new BABYLON.Vector3(5, 0, 0);
        const axis = new BABYLON.Vector3(0, 0, 1); // Z-axis
        const angle = Math.PI / 2; // 90 degrees

        // 2. Generate Synthetic "Cylinder" Points
        // Create a ring of points around the pivot at radius 2
        const pointsA: BABYLON.Vector3[] = [];
        const radius = 2;
        const numPoints = 8;

        for (let i = 0; i < numPoints; i++) {
            const theta = (i / numPoints) * Math.PI * 2;
            // Local point on circle
            const localX = Math.cos(theta) * radius;
            const localY = Math.sin(theta) * radius;

            // Offset by pivot to place in world space
            pointsA.push(new BABYLON.Vector3(
                pivotTrue.x + localX,
                pivotTrue.y + localY,
                0 // Planar for simplicity, but solver works in 3D
            ));
        }

        // Add some points at different Z heights to make it a "cylinder"
        const pointsA_3D = [...pointsA];
        pointsA.forEach(p => {
            pointsA_3D.push(new BABYLON.Vector3(p.x, p.y, 1));
            pointsA_3D.push(new BABYLON.Vector3(p.x, p.y, -1));
        });

        // 3. Generate Transformed Points (State B)
        // Rotate pointsA around pivotTrue by angle
        const pairs: [BABYLON.Vector3, BABYLON.Vector3][] = [];

        // Create rotation matrix around the pivot
        // T = T_pivot * R * T_inv_pivot
        const T_inv_pivot = BABYLON.Matrix.Translation(-pivotTrue.x, -pivotTrue.y, -pivotTrue.z);
        const R = BABYLON.Matrix.RotationAxis(axis, angle);
        const T_pivot = BABYLON.Matrix.Translation(pivotTrue.x, pivotTrue.y, pivotTrue.z);
        const transform = T_inv_pivot.multiply(R).multiply(T_pivot);

        for (const pA of pointsA_3D) {
            const pB = BABYLON.Vector3.TransformCoordinates(pA, transform);
            pairs.push([pA, pB]);
        }

        // 4. Run Solver
        // Centroid is just a fallback/hint, calculate it from pointsA
        const centroid = pointsA_3D.reduce((sum, p) => sum.add(p), BABYLON.Vector3.Zero()).scale(1 / pointsA_3D.length);

        const solvedPivot = solvePivotPoint(pairs, axis, centroid);

        // 5. Assertions
        console.log(`True Pivot: ${pivotTrue}`);
        console.log(`Solved Pivot: ${solvedPivot}`);

        expect(solvedPivot.x).toBeCloseTo(pivotTrue.x, 3); // 0.001 precision
        expect(solvedPivot.y).toBeCloseTo(pivotTrue.y, 3);
        expect(solvedPivot.z).toBeCloseTo(pivotTrue.z, 3);
    });

    it('should handle small rotations (10 degrees) with noise', () => {
        const pivotTrue = new BABYLON.Vector3(10, 5, -2);
        const axis = new BABYLON.Vector3(0, 1, 0); // Y-axis
        const angle = 10 * (Math.PI / 180); // 10 degrees

        // Generate random cloud
        const pairs: [BABYLON.Vector3, BABYLON.Vector3][] = [];
        const numPoints = 20;

        const T_inv_pivot = BABYLON.Matrix.Translation(-pivotTrue.x, -pivotTrue.y, -pivotTrue.z);
        const R = BABYLON.Matrix.RotationAxis(axis, angle);
        const T_pivot = BABYLON.Matrix.Translation(pivotTrue.x, pivotTrue.y, pivotTrue.z);
        const transform = T_inv_pivot.multiply(R).multiply(T_pivot);

        for (let i = 0; i < numPoints; i++) {
            const pA = new BABYLON.Vector3(
                Math.random() * 10,
                Math.random() * 10,
                Math.random() * 10
            );

            // Exact transform
            let pB = BABYLON.Vector3.TransformCoordinates(pA, transform);

            // Add tiny noise (0.1mm) to simulate sensor noise
            pB = pB.add(new BABYLON.Vector3(
                (Math.random() - 0.5) * 0.0001,
                (Math.random() - 0.5) * 0.0001,
                (Math.random() - 0.5) * 0.0001
            ));

            pairs.push([pA, pB]);
        }

        const centroid = new BABYLON.Vector3(5, 5, 5); // Arbitrary centroid
        const solvedPivot = solvePivotPoint(pairs, axis, centroid);

        // Project solved pivot onto axis to compare (since any point on axis is valid pivot)
        // But solvePivotPoint tries to find point closest to centroid plane or similar constraint.
        // Actually, solvePivotPoint uses an axis constraint. Let's check if it lies on the axis line.
        // Distance from point to line: |(P - A) x n| / |n| where A is point on line, n is direction.

        const vecToPivot = solvedPivot.subtract(pivotTrue);
        const cross = BABYLON.Vector3.Cross(vecToPivot, axis);
        const distToAxis = cross.length();

        expect(distToAxis).toBeLessThan(0.01); // 1cm tolerance with noise
    });
});
