// Warehouse Panel - Standalone docking panel for warehouse controls
// Owner: Routing System Team

import React, { useState, useEffect, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { 
  Minus, 
  Plus, 
  Maximize2,
  Building2,
  Eye,
  EyeOff,
  Camera
} from 'lucide-react';
import { SceneManager } from '../../scene/SceneManager';
import { WarehouseModel, WarehouseConfig, SkyboxSource } from '../core/WarehouseModel';
import { CameraService } from '../../scene/services/CameraService';
import './WarehouseControls.css';

/**
 * Standalone warehouse controls panel for docking system
 * Extracted from WarehouseControls.tsx for use as a dockable panel
 */
export const WarehousePanel: React.FC = () => {
  const [warehouse, setWarehouse] = useState<WarehouseModel | null>(null);
  const [config, setConfig] = useState<WarehouseConfig>({
    width: 50000,  // 50m
    depth: 50000,  // 50m
    height: 20000,  // 20m
    // Atmosphere settings
    enableFog: false,
    enableSkybox: false, // DISABLED: Causes rendering issues
    // Sun defaults
    enableSun: true,
    sunAzimuth: -45,
    sunElevation: 35,
    sunIntensity: 1.0,
    // Skybox source default
    skyboxSource: 'sunny',
  });
  const [isVisible, setIsVisible] = useState(false); // DEBUG: Hidden by default for skybox/floor debugging

  const createSkyboxOnly = useCallback((scene: BABYLON.Scene) => {
    // DISABLED: Skybox causes rendering issues
    // Just create warehouse without skybox
    const noSkyboxConfig = { ...config, skipBuilding: true, enableSkybox: false };
    const warehouse = new WarehouseModel(scene, noSkyboxConfig);
    (warehouse as any).isSkyboxOnly = true;
    setWarehouse(warehouse);
    console.log('[WarehousePanel] ✅ Created warehouse (no skybox)');
  }, [config]);

  const initializeWarehouse = useCallback((scene: BABYLON.Scene) => {
    // Don't modify scene background - keep the default cloudy sky
    // Create warehouse model without skybox
    const warehouseModel = new WarehouseModel(scene, { ...config, enableSkybox: false });
    setWarehouse(warehouseModel);

    // Keep the default ground plane visible (warehouse floor replaces it, but grid overlay stays)
    // Don't hide ground - let warehouse handle its own floor

    // Configure camera for EXTERIOR view - position OUTSIDE the warehouse
    const camera = CameraService.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      const widthM = config.width / 1000;
      const depthM = config.depth / 1000;
      const heightM = config.height / 1000;
      
      // Set clipping planes for exterior view + skybox visibility
      camera.minZ = 0.1; // Near: 10cm
      // CRITICAL: maxZ must be HUGE to see the skybox (which is 1000x warehouse size)
      const skyboxSize = 1_000_000; // Skybox is 1,000km
      const maxDimension = Math.max(widthM, depthM, heightM);
      camera.maxZ = Math.max(skyboxSize * 1.5, maxDimension * 2000); // At least 1.5x skybox size (1,500,000)
      
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
      
      console.log(`[WarehousePanel] 📷 Camera positioned OUTSIDE warehouse`);
      console.log(`[WarehousePanel] Camera target: (${camera.target.x.toFixed(1)}, ${camera.target.y.toFixed(1)}, ${camera.target.z.toFixed(1)})`);
      console.log(`[WarehousePanel] Camera radius: ${camera.radius.toFixed(1)}m (outside warehouse)`);
      console.log(`[WarehousePanel] Camera position: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`);
    }
  }, [config]);

  // Create skybox-only warehouse immediately (for skybox visibility)
  useEffect(() => {
    let scene = SceneManager.getInstance().getScene();
    if (!scene) {
      const retryTimeout = setTimeout(() => {
        scene = SceneManager.getInstance().getScene();
        if (scene && !warehouse) {
          createSkyboxOnly(scene);
        }
      }, 500);
      return () => clearTimeout(retryTimeout);
    }

    // Create skybox-only warehouse if it doesn't exist
    if (!warehouse && scene) {
      createSkyboxOnly(scene);
    }

    // Cleanup: dispose warehouse when component unmounts
    return () => {
      if (warehouse) {
        warehouse.dispose();
        setWarehouse(null);
      }
    };
  }, [createSkyboxOnly]); // Run once on mount

  // Handle visibility toggle - switch between skybox-only and full warehouse
  useEffect(() => {
    if (!warehouse) return;

    const scene = SceneManager.getInstance().getScene();
    if (!scene) return;

    const isSkyboxOnly = (warehouse as any).isSkyboxOnly;

    if (isVisible && isSkyboxOnly) {
      // Switch from skybox-only to full warehouse
      warehouse.dispose();
      setWarehouse(null);
      initializeWarehouse(scene);
    } else if (!isVisible && !isSkyboxOnly) {
      // Switch from full warehouse to skybox-only
      warehouse.dispose();
      setWarehouse(null);
      createSkyboxOnly(scene);
    }
  }, [isVisible, warehouse, createSkyboxOnly, initializeWarehouse]);

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
    setConfig(prev => ({
      ...prev,
      width: 50000,
      depth: 50000,
      height: 20000,
    }));
  };

  const toggleVisibility = () => {
    const newVisible = !isVisible;
    setIsVisible(newVisible);
    // Warehouse creation/disposal is handled by useEffect based on isVisible
    // No need to manually enable/disable rootNode - warehouse will be created/destroyed
  };

  const resetCamera = () => {
    const camera = CameraService.getInstance().getCamera();
    if (camera && camera instanceof BABYLON.ArcRotateCamera) {
      const widthM = config.width / 1000;
      const depthM = config.depth / 1000;
      const heightM = config.height / 1000;
      
      // Set clipping planes for exterior view + skybox visibility
      camera.minZ = 0.1;
      // CRITICAL: maxZ must be larger than skybox (1,000,000 units) to see sky!
      const skyboxSize = 1_000_000; // Skybox is 1,000km
      camera.maxZ = Math.max(skyboxSize * 1.5, Math.max(widthM, depthM, heightM) * 2000); // At least 1.5x skybox size

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
      
      console.log(`[WarehousePanel] 📷 Camera reset to exterior view (outside warehouse)`);
    }
  };

  const formatSize = (mm: number): string => {
    if (mm >= 1000) {
      return `${(mm / 1000).toFixed(1)}m`;
    }
    return `${mm.toFixed(0)}mm`;
  };

  // Show full UI even when warehouse is not created - user can click to create it
  // if (!warehouse) {
  //   return (
  //     <div style={{ padding: '20px', color: '#a0aec0', textAlign: 'center' }}>
  //       <div>Initializing warehouse...</div>
  //     </div>
  //   );
  // }

  return (
    <div className="warehouse-controls" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="warehouse-controls-header">
        <div className="header-left">
          <Building2 size={16} />
          <span>Warehouse</span>
        </div>
        <div className="header-actions">
          <button className="icon-btn-small" onClick={resetSize} title="Reset size">
            <Maximize2 size={14} />
          </button>
          <button className="icon-btn-small" onClick={resetCamera} title="Reset camera">
            <Camera size={14} />
          </button>
          <button
            className="icon-btn-small"
            onClick={toggleVisibility}
            title={isVisible ? 'Hide warehouse' : 'Show warehouse'}
            disabled={!warehouse || (warehouse as any).isSkyboxOnly}
          >
            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {(!warehouse || (warehouse as any).isSkyboxOnly) && (
            <button
              className="icon-btn-small"
              onClick={() => {
                const scene = SceneManager.getInstance().getScene();
                if (scene) {
                  if (warehouse) {
                    warehouse.dispose();
                  }
                  initializeWarehouse(scene);
                  setIsVisible(true);
                }
              }}
              title="Create warehouse"
              style={{ marginLeft: '8px', padding: '4px 8px', fontSize: '11px', background: '#4a90e2', color: 'white' }}
            >
              Create Warehouse
            </button>
          )}
        </div>
      </div>

      <div className="warehouse-controls-body" style={{ flex: 1, overflowY: 'auto' }}>
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

        {/* Atmosphere Controls */}
        <div className="size-control-group" style={{ marginTop: 12 }}>
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

        {/* Sun Controls */}
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

        {/* Skybox Source Controls */}
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
              value={config.skyboxSource || 'sunny'}
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


