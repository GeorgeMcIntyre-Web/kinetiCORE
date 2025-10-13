// Toolbar component
// Owner: Edwin

console.log('🔧 Toolbar component is loading...');

import { useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { TransformMode } from '../../core/types';
import { CreateProjectionViewCommand } from '../../history/commands/CreateProjectionViewCommand';
import { toast } from './ToastNotifications';
import { IconButton, IconPaths } from '../icons/IconRegistry';
import { ButtonTemplate } from './buttons/ButtonTemplate';
import './Toolbar.css';

interface ToolbarProps {
  onOpenKinematics?: () => void;
  onOpenDeviceLibrary?: () => void;
  onOpenActuatorControl?: () => void;
  onOpenPhysicsSettings?: () => void;
  onToggleCollisionVisualizer?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ 
  onOpenKinematics,
  onOpenDeviceLibrary,
  onOpenActuatorControl,
  onOpenPhysicsSettings,
  onToggleCollisionVisualizer
}) => {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const worldLoadInputRef = useRef<HTMLInputElement>(null);

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
                'application/xml': ['.urdf', '.xml'],
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

  return (
    <div className="toolbar">
      {/* Transform Tools - Segmented Button Group */}
      <div className="toolbar-section">
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

      {/* Device Management */}
      <div className="toolbar-section">
        <h3>Devices</h3>
        <div className="button-group">
          <ButtonTemplate
            id="toolbar_device_library"
            label="Library"
            icon="book-open"
            action="Open device library"
            stateKey="deviceLibraryOpen"
            initialState={false}
            stateType="boolean"
            variant="ghost"
            size="md"
            ariaLabel="Open device library"
            callback={() => onOpenDeviceLibrary?.()}
          />
          <ButtonTemplate
            id="toolbar_actuator_control"
            label="Actuators"
            icon="gamepad-2"
            action="Open actuator control panel"
            stateKey="actuatorControlOpen"
            initialState={false}
            stateType="boolean"
            variant="ghost"
            size="md"
            ariaLabel="Open actuator control panel"
            callback={() => onOpenActuatorControl?.()}
          />
        </div>
      </div>

      {/* Physics & Collision */}
      <div className="toolbar-section">
        <h3>Physics</h3>
        <div className="button-group">
          <ButtonTemplate
            id="toolbar_physics_settings"
            label="Settings"
            icon="settings"
            action="Open physics settings"
            stateKey="physicsSettingsOpen"
            initialState={false}
            stateType="boolean"
            variant="ghost"
            size="md"
            ariaLabel="Open physics settings"
            callback={() => onOpenPhysicsSettings?.()}
          />
          <ButtonTemplate
            id="toolbar_collision_viz"
            label="Collisions"
            icon="zap"
            action="Toggle collision visualizer"
            stateKey="collisionVisualizerEnabled"
            initialState={false}
            stateType="boolean"
            variant="ghost"
            size="md"
            ariaLabel="Toggle collision visualizer"
            callback={() => onToggleCollisionVisualizer?.()}
          />
        </div>
      </div>
    </div>
  );
};
