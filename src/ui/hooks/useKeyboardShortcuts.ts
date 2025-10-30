// Global keyboard shortcuts hook
// Owner: George (Architecture)

import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';

export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { undo, redo, duplicateNode, deleteNode, selectedNodeId, zoomIn, zoomOut, toggleCameraMode } = useEditorStore.getState();

      // Ctrl/Cmd + Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl/Cmd + D: Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedNodeId) {
          duplicateNode(selectedNodeId);
        }
        return;
      }

      // Delete: Delete selected object
      if (e.key === 'Delete' && selectedNodeId) {
        // Don't trigger delete if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        deleteNode(selectedNodeId);
        return;
      }

      // Shift + = or Shift + +: Zoom in
      if ((e.key === '=' || e.key === '+') && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        zoomIn();
        return;
      }

      // Shift + -: Zoom out
      if (e.key === '-' && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        zoomOut();
        return;
      }

      // Ctrl/Cmd + Shift + C: Toggle camera mode (orthographic/perspective)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        toggleCameraMode();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
