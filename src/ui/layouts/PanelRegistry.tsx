// Panel Registry - Central registry for all dockable panels
// Owner: George (Architecture)

import React from 'react';
import { IDockviewPanelProps } from 'dockview-react';
import { SceneTree } from '../components/SceneTree';
import { Inspector } from '../components/Inspector';
import { KinematicsPanel } from '../components/KinematicsPanel';
import { RouteStatsPanel } from '../../routing/ui/RouteStatsPanel';
import { RoutingControlPanel } from '../../routing/ui/RoutingControlPanel';
import { SceneCanvas } from '../components/SceneCanvas';
import { ComingSoon } from '../components/ComingSoon';
import { SelectionIndicator } from '../components/SelectionIndicator';
import { useEditorStore } from '../store/editorStore';

export type PanelType = 'sceneTree' | 'inspector' | 'kinematics' | 'toolPalette' | 'routeStats' | 'routingControl' | 'viewport';

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
        <ComingSoon title="Tool Palette" message="Coming Soon" size="compact" />
      </div>
    </div>
  );
};

const RouteStatsPanelWrapper: React.FC<IDockviewPanelProps> = () => {
  return <RouteStatsPanel />;
};

const RoutingControlPanelWrapper: React.FC<IDockviewPanelProps> = () => {
  return <RoutingControlPanel />;
};

const ViewportPanel: React.FC<IDockviewPanelProps> = () => {
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <SceneCanvas />
      {/* Selection Indicator - Positioned inside viewport */}
      <SelectionIndicator selectedNodeIds={selectedNodeIds} />
    </div>
  );
};

export const PANEL_REGISTRY: Record<PanelType, PanelConfig> = {
  sceneTree: {
    id: 'sceneTree',
    title: 'Scene Tree',
    component: SceneTreePanel,
    defaultWidth: 240, // Match Essential Mode width
  },
  inspector: {
    id: 'inspector',
    title: 'Inspector',
    component: InspectorPanel,
    defaultWidth: 448, // 320 * 1.4 = 448px (40% wider)
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
    defaultWidth: 220,
  },
  routeStats: {
    id: 'routeStats',
    title: 'Route Statistics',
    component: RouteStatsPanelWrapper,
    defaultWidth: 320,
    defaultHeight: 240,
  },
  routingControl: {
    id: 'routingControl',
    title: 'Routing Control',
    component: RoutingControlPanelWrapper,
    defaultWidth: 320,
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
