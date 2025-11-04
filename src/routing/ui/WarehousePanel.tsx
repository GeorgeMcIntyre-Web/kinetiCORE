// Warehouse Panel - Standalone floating panel for warehouse configuration
// Owner: Routing System Team

import React, { useState, useEffect, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
  Building2,
  Minus,
  Plus,
  Maximize2,
  Camera,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Ruler,
  Box,
  DoorOpen,
  Layers,
  Sun,
  Cloud,
} from 'lucide-react';
import { FloatingPanel } from '../../ui/components/FloatingPanel/FloatingPanel';
import { SceneManager } from '../../scene/SceneManager';
import { WarehouseModel, WarehouseConfig, SkyboxSource, ColumnShape, FloorType, MezzanineType } from '../core/WarehouseModel';
import { CameraService } from '../../scene/services/CameraService';
import './WarehousePanel.css';

interface WarehousePanelProps {
  isVisible: boolean;
  onClose: () => void;
  zIndex?: number;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  defaultOpen = true,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="warehouse-section">
      <button
        className="warehouse-section-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="section-title">
          {icon}
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {isOpen && <div className="warehouse-section-content">{children}</div>}
    </div>
  );
};

/**
 * Standalone warehouse configuration panel
 * Provides comprehensive controls for warehouse dimensions, structure, and atmosphere
 */
