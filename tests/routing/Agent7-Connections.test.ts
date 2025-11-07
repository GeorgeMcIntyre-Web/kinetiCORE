import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionManager } from '../../src/routing/core/ConnectionManager';
import { ConnectionPointConfig } from '../../src/routing/core/types';

const baseConfig: ConnectionPointConfig = {
  type: 'pipe',
  position: { x: 0, y: 0, z: 0 },
  direction: { x: 0, y: 0, z: 1 },
  specifications: { size: '1in' },
};

function createConfig(overrides: Partial<ConnectionPointConfig> = {}): ConnectionPointConfig {
  return {
    ...baseConfig,
    position: overrides.position ?? { ...baseConfig.position },
    direction: overrides.direction ?? { ...baseConfig.direction },
    specifications: overrides.specifications ?? { ...baseConfig.specifications },
    type: overrides.type ?? baseConfig.type,
    parentObject: overrides.parentObject,
  };
}

describe('Agent7 - ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = ConnectionManager.getInstance();
    manager.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates unique connection point IDs for sequential additions', () => {
    const first = manager.addConnectionPoint(
      createConfig({ position: { x: 1, y: 0, z: 0 } })
    );
    const second = manager.addConnectionPoint(
      createConfig({ position: { x: 2, y: 0, z: 0 } })
    );

    expect(first.getId()).not.toBe(second.getId());
    expect(manager.getConnectionPointCount()).toBe(2);
  });

  it('prevents duplicate connectors within default tolerance', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const original = manager.addConnectionPoint(
      createConfig({ position: { x: 5, y: 0, z: 0 } })
    );
    const duplicate = manager.addConnectionPoint(
      createConfig({ position: { x: 5.005, y: 0, z: 0 } })
    );

    expect(duplicate.getId()).toBe(original.getId());
    expect(manager.getConnectionPointCount()).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('finds duplicates only for matching types within tolerance', () => {
    const pipe = manager.addConnectionPoint(
      createConfig({ position: { x: -2, y: 1, z: 0 }, type: 'pipe' })
    );

    const sameTypeId = manager.findDuplicateAt(
      { x: -2.005, y: 1.002, z: 0.004 },
      'pipe',
      0.01
    );
    const farAwayId = manager.findDuplicateAt(
      { x: -2.2, y: 1.5, z: 0.2 },
      'pipe',
      0.01
    );
    const differentTypeId = manager.findDuplicateAt(
      pipe.getPosition(),
      'electrical',
      0.01
    );

    expect(sameTypeId).toBe(pipe.getId());
    expect(farAwayId).toBeNull();
    expect(differentTypeId).toBeNull();
  });

  it('removing a connector cleans up connections on linked nodes', () => {
    const source = manager.addConnectionPoint(
      createConfig({ position: { x: 0, y: 0, z: 0 } })
    );
    const target = manager.addConnectionPoint(
      createConfig({ position: { x: 0, y: 3, z: 0 } })
    );

    const connection = manager.createConnection(source.getId(), target.getId());
    expect(connection).not.toBeNull();
    expect(manager.getConnections(source.getId())).toHaveLength(1);
    expect(manager.getConnections(target.getId())).toHaveLength(1);

    const removed = manager.removeConnectionPoint(source.getId());
    expect(removed).toBe(true);
    expect(manager.getConnectionPoint(source.getId())).toBeNull();
    expect(manager.getConnections(target.getId())).toHaveLength(0);
  });
});
