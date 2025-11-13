// MH5 Base Axis Snap Debug Scene
// Uses the same snap pipeline as the main app (SceneManager + SnappingHelper)
// Run with: npm run dev, then navigate to /debug/mh5-snap-debug.html
// Or set VITE_DEBUG_SNAP=true to enable verbose logging

import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { SceneManager } from '../src/scene/SceneManager';
import { SnappingHelper } from '../src/manipulation/SnappingHelper';

let scene: BABYLON.Scene | null = null;
let camera: BABYLON.ArcRotateCamera | null = null;
let mesh: BABYLON.Mesh | null = null;
let snappingHelper: SnappingHelper | null = null;

// UI elements
const infoDiv = document.getElementById('info');
let snapInfoDiv: HTMLElement | null = document.getElementById('snapInfo');

function updateInfo(text: string) {
  if (infoDiv) {
    infoDiv.innerHTML = text;
  }
}

function updateSnapInfo(text: string) {
  if (snapInfoDiv) {
    snapInfoDiv.textContent = text;
  }
}

async function initializeScene() {
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[MH5 Debug] Canvas not found');
    return;
  }

  // Initialize SceneManager (same as main app)
  const sceneManager = SceneManager.getInstance();
  await sceneManager.initialize(canvas);
  
  scene = sceneManager.getScene();
  camera = sceneManager.getCamera() as BABYLON.ArcRotateCamera;
  
  if (!scene || !camera) {
    console.error('[MH5 Debug] Failed to initialize scene');
    return;
  }

  // Get SnappingHelper instance (same as main app)
  snappingHelper = SnappingHelper.getInstance();

  // Load MH5_BASE_AXIS.stl
  updateInfo('Loading MH5_BASE_AXIS.stl...');
  const stlPath = '/library/manufacturing/models/motoman/mh5/meshes/mh5/visual/MH5_BASE_AXIS.stl';

  try {
    const result = await BABYLON.SceneLoader.ImportMeshAsync('', '', stlPath, scene);
    
    if (!result.meshes || result.meshes.length === 0) {
      throw new Error('No meshes loaded');
    }

    // Find the actual mesh
    mesh = result.meshes.find(m => m instanceof BABYLON.Mesh && m.getTotalVertices() > 0) as BABYLON.Mesh;
    if (!mesh) {
      mesh = result.meshes[0] as BABYLON.Mesh;
    }

    // Apply material
    const mat = new BABYLON.StandardMaterial('mat', scene);
    mat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    mat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    mesh.material = mat;

    // Center camera
    mesh.refreshBoundingInfo();
    const bb = mesh.getBoundingInfo().boundingBox;
    camera.setTarget(bb.centerWorld);
    camera.radius = bb.extendSizeWorld.length() * 1.8;

    updateInfo(`
      <div><strong>MH5 Base Axis Snap Debug</strong></div>
      <div>Loaded: ${mesh.name}</div>
      <div>Vertices: ${mesh.getTotalVertices()}</div>
      <div>Move mouse over the model to test snap preview</div>
      <div id="snapInfo">No snap detected</div>
    `);
    const newSnapInfo = document.getElementById('snapInfo');
    if (newSnapInfo) {
      snapInfoDiv = newSnapInfo;
    }

    console.log('[MH5 Debug] Mesh loaded:', mesh.name);
    console.log('[MH5 Debug] Vertices:', mesh.getTotalVertices());
    console.log('[MH5 Debug] Bounding box:', bb);

    // Wire up pointer move for snap preview (same as SceneCanvas)
    setupSnapPreview();

  } catch (err) {
    console.error('[MH5 Debug] Load error:', err);
    updateInfo(`<div style="color: red;">Error loading STL: ${err instanceof Error ? err.message : String(err)}</div>`);
  }
}

