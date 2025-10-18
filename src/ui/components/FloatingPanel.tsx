import React, { useState, useRef, useEffect } from 'react';
import { X, GripVertical } from 'lucide-react';

export interface FloatingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  draggable?: boolean;
  resizable?: boolean;
  className?: string;
  zIndex?: number;
}

const sizeClasses = {
  sm: 'max-w-md',    // 448px
  md: 'max-w-2xl',   // 672px
  lg: 'max-w-4xl',   // 896px
  xl: 'max-w-6xl',   // 1152px
};

const positionClasses = {
  'center': 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
};

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  position = 'center',
  draggable = true,
  resizable = false,
  className = '',
  zIndex = 50,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  
  const panelRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Handle drag functionality
  useEffect(() => {
    if (!isDragging || !draggable) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        setPanelPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, draggable]);

  // Handle resize functionality
  useEffect(() => {
    if (!isResizing || !resizable) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        const newWidth = Math.max(300, e.clientX - rect.left);
        const newHeight = Math.max(200, e.clientY - rect.top);
        setPanelSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizable]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!draggable) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (!resizable) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const panelStyle: React.CSSProperties = {
    zIndex,
    ...(draggable && isDragging && {
      position: 'fixed',
      left: panelPosition.x,
      top: panelPosition.y,
      transform: 'none',
    }),
    ...(resizable && panelSize.width > 0 && {
      width: panelSize.width,
      height: panelSize.height,
    }),
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        ref={panelRef}
        className={`
          bg-white rounded-lg shadow-xl border border-gray-200
          ${sizeClasses[size]}
          ${position === 'center' ? positionClasses[position] : ''}
          ${className}
        `}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          ref={dragHandleRef}
          className={`
            flex items-center justify-between p-4 border-b border-gray-200
            ${draggable ? 'cursor-move' : ''}
          `}
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center space-x-2">
            {draggable && <GripVertical className="w-4 h-4 text-gray-400" />}
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto max-h-[80vh]">
          {children}
        </div>

        {/* Resize handle */}
        {resizable && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-300 hover:bg-gray-400"
            onMouseDown={handleResizeStart}
          />
        )}
      </div>
    </div>
  );
};

export default FloatingPanel;
