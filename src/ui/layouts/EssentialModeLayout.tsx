// Essential Mode Layout - Beginner-friendly interface
// Owner: George (Architecture)

import React, { useRef, useEffect, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import {
  Box,
  Circle,
  Cylinder,
  Save,
  Upload,
  FolderOpen,
  Move,
  RotateCw,
  Layers,
  Library,
  Cog,
  Settings,
  Trash2,
} from 'lucide-react';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { useAssetLibraryStore } from '../store/assetLibraryStore';
import { SceneTree } from '../components/SceneTree';
import { KinematicsPanel } from '../components/KinematicsPanel';
import { ActuatorControlPanel } from '../components/ActuatorControlPanel';
import { DeviceLibrary } from '../components/DeviceLibrary';
import { PhysicsSettings } from '../components/PhysicsSettings';
import { CollisionVisualizer } from '../components/CollisionVisualizer';
import { FloorSelector } from '../components/FloorSelector';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { babylonToUser } from '../../core/CoordinateSystem';
import { CreateProjectionViewCommand } from '../../history/commands/CreateProjectionViewCommand';
import { toast } from '../components/ToastNotifications';
import './EssentialModeLayout.css';

export const EssentialModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const importModel = useEditorStore((state) => state.importModel);
  const loadWorld = useEditorStore((state) => state.loadWorld);
  const loadComprehensiveWorld = useEditorStore((state) => state.loadComprehensiveWorld);
  const saveComprehensiveWorld = useEditorStore((state) => state.saveComprehensiveWorld);
  const clearWorld = useEditorStore((state) => state.clearWorld);
  const zoomFit = useEditorStore((state) => state.zoomFit);
  const zoomToNode = useEditorStore((state) => state.zoomToNode);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const commandManager = useEditorStore((state) => state.commandManager);
  const toggleLibrary = useAssetLibraryStore((state) => state.toggleVisibility);

  const [transform, setTransform] = useState<{
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
  } | null>(null);

  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);
  const [showActuatorPanel, setShowActuatorPanel] = useState(false);
  const [showDeviceLibrary, setShowDeviceLibrary] = useState(false);
  const [showPhysicsSettings, setShowPhysicsSettings] = useState(false);
  const [showCollisionVisualizer, setShowCollisionVisualizer] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = () => {
    fileInputRef.current?.click();
  };

  const handleLoadWorld = () => {
    loadFileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log(`[File Selection] ========================================`);
    console.log(`[File Selection] Selected ${files.length} file(s):`);

    // Log all selected files first
    for (let i = 0; i < files.length; i++) {
      console.log(`[File Selection]   ${i + 1}. ${files[i].name} (${(files[i].size / 1024).toFixed(2)} KB)`);
    }

    // Separate files into model files (.zip, .xml, .urdf, etc.) and mesh files (.stl, .obj, .dae)
    const modelFiles: File[] = [];
    const meshFiles: File[] = [];

    Array.from(files).forEach(f => {
      const ext = f.name.toLowerCase();
      if (ext.endsWith('.xml') || ext.endsWith('.urdf') || ext.endsWith('.gltf') ||
          ext.endsWith('.glb') || ext.endsWith('.obj') || ext.endsWith('.stl') ||
          ext.endsWith('.jt') || ext.endsWith('.dwg') || ext.endsWith('.dxf') ||
          ext.endsWith('.zip')) {
        modelFiles.push(f);
      } else if (ext.endsWith('.stl') || ext.endsWith('.obj') || ext.endsWith('.dae')) {
        meshFiles.push(f);
      }
    });

    // Check if we have MJCF files and initialize batch processing
    const mjcfFiles = modelFiles.filter(f => 
      f.name.toLowerCase().endsWith('.zip') || f.name.toLowerCase().endsWith('.xml')
    );
    
    if (mjcfFiles.length > 0) {
      console.log(`[File Selection] Detected ${mjcfFiles.length} MJCF file(s), initializing batch processing`);
      
      // Import MJCF loading status system
      try {
        const { mjcfLoading } = await import('../components/MJCFLoadingStatus');
        mjcfLoading.startBatch(mjcfFiles.map(f => f.name));
      } catch (error) {
        console.warn('[File Selection] Could not initialize MJCF batch processing:', error);
      }
    }

    // Import each model file sequentially
    if (modelFiles.length > 0 && importModel) {
      for (let i = 0; i < modelFiles.length; i++) {
        const modelFile = modelFiles[i];
        console.log(`[File Selection] ----------------------------------------`);
        console.log(`[File Selection] 🔄 Starting import ${i + 1}/${modelFiles.length}: ${modelFile.name}`);

        try {
          await importModel(modelFile, meshFiles);
          console.log(`[File Selection] ✅ Completed import ${i + 1}/${modelFiles.length}: ${modelFile.name}`);
        } catch (error) {
          console.error(`[File Selection] ❌ Failed import ${i + 1}/${modelFiles.length}: ${modelFile.name}`, error);
        }
      }

      console.log(`[File Selection] ========================================`);
      console.log(`[File Selection] ✅ All ${modelFiles.length} model file(s) processed`);
    }

    if (event.target) {
      event.target.value = '';
    }
  };

  const handleLoadFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's a comprehensive file by reading the first part
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          
          // Check if it's a comprehensive file
          if (data.format === 'comprehensive') {
            console.log('🔧 Detected comprehensive file, using comprehensive loader');
            if (loadComprehensiveWorld) {
              await loadComprehensiveWorld(file);
            }
          } else {
            console.log('🔧 Detected regular file, using regular loader');
            if (loadWorld) {
              await loadWorld(file);
            }
          }
        } catch (error) {
          console.error('Error parsing file:', error);
          // Fallback to regular loader
          if (loadWorld) {
            await loadWorld(file);
          }
        }
      };
      reader.readAsText(file);
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleResetView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = -Math.PI / 2;
      camera.beta = Math.PI / 3;
      camera.radius = 10;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleZoomFit = () => {
    zoomFit();
  };

  const handleZoomToSelected = () => {
    if (selectedNodeId) {
      zoomToNode(selectedNodeId);
    }
  };

  const handleClearWorld = () => {
    if (window.confirm('Are you sure you want to clear the entire world? This cannot be undone.')) {
      clearWorld();
    }
  };

  const handleCreateProjectionView = () => {
    if (selectedNodeIds.length === 0) {
      toast.warning('Select object(s) to project');
      return;
    }

    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();

    if (!scene) {
      toast.error('Scene not initialized');
      return;
    }

    let sourceMesh: any = null;
    let targetMesh: any = null;

    if (selectedNodeIds.length === 1) {
      // Single selection: project onto ground
      const node = tree.getNode(selectedNodeIds[0]);
      if (!node) {
        toast.error('Node not found');
        return;
      }

      sourceMesh = node.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node.babylonMeshId)) : null;
      targetMesh = scene.getMeshByName('ground');

      if (!sourceMesh) {
        toast.error('Select a mesh object');
        return;
      }

      if (!targetMesh) {
        toast.error('Ground not found');
        return;
      }
    } else if (selectedNodeIds.length === 2) {
      // Two selections: project first onto second
      const node1 = tree.getNode(selectedNodeIds[0]);
      const node2 = tree.getNode(selectedNodeIds[1]);

      if (!node1 || !node2) {
        toast.error('Nodes not found');
        return;
      }

      sourceMesh = node1.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node1.babylonMeshId)) : null;
      targetMesh = node2.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node2.babylonMeshId)) : null;

      if (!sourceMesh || !targetMesh) {
        toast.error('Select 2 meshes');
        return;
      }
    } else {
      // Multiple selections: project all onto ground
      targetMesh = scene.getMeshByName('ground');
      if (!targetMesh) {
        toast.error('Ground not found');
        return;
      }

      // Project each selected object onto ground
      let successCount = 0;
      for (const nodeId of selectedNodeIds) {
        const node = tree.getNode(nodeId);
        if (!node) continue;

        sourceMesh = node.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node.babylonMeshId)) : null;
        if (!sourceMesh) continue;

        try {
          const command = new CreateProjectionViewCommand(sourceMesh.name, targetMesh.name, 'auto');
          commandManager.execute(command);
          successCount++;
        } catch (error) {
          console.error('Failed to project:', error);
        }
      }

      if (successCount > 0) {
        toast.success(`Created ${successCount} projections!`);
      } else {
        toast.error('No projections created');
      }
      return;
    }

    try {
      const command = new CreateProjectionViewCommand(sourceMesh.name, targetMesh.name, 'auto');
      commandManager.execute(command);
      toast.success('Projection created!');
    } catch (error) {
      console.error('Failed to create projection:', error);
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Update transform display when selection changes
  useEffect(() => {
    if (!selectedNodeId) {
      setTransform(null);
      return;
    }

    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    if (!scene) return;

    let lastTransform: string | null = null;

    const updateTransform = () => {
      const node = tree.getNode(selectedNodeId);
      if (!node) {
        setTransform(null);
        return;
      }

      let babylonNode: BABYLON.TransformNode | null = null;
      const registry = EntityRegistry.getInstance();

      if (node.babylonMeshId) {
        const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
        if (mesh) {
          const entity = registry.getByMesh(mesh);
          if (entity && entity.getIsDevice()) {
            babylonNode = entity.getRootTransformNode();
          } else {
            babylonNode = mesh;
          }
        }
      } else if (node.type === 'collection') {
        babylonNode = scene.transformNodes.find(tn => tn.name === node.name) || null;
      }

      if (babylonNode) {
        const userPos = babylonToUser(babylonNode.position);

        // Get rotation - check for quaternion first (takes precedence over Euler angles)
        let rotation: BABYLON.Vector3;
        if (babylonNode.rotationQuaternion) {
          rotation = babylonNode.rotationQuaternion.toEulerAngles();
        } else {
          rotation = babylonNode.rotation;
        }

        const newTransform = {
          x: Math.round(userPos.x * 10) / 10,
          y: Math.round(userPos.y * 10) / 10,
          z: Math.round(userPos.z * 10) / 10,
          rx: Math.round((rotation.x * 180 / Math.PI) * 10) / 10,
          ry: Math.round((rotation.y * 180 / Math.PI) * 10) / 10,
          rz: Math.round((rotation.z * 180 / Math.PI) * 10) / 10,
        };

        const newTransformStr = JSON.stringify(newTransform);
        if (newTransformStr !== lastTransform) {
          lastTransform = newTransformStr;
          setTransform(newTransform);
        }
      } else {
        setTransform(null);
      }
    };

    updateTransform();

    const handleSceneUpdate = () => updateTransform();
    window.addEventListener('scenetree-update', handleSceneUpdate);

    const observer = scene?.onBeforeRenderObservable.add(() => {
      updateTransform();
    });

    return () => {
      window.removeEventListener('scenetree-update', handleSceneUpdate);
      if (scene && observer) {
        scene.onBeforeRenderObservable.remove(observer);
      }
    };
  }, [selectedNodeId]);

  return (
    <div className="essential-layout">
      {/* Header */}
      <header className="essential-header">
        <div className="header-left">
          <h1 className="logo">kinetiCORE</h1>
          <span className="mode-badge">Essential</span>
        </div>
        <div className="header-center"></div>
        <div className="header-right">
          <select
            value={userLevel}
            onChange={(e) => {
              const newLevel = e.target.value;
              if (newLevel === 'essential' || newLevel === 'professional' || newLevel === 'expert') {
                setUserLevel(newLevel);
              }
            }}
            className="user-level-select"
          >
            <option value="essential">Essential</option>
            <option value="professional">Professional</option>
            <option value="expert">Expert</option>
          </select>
        </div>
      </header>

      {/* Main Content */}
      <div className="essential-content">
        {/* Left Sidebar */}
        <aside className="essential-sidebar">
          <div className="sidebar-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
            <h3 className="sidebar-title" style={{ padding: '12px 8px' }}>Scene Tree</h3>
            <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
              <SceneTree />
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main id="viewport-essential" className="essential-viewport"></main>
      </div>

      {/* Floating Toolbar */}
      <div className="floating-toolbar">
        <button className="toolbar-btn active" onClick={() => {}} title="Move & Rotate (Combined)">
          <div style={{ position: 'relative', width: 18, height: 18 }}>
            <Move size={16} style={{ position: 'absolute', top: 0, left: 0 }} />
            <RotateCw size={12} style={{ position: 'absolute', bottom: 0, right: 0 }} />
          </div>
        </button>
        <button className="toolbar-btn" onClick={() => createObject('box')} title="Create Box">
          <Box size={18} />
        </button>
        <button className="toolbar-btn" onClick={() => createObject('sphere')} title="Create Sphere">
          <Circle size={18} />
        </button>
        <button className="toolbar-btn" onClick={() => createObject('cylinder')} title="Create Cylinder">
          <Cylinder size={18} />
        </button>
        <div className="toolbar-separator" />
        <button
          className="toolbar-btn"
          onClick={handleCreateProjectionView}
          title="Create Projection View (Select 1+ objects)"
          disabled={selectedNodeIds.length === 0}
        >
          <Layers size={18} />
        </button>
        <div className="toolbar-separator" />
        <button className="toolbar-btn" onClick={toggleLibrary} title="Asset Library">
          <Library size={18} />
        </button>
        <button className="toolbar-btn" onClick={() => setShowKinematicsPanel(!showKinematicsPanel)} title="Kinematics">
          <Cog size={18} />
        </button>
        <button className="toolbar-btn" onClick={() => setShowActuatorPanel(!showActuatorPanel)} title="Actuator Control">
          <Settings size={18} />
        </button>
        <button className="toolbar-btn" onClick={() => setShowDeviceLibrary(!showDeviceLibrary)} title="Device Library">
          <Library size={18} />
        </button>
        <div className="toolbar-separator" />
        <button className="toolbar-btn" onClick={() => setShowPhysicsSettings(!showPhysicsSettings)} title="Physics Settings">
          <Cog size={18} />
        </button>
        <button className="toolbar-btn" onClick={() => setShowCollisionVisualizer(!showCollisionVisualizer)} title="Collision Visualizer">
          <Settings size={18} />
        </button>
        <div className="toolbar-separator" />
        <button className="toolbar-btn" onClick={handleFileImport} title="Import Model">
          <Upload size={18} />
        </button>
        <button className="toolbar-btn" onClick={handleLoadWorld} title="Load World">
          <FolderOpen size={18} />
        </button>
        <button 
          className="toolbar-btn" 
          onClick={saveComprehensiveWorld} 
          title="Save World (All Assets & Data)"
        >
          <Save size={18} />
        </button>
        <button className="toolbar-btn" onClick={handleClearWorld} title="Clear World">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Viewport Controls */}
      <div className="viewport-controls">
        <button className="control-btn" onClick={handleResetView}>Reset View</button>
        <button className="control-btn" onClick={handleZoomFit}>Zoom Fit</button>
        <button
          className="control-btn"
          onClick={handleZoomToSelected}
          disabled={!selectedNodeId}
        >
          Zoom to Selected
        </button>
        <FloorSelector />
      </div>

      {/* Transform Display */}
      {transform && (
        <div className="transform-display">
          <div className="transform-row">
            <span className="transform-value">X:{transform.x}</span>
            <span className="transform-value">Y:{transform.y}</span>
            <span className="transform-value">Z:{transform.z}</span>
          </div>
          <div className="transform-row">
            <span className="transform-value">RX:{transform.rx}°</span>
            <span className="transform-value">RY:{transform.ry}°</span>
            <span className="transform-value">RZ:{transform.rz}°</span>
          </div>
        </div>
      )}

      {/* Floating Panels */}
      {showKinematicsPanel && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '500px',
          height: '600px',
          background: '#1a1a1a',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#252526', borderBottom: '2px solid #646cff' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>Kinematics</h2>
            <button onClick={() => setShowKinematicsPanel(false)} style={{
              background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer',
              width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '4px', transition: 'all 0.15s'
            }}>×</button>
          </div>
          <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
            <KinematicsPanel />
          </div>
        </div>
      )}
      {showActuatorPanel && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '700px',
          background: '#1a1a1a',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#252526', borderBottom: '2px solid #646cff' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>Actuator Control</h2>
            <button onClick={() => setShowActuatorPanel(false)} style={{
              background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer',
              width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '4px', transition: 'all 0.15s'
            }}>×</button>
          </div>
          <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
            <ActuatorControlPanel />
          </div>
        </div>
      )}
      {showDeviceLibrary && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '800px',
          height: '600px',
          background: '#1a1a1a',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#252526', borderBottom: '2px solid #646cff' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>Device Library</h2>
            <button onClick={() => setShowDeviceLibrary(false)} style={{
              background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer',
              width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '4px', transition: 'all 0.15s'
            }}>×</button>
          </div>
          <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
            <DeviceLibrary />
          </div>
        </div>
      )}
      {showPhysicsSettings && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '500px',
          height: '500px',
          background: '#1a1a1a',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#252526', borderBottom: '2px solid #646cff' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>Physics Settings</h2>
            <button onClick={() => setShowPhysicsSettings(false)} style={{
              background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer',
              width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '4px', transition: 'all 0.15s'
            }}>×</button>
          </div>
          <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
            <PhysicsSettings />
          </div>
        </div>
      )}
      {showCollisionVisualizer && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          height: '400px',
          background: '#1a1a1a',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#252526', borderBottom: '2px solid #646cff' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>Collision Visualizer</h2>
            <button onClick={() => setShowCollisionVisualizer(false)} style={{
              background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer',
              width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '4px', transition: 'all 0.15s'
            }}>×</button>
          </div>
          <div style={{ height: 'calc(100% - 60px)', overflow: 'auto' }}>
            <CollisionVisualizer />
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.dae,.gltf,.glb,.dxf,.dwg,.jt,.xml,.zip"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={loadFileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleLoadFileChange}
      />
    </div>
  );
};
