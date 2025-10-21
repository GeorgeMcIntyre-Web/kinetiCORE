// Hook for automatic tree resizing based on content
// Owner: Edwin

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { SceneTreeManager } from '../../scene/SceneTreeManager';

interface TreeAutoResizeOptions {
  minWidth?: number;
  maxWidth?: number;
  padding?: number;
  fontSize?: number;
  iconWidth?: number;
  arrowWidth?: number;
  badgeWidth?: number;
}

export function useTreeAutoResize(options: TreeAutoResizeOptions = {}) {
  const {
    minWidth = 200,
    maxWidth = 600,
    padding = 16,
    fontSize = 13,
    iconWidth = 16,
    arrowWidth = 14,
    badgeWidth = 40
  } = options;

  const [optimalWidth, setOptimalWidth] = useState(minWidth);
  const [isCalculating, setIsCalculating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);

  // Create a hidden canvas for text measurement
  const getCanvas = useCallback(() => {
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        context.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      }
      canvasRef.current = canvas;
    }
    return canvasRef.current;
  }, [fontSize]);

  // Calculate text width
  const getTextWidth = useCallback((text: string): number => {
    const canvas = getCanvas();
    const context = canvas.getContext('2d');
    if (!context) return text.length * fontSize * 0.6; // Fallback estimation
    
    return context.measureText(text).width;
  }, [getCanvas, fontSize]);

  // Calculate optimal width for a node and its children
  const calculateNodeWidth = useCallback((nodeId: string, level: number = 0): number => {
    const tree = SceneTreeManager.getInstance();
    const node = tree.getNode(nodeId);
    if (!node) return 0;

    // Calculate width for this node
    const levelPadding = level * 16; // 16px per level
    const nodeTextWidth = getTextWidth(node.name);
    const nodeWidth = levelPadding + arrowWidth + iconWidth + nodeTextWidth + badgeWidth + padding;

    // Calculate width for children
    const children = tree.getChildren(nodeId);
    let maxChildWidth = 0;
    
    if (node.expanded && children.length > 0) {
      for (const child of children) {
        const childWidth = calculateNodeWidth(child.id, level + 1);
        maxChildWidth = Math.max(maxChildWidth, childWidth);
      }
    }

    return Math.max(nodeWidth, maxChildWidth);
  }, [getTextWidth, arrowWidth, iconWidth, badgeWidth, padding]);

  // Calculate optimal width for the entire tree
  const calculateOptimalWidth = useCallback(() => {
    setIsCalculating(true);
    
    try {
      const tree = SceneTreeManager.getInstance();
      const rootNode = tree.getRootNode();
      
      if (!rootNode) {
        console.log('🔄 No root node found, using minimum width');
        setOptimalWidth(minWidth);
        return;
      }

      const treeWidth = calculateNodeWidth(rootNode.id);
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, treeWidth));
      
      console.log(`🔄 Calculated optimal tree width: ${treeWidth}px, clamped to: ${clampedWidth}px`);
      setOptimalWidth(clampedWidth);
    } catch (error) {
      console.warn('Error calculating tree width:', error);
      setOptimalWidth(minWidth);
    } finally {
      setIsCalculating(false);
    }
  }, [calculateNodeWidth, minWidth, maxWidth]);

  // Recalculate when tree structure changes
  useEffect(() => {
    const tree = SceneTreeManager.getInstance();
    
    // Calculate initial width
    calculateOptimalWidth();

    // Listen for tree update events (dispatched during imports, etc.)
    const handleTreeUpdate = () => {
      console.log('🔄 Tree update event received, recalculating optimal width...');
      // Add a small delay to ensure tree is fully updated
      setTimeout(() => {
        calculateOptimalWidth();
      }, 100);
    };

    // Add event listener for tree updates
    window.addEventListener('scenetree-update', handleTreeUpdate);

    // Fallback polling for cases where events might be missed
    const interval = setInterval(() => {
      const rootNode = tree.getRootNode();
      if (rootNode) {
        const nodeCount = tree.getAllNodes().length;
        if (nodeCount !== (window as any).__lastTreeNodeCount) {
          (window as any).__lastTreeNodeCount = nodeCount;
          console.log('🔄 Tree structure changed, recalculating optimal width...');
          calculateOptimalWidth();
        }
      }
    }, 2000); // Reduced frequency since we have event listeners

    return () => {
      window.removeEventListener('scenetree-update', handleTreeUpdate);
      clearInterval(interval);
    };
  }, [calculateOptimalWidth]);

  // Recalculate when selection changes (might affect visibility)
  useEffect(() => {
    calculateOptimalWidth();
  }, [selectedNodeId, selectedNodeIds, calculateOptimalWidth]);

  return {
    optimalWidth,
    isCalculating,
    recalculate: calculateOptimalWidth
  };
}
