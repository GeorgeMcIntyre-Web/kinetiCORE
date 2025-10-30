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
  Package,
  FileUp,
  FolderUp,
  FolderOpen,
  Move,
  Calculator,
  Zap,
  RotateCw,
  Maximize2,
  FolderKanban,
  RotateCcw,
  Target,
  GitBranch,
  Network,
  ToggleLeft,
  Rocket,
  Scan,
} from 'lucide-react';
import { loadOBJFile } from '../../loaders/obj/OBJLoader';
import { SceneManager } from '../../scene/SceneManager';
import { toast } from '../components/ToastNotifications';
import { loading } from '../components/LoadingIndicator';

// Custom Quick Move Icon - 3 horizontal lines behind a cube
const QuickMoveIcon = ({ size = 32 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <g transform="scale(1.3) translate(-0.5, 0.5)">
      {/* 3 horizontal lines on left side with even spacing - hierarchical structure */}
      {/* These are drawn first so they appear behind the cube */}
      {/* Lines positioned to not overlap with cube - shortened to give more room */}
      {/* Lines vertical span (5 to 14.5 = 9.5 units) matches cube height (9.5 units) */}
      {/* Top line - shorter to avoid touching cube */}
      <line x1="1" y1="5" x2="4" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Middle line - shorter, indented */}
      <line x1="1" y1="9.75" x2="4" y2="9.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Bottom line - shortest, more indented */}
      <line x1="1" y1="14.5" x2="3" y2="14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      
      {/* Cube icon - positioned on the right side, moved left slightly with more room */}
      {/* Front face - starts at x=6.5, height matches line span (9.5 units from y=5 to y=14.5) */}
      <rect x="6.5" y="5" width="9" height="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* Top face - adjusted to fit */}
      <path d="M6.5 5 L9.5 2 L18.5 2 L15.5 5 Z" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* Right face - adjusted to fit, ensuring it doesn't go beyond viewBox */}
      <path d="M15.5 5 L18.5 2 L18.5 11.5 L15.5 14.5 Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </g>
  </svg>
);
import { useEditorStore } from '../store/editorStore';
import { ViewDropdown } from './ViewDropdown';
import { SaveDropdown } from './SaveDropdown';
import { CreateDropdown } from './CreateDropdown';
import './RibbonToolbar.css';

// Transform Gizmo Toggle Component - inline with label
const TransformGizmoToggle = () => {
  const transformGizmoEnabled = useEditorStore((state) => state.transformGizmoEnabled);
  const setTransformGizmoEnabled = useEditorStore((state) => state.setTransformGizmoEnabled);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedNodeId) {
      setTransformGizmoEnabled(!transformGizmoEnabled);
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      title={transformGizmoEnabled ? "Disable Transform Gizmo" : "Enable Transform Gizmo"}
      disabled={!selectedNodeId}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '0',
        marginLeft: '4px',
        cursor: selectedNodeId ? 'pointer' : 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        color: transformGizmoEnabled ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
        pointerEvents: 'auto',
      }}
    >
      <ToggleLeft size={14} style={{ transform: transformGizmoEnabled ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
    </button>
  );
};

export interface RibbonToolbarProps {
  onKinematicsClick?: () => void;
  onKinematicsAnalysisClick?: () => void;
  onActuatorsClick?: () => void;
  onComplexIKClick?: () => void;
  onWholeBodyIKClick?: () => void;
  onKinematicExtractionClick?: () => void;
  onPhysicsClick?: () => void;
  onCollisionsClick?: () => void;
  onProjectionClick?: () => void;
  onProjectManagerClick?: () => void;
  onAssetLibraryClick?: () => void;
  onQuickMoveClick?: () => void;
  onResetViewClick?: () => void;
  onZoomFitClick?: () => void;
  onZoomToSelectedClick?: () => void;
  onTopViewClick?: () => void;
  onRightViewClick?: () => void;
  onFrontViewClick?: () => void;
  onIsoViewClick?: () => void;
}

