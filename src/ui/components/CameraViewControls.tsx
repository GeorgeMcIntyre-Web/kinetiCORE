// CameraViewControls - Quick camera view presets
// Owner: Edwin
// Location: src/ui/components/CameraViewControls.tsx

import { useEffect, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorStore } from '../store/editorStore';
import { Square, ArrowRight, ArrowUp, Box, Navigation, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { MoveObjectDialog } from './MoveObjectDialog';

type CameraView = 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'perspective';

interface CameraViewPreset {
  name: string;
  key: string;
  alpha: number; // Rotation around Y-axis
  beta: number;  // Angle from Y-axis
  description: string;
}

const cameraPresets: Record<CameraView, CameraViewPreset> = {
  front: {
    name: 'Front',
    key: '1',
    alpha: 0,
    beta: Math.PI / 2,
    description: 'Front View (Numpad 1)',
  },
  right: {
    name: 'Right',
    key: '3',
    alpha: Math.PI / 2,
    beta: Math.PI / 2,
    description: 'Right Side View (Numpad 3)',
  },
  top: {
    name: 'Top',
    key: '7',
    alpha: 0,
    beta: 0.001, // Small value instead of 0 to avoid gimbal lock
    description: 'Top View (Numpad 7)',
  },
  back: {
    name: 'Back',
    key: 'Ctrl+1',
    alpha: Math.PI,
    beta: Math.PI / 2,
    description: 'Back View (Ctrl+Numpad 1)',
  },
  left: {
    name: 'Left',
    key: 'Ctrl+3',
    alpha: -Math.PI / 2,
    beta: Math.PI / 2,
    description: 'Left Side View (Ctrl+Numpad 3)',
  },
  bottom: {
    name: 'Bottom',
    key: 'Ctrl+7',
    alpha: 0,
    beta: Math.PI - 0.001, // Small value instead of PI to avoid gimbal lock
    description: 'Bottom View (Ctrl+Numpad 7)',
  },
  perspective: {
    name: 'Perspective',
    key: '0',
    alpha: -Math.PI / 4,
    beta: Math.PI / 3,
    description: 'Perspective View (Numpad 0)',
  },
};

export const useCameraViewShortcuts = () => {
  const camera = useEditorStore((state) => state.camera);

  const setCameraView = (view: CameraView, animate = true) => {
    if (!camera || !(camera instanceof BABYLON.ArcRotateCamera)) return;

    const preset = cameraPresets[view];
    const duration = animate ? 30 : 0; // 30 frames at 60fps = 0.5 seconds

    // Get scene bounds for intelligent positioning (scene is available from camera)
    const scene = camera.getScene();
    if (scene) {
      const bounds = scene.getWorldExtends();
      if (bounds) {
        const center = bounds.min.add(bounds.max).scale(0.5);
        const size = bounds.max.subtract(bounds.min);
        const maxDimension = Math.max(size.x, size.y, size.z);

        // Calculate radius based on scene size
        const radius = Math.max(maxDimension * 1.5, 100);

        // Update camera radius and target
        camera.setTarget(center);
        camera.radius = radius;
      }
    }

    if (duration > 0) {
      BABYLON.Animation.CreateAndStartAnimation(
        'cameraAlpha',
        camera,
        'alpha',
        60,
        duration,
        camera.alpha,
        preset.alpha,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
      );

      BABYLON.Animation.CreateAndStartAnimation(
        'cameraBeta',
        camera,
        'beta',
        60,
        duration,
        camera.beta,
        preset.beta,
        BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
      );
    } else {
      camera.alpha = preset.alpha;
      camera.beta = preset.beta;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const withCtrl = e.ctrlKey || e.metaKey;

      switch (e.key) {
        case '1':
          e.preventDefault();
          setCameraView(withCtrl ? 'back' : 'front');
          break;
        case '3':
          e.preventDefault();
          setCameraView(withCtrl ? 'left' : 'right');
          break;
        case '7':
          e.preventDefault();
          setCameraView(withCtrl ? 'bottom' : 'top');
          break;
        case '0':
          e.preventDefault();
          setCameraView('perspective');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [camera]);

  return { setCameraView };
};

// UI Component for camera view buttons
export const CameraViewControls: React.FC = () => {
  const { setCameraView } = useCameraViewShortcuts();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const camera = useEditorStore((state) => state.camera);
  const zoomFit = useEditorStore((state) => state.zoomFit);

  const iconSize = 16; // Consistent icon size for all buttons

  const viewIcons: Record<CameraView, JSX.Element> = {
    front: <Square size={iconSize} />,
    right: <ArrowRight size={iconSize} />,
    top: <ArrowUp size={iconSize} />,
    perspective: <Box size={iconSize} />,
    back: <Square size={iconSize} />,
    left: <ArrowRight size={iconSize} />,
    bottom: <ArrowUp size={iconSize} />,
  };

  const views: CameraView[] = ['front', 'right', 'top', 'perspective'];

  const handleZoomIn = () => {
    if (!camera || !(camera instanceof BABYLON.ArcRotateCamera)) return;
    // Decrease radius by 20% to zoom in, but respect lower bounds
    const targetRadius = Math.max(camera.radius * 0.8, camera.lowerRadiusLimit || 1);
    BABYLON.Animation.CreateAndStartAnimation(
      'zoomIn',
      camera,
      'radius',
      60,
      15,
      camera.radius,
      targetRadius,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  };

  const handleZoomOut = () => {
    if (!camera || !(camera instanceof BABYLON.ArcRotateCamera)) return;
    // Increase radius by 25% to zoom out, but respect upper bounds
    const targetRadius = Math.min(camera.radius * 1.25, camera.upperRadiusLimit || 1000);
    BABYLON.Animation.CreateAndStartAnimation(
      'zoomOut',
      camera,
      'radius',
      60,
      15,
      camera.radius,
      targetRadius,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  };

  return (
    <>
      <div className="absolute top-4 left-4 flex flex-col gap-2 bg-gray-900 bg-opacity-90 rounded-lg p-2 border border-gray-700">
        {views.map((view) => {
          const preset = cameraPresets[view];
          return (
            <button
              key={view}
              onClick={() => setCameraView(view)}
              title={preset.description}
              className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors flex items-center justify-center"
            >
              {viewIcons[view]}
            </button>
          );
        })}

        {/* Separator */}
        <div className="h-px bg-gray-700 my-1"></div>

        {/* Zoom Controls */}
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors flex items-center justify-center"
        >
          <ZoomIn size={iconSize} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors flex items-center justify-center"
        >
          <ZoomOut size={iconSize} />
        </button>
        <button
          onClick={zoomFit}
          title="Zoom to Fit All (Period key)"
          className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors flex items-center justify-center"
        >
          <Maximize2 size={iconSize} />
        </button>

        {/* Separator */}
        <div className="h-px bg-gray-700 my-1"></div>

        {/* Move Object Button */}
        <button
          onClick={() => setShowMoveDialog(true)}
          disabled={!selectedNodeId}
          title={selectedNodeId ? "Quick Move Dialog (Relative/Absolute positioning)" : "Select an object first"}
          className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Navigation size={iconSize} />
        </button>
      </div>

      {/* Move Object Dialog */}
      <MoveObjectDialog isOpen={showMoveDialog} onClose={() => setShowMoveDialog(false)} />
    </>
  );
};
