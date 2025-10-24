// PreviewCanvas - Isolated Babylon.js 3D preview
// Owner: Edwin
// Self-contained 3D viewer for asset inspection

import { useEffect, useRef, useState } from 'react';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  SceneLoader,
  Color4,
  Mesh,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import type { LibraryAsset } from '../../../library/types';
import './PreviewCanvas.css';

interface PreviewCanvasProps {
  asset: LibraryAsset | null;
}

export function PreviewCanvas({ asset }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Babylon engine and scene (only once)
    if (!engineRef.current) {
      const engine = new Engine(canvasRef.current, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      engineRef.current = engine;

      const scene = new Scene(engine);
      scene.clearColor = new Color4(0, 0, 0, 0); // Transparent background
      sceneRef.current = scene;

      // Setup camera
      const camera = new ArcRotateCamera(
        'previewCam',
        -Math.PI / 2,
        Math.PI / 3,
        5,
        Vector3.Zero(),
        scene
      );
      camera.attachControl(canvasRef.current, true);
      camera.lowerRadiusLimit = 0.5;
      camera.upperRadiusLimit = 20;

      // Setup lights
      const hemispheric = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
      hemispheric.intensity = 0.7;

      const directional = new HemisphericLight('dir', new Vector3(1, -1, 1), scene);
      directional.intensity = 0.5;

      // Ground plane for reference
      const ground = Mesh.CreateGround('ground', 10, 10, 2, scene);
      const groundMat = new StandardMaterial('groundMat', scene);
      groundMat.diffuseColor = new Color3(0.2, 0.2, 0.22);
      groundMat.alpha = 0.3;
      ground.material = groundMat;
      ground.position.y = -0.01;

      // Start render loop
      engine.runRenderLoop(() => {
        scene.render();
      });

      // Handle window resize
      const handleResize = () => {
        engine.resize();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // Load asset when selected
  useEffect(() => {
    if (!asset || !sceneRef.current || !engineRef.current) return;

    const scene = sceneRef.current;

    setIsLoading(true);
    setError(null);

    // Clear previous meshes (except ground and lights)
    scene.meshes.forEach((mesh) => {
      if (mesh.name !== 'ground') {
        mesh.dispose();
      }
    });

    // Load the asset
    const loadAsset = async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync(
          '',
          asset.filePath || '',
          '',
          scene
        );

        if (result.meshes.length > 0) {
          // Center camera on the loaded asset
          const root = result.meshes[0];

          // Calculate bounding box
          let min = new Vector3(Infinity, Infinity, Infinity);
          let max = new Vector3(-Infinity, -Infinity, -Infinity);

          result.meshes.forEach((mesh) => {
            if (mesh.getBoundingInfo) {
              const bounds = mesh.getBoundingInfo();
              min = Vector3.Minimize(min, bounds.boundingBox.minimumWorld);
              max = Vector3.Maximize(max, bounds.boundingBox.maximumWorld);
            }
          });

          const center = Vector3.Center(min, max);
          const size = max.subtract(min);
          const maxDim = Math.max(size.x, size.y, size.z);

          // Position root at origin
          root.position.subtractInPlace(center);

          // Adjust camera
          const camera = scene.activeCamera as ArcRotateCamera;
          if (camera) {
            camera.setTarget(Vector3.Zero());
            camera.radius = maxDim * 2;
          }

          setIsLoading(false);
        } else {
          setError('No meshes found in asset');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load asset preview:', err);
        setError('Failed to load 3D model');
        setIsLoading(false);
      }
    };

    loadAsset();
  }, [asset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []);

  return (
    <div className="preview-canvas-container">
      <canvas ref={canvasRef} className="preview-canvas" />
      {isLoading && (
        <div className="preview-overlay">
          <div className="preview-loading">Loading 3D model...</div>
        </div>
      )}
      {error && (
        <div className="preview-overlay">
          <div className="preview-error">{error}</div>
        </div>
      )}
      {!asset && (
        <div className="preview-overlay">
          <div className="preview-empty">Select an asset to preview</div>
        </div>
      )}
    </div>
  );
}
