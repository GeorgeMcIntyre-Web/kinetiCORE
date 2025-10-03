// QuickAddMenu - Fast object creation menu (Shift+A)
// Owner: Edwin
// Location: src/ui/components/QuickAddMenu.tsx

import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import {
  Box, Circle, Cylinder as CylinderIcon, Folder,
  Camera, Lightbulb, Search, ChevronRight
} from 'lucide-react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords?: string[];
}

export const QuickAddMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const createObject = useEditorStore((state) => state.createObject);
  const createCollection = useEditorStore((state) => state.createCollection);

  const menuItems: MenuItem[] = [
    // Primitives
    {
      label: 'Box',
      icon: <Box size={18} />,
      action: () => { createObject('box'); close(); },
      category: 'Mesh',
      keywords: ['cube', 'primitive', 'geometry'],
    },
    {
      label: 'Sphere',
      icon: <Circle size={18} />,
      action: () => { createObject('sphere'); close(); },
      category: 'Mesh',
      keywords: ['ball', 'primitive', 'geometry'],
    },
    {
      label: 'Cylinder',
      icon: <CylinderIcon size={18} />,
      action: () => { createObject('cylinder'); close(); },
      category: 'Mesh',
      keywords: ['tube', 'primitive', 'geometry'],
    },
    // Organization
    {
      label: 'Collection',
      icon: <Folder size={18} />,
      action: () => { createCollection(); close(); },
      category: 'Organization',
      keywords: ['folder', 'group'],
    },
    // Future additions
    {
      label: 'Camera',
      icon: <Camera size={18} />,
      action: () => close(),
      category: 'System',
      keywords: ['view', 'perspective'],
    },
    {
      label: 'Light',
      icon: <Lightbulb size={18} />,
      action: () => close(),
      category: 'System',
      keywords: ['illumination', 'lighting'],
    },
  ];

  const filteredItems = menuItems.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.label.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term) ||
      item.keywords?.some(k => k.includes(term))
    );
  });

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const open = (x: number, y: number) => {
    setMousePosition({ x, y });
    setIsOpen(true);
    setSearchTerm('');
    setSelectedIndex(0);
  };

  const close = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open menu with Shift+A
      if (e.shiftKey && e.key.toLowerCase() === 'a' && !isOpen) {
        // Don't open if typing in input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        // Open at cursor position (store from last mouse move)
        open(mousePosition.x, mousePosition.y);
      }

      // Close menu with Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }

      // Navigate with arrow keys
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
        }
        if (e.key === 'Enter' && filteredItems[selectedIndex]) {
          e.preventDefault();
          filteredItems[selectedIndex].action();
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isOpen, selectedIndex, filteredItems, mousePosition]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Adjust position to keep menu on screen
  const menuX = Math.min(mousePosition.x, window.innerWidth - 320);
  const menuY = Math.min(mousePosition.y, window.innerHeight - 400);

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-900 border-2 border-blue-500 rounded-lg shadow-2xl z-[1000] w-80"
      style={{ left: menuX, top: menuY }}
    >
      {/* Search bar */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center gap-2 bg-gray-800 rounded px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search to add..."
            className="flex-1 bg-transparent outline-none text-white text-sm"
          />
        </div>
      </div>

      {/* Menu items */}
      <div className="max-h-96 overflow-y-auto">
        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category} className="py-2">
            <div className="px-4 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {category}
            </div>
            {items.map((item, idx) => {
              const globalIndex = filteredItems.indexOf(item);
              const isSelected = globalIndex === selectedIndex;

              return (
                <button
                  key={`${category}-${idx}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(globalIndex)}
                  className={`
                    w-full px-4 py-2 flex items-center gap-3 text-left text-sm
                    ${isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-200 hover:bg-gray-800'
                    }
                  `}
                >
                  <span className={isSelected ? 'text-white' : 'text-blue-400'}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight size={14} className="text-gray-600" />
                </button>
              );
            })}
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No items found for "{searchTerm}"
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500 flex items-center justify-between">
        <span>↑↓ Navigate • Enter Select</span>
        <span>Esc Close</span>
      </div>
    </div>
  );
};
