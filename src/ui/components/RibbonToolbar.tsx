// Ribbon Toolbar - Horizontal ribbon-style toolbar
// Owner: George
// Replaces vertical toolbar with horizontal ribbon layout

import React, { useState, useRef } from 'react';
import {
  Settings,
  Target,
  Home,
  MousePointer,
  XCircle,
  Shapes,
  Layers3,
  CornerDownRight,
  Minus,
  Square,
  Crosshair,
  Circle,
  Box,
  ArrowRight,
  Grid3x3,
  AlignLeft,
  Plane,
  Axis3D,
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
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { babylonToUser } from '../../core/CoordinateSystem';
import * as BABYLON from '@babylonjs/core';
import './RibbonToolbar.css';

// Transform Category Component
const TransformCategory: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Transform settings from store
  const positionIncrement = useEditorStore((state) => state.positionIncrement);
  const rotationIncrement = useEditorStore((state) => state.rotationIncrement);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const temporaryOrigin = useEditorStore((state) => state.temporaryOrigin);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);

  // Setters
  const setPositionIncrement = useEditorStore((state) => state.setPositionIncrement);
  const setRotationIncrement = useEditorStore((state) => state.setRotationIncrement);
  const setSnapEnabled = useEditorStore((state) => state.setSnapEnabled);
  const setTemporaryOrigin = useEditorStore((state) => state.setTemporaryOrigin);
  const clearTemporaryOrigin = useEditorStore((state) => state.clearTemporaryOrigin);

  // Preset increment values
  const posPresets = [1, 5, 10, 25, 50, 100]; // mm
  const rotPresets = [1, 5, 15, 30, 45, 90]; // degrees

  const handleSetOriginFromSelection = () => {
    if (!selectedNodeId) return;

    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(selectedNodeId);
    if (!node) return;

    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    // Get Babylon node
    let babylonNode: BABYLON.TransformNode | null = null;
    if (node.babylonMeshId) {
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
    } else if (node.type === 'collection') {
      babylonNode = scene.transformNodes.find((tn) => tn.name === node.name) || null;
    }

    if (!babylonNode) return;

    // Get world position
    const worldPos = babylonNode.getAbsolutePosition();
    const userPos = babylonToUser(worldPos);

    setTemporaryOrigin(userPos);
  };

  const handleSetOriginAtWorldZero = () => {
    setTemporaryOrigin({ x: 0, y: 0, z: 0 });
  };

  const handleSetOriginFromSnap = () => {
    if (!snapEnabled) {
      alert('Enable snapping first to use snap-to origin');
      return;
    }
    alert('Snap-to origin: Click on a vertex, edge, or face in the 3D view');
  };

  return (
    <div className="ribbon-category">
      <button
        className="ribbon-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Transform Tools"
      >
        <Settings size={24} />
        <span>Transform</span>
      </button>

      {isExpanded && (
        <div className="ribbon-category-content">
          {/* Position Increments */}
          <div className="ribbon-section">
            <div className="ribbon-section-title">Position (mm)</div>
            <div className="ribbon-button-group">
              {posPresets.map((val) => (
                <button
                  key={val}
                  className={`ribbon-button ${positionIncrement === val ? 'active' : ''}`}
                  onClick={() => setPositionIncrement(val)}
                  title={`${val}mm`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Rotation Increments */}
          <div className="ribbon-section">
            <div className="ribbon-section-title">Rotation (°)</div>
            <div className="ribbon-button-group">
              {rotPresets.map((val) => (
                <button
                  key={val}
                  className={`ribbon-button ${rotationIncrement === val ? 'active' : ''}`}
                  onClick={() => setRotationIncrement(val)}
                  title={`${val}°`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Snap Toggle */}
          <div className="ribbon-section">
            <div className="ribbon-section-title">Snap</div>
            <button
              className={`ribbon-button large ${snapEnabled ? 'active' : ''}`}
              onClick={() => setSnapEnabled(!snapEnabled)}
              title="Toggle Snapping"
            >
              <Crosshair size={20} />
            </button>
          </div>

          {/* Temporary Origin */}
          <div className="ribbon-section">
            <div className="ribbon-section-title">Origin</div>
            <div className="ribbon-button-group">
              <button
                className="ribbon-button"
                onClick={handleSetOriginFromSelection}
                disabled={!selectedNodeId}
                title="From Selection"
              >
                <Target size={18} />
              </button>
              <button
                className="ribbon-button"
                onClick={handleSetOriginAtWorldZero}
                title="World Zero"
              >
                <Home size={18} />
              </button>
              <button
                className="ribbon-button"
                onClick={handleSetOriginFromSnap}
                disabled={!snapEnabled}
                title="Snap To Point"
              >
                <MousePointer size={18} />
              </button>
              {temporaryOrigin && (
                <button
                  className="ribbon-button"
                  onClick={clearTemporaryOrigin}
                  title="Clear Origin"
                >
                  <XCircle size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Snap Category Component
const SnapCategory: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Snap settings from store
  const snapToVertex = useEditorStore((state) => state.snapToVertex);
  const snapToEdge = useEditorStore((state) => state.snapToEdge);
  const snapToFace = useEditorStore((state) => state.snapToFace);
  const snapToCenter = useEditorStore((state) => state.snapToCenter);
  const snapToMidpoint = useEditorStore((state) => state.snapToMidpoint);
  const snapToIntersection = useEditorStore((state) => state.snapToIntersection);
  const snapToNormal = useEditorStore((state) => state.snapToNormal);
  const snapToPerpendicular = useEditorStore((state) => state.snapToPerpendicular);
  const snapToTangent = useEditorStore((state) => state.snapToTangent);
  const snapToPlane = useEditorStore((state) => state.snapToPlane);
  const snapToAxis = useEditorStore((state) => state.snapToAxis);
  const snapToCurve = useEditorStore((state) => state.snapToCurve);
  const snapToObject = useEditorStore((state) => state.snapToObject);
  const snapToSurface = useEditorStore((state) => state.snapToSurface);
  const snapObjectToVertex = useEditorStore((state) => state.snapObjectToVertex);
  const snapBBoxCorner = useEditorStore((state) => state.snapBBoxCorner);
  const snapToGrid = useEditorStore((state) => state.snapToGrid);
  const snapPointOnEdge = useEditorStore((state) => state.snapPointOnEdge);

  // Setters
  const setSnapToVertex = useEditorStore((state) => state.setSnapToVertex);
  const setSnapToEdge = useEditorStore((state) => state.setSnapToEdge);
  const setSnapToFace = useEditorStore((state) => state.setSnapToFace);
  const setSnapToCenter = useEditorStore((state) => state.setSnapToCenter);
  const setSnapToMidpoint = useEditorStore((state) => state.setSnapToMidpoint);
  const setSnapToIntersection = useEditorStore((state) => state.setSnapToIntersection);
  const setSnapToNormal = useEditorStore((state) => state.setSnapToNormal);
  const setSnapToPerpendicular = useEditorStore((state) => state.setSnapToPerpendicular);
  const setSnapToTangent = useEditorStore((state) => state.setSnapToTangent);
  const setSnapToPlane = useEditorStore((state) => state.setSnapToPlane);
  const setSnapToAxis = useEditorStore((state) => state.setSnapToAxis);
  const setSnapToCurve = useEditorStore((state) => state.setSnapToCurve);
  const setSnapToObject = useEditorStore((state) => state.setSnapToObject);
  const setSnapToSurface = useEditorStore((state) => state.setSnapToSurface);
  const setSnapObjectToVertex = useEditorStore((state) => state.setSnapObjectToVertex);
  const setSnapBBoxCorner = useEditorStore((state) => state.setSnapBBoxCorner);
  const setSnapToGrid = useEditorStore((state) => state.setSnapToGrid);
  const setSnapPointOnEdge = useEditorStore((state) => state.setSnapPointOnEdge);

  return (
    <div className="ribbon-category">
      <button
        className="ribbon-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Snap Tools"
      >
        <Shapes size={24} />
        <span>Snap</span>
      </button>

      {isExpanded && (
        <div className="ribbon-category-content">
          {/* Geometric Snaps */}
          <div className="ribbon-section">
            <div className="ribbon-section-title">Geometric</div>
            <div className="ribbon-button-group">
              <button
                className={`ribbon-button ${snapToVertex ? 'active' : ''}`}
                onClick={() => setSnapToVertex(!snapToVertex)}
                title="Snap to Vertex"
              >
                <CornerDownRight size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToEdge ? 'active' : ''}`}
                onClick={() => setSnapToEdge(!snapToEdge)}
                title="Snap to Edge"
              >
                <Minus size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToFace ? 'active' : ''}`}
                onClick={() => setSnapToFace(!snapToFace)}
                title="Snap to Face"
              >
                <Square size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToCenter ? 'active' : ''}`}
                onClick={() => setSnapToCenter(!snapToCenter)}
                title="Snap to Center"
              >
                <Crosshair size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToMidpoint ? 'active' : ''}`}
                onClick={() => setSnapToMidpoint(!snapToMidpoint)}
                title="Snap to Midpoint"
              >
                <Circle size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToIntersection ? 'active' : ''}`}
                onClick={() => setSnapToIntersection(!snapToIntersection)}
                title="Snap to Intersection"
              >
                <Crosshair size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToNormal ? 'active' : ''}`}
                onClick={() => setSnapToNormal(!snapToNormal)}
                title="Snap to Normal"
              >
                <ArrowRight size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToPerpendicular ? 'active' : ''}`}
                onClick={() => setSnapToPerpendicular(!snapToPerpendicular)}
                title="Snap to Perpendicular"
              >
                <Minus size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToTangent ? 'active' : ''}`}
                onClick={() => setSnapToTangent(!snapToTangent)}
                title="Snap to Tangent"
              >
                <Circle size={18} />
              </button>
            </div>
          </div>

          {/* Object-Level Snaps */}
          <div className="ribbon-section">
            <div className="ribbon-section-title">Object-Level</div>
            <div className="ribbon-button-group">
              <button
                className={`ribbon-button ${snapToObject ? 'active' : ''}`}
                onClick={() => setSnapToObject(!snapToObject)}
                title="Snap to Object"
              >
                <Box size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToSurface ? 'active' : ''}`}
                onClick={() => setSnapToSurface(!snapToSurface)}
                title="Snap to Surface"
              >
                <Layers3 size={18} />
              </button>
              <button
                className={`ribbon-button ${snapObjectToVertex ? 'active' : ''}`}
                onClick={() => setSnapObjectToVertex(!snapObjectToVertex)}
                title="Object to Vertex"
              >
                <Target size={18} />
              </button>
              <button
                className={`ribbon-button ${snapBBoxCorner ? 'active' : ''}`}
                onClick={() => setSnapBBoxCorner(!snapBBoxCorner)}
                title="BBox Corner"
              >
                <Box size={18} />
              </button>
            </div>
          </div>

          {/* Advanced Snaps */}
          <div className="ribbon-section">
            <div className="ribbon-section-title">Advanced</div>
            <div className="ribbon-button-group">
              <button
                className={`ribbon-button ${snapToPlane ? 'active' : ''}`}
                onClick={() => setSnapToPlane(!snapToPlane)}
                title="Snap to Plane"
              >
                <Plane size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToAxis ? 'active' : ''}`}
                onClick={() => setSnapToAxis(!snapToAxis)}
                title="Snap to Axis"
              >
                <Axis3D size={18} />
              </button>
              <button
                className={`ribbon-button ${snapToCurve ? 'active' : ''}`}
                onClick={() => setSnapToCurve(!snapToCurve)}
                title="Snap to Curve"
              >
                <Circle size={18} />
              </button>
            </div>
          </div>

          {/* Auxiliary Snaps */}
          <div className="ribbon-section">
            <div className="ribbon-section-title">Auxiliary</div>
            <div className="ribbon-button-group">
              <button
                className={`ribbon-button ${snapToGrid ? 'active' : ''}`}
                onClick={() => setSnapToGrid(!snapToGrid)}
                title="Snap to Grid"
              >
                <Grid3x3 size={18} />
              </button>
              <button
                className={`ribbon-button ${snapPointOnEdge ? 'active' : ''}`}
                onClick={() => setSnapPointOnEdge(!snapPointOnEdge)}
                title="Point on Edge"
              >
                <Circle size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Align Category Component
const AlignCategory: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const alignMode = useEditorStore((state) => state.alignMode);
  const setAlignMode = useEditorStore((state) => state.setAlignMode);

  const startAlignMode = (mode: 'vertex' | 'edge' | 'face' | 'center' | null) => {
    setAlignMode(mode);
    setIsExpanded(false);
  };

  return (
    <div className="ribbon-category">
      <button
        className="ribbon-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Align Tools"
      >
        <AlignLeft size={24} />
        <span>Align</span>
      </button>

      {isExpanded && (
        <div className="ribbon-category-content">
          <div className="ribbon-section">
            <div className="ribbon-section-title">Alignment Types</div>
            <div className="ribbon-button-group">
              <button
                className={`ribbon-button ${alignMode === 'vertex' ? 'active' : ''}`}
                onClick={() => startAlignMode('vertex')}
                title="Vertex to Vertex"
              >
                <CornerDownRight size={18} />
              </button>
              <button
                className={`ribbon-button ${alignMode === 'edge' ? 'active' : ''}`}
                onClick={() => startAlignMode('edge')}
                title="Edge to Edge"
              >
                <Minus size={18} />
              </button>
              <button
                className={`ribbon-button ${alignMode === 'face' ? 'active' : ''}`}
                onClick={() => startAlignMode('face')}
                title="Face to Face"
              >
                <Square size={18} />
              </button>
              <button
                className={`ribbon-button ${alignMode === 'center' ? 'active' : ''}`}
                onClick={() => startAlignMode('center')}
                title="Center to Center"
              >
                <Crosshair size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Create Category Component
const CreateCategory: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const createObject = useEditorStore((state) => state.createObject);
  const createCollection = useEditorStore((state) => state.createCollection);

  return (
    <div className="ribbon-category">
      <button
        className="ribbon-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Create Objects"
      >
        <Package size={18} />
        <span>Create</span>
      </button>

      {isExpanded && (
        <div className="ribbon-category-content">
          <div className="ribbon-section">
            <div className="ribbon-section-title">Primitives</div>
            <div className="ribbon-button-group">
              <button
                className="ribbon-button"
                onClick={() => createObject('box')}
                title="Create Box"
              >
                <Box size={18} />
              </button>
              <button
                className="ribbon-button"
                onClick={() => createObject('sphere')}
                title="Create Sphere"
              >
                <Circle size={18} />
              </button>
              <button
                className="ribbon-button"
                onClick={() => createObject('cylinder')}
                title="Create Cylinder"
              >
                <CylinderIcon size={18} />
              </button>
            </div>
          </div>

          <div className="ribbon-section">
            <div className="ribbon-section-title">Organize</div>
            <button
              className="ribbon-button large"
              onClick={() => createCollection()}
              title="Create Collection"
            >
              <Package size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Import Category Component
const ImportCategory: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const importModel = useEditorStore((state) => state.importModel);
  const importURDFFolder = useEditorStore((state) => state.importURDFFolder);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFolderClick = () => {
    folderInputRef.current?.click();
  };

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

  return (
    <div className="ribbon-category">
      <button
        className="ribbon-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Import Files"
      >
        <FileUp size={18} />
        <span>Import</span>
      </button>

      {isExpanded && (
        <div className="ribbon-category-content">
          <div className="ribbon-section">
            <div className="ribbon-section-title">Load</div>
            <div className="ribbon-button-group">
              <button
                className="ribbon-button"
                onClick={handleImportClick}
                title="Load File"
              >
                <FileUp size={18} />
              </button>
              <button
                className="ribbon-button"
                onClick={handleFolderClick}
                title="Load Folder"
              >
                <FolderUp size={18} />
              </button>
            </div>
          </div>

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
        </div>
      )}
    </div>
  );
};

// Project Category Component
const ProjectCategory: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const saveWorld = useEditorStore((state) => state.saveWorld);
  const loadWorld = useEditorStore((state) => state.loadWorld);
  const saveComprehensiveWorld = useEditorStore((state) => state.saveComprehensiveWorld);
  const worldLoadInputRef = useRef<HTMLInputElement>(null);

  const handleLoadClick = () => {
    worldLoadInputRef.current?.click();
  };

  const handleWorldFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await loadWorld(file);
    }
    event.target.value = '';
  };

  return (
    <div className="ribbon-category">
      <button
        className="ribbon-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Project Management"
      >
        <FolderOpen size={18} />
        <span>Project</span>
      </button>

      {isExpanded && (
        <div className="ribbon-category-content">
          <div className="ribbon-section">
            <div className="ribbon-section-title">World</div>
            <div className="ribbon-button-group">
              <button
                className="ribbon-button"
                onClick={saveWorld}
                title="Save World"
              >
                <Save size={18} />
              </button>
              <button
                className="ribbon-button"
                onClick={saveComprehensiveWorld}
                title="Save Full"
              >
                <Save size={18} />
              </button>
              <button
                className="ribbon-button"
                onClick={handleLoadClick}
                title="Load World"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          </div>

          <input
            ref={worldLoadInputRef}
            type="file"
            accept=".json"
            onChange={handleWorldFileChange}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
  );
};

// View Category Component
const ViewCategory: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleProjectionView = () => {
    // Projection view logic will be implemented
    console.log('Create projection view');
  };

  return (
    <div className="ribbon-category">
      <button
        className="ribbon-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="View Tools"
      >
        <Eye size={18} />
        <span>View</span>
      </button>

      {isExpanded && (
        <div className="ribbon-category-content">
          <div className="ribbon-section">
            <div className="ribbon-section-title">Projections</div>
            <button
              className="ribbon-button large"
              onClick={handleProjectionView}
              title="Create Projection View"
            >
              <Eye size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Kinematics Category Component
const KinematicsCategory: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleKinematicsSetup = () => {
    console.log('Open Kinematics Setup panel');
    // Panel opening logic will be added
  };

  const handleDeviceLibrary = () => {
    console.log('Open Device Library panel');
    // Panel opening logic will be added
  };

  const handleActuatorControl = () => {
    console.log('Open Actuator Control panel');
    // Panel opening logic will be added
  };

  return (
    <div className="ribbon-category">
      <button
        className="ribbon-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Kinematics Tools"
      >
        <Wrench size={18} />
        <span>Kinematics</span>
      </button>

      {isExpanded && (
        <div className="ribbon-category-content">
          <div className="ribbon-section">
            <div className="ribbon-section-title">Setup</div>
            <button
              className="ribbon-button"
              onClick={handleKinematicsSetup}
              title="Kinematics Setup"
            >
              <Wrench size={18} />
            </button>
          </div>

          <div className="ribbon-section">
            <div className="ribbon-section-title">Devices</div>
            <div className="ribbon-button-group">
              <button
                className="ribbon-button"
                onClick={handleDeviceLibrary}
                title="Device Library"
              >
                <BookOpen size={18} />
              </button>
              <button
                className="ribbon-button"
                onClick={handleActuatorControl}
                title="Actuator Control"
              >
                <Gamepad2 size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Physics Category Component
const PhysicsCategory: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePhysicsSettings = () => {
    console.log('Open Physics Settings panel');
    // Panel opening logic will be added
  };

  const handleCollisionVisualizer = () => {
    console.log('Toggle Collision Visualizer');
    // Toggle logic will be added
  };

  return (
    <div className="ribbon-category">
      <button
        className="ribbon-category-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Physics Tools"
      >
        <Zap size={18} />
        <span>Physics</span>
      </button>

      {isExpanded && (
        <div className="ribbon-category-content">
          <div className="ribbon-section">
            <div className="ribbon-section-title">Physics</div>
            <div className="ribbon-button-group">
              <button
                className="ribbon-button"
                onClick={handlePhysicsSettings}
                title="Physics Settings"
              >
                <Settings size={18} />
              </button>
              <button
                className="ribbon-button"
                onClick={handleCollisionVisualizer}
                title="Collision Visualizer"
              >
                <Zap size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Ribbon Toolbar Component
export const RibbonToolbar: React.FC = () => {
  return (
    <div className="ribbon-toolbar">
      <TransformCategory />
      <CreateCategory />
      <ImportCategory />
      <ProjectCategory />
      <ViewCategory />
      <SnapCategory />
      <AlignCategory />
      <KinematicsCategory />
      <PhysicsCategory />
    </div>
  );
};
