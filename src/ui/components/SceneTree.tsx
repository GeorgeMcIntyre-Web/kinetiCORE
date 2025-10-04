// Scene Tree - Hierarchical view of scene objects
// Owner: Edwin

import { useEffect, useState, useMemo } from 'react';
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
  Search,
  X,
  Layers,
  Anchor,
} from 'lucide-react';
import { ContextMenu, useNodeContextMenu } from './ContextMenu';
import { EntityRegistry } from '../../entities/EntityRegistry';
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
 * Get status badges for a node
 */
function getNodeStatusBadges(node: SceneNode): JSX.Element[] {
  const badges: JSX.Element[] = [];
  const registry = EntityRegistry.getInstance();

  // Check if node has an entity with physics enabled
  if (node.entityId) {
    const entity = registry.get(node.entityId);
    if (entity && entity.isPhysicsEnabled()) {
      badges.push(
        <span key="physics" className="status-badge physics" title="Physics enabled">
          P
        </span>
      );
    }
  }

  // Check if node is grounded (kinematic)
  if (node.type === 'link' && node.linkData) {
    badges.push(
      <span key="grounded" className="status-badge grounded" title="Grounded">
        <Anchor size={10} />
      </span>
    );
  }

  // Check if node has constraints/joints
  if (node.type === 'joint' || node.jointData) {
    badges.push(
      <span key="constraint" className="status-badge constraint" title="Constrained">
        <Layers size={10} />
      </span>
    );
  }

  return badges;
}

/**
 * Filter nodes based on search term (recursive)
 */
function nodeMatchesSearch(node: SceneNode, searchTerm: string): boolean {
  if (!searchTerm) return true;

  const lowerSearch = searchTerm.toLowerCase();

  // Check node name
  if (node.name.toLowerCase().includes(lowerSearch)) {
    return true;
  }

  // Check node type
  if (node.type.toLowerCase().includes(lowerSearch)) {
    return true;
  }

  // Check tags
  if (node.tags?.some(tag => tag.toLowerCase().includes(lowerSearch))) {
    return true;
  }

  return false;
}

/**
 * Check if node or any of its children match search
 */
function nodeOrChildrenMatchSearch(
  node: SceneNode,
  searchTerm: string,
  tree: SceneTreeManager
): boolean {
  if (nodeMatchesSearch(node, searchTerm)) {
    return true;
  }

  // Check children
  const children = tree.getChildren(node.id);
  return children.some(child => nodeOrChildrenMatchSearch(child, searchTerm, tree));
}

/**
 * Tree node component (recursive)
 */
interface TreeNodeProps {
  node: SceneNode;
  level: number;
  searchTerm: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level, searchTerm }) => {
  const tree = SceneTreeManager.getInstance();
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  const selectNode = useEditorStore((state) => state.selectNode);
  const toggleNodeSelection = useEditorStore((state) => state.toggleNodeSelection);
  const zoomToNode = useEditorStore((state) => state.zoomToNode);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const deleteNode = useEditorStore((state) => state.deleteNode);
  const renameNode = useEditorStore((state) => state.renameNode);
  const moveNode = useEditorStore((state) => state.moveNode);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const { getNodeMenuItems } = useNodeContextMenu();

  const children = tree.getChildren(node.id);
  const hasChildren = children.length > 0;
  const isSelected = selectedNodeId === node.id || selectedNodeIds.includes(node.id);
  const canDelete = node.type !== 'world' &&
                    node.type !== 'scene' &&
                    node.type !== 'system';

  // Filter visibility based on search
  const shouldShow = nodeOrChildrenMatchSearch(node, searchTerm, tree);
  const isHighlighted = searchTerm && nodeMatchesSearch(node, searchTerm);

  // Get status badges
  const statusBadges = useMemo(() => getNodeStatusBadges(node), [node]);

  // Don't render if filtered out by search
  if (!shouldShow) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Ctrl+Click or Cmd+Click for multi-selection
    if (e.ctrlKey || e.metaKey) {
      toggleNodeSelection(node.id);
    } else if (isSelected) {
      clearSelection();
    } else {
      selectNode(node.id);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Zoom to mesh nodes or collection nodes (TransformNodes with children)
    if (node.type === 'mesh' || node.type === 'collection') {
      zoomToNode(node.id);
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems = contextMenu ? getNodeMenuItems(
    node.id,
    node.name,
    node.type,
    node.visible,
    node.locked,
    canDelete,
    {
      onRename: () => setIsRenaming(true),
      onDuplicate: () => {}, // TODO: Implement duplicate
      onDelete: () => handleDelete({} as React.MouseEvent),
      onToggleVisibility: () => handleToggleVisibility({} as React.MouseEvent),
      onToggleLock: () => handleToggleLock({} as React.MouseEvent),
      onZoom: () => zoomToNode(node.id),
    }
  ) : [];

  return (
    <div className="tree-node">
      <div
        className={`tree-node-row
          ${isSelected ? 'selected' : ''}
          ${node.locked ? 'locked' : ''}
          ${isDragOver ? 'drag-over' : ''}
          ${isHighlighted ? 'highlighted' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
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
        <div className="tree-node-name" title={node.name}>
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
              {statusBadges.length > 0 && (
                <div className="tree-node-badges">
                  {statusBadges}
                </div>
              )}
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
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

/**
 * Scene Tree component
 */
export const SceneTree: React.FC = () => {
  const [, forceUpdate] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const tree = SceneTreeManager.getInstance();
  const rootNode = tree.getRootNode();
  const createCollection = useEditorStore((state) => state.createCollection);
  const deleteNode = useEditorStore((state) => state.deleteNode);

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

  // Handle Ctrl+F to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('.scene-tree-search input');
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const handleGroupSelected = () => {
    if (selectedNodes.length > 1) {
      createCollection(`Group_${Date.now()}`);
      setSelectedNodes([]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedNodes.length > 0) {
      const confirmed = window.confirm(
        `Delete ${selectedNodes.length} selected items?`
      );
      if (confirmed) {
        selectedNodes.forEach(nodeId => deleteNode(nodeId));
        setSelectedNodes([]);
      }
    }
  };

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

      {/* Search bar */}
      <div className="scene-tree-search">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search scene (Ctrl+F)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            className="clear-search"
            onClick={handleClearSearch}
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Bulk operations panel */}
      {selectedNodes.length > 1 && (
        <div className="bulk-operations">
          <span className="bulk-count">{selectedNodes.length} items selected</span>
          <div className="bulk-actions">
            <button onClick={handleGroupSelected} title="Group selected items">
              <Layers size={14} />
              Group
            </button>
            <button
              onClick={handleDeleteSelected}
              title="Delete selected items"
              className="delete-btn"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="scene-tree-content">
        <TreeNode node={rootNode} level={0} searchTerm={searchTerm} />
      </div>
    </div>
  );
};
