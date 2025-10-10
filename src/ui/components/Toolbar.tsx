// Toolbar component
// Owner: Edwin

console.log('🔧 Toolbar component is loading...');

import { useRef, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorStore } from '../store/editorStore';
import { TransformMode } from '../../core/types';
import { CreateProjectionViewCommand } from '../../history/commands/CreateProjectionViewCommand';
import { toast } from './ToastNotifications';
import { IconButton, IconPaths } from '../icons/IconRegistry';
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
  console.log('🔧 About to get saveComprehensiveWorld from store...');
  const saveComprehensiveWorld = useEditorStore((state) => state.saveComprehensiveWorld);
  // const loadComprehensiveWorld = useEditorStore((state) => state.loadComprehensiveWorld);
  
  // Debug: Check if function exists
  console.log('🔧 saveComprehensiveWorld function:', typeof saveComprehensiveWorld);
  console.log('🔧 saveComprehensiveWorld value:', saveComprehensiveWorld);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const commandManager = useEditorStore((state) => state.commandManager);
  const camera = useEditorStore((state) => state.camera);
  const scene = useEditorStore((state) => state.scene);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const worldLoadInputRef = useRef<HTMLInputElement>(null);

  // Force all toolbar icons to be the same size
  useEffect(() => {
    const enforceIconSizes = () => {
      const toolbar = document.querySelector('.toolbar');
      if (toolbar) {
        const allSvgs = toolbar.querySelectorAll('svg');
        console.log(`🔧 Found ${allSvgs.length} SVG icons in toolbar`);
        
        allSvgs.forEach((svg, index) => {
          const beforeWidth = svg.style.width || svg.getAttribute('width') || 'unknown';
          const beforeHeight = svg.style.height || svg.getAttribute('height') || 'unknown';
          
          // More aggressive styling
          svg.style.setProperty('width', '20px', 'important');
          svg.style.setProperty('height', '20px', 'important');
          svg.style.setProperty('max-width', '20px', 'important');
          svg.style.setProperty('max-height', '20px', 'important');
          svg.style.setProperty('flex-shrink', '0', 'important');
          svg.style.setProperty('transform', 'scale(1)', 'important');
          svg.style.setProperty('box-sizing', 'border-box', 'important');
          
          // Also set attributes
          svg.setAttribute('width', '20');
          svg.setAttribute('height', '20');
          
          console.log(`🔧 Icon ${index}: ${beforeWidth}x${beforeHeight} -> 20px x 20px`);
        });
        
        // Also target any parent containers that might be affecting size
        const iconContainers = toolbar.querySelectorAll('.toolbar-button-icon, .button-group-segmented .toolbar-button-icon');
        iconContainers.forEach(container => {
          container.style.setProperty('min-width', '44px', 'important');
          container.style.setProperty('min-height', '44px', 'important');
          container.style.setProperty('display', 'flex', 'important');
          container.style.setProperty('align-items', 'center', 'important');
          container.style.setProperty('justify-content', 'center', 'important');
        });
      }
    };

    // Run immediately
    enforceIconSizes();

    // Run multiple times with different delays
    const timeouts = [
      setTimeout(enforceIconSizes, 50),
      setTimeout(enforceIconSizes, 100),
      setTimeout(enforceIconSizes, 200),
      setTimeout(enforceIconSizes, 500)
    ];

    // Set up a MutationObserver to catch any new icons
    const observer = new MutationObserver(() => {
      console.log('🔧 DOM mutation detected, re-enforcing icon sizes');
      enforceIconSizes();
    });
    
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      observer.observe(toolbar, { 
        childList: true, 
        subtree: true, 
        attributes: true,
        attributeFilter: ['style', 'width', 'height']
      });
    }

    return () => {
      timeouts.forEach(clearTimeout);
      observer.disconnect();
    };
  }, []);

  const modes: {
    mode: TransformMode;
    label: string;
    key: string;
    iconPath: string;
  }[] = [
    { mode: 'translate', label: 'Move', key: 'G', iconPath: IconPaths.MOVE },
    {
      mode: 'rotate',
      label: 'Rotate',
      key: 'R',
      iconPath: IconPaths.ROTATE,
    },
    { mode: 'scale', label: 'Scale', key: 'S', iconPath: IconPaths.SCALE },
  ];

  const handleImportClick = async () => {
    // Try to use File System Access API if available for better directory tracking
    if ('showOpenFilePicker' in window) {
      try {
        console.log('[File Import] Attempting to use File System Access API...');
        console.log('[File Import] Browser supports showOpenFilePicker:', !!('showOpenFilePicker' in window));
        
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: '3D Model Files',
              accept: {
                'model/gltf-binary': ['.glb'],
                'model/gltf+json': ['.gltf'],
                'model/obj': ['.obj'],
                'model/stl': ['.stl'],
                'application/dxf': ['.dxf'],
                'application/jt': ['.jt'],
                'application/xml': ['.urdf'],
                'model/babylon': ['.babylon'],
                'application/zip': ['.zip']
              }
            }
          ],
          excludeAcceptAllOption: true
        });
        
        const file = await fileHandle.getFile();
        console.log(`[File Import] Selected file via File System Access API: ${file.name}`);
        await importModel(file, fileHandle);
        return;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[File Import] User cancelled file selection');
          return;
        }
        console.warn('[File Import] File System Access API failed, falling back to regular input:', error);
        console.log('[File Import] Error details:', error.message, error.name);
      }
    } else {
      console.log('[File Import] File System Access API not available, using regular input');
    }
    
    // Fallback to regular file input
    console.log('[File Import] Using regular file input fallback');
    fileInputRef.current?.click();
  };

  const handleImportFolderClick = () => {
    folderInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log(`[File Selection] Selected file: ${file.name}`);
      console.log(`[File Selection] webkitRelativePath: ${file.webkitRelativePath || 'not available'}`);
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

  const handleCreateProjectionView = () => {
    console.log('Selected node IDs:', selectedNodeIds, 'Count:', selectedNodeIds.length);

    // Need at least 1 object selected
    if (selectedNodeIds.length === 0) {
      toast.warning('Please select an object to project');
      return;
    }

    const { SceneTreeManager } = require('../../scene/SceneTreeManager');
    const { SceneManager } = require('../../scene/SceneManager');
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
        toast.error('Selected node not found');
        return;
      }

      sourceMesh = node.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node.babylonMeshId)) : null;
      targetMesh = scene.getMeshByName('ground');

      if (!sourceMesh) {
        toast.error('Please select a mesh object');
        return;
      }

      if (!targetMesh) {
        toast.error('Ground plane not found');
        return;
      }
    } else if (selectedNodeIds.length === 2) {
      // Two selections: project first onto second
      const node1 = tree.getNode(selectedNodeIds[0]);
      const node2 = tree.getNode(selectedNodeIds[1]);

      if (!node1 || !node2) {
        toast.error('Selected nodes not found');
        return;
      }

      sourceMesh = node1.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node1.babylonMeshId)) : null;
      targetMesh = node2.babylonMeshId ? scene.getMeshByUniqueId(parseInt(node2.babylonMeshId)) : null;

      if (!sourceMesh || !targetMesh) {
        toast.error('Please select 2 mesh objects');
        return;
      }
    } else {
      // Multiple selections: project all onto ground
      targetMesh = scene.getMeshByName('ground');
      if (!targetMesh) {
        toast.error('Ground plane not found');
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

    // Create projection view command
    try {
      const command = new CreateProjectionViewCommand(
        sourceMesh.name,
        targetMesh.name,
        'auto'
      );
      commandManager.execute(command);
      toast.success('Projection created!');
    } catch (error) {
      console.error('Failed to create projection view:', error);
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Viewport Controls
  const handleZoomToSelected = () => {
    if (!camera || !scene || selectedNodeIds.length === 0) {
      toast.warning('Please select an object first');
      return;
    }

    try {
      // Get bounding box of selected objects
      let min = new BABYLON.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
      let max = new BABYLON.Vector3(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);

      selectedNodeIds.forEach(nodeId => {
        const mesh = scene.getMeshById(nodeId);
        if (mesh) {
          const boundingInfo = mesh.getBoundingInfo();
          const meshMin = boundingInfo.minimum;
          const meshMax = boundingInfo.maximum;
          
          min = BABYLON.Vector3.Minimize(min, meshMin);
          max = BABYLON.Vector3.Maximize(max, meshMax);
        }
      });

      const center = BABYLON.Vector3.Center(min, max);
      const size = max.subtract(min);
      const distance = Math.max(size.x, size.y, size.z) * 2;

      if (camera instanceof BABYLON.ArcRotateCamera) {
        camera.setTarget(center);
        camera.radius = distance;
        camera.setPosition(center.add(new BABYLON.Vector3(distance, distance, distance)));
      }

      toast.success(`Zoomed to ${selectedNodeIds.length} selected object(s)`);
    } catch (error) {
      console.error('Failed to zoom to selected:', error);
      toast.error('Failed to zoom to selected objects');
    }
  };

  const handleZoomFit = () => {
    if (!camera || !scene) {
      toast.warning('Scene not ready');
      return;
    }

    try {
      const meshes = scene.meshes.filter(mesh => 
        mesh.isVisible && 
        !mesh.isDisposed() && 
        mesh.name !== '__root__' &&
        !mesh.name.startsWith('__')
      );

      if (meshes.length === 0) {
        toast.warning('No objects to fit');
        return;
      }

      // Calculate bounding box of all visible objects
      let min = new BABYLON.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
      let max = new BABYLON.Vector3(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);

      meshes.forEach(mesh => {
        const boundingInfo = mesh.getBoundingInfo();
        const meshMin = boundingInfo.minimum;
        const meshMax = boundingInfo.maximum;
        
        min = BABYLON.Vector3.Minimize(min, meshMin);
        max = BABYLON.Vector3.Maximize(max, meshMax);
      });

      const center = BABYLON.Vector3.Center(min, max);
      const size = max.subtract(min);
      const distance = Math.max(size.x, size.y, size.z) * 2.5; // Slightly more padding

      if (camera instanceof BABYLON.ArcRotateCamera) {
        camera.setTarget(center);
        camera.radius = distance;
        camera.setPosition(center.add(new BABYLON.Vector3(distance, distance, distance)));
      }

      toast.success(`Fitted view to ${meshes.length} objects`);
    } catch (error) {
      console.error('Failed to fit view:', error);
      toast.error('Failed to fit view');
    }
  };

  const handleResetView = () => {
    if (!camera) {
      toast.warning('Camera not ready');
      return;
    }

    try {
      if (camera instanceof BABYLON.ArcRotateCamera) {
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.alpha = -Math.PI / 4;
        camera.beta = Math.PI / 3;
        camera.radius = 10;
      }

      toast.success('View reset to default');
    } catch (error) {
      console.error('Failed to reset view:', error);
      toast.error('Failed to reset view');
    }
  };

  return (
    <div className="toolbar">
      {/* Transform Tools - Segmented Button Group */}
      <div className="toolbar-section transform-section">
        <h3>Transform</h3>
        <div className="button-group-segmented">
          {modes.map(({ mode, label, key, iconPath }) => (
            <IconButton
              key={mode}
              iconPath={iconPath}
              label={label}
              shortcut={key}
              active={transformMode === mode}
              onClick={() => setTransformMode(mode)}
              config={{ size: 'md' }}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Object Creation */}
      <div className="toolbar-section">
        <h3>Objects</h3>
        <div className="button-group">
          <IconButton
            iconPath={IconPaths.BOX}
            label="Box"
            onClick={() => createObject('box')}
            config={{ size: 'md' }}
          />
          <IconButton
            iconPath={IconPaths.SPHERE}
            label="Sphere"
            onClick={() => createObject('sphere')}
            config={{ size: 'md' }}
          />
          <IconButton
            iconPath={IconPaths.CYLINDER}
            label="Cylinder"
            onClick={() => createObject('cylinder')}
            config={{ size: 'md' }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Import */}
      <div className="toolbar-section">
        <h3>Import</h3>
        <div className="button-group">
          <IconButton
            iconPath={IconPaths.IMPORT}
            label="Load File"
            onClick={handleImportClick}
            config={{ size: 'md' }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".gltf,.glb,.obj,.stl,.babylon,.dxf,.dwg,.jt,.catpart,.catproduct,.catdrawing,.catprocess,.urdf,.zip"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <IconButton
            iconPath={IconPaths.LOAD}
            label="Load Folder"
            onClick={handleImportFolderClick}
            config={{ size: 'md' }}
          />
          <input
            ref={folderInputRef}
            type="file"
            /* @ts-expect-error - webkitdirectory is not in TS types */
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
          <IconButton
            iconPath="tool.package"
            label="Collection"
            onClick={() => createCollection()}
            config={{ size: 'md' }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* World */}
      <div className="toolbar-section">
        <h3>World</h3>
        <div className="button-group">
          <IconButton
            iconPath={IconPaths.SAVE}
            label="Save"
            onClick={saveWorld}
            config={{ size: 'md' }}
          />
          <IconButton
            iconPath={IconPaths.SAVE}
            label="SAVE FULL"
            onClick={() => {
              console.log('SAVE FULL button clicked!');
              try {
                saveComprehensiveWorld();
              } catch (error) {
                console.error('Error calling saveComprehensiveWorld:', error);
              }
            }}
            variant="primary"
            config={{ size: 'md' }}
          />
          <IconButton
            iconPath={IconPaths.LOAD}
            label="Load"
            onClick={handleLoadWorldClick}
            config={{ size: 'md' }}
          />
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

      {/* Projection View */}
      <div className="toolbar-section">
        <h3>Views</h3>
        <div className="button-group">
          <IconButton
            iconPath="view.projection"
            label="Project"
            onClick={handleCreateProjectionView}
            disabled={selectedNodeIds.length === 0}
            config={{ size: 'md' }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Views */}
      <div className="toolbar-section">
        <h3>Views</h3>
        <div className="button-group">
          <IconButton
            iconPath={IconPaths.ZOOM_TO_SELECTED}
            label="Zoom to Selected"
            onClick={handleZoomToSelected}
            config={{ size: 'md' }}
          />
          <IconButton
            iconPath={IconPaths.ZOOM_FIT}
            label="Zoom Fit"
            onClick={handleZoomFit}
            config={{ size: 'md' }}
          />
          <IconButton
            iconPath={IconPaths.RESET_VIEW}
            label="Reset View"
            onClick={handleResetView}
            config={{ size: 'md' }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="toolbar-divider" />

      {/* Kinematics */}
      <div className="toolbar-section">
        <h3>Kinematics</h3>
        <div className="button-group">
          <IconButton
            iconPath={IconPaths.KINEMATICS_SETUP}
            label="Setup"
            onClick={onOpenKinematics}
            config={{ size: 'md' }}
          />
        </div>
      </div>
    </div>
  );
};
