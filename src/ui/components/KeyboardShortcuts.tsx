// KeyboardShortcuts - Global keyboard shortcut system
// Owner: Edwin
// Location: src/ui/components/KeyboardShortcuts.tsx

import { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Command } from 'lucide-react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  category: string;
}

export const KeyboardShortcuts: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);

  const setTransformMode = useEditorStore((state) => state.setTransformMode);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const deleteNode = useEditorStore((state) => state.deleteNode);
  const duplicateNode = useEditorStore((state) => state.duplicateNode);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const togglePhysics = useEditorStore((state) => state.togglePhysics);
  const zoomToNode = useEditorStore((state) => state.zoomToNode);
  const zoomFit = useEditorStore((state) => state.zoomFit);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  const shortcuts: Shortcut[] = [
    // Transform modes
    { key: 'g', description: 'Move/Translate', action: () => setTransformMode('translate'), category: 'Transform' },
    { key: 'r', description: 'Rotate', action: () => setTransformMode('rotate'), category: 'Transform' },
    { key: 's', description: 'Scale', action: () => setTransformMode('scale'), category: 'Transform' },

    // Selection
    { key: 'a', ctrl: true, description: 'Select All', action: () => {}, category: 'Selection' },
    { key: 'Escape', description: 'Clear Selection', action: () => clearSelection(), category: 'Selection' },
    { key: 'f', description: 'Frame Selected', action: () => selectedNodeId && zoomToNode(selectedNodeId), category: 'Selection' },

    // Object operations
    { key: 'Delete', description: 'Delete Selected', action: () => selectedNodeId && deleteNode(selectedNodeId), category: 'Edit' },
    { key: 'Backspace', description: 'Delete Selected', action: () => selectedNodeId && deleteNode(selectedNodeId), category: 'Edit' },
    { key: 'd', ctrl: true, description: 'Duplicate', action: () => selectedNodeId && duplicateNode(selectedNodeId), category: 'Edit' },
    { key: 'z', ctrl: true, description: 'Undo', action: () => undo(), category: 'Edit' },
    { key: 'y', ctrl: true, description: 'Redo', action: () => redo(), category: 'Edit' },
    { key: 'h', description: 'Toggle Visibility', action: () => {}, category: 'Edit' },

    // Physics
    { key: 'p', description: 'Toggle Physics', action: () => selectedNodeId && togglePhysics(selectedNodeId), category: 'Physics' },
    { key: ' ', description: 'Play/Pause Simulation', action: () => {}, category: 'Physics' },

    // Quick add (placeholder - will be implemented in QuickAddMenu)
    { key: 'a', shift: true, description: 'Quick Add Menu', action: () => {}, category: 'Create' },

    // View
    { key: '1', description: 'Front View', action: () => {}, category: 'View' },
    { key: '3', description: 'Side View', action: () => {}, category: 'View' },
    { key: '7', description: 'Top View', action: () => {}, category: 'View' },
    { key: '0', description: 'Camera View', action: () => {}, category: 'View' },
    { key: '.', description: 'Zoom Fit All', action: () => zoomFit(), category: 'View' },

    // Help
    { key: '?', description: 'Show Shortcuts', action: () => setShowHelp(!showHelp), category: 'Help' },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Allow Delete/Backspace in input fields
        if (e.key !== 'Delete' && e.key !== 'Backspace') {
          return;
        }
      }

      // Find matching shortcut
      const shortcut = shortcuts.find(s => {
        const keyMatch = s.key.toLowerCase() === e.key.toLowerCase();
        const ctrlMatch = s.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = s.alt ? e.altKey : !e.altKey;
        return keyMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (shortcut) {
        e.preventDefault();
        shortcut.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, selectedNodeId]);

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  const formatShortcut = (shortcut: Shortcut): string => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase());
    return parts.join(' + ');
  };

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="bg-gray-900 border-2 border-blue-500 rounded-lg p-8 max-w-4xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <Command className="w-8 h-8 text-blue-400" />
          <h2 className="text-3xl font-bold text-white">Keyboard Shortcuts</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {categories.map(category => (
            <div key={category} className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-400 mb-3">{category}</h3>
              <div className="space-y-2">
                {shortcuts
                  .filter(s => s.category === category)
                  .map((shortcut, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="text-gray-300">{shortcut.description}</span>
                      <kbd className="px-2 py-1 bg-gray-700 rounded text-xs font-mono text-gray-200">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => setShowHelp(false)}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold"
          >
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
