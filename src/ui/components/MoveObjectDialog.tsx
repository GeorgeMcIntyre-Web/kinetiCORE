// MoveObjectDialog - Quick move/rotate dialog with Apply button
// Owner: George (Architecture)

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Move, GripVertical } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneManager } from '../../scene/SceneManager';
import { babylonToUser } from '../../core/CoordinateSystem';
import { XNumericInput, YNumericInput, ZNumericInput } from './NumericInput';
import { TransformCommand } from '../../history/commands/TransformCommand';
import * as BABYLON from '@babylonjs/core';
import './MoveObjectDialog.css';

// Constants
const RAD_TO_DEG = 180 / Math.PI;

interface MoveObjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MoveObjectDialog: React.FC<MoveObjectDialogProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogPosition, setDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const commandManager = useEditorStore((state) => state.commandManager);
  const updateNodePosition = useEditorStore((state) => state.updateNodePosition);
  const updateNodeRotation = useEditorStore((state) => state.updateNodeRotation);
  const positionIncrement = useEditorStore((state) => state.positionIncrement);
  const rotationIncrement = useEditorStore((state) => state.rotationIncrement);

  // Editable state values - these are what the user can type into
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });

  // Track if ANY input has focus OR if we're applying (to prevent value overwrites)
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isApplyingRef = useRef(false);
  
  // Track if user has manually edited values (prevents gizmo from overwriting typed values)
  const [hasUserEdited, setHasUserEdited] = useState(false);
  
  // Coordinate system toggle: true = world, false = local
  const [useWorldCoordinates, setUseWorldCoordinates] = useState(true);

  // Helper function to read current transform from Babylon (always reads, no blocking)
  const readCurrentTransformUnsafe = useCallback(() => {
    if (!selectedNodeId) return;

    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const node = tree.getNode(selectedNodeId);

    if (!node || !scene) {
      console.log('❌ No node or scene found');
      return;
    }

    console.log('🔍 Reading transform for node:', node.name, 'type:', node.type);
    console.log('   babylonMeshId:', node.babylonMeshId);
    console.log('   babylonTransformNodeId:', node.babylonTransformNodeId);

    // Get Babylon node
    let babylonNode: BABYLON.TransformNode | null = null;
    
    if (node.babylonMeshId) {
      // Try to find mesh by unique ID
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
      console.log('   Found mesh by babylonMeshId:', babylonNode?.name);
    } 
    
    if (!babylonNode && node.babylonTransformNodeId) {
      // Try to find transform node by unique ID
      babylonNode = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId));
      console.log('   Found transform node by babylonTransformNodeId:', babylonNode?.name);
    }
    
    if (!babylonNode && node.type === 'collection') {
      // Fallback: try to find by name
      babylonNode = scene.transformNodes.find((tn) => tn.name === node.name) || null;
      console.log('   Found transform node by name:', babylonNode?.name);
    }

    if (!babylonNode) {
      console.log('❌ No Babylon node found for:', node.name);
      console.log('   Available transform nodes:', scene.transformNodes.map(tn => tn.name));
      console.log('   Available meshes:', scene.meshes.map(m => m.name));
      return;
    }

    console.log('✅ Found Babylon node:', babylonNode.name);

    let pos: { x: number; y: number; z: number };
    let rot: { x: number; y: number; z: number };

    if (useWorldCoordinates) {
      // Get WORLD position - use babylonToUser for Z-up CAD standard
      const worldPos = babylonNode.getAbsolutePosition();
      pos = babylonToUser(worldPos);

      // Get WORLD rotation to match world position
      // Extract rotation from world matrix
      babylonNode.computeWorldMatrix(true);
      const worldMatrix = babylonNode.getWorldMatrix();
      const worldRotationQuat = new BABYLON.Quaternion();
      worldMatrix.decompose(undefined, worldRotationQuat, undefined);

      // Convert world quaternion to Euler angles
      const worldEuler = worldRotationQuat.toEulerAngles();
      rot = {
        x: worldEuler.x * RAD_TO_DEG,
        y: worldEuler.y * RAD_TO_DEG,
        z: worldEuler.z * RAD_TO_DEG,
      };
    } else {
      // Get LOCAL position - use babylonToUser for Z-up CAD standard
      pos = babylonToUser(babylonNode.position);

      // Get LOCAL rotation
      let localEuler: BABYLON.Vector3;
      if (babylonNode.rotationQuaternion) {
        localEuler = babylonNode.rotationQuaternion.toEulerAngles();
      } else {
        localEuler = babylonNode.rotation;
      }
      
      rot = {
        x: localEuler.x * RAD_TO_DEG,
        y: localEuler.y * RAD_TO_DEG,
        z: localEuler.z * RAD_TO_DEG,
      };
    }

    console.log('📍 Current transform (' + (useWorldCoordinates ? 'WORLD' : 'LOCAL') + '):');
    console.log('   Position:', pos.x, pos.y, pos.z);
    console.log('   Rotation:', rot.x, rot.y, rot.z);

    setPosition(pos);
    setRotation(rot);
  }, [selectedNodeId, useWorldCoordinates]);

  // Safe wrapper that respects user input
  const readCurrentTransform = useCallback(() => {
    // Don't update if user is typing, applying changes, or has manually edited values
    if (isInputFocused || isApplyingRef.current || hasUserEdited) {
      return;
    }
    readCurrentTransformUnsafe();
  }, [isInputFocused, hasUserEdited, readCurrentTransformUnsafe]);

  // Center dialog on first open
  useEffect(() => {
    if (isOpen && dialogPosition === null && dialogRef.current) {
      const dialogRect = dialogRef.current.getBoundingClientRect();
      const centerX = (window.innerWidth - dialogRect.width) / 2;
      const centerY = (window.innerHeight - dialogRect.height) / 2;
      setDialogPosition({ x: centerX, y: centerY });
    }
  }, [isOpen, dialogPosition]);

  // Read transform when dialog opens or node changes
  useEffect(() => {
    if (isOpen && selectedNodeId) {
      setHasUserEdited(false); // Reset user edit flag when opening dialog
      readCurrentTransformUnsafe(); // Always load initial values
    }
  }, [isOpen, selectedNodeId, readCurrentTransformUnsafe]);

  // Continuously update values while dialog is open (for gizmo movement)
  useEffect(() => {
    if (!isOpen) return;

    let animationFrameId: number;

    const update = () => {
      // TEMPORARILY DISABLED: Gizmo detection logic was too aggressive
      // TODO: Implement proper gizmo detection that doesn't interfere with user input
      
      readCurrentTransform();
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isOpen, readCurrentTransform, selectedNodeId]);

  // Drag handlers for movable dialog
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.move-dialog-drag-handle') && dialogPosition) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - dialogPosition.x,
        y: e.clientY - dialogPosition.y,
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setDialogPosition({
          x: e.clientX - dragStartRef.current.x,
          y: e.clientY - dragStartRef.current.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleApply = () => {
    // Prevent animation frame from overwriting values during apply
    isApplyingRef.current = true;

    console.log('🟦 Apply clicked - current state:');
    console.log('  Selected node ID:', selectedNodeId);
    console.log('  Position to apply:', position.x, position.y, position.z);
    console.log('  Rotation to apply:', rotation.x, rotation.y, rotation.z);
    console.log('  hasUserEdited:', hasUserEdited);
    console.log('  isInputFocused:', isInputFocused);

    // Apply button clicked - proceed with transform update

    if (!selectedNodeId) {
      console.log('❌ No node selected');
      isApplyingRef.current = false;
      return;
    }

    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    let node = tree.getNode(selectedNodeId);

    if (!node || !scene) {
      console.log('❌ No node or scene');
      isApplyingRef.current = false;
      return;
    }

    // Get Babylon node to read old values
    let babylonNode: BABYLON.TransformNode | null = null;
    if (node?.babylonMeshId) {
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
    } else if (node?.type === 'collection') {
      babylonNode = scene.transformNodes.find((tn) => tn.name === node?.name) || null;
    }

    if (!babylonNode) {
      console.log('❌ No Babylon node found');
      isApplyingRef.current = false;
      return;
    }

    console.log('✅ Found Babylon node:', babylonNode.name);
    console.log('   Node type:', node.type);
    console.log('   Has parent?', babylonNode.parent ? babylonNode.parent.name : 'NO PARENT');
    console.log('   Current position:', babylonNode.position);
    console.log('   Current world position:', babylonNode.getAbsolutePosition());

    // IMPORTANT: Check if this is a device dummy mesh (ending in _device_root)
    // If so, we should move the PARENT collection instead
    if (node.name.endsWith('_device_root') && node.type === 'mesh' && node.parentId) {
      console.warn('⚠️ You selected a device dummy mesh. Moving the parent collection instead.');
      console.warn('   Device mesh:', node.name);
      console.warn('   Will move parent:', node.parentId);

      // Get the parent node
      const parentNode = tree.getNode(node.parentId);
      if (parentNode && parentNode.type === 'collection') {
        console.log('✅ Automatically switching to parent collection:', parentNode.name);

        // Update selectedNodeId to point to the parent
        // Note: selectedNodeId is from store, we need to use a local variable
        // const _newSelectedNodeId = node.parentId;
        node = parentNode;

        // Get the parent's Babylon node
        babylonNode = scene.transformNodes.find(tn => tn.name === parentNode.name) || null;

        if (!babylonNode) {
          console.log('❌ Could not find Babylon node for parent collection');
          isApplyingRef.current = false;
          return;
        }

        console.log('✅ Now using parent Babylon node:', babylonNode.name);
      }
    }

    // Get old values for undo (use local position for TransformCommand)
    const oldPosition = babylonToUser(babylonNode.position);

    // Get old WORLD rotation (to match what dialog displays)
    babylonNode.computeWorldMatrix(true);
    const worldMatrix = babylonNode.getWorldMatrix();
    const worldRotationQuat = new BABYLON.Quaternion();
    worldMatrix.decompose(undefined, worldRotationQuat, undefined);
    const worldEuler = worldRotationQuat.toEulerAngles();
    const oldWorldRotation = {
      x: worldEuler.x * RAD_TO_DEG,
      y: worldEuler.y * RAD_TO_DEG,
      z: worldEuler.z * RAD_TO_DEG,
    };

    // Get old LOCAL rotation for TransformCommand
    let oldRotation: { x: number; y: number; z: number };
    if (babylonNode.rotationQuaternion) {
      const euler = babylonNode.rotationQuaternion.toEulerAngles();
      oldRotation = {
        x: euler.x * RAD_TO_DEG,
        y: euler.y * RAD_TO_DEG,
        z: euler.z * RAD_TO_DEG,
      };
    } else {
      oldRotation = {
        x: babylonNode.rotation.x * RAD_TO_DEG,
        y: babylonNode.rotation.y * RAD_TO_DEG,
        z: babylonNode.rotation.z * RAD_TO_DEG,
      };
    }

    // Apply position if changed
    let localPosition: { x: number; y: number; z: number };
    let posChanged: boolean;
    
    if (useWorldCoordinates) {
      // The position from dialog is world position in user coordinate system
      // We need to convert it to local position for the TransformCommand
      const worldPosition = position; // This is the world position from dialog in user coords
      const parentWorldPosition = babylonNode.parent && 'getAbsolutePosition' in babylonNode.parent
        ? babylonToUser((babylonNode.parent as BABYLON.TransformNode).getAbsolutePosition())
        : { x: 0, y: 0, z: 0 };
      localPosition = {
        x: worldPosition.x - parentWorldPosition.x,
        y: worldPosition.y - parentWorldPosition.y,
        z: worldPosition.z - parentWorldPosition.z,
      };
      posChanged = localPosition.x !== oldPosition.x || localPosition.y !== oldPosition.y || localPosition.z !== oldPosition.z;
    } else {
      // The position from dialog is already local position in user coordinate system
      localPosition = position;
      posChanged = localPosition.x !== oldPosition.x || localPosition.y !== oldPosition.y || localPosition.z !== oldPosition.z;
    }

    console.log('📍 Position change:');
    console.log('  posChanged:', posChanged);
    console.log('  useWorldCoordinates:', useWorldCoordinates);
    console.log('  oldPosition:', oldPosition.x, oldPosition.y, oldPosition.z);
    console.log('  newLocalPosition:', localPosition.x, localPosition.y, localPosition.z);

    if (posChanged) {
      const positionCommand = new TransformCommand(
        selectedNodeId,
        'position',
        oldPosition,
        localPosition,
        updateNodePosition
      );
      console.log('🔵 Executing position command with:', {
        from: oldPosition,
        to: localPosition
      });
      commandManager.execute(positionCommand);
      console.log('✅ Position command executed');
    } else {
      console.log('⚠️ Position NOT changed, skipping command');
    }

    // Apply rotation if changed
    let newLocalRotation: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
    let rotChanged: boolean;
    
    if (useWorldCoordinates) {
      // The rotation from dialog is WORLD rotation, need to check if changed using world values
      rotChanged = rotation.x !== oldWorldRotation.x || rotation.y !== oldWorldRotation.y || rotation.z !== oldWorldRotation.z;

      if (rotChanged) {
        // Convert new world rotation to local rotation (similar to position conversion)
        // Get parent world rotation quaternion
        const parentWorldRotationQuat = BABYLON.Quaternion.Identity();
        if (babylonNode.parent && 'getWorldMatrix' in babylonNode.parent) {
          const parentWorldMatrix = (babylonNode.parent as BABYLON.TransformNode).getWorldMatrix();
          parentWorldMatrix.decompose(undefined, parentWorldRotationQuat, undefined);
        }

        // Convert dialog rotation (degrees) to quaternion
        const newWorldRotationQuat = BABYLON.Quaternion.RotationYawPitchRoll(
          rotation.y * (Math.PI / 180), // yaw
          rotation.x * (Math.PI / 180), // pitch
          rotation.z * (Math.PI / 180)  // roll
        );

        // Compute local rotation: local = parent^-1 * world
        const parentInverseQuat = parentWorldRotationQuat.invert();
        const localRotationQuat = parentInverseQuat.multiply(newWorldRotationQuat);

        // Convert to Euler angles for TransformCommand
        const localEuler = localRotationQuat.toEulerAngles();
        newLocalRotation = {
          x: localEuler.x * RAD_TO_DEG,
          y: localEuler.y * RAD_TO_DEG,
          z: localEuler.z * RAD_TO_DEG,
        };
      }
    } else {
      // The rotation from dialog is already local rotation
      rotChanged = rotation.x !== oldRotation.x || rotation.y !== oldRotation.y || rotation.z !== oldRotation.z;
      newLocalRotation = rotation;
    }

    console.log('🔄 Rotation change:', {
      rotChanged,
      useWorldCoordinates,
      oldWorldRotation,
      oldLocalRotation: oldRotation,
      newRotation: rotation,
      newLocalRotation
    });

    if (rotChanged) {
      const rotationCommand = new TransformCommand(
        selectedNodeId,
        'rotation',
        oldRotation,
        newLocalRotation,
        updateNodeRotation
      );
      commandManager.execute(rotationCommand);
      console.log('✅ Rotation command executed');
    }

    // DON'T close dialog - Apply should keep dialog open for further edits
    // Clear the applying flag after a delay to let the command execute
    setTimeout(() => {
      isApplyingRef.current = false;
      setHasUserEdited(false); // Reset so we can see updates from gizmo
    }, 100);
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  const tree = SceneTreeManager.getInstance();
  const node = selectedNodeId ? tree.getNode(selectedNodeId) : null;

  if (!node) {
    return (
      <div
        ref={dialogRef}
        className="move-dialog move-dialog-floating"
        style={{
          left: dialogPosition ? `${dialogPosition.x}px` : '50%',
          top: dialogPosition ? `${dialogPosition.y}px` : '50%',
          transform: dialogPosition ? 'none' : 'translate(-50%, -50%)',
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="move-dialog-header">
          <div className="move-dialog-drag-handle">
            <GripVertical size={12} />
          </div>
          <div className="move-dialog-title">
            <Move size={12} />
            <h3>Move Object</h3>
          </div>
          <button className="move-dialog-close" onClick={handleCancel}>
            <X size={14} />
          </button>
        </div>
        <div className="move-dialog-content">
          <p className="no-selection">No object selected</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dialogRef}
      className="move-dialog move-dialog-floating"
      style={{
        left: dialogPosition ? `${dialogPosition.x}px` : '50%',
        top: dialogPosition ? `${dialogPosition.y}px` : '50%',
        transform: dialogPosition ? 'none' : 'translate(-50%, -50%)',
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="move-dialog-header">
        <div className="move-dialog-drag-handle">
          <GripVertical size={12} />
        </div>
        <div className="move-dialog-title">
          <Move size={12} />
          <h3>{node.name}</h3>
        </div>
        <div className="move-dialog-toggle">
          <button
            className={`toggle-btn ${useWorldCoordinates ? 'active' : ''}`}
            onClick={() => setUseWorldCoordinates(true)}
            title="World Coordinates"
          >
            World
          </button>
          <button
            className={`toggle-btn ${!useWorldCoordinates ? 'active' : ''}`}
            onClick={() => setUseWorldCoordinates(false)}
            title="Local Coordinates"
          >
            Local
          </button>
        </div>
        <button className="move-dialog-close" onClick={handleCancel}>
          <X size={14} />
        </button>
      </div>

      <div className="move-dialog-content">
        {/* Position */}
        <div className="move-section">
          <label className="move-section-label">POSITION (MM) - {useWorldCoordinates ? 'WORLD' : 'LOCAL'}</label>
          <div className="move-inputs-row">
            <div className="move-input">
              <label className="axis-label-x">X</label>
              <XNumericInput
                value={position.x}
        onChange={(val) => {
          setPosition({ ...position, x: val });
          setHasUserEdited(true);
        }}
                step={positionIncrement}
                precision={1}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </div>
            <div className="move-input">
              <label className="axis-label-y">Y</label>
              <YNumericInput
                value={position.y}
        onChange={(val) => {
          setPosition({ ...position, y: val });
          setHasUserEdited(true);
        }}
                step={positionIncrement}
                precision={1}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </div>
            <div className="move-input">
              <label className="axis-label-z">Z</label>
              <ZNumericInput
                value={position.z}
                onChange={(val) => {
                  setPosition({ ...position, z: val });
                  setHasUserEdited(true);
                }}
                step={positionIncrement}
                precision={1}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="move-section">
          <label className="move-section-label">ROTATION (°) - {useWorldCoordinates ? 'WORLD' : 'LOCAL'}</label>
          <div className="move-inputs-row">
            <div className="move-input">
              <label className="axis-label-x">Rx</label>
              <XNumericInput
                value={rotation.x}
                onChange={(val) => {
                  setRotation({ ...rotation, x: val });
                  setHasUserEdited(true);
                }}
                step={rotationIncrement}
                precision={1}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </div>
            <div className="move-input">
              <label className="axis-label-y">Ry</label>
              <YNumericInput
                value={rotation.y}
                onChange={(val) => {
                  setRotation({ ...rotation, y: val });
                  setHasUserEdited(true);
                }}
                step={rotationIncrement}
                precision={1}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </div>
            <div className="move-input">
              <label className="axis-label-z">Rz</label>
              <ZNumericInput
                value={rotation.z}
                onChange={(val) => {
                  setRotation({ ...rotation, z: val });
                  setHasUserEdited(true);
                }}
                step={rotationIncrement}
                precision={1}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="move-dialog-actions">
          <button className="move-btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button 
            className="move-btn-reset" 
            onClick={() => setHasUserEdited(false)}
            title="Reset to live updates from gizmo"
          >
            Reset
          </button>
          <button className="move-btn-apply" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
