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
      camera.alpha = -Math.PI / 2;
      camera.beta = Math.PI / 3;
      camera.radius = 10;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleZoomFit = () => {
    zoomFit();
  };

  // Update transform display when selection changes
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

      if (node.babylonMeshId) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh) {
          const entity = registry.getByMesh(mesh);
          if (entity && entity.getIsDevice()) {
            babylonNode = entity.getRootTransformNode();
          } else {
            babylonNode = mesh;
          }
        }
      } else if (node.type === 'collection') {
        babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
      }

      if (babylonNode) {
        const userPos = babylonToUser(babylonNode.position);
        const rotation = babylonNode.rotation;

        const newTransform = {
          x: Math.round(userPos.x * 10) / 10,
          y: Math.round(userPos.y * 10) / 10,
          z: Math.round(userPos.z * 10) / 10,
          rx: Math.round((rotation.x * 180 / Math.PI) * 10) / 10,
          ry: Math.round((rotation.y * 180 / Math.PI) * 10) / 10,
          rz: Math.round((rotation.z * 180 / Math.PI) * 10) / 10,
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
  }, [selectedNodeId]);

  return (
    <div className="essential-layout">
      {/* Header */}
      <header className="essential-header">
        <div className="header-left">
          <h1 className="logo">kinetiCORE</h1>
          <span className="mode-badge">Essential</span>
        </div>
        <div className="header-center"></div>
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
        {/* Left Sidebar */}
        <aside className="essential-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Scene Tree</h3>
            <SceneTree />
          </div>
          <div className="sidebar-section">
            <h3 className="sidebar-title">Kinematics</h3>
            <KinematicsPanel />
          </div>
        </aside>

        {/* Main Viewport */}
        <main id="viewport-essential" className="essential-viewport"></main>
      </div>

      {/* Floating Toolbar */}
      <div className="floating-toolbar">
        <button className="toolbar-btn active" onClick={() => {}} title="Move & Rotate (Combined)">
          <div style={{ position: 'relative', width: 14, height: 14 }}>
            <Move size={12} style={{ position: 'absolute', top: 0, left: 0 }} />
            <RotateCw size={9} style={{ position: 'absolute', bottom: 0, right: 0 }} />
          </div>
        </button>
        <button className="toolbar-btn" onClick={() => createObject('box')} title="Create Box">
          <Box size={14} />
        </button>
        <button className="toolbar-btn" onClick={() => createObject('sphere')} title="Create Sphere">
          <Circle size={14} />
        </button>
        <button className="toolbar-btn" onClick={() => createObject('cylinder')} title="Create Cylinder">
          <Cylinder size={14} />
        </button>
        <button className="toolbar-btn" onClick={handleFileImport} title="Import Model">
          <Upload size={14} />
        </button>
        <button className="toolbar-btn" onClick={handleLoadWorld} title="Load World">
          <FolderOpen size={14} />
        </button>
        <button className="toolbar-btn" onClick={saveWorld} title="Save World">
          <Save size={14} />
        </button>
      </div>

      {/* Viewport Controls */}
      <div className="viewport-controls">
        <button className="control-btn" onClick={handleResetView}>Reset View</button>
        <button className="control-btn" onClick={handleZoomFit}>Zoom Fit</button>
      </div>

      {/* Transform Display */}
      {transform && (
        <div className="transform-display">
          <div className="transform-row">
            <span className="transform-value">X:{transform.x}</span>
            <span className="transform-value">Y:{transform.y}</span>
            <span className="transform-value">Z:{transform.z}</span>
          </div>
          <div className="transform-row">
            <span className="transform-value">RX:{transform.rx}°</span>
            <span className="transform-value">RY:{transform.ry}°</span>
            <span className="transform-value">RZ:{transform.rz}°</span>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.dae,.gltf,.glb"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={loadFileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleLoadFileChange}
      />
    </div>
  );
};
