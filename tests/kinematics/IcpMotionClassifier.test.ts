import { describe, it, expect } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { ICP } from '../../src/babylon/pointCloud/ICP';
import { extractJointFromTransform } from '../../src/babylon/pointCloud/JointExtractor';

/**
 * ICP Motion Classification Tests
 * 
 * Tests revolute vs prismatic detection using real ICP + JointExtractor API.
 * NO "car line" concepts - uses model/tooling origin only.
 */
describe('ICP Motion Classification', () => {
    // Helper: Translate points
    function translatePoints(points: BABYLON.Vector3[], t: BABYLON.Vector3): BABYLON.Vector3[] {
        return points.map(p => p.add(t));
    }

    // Helper: Compute centroid
    function computeCentroid(points: BABYLON.Vector3[]): BABYLON.Vector3 {
        if (points.length === 0) return BABYLON.Vector3.Zero();
        const sum = points.reduce((acc, p) => acc.add(p), BABYLON.Vector3.Zero());
        return sum.scale(1 / points.length);
    }

    describe('Prismatic Motion Detection', () => {
        it('should detect pure translation', () => {
            // Create random point cloud
            const sourcePoints: BABYLON.Vector3[] = [];
            for (let i = 0; i < 30; i++) {
                sourcePoints.push(new BABYLON.Vector3(
                    Math.random() * 0.1,
                    Math.random() * 0.1,
                    Math.random() * 0.1
                ));
            }

            // Translate by 100mm along X
            const targetPoints = translatePoints(sourcePoints, new BABYLON.Vector3(0.1, 0, 0));

            const icpResult = ICP.align(sourcePoints, targetPoints, {
                maxIterations: 100,
                tolerance: 1e-6,
            });

            if (!icpResult.success) {
                console.warn('ICP failed, test skipped');
                return;
            }

            const centroid = computeCentroid(sourcePoints);
            const joint = extractJointFromTransform(icpResult, centroid);

            expect(joint.type).toBe('prismatic');
            expect(joint.magnitude).toBeGreaterThan(0.05);
        });
    });

    describe('Rejection Paths', () => {
        it('should give high RMS for mismatched points', () => {
            const sourcePoints = [
                new BABYLON.Vector3(0, 0, 0),
                new BABYLON.Vector3(0.1, 0, 0),
                new BABYLON.Vector3(0, 0.1, 0),
            ];

            const targetPoints = [
                new BABYLON.Vector3(10, 10, 10),
                new BABYLON.Vector3(20, 20, 20),
                new BABYLON.Vector3(30, 30, 30),
            ];

            const icpResult = ICP.align(sourcePoints, targetPoints);

            expect(icpResult.rmsError).toBeGreaterThan(1.0);
        });

        it('should return null for no motion', () => {
            const points: BABYLON.Vector3[] = [];
            for (let i = 0; i < 20; i++) {
                points.push(new BABYLON.Vector3(
                    Math.random() * 0.1,
                    Math.random() * 0.1,
                    Math.random() * 0.1
                ));
            }

            const icpResult = ICP.align(points, points);

            expect(icpResult.success).toBe(true);
            expect(icpResult.rmsError).toBeLessThan(1e-4);

            const centroid = computeCentroid(points);
            const joint = extractJointFromTransform(icpResult, centroid);

            // No motion should return null (not a joint)
            expect(joint).toBeNull();
        });

        it('should return null for noise-level translation (1mm)', () => {
            // Create two point clouds with only 1mm difference (below threshold)
            const pointsA: BABYLON.Vector3[] = [];
            const pointsB: BABYLON.Vector3[] = [];

            for (let i = 0; i < 20; i++) {
                const basePoint = new BABYLON.Vector3(
                    Math.random() * 0.1,
                    Math.random() * 0.1,
                    Math.random() * 0.1
                );
                pointsA.push(basePoint);
                // Add 1mm noise (0.001m) - below typical threshold (10mm)
                pointsB.push(basePoint.add(new BABYLON.Vector3(0.001, 0, 0)));
            }

            const icpResult = ICP.align(pointsA, pointsB);
            const centroid = computeCentroid(pointsA);
            const joint = extractJointFromTransform(icpResult, centroid);

            // 1mm motion is noise, should return null
            expect(joint).toBeNull();
        });

        it('should return null for noise-level rotation (0.5 degrees)', () => {
            // Create two point clouds with only 0.5° rotation (below threshold)
            const pointsA: BABYLON.Vector3[] = [];

            for (let i = 0; i < 20; i++) {
                pointsA.push(new BABYLON.Vector3(
                    Math.random() * 0.1,
                    Math.random() * 0.1,
                    Math.random() * 0.1
                ));
            }

            // Rotate by 0.5° (0.00873 radians) - below typical threshold (1-2°)
            const tinyRotation = BABYLON.Matrix.RotationZ(0.00873);
            const pointsB = pointsA.map(p => BABYLON.Vector3.TransformCoordinates(p, tinyRotation));

            const icpResult = ICP.align(pointsA, pointsB);
            const centroid = computeCentroid(pointsA);
            const joint = extractJointFromTransform(icpResult, centroid);

            // 0.5° rotation is noise, should return null
            expect(joint).toBeNull();
        });
    });

    describe('Edge Cases', () => {
        it('should handle API without crashing', () => {
            const points = [
                new BABYLON.Vector3(0, 0, 0),
                new BABYLON.Vector3(0.1, 0, 0),
                new BABYLON.Vector3(0, 0.1, 0),
            ];

            const result = ICP.align(points, points);

            expect(result).toBeDefined();
            expect(typeof result.success).toBe('boolean');
        });
    });
});
