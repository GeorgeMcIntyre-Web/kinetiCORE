// Inspector component - shows properties of selected objects
// Owner: Edwin

import { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { RotateCcw, AlignCenter, Grid3x3 } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useUserLevel } from '../core/UserLevelContext';
import { babylonToUser } from '../../core/CoordinateSystem';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import type { ReferenceFrameType, CustomFrameFeatureType } from '../../core/types';
import { XNumericInput, YNumericInput, ZNumericInput } from './NumericInput';
import './Inspector.css';

export const Inspector: React.FC = () => {
  const { userLevel } = useUserLevel();
  const selectedMeshes = useEditorStore((state) => state.selectedMeshes);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const togglePhysics = useEditorStore((state) => state.togglePhysics);
  const updateNodePosition = useEditorStore((state) => state.updateNodePosition);
  const updateNodeRotation = useEditorStore((state) => state.updateNodeRotation);
  const updateNodeScale = useEditorStore((state) => state.updateNodeScale);
  const customFrameSelectionMode = useEditorStore((state) => state.customFrameSelectionMode);
  const setCustomFrameSelectionMode = useEditorStore((state) => state.setCustomFrameSelectionMode);
  const customFrame = useEditorStore((state) => state.customFrame);
  const setCustomFrame = useEditorStore((state) => state.setCustomFrame);

  const [coordinateMode, setCoordinateMode] = useState<ReferenceFrameType>('local');
  const [isSelectingCustomFrame, setIsSelectingCustomFrame] = useState(false);
  const [featureType, setFeatureType] = useState<CustomFrameFeatureType>('object');
  const [posIncrement] = useState(10); // mm - configurable increment for position
  const [, forceUpdate] = useState({});

  // Listen for scene tree updates to trigger re-render
  useEffect(() => {
    const handleTreeUpdate = () => {
      forceUpdate({});
    };
    window.addEventListener('scenetree-update', handleTreeUpdate);
    return () => window.removeEventListener('scenetree-update', handleTreeUpdate);
  }, []);

  // Poll for real-time position updates (when moved by gizmos or programmatically)
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (selectedNodeId) {
        forceUpdate({});
      }
    }, 100); // Update 10 times per second
    return () => clearInterval(intervalId);
  }, [selectedNodeId]);

  // Clear custom frame if switching to non-expert mode
  useEffect(() => {
    if (userLevel !== 'expert' && coordinateMode === 'custom') {
      setCoordinateMode('local');
      if (customFrame) {
        setCustomFrame(null);
      }
    }
  }, [userLevel, coordinateMode, customFrame, setCustomFrame]);

  if (!selectedNodeId) {
    return (
      <div className="inspector">
        <div className="inspector-header">
          <h2>Inspector</h2>
        </div>
        <div className="inspector-content">
          <p className="no-selection">No object selected</p>
        </div>
      </div>
    );
  }

  const tree = SceneTreeManager.getInstance();
  const node = tree.getNode(selectedNodeId);
  if (!node) {
    return (
      <div className="inspector">
        <div className="inspector-header">
          <h2>Inspector</h2>
        </div>
        <div className="inspector-content">
          <p className="no-selection">Node not found</p>
        </div>
      </div>
    );
  }

  const registry = EntityRegistry.getInstance();
  const entity = node?.entityId ? registry.get(node.entityId) : undefined;
  const sceneManager = SceneManager.getInstance();
  const scene = sceneManager.getScene();

  // Get the Babylon object (Mesh or TransformNode)
  let babylonNode: BABYLON.TransformNode | null = null;
  if (node.babylonMeshId && scene) {
    babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
  } else if (node.type === 'collection' && scene) {
    // Find TransformNode by name
    babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
  }

  // Get REAL-TIME local and world positions from Babylon
  let localPos = { x: 0, y: 0, z: 0 };
  let worldPos = { x: 0, y: 0, z: 0 };
  if (babylonNode) {
    // Check if this is a URDF mesh (uses native Babylon Y-up coordinates)
    const isURDFMesh = babylonNode.metadata?.isURDFMesh || babylonNode.metadata?.coordinateSystem === 'babylon-native';

    if (isURDFMesh) {
      // URDF objects use Babylon's native Y-up coordinates, no axis conversion needed
      // Just convert meters to millimeters
      localPos = {
        x: babylonNode.position.x * 1000,
        y: babylonNode.position.y * 1000,
        z: babylonNode.position.z * 1000,
      };
      const worldMatrix = babylonNode.getWorldMatrix();
      const worldPosition = worldMatrix.getTranslation();
      worldPos = {
        x: worldPosition.x * 1000,
        y: worldPosition.y * 1000,
        z: worldPosition.z * 1000,
      };
    } else {
      // Regular kinetiCORE objects: convert from Babylon Y-up to User Z-up
      localPos = babylonToUser(babylonNode.position);
      const worldMatrix = babylonNode.getWorldMatrix();
      const worldPosition = worldMatrix.getTranslation();
      worldPos = babylonToUser(worldPosition);
    }
  }

  // Choose which position to display based on mode
  const displayPos = coordinateMode === 'local' ? localPos : worldPos;

  // Get real-time rotation in degrees
  let rotationDegrees = { x: 0, y: 0, z: 0 };
  if (babylonNode) {
    const rotationRadians = babylonNode.rotation;
    rotationDegrees = {
      x: (rotationRadians.x * 180) / Math.PI,
      y: (rotationRadians.y * 180) / Math.PI,
      z: (rotationRadians.z * 180) / Math.PI,
    };
  }

  // Get real-time scale
  let scale = { x: 1, y: 1, z: 1 };
  if (babylonNode) {
    scale = babylonNode.scaling;
  }

  // Get current physics state
  const isPhysicsEnabled = entity?.isPhysicsEnabled() || false;

  const handleTogglePhysics = () => {
    if (selectedNodeId) {
      togglePhysics(selectedNodeId);
    }
  };

  // Position handlers
  const handlePositionChange = (axis: 'x' | 'y' | 'z', value: string) => {
    if (!selectedNodeId) return;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    // Always work in local coordinates - convert from display if needed
    let newPos: { x: number; y: number; z: number };
    if (coordinateMode === 'world') {
      // User edited world coords, convert to local (for now just use as-is)
      // TODO: Implement proper world-to-local conversion
      newPos = { ...worldPos, [axis]: numValue };
    } else {
      newPos = { ...localPos, [axis]: numValue };
    }
    updateNodePosition(selectedNodeId, newPos);
  };

  const handlePositionReset = () => {
    if (!selectedNodeId) return;
    updateNodePosition(selectedNodeId, { x: 0, y: 0, z: 0 });
  };

  const handleCenterPosition = () => {
    if (!selectedNodeId) return;
    // Center the object in world space (0,0,0)
    updateNodePosition(selectedNodeId, { x: 0, y: 0, z: 0 });
  };

  const handleSnapToGrid = () => {
    if (!selectedNodeId) return;
    const gridSize = 100; // 100mm grid
    const snappedPos = {
      x: Math.round(displayPos.x / gridSize) * gridSize,
      y: Math.round(displayPos.y / gridSize) * gridSize,
      z: Math.round(displayPos.z / gridSize) * gridSize,
    };
    updateNodePosition(selectedNodeId, snappedPos);
  };

  // Rotation handlers
  const handleRotationChange = (axis: 'x' | 'y' | 'z', value: string) => {
    if (!selectedNodeId) return;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const newRot = { ...rotationDegrees, [axis]: numValue };
    updateNodeRotation(selectedNodeId, newRot);
  };

  const handleRotationReset = () => {
    if (!selectedNodeId) return;
    updateNodeRotation(selectedNodeId, { x: 0, y: 0, z: 0 });
  };

  const handleQuickRotation = (axis: 'x' | 'y' | 'z', angle: number) => {
    if (!selectedNodeId) return;
    const newRot = { ...rotationDegrees, [axis]: angle };
    updateNodeRotation(selectedNodeId, newRot);
  };

  // Scale handlers
  const handleScaleChange = (axis: 'x' | 'y' | 'z', value: string) => {
    if (!selectedNodeId) return;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const newScale = { x: scale.x, y: scale.y, z: scale.z, [axis]: numValue };
    updateNodeScale(selectedNodeId, newScale);
  };

  const handleScaleReset = () => {
    if (!selectedNodeId) return;
    updateNodeScale(selectedNodeId, { x: 1, y: 1, z: 1 });
  };

  // Custom frame handlers
  const handleStartCustomFrameSelection = () => {
    setCoordinateMode('custom');
    setIsSelectingCustomFrame(true);
    setCustomFrameSelectionMode('object');
  };

  const handleSelectFeatureType = (type: CustomFrameFeatureType) => {
    setFeatureType(type);
    if (type === 'object') {
      // For object, immediately use the selected mesh
      if (selectedMeshes.length > 0 && selectedNodeId) {
        setCustomFrameSelectionMode('none');
        setIsSelectingCustomFrame(false);
        // Frame will be calculated in editorStore when object is clicked
      }
    } else {
      // For face/edge/vertex, enter feature selection mode
      setCustomFrameSelectionMode(type);
    }
  };

  const handleCancelCustomFrameSelection = () => {
    setIsSelectingCustomFrame(false);
    setCustomFrameSelectionMode('none');
    if (!customFrame) {
      setCoordinateMode('local');
    }
  };

  const handleClearCustomFrame = () => {
    setCustomFrame(null);
    setCoordinateMode('local');
    setIsSelectingCustomFrame(false);
    setCustomFrameSelectionMode('none');
  };

  return (
    <div className="inspector">
      <div className="inspector-header">
        <h2>Inspector</h2>
      </div>
      <div className="inspector-content">
        <div className="property-group">
          <h3>Object</h3>
          <div className="property">
            <label>Name</label>
            <input type="text" value={node.name} readOnly />
          </div>
          <div className="property">
            <label>Type</label>
            <input type="text" value={node.type} readOnly />
          </div>
        </div>

        <div className="property-group">
          <h3>Transform</h3>

          {/* Position Controls */}
          <div className="transform-section">
            <div className="transform-section-header">
              <label>Position (mm)</label>
            </div>

            {/* Transform Presets */}
            <div className="transform-presets">
              {/* Essential: Only Reset */}
              <button
                className="preset-btn"
                onClick={handlePositionReset}
                title="Reset position to origin (0,0,0)"
              >
                <RotateCcw size={14} />
                Reset
              </button>

              {/* Professional+: Center and Snap */}
              {userLevel !== 'essential' && (
                <>
                  <button
                    className="preset-btn"
                    onClick={handleCenterPosition}
                    title="Center object at world origin"
                  >
                    <AlignCenter size={14} />
                    Center
                  </button>
                  <button
                    className="preset-btn"
                    onClick={handleSnapToGrid}
                    title="Snap to nearest 100mm grid point"
                  >
                    <Grid3x3 size={14} />
                    Snap
                  </button>
                </>
              )}
            </div>

            <div className="transform-control-row">
              <div className="axis-control">
                <label className="axis-label">X</label>
                <XNumericInput
                  value={displayPos.x}
                  onChange={(val) => handlePositionChange('x', val.toString())}
                  step={posIncrement}
                  precision={1}
                  unit="mm"
                />
              </div>

              <div className="axis-control">
                <label className="axis-label">Y</label>
                <YNumericInput
                  value={displayPos.y}
                  onChange={(val) => handlePositionChange('y', val.toString())}
                  step={posIncrement}
                  precision={1}
                  unit="mm"
                />
              </div>

              <div className="axis-control">
                <label className="axis-label">Z</label>
                <ZNumericInput
                  value={displayPos.z}
                  onChange={(val) => handlePositionChange('z', val.toString())}
                  step={posIncrement}
                  precision={1}
                  unit="mm"
                />
              </div>
            </div>
          </div>

          {/* Rotation Controls */}
          <div className="transform-section">
            <div className="transform-section-header">
              <label>Rotation (degrees)</label>
            </div>

            <div className="transform-control-row">
              <div className="axis-control">
                <label className="axis-label">X</label>
                <XNumericInput
                  value={rotationDegrees.x}
                  onChange={(val) => handleRotationChange('x', val.toString())}
                  step={5}
                  precision={1}
                  unit="°"
                />
              </div>

              <div className="axis-control">
                <label className="axis-label">Y</label>
                <YNumericInput
                  value={rotationDegrees.y}
                  onChange={(val) => handleRotationChange('y', val.toString())}
                  step={5}
                  precision={1}
                  unit="°"
                />
              </div>

              <div className="axis-control">
                <label className="axis-label">Z</label>
                <ZNumericInput
                  value={rotationDegrees.z}
                  onChange={(val) => handleRotationChange('z', val.toString())}
                  step={5}
                  precision={1}
                  unit="°"
                />
              </div>
            </div>

            {/* Quick Rotation Angles - Professional+ only */}
            {userLevel !== 'essential' && (
              <div className="quick-rotation-section">
                <div className="quick-rotation-header">
                  <label className="quick-rotation-label">Quick angles:</label>
                  <button
                    className="reset-button"
                    onClick={handleRotationReset}
                    title="Reset all rotations to 0°"
                  >
                    Reset
                  </button>
                </div>
                <div className="quick-rotation-grid">
                  <button
                    className="quick-angle-btn"
                    onClick={() => handleQuickRotation('z', 0)}
                    title="Set Z rotation to 0°"
                  >
                    0°
                  </button>
                  <button
                    className="quick-angle-btn"
                    onClick={() => handleQuickRotation('z', 45)}
                    title="Set Z rotation to 45°"
                  >
                    45°
                  </button>
                  <button
                    className="quick-angle-btn"
                    onClick={() => handleQuickRotation('z', 90)}
                    title="Set Z rotation to 90°"
                  >
                    90°
                  </button>
                  <button
                    className="quick-angle-btn"
                    onClick={() => handleQuickRotation('z', 180)}
                    title="Set Z rotation to 180°"
                  >
                    180°
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scale Controls */}
          <div className="transform-section">
            <div className="transform-section-header">
              <label>Scale</label>
              <button className="reset-button" onClick={handleScaleReset} title="Reset to 1">
                Reset
              </button>
            </div>

            <div className="transform-control-row">
              <div className="axis-control">
                <label className="axis-label">X</label>
                <XNumericInput
                  value={scale.x}
                  onChange={(val) => handleScaleChange('x', val.toString())}
                  step={0.1}
                  precision={2}
                  min={0.01}
                />
              </div>

              <div className="axis-control">
                <label className="axis-label">Y</label>
                <YNumericInput
                  value={scale.y}
                  onChange={(val) => handleScaleChange('y', val.toString())}
                  step={0.1}
                  precision={2}
                  min={0.01}
                />
              </div>

              <div className="axis-control">
                <label className="axis-label">Z</label>
                <ZNumericInput
                  value={scale.z}
                  onChange={(val) => handleScaleChange('z', val.toString())}
                  step={0.1}
                  precision={2}
                  min={0.01}
                />
              </div>
            </div>
          </div>

          {/* Reference Frame Selector - moved to bottom */}
          <div className="transform-header">
            <div className="button-group">
              <button
                className={coordinateMode === 'local' ? 'active' : ''}
                onClick={() => setCoordinateMode('local')}
                title="Local coordinates relative to parent"
              >
                Local
              </button>
              <button
                className={coordinateMode === 'world' ? 'active' : ''}
                onClick={() => setCoordinateMode('world')}
                title="World coordinates"
              >
                World
              </button>

              {/* Custom Frame - Expert only */}
              {userLevel === 'expert' && (
                <button
                  className={coordinateMode === 'custom' ? 'active' : ''}
                  onClick={handleStartCustomFrameSelection}
                  title="Custom reference frame"
                >
                  Custom
                </button>
              )}
            </div>
          </div>

          {/* Show custom frame info if one is set - Expert only */}
          {userLevel === 'expert' &&
            customFrame &&
            coordinateMode === 'custom' &&
            !isSelectingCustomFrame && (
              <div className="custom-frame-info">
                <p>
                  Frame: {customFrame.featureType}
                  {customFrame.featureType === 'face' && ` (face ${customFrame.faceIndex})`}
                  {customFrame.featureType === 'edge' && ' (edge)'}
                  {customFrame.featureType === 'vertex' &&
                    ` (vertex ${customFrame.vertexIndex})`}
                </p>
                <button onClick={handleClearCustomFrame} className="clear-frame-button">
                  Clear
                </button>
              </div>
            )}

          {/* Custom frame selection UI - Expert only */}
          {userLevel === 'expert' && isSelectingCustomFrame && (
            <div className="custom-frame-selector">
              <p className="selector-title">Select Feature Type:</p>
              <div className="feature-type-buttons">
                <button
                  className={featureType === 'object' ? 'active' : ''}
                  onClick={() => handleSelectFeatureType('object')}
                  title="Use object origin"
                >
                  Object
                </button>
                <button
                  className={featureType === 'face' ? 'active' : ''}
                  onClick={() => handleSelectFeatureType('face')}
                  title="Select a face"
                >
                  Face
                </button>
                <button
                  className={featureType === 'edge' ? 'active' : ''}
                  onClick={() => handleSelectFeatureType('edge')}
                  title="Select an edge"
                >
                  Edge
                </button>
                <button
                  className={featureType === 'vertex' ? 'active' : ''}
                  onClick={() => handleSelectFeatureType('vertex')}
                  title="Select a vertex/corner"
                >
                  Vertex
                </button>
              </div>
              <p className="selector-instruction">
                {customFrameSelectionMode === 'object' && 'Click an object in the 3D viewport'}
                {customFrameSelectionMode === 'face' && 'Click on a face in the 3D viewport'}
                {customFrameSelectionMode === 'edge' && 'Click near an edge in the 3D viewport'}
                {customFrameSelectionMode === 'vertex' && 'Click near a vertex in the 3D viewport'}
              </p>
              <button onClick={handleCancelCustomFrameSelection} className="cancel-button">
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Physics - Professional+ only */}
        {userLevel !== 'essential' && (
          <div className="property-group">
            <h3>Physics</h3>
            <div className="property">
              <label>Enable Physics</label>
              <button
                onClick={handleTogglePhysics}
                className="physics-toggle-button"
                style={{
                  backgroundColor: isPhysicsEnabled ? '#4CAF50' : '#666',
                }}
              >
                {isPhysicsEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
