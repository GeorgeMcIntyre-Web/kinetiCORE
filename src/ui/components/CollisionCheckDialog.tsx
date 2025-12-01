import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, ListChecks, MousePointer2, Repeat, X, Radio } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { SceneNode } from '../../scene/SceneTreeNode';
import { EntityRegistry } from '../../entities/EntityRegistry';
import { SceneManager } from '../../scene/SceneManager';
import { useEditorStore } from '../store/editorStore';
import { shallow } from 'zustand/shallow';
import './CollisionCheckDialog.css';

interface CollisionCheckDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type GroupKey = 'A' | 'B';

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
  const [followSelectionTarget, setFollowSelectionTarget] = useState<GroupKey>('A');
  const [collisions, setCollisions] = useState<CollisionResultRow[]>([]);
  const [status, setStatus] = useState<string>('Select two groups to check collisions.');
  const [isRunning, setIsRunning] = useState(false);
  const previousOutlineRef = useRef<
    Map<
      number,
      {
        renderOutline: boolean;
        outlineColor: BABYLON.Color3;
        outlineWidth: number;
      }
    >
  >(new Map());

  const selectableNodes = useMemo(() => {
    const tree = SceneTreeManager.getInstance();
    return tree
      .getAllNodes()
      .filter((node) => (node.babylonMeshId || node.entityId) && !['world', 'scene', 'system'].includes(node.type))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Keep one group in sync with current selection (scene or tree)
  useEffect(() => {
    if (selectionIds.length === 0) return;
    if (followSelectionTarget === 'A') {
      setGroupA([...selectionIds]);
    } else {
      setGroupB([...selectionIds]);
    }
  }, [selectionIds, followSelectionTarget]);

  useEffect(() => {
    if (!isOpen) {
      clearHighlights();
      return;
    }
    return () => clearHighlights();
  }, [isOpen]);

  const toggleNodeInGroup = (group: GroupKey, nodeId: string) => {
    setFollowSelectionTarget(group); // mark this group as active for selection syncing
    const setter = group === 'A' ? setGroupA : setGroupB;
    setter((current) =>
      current.includes(nodeId) ? current.filter((id) => id !== nodeId) : [...current, nodeId]
    );
  };

  const useSelectionForGroup = (group: GroupKey) => {
    if (selectionIds.length === 0) return;
    setFollowSelectionTarget(group);
    const setter = group === 'A' ? setGroupA : setGroupB;
    setter(selectionIds);
  };

  const clearHighlights = () => {
    if (previousOutlineRef.current.size === 0) return;
    const scene = SceneManager.getInstance().getScene();
    if (!scene) {
      previousOutlineRef.current.clear();
      return;
    }

    for (const [uniqueId, state] of previousOutlineRef.current.entries()) {
      const mesh = scene.getMeshByUniqueId(uniqueId) as BABYLON.Mesh | null;
      if (!mesh) continue;
      mesh.renderOutline = state.renderOutline;
      mesh.outlineColor = state.outlineColor;
      mesh.outlineWidth = state.outlineWidth;
    }
    previousOutlineRef.current.clear();
  };

  const highlightNode = (node: SceneNode) => {
    const scene = SceneManager.getInstance().getScene();
    if (!scene || !node.babylonMeshId) return;

    const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10)) as BABYLON.Mesh | null;
    if (!mesh) return;

    if (!previousOutlineRef.current.has(mesh.uniqueId)) {
      previousOutlineRef.current.set(mesh.uniqueId, {
        renderOutline: mesh.renderOutline,
        outlineColor: mesh.outlineColor ? mesh.outlineColor.clone() : new BABYLON.Color3(0, 0, 0),
        outlineWidth: mesh.outlineWidth,
      });
    }

    mesh.renderOutline = true;
    mesh.outlineColor = new BABYLON.Color3(1, 0, 0);
    mesh.outlineWidth = Math.max(mesh.outlineWidth, 0.08);
  };

  const runCollisionCheck = async () => {
    clearHighlights();
    setIsRunning(true);
    const tree = SceneTreeManager.getInstance();
    const registry = EntityRegistry.getInstance();
    const engine = registry.getPhysicsEngine();
    const scene = SceneManager.getInstance().getScene();

    if (!engine) {
      setStatus('Physics engine not initialized.');
      setIsRunning(false);
      return;
    }

    if (!scene) {
      setStatus('Scene not available.');
      setIsRunning(false);
      return;
    }

    const nodesA = groupA.map((id) => tree.getNode(id)).filter(Boolean) as SceneNode[];
    const nodesB = groupB.map((id) => tree.getNode(id)).filter(Boolean) as SceneNode[];

    if (nodesA.length === 0 || nodesB.length === 0) {
      setStatus('Pick at least one mesh in both Group A and Group B.');
      setIsRunning(false);
      return;
    }

    // Create temporary physics bodies for nodes that don't have entities
    const tempHandles: string[] = [];
    const nodeToHandleMap = new Map<SceneNode, string>();

    const createPhysicsForNode = (node: SceneNode): string | null => {
      // Try to use existing entity
      if (node.entityId) {
        const entity = registry.get(node.entityId);
        if (entity) {
          const handle = entity.ensurePhysicsBody();
          if (handle) return handle;
        }
      }

      // Create temporary physics body for this mesh
      if (!node.babylonMeshId) return null;

      const mesh = scene.getMeshByUniqueId(parseInt(node.babylonMeshId, 10)) as BABYLON.Mesh | null;
      if (!mesh) return null;

      // Compute world matrix for accurate bounds
      mesh.computeWorldMatrix(true);
      const boundingBox = mesh.getBoundingInfo().boundingBox;
      const size = boundingBox.maximum.subtract(boundingBox.minimum);
      const position = mesh.absolutePosition;
      const rotation = mesh.rotationQuaternion || BABYLON.Quaternion.Identity();

      try {
        const handle = engine.createRigidBody({
          type: 'static', // Use static for collision detection only
          shape: 'box',
          position: { x: position.x, y: position.y, z: position.z },
          rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
          dimensions: { x: size.x, y: size.y, z: size.z }
        });

        tempHandles.push(handle);
        return handle;
      } catch (error) {
        console.warn(`Failed to create physics body for ${node.name}:`, error);
        return null;
      }
    };

    // Create physics bodies for all nodes
    for (const node of [...nodesA, ...nodesB]) {
      const handle = createPhysicsForNode(node);
      if (handle) {
        nodeToHandleMap.set(node, handle);
      }
    }

    // Check collisions
    const collisionsFound: CollisionResultRow[] = [];
    const seenPairs = new Set<string>();

    for (const nodeA of nodesA) {
      const handleA = nodeToHandleMap.get(nodeA);
      if (!handleA) continue;

      for (const nodeB of nodesB) {
        const handleB = nodeToHandleMap.get(nodeB);
        if (!handleB) continue;

        if (handleA === handleB) continue;
        const key = handleA < handleB ? `${handleA}|${handleB}` : `${handleB}|${handleA}`;
        if (seenPairs.has(key)) continue;

        try {
          const isColliding = engine.checkCollision(handleA, handleB) || engine.checkBodyCollision(handleA, handleB);

          if (isColliding) {
            collisionsFound.push({ nodeA, nodeB });
            highlightNode(nodeA);
            highlightNode(nodeB);
          }
        } catch (error) {
          console.warn(`Error checking collision between ${nodeA.name} and ${nodeB.name}:`, error);
        }

        seenPairs.add(key);
      }
    }

    // Clean up temporary physics bodies
    for (const handle of tempHandles) {
      try {
        engine.removeRigidBody(handle);
      } catch (error) {
        console.warn('Error removing temporary physics body:', error);
      }
    }

    setCollisions(collisionsFound);
    setStatus(
      collisionsFound.length > 0
        ? `Detected ${collisionsFound.length} collision${collisionsFound.length === 1 ? '' : 's'}.`
        : 'No collisions detected for the selected groups.'
    );
    setIsRunning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="collision-dialog-overlay">
      <div className="collision-dialog">
        <div className="collision-dialog__header">
          <div className="collision-dialog__title">
            <AlertTriangle size={18} />
            <div>
              <div>Collision Check</div>
              <div className="collision-dialog__subtitle">
                {groupA.length === 0 && groupB.length === 0
                  ? 'Click meshes in the scene or tree, then click "Use selection" to add them to a group'
                  : groupA.length === 0
                  ? 'Add objects to Group A to continue'
                  : groupB.length === 0
                  ? 'Add objects to Group B to continue'
                  : `Ready to check ${groupA.length} vs ${groupB.length} objects`}
              </div>
            </div>
          </div>
          <button className="collision-dialog__icon-btn" onClick={() => { clearHighlights(); onClose(); }}>
            <X size={16} />
          </button>
        </div>

        <div className="collision-dialog__groups">
          <div className="collision-dialog__group">
            <div className="collision-dialog__group-header">
              <div className="collision-dialog__group-title">
                <ListChecks size={16} />
                <span>Group A ({groupA.length})</span>
              </div>
              <button
                className="collision-dialog__pill-btn"
                onClick={() => useSelectionForGroup('A')}
                disabled={selectionIds.length === 0}
                title={selectionIds.length === 0 ? 'No objects selected' : 'Add current selection to Group A'}
              >
                <MousePointer2 size={14} />
                Use selection
              </button>
              <button
                className={`collision-dialog__pill-btn ${followSelectionTarget === 'A' ? 'active' : ''}`}
                onClick={() => setFollowSelectionTarget('A')}
                title="Auto-sync Group A with scene/tree selection"
              >
                <Radio size={14} />
                Follow selection
              </button>
            </div>
            <div className="collision-dialog__list">
              {selectableNodes.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                  No selectable objects in scene
                </div>
              ) : (
                selectableNodes.map((node) => (
                  <label key={`${node.id}-A`} className="collision-dialog__row">
                    <input
                      type="checkbox"
                      checked={groupA.includes(node.id)}
                      onChange={() => toggleNodeInGroup('A', node.id)}
                    />
                    <span className="collision-dialog__row-name">{node.name}</span>
                    <span className="collision-dialog__row-type">{node.type}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="collision-dialog__group">
            <div className="collision-dialog__group-header">
              <div className="collision-dialog__group-title">
                <ListChecks size={16} />
                <span>Group B ({groupB.length})</span>
              </div>
              <button
                className="collision-dialog__pill-btn"
                onClick={() => useSelectionForGroup('B')}
                disabled={selectionIds.length === 0}
                title={selectionIds.length === 0 ? 'No objects selected' : 'Add current selection to Group B'}
              >
                <MousePointer2 size={14} />
                Use selection
              </button>
              <button
                className={`collision-dialog__pill-btn ${followSelectionTarget === 'B' ? 'active' : ''}`}
                onClick={() => setFollowSelectionTarget('B')}
                title="Auto-sync Group B with scene/tree selection"
              >
                <Radio size={14} />
                Follow selection
              </button>
            </div>
            <div className="collision-dialog__list">
              {selectableNodes.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
                  No selectable objects in scene
                </div>
              ) : (
                selectableNodes.map((node) => (
                  <label key={`${node.id}-B`} className="collision-dialog__row">
                    <input
                      type="checkbox"
                      checked={groupB.includes(node.id)}
                      onChange={() => toggleNodeInGroup('B', node.id)}
                    />
                    <span className="collision-dialog__row-name">{node.name}</span>
                    <span className="collision-dialog__row-type">{node.type}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="collision-dialog__footer">
          <div className="collision-dialog__status">
            {collisions.length > 0 ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            <span>{status}</span>
          </div>
          <div className="collision-dialog__actions">
            <button className="collision-dialog__ghost" onClick={clearHighlights}>
              Clear highlights
            </button>
            <button className="collision-dialog__ghost" onClick={() => { clearHighlights(); setCollisions([]); setGroupA([]); setGroupB([]); setStatus('Select two groups to check collisions.'); }}>
              Reset
            </button>
            <button
              className="collision-dialog__primary"
              onClick={runCollisionCheck}
              disabled={isRunning || groupA.length === 0 || groupB.length === 0}
              title={groupA.length === 0 || groupB.length === 0 ? 'Add objects to both groups first' : 'Check for collisions between groups'}
            >
              <Repeat size={14} />
              {isRunning ? 'Checking...' : 'Run collision check'}
            </button>
          </div>
        </div>

        {collisions.length > 0 && (
          <div className="collision-dialog__results">
            <div className="collision-dialog__results-title">Collisions</div>
            <div className="collision-dialog__results-list">
              {collisions.map((row, idx) => (
                <div className="collision-dialog__result-row" key={`${row.nodeA.id}-${row.nodeB.id}-${idx}`}>
                  <div className="collision-dialog__badge">A</div>
                  <div className="collision-dialog__result-name">{row.nodeA.name}</div>
                  <div className="collision-dialog__badge badge--secondary">B</div>
                  <div className="collision-dialog__result-name">{row.nodeB.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
