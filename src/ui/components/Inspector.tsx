// Inspector component - shows properties of selected objects
// Owner: Edwin

import { useEditorStore } from '../store/editorStore';
import './Inspector.css';

export const Inspector: React.FC = () => {
  const selectedMeshes = useEditorStore((state) => state.selectedMeshes);

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
            <input type="text" value={selectedMesh.name} readOnly />
          </div>
        </div>

        <div className="property-group">
          <h3>Transform</h3>
          <div className="property">
            <label>Position</label>
            <div className="vector-input">
              <input
                type="number"
                value={selectedMesh.position.x.toFixed(2)}
                readOnly
                placeholder="X"
              />
              <input
                type="number"
                value={selectedMesh.position.y.toFixed(2)}
                readOnly
                placeholder="Y"
              />
              <input
                type="number"
                value={selectedMesh.position.z.toFixed(2)}
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
