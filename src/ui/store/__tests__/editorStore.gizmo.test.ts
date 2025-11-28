import { describe, it, expect, beforeEach, vi } from 'vitest';

const GIZMO_KEY = 'kineticore.transformGizmoEnabled';

const loadEditorStore = async () => {
  const module = await import('../editorStore');
  return module.useEditorStore;
};

describe('editorStore - transform gizmo state', () => {
  beforeEach(() => {
    vi.resetModules();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('defaults transform gizmo to false when no saved value', async () => {
    const useEditorStore = await loadEditorStore();
    const state = useEditorStore.getState();

    expect(state.transformGizmoEnabled).toBe(false);
    if (typeof window !== 'undefined' && window.localStorage) {
      expect(window.localStorage.getItem(GIZMO_KEY)).toBeNull();
    }
  });

  it('reads transform gizmo state from localStorage when available', async () => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(GIZMO_KEY, 'true');
    const useEditorStore = await loadEditorStore();
    const state = useEditorStore.getState();

    expect(state.transformGizmoEnabled).toBe(true);
  });

  it('persists transform gizmo state when setTransformGizmoEnabled is called', async () => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const useEditorStore = await loadEditorStore();
    const store = useEditorStore.getState();

    store.setTransformGizmoEnabled(true);

    expect(useEditorStore.getState().transformGizmoEnabled).toBe(true);
    expect(window.localStorage.getItem(GIZMO_KEY)).toBe('true');
  });

  it('toggleTransformGizmo flips and persists the state', async () => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const useEditorStore = await loadEditorStore();
    const store = useEditorStore.getState();

    expect(store.transformGizmoEnabled).toBe(false);

    store.toggleTransformGizmo();

    const afterFirstToggle = useEditorStore.getState();
    expect(afterFirstToggle.transformGizmoEnabled).toBe(true);
    expect(window.localStorage.getItem(GIZMO_KEY)).toBe('true');

    afterFirstToggle.toggleTransformGizmo();

    const afterSecondToggle = useEditorStore.getState();
    expect(afterSecondToggle.transformGizmoEnabled).toBe(false);
    expect(window.localStorage.getItem(GIZMO_KEY)).toBe('false');
  });
});
