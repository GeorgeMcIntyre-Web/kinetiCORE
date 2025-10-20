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
  Layers,
  Library,
  Cog,
  Settings,
  Plus,
  RotateCcw,
  Maximize2,
  Target,
} from 'lucide-react';
import { ToolbarDropdown } from '../components/ToolbarDropdown';
import { Header } from '../components/Header';
import { FloatingPanel } from '../components/FloatingPanel';
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
import { zIndex } from '../styles/design-tokens';
import './EssentialModeLayout.css';

export const EssentialModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const createObject = useEditorStore((state) => state.createObject);
  const importModel = useEditorStore((state) => state.importModel);
  const loadWorld = useEditorStore((state) => state.loadWorld);
  const loadComprehensiveWorld = useEditorStore((state) => state.loadComprehensiveWorld);
  const saveComprehensiveWorld = useEditorStore((state) => state.saveComprehensiveWorld);
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log(`[File Selection] ========================================`);
    console.log(`[File Selection] Selected ${files.length} file(s):`);

    // Log all selected files first
    for (let i = 0; i < files.length; i++) {
      console.log(`[File Selection]   ${i + 1}. ${files[i].name} (${(files[i].size / 1024).toFixed(2)} KB)`);
    }

    // Separate files into model files (.zip, .xml, .urdf, .usd, etc.) and mesh files (.stl, .obj, .dae)
    const modelFiles: File[] = [];
    const meshFiles: File[] = [];

    Array.from(files).forEach(f => {
      const ext = f.name.toLowerCase();
      if (ext.endsWith('.xml') || ext.endsWith('.urdf') || ext.endsWith('.gltf') ||
          ext.endsWith('.glb') || ext.endsWith('.obj') || ext.endsWith('.stl') ||
          ext.endsWith('.jt') || ext.endsWith('.dwg') || ext.endsWith('.dxf') ||
          ext.endsWith('.usd') || ext.endsWith('.usdz') || ext.endsWith('.zip')) {
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
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Header */}
      <Header
        currentMode={userLevel as 'essential' | 'professional' | 'expert'}
        onModeChange={(mode) => setUserLevel(mode)}
        onSettingsClick={() => toast.info('Settings panel coming soon')}
        onHelpClick={() => toast.info('Help documentation coming soon')}
        className="fixed top-0 left-0 right-0 z-50"
      />

      {/* Main Content */}
      <div className="flex flex-1 pt-16 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-gray-200 bg-white flex-shrink-0 flex flex-col min-h-0">
          <SceneTree />
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 relative bg-gray-100">
          <div id="viewport-essential" className="w-full h-full"></div>
        </main>
      </div>

      {/* Floating Toolbar */}
      <div
        className="fixed top-20 left-72 flex items-center space-x-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-40"
        style={{ zIndex: zIndex.toolbar }}
      >
        {/* Create Shapes Dropdown */}
        <ToolbarDropdown
          label="Create"
          icon={<Plus size={16} />}
          items={[
            { id: 'box', label: 'Box', icon: <Box size={16} />, onClick: () => createObject('box') },
            { id: 'sphere', label: 'Sphere', icon: <Circle size={16} />, onClick: () => createObject('sphere') },
            { id: 'cylinder', label: 'Cylinder', icon: <Cylinder size={16} />, onClick: () => createObject('cylinder') },
          ]}
        />

        <div className="w-px h-6 bg-gray-300" />

        {/* Import Button */}
        <button
          className="flex items-center space-x-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors duration-200 text-sm"
          onClick={handleFileImport}
          title="Import MJCF, URDF, STL, GLB, USD"
        >
          <Upload size={14} />
          <span>Import</span>
        </button>

        <div className="w-px h-6 bg-gray-300" />

        {/* Robot Tools Dropdown */}
        <ToolbarDropdown
          label="Robot"
          icon={<Cog size={16} />}
          items={[
            { id: 'kinematics', label: 'Kinematics Panel', icon: <Cog size={16} />, onClick: () => setShowKinematicsPanel(!showKinematicsPanel) },
            { id: 'devices', label: 'Device Library', icon: <Library size={16} />, onClick: () => setShowDeviceLibrary(!showDeviceLibrary) },
            { id: 'actuators', label: 'Actuator Control', icon: <Settings size={16} />, onClick: () => setShowActuatorPanel(!showActuatorPanel) },
          ]}
        />

        <div className="w-px h-6 bg-gray-300" />

        {/* Tools Dropdown */}
        <ToolbarDropdown
          label="Tools"
          icon={<Layers size={16} />}
          items={[
            { id: 'projection', label: 'Projection View', icon: <Layers size={16} />, onClick: handleCreateProjectionView, disabled: selectedNodeIds.length === 0 },
            { id: 'physics', label: 'Physics Settings', icon: <Settings size={16} />, onClick: () => setShowPhysicsSettings(!showPhysicsSettings) },
            { id: 'collision', label: 'Collision Viz', icon: <Circle size={16} />, onClick: () => setShowCollisionVisualizer(!showCollisionVisualizer) },
            { id: 'library', label: 'Asset Library', icon: <Library size={16} />, onClick: toggleLibrary },
          ]}
        />

        <div className="w-px h-6 bg-gray-300" />

        {/* Save Button */}
        <button
          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
          onClick={saveComprehensiveWorld}
          title="Save World"
        >
          <Save size={16} />
        </button>
      </div>

      {/* Viewport Controls */}
      <div className="fixed top-32 right-4 flex flex-col z-40" style={{ gap: '2px' }}>
        <button
          onClick={handleResetView}
          title="Reset View"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            width: '32px',
            height: '32px',
          }}
        >
          <RotateCcw size={16} style={{ color: '#374151' }} />
        </button>
        <button
          onClick={handleZoomFit}
          title="Zoom Fit"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            width: '32px',
            height: '32px',
          }}
        >
          <Maximize2 size={16} style={{ color: '#374151' }} />
        </button>
        <button
          onClick={handleZoomToSelected}
          disabled={!selectedNodeId}
          title="Zoom to Selected"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: selectedNodeId ? 'pointer' : 'not-allowed',
            opacity: selectedNodeId ? 1 : 0.5,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            width: '32px',
            height: '32px',
          }}
        >
          <Target size={16} style={{ color: '#374151' }} />
        </button>
        <FloorSelector />
      </div>

      {/* Transform Display */}
      {transform && (
        <div className="fixed bottom-20 left-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-40">
          <div className="flex space-x-4 text-sm">
            <div className="flex space-x-2">
              <span className="text-gray-500">X:</span>
              <span className="font-mono">{transform.x}</span>
            </div>
            <div className="flex space-x-2">
              <span className="text-gray-500">Y:</span>
              <span className="font-mono">{transform.y}</span>
            </div>
            <div className="flex space-x-2">
              <span className="text-gray-500">Z:</span>
              <span className="font-mono">{transform.z}</span>
            </div>
          </div>
          <div className="flex space-x-4 text-sm mt-1">
            <div className="flex space-x-2">
              <span className="text-gray-500">RX:</span>
              <span className="font-mono">{transform.rx}°</span>
            </div>
            <div className="flex space-x-2">
              <span className="text-gray-500">RY:</span>
              <span className="font-mono">{transform.ry}°</span>
            </div>
            <div className="flex space-x-2">
              <span className="text-gray-500">RZ:</span>
              <span className="font-mono">{transform.rz}°</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Panels */}
      <FloatingPanel
        isOpen={showKinematicsPanel}
        onClose={() => setShowKinematicsPanel(false)}
        title="Kinematics Panel"
        size="md"
        position="center"
        draggable={true}
        resizable={false}
        zIndex={zIndex.modal}
      >
        <KinematicsPanel />
      </FloatingPanel>

      <FloatingPanel
        isOpen={showActuatorPanel}
        onClose={() => setShowActuatorPanel(false)}
        title="Actuator Control Panel"
        size="lg"
        position="center"
        draggable={true}
        resizable={false}
        zIndex={zIndex.modal}
      >
        <ActuatorControlPanel />
      </FloatingPanel>

      <FloatingPanel
        isOpen={showDeviceLibrary}
        onClose={() => setShowDeviceLibrary(false)}
        title="Device Library"
        size="xl"
        position="center"
        draggable={true}
        resizable={false}
        zIndex={zIndex.modal}
      >
        <DeviceLibrary />
      </FloatingPanel>

      <FloatingPanel
        isOpen={showPhysicsSettings}
        onClose={() => setShowPhysicsSettings(false)}
        title="Physics Settings"
        size="md"
        position="center"
        draggable={true}
        resizable={false}
        zIndex={zIndex.modal}
      >
        <PhysicsSettings />
      </FloatingPanel>

      <FloatingPanel
        isOpen={showCollisionVisualizer}
        onClose={() => setShowCollisionVisualizer(false)}
        title="Collision Visualizer"
        size="sm"
        position="center"
        draggable={true}
        resizable={false}
        zIndex={zIndex.modal}
      >
        <CollisionVisualizer />
      </FloatingPanel>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".urdf,.stl,.obj,.dae,.gltf,.glb,.dxf,.dwg,.jt,.xml,.usd,.usdz,.zip"
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
