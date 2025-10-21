// Ribbon Toolbar - Excel-style horizontal ribbon
// Owner: George
// All tools visible horizontally organized by category

import React, { useRef } from 'react';
import {
  Settings,
  CornerDownRight,
  Minus,
  Square,
  Crosshair,
  Circle,
  Box,
  Package,
  FileUp,
  FolderUp,
  Save,
  FolderOpen,
  Eye,
  Wrench,
  BookOpen,
  Gamepad2,
  Zap,
  Cylinder as CylinderIcon,
  Move,
  RotateCw,
  Maximize2,
  Library,
  FolderKanban,
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import './RibbonToolbar.css';

export interface RibbonToolbarProps {
  onKinematicsClick?: () => void;
  onDevicesClick?: () => void;
  onActuatorsClick?: () => void;
  onPhysicsClick?: () => void;
  onCollisionsClick?: () => void;
  onProjectionClick?: () => void;
  onProjectManagerClick?: () => void;
  onAssetLibraryClick?: () => void;
}

export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  onKinematicsClick,
  onDevicesClick,
  onActuatorsClick,
  onPhysicsClick,
  onCollisionsClick,
  onProjectionClick,
  onProjectManagerClick,
  onAssetLibraryClick,
}) => {
  // Store connections
  const transformMode = useEditorStore((state) => state.transformMode);
  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const setSnapEnabled = useEditorStore((state) => state.setSnapEnabled);
  const alignMode = useEditorStore((state) => state.alignMode);
  const setAlignMode = useEditorStore((state) => state.setAlignMode);
  const createObject = useEditorStore((state) => state.createObject);
  const createCollection = useEditorStore((state) => state.createCollection);
  const importModel = useEditorStore((state) => state.importModel);
  const importURDFFolder = useEditorStore((state) => state.importURDFFolder);
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const loadWorld = useEditorStore((state) => state.loadWorld);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const worldLoadInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleImportFile = () => fileInputRef.current?.click();
  const handleImportFolder = () => folderInputRef.current?.click();
  const handleLoadWorld = () => worldLoadInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        await importModel(files[i]);
      }
    }
    event.target.value = '';
  };

  const handleFolderChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await importURDFFolder(Array.from(files));
    }
    event.target.value = '';
  };

  const handleWorldFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await loadWorld(file);
    }
    event.target.value = '';
  };

  return (
    <div className="ribbon-toolbar-excel">
      {/* Transform Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Transform</div>
        <div className="ribbon-buttons-row">
          <button
            className={`ribbon-btn ${transformMode === 'translate' ? 'active' : ''}`}
            onClick={() => setTransformMode('translate')}
            title="Move (G)"
          >
            <Move size={32} />
          </button>
          <button
            className={`ribbon-btn ${transformMode === 'rotate' ? 'active' : ''}`}
            onClick={() => setTransformMode('rotate')}
            title="Rotate (R)"
          >
            <RotateCw size={32} />
          </button>
          <button
            className={`ribbon-btn ${transformMode === 'scale' ? 'active' : ''}`}
            onClick={() => setTransformMode('scale')}
            title="Scale (S)"
          >
            <Maximize2 size={32} />
          </button>
        </div>
      </div>

      {/* Create Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Create</div>
        <div className="ribbon-buttons-row">
          <button className="ribbon-btn" onClick={() => createObject('box')} title="Box">
            <Box size={32} />
          </button>
          <button className="ribbon-btn" onClick={() => createObject('sphere')} title="Sphere">
            <Circle size={32} />
          </button>
          <button className="ribbon-btn" onClick={() => createObject('cylinder')} title="Cylinder">
            <CylinderIcon size={32} />
          </button>
          <button className="ribbon-btn" onClick={() => createCollection()} title="Collection">
            <Package size={32} />
          </button>
        </div>
      </div>

      {/* Import Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Import</div>
        <div className="ribbon-buttons-row">
          <button className="ribbon-btn" onClick={handleImportFile} title="Load File">
            <FileUp size={32} />
          </button>
          <button className="ribbon-btn" onClick={handleImportFolder} title="Load Folder">
            <FolderUp size={32} />
          </button>
        </div>
      </div>

      {/* Project Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Project</div>
        <div className="ribbon-buttons-row">
          <button className="ribbon-btn" onClick={onProjectManagerClick} title="Project Manager">
            <FolderKanban size={32} />
          </button>
          <button className="ribbon-btn" onClick={saveWorld} title="Save">
            <Save size={32} />
          </button>
          <button className="ribbon-btn" onClick={handleLoadWorld} title="Load">
            <FolderOpen size={32} />
          </button>
          <button className="ribbon-btn" onClick={onAssetLibraryClick} title="Asset Library">
            <Library size={32} />
          </button>
        </div>
      </div>

      {/* View Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">View</div>
        <div className="ribbon-buttons-row">
          <button className="ribbon-btn" onClick={onProjectionClick} title="Projection View">
            <Eye size={32} />
          </button>
        </div>
      </div>

      {/* Snap Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Snap</div>
        <div className="ribbon-buttons-row">
          <button
            className={`ribbon-btn ${snapEnabled ? 'active' : ''}`}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title="Toggle Snap"
          >
            <Crosshair size={32} />
          </button>
          <button className="ribbon-btn" title="Snap Settings">
            <Settings size={32} />
          </button>
        </div>
      </div>

      {/* Align Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Align</div>
        <div className="ribbon-buttons-row">
          <button
            className={`ribbon-btn ${alignMode === 'vertex' ? 'active' : ''}`}
            onClick={() => setAlignMode('vertex')}
            title="Align Vertex"
          >
            <CornerDownRight size={32} />
          </button>
          <button
            className={`ribbon-btn ${alignMode === 'edge' ? 'active' : ''}`}
            onClick={() => setAlignMode('edge')}
            title="Align Edge"
          >
            <Minus size={32} />
          </button>
          <button
            className={`ribbon-btn ${alignMode === 'face' ? 'active' : ''}`}
            onClick={() => setAlignMode('face')}
            title="Align Face"
          >
            <Square size={32} />
          </button>
        </div>
      </div>

      {/* Kinematics Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Kinematics</div>
        <div className="ribbon-buttons-row">
          <button className="ribbon-btn" onClick={onKinematicsClick} title="Kinematics Panel">
            <Wrench size={32} />
          </button>
          <button className="ribbon-btn" onClick={onDevicesClick} title="Device Library">
            <BookOpen size={32} />
          </button>
          <button className="ribbon-btn" onClick={onActuatorsClick} title="Actuator Control">
            <Gamepad2 size={32} />
          </button>
        </div>
      </div>

      {/* Physics Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Physics</div>
        <div className="ribbon-buttons-row">
          <button className="ribbon-btn" onClick={onPhysicsClick} title="Physics Settings">
            <Settings size={32} />
          </button>
          <button className="ribbon-btn" onClick={onCollisionsClick} title="Collision Visualizer">
            <Zap size={32} />
          </button>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".gltf,.glb,.obj,.stl,.babylon,.dxf,.dwg,.jt,.catpart,.catproduct,.urdf,.usd,.usdz,.zip"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        /* @ts-expect-error - webkitdirectory not in types */
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderChange}
        style={{ display: 'none' }}
      />
      <input
        ref={worldLoadInputRef}
        type="file"
        accept=".json"
        onChange={handleWorldFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};
