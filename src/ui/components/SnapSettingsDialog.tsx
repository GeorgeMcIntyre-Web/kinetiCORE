// SnapSettingsDialog - Configure snap mode and points
// Styled to match Quick Move dialog

import { useEffect, useRef, useState } from 'react';
import { X, Crosshair, GripVertical } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { SceneTreeManager } from '../../scene/SceneTreeManager';
import { XNumericInput, YNumericInput, ZNumericInput } from './NumericInput';
import './MoveObjectDialog.css';

const SNAP_OPTIONS: Array<{
  value: 'grid' | 'vertex' | 'edge' | 'surface' | 'object' | 'component' | 'mesh';
  label: string;
}> = [
  { value: 'grid', label: 'Grid' },
  { value: 'vertex', label: 'Vertex' },
  { value: 'edge', label: 'Edge' },
  { value: 'surface', label: 'Surface' },
  { value: 'object', label: 'Object' },
  { value: 'component', label: 'Component' },
  { value: 'mesh', label: 'Mesh' },
];

interface SnapSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SnapSettingsDialog: React.FC<SnapSettingsDialogProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogPosition, setDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const snapMode = useEditorStore((state) => state.snapMode);
  const snapFromPoint = useEditorStore((state) => state.snapFromPoint);
  const snapToPoint = useEditorStore((state) => state.snapToPoint);
  const applySnapSettings = useEditorStore((state) => state.applySnapSettings);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);

  const [mode, setMode] = useState<typeof SNAP_OPTIONS[number]['value']>('grid');
  const [from, setFrom] = useState({ x: 0, y: 0, z: 0 });
  const [to, setTo] = useState({ x: 0, y: 0, z: 0 });
  const [objectName, setObjectName] = useState<string>('None Selected');

  // Center dialog when opened the first time
  useEffect(() => {
    if (isOpen && dialogPosition === null && dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect();
      const centerX = (window.innerWidth - rect.width) / 2;
      const centerY = (window.innerHeight - rect.height) / 2;
      setDialogPosition({ x: centerX, y: centerY });
    }
  }, [isOpen, dialogPosition]);

  // Populate local state from store when dialog opens
  useEffect(() => {
    if (isOpen) {
      setMode(snapMode);
      setFrom(snapFromPoint);
      setTo(snapToPoint);

      const tree = SceneTreeManager.getInstance();
      if (selectedNodeId) {
        const node = tree.getNode(selectedNodeId);
        setObjectName(node?.name ?? 'Unknown Object');
      } else {
        setObjectName('None Selected');
      }
    }
  }, [isOpen, snapMode, snapFromPoint, snapToPoint, selectedNodeId]);

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

  if (!isOpen) {
    return null;
  }

  const handleCancel = () => {
    onClose();
  };

  const handleApply = () => {
    applySnapSettings({
      mode,
      from,
      to,
    });
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      className="move-dialog move-dialog-floating"
      style={{
        top: dialogPosition ? `${dialogPosition.y}px` : '40%',
        left: dialogPosition ? `${dialogPosition.x}px` : '50%',
        transform: dialogPosition ? 'none' : 'translate(-50%, -50%)',
        width: 320,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="move-dialog-header">
        <div className="move-dialog-title">
          <Crosshair size={14} />
          <h3>Snap Settings</h3>
        </div>
        <div className="move-dialog-drag-handle">
          <GripVertical size={14} />
        </div>
        <button className="move-dialog-close" onClick={handleCancel} aria-label="Close snap settings">
          <X size={16} />
        </button>
      </div>

      <div className="move-dialog-content">
        <div className="move-section">
          <label className="move-section-label">Snapping Mode</label>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
            style={{
              width: '100%',
              background: 'rgba(37,37,38,0.8)',
              color: '#fff',
              border: '1px solid rgba(98, 104, 255, 0.4)',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '12px',
              appearance: 'none',
            }}
          >
            {SNAP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="move-section">
          <label className="move-section-label">Object</label>
          <input
            type="text"
            value={objectName}
            readOnly
            style={{
              width: '100%',
              background: 'rgba(37,37,38,0.8)',
              color: '#fff',
              border: '1px solid rgba(98, 104, 255, 0.4)',
              borderRadius: '4px',
              padding: '6px 8px',
              fontSize: '12px',
            }}
          />
        </div>

        <div className="move-section">
          <label className="move-section-label">Snap From (mm)</label>
          <div className="move-values-row">
            <XNumericInput value={from.x} onChange={(val) => setFrom({ ...from, x: val })} precision={2} />
            <YNumericInput value={from.y} onChange={(val) => setFrom({ ...from, y: val })} precision={2} />
            <ZNumericInput value={from.z} onChange={(val) => setFrom({ ...from, z: val })} precision={2} />
          </div>
        </div>

        <div className="move-section">
          <label className="move-section-label">Snap To (mm)</label>
          <div className="move-values-row">
            <XNumericInput value={to.x} onChange={(val) => setTo({ ...to, x: val })} precision={2} />
            <YNumericInput value={to.y} onChange={(val) => setTo({ ...to, y: val })} precision={2} />
            <ZNumericInput value={to.z} onChange={(val) => setTo({ ...to, z: val })} precision={2} />
          </div>
        </div>

        <div className="move-dialog-actions">
          <button className="move-btn-cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="move-btn-apply" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};
