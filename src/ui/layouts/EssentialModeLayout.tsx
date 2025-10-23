// Essential Mode Layout - Beginner-friendly interface
// Owner: George (Architecture)

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Header } from '../components/Header';
import { useUserLevel } from '../core/UserLevelContext';
import { useEditorStore } from '../store/editorStore';
import { useAssetLibraryStore } from '../store/assetLibraryStore';
import { SceneTree } from '../components/SceneTree';
import { SceneCanvas } from '../components/SceneCanvas';
import { FloatingKinematicsPanel } from '../components/FloatingKinematicsPanel';
import { FloatingKinematicsAnalysisPanel } from '../components/FloatingKinematicsAnalysisPanel';
import { FloatingActuatorPanel } from '../components/FloatingActuatorPanel';
import { WholeBodyIKPanel } from '../components/WholeBodyIKPanel';
import { FloatingPhysicsPanel } from '../components/FloatingPhysicsPanel';
import { FloatingCollisionPanel } from '../components/FloatingCollisionPanel';
import { FloatingSettingsPanel } from '../components/FloatingSettingsPanel';
import { MoveObjectDialog } from '../components/MoveObjectDialog';
import { ProjectManagerPanelV2 } from '../components/ProjectManager/ProjectManagerPanelV2';
import { ProjectSaveDialog } from '../components/ProjectSaveDialog';
import { useProjectManagerStore } from '../store/projectManagerStore';
import { SceneManager } from '../../scene/SceneManager';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { babylonToUser } from '../../core/CoordinateSystem';
import { CreateProjectionViewCommand } from '../../history/commands/CreateProjectionViewCommand';
import { toast } from '../components/ToastNotifications';
import { useTreeAutoResize } from '../hooks/useTreeAutoResize';
import './EssentialModeLayout.css';

