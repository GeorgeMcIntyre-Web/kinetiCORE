// Panel Registry - Central registry for all dockable panels
// Owner: George (Architecture)

import React from 'react';
import { IDockviewPanelProps } from 'dockview-react';
import { SceneTree } from '../components/SceneTree';
import { Inspector } from '../components/Inspector';
import { KinematicsPanel } from '../components/KinematicsPanel';
import { TargetPanel } from '../components/TargetPanel';
import { RouteStatsPanel } from '../../routing/ui/RouteStatsPanel';
import { RoutingControlPanel } from '../../routing/ui/RoutingControlPanel';
import { WarehousePanel } from '../../routing/ui/WarehousePanel';
import { SceneCanvas } from '../components/SceneCanvas';
import { ComingSoon } from '../components/ComingSoon';
import { SelectionIndicator } from '../components/SelectionIndicator';
import { useEditorStore } from '../store/editorStore';
import BabylonInspectorPanel from '../components/BabylonInspectorPanel';
import { PerformanceMonitor, usePerformanceMonitor } from '../components/debug/PerformanceMonitor';
import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import { babylonToUser } from '../../core/CoordinateSystem';
import { EntityRegistry } from '../../entities/EntityRegistry';

export type PanelType = 'sceneTree' | 'inspector' | 'babylonInspector' | 'kinematics' | 'toolPalette' | 'routeStats' | 'routingControl' | 'warehouse' | 'viewport' | 'target';

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

const KinematicsControlPanel: React.FC<IDockviewPanelProps> = () => {
  return <KinematicsPanel />;
};

