// Panel Registry - Central registry for all dockable panels
// Owner: George (Architecture)

import React from 'react';
import { IDockviewPanelProps } from 'dockview-react';
import { Warehouse, Gauge, BarChart3, Bug, FileText } from 'lucide-react';
import { SceneTree } from '../components/SceneTree';
import { Inspector } from '../components/Inspector';
import BabylonInspectorPanel from '../components/BabylonInspectorPanel';
import { KinematicsPanel } from '../components/KinematicsPanel';
import { RouteStatsPanel } from '../../routing/ui/RouteStatsPanel';
import { RoutingControlPanel } from '../../routing/ui/RoutingControlPanel';
import { WarehousePanel } from '../../routing/ui/WarehousePanel';
import { SceneCanvas } from '../components/SceneCanvas';
import { ComingSoon } from '../components/ComingSoon';
import { SelectionIndicator } from '../components/SelectionIndicator';
import { useEditorStore } from '../store/editorStore';

export type PanelType = 'sceneTree' | 'inspector' | 'babylonInspector' | 'kinematics' | 'toolPalette' | 'routeStats' | 'routingControl' | 'warehouse' | 'viewport';

export interface PanelConfig {
  id: PanelType;
  title: string;
  titleIcon?: React.ReactNode;
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

const BabylonInspectorPanelWrapper: React.FC<IDockviewPanelProps> = (props) => {
  return <BabylonInspectorPanel {...props} />;
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

const WarehousePanelWrapper: React.FC<IDockviewPanelProps> = () => {
  const [isVisible, setIsVisible] = React.useState(true);
  return <WarehousePanel isVisible={isVisible} onClose={() => setIsVisible(false)} />;
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
    titleIcon: <FileText size={16} />,
    component: InspectorPanel,
    defaultWidth: 448, // 320 * 1.4 = 448px (40% wider)
  },
  babylonInspector: {
    id: 'babylonInspector',
    title: 'Babylon Inspector',
    titleIcon: <Bug size={16} />,
    component: BabylonInspectorPanelWrapper,
    defaultWidth: 448,
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
    titleIcon: <BarChart3 size={16} />,
    component: RouteStatsPanelWrapper,
    defaultWidth: 320,
    defaultHeight: 240,
  },
  routingControl: {
    id: 'routingControl',
    title: 'Routing Control',
    titleIcon: <Gauge size={16} />,
    component: RoutingControlPanelWrapper,
    defaultWidth: 320,
  },
  warehouse: {
    id: 'warehouse',
    title: 'Warehouse',
    titleIcon: <Warehouse size={16} />,
    component: WarehousePanelWrapper,
    defaultWidth: 240, // Reduced from 320 for more compact layout
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
