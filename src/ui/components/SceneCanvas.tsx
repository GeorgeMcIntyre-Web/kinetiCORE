// Scene Canvas component - renders Babylon.js scene
// Owner: Edwin/Cole

import { useEffect, useRef } from 'react';
import { SceneManager } from '../../scene/SceneManager';
import { useEditorStore } from '../store/editorStore';

export const SceneCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setCamera = useEditorStore((state) => state.setCamera);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sceneManager = SceneManager.getInstance();

    // Initialize scene
    sceneManager.initialize(canvas).then(() => {
      const camera = sceneManager.getCamera();
      if (camera) {
        setCamera(camera);
      }
    });

    // Cleanup on unmount
    return () => {
      sceneManager.dispose();
    };
  }, [setCamera]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        outline: 'none',
      }}
    />
  );
};
