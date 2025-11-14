/**
 * 9X_110_GEO Tooling Explorer Debug Page
 * 
 * Loads the 9X_110_GEO.glb model and provides tools to:
 * - Inspect scene structure and rigid clusters
 * - Visualize joints from JSON
 * - Analyze unit-to-base attachments
 */

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { DEFAULT_TOOLING_CONFIG } from '../src/dev/tooling/ToolingConfig';
import { logToolingOverview, ToolingSceneExplorer } from '../src/dev/tooling/ToolingSceneExplorer';
import { ToolingJointOverlay } from '../src/dev/tooling/ToolingJointOverlay';
import { UnitAttachmentAnalyzer } from '../src/dev/tooling/UnitAttachmentAnalyzer';

let scene: BABYLON.Scene;
let camera: BABYLON.ArcRotateCamera;
let engine: BABYLON.Engine;
let overlay: ToolingJointOverlay | null = null;

function updateInfo(text: string) {
  const infoDiv = document.getElementById('info');
  if (infoDiv) {
    infoDiv.innerHTML = text;
  }
}

async function initializeScene() {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[9X_110 Debug] Canvas not found');
    return;
  }

  // Create engine and scene
  engine = new BABYLON.Engine(canvas, true);
  scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.15);

  // Camera
  camera = new BABYLON.ArcRotateCamera(
    'camera',
    Math.PI / 4,
    Math.PI / 3,
    10,
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 50;
  camera.minZ = 0.0001;
  camera.maxZ = 10000;

  // Lights
  new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene);
  new BABYLON.DirectionalLight('light2', new BABYLON.Vector3(-1, -1, -1), scene);

  // Disable picking helpers
  scene.constantlyUpdateMeshUnderPointer = false;
  scene.highlightLayers = [];

  updateInfo('Loading GLB...');

  // Try to load GLB from configured path
  // Note: For local file system paths, you may need to use a file input
  // or serve the file via HTTP
  try {
    await loadGLBModel();
  } catch (err) {
    console.error('[9X_110 Debug] Failed to load GLB:', err);
    updateInfo(`
      <div style="color: red;">
        <strong>Error loading GLB</strong><br/>
        Path: ${DEFAULT_TOOLING_CONFIG.glbPath}<br/>
        ${err instanceof Error ? err.message : String(err)}<br/>
        <br/>
        <strong>Note:</strong> For local file paths, you may need to:<br/>
        1. Use a file input to select the GLB file, or<br/>
        2. Serve the file via HTTP server
      </div>
    `);
    return;
  }

  // Initialize tools
  initializeTools();

  // Render loop
  engine.runRenderLoop(() => {
    scene.render();
  });

  // Handle resize
  window.addEventListener('resize', () => {
    engine.resize();
  });
}

async function loadGLBModel() {
  const glbPath = DEFAULT_TOOLING_CONFIG.glbPath;
  
  // Convert Windows path to file:// URL if needed
  let url: string;
  if (glbPath.startsWith('C:/') || glbPath.startsWith('c:/')) {
    // Try as file:// URL
    url = 'file:///' + glbPath.replace(/\\/g, '/');
  } else {
    url = glbPath;
  }

  console.log('[9X_110 Debug] Loading GLB from:', url);

  // Try loading with SceneLoader
  try {
    const result = await BABYLON.SceneLoader.ImportMeshAsync('', '', url, scene);
    
    if (!result.meshes || result.meshes.length === 0) {
      throw new Error('No meshes loaded from GLB');
    }

    console.log('[9X_110 Debug] Loaded', result.meshes.length, 'meshes');
    console.log('[9X_110 Debug] Transform nodes:', result.transformNodes.length);

    // Find fixture root
    const fixtureRoot = scene.getTransformNodeByName(DEFAULT_TOOLING_CONFIG.fixtureRootName);
    if (!fixtureRoot) {
      console.warn('[9X_110 Debug] Fixture root not found:', DEFAULT_TOOLING_CONFIG.fixtureRootName);
      console.log('[9X_110 Debug] Available transform nodes:', result.transformNodes.map(n => n.name));
    }

    // Center camera on model
    let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
    let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

    for (const mesh of result.meshes) {
      if (!(mesh instanceof BABYLON.Mesh)) {
        continue;
      }
      mesh.computeWorldMatrix(true);
      const bbox = mesh.getBoundingInfo().boundingBox;
      min = BABYLON.Vector3.Minimize(min, bbox.minimumWorld);
      max = BABYLON.Vector3.Maximize(max, bbox.maximumWorld);
    }

    if (min.x !== Infinity) {
      const center = min.add(max).scale(0.5);
      const extent = max.subtract(min).length();
      camera.setTarget(center);
      camera.radius = extent * 1.5;
    }

    updateInfo(`
      <div>
        <strong>9X_110_GEO Tooling Explorer</strong><br/>
        Loaded: ${result.meshes.length} meshes<br/>
        <br/>
        <strong>Console commands:</strong><br/>
        toolingDebug.logOverview()<br/>
        await toolingDebug.overlayJoints()<br/>
        toolingDebug.analyzeAttachments()
      </div>
    `);

  } catch (err) {
    // If file:// URL fails, try as HTTP path or provide file input
    if (url.startsWith('file://')) {
      throw new Error('Cannot load from file:// URL. Please use HTTP server or file input.');
    }
    throw err;
  }
}

function initializeTools() {
  // Expose debug API on window
  (window as any).toolingDebug = {
    logOverview: () => {
      logToolingOverview(scene);
    },

    overlayJoints: async () => {
      if (overlay) {
        overlay.dispose();
        overlay = null;
      }

      overlay = new ToolingJointOverlay(scene, DEFAULT_TOOLING_CONFIG);
      const joints = await overlay.loadJoints();
      
      if (joints.length === 0) {
        console.warn('[9X_110 Debug] No joints loaded');
        return;
      }

      overlay.createGizmos(joints);
      console.log('[9X_110 Debug] Joint gizmos created. Use toolingDebugOverlay.dispose() to remove.');
      (window as any).toolingDebugOverlay = overlay;
    },

    analyzeAttachments: () => {
      const explorer = new ToolingSceneExplorer(scene, DEFAULT_TOOLING_CONFIG);
      const analyzer = new UnitAttachmentAnalyzer(scene, explorer);
      const result = analyzer.analyzeAttachments();
      
      console.log('[UnitAttachmentAnalyzer] Result:', result);
      console.log('[UnitAttachmentAnalyzer] Units:', result.units.length);
      console.log('[UnitAttachmentAnalyzer] Attachments:', result.attachments.length);
      
      for (const attachment of result.attachments) {
        console.log(`  ${attachment.unitId} → ${attachment.baseClusterId} (area: ${attachment.contactAreaApprox.toFixed(6)} m²)`);
      }

      return result;
    },
  };

  // Auto-run overview on load
  setTimeout(() => {
    logToolingOverview(scene);
  }, 1000);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeScene);
} else {
  initializeScene();
}

