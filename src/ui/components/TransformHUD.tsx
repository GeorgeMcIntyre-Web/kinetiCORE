// Transform HUD - Bottom-right real-time position/rotation display
// Owner: Edwin
// Shows current XYZ position and rotation for selected object

import { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorStore } from '../store/editorStore';
import { babylonToUser } from '../../core/CoordinateSystem';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import { XNumericInput, YNumericInput, ZNumericInput } from './NumericInput';
import './TransformHUD.css';

export const TransformHUD: React.FC = () => {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const updateNodePosition = useEditorStore((state) => state.updateNodePosition);
  const updateNodeRotation = useEditorStore((state) => state.updateNodeRotation);
  const positionIncrement = useEditorStore((state) => state.positionIncrement);
  const rotationIncrement = useEditorStore((state) => state.rotationIncrement);
  const [, forceUpdate] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  // Poll for real-time updates
  useEffect(() => {
    if (!selectedNodeId || isEditing) return;

    const intervalId = setInterval(() => {
      forceUpdate({});
    }, 100); // 10fps update

    return () => clearInterval(intervalId);
  }, [selectedNodeId, isEditing]);

  if (!selectedNodeId) {
    return null; // Don't show when nothing is selected
  }

  const tree = SceneTreeManager.getInstance();
  const node = tree.getNode(selectedNodeId);
  if (!node) return null;

  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();
  if (!scene) return null;

  // Get the Babylon object
  let babylonNode: BABYLON.TransformNode | null = null;
  if (node.babylonMeshId) {
    babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
  } else if (node.type === 'collection') {
    babylonNode = scene.transformNodes.find((tn) => tn.name === node.name) || null;
  }

  if (!babylonNode) return null;

  // Get position (convert from Babylon to user coordinates)
  const isURDFMesh =
    babylonNode.metadata?.isURDFMesh ||
    babylonNode.metadata?.coordinateSystem === 'babylon-native';

  let pos: { x: number; y: number; z: number };
  if (isURDFMesh) {
    // URDF objects use Babylon's native Y-up, just convert units
    pos = {
      x: babylonNode.position.x * 1000,
      y: babylonNode.position.y * 1000,
      z: babylonNode.position.z * 1000,
    };
  } else {
    // Convert from Babylon Y-up to User Z-up
    pos = babylonToUser(babylonNode.position);
  }

  // Get rotation in degrees
  const rotationRadians = babylonNode.rotation;
  const rot = {
    x: (rotationRadians.x * 180) / Math.PI,
    y: (rotationRadians.y * 180) / Math.PI,
    z: (rotationRadians.z * 180) / Math.PI,
  };

  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const newPos = { ...pos, [axis]: value };
    updateNodePosition(selectedNodeId, newPos);
  };

  const handleRotationChange = (axis: 'x' | 'y' | 'z', value: number) => {
    const newRot = { ...rot, [axis]: value };
    updateNodeRotation(selectedNodeId, newRot);
  };

  return (
    <div className="transform-hud">
      <div className="transform-hud-header">
        <span className="transform-hud-title">{node.name}</span>
      </div>

      <div className="transform-hud-content">
        {/* Position */}
        <div className="transform-hud-section">
          <label className="transform-hud-label">Position (mm)</label>
          <div className="transform-hud-inputs">
            <div className="transform-hud-input-group">
              <span className="axis-label-x">X</span>
              <XNumericInput
                value={pos.x}
                onChange={(val) => handlePositionChange('x', val)}
                step={positionIncrement}
                precision={1}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
              />
            </div>
            <div className="transform-hud-input-group">
              <span className="axis-label-y">Y</span>
              <YNumericInput
                value={pos.y}
                onChange={(val) => handlePositionChange('y', val)}
                step={positionIncrement}
                precision={1}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
              />
            </div>
            <div className="transform-hud-input-group">
              <span className="axis-label-z">Z</span>
              <ZNumericInput
                value={pos.z}
                onChange={(val) => handlePositionChange('z', val)}
                step={positionIncrement}
                precision={1}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="transform-hud-section">
          <label className="transform-hud-label">Rotation (°)</label>
          <div className="transform-hud-inputs">
            <div className="transform-hud-input-group">
              <span className="axis-label-x">Rx</span>
              <XNumericInput
                value={rot.x}
                onChange={(val) => handleRotationChange('x', val)}
                step={rotationIncrement}
                precision={1}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
              />
            </div>
            <div className="transform-hud-input-group">
              <span className="axis-label-y">Ry</span>
              <YNumericInput
                value={rot.y}
                onChange={(val) => handleRotationChange('y', val)}
                step={rotationIncrement}
                precision={1}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
              />
            </div>
            <div className="transform-hud-input-group">
              <span className="axis-label-z">Rz</span>
              <ZNumericInput
                value={rot.z}
                onChange={(val) => handleRotationChange('z', val)}
                step={rotationIncrement}
                precision={1}
                onFocus={() => setIsEditing(true)}
                onBlur={() => setIsEditing(false)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
