import { describe, it, expect } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { extractJointFromTransform } from '../../src/babylon/pointCloud/JointExtractor';
import type { ICPResult } from '../../src/babylon/pointCloud/ICP';

// ============================================================================
// Test Helper Functions
// ============================================================================

/**
 * Create a rotation matrix around a pivot point.
 * For row-vector convention (Babylon.js): p' = p * T(-pivot) * R * T(pivot)
 */
function createRotationAroundPivot(
    axis: BABYLON.Vector3,
    pivot: BABYLON.Vector3,
    angleRadians: number
): BABYLON.Matrix {
    const quaternion = BABYLON.Quaternion.RotationAxis(axis.normalize(), angleRadians);
    const rotationMatrix = BABYLON.Matrix.Identity();
    BABYLON.Matrix.FromQuaternionToRef(quaternion, rotationMatrix);

    const toOrigin = BABYLON.Matrix.Translation(-pivot.x, -pivot.y, -pivot.z);
    const fromOrigin = BABYLON.Matrix.Translation(pivot.x, pivot.y, pivot.z);

    return toOrigin.multiply(rotationMatrix).multiply(fromOrigin);
}

/**
 * Create a pure translation matrix.
 */
function createTranslation(translation: BABYLON.Vector3): BABYLON.Matrix {
    return BABYLON.Matrix.Translation(translation.x, translation.y, translation.z);
}

/**
 * Generate points on a circle in the XY plane around a center.
 */
function generateCirclePoints(
    center: BABYLON.Vector3,
    radius: number,
    numPoints: number
): BABYLON.Vector3[] {
    const points: BABYLON.Vector3[] = [];
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        const x = center.x + radius * Math.cos(angle);
        const y = center.y + radius * Math.sin(angle);
        const z = center.z;
        points.push(new BABYLON.Vector3(x, y, z));
    }
    return points;
}

/**
 * Check if two numbers are almost equal.
 */
function almostEqual(a: number, b: number, eps: number = 1e-3): boolean {
    return Math.abs(a - b) < eps;
}

/**
 * Check if two vectors are almost equal.
 */
function almostEqualVec3(
    a: BABYLON.Vector3,
    b: BABYLON.Vector3,
    eps: number = 1e-3
): boolean {
    return (
        Math.abs(a.x - b.x) < eps &&
        Math.abs(a.y - b.y) < eps &&
        Math.abs(a.z - b.z) < eps
    );
}

/**
 * Check if two vectors are parallel (same or opposite direction).
 */
function parallelVectors(
    a: BABYLON.Vector3,
    b: BABYLON.Vector3,
    eps: number = 1e-2
): boolean {
    const aNorm = a.normalize();
    const bNorm = b.normalize();
    const dot = Math.abs(BABYLON.Vector3.Dot(aNorm, bNorm));
    return Math.abs(dot - 1) < eps;
}

// ============================================================================
// Unit Tests for Orbit-Based Hinge Solver
// ============================================================================

