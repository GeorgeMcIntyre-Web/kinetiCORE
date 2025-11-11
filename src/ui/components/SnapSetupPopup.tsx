// Snap Setup Popup - Quick access to snap settings from ribbon
// Contains the same settings as FloatingSettingsPanel Snap tab

import { X, Crosshair, GripVertical } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useRef, useState, useEffect } from 'react';
import './MoveObjectDialog.css';

interface SnapSetupPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SnapSetupPopup: React.FC<SnapSetupPopupProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogPosition, setDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Get all snap settings from store
  const {
    snapEnabled,
    snapToGrid,
    gridSize,
    snapToVertex,
    snapToEdge,
    snapToFace,
    snapToCenter,
    snapToObject,
    snapToMidpoint,
    snapToIntersection,
    snapBBoxCorner,
    setSnapEnabled,
    setSnapToGrid,
    setGridSize,
    setSnapToVertex,
    setSnapToEdge,
    setSnapToFace,
    setSnapToCenter,
    setSnapToObject,
    setSnapToMidpoint,
    setSnapBBoxCorner,
  } = useEditorStore();

  // Center dialog when opened the first time
  useEffect(() => {
    if (isOpen && dialogPosition === null && dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect();
      const centerX = (window.innerWidth - rect.width) / 2;
      const centerY = (window.innerHeight - rect.height) / 2;
      setDialogPosition({ x: centerX, y: centerY });
    }
  }, [isOpen, dialogPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.move-dialog-drag-handle') && dialogPosition) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX - dialogPosition.x,
        y: e.clientY - dialogPosition.y,
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDragging) {
        setDialogPosition({
          x: event.clientX - dragStartRef.current.x,
          y: event.clientY - dragStartRef.current.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={dialogRef}
      className="move-dialog move-dialog-floating"
      style={{
        top: dialogPosition ? `${dialogPosition.y}px` : '40%',
        left: dialogPosition ? `${dialogPosition.x}px` : '50%',
        transform: dialogPosition ? 'none' : 'translate(-50%, -50%)',
        width: 320,
        maxHeight: '70vh',
        overflowY: 'auto',
        background: 'rgba(20, 20, 20, 0.25)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(100, 108, 255, 0.3)',
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="move-dialog-header">
        <div className="move-dialog-title">
          <Crosshair size={14} />
          <h3>Snap Setup</h3>
        </div>
        <div className="move-dialog-drag-handle">
          <GripVertical size={14} />
        </div>
        <button className="move-dialog-close" onClick={onClose} aria-label="Close snap setup">
          <X size={16} />
        </button>
      </div>

      <div className="move-dialog-content" style={{ padding: '16px' }}>
        {/* Enable Snapping Toggle */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#e2e8f0',
            }}
          >
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(e) => setSnapEnabled(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span>Enable snapping</span>
          </label>
        </div>

        {/* Individual Snap Type Toggles */}
        <div style={{ marginBottom: '16px' }}>
          <h5 style={{ fontSize: '12px', color: '#e2e8f0', marginBottom: '8px', fontWeight: 500 }}>
            Snap Types
          </h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#e2e8f0',
                padding: '4px 6px',
                borderRadius: '4px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45, 55, 72, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={snapToVertex}
                onChange={(e) => setSnapToVertex(e.target.checked)}
                style={{ width: '12px', height: '12px', cursor: 'pointer' }}
              />
              <span>Vertex</span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#e2e8f0',
                padding: '4px 6px',
                borderRadius: '4px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45, 55, 72, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={snapToMidpoint}
                onChange={(e) => setSnapToMidpoint(e.target.checked)}
                style={{ width: '12px', height: '12px', cursor: 'pointer' }}
              />
              <span>Midpoint</span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#e2e8f0',
                padding: '4px 6px',
                borderRadius: '4px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45, 55, 72, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={snapToCenter}
                onChange={(e) => setSnapToCenter(e.target.checked)}
                style={{ width: '12px', height: '12px', cursor: 'pointer' }}
              />
              <span>Center</span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'not-allowed',
                fontSize: '11px',
                color: '#666',
                padding: '4px 6px',
                borderRadius: '4px',
                transition: 'background 0.2s',
                opacity: 0.5,
              }}
            >
              <input
                type="checkbox"
                checked={snapToIntersection}
                disabled={true}
                onChange={() => {}}
                style={{ width: '12px', height: '12px', cursor: 'not-allowed', opacity: 0.5 }}
              />
              <span>Intersection</span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#e2e8f0',
                padding: '4px 6px',
                borderRadius: '4px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45, 55, 72, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={snapToEdge}
                onChange={(e) => setSnapToEdge(e.target.checked)}
                style={{ width: '12px', height: '12px', cursor: 'pointer' }}
              />
              <span>Edge</span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#e2e8f0',
                padding: '4px 6px',
                borderRadius: '4px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45, 55, 72, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={snapBBoxCorner}
                onChange={(e) => setSnapBBoxCorner(e.target.checked)}
                style={{ width: '12px', height: '12px', cursor: 'pointer' }}
              />
              <span>BBox Corner</span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#e2e8f0',
                padding: '4px 6px',
                borderRadius: '4px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45, 55, 72, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={snapToFace}
                onChange={(e) => setSnapToFace(e.target.checked)}
                style={{ width: '12px', height: '12px', cursor: 'pointer' }}
              />
              <span>Face</span>
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#e2e8f0',
                padding: '4px 6px',
                borderRadius: '4px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(45, 55, 72, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={snapToObject}
                onChange={(e) => setSnapToObject(e.target.checked)}
                style={{ width: '12px', height: '12px', cursor: 'pointer' }}
              />
              <span>Object</span>
            </label>
          </div>
        </div>

        {/* Grid snap toggle and size */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#e2e8f0',
              marginBottom: '8px',
            }}
          >
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              style={{ width: '14px', height: '14px', cursor: 'pointer' }}
            />
            <span>Enable grid snapping</span>
          </label>
          {snapToGrid && (
            <div style={{ marginTop: '6px' }}>
              <label style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', display: 'block' }}>
                Grid Size (mm)
              </label>
              <input
                type="number"
                value={gridSize}
                onChange={(e) => setGridSize(parseFloat(e.target.value) || 10)}
                min="1"
                max="1000"
                step="1"
                style={{
                  width: '100%',
                  padding: '4px 6px',
                  background: 'rgba(37, 37, 38, 0.6)',
                  color: '#fff',
                  border: '1px solid rgba(98, 104, 255, 0.3)',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