function setupSnapPreview() {
  if (!scene || !camera || !snappingHelper) {
    return;
  }

  const engine = scene.getEngine();
  if (!engine) {
    return;
  }

  // Same snap settings as main app (enable center, face, midpoint)
  const snapSettings = {
    enabled: true,
    snapToGrid: false,
    snapToVertex: false,
    snapToEdge: false,
    snapToFace: true,
    snapToCenter: true,
    snapToObject: false,
    snapToMidpoint: true,
    snapToIntersection: false,
    snapToPerpendicular: false,
    snapToTangent: false,
    snapAlong: false,
    snapToNormal: false,
    snapToPlane: false,
    snapToAxis: false,
    snapToCurve: false,
    snapToSurface: false,
    snapObjectToVertex: false,
    snapPointOnEdge: false,
    snapBBoxCorner: false,
    gridSize: 10,
    snapDistance: 12, // 12mm default
  };

  // Throttle pointer move events (same as SceneCanvas)
  let lastPickTime = 0;
  const pickIntervalMs = 48; // ~20 picks/sec

  scene.onPointerMove = () => {
    const now = performance.now();
    if (now - lastPickTime < pickIntervalMs) {
      return;
    }
    lastPickTime = now;

    if (!scene || !camera || !snappingHelper || !engine) {
      return;
    }

    // Get pointer position (render pixels)
    const pointerX = scene.pointerX;
    const pointerY = scene.pointerY;

    // Do a general pick to get 3D position
    const generalPick = scene.pick(
      pointerX,
      pointerY,
      (m) => {
        return m.isVisible && 
               m.name !== 'gridOverlay' &&
               !m.name.startsWith('snapIndicator') &&
               !m.name.startsWith('snapPreviewDot');
      },
      false,
      camera
    );

    // Use picked point or camera target as fallback
    const snapPosition = generalPick?.pickedPoint || 
      (camera instanceof BABYLON.ArcRotateCamera ? camera.getTarget() : camera.position);

    // Calculate screen-space threshold (same as SceneCanvas)
    const dpr = 1 / engine.getHardwareScalingLevel();
    const screenSpacePixelsCss = 100; // Default threshold
    const screenSpacePixels = screenSpacePixelsCss * dpr;

    // Call snapPosition (same as SceneCanvas)
    const snapResult = snappingHelper.snapPosition(
      snapPosition,
      snapSettings,
      [], // Don't exclude any meshes
      camera,
      screenSpacePixels,
      true, // smartSelect
      undefined, // clickedMesh
      undefined, // clickedPoint
      pointerX,
      pointerY
    );

    // Update UI with detailed info
    if (snapResult.snapped) {
      const snapType = snapResult.snapType || 'unknown';
      const pos = snapResult.position;
      let info = `Snap: ${snapType} at (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`;
      
      if (snapType === 'center' && snapResult.circleRadius !== undefined) {
        info += `<br>Radius: ${(snapResult.circleRadius * 1000).toFixed(2)}mm`;
        if (snapResult.circleNormal) {
          info += `<br>Normal: (${snapResult.circleNormal.x.toFixed(2)}, ${snapResult.circleNormal.y.toFixed(2)}, ${snapResult.circleNormal.z.toFixed(2)})`;
        }
      }
      
      if (snapType === 'face' && snapResult.targetMeshName) {
        info += `<br>Mesh: ${snapResult.targetMeshName}`;
      }
      
      updateSnapInfo(info);

      // Show preview (same as SceneCanvas)
      const center = snapResult.position.clone();

      // Attach metadata for preview (prefer SnapResult metadata, fallback to visualFeedback)
      if (snapResult.snapType === 'midpoint' && snapResult.visualFeedback && snapResult.visualFeedback.length >= 3) {
        (center as any).edgeStart = snapResult.visualFeedback[1].clone();
        (center as any).edgeEnd = snapResult.visualFeedback[2].clone();
      }

      if (snapResult.snapType === 'center') {
        // Prefer metadata from SnapResult (preferred approach)
        if (snapResult.circleNormal) {
          (center as any).circleNormal = snapResult.circleNormal.clone().normalize();
        } else if (snapResult.visualFeedback && snapResult.visualFeedback.length >= 3) {
          (center as any).circleNormal = snapResult.visualFeedback[1].clone().normalize();
        }
        
        if (snapResult.circleRadius !== undefined) {
          (center as any).circleRadius = snapResult.circleRadius;
        } else if (snapResult.visualFeedback && snapResult.visualFeedback.length >= 3) {
          (center as any).circleRadius = snapResult.visualFeedback[2].x;
        }
      }

      if (snapResult.snapType === 'face') {
        // Face normal from visualFeedback (face snap doesn't set faceNormal on SnapResult yet)
        if (snapResult.visualFeedback && snapResult.visualFeedback.length >= 2) {
          (center as any).faceNormal = snapResult.visualFeedback[1].clone().normalize();
        }
      }

      snappingHelper.showPreviewDot(center, snapResult.snapType);
    } else {
      updateSnapInfo('No snap detected');
      snappingHelper.clearPreviewDot();
    }
  };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeScene);
} else {
  initializeScene();
}

// Export for potential module use
export { initializeScene, setupSnapPreview };

