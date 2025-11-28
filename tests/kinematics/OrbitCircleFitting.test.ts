import * as BABYLON from '@babylonjs/core';
import {
    computeBoundingBox,
    computeCovarianceMatrix,
    computeSmallestEigenvector,
    computeOrthogonal,
    projectToPlane,
    fit2DCircle,
    mapFrom2DToPlane,
} from '../../src/babylon/kinematics/JointMath';

describe('Orbit-Based Circle Fitting Helpers', () => {
    describe('computeBoundingBox', () => {
        it('should compute correct bounding box for simple points', () => {
            const points = [
                new BABYLON.Vector3(0, 0, 0),
                new BABYLON.Vector3(1, 0, 0),
                new BABYLON.Vector3(0, 1, 0),
                new BABYLON.Vector3(0, 0, 1),
            ];

            const bbox = computeBoundingBox(points);

            expect(bbox.min.x).toBeCloseTo(0);
            expect(bbox.min.y).toBeCloseTo(0);
            expect(bbox.min.z).toBeCloseTo(0);
            expect(bbox.max.x).toBeCloseTo(1);
            expect(bbox.max.y).toBeCloseTo(1);
            expect(bbox.max.z).toBeCloseTo(1);
            expect(bbox.center.x).toBeCloseTo(0.5);
            expect(bbox.center.y).toBeCloseTo(0.5);
            expect(bbox.center.z).toBeCloseTo(0.5);
        });

        it('should handle empty array', () => {
            const bbox = computeBoundingBox([]);
            expect(bbox.min.length()).toBe(0);
            expect(bbox.max.length()).toBe(0);
        });

        it('should handle negative coordinates', () => {
            const points = [
                new BABYLON.Vector3(-1, -2, -3),
                new BABYLON.Vector3(1, 2, 3),
            ];

            const bbox = computeBoundingBox(points);

            expect(bbox.min.x).toBeCloseTo(-1);
            expect(bbox.min.y).toBeCloseTo(-2);
            expect(bbox.min.z).toBeCloseTo(-3);
            expect(bbox.max.x).toBeCloseTo(1);
            expect(bbox.max.y).toBeCloseTo(2);
            expect(bbox.max.z).toBeCloseTo(3);
        });
    });

    describe('computeCovarianceMatrix', () => {
        it('should compute covariance for coplanar points (XY plane)', () => {
            // Points in XY plane (z=0)
            const points = [
                new BABYLON.Vector3(1, 0, 0),
                new BABYLON.Vector3(0, 1, 0),
                new BABYLON.Vector3(-1, 0, 0),
                new BABYLON.Vector3(0, -1, 0),
            ];
            const mean = new BABYLON.Vector3(0, 0, 0);

            const cov = computeCovarianceMatrix(points, mean);

            // Z variance should be zero (coplanar in XY)
            expect(cov[2][2]).toBeCloseTo(0, 5);
            // X and Y should have non-zero variance
            expect(Math.abs(cov[0][0])).toBeGreaterThan(0.1);
            expect(Math.abs(cov[1][1])).toBeGreaterThan(0.1);
            // Should be symmetric
            expect(cov[0][1]).toBeCloseTo(cov[1][0]);
            expect(cov[0][2]).toBeCloseTo(cov[2][0]);
            expect(cov[1][2]).toBeCloseTo(cov[2][1]);
        });

        it('should return zero matrix for empty points', () => {
            const cov = computeCovarianceMatrix([], BABYLON.Vector3.Zero());

            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    expect(cov[i][j]).toBe(0);
                }
            }
        });
    });

    describe('computeSmallestEigenvector', () => {
        it('should find normal to XY plane (smallest variance in Z)', () => {
            // Covariance for points in XY plane has smallest eigenvalue in Z direction
            const cov = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 0.0001], // Very small Z variance
            ];

            const normal = computeSmallestEigenvector(cov);

            // Should point roughly in ±Z direction
            expect(Math.abs(normal.z)).toBeGreaterThan(0.9);
            expect(Math.abs(normal.x)).toBeLessThan(0.2);
            expect(Math.abs(normal.y)).toBeLessThan(0.2);
            // Should be normalized
            expect(normal.length()).toBeCloseTo(1, 5);
        });

        it('should handle identity matrix (all equal variance)', () => {
            const cov = [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ];

            const normal = computeSmallestEigenvector(cov);

            // Any direction is valid, just check normalization
            expect(normal.length()).toBeCloseTo(1, 5);
        });
    });

    describe('computeOrthogonal', () => {
        it('should return vector orthogonal to X axis', () => {
            const v = new BABYLON.Vector3(1, 0, 0);
            const orth = computeOrthogonal(v);

            // Dot product should be zero (orthogonal)
            const dot = BABYLON.Vector3.Dot(v, orth);
            expect(Math.abs(dot)).toBeLessThan(0.001);
        });

        it('should return vector orthogonal to diagonal', () => {
            const v = new BABYLON.Vector3(1, 1, 1).normalize();
            const orth = computeOrthogonal(v);

            const dot = BABYLON.Vector3.Dot(v, orth);
            expect(Math.abs(dot)).toBeLessThan(0.001);
        });
    });

    describe('projectToPlane', () => {
        it('should project circle points onto XY plane', () => {
            // Circle in XY plane, radius 1, centered at origin
            const points = [
                new BABYLON.Vector3(1, 0, 0),
                new BABYLON.Vector3(0, 1, 0),
                new BABYLON.Vector3(-1, 0, 0),
                new BABYLON.Vector3(0, -1, 0),
            ];
            const normal = new BABYLON.Vector3(0, 0, 1); // Z-axis
            const center = BABYLON.Vector3.Zero();

            const projected = projectToPlane(points, normal, center);

            expect(projected.length).toBe(4);

            // Points on unit circle should have distance ~1 from center in 2D
            for (const p of projected) {
                const dist2D = Math.sqrt(p.u * p.u + p.v * p.v);
                expect(dist2D).toBeCloseTo(1, 5);
            }
        });

        it('should handle points already on plane', () => {
            const points = [
                new BABYLON.Vector3(1, 2, 5),
                new BABYLON.Vector3(3, 4, 5),
            ];
            const normal = new BABYLON.Vector3(0, 0, 1);
            const center = new BABYLON.Vector3(0, 0, 5);

            const projected = projectToPlane(points, normal, center);

            // Check that projected 2D distances match 3D distances (since already on plane)
            const dist3D = points[0].subtract(points[1]).length();
            const dist2D = Math.sqrt(
                (projected[0].u - projected[1].u) ** 2 +
                (projected[0].v - projected[1].v) ** 2
            );
            expect(dist2D).toBeCloseTo(dist3D, 4);
        });
    });

    describe('fit2DCircle', () => {
        it('should fit circle to perfect circular points', () => {
            // Unit circle centered at (2, 3)
            const centerU = 2;
            const centerV = 3;
            const radius = 1;
            const numPoints = 12;

            const points = [];
            for (let i = 0; i < numPoints; i++) {
                const angle = (i / numPoints) * 2 * Math.PI;
                points.push({
                    u: centerU + radius * Math.cos(angle),
                    v: centerV + radius * Math.sin(angle),
                });
            }

            const result = fit2DCircle(points);

            expect(result).not.toBeNull();
            expect(result!.centerU).toBeCloseTo(centerU, 2);
            expect(result!.centerV).toBeCloseTo(centerV, 2);
            expect(result!.radius).toBeCloseTo(radius, 2);
        });

        it('should handle circle at origin', () => {
            const radius = 5;
            const points = [
                { u: radius, v: 0 },
                { u: 0, v: radius },
                { u: -radius, v: 0 },
                { u: 0, v: -radius },
            ];

            const result = fit2DCircle(points);

            expect(result).not.toBeNull();
            expect(result!.centerU).toBeCloseTo(0, 2);
            expect(result!.centerV).toBeCloseTo(0, 2);
            expect(result!.radius).toBeCloseTo(radius, 2);
        });

        it('should return null for too few points', () => {
            const points = [
                { u: 0, v: 0 },
                { u: 1, v: 0 },
            ];

            const result = fit2DCircle(points);
            expect(result).toBeNull();
        });

        it('should handle noisy circular data', () => {
            // Circle with small noise
            const centerU = 1;
            const centerV = 2;
            const radius = 3;
            const noise = 0.05;

            const points = [];
            for (let i = 0; i < 20; i++) {
                const angle = (i / 20) * 2 * Math.PI;
                const r = radius + (Math.random() - 0.5) * noise;
                points.push({
                    u: centerU + r * Math.cos(angle),
                    v: centerV + r * Math.sin(angle),
                });
            }

            const result = fit2DCircle(points);

            expect(result).not.toBeNull();
            // With noise, allow larger tolerance
            expect(result!.centerU).toBeCloseTo(centerU, 1);
            expect(result!.centerV).toBeCloseTo(centerV, 1);
            expect(result!.radius).toBeCloseTo(radius, 1);
        });
    });

    describe('mapFrom2DToPlane', () => {
        it('should map 2D point back to 3D on XY plane', () => {
            const u = 3;
            const v = 4;
            const planeCenter = new BABYLON.Vector3(1, 2, 5);
            const uAxis = new BABYLON.Vector3(1, 0, 0);
            const vAxis = new BABYLON.Vector3(0, 1, 0);

            const point3D = mapFrom2DToPlane(u, v, planeCenter, uAxis, vAxis);

            expect(point3D.x).toBeCloseTo(1 + u, 5);
            expect(point3D.y).toBeCloseTo(2 + v, 5);
            expect(point3D.z).toBeCloseTo(5, 5);
        });

        it('should handle origin mapping', () => {
            const planeCenter = new BABYLON.Vector3(5, 6, 7);
            const uAxis = new BABYLON.Vector3(1, 0, 0);
            const vAxis = new BABYLON.Vector3(0, 1, 0);

            const point3D = mapFrom2DToPlane(0, 0, planeCenter, uAxis, vAxis);

            expect(point3D.x).toBeCloseTo(5, 5);
            expect(point3D.y).toBeCloseTo(6, 5);
            expect(point3D.z).toBeCloseTo(7, 5);
        });
    });

    describe('Full Integration: Circle Fitting Pipeline', () => {
        it('should correctly fit circle to 3D circular orbit', () => {
            // Create circular orbit in 3D space (tilted plane)
            const pivotWorld = new BABYLON.Vector3(10, 20, 30);
            const radius = 5;
            const planeNormal = new BABYLON.Vector3(1, 1, 0).normalize();

            // Create orthonormal basis on plane
            const tempU = new BABYLON.Vector3(0, 0, 1);
            const uAxis = BABYLON.Vector3.Cross(tempU, planeNormal).normalize();
            const vAxis = BABYLON.Vector3.Cross(planeNormal, uAxis).normalize();

            // Generate circular orbit
            const orbit: BABYLON.Vector3[] = [];
            const numPoints = 16;
            for (let i = 0; i < numPoints; i++) {
                const angle = (i / numPoints) * 2 * Math.PI;
                const u = radius * Math.cos(angle);
                const v = radius * Math.sin(angle);
                const point = pivotWorld.add(uAxis.scale(u)).add(vAxis.scale(v));
                orbit.push(point);
            }

            // Step 1: Compute mean
            const sum = orbit.reduce((acc, p) => acc.add(p), BABYLON.Vector3.Zero());
            const mean = sum.scale(1 / orbit.length);

            // Step 2: Compute covariance
            const cov = computeCovarianceMatrix(orbit, mean);

            // Step 3: Find plane normal
            const fittedNormal = computeSmallestEigenvector(cov);

            // Step 4: Project to plane
            const projected = projectToPlane(orbit, fittedNormal, mean);

            // Step 5: Fit 2D circle
            const points2D = projected.map(p => ({ u: p.u, v: p.v }));
            const circle2D = fit2DCircle(points2D);

            expect(circle2D).not.toBeNull();

            // Step 6: Map back to 3D
            const { uAxis: fitUAxis, vAxis: fitVAxis } = projected[0];
            const fittedPivot = mapFrom2DToPlane(
                circle2D!.centerU,
                circle2D!.centerV,
                mean,
                fitUAxis,
                fitVAxis
            );

            // Verify fitted pivot is close to original
            const pivotError = BABYLON.Vector3.Distance(fittedPivot, pivotWorld);
            expect(pivotError).toBeLessThan(0.1);

            // Verify fitted radius
            expect(circle2D!.radius).toBeCloseTo(radius, 1);

            // Verify fitted normal is parallel to original (dot product ≈ ±1)
            const normalAlignment = Math.abs(BABYLON.Vector3.Dot(fittedNormal, planeNormal));
            expect(normalAlignment).toBeGreaterThan(0.99);
        });
    });
});
