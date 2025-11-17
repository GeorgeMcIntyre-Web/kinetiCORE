import { describe, expect, it } from 'vitest';
import { Vector3 } from '../../src/core/types';
import { Route } from '../../src/routing/core/Route';
import { ConnectionPoint } from '../../src/routing/core/ConnectionPoint';
import {
  RouteConstraints,
  RouteSegment,
  MaterialSpec,
} from '../../src/routing/core/types';
import {
  ElevationRuleOptions,
  RouteValidator,
  evaluateElevationProfile,
} from '../../src/routing/validation/RouteValidator';

const BASE_CONSTRAINTS: RouteConstraints = {
  minBendRadius: 0.1,
  supportSpacing: 2,
  clearance: {
    walls: 0.1,
    ceiling: 0.1,
    floor: 0.1,
    otherInfrastructure: 0.1,
  },
};

const MATERIAL: MaterialSpec = { name: 'steel' };

const createConnectionPoint = (position: Vector3): ConnectionPoint =>
  new ConnectionPoint({
    type: 'pipe',
    position,
    direction: { x: 1, y: 0, z: 0 },
    specifications: {},
  });

const buildRoute = (
  segments: RouteSegment[],
  constraintOverrides: Partial<RouteConstraints> = {}
): Route => {
  const source = createConnectionPoint(segments[0].startPoint);
  const destination = createConnectionPoint(segments[segments.length - 1].endPoint);
  const constraints = { ...BASE_CONSTRAINTS, ...constraintOverrides };
  return new Route(source, destination, segments, MATERIAL, constraints);
};

describe('RouteValidator elevation rules', () => {
  describe('evaluateElevationProfile()', () => {
    it('treats floor-only routes as valid', () => {
      const points: Vector3[] = [
        { x: 0, y: 0, z: 0 },
        { x: 5, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ];

      const result = evaluateElevationProfile(points);
      expect(result.status).toBe('VALID');
      expect(result.violations).toHaveLength(0);
    });

    it('accepts elevated-only routes that respect span and delta limits', () => {
      const points: Vector3[] = [
        { x: 0, y: 0, z: 3 },
        { x: 5, y: 0, z: 3 },
        { x: 10, y: 0, z: 3 },
      ];

      const result = evaluateElevationProfile(points);
      expect(result.status).toBe('VALID');
    });

    it('warns when mixed elevation routes lack intermediate nodes', () => {
      const points: Vector3[] = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 2 },
      ];

      const options: ElevationRuleOptions = {
        allowMixedElevation: true,
        minNodesForMixedElevation: 3,
      };

      const result = evaluateElevationProfile(points, options);
      expect(result.status).toBe('WARNING');
      expect(result.violations.some((violation) => violation.severity === 'warning')).toBe(true);
    });

    it('throws an error when elevation delta exceeds the allowed maximum', () => {
      const points: Vector3[] = [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 3 },
      ];

      const result = evaluateElevationProfile(points, { maxElevationDelta: 1 });
      expect(result.status).toBe('ERROR');
      expect(result.violations[0].message).toContain('Elevation change');
    });

    it('errors when fewer nodes than the minimum are provided', () => {
      const points: Vector3[] = [{ x: 0, y: 0, z: 0 }];
      const result = evaluateElevationProfile(points, { minNodeCount: 2 });

      expect(result.status).toBe('ERROR');
      expect(result.violations[0].message).toContain('at least 2 nodes');
    });

    it('handles invalid waypoint coordinates gracefully', () => {
      const points: Vector3[] = [
        { x: 0, y: 0, z: 0 },
        { x: Number.NaN, y: 0, z: 1 },
      ];

      const result = evaluateElevationProfile(points);
      expect(result.status).toBe('ERROR');
      expect(result.violations.some((violation) => violation.severity === 'warning')).toBe(true);
    });
  });

  describe('RouteValidator integration', () => {
    it('flags zero-length segments as topology errors', () => {
      const segments: RouteSegment[] = [
        {
          id: 'degenerate',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 0, y: 0, z: 0 },
          segmentType: 'straight',
          length: 0,
        },
      ];

      const route = buildRoute(segments);
      const validator = new RouteValidator();
      const result = validator.validateRouteEnhanced(route, []);

      expect(result.status).toBe('error');
      expect(result.violations.some((violation) => violation.type === 'topology')).toBe(true);
    });

    it('reports elevation errors when route constraints restrict vertical delta', () => {
      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 2, y: 0, z: 0 },
          segmentType: 'straight',
          length: 2,
        },
        {
          id: 'seg2',
          startPoint: { x: 2, y: 0, z: 0 },
          endPoint: { x: 4, y: 0, z: 3 },
          segmentType: 'straight',
          length: Math.sqrt(13),
        },
      ];

      const route = buildRoute(segments, { maxElevationDelta: 1 });
      const validator = new RouteValidator();
      const result = validator.validateRouteEnhanced(route, []);

      expect(result.status).toBe('error');
      expect(result.violations.some((violation) => violation.type === 'elevation')).toBe(true);
    });

    it('accepts mixed elevation routes when enough nodes are present', () => {
      const segments: RouteSegment[] = [
        {
          id: 'seg1',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 2, y: 0, z: 0 },
          segmentType: 'straight',
          length: 2,
        },
        {
          id: 'seg2',
          startPoint: { x: 2, y: 0, z: 0 },
          endPoint: { x: 4, y: 0, z: 2 },
          segmentType: 'straight',
          length: Math.sqrt(8),
        },
        {
          id: 'seg3',
          startPoint: { x: 4, y: 0, z: 2 },
          endPoint: { x: 6, y: 0, z: 0 },
          segmentType: 'straight',
          length: Math.sqrt(8),
        },
      ];

      const route = buildRoute(segments, {
        allowMixedElevation: true,
        minNodesForMixedElevation: 3,
      });
      const validator = new RouteValidator();
      const result = validator.validateRouteEnhanced(route, []);

      expect(result.status).toBe('valid');
    });
  });
});
