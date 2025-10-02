// Toolbar component
// Owner: Edwin

import { useEditorStore } from '../store/editorStore';
import { TransformMode } from '../../core/types';
import './Toolbar.css';

export const Toolbar: React.FC = () => {
  const transformMode = useEditorStore((state) => state.transformMode);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const createObject = useEditorStore((state) => state.createObject);

  const modes: { mode: TransformMode; label: string; key: string }[] = [
    { mode: 'translate', label: 'Move', key: 'G' },
    { mode: 'rotate', label: 'Rotate', key: 'R' },
    { mode: 'scale', label: 'Scale', key: 'S' },
  ];

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <h3>Transform</h3>
        <div className="button-group">
          {modes.map(({ mode, label, key }) => (
            <button
              key={mode}
              className={`toolbar-button ${transformMode === mode ? 'active' : ''}`}
              onClick={() => setTransformMode(mode)}
              title={`${label} (${key})`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="toolbar-section">
        <h3>Objects</h3>
        <div className="button-group">
          <button
            className="toolbar-button"
            onClick={() => createObject('box')}
            title="Add Box"
          >
            Box
          </button>
          <button
            className="toolbar-button"
            onClick={() => createObject('sphere')}
            title="Add Sphere"
          >
            Sphere
          </button>
          <button
            className="toolbar-button"
            onClick={() => createObject('cylinder')}
            title="Add Cylinder"
          >
            Cylinder
          </button>
        </div>
      </div>
    </div>
  );
};
