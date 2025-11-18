// MeasurementLabels - Helper for 3D billboard text labels
// Owner: Edwin

import * as BABYLON from '@babylonjs/core';

export interface BillboardLabelOptions {
  size?: number;
  textColor?: string;
  backgroundColor?: string;
}

interface MeasurementLabelMetadata {
  baseSize: number;
  referenceDistance: number;
}

interface SceneLabelState {
  labels: Set<BABYLON.Mesh>;
  observer: BABYLON.Observer<BABYLON.Scene> | null;
}

const sceneLabelStates = new Map<BABYLON.Scene, SceneLabelState>();

const createTextMaterial = (
  scene: BABYLON.Scene,
  name: string,
  text: string,
  options?: BillboardLabelOptions
): BABYLON.StandardMaterial => {
  const textureSize = 512;
  const dynamicTexture = new BABYLON.DynamicTexture(
    `${name}_texture`,
    { width: textureSize, height: textureSize },
    scene,
    false
  );

  const ctx = dynamicTexture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, textureSize, textureSize);

  const bg = options?.backgroundColor ?? 'rgba(15, 23, 42, 0.9)'; // Slate-900-ish
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(16, 80, textureSize - 32, textureSize - 160, 24);
  ctx.fill();

  const textColor = options?.textColor ?? '#e5e7eb'; // Gray-200
  const baseFontPx = 140;
  const minFontPx = 80;
  const padding = 80;

  ctx.font = `bold ${baseFontPx}px Arial`;
  const metrics = ctx.measureText(text);
  const availableWidth = textureSize - padding * 2;

  let fontPx = baseFontPx;
  if (metrics.width > availableWidth && metrics.width > 0) {
    const scale = availableWidth / metrics.width;
    fontPx = Math.max(minFontPx, baseFontPx * scale);
    ctx.font = `bold ${fontPx}px Arial`;
  }

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, textureSize / 2, textureSize / 2 + 4);

  dynamicTexture.update();

  const material = new BABYLON.StandardMaterial(`${name}_mat`, scene);
  material.diffuseTexture = dynamicTexture;
  material.emissiveColor = BABYLON.Color3.White();
  material.disableLighting = true;
  material.opacityTexture = dynamicTexture;
  material.backFaceCulling = false;

  return material;
};

const registerLabelForScaling = (
  scene: BABYLON.Scene,
  plane: BABYLON.Mesh,
  baseSize: number
): void => {
  const camera = scene.activeCamera;
  if (!camera) {
    return;
  }

  const distance = BABYLON.Vector3.Distance(camera.position, plane.position);
  const referenceDistance = distance > 0.0001 ? distance : 1;

  if (!plane.metadata) {
    plane.metadata = {};
  }

  const metadata: MeasurementLabelMetadata = {
    baseSize,
    referenceDistance,
  };

  plane.metadata.measurementLabel = metadata;

  let state = sceneLabelStates.get(scene);
  if (!state) {
    state = {
      labels: new Set<BABYLON.Mesh>(),
      observer: null,
    };
    sceneLabelStates.set(scene, state);
  }

  state.labels.add(plane);

  if (state.observer) {
    return;
  }

  state.observer = scene.onBeforeRenderObservable.add(() => {
    const currentCamera = scene.activeCamera;
    if (!currentCamera) {
      return;
    }

    const toRemove: BABYLON.Mesh[] = [];

    state?.labels.forEach((mesh) => {
      if (!mesh || mesh.isDisposed()) {
        toRemove.push(mesh);
        return;
      }

      const meta = mesh.metadata?.measurementLabel as MeasurementLabelMetadata | undefined;
      if (!meta) {
        return;
      }

      const distanceToCamera = BABYLON.Vector3.Distance(currentCamera.position, mesh.position);
      if (!(distanceToCamera > 0.0001)) {
        mesh.scaling.set(1, 1, 1);
        return;
      }

      const rawScale = distanceToCamera / meta.referenceDistance;
      const minScale = 0.75;
      const maxScale = 8.0;
      const clampedScale = Math.max(minScale, Math.min(maxScale, rawScale));

      mesh.scaling.set(clampedScale, clampedScale, clampedScale);
    });

    toRemove.forEach((mesh) => {
      state?.labels.delete(mesh);
    });

    if (!state || state.labels.size > 0) {
      return;
    }

    if (!state.observer) {
      return;
    }

    scene.onBeforeRenderObservable.remove(state.observer);
    state.observer = null;
    sceneLabelStates.delete(scene);
  });
};

export const createBillboardLabel = (
  scene: BABYLON.Scene,
  text: string,
  position: BABYLON.Vector3,
  options?: BillboardLabelOptions
): BABYLON.Mesh => {
  const name = `measurement-label-${Date.now()}-${Math.random()}`;
  const size = options?.size ?? 0.12;

  const plane = BABYLON.MeshBuilder.CreatePlane(
    name,
    { size },
    scene
  );

  plane.position = position.clone();
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const material = createTextMaterial(scene, name, text, options);
  plane.material = material;

  registerLabelForScaling(scene, plane, size);

  return plane;
};
