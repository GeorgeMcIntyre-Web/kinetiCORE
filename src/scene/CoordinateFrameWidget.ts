// Coordinate Frame Widget - Corner indicator showing current orientation
// Owner: Cole
// Displays a small XYZ triad in the corner like CAD software (SolidWorks, Fusion360)

import * as BABYLON from '@babylonjs/core';

export class CoordinateFrameWidget {
  private scene: BABYLON.Scene;
  private utilityLayer: BABYLON.UtilityLayerRenderer;
  private camera: BABYLON.ArcRotateCamera | null = null;
  private axisLength = 0.15;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // Create a utility layer that renders on top, in a separate layer
    this.utilityLayer = new BABYLON.UtilityLayerRenderer(scene);
    this.utilityLayer.utilityLayerScene.autoClear = false;

    this.createWidget();
  }

  private createWidget(): void {
    const utilityScene = this.utilityLayer.utilityLayerScene;

    // Create orthographic camera for the widget (fixed position)
    this.camera = new BABYLON.ArcRotateCamera(
      'widgetCamera',
      0,
      0,
      10,
      BABYLON.Vector3.Zero(),
      utilityScene
    );
    this.camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.layerMask = 0x10000000; // Different layer
    utilityScene.activeCamera = this.camera;

    // Position camera to view the axes properly
    this.camera.alpha = -Math.PI / 4;
    this.camera.beta = Math.PI / 3;

    const size = 0.3;
    this.camera.orthoLeft = -size;
    this.camera.orthoRight = size;
    this.camera.orthoTop = size;
    this.camera.orthoBottom = -size;

    // Create the three axes
    this.createAxis('X', new BABYLON.Vector3(this.axisLength, 0, 0), new BABYLON.Color3(1, 0, 0), utilityScene);
    this.createAxis('Z', new BABYLON.Vector3(0, this.axisLength, 0), new BABYLON.Color3(0, 1, 0), utilityScene); // User Z = Babylon Y
    this.createAxis('Y', new BABYLON.Vector3(0, 0, this.axisLength), new BABYLON.Color3(0, 0, 1), utilityScene); // User Y = Babylon Z

    // Update widget orientation to match main camera
    this.updateOrientation();
  }

  private createAxis(label: string, direction: BABYLON.Vector3, color: BABYLON.Color3, scene: BABYLON.Scene): void {
    // Create axis line
    const line = BABYLON.MeshBuilder.CreateLines(
      `widgetAxis${label}`,
      {
        points: [BABYLON.Vector3.Zero(), direction],
      },
      scene
    );
    line.color = color;
    line.layerMask = 0x10000000;

    // Create arrowhead cone
    const arrowHead = BABYLON.MeshBuilder.CreateCylinder(
      `widgetArrow${label}`,
      {
        diameterTop: 0,
        diameterBottom: 0.02,
        height: 0.04,
      },
      scene
    );
    arrowHead.position = direction;
    arrowHead.layerMask = 0x10000000;

    // Orient the cone to point along the axis
    const upVector = direction.clone().normalize();
    const rotationAxis = BABYLON.Vector3.Cross(BABYLON.Axis.Y, upVector);
    const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Axis.Y, upVector));
    if (rotationAxis.length() > 0.001) {
      arrowHead.rotationQuaternion = BABYLON.Quaternion.RotationAxis(rotationAxis, angle);
    }

    const material = new BABYLON.StandardMaterial(`widgetMat${label}`, scene);
    material.diffuseColor = color;
    material.emissiveColor = color;
    material.disableLighting = true;
    arrowHead.material = material;

    // Create label
    const labelPos = direction.scale(1.3);
    this.createLabel(label, labelPos, color, scene);
  }

  private createLabel(text: string, position: BABYLON.Vector3, color: BABYLON.Color3, scene: BABYLON.Scene): void {
    const plane = BABYLON.MeshBuilder.CreatePlane(`widgetLabel${text}`, { size: 0.08 }, scene);
    plane.position = position;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.layerMask = 0x10000000;

    const texture = new BABYLON.DynamicTexture(`widgetLabelTexture${text}`, 128, scene);
    const material = new BABYLON.StandardMaterial(`widgetLabelMat${text}`, scene);
    material.diffuseTexture = texture;
    material.emissiveColor = color;
    material.disableLighting = true;
    material.opacityTexture = texture;
    plane.material = material;

    const ctx = texture.getContext();
    const context = ctx as CanvasRenderingContext2D;
    context.clearRect(0, 0, 128, 128);
    context.fillStyle = `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`;
    context.font = 'bold 80px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 64);
    texture.update();
  }

  /**
   * Update widget orientation to match main camera
   * Call this when main camera moves
   */
  updateOrientation(): void {
    if (!this.camera) return;

    const mainCamera = this.scene.activeCamera;
    if (mainCamera && mainCamera instanceof BABYLON.ArcRotateCamera) {
      // Match the widget camera rotation to the main camera
      this.camera.alpha = mainCamera.alpha;
      this.camera.beta = mainCamera.beta;
    }
  }

  /**
   * Set the viewport position (bottom-left corner by default)
   */
  setViewport(x: number, y: number, width: number, height: number): void {
    if (!this.camera) return;
    this.camera.viewport = new BABYLON.Viewport(x, y, width, height);
  }

  dispose(): void {
    this.utilityLayer.dispose();
  }
}
