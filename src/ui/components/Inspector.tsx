// Inspector component - shows properties of selected objects
// Owner: Edwin

import { useState, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { babylonToUser } from '../../core/CoordinateSystem';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import type { ReferenceFrameType, CustomFrameFeature, CustomFrameFeatureType } from '../../core/types';
import './Inspector.css';

export const Inspector: React.FC = () => {
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

  // Poll mesh position updates (when moved by gizmos)
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (selectedMeshes.length > 0) {
        forceUpdate({});
      }
    }, 100); // Update 10 times per second
    return () => clearInterval(intervalId);
  }, [selectedMeshes]);

  if (selectedMeshes.length === 0) {
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

  const selectedMesh = selectedMeshes[0];
  const tree = SceneTreeManager.getInstance();
  const node = selectedNodeId ? tree.getNode(selectedNodeId) : undefined;
  const registry = EntityRegistry.getInstance();
  const entity = node?.entityId ? registry.get(node.entityId) : undefined;

  // Get local and world positions
  const localPos = node?.position || babylonToUser(selectedMesh.position);
  const worldPos = selectedNodeId
    ? tree.getWorldPosition(selectedNodeId)
    : babylonToUser(selectedMesh.position);

  // Choose which position to display based on mode
  const displayPos = coordinateMode === 'local' ? localPos : worldPos;

  // Get rotation in degrees
  const rotationRadians = selectedMesh.rotation;
  const rotationDegrees = {
    x: (rotationRadians.x * 180) / Math.PI,
    y: (rotationRadians.y * 180) / Math.PI,
    z: (rotationRadians.z * 180) / Math.PI,
  };

  // Get scale
  const scale = selectedMesh.scaling;

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

  const handlePositionIncrement = (axis: 'x' | 'y' | 'z', direction: number) => {
    if (!selectedNodeId) return;
    const delta = direction * posIncrement;

    // Always work in local coordinates
    let currentPos = localPos;
    if (coordinateMode === 'world') {
      // When in world mode, still increment local position for now
      // TODO: Implement proper world-space increments
      currentPos = localPos;
    }

    const newPos = { ...currentPos, [axis]: currentPos[axis] + delta };
    updateNodePosition(selectedNodeId, newPos);
  };

  const handlePositionReset = () => {
    if (!selectedNodeId) return;
    updateNodePosition(selectedNodeId, { x: 0, y: 0, z: 0 });
  };

  // Rotation handlers
  const handleRotationChange = (axis: 'x' | 'y' | 'z', value: string) => {
    if (!selectedNodeId) return;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const newRot = { ...rotationDegrees, [axis]: numValue };
    updateNodeRotation(selectedNodeId, newRot);
  };

  const handleRotationIncrement = (axis: 'x' | 'y' | 'z', delta: number) => {
    if (!selectedNodeId) return;
    const newRot = { ...rotationDegrees, [axis]: rotationDegrees[axis] + delta };
    updateNodeRotation(selectedNodeId, newRot);
  };

  const handleRotationReset = () => {
    if (!selectedNodeId) return;
    updateNodeRotation(selectedNodeId, { x: 0, y: 0, z: 0 });
  };

  // Scale handlers
  const handleScaleChange = (axis: 'x' | 'y' | 'z', value: string) => {
    if (!selectedNodeId) return;
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;

    const newScale = { x: scale.x, y: scale.y, z: scale.z, [axis]: numValue };
    updateNodeScale(selectedNodeId, newScale);
  };

  const handleScaleIncrement = (axis: 'x' | 'y' | 'z', delta: number) => {
    if (!selectedNodeId) return;
    const currentScale = { x: scale.x, y: scale.y, z: scale.z };
    const newScale = { ...currentScale, [axis]: currentScale[axis] + delta };
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
            <input type="text" value={node?.name || selectedMesh.name} readOnly />
          </div>
          {node && (
            <div className="property">
              <label>Type</label>
              <input type="text" value={node.type} readOnly />
            </div>
          )}
        </div>

        <div className="property-group">
          <h3>Transform</h3>

          {/* Position Controls */}
          <div className="transform-section">
            <div className="transform-section-header">
              <label>Position (mm)</label>
              <button className="reset-button" onClick={handlePositionReset} title="Reset to origin">
                Reset
              </button>
            </div>

            <div className="transform-control-row">
              <div className="axis-control">
                <label className="axis-label">X</label>
                <button
                  className="increment-button"
                  onClick={() => handlePositionIncrement('x', -1)}
                  title="Decrease by 10mm"
                >
                  -
                </button>
                <input
                  type="number"
                  value={displayPos.x.toFixed(1)}
                  onChange={(e) => handlePositionChange('x', e.target.value)}
                  step="1"
                />
                <button
                  className="increment-button"
                  onClick={() => handlePositionIncrement('x', 1)}
                  title="Increase by 10mm"
                >
                  +
                </button>
              </div>

              <div className="axis-control">
                <label className="axis-label">Y</label>
                <button
                  className="increment-button"
                  onClick={() => handlePositionIncrement('y', -1)}
                  title="Decrease by 10mm"
                >
                  -
                </button>
                <input
                  type="number"
                  value={displayPos.y.toFixed(1)}
                  onChange={(e) => handlePositionChange('y', e.target.value)}
                  step="1"
                />
                <button
                  className="increment-button"
                  onClick={() => handlePositionIncrement('y', 1)}
                  title="Increase by 10mm"
                >
                  +
                </button>
              </div>

              <div className="axis-control">
                <label className="axis-label">Z</label>
                <button
                  className="increment-button"
                  onClick={() => handlePositionIncrement('z', -1)}
                  title="Decrease by 10mm"
                >
                  -
                </button>
                <input
                  type="number"
                  value={displayPos.z.toFixed(1)}
                  onChange={(e) => handlePositionChange('z', e.target.value)}
                  step="1"
                />
                <button
                  className="increment-button"
                  onClick={() => handlePositionIncrement('z', 1)}
                  title="Increase by 10mm"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Rotation Controls */}
          <div className="transform-section">
            <div className="transform-section-header">
              <label>Rotation (degrees)</label>
              <button className="reset-button" onClick={handleRotationReset} title="Reset to zero">
                Reset
              </button>
            </div>

            <div className="transform-control-row">
              <div className="axis-control">
                <label className="axis-label">X</label>
                <button
                  className="increment-button"
                  onClick={() => handleRotationIncrement('x', -5)}
                  title="Decrease by 5°"
                >
                  -
                </button>
                <input
                  type="number"
                  value={rotationDegrees.x.toFixed(1)}
                  onChange={(e) => handleRotationChange('x', e.target.value)}
                  step="5"
                />
                <button
                  className="increment-button"
                  onClick={() => handleRotationIncrement('x', 5)}
                  title="Increase by 5°"
                >
                  +
                </button>
              </div>

              <div className="axis-control">
                <label className="axis-label">Y</label>
                <button
                  className="increment-button"
                  onClick={() => handleRotationIncrement('y', -5)}
                  title="Decrease by 5°"
                >
                  -
                </button>
                <input
                  type="number"
                  value={rotationDegrees.y.toFixed(1)}
                  onChange={(e) => handleRotationChange('y', e.target.value)}
                  step="5"
                />
                <button
                  className="increment-button"
                  onClick={() => handleRotationIncrement('y', 5)}
                  title="Increase by 5°"
                >
                  +
                </button>
              </div>

              <div className="axis-control">
                <label className="axis-label">Z</label>
                <button
                  className="increment-button"
                  onClick={() => handleRotationIncrement('z', -5)}
                  title="Decrease by 5°"
                >
                  -
                </button>
                <input
                  type="number"
                  value={rotationDegrees.z.toFixed(1)}
                  onChange={(e) => handleRotationChange('z', e.target.value)}
                  step="5"
                />
                <button
                  className="increment-button"
                  onClick={() => handleRotationIncrement('z', 5)}
                  title="Increase by 5°"
                >
                  +
                </button>
              </div>
            </div>
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
                <button
                  className="increment-button"
                  onClick={() => handleScaleIncrement('x', -0.1)}
                  title="Decrease by 0.1"
                >
                  -
                </button>
                <input
                  type="number"
                  value={scale.x.toFixed(2)}
                  onChange={(e) => handleScaleChange('x', e.target.value)}
                  step="0.1"
                />
                <button
                  className="increment-button"
                  onClick={() => handleScaleIncrement('x', 0.1)}
                  title="Increase by 0.1"
                >
                  +
                </button>
              </div>

              <div className="axis-control">
                <label className="axis-label">Y</label>
                <button
                  className="increment-button"
                  onClick={() => handleScaleIncrement('y', -0.1)}
                  title="Decrease by 0.1"
                >
                  -
                </button>
                <input
                  type="number"
                  value={scale.y.toFixed(2)}
                  onChange={(e) => handleScaleChange('y', e.target.value)}
                  step="0.1"
                />
                <button
                  className="increment-button"
                  onClick={() => handleScaleIncrement('y', 0.1)}
                  title="Increase by 0.1"
                >
                  +
                </button>
              </div>

              <div className="axis-control">
                <label className="axis-label">Z</label>
                <button
                  className="increment-button"
                  onClick={() => handleScaleIncrement('z', -0.1)}
                  title="Decrease by 0.1"
                >
                  -
                </button>
                <input
                  type="number"
                  value={scale.z.toFixed(2)}
                  onChange={(e) => handleScaleChange('z', e.target.value)}
                  step="0.1"
                />
                <button
                  className="increment-button"
                  onClick={() => handleScaleIncrement('z', 0.1)}
                  title="Increase by 0.1"
                >
                  +
                </button>
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
              <button
                className={coordinateMode === 'custom' ? 'active' : ''}
                onClick={handleStartCustomFrameSelection}
                title="Custom reference frame"
              >
                Custom
              </button>
            </div>
          </div>

          {/* Show custom frame info if one is set */}
          {customFrame && coordinateMode === 'custom' && !isSelectingCustomFrame && (
            <div className="custom-frame-info">
              <p>
                Frame: {customFrame.featureType}
                {customFrame.featureType === 'face' && ` (face ${customFrame.faceIndex})`}
                {customFrame.featureType === 'edge' && ' (edge)'}
                {customFrame.featureType === 'vertex' && ` (vertex ${customFrame.vertexIndex})`}
              </p>
              <button onClick={handleClearCustomFrame} className="clear-frame-button">
                Clear
              </button>
            </div>
          )}

          {/* Custom frame selection UI */}
          {isSelectingCustomFrame && (
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
      </div>
    </div>
  );
};
