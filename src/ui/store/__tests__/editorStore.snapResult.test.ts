import { describe, it, expect, beforeEach, vi } from 'vitest';

const loadEditorStore = async () => {
  const module = await import('../editorStore');
  return module.useEditorStore;
};

describe('editorStore - snap result and display', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initializes lastSnapResult as null and display enabled', async () => {
    const useEditorStore = await loadEditorStore();
    const state = useEditorStore.getState();

    expect(state.lastSnapResult).toBeNull();
    expect(state.snapCoordinateDisplayEnabled).toBe(true);
  });

  it('setLastSnapResult updates lastSnapResult', async () => {
    const useEditorStore = await loadEditorStore();
    const store = useEditorStore.getState();

    const result = {
      world: { x: 1, y: 2, z: 3 },
      local: { x: 0.1, y: 0.2, z: 0.3 },
      type: 'vertex' as const,
      targetName: 'TestMesh',
    };

    store.setLastSnapResult(result);

    const after = useEditorStore.getState();
    expect(after.lastSnapResult).toMatchObject(result);
  });

  it('toggleSnapCoordinateDisplay flips the enabled flag', async () => {
    const useEditorStore = await loadEditorStore();
    const store = useEditorStore.getState();

    const initial = store.snapCoordinateDisplayEnabled;
    store.toggleSnapCoordinateDisplay();

    const afterFirst = useEditorStore.getState();
    expect(afterFirst.snapCoordinateDisplayEnabled).toBe(!initial);

    afterFirst.toggleSnapCoordinateDisplay();

    const afterSecond = useEditorStore.getState();
    expect(afterSecond.snapCoordinateDisplayEnabled).toBe(initial);
  });
});

