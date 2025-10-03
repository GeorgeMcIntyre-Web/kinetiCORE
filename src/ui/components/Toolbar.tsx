// Toolbar component
// Owner: Edwin

import { useRef } from 'react';
import {
  Move,
  RotateCw,
  Scale,
  Box,
  Circle,
  Cylinder,
  Upload,
  FolderPlus,
  Save,
  FolderOpen,
  Zap,
  Download,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { TransformMode } from '../../core/types';
import { getAcceptedFileTypes } from '../../scene/ModelLoader';
import './Toolbar.css';

interface ToolbarProps {
  onOpenKinematics?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onOpenKinematics }) => {
  const transformMode = useEditorStore((state) => state.transformMode);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const createObject = useEditorStore((state) => state.createObject);
  const createCollection = useEditorStore((state) => state.createCollection);
  const importModel = useEditorStore((state) => state.importModel);
  const importURDFFolder = useEditorStore((state) => state.importURDFFolder);
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const loadWorld = useEditorStore((state) => state.loadWorld);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const worldLoadInputRef = useRef<HTMLInputElement>(null);

  const modes: {
    mode: TransformMode;
    label: string;
    key: string;
    icon: React.ReactNode;
  }[] = [
    { mode: 'translate', label: 'Move', key: 'G', icon: <Move size={16} /> },
    {
      mode: 'rotate',
      label: 'Rotate',
      key: 'R',
      icon: <RotateCw size={16} />,
    },
    { mode: 'scale', label: 'Scale', key: 'S', icon: <Scale size={16} /> },
  ];

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFolderClick = () => {
    folderInputRef.current?.click();
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

  const handleFolderChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await importURDFFolder(Array.from(files));
      // Reset input
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  };

  const handleLoadWorldClick = () => {
    worldLoadInputRef.current?.click();
  };

  const handleWorldFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await loadWorld(file);
      // Reset input so same file can be loaded again
      if (worldLoadInputRef.current) {
        worldLoadInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="toolbar">
      {/* Transform Tools - Segmented Button Group */}
      <div className="toolbar-section">
        <h3>Transform</h3>
        <div className="button-group-segmented">
          {modes.map(({ mode, label, key, icon }) => (
            <button
              key={mode}
              className={`toolbar-button-icon ${
                transformMode === mode ? 'active' : ''
              }`}
              onClick={() => setTransformMode(mode)}
              title={`${label} (${key})`}
            >
              {icon}
              <span className="button-label">{label}</span>
              <kbd className="shortcut-badge">{key}</kbd>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Object Creation */}
      <div className="toolbar-section">
        <h3>Objects</h3>
        <div className="button-group">
          <button
            className="toolbar-button-icon"
            onClick={() => createObject('box')}
            title="Add Box"
          >
            <Box size={16} />
            <span className="button-label">Box</span>
          </button>
          <button
            className="toolbar-button-icon"
            onClick={() => createObject('sphere')}
            title="Add Sphere"
          >
            <Circle size={16} />
            <span className="button-label">Sphere</span>
          </button>
          <button
            className="toolbar-button-icon"
            onClick={() => createObject('cylinder')}
            title="Add Cylinder"
          >
            <Cylinder size={16} />
            <span className="button-label">Cylinder</span>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Import */}
      <div className="toolbar-section">
        <h3>Import</h3>
        <div className="button-group">
          <button
            className="toolbar-button-icon"
            onClick={handleImportClick}
            title="Import 3D Model (glTF, GLB, OBJ, STL, DXF, JT, URDF, Babylon)"
          >
            <Upload size={16} />
            <span className="button-label">Load File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptedFileTypes()}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            className="toolbar-button-icon"
            onClick={handleImportFolderClick}
            title="Import URDF Folder (with STL meshes)"
          >
            <FolderOpen size={16} />
            <span className="button-label">Load Folder</span>
          </button>
          <input
            ref={folderInputRef}
            type="file"
            /* @ts-ignore - webkitdirectory is not in TS types */
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFolderChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Organize */}
      <div className="toolbar-section">
        <h3>Organize</h3>
        <div className="button-group">
          <button
            className="toolbar-button-icon"
            onClick={() => createCollection()}
            title="Create Collection (Folder)"
          >
            <FolderPlus size={16} />
            <span className="button-label">Collection</span>
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* World */}
      <div className="toolbar-section">
        <h3>World</h3>
        <div className="button-group">
          <button
            className="toolbar-button-icon"
            onClick={saveWorld}
            title="Save World to JSON file"
          >
            <Save size={16} />
            <span className="button-label">Save</span>
          </button>
          <button
            className="toolbar-button-icon"
            onClick={handleLoadWorldClick}
            title="Load World from JSON file"
          >
            <Download size={16} />
            <span className="button-label">Load</span>
          </button>
          <input
            ref={worldLoadInputRef}
            type="file"
            accept=".json"
            onChange={handleWorldFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Kinematics */}
      <div className="toolbar-section">
        <h3>Kinematics</h3>
        <div className="button-group">
          <button
            className="toolbar-button-icon"
            onClick={onOpenKinematics}
            title="Open Kinematics Panel"
          >
            <Zap size={16} />
            <span className="button-label">Setup</span>
          </button>
        </div>
      </div>
    </div>
  );
};