const TargetPanelWrapper: React.FC<IDockviewPanelProps> = () => {
  return <TargetPanel />;
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
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const performanceEnabled = usePerformanceMonitor();
  const lastPickedPoint = useEditorStore((state) => state.lastPickedPoint);
  
  // Coordinate display mode: 'world' (default) or 'local'
  const [coordMode, setCoordMode] = React.useState<'world' | 'local'>('world');
  
  // Get position and rotation for selected node
  const [transform, setTransform] = React.useState<{
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
  } | null>(null);
  
  React.useEffect(() => {
    if (!selectedNodeId) {
      setTransform(null);
      return;
    }
    
    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) {
      setTransform(null);
      return;
    }
    
    let lastTransform: string | null = null;
    
    const updateTransform = () => {
      const node = tree.getNode(selectedNodeId);
      if (!node) {
        setTransform(null);
        return;
      }
      
      let babylonNode: BABYLON.TransformNode | null = null;
      const registry = EntityRegistry.getInstance();
      
      if (node.babylonMeshId) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10));
        if (mesh) {
          const entity = registry.getByMesh(mesh);
          if (entity && entity.getIsDevice()) {
            babylonNode = entity.getRootTransformNode();
          } else {
            babylonNode = mesh;
          }
        }
      } else if (node.type === 'collection') {
        babylonNode = scene.transformNodes.find((tn) => tn.name === node.name) || null;
      }
      
      if (babylonNode) {
        // Position (mm) and rotation (deg) in either local or world coordinates
        let posUser: { x: number; y: number; z: number };
        let eulerRad: BABYLON.Vector3;
        
        if (coordMode === 'world') {
          // WORLD: use absolute/world transform
          babylonNode.computeWorldMatrix(true);
          const worldMatrix = babylonNode.getWorldMatrix();
          const worldTranslation = worldMatrix.getTranslation();
          const worldRotationQuat = new BABYLON.Quaternion();
          worldMatrix.decompose(undefined, worldRotationQuat, undefined);
          posUser = babylonToUser(worldTranslation);
          eulerRad = worldRotationQuat.toEulerAngles();
        } else {
          // LOCAL: use node-local transform
          posUser = babylonToUser(babylonNode.position);
          if (babylonNode.rotationQuaternion) {
            eulerRad = babylonNode.rotationQuaternion.toEulerAngles();
          } else {
            eulerRad = babylonNode.rotation;
          }
        }
        
        const newTransform = {
          x: Math.round(posUser.x * 10) / 10,
          y: Math.round(posUser.y * 10) / 10,
          z: Math.round(posUser.z * 10) / 10,
          rx: Math.round((eulerRad.x * 180 / Math.PI) * 10) / 10,
          ry: Math.round((eulerRad.y * 180 / Math.PI) * 10) / 10,
          rz: Math.round((eulerRad.z * 180 / Math.PI) * 10) / 10,
        };
        
        const newTransformStr = JSON.stringify(newTransform);
        if (newTransformStr !== lastTransform) {
          lastTransform = newTransformStr;
          setTransform(newTransform);
        }
      } else {
        setTransform(null);
      }
    };
    
    updateTransform();
    
    const handleSceneUpdate = () => updateTransform();
    window.addEventListener('scenetree-update', handleSceneUpdate);
    
    const observer = scene?.onBeforeRenderObservable.add(() => {
      updateTransform();
    });
    
    return () => {
      window.removeEventListener('scenetree-update', handleSceneUpdate);
      if (scene && observer) {
        scene.onBeforeRenderObservable.remove(observer);
      }
    };
  }, [selectedNodeId, coordMode]);
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <SceneCanvas />
      {/* Selection Indicator - Positioned inside viewport */}
      <SelectionIndicator selectedNodeIds={selectedNodeIds} />
      
      {/* Performance Monitor - Top right */}
      <PerformanceMonitor
        enabled={performanceEnabled}
        position="top-right"
        detailed={true}
      />
      
      {/* Transform Display - Bottom-right corner (matching Essential Mode) */}
      {transform && (
        <div
          className="fixed"
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            borderRadius: '10px',
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: '12px',
            paddingRight: '12px',
            color: '#fff',
            boxShadow: 'none',
            fontWeight: '600',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            minWidth: '280px',
            marginBottom: '16px',
            zIndex: 10000,
            pointerEvents: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '12px',
            transformOrigin: 'bottom right',
          }}
        >
          <div style={{ transform: 'scale(0.95)', transformOrigin: 'bottom right', padding: '8px 0' }}>
          {/* Tiny coord mode toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
            <button
              onClick={() => setCoordMode(coordMode === 'world' ? 'local' : 'world')}
              title={coordMode === 'world' ? 'Showing World coordinates. Click for Local.' : 'Showing Local coordinates. Click for World.'}
              style={{
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '8px',
                fontSize: '9px',
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              {coordMode === 'world' ? 'World' : 'Local'}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', gap: '4px', minWidth: '80px' }}>
              <span style={{ color: '#D0021B', fontWeight: '500' }}>X:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.x.toFixed(1)}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', minWidth: '80px' }}>
              <span style={{ color: '#7ED321', fontWeight: '500' }}>Y:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.y.toFixed(1)}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', minWidth: '80px' }}>
              <span style={{ color: '#4A90E2', fontWeight: '500' }}>Z:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.z.toFixed(1)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', gap: '4px', minWidth: '80px' }}>
              <span style={{ color: '#D0021B', fontWeight: '500' }}>RX:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.rx.toFixed(1)}°</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', minWidth: '80px' }}>
              <span style={{ color: '#7ED321', fontWeight: '500' }}>RY:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.ry.toFixed(1)}°</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', minWidth: '80px' }}>
              <span style={{ color: '#4A90E2', fontWeight: '500' }}>RZ:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.rz.toFixed(1)}°</span>
            </div>
          </div>
          {lastPickedPoint && (() => {
            const userCoords = babylonToUser(lastPickedPoint);
            return (
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.1)',
                margin: '6px 0',
                paddingTop: '6px'
              }}>
                <div style={{
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: '4px',
                  fontWeight: '500'
                }}>
                  Picked Point:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', gap: '4px', minWidth: '80px' }}>
                    <span style={{ color: '#D0021B', fontWeight: '500' }}>X:</span>
                    <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{userCoords.x.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', minWidth: '80px' }}>
                    <span style={{ color: '#7ED321', fontWeight: '500' }}>Y:</span>
                    <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{userCoords.y.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', minWidth: '80px' }}>
                    <span style={{ color: '#4A90E2', fontWeight: '500' }}>Z:</span>
                    <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{userCoords.z.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      )}
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
    titleIcon: null, // Icon set via CSS using data-icon-type
    component: InspectorPanel,
    defaultWidth: 448, // 320 * 1.4 = 448px (40% wider)
  },
  babylonInspector: {
    id: 'babylonInspector',
    title: 'Babylon Inspector',
    titleIcon: null, // Icon set via CSS using data-icon-type
    component: BabylonInspectorPanel,
    defaultWidth: 400,
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
    titleIcon: null, // Icon set via CSS using data-icon-type
    component: RouteStatsPanelWrapper,
    defaultWidth: 320,
    defaultHeight: 240,
  },
  routingControl: {
    id: 'routingControl',
    title: 'Routing Control',
    titleIcon: null, // Icon set via CSS using data-icon-type
    component: RoutingControlPanelWrapper,
    defaultWidth: 320,
  },
  warehouse: {
    id: 'warehouse',
    title: 'Warehouse',
    titleIcon: null, // Icon set via CSS using data-icon-type
    component: WarehousePanelWrapper,
    defaultWidth: 300, // Professional layout width
  },
  viewport: {
    id: 'viewport',
    title: '3D Viewport',
    component: ViewportPanel,
  },
  target: {
    id: 'target',
    title: 'Target',
    component: TargetPanelWrapper,
    defaultHeight: 280,
  },
};

// Export component registry for dockview
export const getPanelComponent = (id: PanelType): React.ComponentType<IDockviewPanelProps> => {
  return PANEL_REGISTRY[id].component;
};