export const EssentialModeLayout: React.FC = () => {
  const { userLevel, setUserLevel } = useUserLevel();
  const importModel = useEditorStore((state) => state.importModel);
  const loadWorld = useEditorStore((state) => state.loadWorld);
  const loadComprehensiveWorld = useEditorStore((state) => state.loadComprehensiveWorld);
  const zoomFit = useEditorStore((state) => state.zoomFit);
  const zoomToNode = useEditorStore((state) => state.zoomToNode);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const commandManager = useEditorStore((state) => state.commandManager);
  const toggleLibrary = useAssetLibraryStore((state) => state.toggleVisibility);
  const showProjectManager = useProjectManagerStore((state) => state.show);

  // Project Management
  const saveProject = useEditorStore((state) => state.saveProject);
  const currentProject = useEditorStore((state) => state.currentProject);

  const [transform, setTransform] = useState<{
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    rz: number;
  } | null>(null);

  const [showKinematicsPanel, setShowKinematicsPanel] = useState(false);
  const [showKinematicsAnalysisPanel, setShowKinematicsAnalysisPanel] = useState(false);
  const [showActuatorPanel, setShowActuatorPanel] = useState(false);
  const [showWholeBodyIKPanel, setShowWholeBodyIKPanel] = useState(false);
  const [showPhysicsSettings, setShowPhysicsSettings] = useState(false);
  const [showCollisionVisualizer, setShowCollisionVisualizer] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  // Resizable sidebar state
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default 256px (w-64)
  const [isResizing, setIsResizing] = useState(false);
  const minSidebarWidth = 200; // Minimum width in pixels
  const maxSidebarWidth = 600; // Maximum width in pixels

  // Auto-resize hook for optimal tree width
  const { optimalWidth } = useTreeAutoResize({
    minWidth: minSidebarWidth,
    maxWidth: maxSidebarWidth,
    padding: 16,
    fontSize: 13,
    iconWidth: 16,
    arrowWidth: 14,
    badgeWidth: 40
  });

  // Update sidebar width when optimal width changes
  useEffect(() => {
    if (!isResizing && optimalWidth > sidebarWidth) {
      console.log(`🔄 Auto-expanding sidebar from ${sidebarWidth}px to ${optimalWidth}px`);
      setSidebarWidth(optimalWidth);
    }
  }, [optimalWidth, isResizing, sidebarWidth]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadFileInputRef = useRef<HTMLInputElement>(null);


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

  // Camera view handlers
  const handleTopView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = 0;
      camera.beta = 0;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleRightView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = Math.PI / 2;
      camera.beta = Math.PI / 2;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleFrontView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = 0;
      camera.beta = Math.PI / 2;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  const handleIsoView = () => {
    const sceneManager = SceneManager.getInstance();
    const camera = sceneManager.getCamera();
    if (camera) {
      camera.alpha = -Math.PI / 4;
      camera.beta = Math.PI / 3;
      camera.target = BABYLON.Vector3.Zero();
    }
  };

  // Project Management Handlers


  const handleSaveProjectConfirm = async (config: {
    name: string;
    description?: string;
    isAutoSave?: boolean;
    includeComments?: boolean;
    includeAnnotations?: boolean;
  }) => {
    try {
      await saveProject(config);
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Failed to save project:', error);
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

  // Sidebar resize handlers
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      // Prevent reducing width below optimal width, but allow increasing
      const effectiveMinWidth = Math.max(minSidebarWidth, optimalWidth);
      
      if (newWidth >= effectiveMinWidth && newWidth <= maxSidebarWidth) {
        setSidebarWidth(newWidth);
      }
    },
    [isResizing, minSidebarWidth, maxSidebarWidth, optimalWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

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
      {/* Header with integrated Ribbon */}
        <Header
          currentMode={userLevel as 'essential' | 'professional' | 'expert'}
          onModeChange={(mode) => setUserLevel(mode)}
          onSettingsClick={() => setShowSettingsPanel(!showSettingsPanel)}
          onHelpClick={() => toast.info('Help documentation coming soon')}
          className="fixed top-0 left-0 right-0 z-50"
          style={{ zIndex: 100 }}
          ribbonProps={{
            onKinematicsClick: () => setShowKinematicsPanel(!showKinematicsPanel),
            onKinematicsAnalysisClick: () => setShowKinematicsAnalysisPanel(!showKinematicsAnalysisPanel),
            onActuatorsClick: () => setShowActuatorPanel(!showActuatorPanel),
            onWholeBodyIKClick: () => setShowWholeBodyIKPanel(!showWholeBodyIKPanel),
            onPhysicsClick: () => setShowPhysicsSettings(!showPhysicsSettings),
            onCollisionsClick: () => setShowCollisionVisualizer(!showCollisionVisualizer),
            onProjectionClick: handleCreateProjectionView,
            onProjectManagerClick: showProjectManager,
            onAssetLibraryClick: toggleLibrary,
            onQuickMoveClick: () => setShowMoveDialog(true),
            onResetViewClick: handleResetView,
            onZoomFitClick: handleZoomFit,
            onZoomToSelectedClick: handleZoomToSelected,
            onTopViewClick: handleTopView,
            onRightViewClick: handleRightView,
            onFrontViewClick: handleFrontView,
            onIsoViewClick: handleIsoView,
          }}
        />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden" style={{ paddingTop: '80px' }}>
        {/* Left Sidebar - Resizable */}
        <aside
          className="border-r border-gray-200 bg-white flex-shrink-0 flex flex-col min-h-0 relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          <SceneTree />

          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-blue-500 transition-colors z-50"
            style={{
              background: isResizing ? 'rgb(59, 130, 246)' : 'transparent',
            }}
          />
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 relative bg-gray-100">
          <div id="viewport-essential" className="w-full h-full">
            <SceneCanvas />
          </div>
        </main>
      </div>

      {/* Hidden file inputs for ribbon buttons */}
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

      {/* Floating Panels */}
      <FloatingKinematicsPanel
        isVisible={showKinematicsPanel}
        onClose={() => setShowKinematicsPanel(false)}
        zIndex={1001}
      />

      <FloatingKinematicsAnalysisPanel
        isVisible={showKinematicsAnalysisPanel}
        onClose={() => setShowKinematicsAnalysisPanel(false)}
        zIndex={1002}
      />

      <FloatingActuatorPanel
        isVisible={showActuatorPanel}
        onClose={() => setShowActuatorPanel(false)}
        zIndex={1003}
      />

      <WholeBodyIKPanel
        isVisible={showWholeBodyIKPanel}
        onClose={() => setShowWholeBodyIKPanel(false)}
        zIndex={1004}
      />

      <FloatingPhysicsPanel
        isVisible={showPhysicsSettings}
        onClose={() => setShowPhysicsSettings(false)}
        zIndex={1005}
      />

      <FloatingCollisionPanel
        isVisible={showCollisionVisualizer}
        onClose={() => setShowCollisionVisualizer(false)}
        zIndex={1006}
      />

      <FloatingSettingsPanel
        isVisible={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        zIndex={1007}
      />

      {/* Transform Display - Bottom-right corner */}
      {transform && (
        <div
          className="fixed bottom-1 right-1 z-40"
          style={{
            background: 'transparent',
            color: '#ffffff',
            textShadow: '0 0 2px rgba(0, 0, 0, 0.9)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace',
            fontSize: '13px',
            fontWeight: '400',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            minWidth: '280px',
            transform: 'scale(0.6)',
            transformOrigin: 'bottom right',
          }}
        >
          <div className="flex justify-between text-sm">
            <div className="flex space-x-1" style={{ minWidth: '80px' }}>
              <span style={{ color: '#4A90E2', fontWeight: '500' }}>X:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.x.toFixed(1)}</span>
            </div>
            <div className="flex space-x-1" style={{ minWidth: '80px' }}>
              <span style={{ color: '#7ED321', fontWeight: '500' }}>Y:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.y.toFixed(1)}</span>
            </div>
            <div className="flex space-x-1" style={{ minWidth: '80px' }}>
              <span style={{ color: '#D0021B', fontWeight: '500' }}>Z:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.z.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <div className="flex space-x-1" style={{ minWidth: '80px' }}>
              <span style={{ color: '#4A90E2', fontWeight: '500' }}>RX:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.rx.toFixed(1)}°</span>
            </div>
            <div className="flex space-x-1" style={{ minWidth: '80px' }}>
              <span style={{ color: '#7ED321', fontWeight: '500' }}>RY:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.ry.toFixed(1)}°</span>
            </div>
            <div className="flex space-x-1" style={{ minWidth: '80px' }}>
              <span style={{ color: '#D0021B', fontWeight: '500' }}>RZ:</span>
              <span style={{ color: '#ffffff', fontWeight: '600', textAlign: 'right', minWidth: '60px', display: 'inline-block' }}>{transform.rz.toFixed(1)}°</span>
            </div>
          </div>
        </div>
      )}

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

      {/* Project Save Dialog */}
      {showSaveDialog && currentProject && (
        <ProjectSaveDialog
          project={currentProject}
          onClose={() => setShowSaveDialog(false)}
          onSave={handleSaveProjectConfirm}
        />
      )}

      {/* Move Object Dialog */}
      <MoveObjectDialog 
        isOpen={showMoveDialog} 
        onClose={() => setShowMoveDialog(false)} 
      />

      {/* Project Manager Panel */}
      <ProjectManagerPanelV2 />
    </div>
  );
};
