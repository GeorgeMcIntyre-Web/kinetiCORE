/**
 * BeamFeaScene.tsx
 * Minimal Babylon.js scene for visualizing beam FEA results
 */

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { runBeamFea, createCantileverDemo } from './BeamFeaSolver';
import type { BeamFeaResult } from './BeamFeaTypes';

interface BeamFeaSceneProps {
  width?: number;
  height?: number;
}

/**
 * Beam FEA visualization component
 * Renders deflected shape with stress color mapping
 */
export const BeamFeaScene: React.FC<BeamFeaSceneProps> = ({
  width = 800,
  height = 600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<BeamFeaResult | null>(null);
  const [scaleFactor, setScaleFactor] = useState(100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Create Babylon engine and scene
    const engine = new BABYLON.Engine(canvas, true);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1);

    // Camera setup
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      Math.PI / 4,
      Math.PI / 3,
      3,
      new BABYLON.Vector3(0.5, 0, 0),
      scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 10;

    // Lighting
    const light1 = new BABYLON.HemisphericLight(
      'light1',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    light1.intensity = 0.7;

    const light2 = new BABYLON.DirectionalLight(
      'light2',
      new BABYLON.Vector3(-1, -2, -1),
      scene
    );
    light2.intensity = 0.5;

    // Run FEA
    const input = createCantileverDemo();
    const feaResult = runBeamFea(input);
    setResult(feaResult);

    if (!feaResult.success) {
      console.error('FEA failed:', feaResult.error);
      return;
    }

    // Create undeformed beam (wireframe)
    const undeformedPoints = feaResult.nodalResults.map(
      (node) =>
        new BABYLON.Vector3(node.position, 0, 0)
    );

    const undeformedLines = BABYLON.MeshBuilder.CreateLines(
      'undeformed',
      { points: undeformedPoints },
      scene
    );
    undeformedLines.color = new BABYLON.Color3(0.3, 0.3, 0.3);

    // Create deformed beam (colored by stress)
    visualizeDeformedBeam(scene, feaResult, scaleFactor);

    // Add coordinate axes
    createAxes(scene);

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Cleanup
    return () => {
      scene.dispose();
      engine.dispose();
    };
  }, [scaleFactor]);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Beam FEA Demo - Cantilever with Tip Load</h2>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ border: '1px solid #444' }}
      />

      <div style={{ marginTop: '20px' }}>
        <label>
          Displacement Scale Factor:
          <input
            type="range"
            min="1"
            max="500"
            value={scaleFactor}
            onChange={(e) => setScaleFactor(Number(e.target.value))}
            style={{ marginLeft: '10px', width: '200px' }}
          />
          <span style={{ marginLeft: '10px' }}>{scaleFactor}x</span>
        </label>
      </div>

      {result?.success && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            background: '#222',
            borderRadius: '8px',
          }}
        >
          <h3>Results</h3>
          <p>
            <strong>Max Displacement:</strong>{' '}
            {(result.maxDisplacement * 1000).toFixed(3)} mm
          </p>
          <p>
            <strong>Max Stress:</strong>{' '}
            {(result.maxStress / 1e6).toFixed(2)} MPa
          </p>
          {result.factorOfSafety !== undefined && (
            <p>
              <strong>Factor of Safety:</strong>{' '}
              {result.factorOfSafety.toFixed(2)}
            </p>
          )}
          <p>
            <strong>DOFs:</strong> {result.meta.dofs}
          </p>
          <p>
            <strong>Solve Time:</strong> {result.meta.solveTime.toFixed(2)} ms
          </p>
        </div>
      )}

      {result?.success === false && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            background: '#400',
            borderRadius: '8px',
          }}
        >
          <strong>Error:</strong> {result.error}
        </div>
      )}
    </div>
  );
};

/**
 * Visualize deformed beam with stress color mapping
 */
