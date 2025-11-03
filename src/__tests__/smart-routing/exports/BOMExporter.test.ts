import { describe, expect, it } from 'vitest';
import { BOMExporter } from '../../../exports/BOMExporter';
import { ConnectionPoint } from '../../../routing/core/ConnectionPoint';
import { Route } from '../../../routing/core/Route';
import type { ConnectionPointConfig, RouteSegment, SupportPoint } from '../../../routing/core/types';

function createConnectionPointConfig(overrides: Partial<ConnectionPointConfig>): ConnectionPointConfig {
  return {
    type: 'pipe',
    position: { x: 0, y: 0, z: 0 },
    direction: { x: 0, y: 0, z: 1 },
    specifications: { size: '3/4"', material: 'Steel' },
    ...overrides,
  };
}

describe('BOMExporter', () => {
  it('creates CSV output with totals for routes', () => {
    const source = new ConnectionPoint(createConnectionPointConfig({ position: { x: 0, y: 0, z: 0 } }));
    const destination = new ConnectionPoint(createConnectionPointConfig({ position: { x: 1.5, y: 0, z: 0 } }));

    const segments: RouteSegment[] = [
      {
        id: 'seg-1',
        startPoint: source.getPosition(),
        endPoint: { x: 1, y: 0, z: 0 },
        segmentType: 'straight',
        length: 1,
      },
      {
        id: 'seg-2',
        startPoint: { x: 1, y: 0, z: 0 },
        endPoint: destination.getPosition(),
        segmentType: 'bend',
        bendRadius: 0.1,
        length: 0.5,
      },
    ];

    const supports: SupportPoint[] = [
      {
        id: 'sup-1',
        position: { x: 0.5, y: 0, z: 0 },
        type: 'hanger',
        specification: 'Clamp',
      },
      {
        id: 'sup-2',
        position: { x: 1.2, y: 0, z: 0 },
        type: 'hanger',
        specification: 'Clamp',
      },
    ];

    const route = new Route(
      source,
      destination,
      segments,
      { name: 'Steel', properties: {} },
      {
        minBendRadius: 0.25,
        supportSpacing: 3,
        clearance: { walls: 0.1, ceiling: 0.2, floor: 0.1, otherInfrastructure: 0.2 },
      }
    );
    supports.forEach((support) => route.addSupport(support));

    const exporter = new BOMExporter();
    const csv = exporter.exportCSV([route]);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Route Type,Size,Material,Length (ft),Elbows,Tees,Reducers,Supports,Estimated Cost');

    const dataRow = lines[1].split(',');
    expect(dataRow[0]).toBe('pipe');
    expect(dataRow[1]).toBe('3/4"');
    expect(dataRow[2]).toBe('Steel');
    expect(dataRow[3]).toBe('4.92');
    expect(dataRow[4]).toBe('1');
    expect(dataRow[7]).toBe('2');
    expect(dataRow[8]).toBe('$138.58');

    const totalsRow = lines[2].split(',');
    expect(totalsRow[0]).toBe('TOTALS');
    expect(totalsRow[3]).toBe('4.92');
    expect(totalsRow[4]).toBe('1');
    expect(totalsRow[7]).toBe('2');
    expect(totalsRow[8]).toBe('$138.58');
  });

  it('returns header and zero totals when no routes are provided', () => {
    const exporter = new BOMExporter();
    const csv = exporter.exportCSV([]);
    expect(csv).toBe('Route Type,Size,Material,Length (ft),Elbows,Tees,Reducers,Supports,Estimated Cost\nTOTALS,,,0.00,0,0,0,0,$0.00');
  });
});
