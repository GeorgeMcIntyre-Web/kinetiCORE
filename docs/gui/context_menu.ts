// ContextMenu - Right-click context menu system
// Owner: Edwin
// Location: src/ui/components/ContextMenu.tsx

import { useEffect, useState, useRef } from 'react';
import {
  Copy, Trash2, Eye, EyeOff, Lock, Unlock, Edit3, ZoomIn,
  Box, Circle, Cylinder as CylinderIcon, Folder, Play
} from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  disabled?: boolean;
  divider?: boolean;
  shortcut?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position if menu would go off-screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const adjustedX = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 10 : x;
      const adjustedY = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 10 : y;
      
      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled) {
      item.action();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-2 min-w-[200px] z-[1000]"
      style={{ left: x, top: y }}
    >
      {items.map((item, idx) => (
        <div key={idx}>
          {item.divider ? (
            <div className="h-px bg-gray-700 my-1" />
          ) : (
            <button
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              className={`
                w-full px-4 py-2 flex items-center gap-3 text-left text-sm
                ${item.disabled 
                  ? 'text-gray-600 cursor-not-allowed' 
                  : 'text-gray-200 hover:bg-gray-700 cursor-pointer'
                }
              `}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <kbd className="text-xs text-gray-500 font-mono">{item.shortcut}</kbd>
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// Hook for viewport context menu
export const useViewportContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const showContextMenu = (e: React.MouseEvent, createObject: (type: string) => void) => {
    e.preventDefault();
    
    const items: ContextMenuItem[] = [
      {
        label: 'Add Box',
        icon: <Box size={16} />,
        action: () => createObject('box'),
      },
      {
        label: 'Add Sphere',
        icon: <Circle size={16} />,
        action: () => createObject('sphere'),
      },
      {
        label: 'Add Cylinder',
        icon: <CylinderIcon size={16} />,
        action: () => createObject('cylinder'),
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Add Collection',
        icon: <Folder size={16} />,
        action: () => {}, // Will connect to store
      },
    ];

    setContextMenu({ x: e.clientX, y: e.clientY });
    return items;
  };

  const hideContextMenu = () => setContextMenu(null);

  return { contextMenu, showContextMenu, hideContextMenu };
};

// Hook for scene tree node context menu
export const useNodeContextMenu = () => {
  const getNodeMenuItems = (
    nodeId: string,
    nodeName: string,
    nodeType: string,
    isVisible: boolean,
    isLocked: boolean,
    canDelete: boolean,
    actions: {
      onRename: () => void;
      onDuplicate: () => void;
      onDelete: () => void;
      onToggleVisibility: () => void;
      onToggleLock: () => void;
      onZoom: () => void;
    }
  ): ContextMenuItem[] => {
    return [
      {
        label: 'Rename',
        icon: <Edit3 size={16} />,
        action: actions.onRename,
        shortcut: 'F2',
      },
      {
        label: 'Duplicate',
        icon: <Copy size={16} />,
        action: actions.onDuplicate,
        disabled: !canDelete,
        shortcut: 'Ctrl+D',
      },
      { divider: true } as ContextMenuItem,
      {
        label: isVisible ? 'Hide' : 'Show',
        icon: isVisible ? <EyeOff size={16} /> : <Eye size={16} />,
        action: actions.onToggleVisibility,
        shortcut: 'H',
      },
      {
        label: isLocked ? 'Unlock' : 'Lock',
        icon: isLocked ? <Unlock size={16} /> : <Lock size={16} />,
        action: actions.onToggleLock,
        disabled: !canDelete,
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Frame Selected',
        icon: <ZoomIn size={16} />,
        action: actions.onZoom,
        shortcut: 'F',
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Delete',
        icon: <Trash2 size={16} />,
        action: actions.onDelete,
        disabled: !canDelete,
        shortcut: 'Del',
      },
    ];
  };

  return { getNodeMenuItems };
};

// Hook for object context menu (in viewport)
export const useObjectContextMenu = () => {
  const getObjectMenuItems = (
    hasPhysics: boolean,
    actions: {
      onDuplicate: () => void;
      onDelete: () => void;
      onTogglePhysics: () => void;
      onZoom: () => void;
      onIsolate: () => void;
    }
  ): ContextMenuItem[] => {
    return [
      {
        label: 'Frame Selected',
        icon: <ZoomIn size={16} />,
        action: actions.onZoom,
        shortcut: 'F',
      },
      {
        label: 'Isolate',
        icon: <Eye size={16} />,
        action: actions.onIsolate,
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Duplicate',
        icon: <Copy size={16} />,
        action: actions.onDuplicate,
        shortcut: 'Ctrl+D',
      },
      { divider: true } as ContextMenuItem,
      {
        label: hasPhysics ? 'Disable Physics' : 'Enable Physics',
        icon: <Play size={16} />,
        action: actions.onTogglePhysics,
        shortcut: 'P',
      },
      { divider: true } as ContextMenuItem,
      {
        label: 'Delete',
        icon: <Trash2 size={16} />,
        action: actions.onDelete,
        shortcut: 'Del',
      },
    ];
  };

  return { getObjectMenuItems };
};
