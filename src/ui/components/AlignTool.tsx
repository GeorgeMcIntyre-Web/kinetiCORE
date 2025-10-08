// Align Tool - 2-click vertex/edge/face/center alignment
// Owner: George
// Provides click-based alignment (not drag-based snapping)

import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import './AlignTool.css';

type AlignMode = 'vertex' | 'edge' | 'face' | 'center' | null;

// Custom SVG icons for alignment - clear and intuitive
const VertexIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    {/* Main center vertex highlighted */}
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    {/* Corner vertices */}
    <circle cx="6" cy="6" r="1.5" fill="currentColor" />
    <circle cx="18" cy="6" r="1.5" fill="currentColor" />
    <circle cx="6" cy="18" r="1.5" fill="currentColor" />
    <circle cx="18" cy="18" r="1.5" fill="currentColor" />
  </svg>
);

const EdgeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    {/* Highlighted edge */}
    <line x1="6" y1="12" x2="18" y2="12" strokeWidth="3" />
    {/* Other edges lighter */}
    <line x1="6" y1="6" x2="18" y2="6" opacity="0.4" />
    <line x1="6" y1="18" x2="18" y2="18" opacity="0.4" />
    {/* End vertices */}
    <circle cx="6" cy="12" r="1.5" fill="currentColor" />
    <circle cx="18" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

const FaceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {/* Filled face */}
    <rect x="6" y="6" width="12" height="12" fill="rgba(72, 187, 120, 0.3)" />
    {/* Corner vertices */}
    <circle cx="6" cy="6" r="1.5" fill="currentColor" />
    <circle cx="18" cy="6" r="1.5" fill="currentColor" />
    <circle cx="6" cy="18" r="1.5" fill="currentColor" />
    <circle cx="18" cy="18" r="1.5" fill="currentColor" />
  </svg>
);

const CenterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {/* Crosshair at center */}
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <line x1="12" y1="2" x2="12" y2="8" />
    <line x1="12" y1="16" x2="12" y2="22" />
    <line x1="2" y1="12" x2="8" y2="12" />
    <line x1="16" y1="12" x2="22" y2="12" />
  </svg>
);

const AlignIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {/* Two vertices being aligned */}
    <circle cx="7" cy="7" r="2.5" fill="currentColor" />
    <circle cx="17" cy="17" r="2.5" fill="currentColor" />
    {/* Dotted line showing alignment */}
    <line x1="7" y1="7" x2="17" y2="17" strokeDasharray="2 2" opacity="0.6" />
    {/* Arrows showing direction */}
    <path d="M10 10l2 2" strokeWidth="2.5" />
  </svg>
);

export const AlignTool: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeMode, setActiveMode] = useState<AlignMode>(null);

  const startAlignMode = (mode: AlignMode) => {
    setActiveMode(mode);
    setIsExpanded(false);
    // TODO: Set cursor to crosshair, enter selection mode
    console.log(`Starting ${mode} alignment mode`);
  };

  return (
    <div className="align-tool-panel">
      <div
        className="align-tool-header"
        onClick={() => setIsExpanded(!isExpanded)}
        title="Align Tool"
      >
        <AlignIcon />
      </div>

      {isExpanded && (
        <div className="align-tool-popup">
          <div className="align-icon-row">
            <button
              className="align-btn"
              onClick={() => startAlignMode('vertex')}
              title="Vertex to Vertex"
            >
              <VertexIcon />
            </button>
            <button
              className="align-btn"
              onClick={() => startAlignMode('edge')}
              title="Edge to Edge"
            >
              <EdgeIcon />
            </button>
            <button
              className="align-btn"
              onClick={() => startAlignMode('face')}
              title="Face to Face"
            >
              <FaceIcon />
            </button>
            <button
              className="align-btn"
              onClick={() => startAlignMode('center')}
              title="Center to Center"
            >
              <CenterIcon />
            </button>
          </div>
        </div>
      )}

      {activeMode && (
        <div className="align-status">
          <span>Click source {activeMode}...</span>
        </div>
      )}
    </div>
  );
};
