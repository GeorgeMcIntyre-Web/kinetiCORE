// CameraViewControls - Quick camera view presets
// Owner: Edwin
// Location: src/ui/components/CameraViewControls.tsx

import { useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorStore } from '../store/editorStore';
import { Eye } from 'lucide-react';

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

  const views: CameraView[] = ['front', 'right', 'top', 'perspective'];

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 bg-gray-900 bg-opacity-90 rounded-lg p-2 border border-gray-700">
      <div className="flex items-center gap-2 px-2 pb-2 border-b border-gray-700">
        <Eye size={16} className="text-gray-400" />
        <span className="text-xs text-gray-400 font-semibold">Views</span>
      </div>
      
      {views.map((view) => {
        const preset = cameraPresets[view];
        return (
          <button
            key={view}
            onClick={() => setCameraView(view)}
            title={preset.description}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded transition-colors"
          >
            {preset.name}
            <span className="ml-2 text-gray-500 text-[10px]">{preset.key}</span>
          </button>
        );
      })}
    </div>
  );
};

// Integration example for editorStore:
// Add this to editorStore actions:
/*
setCameraView: (view: 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right' | 'perspective') => {
  const camera = get().camera;
  if (!camera || !(camera instanceof BABYLON.ArcRotateCamera)) return;
  
  const presets = {
    front: { alpha: 0, beta: Math.PI / 2 },
    right: { alpha: Math.PI / 2, beta: Math.PI / 2 },
    top: { alpha: 0, beta: 0.001 },
    back: { alpha: Math.PI, beta: Math.PI / 2 },
    left: { alpha: -Math.PI / 2, beta: Math.PI / 2 },
    bottom: { alpha: 0, beta: Math.PI - 0.001 },
    perspective: { alpha: -Math.PI / 4, beta: Math.PI / 3 },
  };
  
  const preset = presets[view];
  
  BABYLON.Animation.CreateAndStartAnimation(
    'cameraAlpha',
    camera,
    'alpha',
    60,
    30,
    camera.alpha,
    preset.alpha,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  
  BABYLON.Animation.CreateAndStartAnimation(
    'cameraBeta',
    camera,
    'beta',
    60,
    30,
    camera.beta,
    preset.beta,
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
},
*/
