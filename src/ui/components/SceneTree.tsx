// Scene Tree - Hierarchical view of scene objects
// Owner: Edwin

import { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import type { SceneNode, NodeType } from '../../scene/SceneTreeNode';
import {
  Globe,
  Folder,
  FolderOpen,
  Box,
  Circle,
  Cylinder as CylinderIcon,
  Package,
  Bot,
  Hand,
  Cpu,
  Link2,
  Settings,
  Camera,
  Lightbulb,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Edit3,
} from 'lucide-react';
import './SceneTree.css';

/**
 * Get icon component for node type
 */
function getNodeIcon(type: NodeType, expanded?: boolean): React.ReactNode {
  const iconProps = { size: 16 };

  switch (type) {
    case 'world':
      return <Globe {...iconProps} />;
    case 'scene':
    case 'system':
      return <Folder {...iconProps} />;
    case 'collection':
      return expanded ? <FolderOpen {...iconProps} /> : <Folder {...iconProps} />;
    case 'box':
      return <Box {...iconProps} />;
    case 'sphere':
      return <Circle {...iconProps} />;
    case 'cylinder':
      return <CylinderIcon {...iconProps} />;
    case 'mesh':
      return <Package {...iconProps} />;
    case 'robot':
      return <Bot {...iconProps} />;
    case 'gripper':
      return <Hand {...iconProps} />;
    case 'actuator':
      return <Cpu {...iconProps} />;
    case 'link':
      return <Link2 {...iconProps} />;
    case 'joint':
      return <Settings {...iconProps} />;
    case 'camera':
      return <Camera {...iconProps} />;
    case 'light':
      return <Lightbulb {...iconProps} />;
    default:
      return <Package {...iconProps} />;
  }
}

/**
 * Tree node component (recursive)
 */
interface TreeNodeProps {
  node: SceneNode;
  level: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level }) => {
  const tree = SceneTreeManager.getInstance();
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectNode = useEditorStore((state) => state.selectNode);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const deleteNode = useEditorStore((state) => state.deleteNode);
  const renameNode = useEditorStore((state) => state.renameNode);
  const moveNode = useEditorStore((state) => state.moveNode);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);

  const children = tree.getChildren(node.id);
  const hasChildren = children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const canDelete = node.type !== 'world' && node.type !== 'scene' && node.type !== 'system';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) {
      clearSelection();
    } else {
      selectNode(node.id);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    tree.toggleExpanded(node.id);
    // Force re-render
    window.dispatchEvent(new Event('scenetree-update'));
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    tree.toggleVisibility(node.id);
    window.dispatchEvent(new Event('scenetree-update'));
  };

  const handleToggleLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    tree.toggleLocked(node.id);
    window.dispatchEvent(new Event('scenetree-update'));
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canDelete && window.confirm(`Delete "${node.name}" and all its children?`)) {
      deleteNode(node.id);
    }
  };

  const handleRenameStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(true);
    setRenameName(node.name);
  };

  const handleRenameSubmit = () => {
    if (renameName.trim() && renameName !== node.name) {
      renameNode(node.id, renameName.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameName(node.name);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (node.locked) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('nodeId', node.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only allow drop on containers
    if (node.type === 'collection' || node.type === 'scene' || node.type === 'world') {
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const draggedNodeId = e.dataTransfer.getData('nodeId');
    if (draggedNodeId && draggedNodeId !== node.id) {
      moveNode(draggedNodeId, node.id);
    }
  };

  return (
    <div className="tree-node">
      <div
        className={`tree-node-row ${isSelected ? 'selected' : ''} ${node.locked ? 'locked' : ''} ${isDragOver ? 'drag-over' : ''}`}
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={handleClick}
        draggable={!node.locked && canDelete}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/collapse arrow */}
        <div className="tree-node-arrow" onClick={handleToggleExpand}>
          {hasChildren ? (
            node.expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span style={{ width: '14px', display: 'inline-block' }} />
          )}
        </div>

        {/* Icon */}
        <div className="tree-node-icon">{getNodeIcon(node.type, node.expanded)}</div>

        {/* Name */}
        <div className="tree-node-name">
          {isRenaming ? (
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') handleRenameCancel();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              style={{
                background: '#333',
                border: '1px solid #646cff',
                color: 'white',
                padding: '2px 4px',
                borderRadius: '2px',
                outline: 'none',
                width: '150px',
              }}
            />
          ) : (
            <>
              {node.name}
              {hasChildren && <span className="tree-node-count">({children.length})</span>}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="tree-node-actions">
          {/* Visibility toggle */}
          <button
            className="tree-node-action"
            onClick={handleToggleVisibility}
            title={node.visible ? 'Hide' : 'Show'}
          >
            {node.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          {/* Lock toggle */}
          <button
            className="tree-node-action"
            onClick={handleToggleLock}
            title={node.locked ? 'Locked' : 'Unlocked'}
            disabled={!canDelete}
          >
            {node.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>

          {/* Rename button */}
          {canDelete && !isRenaming && (
            <button
              className="tree-node-action"
              onClick={handleRenameStart}
              title="Rename"
            >
              <Edit3 size={14} />
            </button>
          )}

          {/* Delete button */}
          {canDelete && (
            <button
              className="tree-node-action"
              onClick={handleDelete}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && node.expanded && (
        <div className="tree-node-children">
          {children.map((child) => (
            <TreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Scene Tree component
 */
export const SceneTree: React.FC = () => {
  const [, forceUpdate] = useState(0);
  const tree = SceneTreeManager.getInstance();
  const rootNode = tree.getRootNode();

  // Listen for tree updates
  useEffect(() => {
    const handleUpdate = () => {
      forceUpdate((n) => n + 1);
    };

    window.addEventListener('scenetree-update', handleUpdate);
    return () => {
      window.removeEventListener('scenetree-update', handleUpdate);
    };
  }, [tree]);

  if (!rootNode) {
    return (
      <div className="scene-tree">
        <div className="scene-tree-header">
          <h2>Scene</h2>
        </div>
        <div className="scene-tree-content">
          <p>No scene loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scene-tree">
      <div className="scene-tree-header">
        <h2>Scene</h2>
      </div>
      <div className="scene-tree-content">
        <TreeNode node={rootNode} level={0} />
      </div>
    </div>
  );
};
