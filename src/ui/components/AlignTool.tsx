// Align Tool - 2-click vertex/edge/face/center alignment
// Owner: George
// Provides click-based alignment (not drag-based snapping)

import { useState } from 'react';
import { Target, Circle, Minus, Square, Crosshair } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import './AlignTool.css';

type AlignMode = 'vertex' | 'edge' | 'face' | 'center' | null;

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
        <Crosshair size={18} />
      </div>

      {isExpanded && (
        <div className="align-tool-popup">
          <div className="align-icon-row">
            <button
              className="align-btn"
              onClick={() => startAlignMode('vertex')}
              title="Vertex to Vertex"
            >
              <Circle size={18} />
            </button>
            <button
              className="align-btn"
              onClick={() => startAlignMode('edge')}
              title="Edge to Edge"
            >
              <Minus size={18} />
            </button>
            <button
              className="align-btn"
              onClick={() => startAlignMode('face')}
              title="Face to Face"
            >
              <Square size={18} />
            </button>
            <button
              className="align-btn"
              onClick={() => startAlignMode('center')}
              title="Center to Center"
            >
              <Target size={18} />
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
