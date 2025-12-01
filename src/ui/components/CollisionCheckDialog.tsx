import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, MousePointer2, Repeat, X, Trash2 } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { SceneNode } from '../../scene/SceneTreeNode';
import { SceneManager } from '../../scene/SceneManager';
import { useEditorStore } from '../store/editorStore';
import { shallow } from 'zustand/shallow';
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
        diffuseColor: BABYLON.Color3 | null;
        emissiveColor: BABYLON.Color3 | null;
        alpha: number;
        renderOverlay: boolean;
        overlayColor?: BABYLON.Color3;
        overlayAlpha?: number;
      }
    >
  >(new Map());

  useEffect(() => {
    if (!isOpen) {
      clearHighlights();
      clearGroupVisualization();
    }
    return () => clearHighlights();
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

  // Re-apply group view when membership changes
  useEffect(() => {
    if (showGroupView) {
      applyGroupVisualization();
    }
  }, [groupA, groupB, showGroupView]);

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

  const clearGroupVisualization = () => {
    if (groupMaterialRef.current.size === 0) return;
    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      groupMaterialRef.current.clear();
      return;
    }

    for (const [uniqueId, state] of groupMaterialRef.current.entries()) {
      const mesh = scene.getMeshByUniqueId(uniqueId) as BABYLON.Mesh | null;
      if (!mesh || !mesh.material) continue;
      const material = mesh.material as BABYLON.StandardMaterial;
      material.alpha = state.alpha;
      if (state.diffuseColor) {
        (material as any).diffuseColor = state.diffuseColor.clone();
      }
      if (state.emissiveColor) {
        (material as any).emissiveColor = state.emissiveColor.clone();
      }
      (mesh as any).renderOverlay = state.renderOverlay;
      if (state.overlayColor) {
        (mesh as any).overlayColor = state.overlayColor.clone();
      }
      if (state.overlayAlpha !== undefined) {
        (mesh as any).overlayAlpha = state.overlayAlpha;
      }
    }
    groupMaterialRef.current.clear();
    setShowGroupView(false);
  };

  // Helper function to collect all meshes from a node with their corresponding nodes (for precise highlighting)
  const collectMeshesWithNodes = (
    node: SceneNode,
    scene: BABYLON.Scene
  ): Array<{ mesh: BABYLON.Mesh; node: SceneNode }> => {
    const results: Array<{ mesh: BABYLON.Mesh; node: SceneNode }> = [];

    // If this node has a direct mesh, add it with this node
    if (node.babylonMeshId) {
      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10)) as BABYLON.Mesh | null;
      if (mesh && mesh.geometry) {
        results.push({ mesh, node });
      }
    }

    // Recursively collect from children
    const tree = SceneTreeManager.getInstance();
    const children = tree.getChildren(node.id);
    for (const child of children) {
      results.push(...collectMeshesWithNodes(child, scene));
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
          const isColliding = meshA.intersectsMesh(meshB, false);

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

  const collectMeshesForGroup = (groupIds: string[], scene: BABYLON.Scene): Set<number> => {
    const meshIds = new Set<number>();
    const tree = SceneTreeManager.getInstance();

    const addMesh = (mesh: BABYLON.AbstractMesh | null) => {
      if (!mesh || !mesh.geometry) return;
      meshIds.add(mesh.uniqueId);
    };

    const visitTransformDescendants = (transform: BABYLON.TransformNode) => {
      const stack: BABYLON.Node[] = [transform];
      while (stack.length) {
        const current = stack.pop();
        if (!current) continue;
        if (current instanceof BABYLON.AbstractMesh) {
          addMesh(current);
        }
        current.getChildren().forEach((c) => stack.push(c));
      }
    };

    const visitTreeNode = (node: SceneNode) => {
      if (node.babylonMeshId) {
        addMesh(scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10)));
      }
      if (node.babylonTransformNodeId) {
        const transform = scene.getTransformNodeByUniqueId(parseInt(node.babylonTransformNodeId, 10));
        if (transform) {
          visitTransformDescendants(transform);
        }
      }
      const children = tree.getChildren(node.id);
      children.forEach(visitTreeNode);
    };

    for (const id of groupIds) {
      const node = tree.getNode(id);
      if (node) visitTreeNode(node);
    }

    return meshIds;
  };

  const applyGroupVisualization = () => {
    const scene = SceneManager.getInstance().getScene();
    if (!scene) return;

    // Restore any previous visualization first
    clearGroupVisualization();

    const meshIdsA = collectMeshesForGroup(groupA, scene);
    const meshIdsB = collectMeshesForGroup(groupB, scene);

    const colorA = new BABYLON.Color3(0.1, 0.35, 1.0); // vivid deep blue
    const colorB = new BABYLON.Color3(1.0, 0.55, 0.05); // vivid deep gold/orange
    const ghostColor = new BABYLON.Color3(0.35, 0.35, 0.35);

    for (const mesh of scene.meshes) {
      const mat = (mesh as BABYLON.Mesh).material as any;
      if (!mat) continue;

      if (!groupMaterialRef.current.has(mesh.uniqueId)) {
        groupMaterialRef.current.set(mesh.uniqueId, {
          diffuseColor: mat.diffuseColor ? mat.diffuseColor.clone() : mat.albedoColor ? mat.albedoColor.clone() : null,
          emissiveColor: mat.emissiveColor ? mat.emissiveColor.clone() : null,
          alpha: mat.alpha ?? 1.0,
          renderOverlay: (mesh as any).renderOverlay ?? false,
          overlayColor: (mesh as any).overlayColor ? (mesh as any).overlayColor.clone() : undefined,
          overlayAlpha: (mesh as any).overlayAlpha,
        });
      }

      if (meshIdsA.has(mesh.uniqueId)) {
        (mesh as any).renderOverlay = true;
        (mesh as any).overlayColor = colorA.clone();
        (mesh as any).overlayAlpha = 0.9;
        mat.alpha = 1.0;
        if (mat.emissiveColor) mat.emissiveColor = colorA.scale(0.4);
        if (mat.diffuseColor) mat.diffuseColor = colorA.clone();
        if (mat.albedoColor) mat.albedoColor = colorA.clone();
      } else if (meshIdsB.has(mesh.uniqueId)) {
        (mesh as any).renderOverlay = true;
        (mesh as any).overlayColor = colorB.clone();
        (mesh as any).overlayAlpha = 0.9;
        mat.alpha = 1.0;
        if (mat.emissiveColor) mat.emissiveColor = colorB.scale(0.4);
        if (mat.diffuseColor) mat.diffuseColor = colorB.clone();
        if (mat.albedoColor) mat.albedoColor = colorB.clone();
      } else {
        (mesh as any).renderOverlay = true;
        (mesh as any).overlayColor = ghostColor.clone();
        (mesh as any).overlayAlpha = 0.25;
        mat.alpha = 0.15;
        if (mat.emissiveColor) mat.emissiveColor = ghostColor.scale(0.05);
        if (mat.diffuseColor) mat.diffuseColor = ghostColor.clone();
        if (mat.albedoColor) mat.albedoColor = ghostColor.clone();
      }
    }

    setShowGroupView(true);
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
          <button className="collision-dialog__icon-btn" onClick={() => { clearHighlights(); onClose(); }}>
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
