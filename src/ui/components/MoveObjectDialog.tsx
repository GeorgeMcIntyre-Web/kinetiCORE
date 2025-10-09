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

  // Helper function to read current transform from Babylon (always reads, no blocking)
  const readCurrentTransformUnsafe = useCallback(() => {
    if (!selectedNodeId) return;

    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const node = tree.getNode(selectedNodeId);

    if (!node || !scene) return;

    // Get Babylon node
    let babylonNode: BABYLON.TransformNode | null = null;
    if (node.babylonMeshId) {
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
    } else if (node.type === 'collection') {
      babylonNode = scene.transformNodes.find((tn) => tn.name === node.name) || null;
    }

    if (babylonNode) {
      // Get position - ALWAYS use babylonToUser for Z-up CAD standard
      const pos = babylonToUser(babylonNode.getAbsolutePosition());

      // Get rotation in degrees
      const rot = {
        x: babylonNode.rotation.x * RAD_TO_DEG,
        y: babylonNode.rotation.y * RAD_TO_DEG,
        z: babylonNode.rotation.z * RAD_TO_DEG,
      };

      setPosition(pos);
      setRotation(rot);
    }
  }, [selectedNodeId]);

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

    // Apply button clicked - proceed with transform update

    if (!selectedNodeId) {
      isApplyingRef.current = false;
      return;
    }

    const tree = SceneTreeManager.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    const node = tree.getNode(selectedNodeId);

    if (!node || !scene) {
      isApplyingRef.current = false;
      return;
    }

    // Get Babylon node to read old values
    let babylonNode: BABYLON.TransformNode | null = null;
    if (node.babylonMeshId) {
      babylonNode = scene.getMeshByUniqueId(parseInt(node.babylonMeshId));
    } else if (node.type === 'collection') {
      babylonNode = scene.transformNodes.find((tn) => tn.name === node.name) || null;
    }

    if (!babylonNode) {
      isApplyingRef.current = false;
      return;
    }

    // Get old values for undo (use local position for TransformCommand)
    const oldPosition = babylonToUser(babylonNode.position);
    const oldRotation = {
      x: babylonNode.rotation.x * RAD_TO_DEG,
      y: babylonNode.rotation.y * RAD_TO_DEG,
      z: babylonNode.rotation.z * RAD_TO_DEG,
    };

    // Apply position if changed
    // The position from dialog is world position in user coordinate system
    // We need to convert it to local position for the TransformCommand
    const worldPosition = position; // This is the world position from dialog in user coords
    const parentWorldPosition = babylonNode.parent && 'getAbsolutePosition' in babylonNode.parent 
      ? babylonToUser((babylonNode.parent as BABYLON.TransformNode).getAbsolutePosition()) 
      : { x: 0, y: 0, z: 0 };
    const localPosition = {
      x: worldPosition.x - parentWorldPosition.x,
      y: worldPosition.y - parentWorldPosition.y,
      z: worldPosition.z - parentWorldPosition.z,
    };

    const posChanged = localPosition.x !== oldPosition.x || localPosition.y !== oldPosition.y || localPosition.z !== oldPosition.z;

    if (posChanged) {
      console.log('🔄 Applying position change:', {
        oldPosition,
        newLocalPosition: localPosition,
        worldPosition,
        parentWorldPosition
      });
      
      const positionCommand = new TransformCommand(
        selectedNodeId,
        'position',
        oldPosition,
        localPosition,
        updateNodePosition
      );
      commandManager.execute(positionCommand);
    }

    // Apply rotation if changed
    const rotChanged = rotation.x !== oldRotation.x || rotation.y !== oldRotation.y || rotation.z !== oldRotation.z;

    if (rotChanged) {
      const rotationCommand = new TransformCommand(
        selectedNodeId,
        'rotation',
        oldRotation,
        rotation,
        updateNodeRotation
      );
      commandManager.execute(rotationCommand);
    }
    isApplyingRef.current = false;
    onClose();
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
        <button className="move-dialog-close" onClick={handleCancel}>
          <X size={14} />
        </button>
      </div>

      <div className="move-dialog-content">
        {/* Position */}
        <div className="move-section">
          <label className="move-section-label">POSITION (MM)</label>
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
          <label className="move-section-label">ROTATION (°)</label>
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
