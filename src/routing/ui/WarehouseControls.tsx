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
  EyeOff
} from 'lucide-react';
import { SceneManager } from '../../scene/SceneManager';
import { WarehouseModel, WarehouseConfig } from '../core/WarehouseModel';
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
    height: 6000,  // 6m
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
    // Create warehouse model
    const warehouseModel = new WarehouseModel(scene, config);
    setWarehouse(warehouseModel);

    // Resize floor to match warehouse
    SceneManager.getInstance().resizeFloor(config.width / 1000, config.depth / 1000);

    // Configure camera for interior view
    const camera = CameraService.getInstance().getCamera();
    if (camera) {
      // Set clipping planes for interior feel
      // Near: 10cm, Far: warehouse size * 2 for seeing inside
      camera.minZ = 0.1;
      camera.maxZ = (Math.max(config.width, config.depth) / 1000) * 2;
      
      // Adjust camera to center on warehouse
      camera.target = BABYLON.Vector3.Zero();
      camera.radius = Math.max(config.width, config.depth) / 1000 * 0.8; // 80% of max dimension
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

    // Update camera clipping
    const camera = CameraService.getInstance().getCamera();
    if (camera) {
      camera.maxZ = (Math.max(config.width, config.depth) / 1000) * 2;
      camera.radius = Math.max(config.width, config.depth) / 1000 * 0.8;
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
      height: 6000,
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
        {/* Width Control */}
        <div className="size-control-group">
          <label className="size-label">Width (X)</label>
          <div className="size-control">
            <button
              className="icon-btn-compact"
              onClick={() => adjustSize('width', -5000)}
              title="Decrease width by 5m"
            >
              <Minus size={12} />
            </button>
            <span className="size-value">{formatSize(config.width)}</span>
            <button
              className="icon-btn-compact"
              onClick={() => adjustSize('width', 5000)}
              title="Increase width by 5m"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Depth Control */}
        <div className="size-control-group">
          <label className="size-label">Depth (Y)</label>
          <div className="size-control">
            <button
              className="icon-btn-compact"
              onClick={() => adjustSize('depth', -5000)}
              title="Decrease depth by 5m"
            >
              <Minus size={12} />
            </button>
            <span className="size-value">{formatSize(config.depth)}</span>
            <button
              className="icon-btn-compact"
              onClick={() => adjustSize('depth', 5000)}
              title="Increase depth by 5m"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Height Control */}
        <div className="size-control-group">
          <label className="size-label">Height (Z)</label>
          <div className="size-control">
            <button
              className="icon-btn-compact"
              onClick={() => adjustSize('height', -1000)}
              title="Decrease height by 1m"
            >
              <Minus size={12} />
            </button>
            <span className="size-value">{formatSize(config.height)}</span>
            <button
              className="icon-btn-compact"
              onClick={() => adjustSize('height', 1000)}
              title="Increase height by 1m"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="presets-group">
          <button className="preset-btn" onClick={resetSize} title="Reset to 50m × 50m × 6m">
            <Maximize2 size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};