describe('JointExtractor - Orbit-Based Hinge Solver', () => {
    describe('Test Case 1: Simple Hinge Around Origin', () => {
        it('should correctly identify revolute joint with pivot at origin', () => {
            const axis = new BABYLON.Vector3(0, 0, 1);
            const pivot = new BABYLON.Vector3(0, 0, 0);
            const stepAngleRad = (10 * Math.PI) / 180; // 10 degrees

            const radius = 0.1;
            const retractedPoints = generateCirclePoints(pivot, radius, 12);
            const transform = createRotationAroundPivot(axis, pivot, stepAngleRad);

            const icpResult: ICPResult = {
                success: true,
                transform,
                rmsError: 0.0001,
                iterations: 10,
                correspondences: retractedPoints.length,
            };

            // New signature: no centroid parameter
            const joint = extractJointFromTransform(icpResult, retractedPoints);

            expect(joint).not.toBeNull();
            expect(joint!.type).toBe('hinge');
            expect(almostEqualVec3(joint!.anchor, pivot, 0.005)).toBe(true); // 5mm tolerance
            expect(parallelVectors(joint!.axis, axis)).toBe(true);
            expect(almostEqual(joint!.magnitude, stepAngleRad, 0.01)).toBe(true);

            // Orbit-based solver should provide fromVector/toVector
            expect(joint!.fromVector).toBeDefined();
            expect(joint!.toVector).toBeDefined();
        });
    });

    describe('Test Case 2: Offset Hinge (Non-Zero Pivot)', () => {
        it('should correctly identify revolute joint with offset pivot', () => {
            const axis = new BABYLON.Vector3(0, 0, 1);
            const pivot = new BABYLON.Vector3(0.1, 0, 0);
            const stepAngleRad = (15 * Math.PI) / 180;

            const radius = 0.05;
            const retractedPoints = generateCirclePoints(pivot, radius, 15);
            const transform = createRotationAroundPivot(axis, pivot, stepAngleRad);

            const icpResult: ICPResult = {
                success: true,
                transform,
                rmsError: 0.0001,
                iterations: 10,
                correspondences: retractedPoints.length,
            };

            const joint = extractJointFromTransform(icpResult, retractedPoints);

            expect(joint).not.toBeNull();
            expect(joint!.type).toBe('hinge');
            expect(almostEqualVec3(joint!.anchor, pivot, 0.005)).toBe(true);
            expect(parallelVectors(joint!.axis, axis)).toBe(true);
            expect(almostEqual(joint!.magnitude, stepAngleRad, 0.01)).toBe(true);
        });
    });

    describe('Test Case 3: Pure Prismatic Slide', () => {
        it('should correctly identify prismatic joint with pure translation', () => {
            const translationVec = new BABYLON.Vector3(0.02, 0, 0);

            const retractedPoints: BABYLON.Vector3[] = [];
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    retractedPoints.push(
                        new BABYLON.Vector3(0, i * 0.01 - 0.015, j * 0.01 - 0.015)
                    );
                }
            }

            const transform = createTranslation(translationVec);

            const icpResult: ICPResult = {
                success: true,
                transform,
                rmsError: 0.0001,
                iterations: 5,
                correspondences: retractedPoints.length,
            };

            const joint = extractJointFromTransform(icpResult, retractedPoints);

            expect(joint).not.toBeNull();
            expect(joint!.type).toBe('prismatic');
            expect(parallelVectors(joint!.axis, translationVec.normalize())).toBe(true);
            expect(almostEqual(joint!.magnitude, 0.02, 1e-3)).toBe(true);

            // Prismatic joints should NOT have fromVector/toVector
            expect(joint!.fromVector).toBeUndefined();
            expect(joint!.toVector).toBeUndefined();
        });
    });

    describe('Test Case 4: No Motion', () => {
        it('should return null for identical point clouds (no motion)', () => {
            const retractedPoints: BABYLON.Vector3[] = [];
            for (let i = 0; i < 20; i++) {
                retractedPoints.push(
                    new BABYLON.Vector3(
                        (i * 0.37) % 0.1,
                        (i * 0.53) % 0.1,
                        (i * 0.71) % 0.1
                    )
                );
            }

            const transform = BABYLON.Matrix.Identity();

            const icpResult: ICPResult = {
                success: true,
                transform,
                rmsError: 0.0001,
                iterations: 1,
                correspondences: retractedPoints.length,
            };

            const joint = extractJointFromTransform(icpResult, retractedPoints);

            expect(joint).toBeNull();
        });
    });

    describe('Test Case 5: Near-Zero Rotation (Below Threshold)', () => {
        it('should return null for rotation below threshold', () => {
            const axis = new BABYLON.Vector3(0, 1, 0);
            const pivot = new BABYLON.Vector3(0, 0, 0);
            const tinyAngleRad = (0.5 * Math.PI) / 180; // 0.5 degrees < 1 degree threshold

            const retractedPoints = generateCirclePoints(pivot, 0.1, 12);
            const transform = createRotationAroundPivot(axis, pivot, tinyAngleRad);

            const icpResult: ICPResult = {
                success: true,
                transform,
                rmsError: 0.0001,
                iterations: 5,
                correspondences: retractedPoints.length,
            };

            const joint = extractJointFromTransform(icpResult, retractedPoints);

            expect(joint).toBeNull();
        });
    });

    describe('Test Case 6: Mixed Rotation and Translation', () => {
        it('should classify as revolute when rotation exceeds threshold', () => {
            const axis = new BABYLON.Vector3(0, 0, 1);
            const pivot = new BABYLON.Vector3(0, 0, 0);
            const angleRad = (10 * Math.PI) / 180;

            const retractedPoints = generateCirclePoints(pivot, 0.1, 12);
            const rotationTransform = createRotationAroundPivot(axis, pivot, angleRad);
            const translationTransform = createTranslation(new BABYLON.Vector3(0.001, 0, 0));
            const transform = rotationTransform.multiply(translationTransform);

            const icpResult: ICPResult = {
                success: true,
                transform,
                rmsError: 0.0001,
                iterations: 10,
                correspondences: retractedPoints.length,
            };

            const joint = extractJointFromTransform(icpResult, retractedPoints);

            expect(joint).not.toBeNull();
            expect(joint!.type).toBe('hinge');
        });
    });

    describe('Test Case 7: Y-Axis Rotation Consistency', () => {
        it('should maintain consistent axis direction for Y-axis rotation', () => {
            const axis = new BABYLON.Vector3(0, 1, 0);
            const pivot = new BABYLON.Vector3(0, 0, 0);
            const angleRad = (20 * Math.PI) / 180;

            // Generate points in XZ plane (perpendicular to Y)
            const retractedPoints: BABYLON.Vector3[] = [];
            for (let i = 0; i < 15; i++) {
                const angle = (i / 15) * 2 * Math.PI;
                const radius = 0.08;
                retractedPoints.push(
                    new BABYLON.Vector3(
                        radius * Math.cos(angle),
                        0,
                        radius * Math.sin(angle)
                    )
                );
            }

            const transform = createRotationAroundPivot(axis, pivot, angleRad);

            const icpResult: ICPResult = {
                success: true,
                transform,
                rmsError: 0.0001,
                iterations: 10,
                correspondences: retractedPoints.length,
            };

            const joint = extractJointFromTransform(icpResult, retractedPoints);

            expect(joint).not.toBeNull();
            expect(joint!.type).toBe('hinge');
            expect(parallelVectors(joint!.axis, axis)).toBe(true);
        });
    });
});
