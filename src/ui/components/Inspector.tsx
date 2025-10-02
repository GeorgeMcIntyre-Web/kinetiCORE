// Inspector component - shows properties of selected objects
// Owner: Edwin

import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { babylonToUser } from '../../core/CoordinateSystem';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import './Inspector.css';

export const Inspector: React.FC = () => {
  const selectedMeshes = useEditorStore((state) => state.selectedMeshes);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const togglePhysics = useEditorStore((state) => state.togglePhysics);
  const [coordinateMode, setCoordinateMode] = useState<'local' | 'world'>('local');
  const [physicsEnabled, setPhysicsEnabled] = useState(false);

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

  // Get current physics state
  const isPhysicsEnabled = entity?.isPhysicsEnabled() || false;

  const handleTogglePhysics = () => {
    if (selectedNodeId) {
      togglePhysics(selectedNodeId);
      setPhysicsEnabled(!physicsEnabled);
    }
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
          <h3>Physics</h3>
          <div className="property">
            <label>Enable Physics</label>
            <button
              onClick={handleTogglePhysics}
              style={{
                padding: '6px 12px',
                backgroundColor: isPhysicsEnabled ? '#4CAF50' : '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {isPhysicsEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        <div className="property-group">
          <h3>
            Transform
            <div className="button-group" style={{ display: 'inline-block', marginLeft: '10px' }}>
              <button
                className={coordinateMode === 'local' ? 'active' : ''}
                onClick={() => setCoordinateMode('local')}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                Local
              </button>
              <button
                className={coordinateMode === 'world' ? 'active' : ''}
                onClick={() => setCoordinateMode('world')}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                World
              </button>
            </div>
          </h3>
          <div className="property">
            <label>X (Right) mm</label>
            <div className="vector-input">
              <input
                type="number"
                value={displayPos.x.toFixed(1)}
                readOnly
                placeholder="X"
              />
            </div>
          </div>
          <div className="property">
            <label>Y (Forward) mm</label>
            <div className="vector-input">
              <input
                type="number"
                value={displayPos.y.toFixed(1)}
                readOnly
                placeholder="Y"
              />
            </div>
          </div>
          <div className="property">
            <label>Z (Height) mm</label>
            <div className="vector-input">
              <input
                type="number"
                value={displayPos.z.toFixed(1)}
                readOnly
                placeholder="Z"
              />
            </div>
          </div>

          <div className="property">
            <label>Rotation</label>
            <div className="vector-input">
              <input
                type="number"
                value={selectedMesh.rotation.x.toFixed(2)}
                readOnly
                placeholder="X"
              />
              <input
                type="number"
                value={selectedMesh.rotation.y.toFixed(2)}
                readOnly
                placeholder="Y"
              />
              <input
                type="number"
                value={selectedMesh.rotation.z.toFixed(2)}
                readOnly
                placeholder="Z"
              />
            </div>
          </div>

          <div className="property">
            <label>Scale</label>
            <div className="vector-input">
              <input
                type="number"
                value={selectedMesh.scaling.x.toFixed(2)}
                readOnly
                placeholder="X"
              />
              <input
                type="number"
                value={selectedMesh.scaling.y.toFixed(2)}
                readOnly
                placeholder="Y"
              />
              <input
                type="number"
                value={selectedMesh.scaling.z.toFixed(2)}
                readOnly
                placeholder="Z"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
