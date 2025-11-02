// Panel Registry - Central registry for all dockable panels
// Owner: George (Architecture)

import React from 'react';
import { IDockviewPanelProps } from 'dockview-react';
import { SceneTree } from '../components/SceneTree';
import { Inspector } from '../components/Inspector';
import { KinematicsPanel } from '../components/KinematicsPanel';
import { RouteStatsPanel } from '../../routing/ui/RouteStatsPanel';
import { SceneCanvas } from '../components/SceneCanvas';

export type PanelType = 'sceneTree' | 'inspector' | 'kinematics' | 'toolPalette' | 'routeStats' | 'viewport';

export interface PanelConfig {
  id: PanelType;
  title: string;
  component: React.ComponentType<IDockviewPanelProps>;
  defaultWidth?: number;
  defaultHeight?: number;
}

// Wrapper components to adapt our panels to dockview API
const SceneTreePanel: React.FC<IDockviewPanelProps> = () => {
  return <SceneTree />;
};

const InspectorPanel: React.FC<IDockviewPanelProps> = () => {
  return <Inspector />;
};

const KinematicsControlPanel: React.FC<IDockviewPanelProps> = () => {
  return <KinematicsPanel />;
};

const ToolPalettePanel: React.FC<IDockviewPanelProps> = () => {
  return (
    <div className="tool-palette-panel">
      <div className="panel-content">
        <p>Tool Palette (Coming Soon)</p>
      </div>
    </div>
  );
};

const RouteStatsPanelWrapper: React.FC<IDockviewPanelProps> = () => {
  return <RouteStatsPanel />;
};

const ViewportPanel: React.FC<IDockviewPanelProps> = () => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <SceneCanvas />
    </div>
  );
};

export const PANEL_REGISTRY: Record<PanelType, PanelConfig> = {
  sceneTree: {
    id: 'sceneTree',
    title: 'Scene Tree',
    component: SceneTreePanel,
    defaultWidth: 300,
  },
  inspector: {
    id: 'inspector',
    title: 'Inspector',
    component: InspectorPanel,
    defaultWidth: 320,
  },
  kinematics: {
    id: 'kinematics',
    title: 'Kinematics',
    component: KinematicsControlPanel,
    defaultHeight: 300,
  },
  toolPalette: {
    id: 'toolPalette',
    title: 'Tools',
    component: ToolPalettePanel,
    defaultWidth: 250,
  },
  routeStats: {
    id: 'routeStats',
    title: 'Route Statistics',
    component: RouteStatsPanelWrapper,
    defaultWidth: 350,
    defaultHeight: 400,
  },
  viewport: {
    id: 'viewport',
    title: '3D Viewport',
    component: ViewportPanel,
  },
};

// Export component registry for dockview
export const getPanelComponent = (id: PanelType): React.ComponentType<IDockviewPanelProps> => {
  return PANEL_REGISTRY[id].component;
};
