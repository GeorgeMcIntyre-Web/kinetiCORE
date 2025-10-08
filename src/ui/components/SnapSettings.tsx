// Snap Settings - Complete snap toolbar with all snap types
// Owner: George
// Grouped snap mode toggles in vertical toolbar with collapsible sections

import {
  Grid3x3, CornerDownRight, Minus, Square, Crosshair, Box, ArrowRight,
  Circle, Shapes, Layers3, Settings2, Target
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import './SnapSettings.css';

// Geometric snap types
export const SnapToVertex: React.FC = () => {
  const snapToVertex = useEditorStore((state) => state.snapToVertex);
  const setSnapToVertex = useEditorStore((state) => state.setSnapToVertex);

  return (
    <button
      className={`snap-btn ${snapToVertex ? 'active' : ''}`}
      onClick={() => setSnapToVertex(!snapToVertex)}
      title="Snap to Vertex - Corner to corner alignment"
    >
      <div className="flex items-center gap-1">
        <Box size={12} />
        <ArrowRight size={10} />
        <CornerDownRight size={12} />
      </div>
    </button>
  );
};

export const SnapToEdge: React.FC = () => {
  const snapToEdge = useEditorStore((state) => state.snapToEdge);
  const setSnapToEdge = useEditorStore((state) => state.setSnapToEdge);

  return (
    <button
      className={`snap-btn ${snapToEdge ? 'active' : ''}`}
      onClick={() => setSnapToEdge(!snapToEdge)}
      title="Snap to Edge - Snap to nearest point on edge"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 8 L12 4 L20 8" fill="none" stroke="#3b82f6" strokeWidth="2"/>
        <path d="M4 8 L12 12 L20 8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 4 L12 12" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M20 8 L20 16 L12 20 L12 12 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 8 L4 16 L12 20 L12 12 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    </button>
  );
};

export const SnapToFace: React.FC = () => {
  const snapToFace = useEditorStore((state) => state.snapToFace);
  const setSnapToFace = useEditorStore((state) => state.setSnapToFace);

  return (
    <button
      className={`snap-btn ${snapToFace ? 'active' : ''}`}
      onClick={() => setSnapToFace(!snapToFace)}
      title="Snap to Face - Face to face alignment"
    >
      <div className="flex items-center gap-1">
        <Box size={12} />
        <ArrowRight size={10} />
        <Square size={12} />
      </div>
    </button>
  );
};

export const SnapToCenter: React.FC = () => {
  const snapToCenter = useEditorStore((state) => state.snapToCenter);
  const setSnapToCenter = useEditorStore((state) => state.setSnapToCenter);

  return (
    <button
      className={`snap-btn ${snapToCenter ? 'active' : ''}`}
      onClick={() => setSnapToCenter(!snapToCenter)}
      title="Snap to Center - Center to center alignment"
    >
      <div className="flex items-center gap-1">
        <Box size={12} />
        <ArrowRight size={10} />
        <Crosshair size={12} />
      </div>
    </button>
  );
};

export const SnapToMidpoint: React.FC = () => {
  const snapToMidpoint = useEditorStore((state) => state.snapToMidpoint);
  const setSnapToMidpoint = useEditorStore((state) => state.setSnapToMidpoint);

  return (
    <button
      className={`snap-btn ${snapToMidpoint ? 'active' : ''}`}
      onClick={() => setSnapToMidpoint(!snapToMidpoint)}
      title="Snap to Midpoint - Snap to edge midpoints"
    >
      <div className="flex items-center gap-1">
        <Minus size={12} />
        <Circle size={6} />
      </div>
    </button>
  );
};

export const SnapToIntersection: React.FC = () => {
  const snapToIntersection = useEditorStore((state) => state.snapToIntersection);
  const setSnapToIntersection = useEditorStore((state) => state.setSnapToIntersection);

  return (
    <button
      className={`snap-btn ${snapToIntersection ? 'active' : ''}`}
      onClick={() => setSnapToIntersection(!snapToIntersection)}
      title="Snap to Intersection - Where edges cross"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4 L20 20" />
        <path d="M20 4 L4 20" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    </button>
  );
};

export const SnapToNormal: React.FC = () => {
  const snapToNormal = useEditorStore((state) => state.snapToNormal);
  const setSnapToNormal = useEditorStore((state) => state.setSnapToNormal);

  return (
    <button
      className={`snap-btn ${snapToNormal ? 'active' : ''}`}
      onClick={() => setSnapToNormal(!snapToNormal)}
      title="Snap to Normal - Align perpendicular to surface"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 18 L20 18" />
        <path d="M12 18 L12 6" />
        <path d="M9 9 L12 6 L15 9" />
      </svg>
    </button>
  );
};

// Object-level snap types
export const SnapToObject: React.FC = () => {
  const snapToObject = useEditorStore((state) => state.snapToObject);
  const setSnapToObject = useEditorStore((state) => state.setSnapToObject);

  return (
    <button
      className={`snap-btn ${snapToObject ? 'active' : ''}`}
      onClick={() => setSnapToObject(!snapToObject)}
      title="Snap to Object - Bounding box center alignment"
    >
      <div className="flex items-center gap-1">
        <Box size={12} />
        <ArrowRight size={10} />
        <Box size={12} />
      </div>
    </button>
  );
};

export const SnapToSurface: React.FC = () => {
  const snapToSurface = useEditorStore((state) => state.snapToSurface);
  const setSnapToSurface = useEditorStore((state) => state.setSnapToSurface);

  return (
    <button
      className={`snap-btn ${snapToSurface ? 'active' : ''}`}
      onClick={() => setSnapToSurface(!snapToSurface)}
      title="Snap to Surface - Object surface contact"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="6" y="4" width="12" height="8" />
        <path d="M4 16 L20 16" strokeWidth="3" />
      </svg>
    </button>
  );
};

export const SnapObjectToVertex: React.FC = () => {
  const snapObjectToVertex = useEditorStore((state) => state.snapObjectToVertex);
  const setSnapObjectToVertex = useEditorStore((state) => state.setSnapObjectToVertex);

  return (
    <button
      className={`snap-btn ${snapObjectToVertex ? 'active' : ''}`}
      onClick={() => setSnapObjectToVertex(!snapObjectToVertex)}
      title="Object to Vertex - Place object at vertex"
    >
      <div className="flex items-center gap-1">
        <Crosshair size={10} />
        <ArrowRight size={8} />
        <CornerDownRight size={10} />
      </div>
    </button>
  );
};

export const SnapBBoxCorner: React.FC = () => {
  const snapBBoxCorner = useEditorStore((state) => state.snapBBoxCorner);
  const setSnapBBoxCorner = useEditorStore((state) => state.setSnapBBoxCorner);

  return (
    <button
      className={`snap-btn ${snapBBoxCorner ? 'active' : ''}`}
      onClick={() => setSnapBBoxCorner(!snapBBoxCorner)}
      title="BBox Corner - Snap to bounding box corners"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" strokeDasharray="2 2" />
        <circle cx="4" cy="4" r="2" fill="currentColor" />
        <circle cx="20" cy="4" r="2" fill="currentColor" />
        <circle cx="4" cy="20" r="2" fill="currentColor" />
        <circle cx="20" cy="20" r="2" fill="currentColor" />
      </svg>
    </button>
  );
};

// Auxiliary snap types
export const SnapToGrid: React.FC = () => {
  const snapToGrid = useEditorStore((state) => state.snapToGrid);
  const setSnapToGrid = useEditorStore((state) => state.setSnapToGrid);

  return (
    <button
      className={`snap-btn ${snapToGrid ? 'active' : ''}`}
      onClick={() => setSnapToGrid(!snapToGrid)}
      title="Snap to Grid"
    >
      <Grid3x3 size={18} />
    </button>
  );
};

export const SnapPointOnEdge: React.FC = () => {
  const snapPointOnEdge = useEditorStore((state) => state.snapPointOnEdge);
  const setSnapPointOnEdge = useEditorStore((state) => state.setSnapPointOnEdge);

  return (
    <button
      className={`snap-btn ${snapPointOnEdge ? 'active' : ''}`}
      onClick={() => setSnapPointOnEdge(!snapPointOnEdge)}
      title="Point on Edge - Snap to any point along edge"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12 L20 12" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    </button>
  );
};

// Grouped snap toolbar component
interface SnapGroupProps {
  title: string;
  icon: React.ReactNode;
  lastUsedIcon?: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const SnapGroup: React.FC<SnapGroupProps> = ({ title, icon, lastUsedIcon, children, isOpen, onToggle }) => {
  return (
    <div className="snap-group-panel">
      <button
        className="snap-group-header"
        onClick={onToggle}
        title={title}
      >
        <div className="snap-group-icon">{lastUsedIcon || icon}</div>
      </button>
      {isOpen && (
        <div className="snap-group-popup">
          {children}
        </div>
      )}
    </div>
  );
};

// Main grouped snap toolbar
export const SnapToolbar: React.FC = () => {
  // Use shared popup state to ensure only one toolbar popup is open at a time
  const openToolbarPopup = useEditorStore((state) => state.openToolbarPopup);
  const setOpenToolbarPopup = useEditorStore((state) => state.setOpenToolbarPopup);

  // Track which snaps are active to show last used icon
  const snapToVertex = useEditorStore((state) => state.snapToVertex);
  const snapToEdge = useEditorStore((state) => state.snapToEdge);
  const snapToFace = useEditorStore((state) => state.snapToFace);
  const snapToCenter = useEditorStore((state) => state.snapToCenter);
  const snapToMidpoint = useEditorStore((state) => state.snapToMidpoint);
  const snapToIntersection = useEditorStore((state) => state.snapToIntersection);
  const snapToNormal = useEditorStore((state) => state.snapToNormal);

  const snapToObject = useEditorStore((state) => state.snapToObject);
  const snapToSurface = useEditorStore((state) => state.snapToSurface);
  const snapObjectToVertex = useEditorStore((state) => state.snapObjectToVertex);
  const snapBBoxCorner = useEditorStore((state) => state.snapBBoxCorner);

  const snapToGrid = useEditorStore((state) => state.snapToGrid);
  const snapPointOnEdge = useEditorStore((state) => state.snapPointOnEdge);

  // Determine last used icon for Geometric group
  const getGeometricIcon = () => {
    if (snapToVertex) return <CornerDownRight size={16} />;
    if (snapToEdge) return <Minus size={16} />;
    if (snapToFace) return <Square size={16} />;
    if (snapToCenter) return <Crosshair size={16} />;
    if (snapToMidpoint) return <Circle size={16} />;
    if (snapToIntersection) return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4 L20 20" /><path d="M20 4 L4 20" /><circle cx="12" cy="12" r="2" fill="currentColor" /></svg>;
    if (snapToNormal) return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 18 L20 18" /><path d="M12 18 L12 6" /><path d="M9 9 L12 6 L15 9" /></svg>;
    return null;
  };

  // Determine last used icon for Object-Level group
  const getObjectLevelIcon = () => {
    if (snapToObject) return <Box size={16} />;
    if (snapToSurface) return <Layers3 size={16} />;
    if (snapObjectToVertex) return <Target size={16} />;
    if (snapBBoxCorner) return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" strokeDasharray="2 2" /><circle cx="4" cy="4" r="2" fill="currentColor" /><circle cx="20" cy="4" r="2" fill="currentColor" /><circle cx="4" cy="20" r="2" fill="currentColor" /><circle cx="20" cy="20" r="2" fill="currentColor" /></svg>;
    return null;
  };

  // Determine last used icon for Auxiliary group
  const getAuxiliaryIcon = () => {
    if (snapToGrid) return <Grid3x3 size={16} />;
    if (snapPointOnEdge) return <Circle size={16} />;
    return null;
  };

  const handleToggleGroup = (group: 'snap-geometric' | 'snap-object' | 'snap-auxiliary') => {
    setOpenToolbarPopup(openToolbarPopup === group ? null : group);
  };

  return (
    <div className="snap-toolbar">
      <SnapGroup
        title="Geometric Snaps"
        icon={<Shapes size={16} />}
        lastUsedIcon={getGeometricIcon()}
        isOpen={openToolbarPopup === 'snap-geometric'}
        onToggle={() => handleToggleGroup('snap-geometric')}
      >
        <SnapToVertex />
        <SnapToEdge />
        <SnapToFace />
        <SnapToCenter />
        <SnapToMidpoint />
        <SnapToIntersection />
        <SnapToNormal />
      </SnapGroup>

      <SnapGroup
        title="Object-Level Snaps"
        icon={<Layers3 size={16} />}
        lastUsedIcon={getObjectLevelIcon()}
        isOpen={openToolbarPopup === 'snap-object'}
        onToggle={() => handleToggleGroup('snap-object')}
      >
        <SnapToObject />
        <SnapToSurface />
        <SnapObjectToVertex />
        <SnapBBoxCorner />
      </SnapGroup>

      <SnapGroup
        title="Auxiliary Snaps"
        icon={<Settings2 size={16} />}
        lastUsedIcon={getAuxiliaryIcon()}
        isOpen={openToolbarPopup === 'snap-auxiliary'}
        onToggle={() => handleToggleGroup('snap-auxiliary')}
      >
        <SnapToGrid />
        <SnapPointOnEdge />
      </SnapGroup>
    </div>
  );
};
