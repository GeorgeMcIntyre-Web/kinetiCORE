import { describe, it, expect, beforeEach, vi } from 'vitest';

const loadEditorStore = async () => {
  const module = await import('../editorStore');
  return module.useEditorStore;
};

describe('editorStore - measurement history', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initializes measurementHistory as empty array', async () => {
    const useEditorStore = await loadEditorStore();
    const state = useEditorStore.getState();

    expect(Array.isArray(state.measurementHistory)).toBe(true);
    expect(state.measurementHistory.length).toBe(0);
  });

  it('addMeasurementRecord appends records and clearMeasurementHistory resets', async () => {
    const useEditorStore = await loadEditorStore();
    const store = useEditorStore.getState();

    const record = {
      id: 'test-distance',
      type: 'distance' as const,
      value: 123.45,
      unit: 'mm' as const,
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ],
      nodeNames: ['node-1', 'node-2'],
      createdAt: Date.now(),
    };

    store.addMeasurementRecord(record);

    const afterAdd = useEditorStore.getState();
    expect(afterAdd.measurementHistory.length).toBe(1);
    expect(afterAdd.measurementHistory[0]).toMatchObject(record);

    store.clearMeasurementHistory();

    const afterClear = useEditorStore.getState();
    expect(afterClear.measurementHistory.length).toBe(0);
  });
});

