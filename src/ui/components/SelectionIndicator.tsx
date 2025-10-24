/**
 * SelectionIndicator - Always-visible indicator showing current selection
 * Owner: Agent 6 (Edwin)
 *
 * A small, unobtrusive UI element that displays the name of the currently
 * selected object(s) in the 3D world. Positioned in the bottom-left corner.
 *
 * Features:
 * - Always visible, never hidden
 * - Shows object name and type icon
 * - Multi-selection support with count
 * - Hover to see full name if truncated
 * - Responsive design for different screen sizes
 */

import React, { useMemo, useState } from 'react';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { SceneNode } from '../../scene/SceneTreeNode';
import './SelectionIndicator.css';

interface SelectionIndicatorProps {
  selectedNodeIds: string[];
  className?: string;
}

interface DisplayInfo {
  text: string;
  isEmpty: boolean;
  objectType: string | null;
  fullDetails?: string;
}

// Helper functions defined at module level before component

function buildNodeDetails(node: SceneNode): string {
  const parts: string[] = [];
  parts.push(`Name: ${node.name}`);
  parts.push(`Type: ${node.type}`);
  if (node.parentId) {
    const parent = SceneTreeManager.getInstance().getNode(node.parentId);
    if (parent) {
      parts.push(`Parent: ${parent.name}`);
    }
  }
  parts.push(`Visible: ${node.visible ? 'Yes' : 'No'}`);
  if (node.locked) {
    parts.push(`Locked: Yes`);
  }
  return parts.join(' | ');
}

function getTypeIcon(type: string | null): string {
  if (!type) return '📍';

  switch (type) {
    case 'mesh':
      return '🔷';
    case 'robot':
      return '🤖';
    case 'joint':
      return '⚙️';
    case 'collection':
      return '📁';
    case 'multiple':
      return '📦';
    case 'world':
      return '🌍';
    case 'scene':
      return '🎬';
    case 'system':
      return '⚡';
    default:
      return '📍';
  }
}

export const SelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  selectedNodeIds,
  className = '',
}) => {
  const [_showDetails, setShowDetails] = useState(false);

  const displayInfo = useMemo((): DisplayInfo => {
    if (selectedNodeIds.length === 0) {
      return {
        text: 'No selection',
        isEmpty: true,
        objectType: null,
        fullDetails: 'Click an object in the 3D viewport to select it',
      };
    }

    const tree = SceneTreeManager.getInstance();

    if (selectedNodeIds.length === 1) {
      // Single selection - show object name and type
      const node = tree.getNode(selectedNodeIds[0]);
      if (node) {
        const details = buildNodeDetails(node);
        return {
          text: node.name,
          isEmpty: false,
          objectType: node.type,
          fullDetails: details,
        };
      }
      return {
        text: 'Unknown object',
        isEmpty: false,
        objectType: null,
        fullDetails: 'Selected object not found in scene tree',
      };
    }

    // Multiple selection - show count and object types
    const nodes = selectedNodeIds
      .map(id => tree.getNode(id))
      .filter((node): node is SceneNode => node !== undefined);

    const typeCount = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeSummary = Object.entries(typeCount)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');

    return {
      text: `${selectedNodeIds.length} objects selected`,
      isEmpty: false,
      objectType: 'multiple',
      fullDetails: `Selection: ${typeSummary}`,
    };
  }, [selectedNodeIds]);

  return (
    <div
      className={`selection-indicator ${displayInfo.isEmpty ? 'no-selection' : ''} ${className}`}
      title={displayInfo.fullDetails || displayInfo.text}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <span className="selection-indicator-icon">
        {getTypeIcon(displayInfo.objectType)}
      </span>
      <span className="selection-indicator-text">
        {displayInfo.text}
      </span>
      {/* Optional: Show a subtle badge for multi-selection count */}
      {selectedNodeIds.length > 1 && (
        <span className="selection-indicator-badge">
          {selectedNodeIds.length}
        </span>
      )}
    </div>
  );
};
