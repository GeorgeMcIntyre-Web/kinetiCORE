import {
  computePlacementPosition,
  PlacementComputationInput,
} from '../../src/domain/factoryServices/piping/pipingPlacement';
import { PipingPlacementSettings, PipingNode } from '../../src/domain/factoryServices/piping/pipingTypes';

describe('piping placement computation', () => {
  const baseInput: PlacementComputationInput = {
    floorPoint: { x: 1, y: 2, z: 0 },
    pointerPoint: { x: 1, y: 2, z: 0 },
    snapCandidate: null,
  };

  it('uses floor height when floor mode provides a hit', () => {
    const settings: PipingPlacementSettings = {
      mode: 'floor',
      defaultElevationZ: 1,
    };

    const result = computePlacementPosition(settings, baseInput);
    expect(result.position).toEqual({ x: 1, y: 2, z: 0 });
    expect(result.appliedMode).toBe('floor');
    expect(result.fallback).toBe('none');
  });

  it('falls back to default elevation when no floor point exists', () => {
    const settings: PipingPlacementSettings = {
      mode: 'floor',
      defaultElevationZ: 2,
    };

    const result = computePlacementPosition(settings, {
      ...baseInput,
      floorPoint: null,
    });
    expect(result.position.z).toBe(2);
    expect(result.fallback).toBe('defaultElevation');
  });

  it('forces elevation mode to honor default Z regardless of floor height', () => {
    const settings: PipingPlacementSettings = {
      mode: 'elevation',
      defaultElevationZ: 3.5,
    };

    const result = computePlacementPosition(settings, baseInput);
    expect(result.position.z).toBe(3.5);
    expect(result.appliedMode).toBe('elevation');
  });

  it('snaps exactly to candidate node when available', () => {
    const settings: PipingPlacementSettings = {
      mode: 'snap',
      defaultElevationZ: 1,
    };

    const snapNode: PipingNode = {
      id: 'node-1',
      kind: 'endpoint',
      serviceType: 'water',
      position: { x: 5, y: 6, z: 2 },
    };

    const result = computePlacementPosition(settings, {
      ...baseInput,
      snapCandidate: snapNode,
    });

    expect(result.position).toEqual(snapNode.position);
    expect(result.appliedMode).toBe('snap');
    expect(result.snappedNodeId).toBe('node-1');
  });

  it('falls back to floor when snap mode has no candidate but floor exists', () => {
    const settings: PipingPlacementSettings = {
      mode: 'snap',
      defaultElevationZ: 4,
    };

    const result = computePlacementPosition(settings, {
      ...baseInput,
      snapCandidate: null,
    });

    expect(result.appliedMode).toBe('floor');
    expect(result.fallback).toBe('snapToFloor');
    expect(result.position.z).toBe(0);
  });
});

