// Essential Mode Layout - Beginner-friendly interface
// Owner: George (Architecture)

import React, { useRef, useEffect, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
  Box,
  Circle,
  Cylinder,
  Save,
  Upload,
  FolderOpen,
  Move,
  RotateCw,
} from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { SceneTree } from '../components/SceneTree';
import { KinematicsPanel } from '../components/KinematicsPanel';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { babylonToUser } from '../../core/CoordinateSystem';
import './EssentialModeLayout.css';

export const EssentialModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const importModel = useEditorStore((state) => state.importModel);
  const loadWorld = useEditorStore((state) => state.loadWorld);
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const zoomFit = useEditorStore((state) => state.zoomFit);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const transformMode = useEditorStore((state) => state.transformMode);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);

  const [transform, setTransform] = useState<{
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = () => {
    fileInputRef.current?.click();
  };

  const handleLoadWorld = () => {
    loadFileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && importModel) {
      await importModel(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleLoadFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && loadWorld) {
      await loadWorld(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleResetView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      // Reset to default camera position
      camera.alpha = -Math.PI / 2;
      camera.beta = Math.PI / 3;
      camera.radius = 10;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleZoomFit = () => {
    zoomFit();
  };

  // Update transform display when selection changes or object moves
  useEffect(() => {
    if (!selectedNodeId) {
      setTransform(null);
      return;
    }

    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    let lastTransform: string | null = null;

    const updateTransform = () => {
      const node = tree.getNode(selectedNodeId);
      if (!node) {
        setTransform(null);
        return;
      }

      let babylonNode: BABYLON.TransformNode | null = null;
      const registry = EntityRegistry.getInstance();

      // Get Babylon node (mesh or TransformNode)
      if (node.babylonMeshId) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh) {
          // Check if this mesh belongs to a device entity
          const entity = registry.getByMesh(mesh);
          if (entity && entity.getIsDevice()) {
            // For device entities, use the root transform node
            babylonNode = entity.getRootTransformNode();
          } else {
            // For regular meshes, use the mesh itself
            babylonNode = mesh;
          }
        }
      } else if (node.type === 'collection') {
        babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
      }

      if (babylonNode) {
        // Get position in user space (Z-up, mm)
        const userPos = babylonToUser(babylonNode.position);

        // Get rotation in degrees
        const rotation = babylonNode.rotation;

        const newTransform = {
          x: Math.round(userPos.x * 10) / 10,  // Round to 1 decimal
          y: Math.round(userPos.y * 10) / 10,
          z: Math.round(userPos.z * 10) / 10,
          rx: Math.round((rotation.x * 180 / Math.PI) * 10) / 10,
          ry: Math.round((rotation.y * 180 / Math.PI) * 10) / 10,
          rz: Math.round((rotation.z * 180 / Math.PI) * 10) / 10,
        };

        // Only update state if values actually changed
        const newTransformStr = JSON.stringify(newTransform);
        if (newTransformStr !== lastTransform) {
          lastTransform = newTransformStr;
          setTransform(newTransform);
        }
      } else {
        setTransform(null);
      }
    };

    // Initial update
    updateTransform();

    // Update on scene tree changes (when objects move)
    const handleSceneUpdate = () => updateTransform();
    window.addEventListener('scenetree-update', handleSceneUpdate);

    // Update on render loop (for real-time updates during dragging)
    const observer = scene?.onBeforeRenderObservable.add(() => {
      updateTransform();
    });

    return () => {
      window.removeEventListener('scenetree-update', handleSceneUpdate);
      if (scene && observer) {
        scene.onBeforeRenderObservable.remove(observer);
      }
    };
  }, [selectedNodeId]);

  return (
    <div className="essential-layout">
      {/* Header */}
      <header className="essential-header">
        <div className="header-left">
          <h1 className="logo">kinetiCORE</h1>
          <span className="mode-badge">Essential</span>
        </div>
        <div className="header-center">
          {/* Toolbar */}
          <div className="essential-toolbar">
            <button
              className="toolbar-btn active"
              onClick={() => {}}
              title="Move & Rotate (Combined)"
            >
              <div style={{ position: 'relative', width: 20, height: 20 }}>
                <Move size={16} style={{ position: 'absolute', top: 0, left: 0 }} />
                <RotateCw size={12} style={{ position: 'absolute', bottom: 0, right: 0 }} />
              </div>
            </button>
            <div className="toolbar-separator"></div>
            <button className="toolbar-btn" onClick={() => createObject('box')} title="Create Box">
              <Box size={20} />
            </button>
            <button className="toolbar-btn" onClick={() => createObject('sphere')} title="Create Sphere">
              <Circle size={20} />
            </button>
            <button className="toolbar-btn" onClick={() => createObject('cylinder')} title="Create Cylinder">
              <Cylinder size={20} />
            </button>
            <div className="toolbar-separator"></div>
            <button className="toolbar-btn" onClick={handleFileImport} title="Import Model">
              <Upload size={20} />
            </button>
            <button className="toolbar-btn" onClick={handleLoadWorld} title="Load World">
              <FolderOpen size={20} />
            </button>
            <button className="toolbar-btn" onClick={saveWorld} title="Save World">
              <Save size={20} />
            </button>
          </div>
        </div>
        <div className="header-right">
          <select
            value={userLevel}
            onChange={(e) => {
              const newLevel = e.target.value;
              if (newLevel === 'essential' || newLevel === 'professional' || newLevel === 'expert') {
                setUserLevel(newLevel);
              }
            }}
            className="user-level-select"
          >
            <option value="essential">Essential</option>
            <option value="professional">Professional</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </header>

      {/* Main Content */}
      <div className="essential-content">
        {/* Left Sidebar - Scene Tree and Kinematics */}
        <aside className="essential-left-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Scene</h3>
            <SceneTree />
          </div>
          <div className="sidebar-section">
            <h3 className="sidebar-title">Kinematics</h3>
            <KinematicsPanel onClose={() => {}} />
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="essential-viewport">
          {/* Viewport Controls */}
          <div className="viewport-controls">
            <button className="control-btn" title="Reset View" onClick={handleResetView}>
              Reset View
            </button>
            <button className="control-btn" title="Zoom to Fit" onClick={handleZoomFit}>
              Zoom Fit
            </button>
          </div>

          {/* Transform Display */}
          {transform && (
            <div className="transform-display">
              <h4>Position & Rotation</h4>
              <div className="transform-grid">
                <div className="transform-value">
                  <span className="transform-label">X</span>
                  <span className="transform-number">{transform.x} mm</span>
                </div>
                <div className="transform-value">
                  <span className="transform-label">Y</span>
                  <span className="transform-number">{transform.y} mm</span>
                </div>
                <div className="transform-value">
                  <span className="transform-label">Z</span>
                  <span className="transform-number">{transform.z} mm</span>
                </div>
                <div className="transform-value">
                  <span className="transform-label">Rx</span>
                  <span className="transform-number">{transform.rx}°</span>
                </div>
                <div className="transform-value">
                  <span className="transform-label">Ry</span>
                  <span className="transform-number">{transform.ry}°</span>
                </div>
                <div className="transform-value">
                  <span className="transform-label">Rz</span>
                  <span className="transform-number">{transform.rz}°</span>
                </div>
              </div>
            </div>
          )}

          {/* Viewport container - SceneCanvas will overlay this */}
          <div id="viewport-essential" className="viewport-canvas"></div>
        </main>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.dxf,.jt,.catpart,.catproduct,.catdrawing,.glb,.gltf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={loadFileInputRef}
        type="file"
        accept=".json"
        onChange={handleLoadFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};
