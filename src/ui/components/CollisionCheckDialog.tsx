import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, MousePointer2, Repeat, X, Trash2 } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { SceneNode } from '../../scene/SceneTreeNode';
import { SceneManager } from '../../scene/SceneManager';
import { useEditorStore } from '../store/editorStore';
import { shallow } from 'zustand/shallow';
import { resolveMeshUniqueIdsForNodes } from '../utils/meshResolver';
import './CollisionCheckDialog.css';

interface CollisionCheckDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CollisionResultRow {
  nodeA: SceneNode;
  nodeB: SceneNode;
}

export function CollisionCheckDialog({ isOpen, onClose }: CollisionCheckDialogProps) {
  const selectionIds = useEditorStore(
    (state) =>
      state.selectedNodeIds && state.selectedNodeIds.length > 0
        ? state.selectedNodeIds
        : state.selectedNodeId
        ? [state.selectedNodeId]
        : [],
    shallow
  );

  const [groupA, setGroupA] = useState<string[]>([]);
  const [groupB, setGroupB] = useState<string[]>([]);
  const [collisions, setCollisions] = useState<CollisionResultRow[]>([]);
  const [status, setStatus] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 250, y: 100 });
  const [showAllCollisions, setShowAllCollisions] = useState(false);
  const [addModeA, setAddModeA] = useState(false);
  const [addModeB, setAddModeB] = useState(false);
  const [baselineSelectionA, setBaselineSelectionA] = useState<string[]>([]);
  const [baselineSelectionB, setBaselineSelectionB] = useState<string[]>([]);
  const [showGroupView, setShowGroupView] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const COLLISION_DISPLAY_LIMIT = 20;

  const previousMaterialRef = useRef<
    Map<
      number,
      {
        diffuseColor: BABYLON.Color3;
        emissiveColor: BABYLON.Color3;
        alpha: number;
      }
    >
  >(new Map());

  const groupMaterialRef = useRef<
    Map<
      number,
      {
        materialType: string;
        originalProps: {
          diffuseColor?: BABYLON.Color3;
          emissiveColor?: BABYLON.Color3;
          albedoColor?: BABYLON.Color3;
          specularColor?: BABYLON.Color3;
          alpha: number;
          transparencyMode: number | null;
        }
      }
    >
  >(new Map());

  useEffect(() => {
    if (!isOpen) {
      clearHighlights();
      clearGroupVisualization();
    }
    return () => {
      clearHighlights();
      clearGroupVisualization();
    };
  }, [isOpen]);

  // Auto-add new selections when in add-selection mode (but not the baseline when toggled on)
  useEffect(() => {
    const sameSelection = (a: string[], b: string[]) =>
      a.length === b.length && a.every((id, idx) => id === b[idx]);

    if (addModeA && selectionIds.length > 0 && !sameSelection(selectionIds, baselineSelectionA)) {
      addSelectionToGroupA(selectionIds);
      setBaselineSelectionA(selectionIds);
    }

    if (addModeB && selectionIds.length > 0 && !sameSelection(selectionIds, baselineSelectionB)) {
      addSelectionToGroupB(selectionIds);
      setBaselineSelectionB(selectionIds);
    }
  }, [selectionIds, addModeA, addModeB, baselineSelectionA, baselineSelectionB]);

  // Dragging functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.collision-dialog__header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const addSelectionToGroupA = (ids: string[] = selectionIds) => {
    if (ids.length === 0) return;
    setGroupA(prev => {
      // Filter out any IDs that are already in Group B
      const newIds = ids.filter(id => !groupB.includes(id));
      return [...new Set([...prev, ...newIds])];
    });
    // Remove from Group B if they were there
    setGroupB(prev => prev.filter(id => !ids.includes(id)));
    setStatus('');
  };

  const addSelectionToGroupB = (ids: string[] = selectionIds) => {
    if (ids.length === 0) return;
    setGroupB(prev => {
      // Filter out any IDs that are already in Group A
      const newIds = ids.filter(id => !groupA.includes(id));
      return [...new Set([...prev, ...newIds])];
    });
    // Remove from Group A if they were there
    setGroupA(prev => prev.filter(id => !ids.includes(id)));
    setStatus('');
  };

  const removeFromGroupA = (nodeId: string) => {
    setGroupA(prev => prev.filter(id => id !== nodeId));
  };

  const removeFromGroupB = (nodeId: string) => {
    setGroupB(prev => prev.filter(id => id !== nodeId));
  };

  const clearHighlights = () => {
    if (previousMaterialRef.current.size === 0) return;
    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      previousMaterialRef.current.clear();
      return;
    }

    for (const [uniqueId, state] of previousMaterialRef.current.entries()) {
      const mesh = scene.getMeshByUniqueId(uniqueId) as BABYLON.Mesh | null;
      if (!mesh || !mesh.material) continue;

      const material = mesh.material as BABYLON.StandardMaterial;
      material.diffuseColor = state.diffuseColor;
      material.emissiveColor = state.emissiveColor;
      material.alpha = state.alpha;
    }
    previousMaterialRef.current.clear();
  };

  // Helper function to collect all meshes from a node with their corresponding nodes (for precise highlighting)
  const collectMeshesWithNodes = (
    node: SceneNode,
    scene: BABYLON.Scene
  ): Array<{ mesh: BABYLON.Mesh; node: SceneNode }> => {
    const results: Array<{ mesh: BABYLON.Mesh; node: SceneNode }> = [];
    const meshIds = resolveMeshUniqueIdsForNodes([node.id], scene);

    for (const mesh of scene.meshes) {
      if (meshIds.has(mesh.uniqueId) && mesh.geometry) {
        results.push({ mesh: mesh as BABYLON.Mesh, node });
      }
    }

    return results;
  };

  // Highlight a specific mesh (not all meshes from a node)
  const highlightMesh = (mesh: BABYLON.Mesh) => {
    if (!mesh.material) return;

    const material = mesh.material as BABYLON.StandardMaterial;

    // Save original material properties if not already saved
    if (!previousMaterialRef.current.has(mesh.uniqueId)) {
      previousMaterialRef.current.set(mesh.uniqueId, {
        diffuseColor: material.diffuseColor ? material.diffuseColor.clone() : new BABYLON.Color3(1, 1, 1),
        emissiveColor: material.emissiveColor ? material.emissiveColor.clone() : new BABYLON.Color3(0, 0, 0),
        alpha: material.alpha ?? 1.0,
      });
    }

    // Apply red highlighting
    material.diffuseColor = new BABYLON.Color3(1, 0, 0);
    material.emissiveColor = new BABYLON.Color3(0.3, 0, 0);
  };

  // Clear group visualization and restore original materials
  const clearGroupVisualization = () => {
    const scene = SceneManager.getInstance().getScene();
    if (!scene || groupMaterialRef.current.size === 0) {
      console.log('[CollisionDialog] Nothing to clear');
      return;
    }

    console.log('[CollisionDialog] Restoring materials for', groupMaterialRef.current.size, 'meshes');

    for (const [uniqueId, saved] of groupMaterialRef.current.entries()) {
      const mesh = scene.getMeshByUniqueId(uniqueId) as BABYLON.Mesh | null;
      if (!mesh || !mesh.material) {
        console.warn('[CollisionDialog] Mesh or material not found for uniqueId:', uniqueId);
        continue;
      }

      const material = mesh.material;
      console.log(`[CollisionDialog] Restoring material for mesh "${mesh.name}"`);
      console.log('  - Material type:', saved.materialType);
      console.log('  - Saved props:', saved.originalProps);

      // Restore based on saved material type
      if (saved.materialType === 'StandardMaterial' && material instanceof BABYLON.StandardMaterial) {
        const stdMat = material as BABYLON.StandardMaterial;
        if (saved.originalProps.diffuseColor) {
          stdMat.diffuseColor = saved.originalProps.diffuseColor.clone();
          console.log('  - Restored diffuseColor:', saved.originalProps.diffuseColor);
        }
        if (saved.originalProps.emissiveColor) {
          stdMat.emissiveColor = saved.originalProps.emissiveColor.clone();
          console.log('  - Restored emissiveColor:', saved.originalProps.emissiveColor);
        }
        if (saved.originalProps.specularColor) {
          stdMat.specularColor = saved.originalProps.specularColor.clone();
        }
        stdMat.alpha = saved.originalProps.alpha;
        stdMat.transparencyMode = saved.originalProps.transparencyMode;
      } else if (saved.materialType === 'PBRMaterial' && material instanceof BABYLON.PBRMaterial) {
        const pbrMat = material as BABYLON.PBRMaterial;
        if (saved.originalProps.albedoColor) {
          pbrMat.albedoColor = saved.originalProps.albedoColor.clone();
          console.log('  - Restored albedoColor:', saved.originalProps.albedoColor);
        }
        if (saved.originalProps.emissiveColor) {
          pbrMat.emissiveColor = saved.originalProps.emissiveColor.clone();
          console.log('  - Restored emissiveColor:', saved.originalProps.emissiveColor);
        }
        pbrMat.alpha = saved.originalProps.alpha;
        pbrMat.transparencyMode = saved.originalProps.transparencyMode;
      } else {
        console.warn(`  - Material type mismatch or unsupported. Saved: ${saved.materialType}, Current: ${material.getClassName?.()}`);
      }
    }
    groupMaterialRef.current.clear();
    setShowGroupView(false);
    console.log('[CollisionDialog] Material restoration complete');
  };

  // Apply group visualization: color Group A and B, make others neutral gray
  const applyGroupVisualization = () => {
    const scene = SceneManager.getInstance().getScene();
    if (!scene) return;

    // Clear any previous visualization first
    clearGroupVisualization();
    // Also clear collision highlights to avoid conflicts
    clearHighlights();

    const tree = SceneTreeManager.getInstance();
    const nodesA = groupA.map((id) => tree.getNode(id)).filter(Boolean) as SceneNode[];
    const nodesB = groupB.map((id) => tree.getNode(id)).filter(Boolean) as SceneNode[];

    // Collect all meshes from both groups
    const meshesASet = new Set<number>();
    const meshesBSet = new Set<number>();

    console.log('[CollisionDialog] Group A nodes:', nodesA.map(n => n.name));
    console.log('[CollisionDialog] Group B nodes:', nodesB.map(n => n.name));

    for (const node of nodesA) {
      const meshes = collectMeshesWithNodes(node, scene);
      console.log(`[CollisionDialog] Node "${node.name}" has ${meshes.length} meshes:`, meshes.map(m => m.mesh.name));
      meshes.forEach(({ mesh }) => meshesASet.add(mesh.uniqueId));
    }

    for (const node of nodesB) {
      const meshes = collectMeshesWithNodes(node, scene);
      console.log(`[CollisionDialog] Node "${node.name}" has ${meshes.length} meshes:`, meshes.map(m => m.mesh.name));
      meshes.forEach(({ mesh }) => meshesBSet.add(mesh.uniqueId));
    }

    console.log('[CollisionDialog] Total meshes in Group A:', meshesASet.size);
    console.log('[CollisionDialog] Total meshes in Group B:', meshesBSet.size);

    // Define distinct colors - vivid deep blue and deep orange
    const colorA = new BABYLON.Color3(0.2, 0.5, 1.0);  // Bright blue for Group A
    const colorB = new BABYLON.Color3(1.0, 0.5, 0.1);  // Bright orange for Group B
    const GHOST_ALPHA = 0.2;  // Make non-group objects semi-transparent

    // Helper to save original material properties
    const saveOriginalMaterial = (mesh: BABYLON.Mesh, mat: BABYLON.Material) => {
      if (groupMaterialRef.current.has(mesh.uniqueId)) return;

      const materialType = mat.getClassName?.() || 'Material';
      const saved: {
        materialType: string;
        originalProps: {
          diffuseColor?: BABYLON.Color3;
          emissiveColor?: BABYLON.Color3;
          albedoColor?: BABYLON.Color3;
          specularColor?: BABYLON.Color3;
          alpha: number;
          transparencyMode: number | null;
        }
      } = {
        materialType,
        originalProps: { alpha: 1.0, transparencyMode: null }
      };

      console.log(`[CollisionDialog] Saving material for "${mesh.name}", type: ${materialType}`);

      if (mat instanceof BABYLON.StandardMaterial) {
        const stdMat = mat as BABYLON.StandardMaterial;
        saved.originalProps.diffuseColor = stdMat.diffuseColor ? stdMat.diffuseColor.clone() : new BABYLON.Color3(1, 1, 1);
        saved.originalProps.emissiveColor = stdMat.emissiveColor ? stdMat.emissiveColor.clone() : new BABYLON.Color3(0, 0, 0);
        saved.originalProps.specularColor = stdMat.specularColor ? stdMat.specularColor.clone() : new BABYLON.Color3(1, 1, 1);
        saved.originalProps.alpha = stdMat.alpha ?? 1.0;
        saved.originalProps.transparencyMode = stdMat.transparencyMode;
        console.log('  - Saved StandardMaterial:', {
          diffuse: saved.originalProps.diffuseColor,
          emissive: saved.originalProps.emissiveColor,
          specular: saved.originalProps.specularColor,
          alpha: saved.originalProps.alpha,
          transparencyMode: saved.originalProps.transparencyMode
        });
      } else if (mat instanceof BABYLON.PBRMaterial) {
        const pbrMat = mat as BABYLON.PBRMaterial;
        saved.originalProps.albedoColor = pbrMat.albedoColor ? pbrMat.albedoColor.clone() : new BABYLON.Color3(1, 1, 1);
        saved.originalProps.emissiveColor = pbrMat.emissiveColor ? pbrMat.emissiveColor.clone() : new BABYLON.Color3(0, 0, 0);
        saved.originalProps.alpha = pbrMat.alpha ?? 1.0;
        saved.originalProps.transparencyMode = pbrMat.transparencyMode;
        console.log('  - Saved PBRMaterial:', {
          albedo: saved.originalProps.albedoColor,
          emissive: saved.originalProps.emissiveColor,
          alpha: saved.originalProps.alpha,
          transparencyMode: saved.originalProps.transparencyMode
        });
      } else {
        console.warn(`  - Unsupported material type: ${materialType}. Material will not be modified.`);
        return; // Don't save or modify unsupported materials
      }

      groupMaterialRef.current.set(mesh.uniqueId, saved);
    };

    // Helper to apply highlighting to a group material (adds emissive glow)
    const applyGroupHighlight = (mat: BABYLON.Material, color: BABYLON.Color3) => {
      if (mat instanceof BABYLON.StandardMaterial) {
        const stdMat = mat as BABYLON.StandardMaterial;
        // Keep original diffuse, add emissive glow
        stdMat.emissiveColor = color.scale(0.4);
        stdMat.alpha = 1.0;
        stdMat.transparencyMode = null; // Ensure no transparency mode
      } else if (mat instanceof BABYLON.PBRMaterial) {
        const pbrMat = mat as BABYLON.PBRMaterial;
        // Keep original albedo, add emissive glow
        pbrMat.emissiveColor = color.scale(0.4);
        pbrMat.alpha = 1.0;
        pbrMat.transparencyMode = null; // Ensure no transparency mode
      }
    };

    // Helper to ghost non-group materials (make semi-transparent)
    const applyGhosting = (mat: BABYLON.Material) => {
      if (mat instanceof BABYLON.StandardMaterial) {
        const stdMat = mat as BABYLON.StandardMaterial;
        stdMat.alpha = GHOST_ALPHA;
        stdMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; // Enable alpha blending
      } else if (mat instanceof BABYLON.PBRMaterial) {
        const pbrMat = mat as BABYLON.PBRMaterial;
        pbrMat.alpha = GHOST_ALPHA;
        pbrMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND; // Enable alpha blending
      }
    };

    // Apply colors to all meshes in the scene
    for (const abstractMesh of scene.meshes) {
      const material = abstractMesh.material;
      if (!material) continue;

      // Skip environment meshes
      const meshName = abstractMesh.name.toLowerCase();
      if (
        meshName.includes('skybox') ||
        meshName.includes('sky') ||
        meshName.includes('grid') ||
        meshName.includes('ground') ||
        meshName.includes('floor') ||
        (meshName.includes('plane') && meshName.includes('ground'))
      ) {
        continue;
      }

      const mesh = abstractMesh as BABYLON.Mesh;

      // Save original material (this will return early if material type is unsupported)
      saveOriginalMaterial(mesh, material);

      // Only apply colors if material was successfully saved (supported type)
      if (!groupMaterialRef.current.has(mesh.uniqueId)) {
        console.warn(`[CollisionDialog] Skipping color application for "${mesh.name}" - unsupported material`);
        continue;
      }

      // Apply visualization based on group membership
      if (meshesASet.has(mesh.uniqueId)) {
        console.log(`[CollisionDialog] Highlighting mesh "${mesh.name}" BLUE (Group A)`);
        applyGroupHighlight(material, colorA);
      } else if (meshesBSet.has(mesh.uniqueId)) {
        console.log(`[CollisionDialog] Highlighting mesh "${mesh.name}" ORANGE (Group B)`);
        applyGroupHighlight(material, colorB);
      } else {
        console.log(`[CollisionDialog] Ghosting mesh "${mesh.name}" (non-group)`);
        applyGhosting(material);
      }
    }

    setShowGroupView(true);
    setStatus('Group visualization applied');
  };

  const runCollisionCheck = async () => {
    clearHighlights();
    setIsRunning(true);
    const tree = SceneTreeManager.getInstance();
    const scene = SceneManager.getInstance().getScene();

    if (!scene) {
      setStatus('Scene not available.');
      setIsRunning(false);
      return;
    }

    const nodesA = groupA.map((id) => tree.getNode(id)).filter(Boolean) as SceneNode[];
    const nodesB = groupB.map((id) => tree.getNode(id)).filter(Boolean) as SceneNode[];

    if (nodesA.length === 0 || nodesB.length === 0) {
      setStatus('Add objects to both groups.');
      setIsRunning(false);
      return;
    }

    const meshesA: BABYLON.Mesh[] = [];
    const meshesB: BABYLON.Mesh[] = [];
    const nodeToMeshMapA = new Map<BABYLON.Mesh, SceneNode>();
    const nodeToMeshMapB = new Map<BABYLON.Mesh, SceneNode>();

    // Collect meshes from Group A with their specific nodes (not top-level parent)
    for (const topLevelNode of nodesA) {
      const meshNodePairs = collectMeshesWithNodes(topLevelNode, scene);
      for (const { mesh, node } of meshNodePairs) {
        meshesA.push(mesh);
        nodeToMeshMapA.set(mesh, node); // Map to the specific child node, not the parent
      }
    }

    // Collect meshes from Group B with their specific nodes (not top-level parent)
    for (const topLevelNode of nodesB) {
      const meshNodePairs = collectMeshesWithNodes(topLevelNode, scene);
      for (const { mesh, node } of meshNodePairs) {
        meshesB.push(mesh);
        nodeToMeshMapB.set(mesh, node); // Map to the specific child node, not the parent
      }
    }

    if (meshesA.length === 0 || meshesB.length === 0) {
      setStatus('Could not find valid meshes.');
      setIsRunning(false);
      return;
    }

    const collisionsFound: CollisionResultRow[] = [];
    const seenPairs = new Set<string>();

    for (const meshA of meshesA) {
      meshA.computeWorldMatrix(true);
      const nodeA = nodeToMeshMapA.get(meshA)!;

      for (const meshB of meshesB) {
        meshB.computeWorldMatrix(true);
        const nodeB = nodeToMeshMapB.get(meshB)!;

        if (meshA === meshB) continue;

        const key = meshA.uniqueId < meshB.uniqueId
          ? `${meshA.uniqueId}|${meshB.uniqueId}`
          : `${meshB.uniqueId}|${meshA.uniqueId}`;

        if (seenPairs.has(key)) continue;
        seenPairs.add(key);

        try {
          // Use precise mesh intersection (convex hull/triangle-based) instead of bounding boxes
          const isColliding = meshA.intersectsMesh(meshB, true);

          if (isColliding) {
            collisionsFound.push({ nodeA, nodeB });
            // Highlight only the specific meshes that collided, not all meshes from the nodes
            highlightMesh(meshA);
            highlightMesh(meshB);
          }
        } catch (error) {
          console.warn(`Error checking collision between ${nodeA.name} and ${nodeB.name}:`, error);
        }
      }
    }

    setCollisions(collisionsFound);
    setStatus(
      collisionsFound.length > 0
        ? `${collisionsFound.length} collision${collisionsFound.length === 1 ? '' : 's'} detected`
        : 'No collisions detected'
    );
    setIsRunning(false);
  };

  const getNodeName = (nodeId: string): string => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    return node?.name || nodeId;
  };

  if (!isOpen) return null;

  return (
    <div className="collision-dialog-overlay">
      <div
        ref={dialogRef}
        className="collision-dialog"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="collision-dialog__header" style={{ cursor: 'grab' }}>
          <div className="collision-dialog__title">
            <AlertTriangle size={18} />
            <span>Collision Check</span>
          </div>
          <button className="collision-dialog__icon-btn" onClick={() => { clearHighlights(); clearGroupVisualization(); onClose(); }}>
            <X size={16} />
          </button>
        </div>

        <div className="collision-dialog__content">
          {/* Group A */}
          <div className="collision-dialog__section">
            <div className="collision-dialog__section-header">
              <span>Group A ({groupA.length})</span>
              <button
                className={`collision-dialog__add-btn ${addModeA ? 'active' : ''}`}
                onClick={() => {
                  if (addModeA) {
                    setAddModeA(false);
                    return;
                  }
                  // Start mode: clear any current selection to prevent accidental add
                  useEditorStore.getState().clearSelection();
                  setAddModeA(true);
                  setAddModeB(false);
                  setBaselineSelectionA([]);
                  setBaselineSelectionB([]);
                }}
                title="Add Selection Mode (toggle)"
              >
                <MousePointer2 size={14} />
                {addModeA ? 'Adding…' : 'Add Selection'}
              </button>
            </div>
            <div className="collision-dialog__node-list">
              {groupA.length === 0 ? (
                <div className="collision-dialog__empty">Select objects in scene and click "Add Selection"</div>
              ) : (
                groupA.map((nodeId) => (
                  <div key={nodeId} className="collision-dialog__node-item">
                    <span className="collision-dialog__node-name">{getNodeName(nodeId)}</span>
                    <button
                      className="collision-dialog__delete-btn"
                      onClick={() => removeFromGroupA(nodeId)}
                      title="Remove from group"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Group B */}
          <div className="collision-dialog__section">
            <div className="collision-dialog__section-header">
              <span>Group B ({groupB.length})</span>
              <button
                className={`collision-dialog__add-btn ${addModeB ? 'active' : ''}`}
                onClick={() => {
                  if (addModeB) {
                    setAddModeB(false);
                    return;
                  }
                  useEditorStore.getState().clearSelection();
                  setAddModeB(true);
                  setAddModeA(false);
                  setBaselineSelectionB([]);
                  setBaselineSelectionA([]);
                }}
                title="Add Selection Mode (toggle)"
              >
                <MousePointer2 size={14} />
                {addModeB ? 'Adding…' : 'Add Selection'}
              </button>
            </div>
            <div className="collision-dialog__node-list">
              {groupB.length === 0 ? (
                <div className="collision-dialog__empty">Select objects in scene and click "Add Selection"</div>
              ) : (
                groupB.map((nodeId) => (
                  <div key={nodeId} className="collision-dialog__node-item">
                    <span className="collision-dialog__node-name">{getNodeName(nodeId)}</span>
                    <button
                      className="collision-dialog__delete-btn"
                      onClick={() => removeFromGroupB(nodeId)}
                      title="Remove from group"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="collision-dialog__actions">
            <button
              className="collision-dialog__btn"
              onClick={() => {
                if (showGroupView) {
                  clearGroupVisualization();
                } else {
                  applyGroupVisualization();
                }
              }}
              disabled={groupA.length === 0 && groupB.length === 0}
              title={showGroupView ? 'Hide group visualization' : 'Show groups with distinct colors'}
            >
              {showGroupView ? 'Hide Groups' : 'Show Groups'}
            </button>
            <button
              className="collision-dialog__btn collision-dialog__btn--primary"
              onClick={runCollisionCheck}
              disabled={isRunning || groupA.length === 0 || groupB.length === 0}
            >
              <Repeat size={14} />
              {isRunning ? 'Checking...' : 'Check Collisions'}
            </button>
            {collisions.length > 0 && (
              <button className="collision-dialog__btn" onClick={clearHighlights}>
                Clear Highlights
              </button>
            )}
          </div>

          {/* Status */}
          {status && (
            <div className={`collision-dialog__status ${collisions.length > 0 ? 'collision-dialog__status--warning' : ''}`}>
              {collisions.length > 0 ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              <span>{status}</span>
            </div>
          )}

          {/* Results */}
          {collisions.length > 0 && (
            <div className="collision-dialog__results">
              <div className="collision-dialog__results-header">
                <div className="collision-dialog__results-title">
                  Colliding Pairs ({collisions.length})
                </div>
                {collisions.length > COLLISION_DISPLAY_LIMIT && (
                  <button
                    className="collision-dialog__btn collision-dialog__btn--small"
                    onClick={() => setShowAllCollisions(!showAllCollisions)}
                  >
                    {showAllCollisions ? `Show Less` : `Show All (${collisions.length})`}
                  </button>
                )}
              </div>
              <div className="collision-dialog__results-list">
                {(showAllCollisions ? collisions : collisions.slice(0, COLLISION_DISPLAY_LIMIT)).map((row, idx) => (
                  <div className="collision-dialog__result-row" key={`${row.nodeA.id}-${row.nodeB.id}-${idx}`}>
                    <span>{row.nodeA.name}</span>
                    <span>↔</span>
                    <span>{row.nodeB.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
