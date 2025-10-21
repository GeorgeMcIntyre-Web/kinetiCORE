/**
 * FloatingPanel - Clean Dark Floating UI Component
 * Owner: Edwin
 * 
 * A consistent, draggable floating panel system for all UI panels
 * Features: drag-to-move, minimize/maximize, dock/undock, clean dark design
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Minimize2,
  Maximize2,
  X,
  Move,
  Pin,
  PinOff,
} from 'lucide-react';
import './FloatingPanel.css';

export type DockPosition = 'floating' | 'left' | 'right' | 'bottom';
export type PanelSize = 'small' | 'medium' | 'large' | 'custom';

interface FloatingPanelProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  
  // Panel configuration
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  defaultDockPosition?: DockPosition;
  defaultMinimized?: boolean;
  
  // Panel behavior
  draggable?: boolean;
  resizable?: boolean;
  minimizable?: boolean;
  dockable?: boolean;
  closable?: boolean;
  
  // Panel constraints
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  
  // Custom styling
  className?: string;
  style?: React.CSSProperties;
  
  // Panel state
  isVisible?: boolean;
  zIndex?: number;
}

export function FloatingPanel({
  title,
  icon,
  children,
  onClose,
  onMinimize,
  onMaximize,
  defaultPosition,
  defaultSize = { width: 450, height: 650 },
  defaultDockPosition = 'floating',
  defaultMinimized = false,
  draggable = true,
  resizable = true,
  minimizable = true,
  dockable = true,
  closable = true,
  minWidth = 300,
  minHeight = 200,
  maxWidth = 1200,
  maxHeight = 800,
  className = '',
  style = {},
  isVisible = true,
  zIndex = 1000,
}: FloatingPanelProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const [dockPosition, setDockPosition] = useState<DockPosition>(defaultDockPosition);
  const [position, setPosition] = useState(() => {
    if (defaultPosition) return defaultPosition;
    // Center panel on screen
    return {
      x: (window.innerWidth - defaultSize.width) / 2,
      y: (window.innerHeight - defaultSize.height) / 2,
    };
  });
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  const resizeStartMouse = useRef({ x: 0, y: 0 });

  // Handle panel dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (
      dockPosition !== 'floating' ||
      !draggable ||
      !(e.target as HTMLElement).closest('.floating-panel-header')
    ) {
      return;
    }

    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  }, [dockPosition, draggable]);

  // Handle panel resizing
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (!resizable || dockPosition !== 'floating') return;

    e.stopPropagation();
    setIsResizing(true);
    resizeStartSize.current = { width: size.width, height: size.height };
    resizeStartMouse.current = { x: e.clientX, y: e.clientY };
  }, [resizable, dockPosition, size.width, size.height]);

  // Mouse move handler for dragging and resizing
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && panelRef.current) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        });
      }
      
      if (isResizing && panelRef.current) {
        const deltaX = e.clientX - resizeStartMouse.current.x;
        const deltaY = e.clientY - resizeStartMouse.current.y;
        const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartSize.current.width + deltaX));
        const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStartSize.current.height + deltaY));
        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, position.x, position.y, minWidth, minHeight, maxWidth, maxHeight]);

  // Handle minimize
  const handleMinimize = () => {
    setIsMinimized(true);
    onMinimize?.();
  };

  // Handle maximize/restore
  const handleMaximize = () => {
    if (isMinimized) {
      setIsMinimized(false);
    } else {
      // Toggle dock position
      setDockPosition(dockPosition === 'floating' ? 'right' : 'floating');
    }
    onMaximize?.();
  };

  // Handle close
  const handleClose = () => {
    onClose?.();
  };

  // Handle pin toggle
  const handlePinToggle = () => {
    setIsPinned(!isPinned);
  };

  if (!isVisible) return null;

  if (isMinimized) {
    return (
      <div
        className="floating-panel minimized"
        onClick={() => setIsMinimized(false)}
        title={`Open ${title}`}
        style={{ zIndex }}
      >
        {icon || <Move size={24} />}
      </div>
    );
  }

  const panelClasses = [
    'floating-panel',
    dockPosition !== 'floating' && `docked-${dockPosition}`,
    isDragging && 'dragging',
    isResizing && 'resizing',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const panelStyle = {
    ...style,
    zIndex,
    ...(dockPosition === 'floating' && {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
    }),
  };

  return (
    <div
      ref={panelRef}
      className={panelClasses}
      style={panelStyle}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="floating-panel-header">
        <div className="floating-panel-title-section">
          {icon && <div className="floating-panel-icon">{icon}</div>}
          <h3 className="floating-panel-title">{title}</h3>
          {isPinned && (
            <span className="floating-panel-pin-indicator">
              <Pin size={12} />
            </span>
          )}
        </div>
        
        <div className="floating-panel-controls">
          {dockable && (
            <button
              className={`floating-panel-control-btn pin-btn ${isPinned ? 'pinned' : ''}`}
              onClick={handlePinToggle}
              title={isPinned ? "Unpin" : "Pin"}
              aria-label={isPinned ? "Unpin panel" : "Pin panel"}
            >
              {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>
          )}

          {minimizable && (
            <button
              className="floating-panel-control-btn minimize-btn"
              onClick={handleMinimize}
              title="Minimize"
              aria-label="Minimize panel"
            >
              <Minimize2 size={16} />
            </button>
          )}

          {dockable && (
            <button
              className="floating-panel-control-btn maximize-btn"
              onClick={handleMaximize}
              title={dockPosition === 'floating' ? 'Dock Right' : 'Float'}
              aria-label={dockPosition === 'floating' ? 'Dock panel to right' : 'Undock panel'}
            >
              <Maximize2 size={16} />
            </button>
          )}

          {closable && (
            <button
              className="floating-panel-control-btn close-btn"
              onClick={handleClose}
              title="Close"
              aria-label="Close panel"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="floating-panel-content">
        {children}
      </div>

      {/* Resize Handle */}
      {resizable && dockPosition === 'floating' && (
        <div
          className="floating-panel-resize-handle"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
}
