// LayoutManager - Manages panel state with localStorage persistence
// Owner: George (Architecture)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PanelState } from './BasePanel';
import { UserLevel } from './UserLevelContext';
import { WorkspaceType } from './types';

interface LayoutState {
  userLevel: UserLevel;
  currentWorkspace: WorkspaceType;
  panelStates: Record<string, PanelState>;

  // Actions
  setPanelState: (panelId: string, state: Partial<PanelState>) => void;
  togglePanelCollapse: (panelId: string) => void;
  setPanelSize: (panelId: string, size: number) => void;
  setPanelVisibility: (panelId: string, visible: boolean) => void;
  resetLayout: () => void;
  setWorkspace: (workspace: WorkspaceType) => void;
  getUserLevel: () => UserLevel;
  setUserLevel: (level: UserLevel) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      userLevel: 'essential',
      currentWorkspace: 'modeling',
      panelStates: {},

      setPanelState: (panelId, newState) =>
        set((state) => ({
          panelStates: {
            ...state.panelStates,
            [panelId]: {
              ...state.panelStates[panelId],
              ...newState,
            },
          },
        })),

      togglePanelCollapse: (panelId) =>
        set((state) => ({
          panelStates: {
            ...state.panelStates,
            [panelId]: {
              ...state.panelStates[panelId],
              collapsed: !state.panelStates[panelId]?.collapsed,
            },
          },
        })),

      setPanelSize: (panelId, size) =>
        set((state) => ({
          panelStates: {
            ...state.panelStates,
            [panelId]: {
              ...state.panelStates[panelId],
              size,
            },
          },
        })),

      setPanelVisibility: (panelId, visible) =>
        set((state) => ({
          panelStates: {
            ...state.panelStates,
            [panelId]: {
              ...state.panelStates[panelId],
              visible,
            },
          },
        })),

      resetLayout: () =>
        set({
          panelStates: {},
        }),

      setWorkspace: (workspace) =>
        set({ currentWorkspace: workspace }),

      getUserLevel: () => get().userLevel,

      setUserLevel: (level) =>
        set({ userLevel: level }),
    }),
    {
      name: 'kineticore-layout', // localStorage key
      partialize: (state) => ({
        userLevel: state.userLevel,
        currentWorkspace: state.currentWorkspace,
        panelStates: state.panelStates,
      }),
    }
  )
);