export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  onKinematicsClick,
  onKinematicsAnalysisClick,
  onActuatorsClick,
  onComplexIKClick,
  onWholeBodyIKClick,
  onKinematicExtractionClick,
  onPhysicsClick,
  onCollisionsClick,
  onProjectionClick: _onProjectionClick,
  onProjectManagerClick,
  onAssetLibraryClick,
  onQuickMoveClick,
  onResetViewClick,
  onZoomFitClick,
  onZoomToSelectedClick,
  onTopViewClick,
  onRightViewClick,
  onFrontViewClick,
  onIsoViewClick,
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
  const loadWorld = useEditorStore((state) => state.loadWorld);
  const currentView = useEditorStore((state) => state.currentView);
  const setCurrentView = useEditorStore((state) => state.setCurrentView);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const worldLoadInputRef = useRef<HTMLInputElement>(null);
  const objInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const handleImportFile = () => fileInputRef.current?.click();
  const handleImportFolder = () => folderInputRef.current?.click();
  const handleLoadWorld = () => worldLoadInputRef.current?.click();
  const handleImportOBJ = () => objInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[RibbonToolbar] ❌ GENERIC FILE LOADER - WRONG BUTTON! Use the Robot icon for OBJ files');
    const files = event.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        await importModel(files[i]);
      }
    }
    event.target.value = '';
  };

  const handleOBJFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('[RibbonToolbar] ✅ OBJ LOADER HANDLER CALLED - This is the correct button!');
    console.log('[RibbonToolbar] File:', file.name);

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) {
      toast.error('Scene not initialized');
      return;
    }

    loading.start(`Loading ${file.name}...`, 'uploading');

    try {
      const result = await loadOBJFile(file, scene);

      if (result.success) {
        toast.success(`Loaded ${result.meshes.length} meshes from ${file.name}`);
        console.log(`[Ribbon] Successfully imported OBJ: ${file.name}`);
      } else {
        toast.error(`Failed to load OBJ: ${result.errorMessage || 'Unknown error'}`);
        console.error(`[Ribbon] OBJ import failed:`, result.errorMessage);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to load OBJ: ${errorMsg}`);
      console.error('[Ribbon] OBJ import error:', error);
    } finally {
      loading.end();
      event.target.value = '';
    }
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

  // View button handlers that update currentView state
  const handleTopViewClick = () => {
    setCurrentView('top');
    onTopViewClick?.();
  };

  const handleRightViewClick = () => {
    setCurrentView('right');
    onRightViewClick?.();
  };

  const handleFrontViewClick = () => {
    setCurrentView('front');
    onFrontViewClick?.();
  };

  const handleIsoViewClick = () => {
    setCurrentView('iso');
    onIsoViewClick?.();
  };

  return (
    <div className="ribbon-toolbar-excel">
      {/* Project Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Project</div>
        <div className="ribbon-buttons-row">
          <button className="ribbon-btn" onClick={onProjectManagerClick} title="Project Manager">
            <FolderKanban size={32} />
          </button>
          <SaveDropdown />
          <button className="ribbon-btn" onClick={handleLoadWorld} title="Load World">
            <FolderOpen size={32} />
          </button>
          <button className="ribbon-btn" onClick={onAssetLibraryClick} title="Asset Library">
            <Package size={32} />
          </button>
        </div>
      </div>

      {/* Import Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Import</div>
        <div className="ribbon-buttons-row">
          <button className="ribbon-btn" onClick={handleImportFile} title="Import Model (URDF, GLTF, USD, etc.)">
            <FileUp size={32} />
          </button>
          <button className="ribbon-btn" onClick={handleImportFolder} title="Import Folder">
            <FolderUp size={32} />
          </button>
          <button className="ribbon-btn" onClick={handleImportOBJ} title="Import OBJ Mesh">
            <Package size={32} />
          </button>
        </div>
      </div>

      {/* Create Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">Create</div>
        <div className="ribbon-buttons-row">
          <CreateDropdown
            onCreateBox={() => createObject('box')}
            onCreateSphere={() => createObject('sphere')}
            onCreateCylinder={() => createObject('cylinder')}
          />
          <button className="ribbon-btn" onClick={() => createCollection()} title="Collection">
            <Package size={32} />
          </button>
        </div>
      </div>

      {/* Transform Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Transform
          <TransformGizmoToggle />
        </div>
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
          <button
            className="ribbon-btn"
            onClick={onQuickMoveClick}
            title="Quick Move Dialog"
          >
            <QuickMoveIcon size={32} />
          </button>
        </div>
      </div>

      {/* View Category */}
      <div className="ribbon-category-excel">
        <div className="ribbon-category-label">View</div>
        <div className="ribbon-buttons-row">
          <button className="ribbon-btn" onClick={onResetViewClick} title="Reset View">
            <RotateCcw size={32} />
          </button>
          <button className="ribbon-btn" onClick={onZoomFitClick} title="Zoom Fit">
            <Maximize2 size={32} />
          </button>
          <button className="ribbon-btn" onClick={onZoomToSelectedClick} title="Zoom to Selected">
            <Target size={32} />
          </button>
          <ViewDropdown
            onTopViewClick={handleTopViewClick}
            onRightViewClick={handleRightViewClick}
            onFrontViewClick={handleFrontViewClick}
            onIsoViewClick={handleIsoViewClick}
            currentView={currentView}
          />
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
          <button className="ribbon-btn" onClick={onKinematicsClick} title="Motion Panel">
            <Rocket size={32} />
          </button>
          <button className="ribbon-btn" onClick={onKinematicsAnalysisClick} title="Kinematics Analysis">
            <Calculator size={32} />
          </button>
          <button className="ribbon-btn" onClick={onActuatorsClick} title="Actuator Control">
            <div style={{ position: 'relative', width: '32px', height: '32px' }}>
              <Zap size={20} style={{ position: 'absolute', left: '6px', top: '6px' }} />
              <Settings size={20} style={{ position: 'absolute', right: '6px', bottom: '6px' }} />
            </div>
          </button>
          <button className="ribbon-btn" onClick={onComplexIKClick} title="Complex IK Systems">
            <GitBranch size={32} />
          </button>
          <button className="ribbon-btn" onClick={onWholeBodyIKClick} title="FullBody IK">
            <Network size={32} />
          </button>
          <button className="ribbon-btn" onClick={onKinematicExtractionClick} title="Auto Kinematic Extraction">
            <Scan size={32} />
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
      <input
        ref={objInputRef}
        type="file"
        accept=".obj,.zip"
        onChange={handleOBJFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};
