// Toolbar component
// Owner: Edwin

import { useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { TransformMode } from '../../core/types';
import { getAcceptedFileTypes } from '../../scene/ModelLoader';
import './Toolbar.css';

export const Toolbar: React.FC = () => {
  const transformMode = useEditorStore((state) => state.transformMode);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const createObject = useEditorStore((state) => state.createObject);
  const createCollection = useEditorStore((state) => state.createCollection);
  const importModel = useEditorStore((state) => state.importModel);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modes: { mode: TransformMode; label: string; key: string }[] = [
    { mode: 'translate', label: 'Move', key: 'G' },
    { mode: 'rotate', label: 'Rotate', key: 'R' },
    { mode: 'scale', label: 'Scale', key: 'S' },
  ];

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await importModel(file);
      // Reset input so same file can be loaded again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
      <div className="toolbar-section">
        <h3>Import</h3>
        <div className="button-group">
          <button
            className="toolbar-button"
            onClick={handleImportClick}
            title="Import 3D Model (glTF, GLB, OBJ, STL, Babylon)"
          >
            Load 3D File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptedFileTypes()}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>
      <div className="toolbar-section">
        <h3>Organize</h3>
        <div className="button-group">
          <button
            className="toolbar-button"
            onClick={() => createCollection()}
            title="Create Collection (Folder)"
          >
            + Collection
          </button>
        </div>
      </div>
    </div>
  );
};
