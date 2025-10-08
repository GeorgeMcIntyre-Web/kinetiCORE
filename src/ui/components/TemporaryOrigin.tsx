// Temporary Origin Tool
// Owner: Edwin
// Allows setting a temporary reference point for relative positioning

import { useEffect } from 'react';
import { Target, XCircle, MousePointer, Home } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { babylonToUser } from '../../core/CoordinateSystem';
import * as BABYLON from '@babylonjs/core';
import './TemporaryOrigin.css';

export const TemporaryOrigin: React.FC = () => {
  const temporaryOrigin = useEditorStore((state) => state.temporaryOrigin);
  const setTemporaryOrigin = useEditorStore((state) => state.setTemporaryOrigin);
  const clearTemporaryOrigin = useEditorStore((state) => state.clearTemporaryOrigin);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);

  const handleSetOriginFromSelection = () => {
    if (!selectedNodeId) return;

    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(selectedNodeId);
    if (!node) return;

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // Get Babylon node
    let babylonNode: BABYLON.TransformNode | null = null;
    if (node.babylonMeshId) {
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
    } else if (node.type === 'collection') {
      babylonNode = scene.transformNodes.find((tn) => tn.name === node.name) || null;
    }

    if (!babylonNode) return;

    // Get world position
    const worldPos = babylonNode.getAbsolutePosition();
    const userPos = babylonToUser(worldPos);

    setTemporaryOrigin(userPos);
  };

  const handleSetOriginFromSnap = () => {
    if (!snapEnabled) {
      alert('Enable snapping first to use snap-to origin');
      return;
    }
    // TODO: Enter snap mode to select a snap point
    alert('Snap-to origin: Click on a vertex, edge, or face in the 3D view');
  };

  const handleSetOriginAtWorldZero = () => {
    setTemporaryOrigin({ x: 0, y: 0, z: 0 });
  };

  // Visualize temporary origin in 3D scene
  useEffect(() => {
    if (!temporaryOrigin) return;

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // Create origin marker (small coordinate frame)
    const originMarker = BABYLON.MeshBuilder.CreateSphere(
      'tempOriginMarker',
      { diameter: 0.05 },
      scene
    );

    // Convert user coords to Babylon
    originMarker.position.set(
      temporaryOrigin.x / 1000, // mm to m
      temporaryOrigin.z / 1000, // User Z -> Babylon Y
      temporaryOrigin.y / 1000  // User Y -> Babylon Z
    );

    const mat = new BABYLON.StandardMaterial('tempOriginMat', scene);
    mat.emissiveColor = new BABYLON.Color3(1, 0.5, 0); // Orange
    mat.disableLighting = true;
    originMarker.material = mat;

    // Add axis lines
    const createAxisLine = (axis: BABYLON.Vector3, color: BABYLON.Color3) => {
      const line = BABYLON.MeshBuilder.CreateLines(
        'tempOriginAxis',
        {
          points: [
            originMarker.position.clone(),
            originMarker.position.add(axis.scale(0.2)),
          ],
        },
        scene
      );
      (line as any).color = color;
      return line;
    };

    const xAxis = createAxisLine(new BABYLON.Vector3(1, 0, 0), new BABYLON.Color3(1, 0, 0));
    const yAxis = createAxisLine(new BABYLON.Vector3(0, 1, 0), new BABYLON.Color3(0, 1, 0));
    const zAxis = createAxisLine(new BABYLON.Vector3(0, 0, 1), new BABYLON.Color3(0, 0, 1));

    // Cleanup
    return () => {
      originMarker.dispose();
      xAxis.dispose();
      yAxis.dispose();
      zAxis.dispose();
    };
  }, [temporaryOrigin]);

  return (
    <div className="temporary-origin-panel">
      <div className="temp-origin-header" title="Temporary Origin">
        <Target size={10} />
      </div>

      {temporaryOrigin ? (
        <div className="temp-origin-active">
          <div className="temp-origin-coords">
            <div className="coord-display">
              <span className="coord-label">X</span>
              <span className="coord-value">{temporaryOrigin.x.toFixed(0)}</span>
            </div>
            <div className="coord-display">
              <span className="coord-label">Y</span>
              <span className="coord-value">{temporaryOrigin.y.toFixed(0)}</span>
            </div>
            <div className="coord-display">
              <span className="coord-label">Z</span>
              <span className="coord-value">{temporaryOrigin.z.toFixed(0)}</span>
            </div>
          </div>
          <button className="clear-origin-btn" onClick={clearTemporaryOrigin} title="Clear Origin">
            <XCircle size={8} />
          </button>
        </div>
      ) : (
        <div className="temp-origin-options">
          <button
            className="origin-option-btn"
            onClick={handleSetOriginFromSelection}
            disabled={!selectedNodeId}
            title="From Selection"
          >
            <Target size={10} />
          </button>
          <button
            className="origin-option-btn"
            onClick={handleSetOriginAtWorldZero}
            title="World Zero"
          >
            <Home size={10} />
          </button>
          <button
            className="origin-option-btn"
            onClick={handleSetOriginFromSnap}
            disabled={!snapEnabled}
            title="Snap To Point"
          >
            <MousePointer size={10} />
          </button>
        </div>
      )}
    </div>
  );
};