function visualizeDeformedBeam(
  scene: BABYLON.Scene,
  result: BeamFeaResult,
  scaleFactor: number
): void {
  const { nodalResults, elementResults, maxStress } = result;

  // Create tube mesh along deformed path
  const path = nodalResults.map(
    (node) =>
      new BABYLON.Vector3(
        node.position,
        node.displacement * scaleFactor,
        0
      )
  );

  const tube = BABYLON.MeshBuilder.CreateTube(
    'deformed',
    {
      path,
      radius: 0.02,
      cap: BABYLON.Mesh.CAP_ALL,
    },
    scene
  );

  // Color by stress (blue = low, red = high)
  const material = new BABYLON.StandardMaterial('beamMat', scene);

  // Use average stress for material color
  const avgStress =
    elementResults.reduce((sum, el) => sum + el.stress, 0) /
    elementResults.length;
  const stressRatio = maxStress > 0 ? avgStress / maxStress : 0;

  material.diffuseColor = stressToColor(stressRatio);
  material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
  tube.material = material;

  // Add stress gradient spheres at nodes
  nodalResults.forEach((node, i) => {
    if (i % 5 !== 0) {
      return; // Only show every 5th node
    }

    const sphere = BABYLON.MeshBuilder.CreateSphere(
      `node_${i}`,
      { diameter: 0.03 },
      scene
    );
    sphere.position = new BABYLON.Vector3(
      node.position,
      node.displacement * scaleFactor,
      0
    );

    // Find corresponding element stress
    const elemStress =
      elementResults[Math.min(i, elementResults.length - 1)].stress;
    const ratio = maxStress > 0 ? elemStress / maxStress : 0;

    const nodeMat = new BABYLON.StandardMaterial(`nodeMat_${i}`, scene);
    nodeMat.diffuseColor = stressToColor(ratio);
    nodeMat.emissiveColor = stressToColor(ratio).scale(0.2);
    sphere.material = nodeMat;
  });
}

/**
 * Map stress ratio [0,1] to color (blue → green → yellow → red)
 */
function stressToColor(ratio: number): BABYLON.Color3 {
  // Clamp ratio
  const t = Math.max(0, Math.min(1, ratio));

  if (t < 0.25) {
    // Blue → Cyan
    const local = t / 0.25;
    return new BABYLON.Color3(0, local, 1);
  }

  if (t < 0.5) {
    // Cyan → Green
    const local = (t - 0.25) / 0.25;
    return new BABYLON.Color3(0, 1, 1 - local);
  }

  if (t < 0.75) {
    // Green → Yellow
    const local = (t - 0.5) / 0.25;
    return new BABYLON.Color3(local, 1, 0);
  }

  // Yellow → Red
  const local = (t - 0.75) / 0.25;
  return new BABYLON.Color3(1, 1 - local, 0);
}

/**
 * Create coordinate axes helper
 */
function createAxes(scene: BABYLON.Scene): void {
  const size = 0.3;

  // X axis (red)
  const xAxis = BABYLON.MeshBuilder.CreateLines(
    'xAxis',
    {
      points: [
        BABYLON.Vector3.Zero(),
        new BABYLON.Vector3(size, 0, 0),
      ],
    },
    scene
  );
  xAxis.color = new BABYLON.Color3(1, 0, 0);

  // Y axis (green)
  const yAxis = BABYLON.MeshBuilder.CreateLines(
    'yAxis',
    {
      points: [
        BABYLON.Vector3.Zero(),
        new BABYLON.Vector3(0, size, 0),
      ],
    },
    scene
  );
  yAxis.color = new BABYLON.Color3(0, 1, 0);

  // Z axis (blue)
  const zAxis = BABYLON.MeshBuilder.CreateLines(
    'zAxis',
    {
      points: [
        BABYLON.Vector3.Zero(),
        new BABYLON.Vector3(0, 0, size),
      ],
    },
    scene
  );
  zAxis.color = new BABYLON.Color3(0, 0, 1);
}
