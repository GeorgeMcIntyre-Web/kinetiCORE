// Panel Types - Type definitions for the panel system
// Owner: George (Architecture)

export type PanelPosition = 'left' | 'right' | 'center' | 'top' | 'bottom' | 'floating';
export type WorkspaceType = 'modeling' | 'simulation' | 'analysis' | '*';

export interface LayoutConfig {
  workspace: WorkspaceType;
  panels: {
    left: string[];
    right: string[];
    center: string[];
    top: string[];
    bottom: string[];
  };
}

export interface PanelLayoutState {
  panels: Record<string, {
    visible: boolean;
    collapsed: boolean;
    size: number;
    position?: { x?: number; y?: number };
  }>;
  workspace: WorkspaceType;
}

export interface PanelResizeEvent {
  panelId: string;
  newSize: number;
}

export interface PanelToggleEvent {
  panelId: string;
  collapsed: boolean;
}

export interface PanelVisibilityEvent {
  panelId: string;
  visible: boolean;
}