export const WarehousePanel: React.FC<WarehousePanelProps> = ({
  isVisible: panelVisible,
  onClose,
  zIndex = 1003,
}) => {
  const [warehouse, setWarehouse] = useState<WarehouseModel | null>(null);
  const [config, setConfig] = useState<WarehouseConfig>({
    width: 50000,
    depth: 50000,
    height: 20000,
    enableFog: false,
    enableSkybox: true,
    enableSun: true,
    sunAzimuth: -45,
    sunElevation: 35,
    sunIntensity: 1.0,
    skyboxSource: 'sunny',
    enableRoof: true,
    mainDoorWall: 'south',
    sideDoors: true,
    mezzanineEnabled: false,
    mezzanineHeight: 8000,
    mezzanineType: 'grid',
    columnShape: 'I-beam',
    floorType: 'concrete',
  });

  const [warehouseVisible, setWarehouseVisible] = useState(() => {
    try {
      const saved = localStorage.getItem('warehouse_visible');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let scene = SceneManager.getInstance().getScene();
    if (!scene) {
      const retryTimeout = setTimeout(() => {
        scene = SceneManager.getInstance().getScene();
        if (scene) {
          initializeWarehouse(scene);
        }
      }, 500);
      return () => clearTimeout(retryTimeout);
    }

    return initializeWarehouse(scene);
  }, []);

  const initializeWarehouse = (scene: BABYLON.Scene) => {
    SceneManager.getInstance().setBackgroundTransparent(true);

    const warehouseModel = new WarehouseModel(scene, config);
    setWarehouse(warehouseModel);

    const ground = SceneManager.getInstance().getGround();
    if (ground) {
      ground.setEnabled(false);
      ground.isVisible = false;
    }

    const camera = CameraService.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      const widthM = config.width / 1000;
      const depthM = config.depth / 1000;
      const heightM = config.height / 1000;

      camera.minZ = 0.1;
      const maxDimension = Math.max(widthM, depthM, heightM);
      // CRITICAL FIX: Ensure maxZ is large enough to see skybox (10km = 10000 units)
      // Skybox is 10km, so we need at least 15000 to see it clearly
      camera.maxZ = Math.max(maxDimension * 2000, 15000);

      camera.target = new BABYLON.Vector3(0, heightM * 0.5, 0);

      // CRITICAL FIX: Position camera OUTSIDE warehouse looking at it from isometric angle
      const maxHorizontalDimension = Math.max(widthM, depthM);
      // Position camera further away to ensure it's outside the warehouse
      const exteriorDistance = maxHorizontalDimension * 2.5; // Increased from 1.5 to 2.5
      const cameraHeight = heightM * 0.8; // Slightly higher for better isometric view

      // Calculate radius for isometric viewing angle
      camera.radius = Math.sqrt(
        Math.pow(exteriorDistance, 2) +
        Math.pow(exteriorDistance, 2) +
        Math.pow(cameraHeight, 2)
      );

      // Isometric angle: 45° horizontal rotation, 30° elevation for good overview
      camera.alpha = Math.PI / 4; // 45 degrees
      camera.beta = Math.PI / 6; // 30 degrees (was PI/3 = 60°, too steep)
      camera.setTarget(camera.target);
      
      console.log(`[WarehousePanel] ✅ Camera positioned outside warehouse: radius=${camera.radius.toFixed(2)}, alpha=${(camera.alpha * 180 / Math.PI).toFixed(1)}°, beta=${(camera.beta * 180 / Math.PI).toFixed(1)}°`);
    }

    return () => {
      warehouseModel.dispose();
    };
  };

  useEffect(() => {
    if (!warehouse) return;

    warehouse.updateSize(config);
    SceneManager.getInstance().resizeFloor(config.width / 1000, config.depth / 1000);

    const camera = CameraService.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      const widthM = config.width / 1000;
      const depthM = config.depth / 1000;
      const heightM = config.height / 1000;

      camera.minZ = 0.1;
      const maxDimension = Math.max(widthM, depthM, heightM);
      // CRITICAL FIX: Ensure maxZ is large enough to see skybox (10km = 10000 units)
      camera.maxZ = Math.max(maxDimension * 2000, 15000);

      camera.target = new BABYLON.Vector3(0, heightM * 0.5, 0);

      // CRITICAL FIX: Position camera OUTSIDE warehouse looking at it from isometric angle
      const maxHorizontalDimension = Math.max(widthM, depthM);
      // Position camera further away to ensure it's outside the warehouse
      const exteriorDistance = maxHorizontalDimension * 2.5; // Increased from 1.5 to 2.5
      const cameraHeight = heightM * 0.8; // Slightly higher for better isometric view

      // Calculate radius for isometric viewing angle
      camera.radius = Math.sqrt(
        Math.pow(exteriorDistance, 2) +
        Math.pow(exteriorDistance, 2) +
        Math.pow(cameraHeight, 2)
      );

      // Isometric angle: 45° horizontal rotation, 30° elevation for good overview
      camera.alpha = Math.PI / 4; // 45 degrees
      camera.beta = Math.PI / 6; // 30 degrees (was PI/3 = 60°, too steep)
      camera.setTarget(camera.target);
    }
  }, [config, warehouse]);

  const toggleVisibility = useCallback(() => {
    const newVisible = !warehouseVisible;
    setWarehouseVisible(newVisible);

    try {
      localStorage.setItem('warehouse_visible', String(newVisible));
    } catch (error) {
      console.warn('[WarehousePanel] Failed to persist visibility state:', error);
    }

    if (warehouse) {
      const rootNode = warehouse.getRootNode();
      rootNode.setEnabled(newVisible);

      const scene = SceneManager.getInstance().getScene();
      if (scene && warehouse) {
        const skybox = scene.getMeshByName('warehouse_skybox');
        if (skybox) {
          skybox.setEnabled(newVisible);
        }
      }
    }
  }, [warehouseVisible, warehouse]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key.toLowerCase() === 'w' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        toggleVisibility();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleVisibility]);

  const adjustSize = (dimension: 'width' | 'depth' | 'height', delta: number) => {
    const minSize = 10000;
    const maxSize = 200000;

    setConfig(prev => {
      const newValue = Math.max(minSize, Math.min(maxSize, prev[dimension] + delta));
      return { ...prev, [dimension]: newValue };
    });
  };

  const resetSize = () => {
    setConfig(prev => ({
      ...prev,
      width: 50000,
      depth: 50000,
      height: 20000,
    }));
  };

  const resetCamera = () => {
    const camera = CameraService.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      const widthM = config.width / 1000;
      const depthM = config.depth / 1000;
      const heightM = config.height / 1000;

      camera.minZ = 0.1;
      const maxDimension = Math.max(widthM, depthM, heightM);
      // CRITICAL FIX: Ensure maxZ is large enough to see skybox (10km = 10000 units)
      camera.maxZ = Math.max(maxDimension * 2000, 15000);

      camera.target = new BABYLON.Vector3(0, heightM * 0.5, 0);

      // CRITICAL FIX: Position camera OUTSIDE warehouse looking at it from isometric angle
      const maxHorizontalDimension = Math.max(widthM, depthM);
      // Position camera further away to ensure it's outside the warehouse
      const exteriorDistance = maxHorizontalDimension * 2.5; // Increased from 1.5 to 2.5
      const cameraHeight = heightM * 0.8; // Slightly higher for better isometric view

      // Calculate radius for isometric viewing angle
      camera.radius = Math.sqrt(
        Math.pow(exteriorDistance, 2) +
        Math.pow(exteriorDistance, 2) +
        Math.pow(cameraHeight, 2)
      );

      // Isometric angle: 45° horizontal rotation, 30° elevation for good overview
      camera.alpha = Math.PI / 4; // 45 degrees
      camera.beta = Math.PI / 6; // 30 degrees (was PI/3 = 60°, too steep)
      camera.setTarget(camera.target);
    }
  };

  const updateConfig = (updates: Partial<WarehouseConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    if (warehouse) {
      warehouse.updateSize(updates);
    }
  };

  const formatSize = (mm: number): string => {
    if (mm >= 1000) {
      return `${(mm / 1000).toFixed(1)}m`;
    }
    return `${mm.toFixed(0)}mm`;
  };

  if (!warehouse) {
    return null;
  }

  const icon = <Building2 size={16} />;

  const panelContent = (
    <div className="warehouse-panel-content">
      {/* Quick Actions */}
      <div className="warehouse-quick-actions">
        <button
          className="warehouse-action-btn"
          onClick={toggleVisibility}
          title={warehouseVisible ? 'Hide warehouse' : 'Show warehouse'}
        >
          {warehouseVisible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
        <button className="warehouse-action-btn" onClick={resetSize} title="Reset dimensions">
          <Maximize2 size={16} />
        </button>
        <button className="warehouse-action-btn" onClick={resetCamera} title="Reset camera">
          <Camera size={16} />
        </button>
      </div>

      {/* Dimensions Section */}
      <CollapsibleSection title="Dimensions" icon={<Ruler size={14} />} defaultOpen={true}>
        <div className="warehouse-dimensions-grid">
          <div className="warehouse-dimension-item">
            <label>Width (X)</label>
            <div className="warehouse-dimension-control">
              <button onClick={() => adjustSize('width', -5000)} title="-5m">
                <Minus size={12} />
              </button>
              <span>{formatSize(config.width)}</span>
              <button onClick={() => adjustSize('width', 5000)} title="+5m">
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="warehouse-dimension-item">
            <label>Depth (Y)</label>
            <div className="warehouse-dimension-control">
              <button onClick={() => adjustSize('depth', -5000)} title="-5m">
                <Minus size={12} />
              </button>
              <span>{formatSize(config.depth)}</span>
              <button onClick={() => adjustSize('depth', 5000)} title="+5m">
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="warehouse-dimension-item">
            <label>Height (Z)</label>
            <div className="warehouse-dimension-control">
              <button onClick={() => adjustSize('height', -1000)} title="-1m">
                <Minus size={12} />
              </button>
              <span>{formatSize(config.height)}</span>
              <button onClick={() => adjustSize('height', 1000)} title="+1m">
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Structure Section */}
      <CollapsibleSection title="Structure" icon={<Box size={14} />} defaultOpen={false}>
        <div className="warehouse-control-group">
          <label className="warehouse-toggle">
            <input
              type="checkbox"
              checked={!!config.enableRoof}
              onChange={(e) => updateConfig({ enableRoof: e.target.checked })}
            />
            <span>Roof</span>
          </label>
        </div>

        <div className="warehouse-control-group">
          <label className="warehouse-label">Column Shape</label>
          <select
            value={config.columnShape || 'I-beam'}
            onChange={(e) => updateConfig({ columnShape: e.target.value as ColumnShape })}
            className="warehouse-select"
          >
            <option value="I-beam">I-beam</option>
            <option value="H-beam">H-beam</option>
            <option value="box">Box</option>
          </select>
        </div>

        <div className="warehouse-control-group">
          <label className="warehouse-label">Floor Type</label>
          <select
            value={config.floorType || 'concrete'}
            onChange={(e) => updateConfig({ floorType: e.target.value as FloorType })}
            className="warehouse-select"
          >
            <option value="concrete">Concrete</option>
            <option value="epoxy">Epoxy</option>
            <option value="tile">Tile</option>
          </select>
        </div>
      </CollapsibleSection>

      {/* Doors Section */}
      <CollapsibleSection title="Doors" icon={<DoorOpen size={14} />} defaultOpen={false}>
        <div className="warehouse-control-group">
          <label className="warehouse-label">Main Door Wall</label>
          <select
            value={config.mainDoorWall || 'south'}
            onChange={(e) => updateConfig({ mainDoorWall: e.target.value as 'north' | 'south' | 'east' | 'west' })}
            className="warehouse-select"
          >
            <option value="north">North</option>
            <option value="south">South</option>
            <option value="east">East</option>
            <option value="west">West</option>
          </select>
        </div>

        <div className="warehouse-control-group">
          <label className="warehouse-toggle">
            <input
              type="checkbox"
              checked={!!config.sideDoors}
              onChange={(e) => updateConfig({ sideDoors: e.target.checked })}
            />
            <span>Side Doors</span>
          </label>
        </div>
      </CollapsibleSection>

      {/* Mezzanine Section */}
      <CollapsibleSection title="Mezzanine" icon={<Layers size={14} />} defaultOpen={false}>
        <div className="warehouse-control-group">
          <label className="warehouse-toggle">
            <input
              type="checkbox"
              checked={!!config.mezzanineEnabled}
              onChange={(e) => updateConfig({ mezzanineEnabled: e.target.checked })}
            />
            <span>Enabled</span>
          </label>
        </div>

        {config.mezzanineEnabled && (
          <>
            <div className="warehouse-control-group">
              <label className="warehouse-label">Height (mm)</label>
              <input
                type="number"
                value={config.mezzanineHeight || 8000}
                onChange={(e) => updateConfig({ mezzanineHeight: parseInt(e.target.value) || 8000 })}
                className="warehouse-input"
                min={1000}
                max={config.height - 1000}
                step={100}
              />
            </div>

            <div className="warehouse-control-group">
              <label className="warehouse-label">Type</label>
              <select
                value={config.mezzanineType || 'grid'}
                onChange={(e) => updateConfig({ mezzanineType: e.target.value as MezzanineType })}
                className="warehouse-select"
              >
                <option value="grid">Grid</option>
                <option value="solid">Solid</option>
              </select>
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* Lighting Section */}
      <CollapsibleSection title="Lighting" icon={<Sun size={14} />} defaultOpen={false}>
        <div className="warehouse-control-group">
          <label className="warehouse-toggle">
            <input
              type="checkbox"
              checked={!!config.enableSun}
              onChange={(e) => updateConfig({ enableSun: e.target.checked })}
            />
            <span>Sun Light</span>
          </label>
        </div>

        {config.enableSun && (
          <>
            <div className="warehouse-control-group">
              <label className="warehouse-label">Azimuth: {config.sunAzimuth ?? -45}°</label>
              <input
                type="range"
                min={-180}
                max={180}
                step={5}
                value={config.sunAzimuth ?? -45}
                onChange={(e) => updateConfig({ sunAzimuth: parseFloat(e.target.value) })}
                className="warehouse-slider"
              />
            </div>

            <div className="warehouse-control-group">
              <label className="warehouse-label">Elevation: {config.sunElevation ?? 35}°</label>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={config.sunElevation ?? 35}
                onChange={(e) => updateConfig({ sunElevation: parseFloat(e.target.value) })}
                className="warehouse-slider"
              />
            </div>

            <div className="warehouse-control-group">
              <label className="warehouse-label">Intensity: {(config.sunIntensity ?? 1.0).toFixed(1)}</label>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={config.sunIntensity ?? 1.0}
                onChange={(e) => updateConfig({ sunIntensity: parseFloat(e.target.value) })}
                className="warehouse-slider"
              />
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* Atmosphere Section */}
      <CollapsibleSection title="Atmosphere" icon={<Cloud size={14} />} defaultOpen={false}>
        <div className="warehouse-control-group">
          <label className="warehouse-toggle">
            <input
              type="checkbox"
              checked={!!config.enableFog}
              onChange={(e) => updateConfig({ enableFog: e.target.checked })}
            />
            <span>Fog</span>
          </label>
        </div>

        <div className="warehouse-control-group">
          <label className="warehouse-toggle">
            <input
              type="checkbox"
              checked={!!config.enableSkybox}
              onChange={(e) => updateConfig({ enableSkybox: e.target.checked })}
            />
            <span>Skybox</span>
          </label>
        </div>

        {config.enableSkybox && (
          <div className="warehouse-control-group">
            <label className="warehouse-label">Skybox Source</label>
            <select
              value={config.skyboxSource || 'sunny'}
              onChange={(e) => updateConfig({ skyboxSource: e.target.value as SkyboxSource })}
              className="warehouse-select"
            >
              <option value="industrial">Industrial</option>
              <option value="sunny">Sunny Day</option>
              <option value="overcast">Overcast</option>
              <option value="night">Night Sky</option>
              <option value="sunset">Sunset</option>
            </select>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );

  return (
    <FloatingPanel
      title="Warehouse"
      subtitle="Configure warehouse dimensions and structure"
      icon={icon}
      isVisible={panelVisible}
      onClose={onClose}
      zIndex={zIndex}
      defaultPosition={{ x: window.innerWidth - 480, y: 120 }}
      defaultSize={{ width: 420, height: 700 }}
      minWidth={380}
      minHeight={400}
      maxWidth={600}
      maxHeight={900}
    >
      {panelContent}
    </FloatingPanel>
  );
};

