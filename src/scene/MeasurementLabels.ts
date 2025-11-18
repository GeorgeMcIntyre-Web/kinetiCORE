// MeasurementLabels - Helper for 3D billboard text labels
// Owner: Edwin

import * as BABYLON from '@babylonjs/core';

export interface BillboardLabelOptions {
  size?: number;
  textColor?: string;
  backgroundColor?: string;
}

const createTextMaterial = (
  scene: BABYLON.Scene,
  name: string,
  text: string,
  options?: BillboardLabelOptions
): BABYLON.StandardMaterial => {
  const textureSize = 256;
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
  ctx.font = 'bold 120px Arial';
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

export const createBillboardLabel = (
  scene: BABYLON.Scene,
  text: string,
  position: BABYLON.Vector3,
  options?: BillboardLabelOptions
): BABYLON.Mesh => {
  const name = `measurement-label-${Date.now()}-${Math.random()}`;
  const size = options?.size ?? 0.06;

  const plane = BABYLON.MeshBuilder.CreatePlane(
    name,
    { size },
    scene
  );

  plane.position = position.clone();
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

  const material = createTextMaterial(scene, name, text, options);
  plane.material = material;

  return plane;
};

