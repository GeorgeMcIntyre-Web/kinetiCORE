// Warehouse Controls - Compact UI for adjusting warehouse model
// Owner: Routing System Team

import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { 
  Minus, 
  Plus, 
  Maximize2,
  Building2,
  X,
  Eye,
  EyeOff,
  Camera
} from 'lucide-react';
import { SceneManager } from '../../scene/SceneManager';
import { WarehouseModel, WarehouseConfig, SkyboxSource } from '../core/WarehouseModel';
import { CameraService } from '../../scene/services/CameraService';
import './WarehouseControls.css';

interface WarehouseControlsProps {
  onClose?: () => void;
}

/**
 * Compact warehouse controls panel with icon buttons
 * Allows adjusting warehouse size and configuring interior view
 */
export const WarehouseControls: React.FC<WarehouseControlsProps> = ({ onClose }) => {
  const [warehouse, setWarehouse] = useState<WarehouseModel | null>(null);
  const [config, setConfig] = useState<WarehouseConfig>({
    width: 50000,  // 50m
    depth: 50000,  // 50m
    height: 20000,  // 20m
    // Atmosphere settings
    enableFog: false, // Disable fog by default to see skybox clearly
    enableSkybox: true,
    // PROMPT #3: Sun defaults
    enableSun: true,
    sunAzimuth: -45,
    sunElevation: 35,
    sunIntensity: 1.0,
    // PROMPT #4: Skybox source default
    skyboxSource: 'sunny', // Blue sky with clouds
  });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Wait for scene to be ready with retry
    let scene = SceneManager.getInstance().getScene();
    if (!scene) {
      const retryTimeout = setTimeout(() => {
        scene = SceneManager.getInstance().getScene();
        if (scene) {
          initializeWarehouse(scene);
        } else {
          console.warn('[WarehouseControls] Scene not available after retry');
        }
      }, 500);
      return () => clearTimeout(retryTimeout);
    }

    return initializeWarehouse(scene);
  }, []);

  const initializeWarehouse = (scene: BABYLON.Scene) => {
    // CRITICAL: Set background to transparent BEFORE creating warehouse
    // This ensures skybox is visible (per Babylon.js official docs)
    SceneManager.getInstance().setBackgroundTransparent(true);

    // Create warehouse model
    const warehouseModel = new WarehouseModel(scene, config);
    setWarehouse(warehouseModel);

    // Hide the default ground plane - we use warehouse's parking lot and grass instead
    const ground = SceneManager.getInstance().getGround();
    if (ground) {
      ground.setEnabled(false);
      ground.isVisible = false;
    }

    // Configure camera for EXTERIOR view - position OUTSIDE the warehouse
    const camera = CameraService.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      const widthM = config.width / 1000;
      const depthM = config.depth / 1000;
      const heightM = config.height / 1000;
      
      // Set clipping planes for exterior view + skybox visibility
      camera.minZ = 0.1; // Near: 10cm
      // CRITICAL: maxZ must be HUGE to see the skybox (which is 1000x warehouse size)
      const maxDimension = Math.max(widthM, depthM, heightM);
      camera.maxZ = maxDimension * 2000; // Far: must see skybox (2000x warehouse size)
      
      // Position camera OUTSIDE the warehouse, looking at it from an angle
      // Target the center of the warehouse at mid-height
      camera.target = new BABYLON.Vector3(0, heightM * 0.5, 0); // Center of warehouse at half height

      // Position camera OUTSIDE looking at the warehouse
      // Place camera just outside the warehouse, at a good viewing distance
      // Position it diagonally outside (further than the warehouse dimensions)
      const maxHorizontalDimension = Math.max(widthM, depthM);
      const exteriorDistance = maxHorizontalDimension * 1.5; // 1.5x the largest dimension - just outside
      const cameraHeight = heightM * 0.6; // 60% of warehouse height - good viewing angle
      
      camera.radius = Math.sqrt(
        Math.pow(exteriorDistance, 2) + 
        Math.pow(exteriorDistance, 2) + 
        Math.pow(cameraHeight, 2)
      ); // Distance from target

      // Set camera angle to look at warehouse from outside (isometric-like view)
      camera.alpha = Math.PI / 4; // 45° around - diagonal view
      camera.beta = Math.PI / 3; // 60° from vertical - slightly elevated to see sky
      
      // Update camera immediately
      camera.setTarget(camera.target);
      
      console.log(`[WarehouseControls] 📷 Camera positioned OUTSIDE warehouse`);
      console.log(`[WarehouseControls] Camera target: (${camera.target.x.toFixed(1)}, ${camera.target.y.toFixed(1)}, ${camera.target.z.toFixed(1)})`);
      console.log(`[WarehouseControls] Camera radius: ${camera.radius.toFixed(1)}m (outside warehouse)`);
      console.log(`[WarehouseControls] Camera position: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`);
    }

    return () => {
      warehouseModel.dispose();
    };
  };

  // Update warehouse when config changes
  useEffect(() => {
    if (!warehouse) return;

    warehouse.updateSize(config);
    
    // Update floor size
    SceneManager.getInstance().resizeFloor(config.width / 1000, config.depth / 1000);

    // Update camera for new warehouse size - keep camera OUTSIDE
    const camera = CameraService.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      const widthM = config.width / 1000;
      const depthM = config.depth / 1000;
      const heightM = config.height / 1000;
      
      camera.minZ = 0.1;
      camera.maxZ = Math.max(widthM, depthM, heightM) * 2000; // Must see skybox
      
      // Position camera OUTSIDE the warehouse
      camera.target = new BABYLON.Vector3(0, heightM * 0.5, 0); // Center of warehouse at half height
      
      // Keep camera outside with appropriate distance
      const maxDimension = Math.max(widthM, depthM);
      const exteriorDistance = maxDimension * 1.5; // 1.5x the largest dimension - just outside
      const cameraHeight = heightM * 0.6; // 60% of warehouse height
      
      camera.radius = Math.sqrt(
        Math.pow(exteriorDistance, 2) + 
        Math.pow(exteriorDistance, 2) + 
        Math.pow(cameraHeight, 2)
      );
      
      camera.alpha = Math.PI / 4; // 45° around - diagonal view
      camera.beta = Math.PI / 3; // 60° from vertical
      
      camera.setTarget(camera.target);
    }
  }, [config, warehouse]);

  const adjustSize = (dimension: 'width' | 'depth' | 'height', delta: number) => {
    const minSize = 10000; // 10m minimum
    const maxSize = 200000; // 200m maximum
    
    setConfig(prev => {
      const newValue = Math.max(minSize, Math.min(maxSize, prev[dimension] + delta));
      return { ...prev, [dimension]: newValue };
    });
  };

  const resetSize = () => {
    setConfig({
      width: 50000,
      depth: 50000,
      height: 20000,
    });
  };

  const toggleVisibility = () => {
    const newVisible = !isVisible;
    setIsVisible(newVisible);
    if (warehouse) {
      const rootNode = warehouse.getRootNode();
      rootNode.setEnabled(newVisible);
    }
  };

  const resetCameraToInterior = () => {
    const camera = CameraService.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      const widthM = config.width / 1000;
      const depthM = config.depth / 1000;
      const heightM = config.height / 1000;
      
      // Set clipping planes for exterior view + skybox visibility
      camera.minZ = 0.1;
      camera.maxZ = Math.max(widthM, depthM, heightM) * 2000; // Must see skybox

      // Position camera OUTSIDE the warehouse, looking at it
      camera.target = new BABYLON.Vector3(0, heightM * 0.5, 0); // Center of warehouse at half height
      
      // Position camera OUTSIDE with appropriate distance
      const maxDimension = Math.max(widthM, depthM);
      const exteriorDistance = maxDimension * 1.5; // 1.5x the largest dimension - just outside
      const cameraHeight = heightM * 0.6; // 60% of warehouse height
      
      camera.radius = Math.sqrt(
        Math.pow(exteriorDistance, 2) + 
        Math.pow(exteriorDistance, 2) + 
        Math.pow(cameraHeight, 2)
      );
      
      // Set camera angle to look at warehouse from outside (isometric-like view)
      camera.alpha = Math.PI / 4; // 45° around - diagonal view
      camera.beta = Math.PI / 3; // 60° from vertical - slightly elevated to see sky
      
      // Update camera immediately
      camera.setTarget(camera.target);
      
      console.log(`[WarehouseControls] 📷 Camera reset to exterior view (outside warehouse)`);
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

  return (
    <div className="warehouse-controls">
      <div className="warehouse-controls-header">
        <div className="header-left">
          <Building2 size={16} />
          <span>Warehouse</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn-small" onClick={resetSize} title="Reset size">
            <Maximize2 size={14} />
          </button>
          <button className="icon-btn-small" onClick={resetCameraToInterior} title="Reset camera">
            <Camera size={14} />
          </button>
          <button
            className="icon-btn-small"
            onClick={toggleVisibility}
            title={isVisible ? 'Hide warehouse' : 'Show warehouse'}
          >
            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {onClose && (
            <button className="icon-btn-small" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="warehouse-controls-body">
        {/* Dimensions presented in one compact grid */}
        <div className="size-grid">
          <div className="size-item">
            <label className="size-label">Width (X)</label>
            <div className="size-control">
              <button className="icon-btn-compact" onClick={() => adjustSize('width', -5000)} title="-5m">
                <Minus size={12} />
              </button>
              <span className="size-value">{formatSize(config.width)}</span>
              <button className="icon-btn-compact" onClick={() => adjustSize('width', 5000)} title="+5m">
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="size-item">
            <label className="size-label">Depth (Y)</label>
            <div className="size-control">
              <button className="icon-btn-compact" onClick={() => adjustSize('depth', -5000)} title="-5m">
                <Minus size={12} />
              </button>
              <span className="size-value">{formatSize(config.depth)}</span>
              <button className="icon-btn-compact" onClick={() => adjustSize('depth', 5000)} title="+5m">
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="size-item">
            <label className="size-label">Height (Z)</label>
            <div className="size-control">
              <button className="icon-btn-compact" onClick={() => adjustSize('height', -1000)} title="-1m">
                <Minus size={12} />
              </button>
              <span className="size-value">{formatSize(config.height)}</span>
              <button className="icon-btn-compact" onClick={() => adjustSize('height', 1000)} title="+1m">
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>

        

        

        
        <div className="presets-group">
          <button className="preset-btn" onClick={resetSize} title="Reset to 50m × 50m × 20m">
            <Maximize2 size={12} />
            <span>Reset Size</span>
          </button>
          <button className="preset-btn" onClick={resetCameraToInterior} title="Reset camera to interior view">
            <Camera size={12} />
            <span>Reset Camera</span>
          </button>
        </div>

        {/* Atmosphere Controls */}
        <div className="size-control-group" style={{ marginTop: 6 }}>
          <label className="size-label">
            <input
              type="checkbox"
              checked={!!config.enableFog}
              onChange={() => {
                const next = !config.enableFog;
                setConfig((p) => ({ ...p, enableFog: next }));
                if (warehouse) {
                  warehouse.updateSize({ enableFog: next });
                }
              }}
            />
            Fog
          </label>
        </div>

        {/* PROMPT #3: Sun Controls */}
        <div className="size-control-group" style={{ marginTop: 6 }}>
          <label className="size-label">
            <input
              type="checkbox"
              checked={!!config.enableSun}
              onChange={() => {
                const next = !config.enableSun;
                setConfig((p) => ({ ...p, enableSun: next }));
                if (warehouse) {
                  warehouse.updateSize({ enableSun: next });
                }
              }}
            />
            Sun Light
          </label>

          {config.enableSun && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <span style={{ width: 70, fontSize: '11px' }}>Azimuth</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={config.sunAzimuth ?? -45}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setConfig((p) => ({ ...p, sunAzimuth: v }));
                    if (warehouse) {
                      warehouse.updateSize({ sunAzimuth: v });
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <span className="size-value" style={{ width: 40 }}>
                  {(config.sunAzimuth ?? -45).toFixed(0)}°
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 70, fontSize: '11px' }}>Elevation</span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={config.sunElevation ?? 35}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setConfig((p) => ({ ...p, sunElevation: v }));
                    if (warehouse) {
                      warehouse.updateSize({ sunElevation: v });
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <span className="size-value" style={{ width: 40 }}>
                  {(config.sunElevation ?? 35).toFixed(0)}°
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 70, fontSize: '11px' }}>Intensity</span>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={0.1}
                  value={config.sunIntensity ?? 1.0}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setConfig((p) => ({ ...p, sunIntensity: v }));
                    if (warehouse) {
                      warehouse.updateSize({ sunIntensity: v });
                    }
                  }}
                  style={{ flex: 1 }}
                />
                <span className="size-value" style={{ width: 40 }}>
                  {(config.sunIntensity ?? 1.0).toFixed(1)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* PROMPT #4: Skybox Source Controls */}
        <div className="size-control-group" style={{ marginTop: 6 }}>
          <label className="size-label">
            <input
              type="checkbox"
              checked={!!config.enableSkybox}
              onChange={() => {
                const next = !config.enableSkybox;
                setConfig((p) => ({ ...p, enableSkybox: next }));
                if (warehouse) {
                  warehouse.updateSize({ enableSkybox: next });
                }
              }}
            />
            Enable Skybox
          </label>
          
          {config.enableSkybox && (
            <select
              value={config.skyboxSource || 'industrial'}
              onChange={(e) => {
                const source = e.target.value as SkyboxSource;
                setConfig((p) => ({ ...p, skyboxSource: source }));
                if (warehouse) {
                  warehouse.updateSize({ skyboxSource: source });
                }
              }}
              style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: '#2a2a2a',
                color: '#fff',
                cursor: 'pointer',
                marginTop: '6px',
              }}
            >
              <option value="industrial">Industrial (Default)</option>
              <option value="sunny">Sunny Day</option>
              <option value="overcast">Overcast</option>
              <option value="night">Night Sky</option>
              <option value="sunset">Sunset</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
};
