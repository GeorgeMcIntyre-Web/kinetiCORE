// CollisionVisualizer - Shows collision contacts in 3D viewport
// Owner: George

import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { CollisionContact, CollisionManifold } from '../physics/IPhysicsEngine';

interface VisualizationSettings {
  showContactPoints: boolean;
  showContactNormals: boolean;
  showPenetrationDepth: boolean;
  showCollisionPairs: boolean;
  contactPointSize: number;
  normalLength: number;
  contactPointColor: any;
  normalColor: any;
  penetrationColor: any;
}

export class CollisionVisualizer {
  private scene: any;
  private settings: VisualizationSettings;
  private contactPointMeshes: any[] = [];
  private normalLines: any[] = [];
  private penetrationTexts: any[] = [];
  private advancedTexture: any | null = null;

  constructor(scene: any) {
    this.scene = scene;
    this.settings = {
      showContactPoints: true,
      showContactNormals: true,
      showPenetrationDepth: true,
      showCollisionPairs: false,
      contactPointSize: 0.05,
      normalLength: 0.3,
      contactPointColor: new BABYLON.Color3(1, 0, 0),
      normalColor: new BABYLON.Color3(0, 1, 1),
      penetrationColor: new BABYLON.Color3(1, 1, 0),
    };

    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI('collision-ui', true, scene);
  }

  update(contacts: CollisionContact[], manifolds: CollisionManifold[]): void {
    this.clear();
    if (!contacts || contacts.length === 0) return;

    contacts.forEach((contact, idx) => {
      if (this.settings.showContactPoints) this.createContactPoint(contact, idx);
      if (this.settings.showContactNormals) this.createContactNormal(contact, idx);
      if (this.settings.showPenetrationDepth) this.createPenetrationLabel(contact, idx);
    });

    if (this.settings.showCollisionPairs) {
      manifolds.forEach((m, idx) => this.createCollisionPairVisualization(m, idx));
    }
  }

  private createContactPoint(contact: CollisionContact, index: number): void {
    const sphere = BABYLON.MeshBuilder.CreateSphere(
      `contactPoint_${index}`,
      { diameter: this.settings.contactPointSize, segments: 8 },
      this.scene
    );
    sphere.position.set(contact.point.x, contact.point.y, contact.point.z);
    const material = new BABYLON.StandardMaterial(`contactMat_${index}`, this.scene);
    material.emissiveColor = this.settings.contactPointColor;
    material.disableLighting = true;
    sphere.material = material;
    sphere.renderingGroupId = 3;
    this.contactPointMeshes.push(sphere);
  }

  private createContactNormal(contact: CollisionContact, index: number): void {
    const startPoint = new BABYLON.Vector3(contact.point.x, contact.point.y, contact.point.z);
    const endPoint = startPoint.add(
      new BABYLON.Vector3(
        contact.normal.x * this.settings.normalLength,
        contact.normal.y * this.settings.normalLength,
        contact.normal.z * this.settings.normalLength
      )
    );

    const normalLine = BABYLON.MeshBuilder.CreateLines(
      `contactNormal_${index}`,
      { points: [startPoint, endPoint], updatable: false },
      this.scene
    );
    normalLine.color = this.settings.normalColor;
    normalLine.renderingGroupId = 3;

    const arrowHead = BABYLON.MeshBuilder.CreateCylinder(
      `arrowHead_${index}`,
      { height: 0.05, diameterTop: 0, diameterBottom: 0.02 },
      this.scene
    );
    arrowHead.position = endPoint;

    const direction = endPoint.subtract(startPoint).normalize();
    const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), direction));
    const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), direction).normalize();
    if (axis.length() > 0.001) {
      arrowHead.rotationQuaternion = BABYLON.Quaternion.RotationAxis(axis, angle);
    }

    const arrowMaterial = new BABYLON.StandardMaterial(`arrowMat_${index}`, this.scene);
    arrowMaterial.emissiveColor = this.settings.normalColor;
    arrowMaterial.disableLighting = true;
    arrowHead.material = arrowMaterial;
    arrowHead.renderingGroupId = 3;

    this.normalLines.push(normalLine);
    this.contactPointMeshes.push(arrowHead);
  }

  private createPenetrationLabel(contact: CollisionContact, index: number): void {
    if (!this.advancedTexture) return;
    const textBlock = new GUI.TextBlock(`penetrationText_${index}`, `${(contact.depth * 1000).toFixed(1)}mm`);
    textBlock.color = 'yellow';
    textBlock.fontSize = 14;
    textBlock.fontWeight = 'bold';
    (textBlock as any).outlineWidth = 2;
    (textBlock as any).outlineColor = 'black';
    this.advancedTexture.addControl(textBlock);

    const position = new BABYLON.Vector3(contact.point.x, contact.point.y + 0.1, contact.point.z);
    textBlock.linkWithMesh(this.createMarkerMesh(position, index));
    this.penetrationTexts.push(textBlock);
  }

  private createCollisionPairVisualization(manifold: CollisionManifold, index: number): void {
    if (manifold.contacts.length < 2) return;
    const centerA = this.calculateContactCenter(manifold.contacts.filter((_, i) => i % 2 === 0));
    const centerB = this.calculateContactCenter(manifold.contacts.filter((_, i) => i % 2 === 1));
    const line = BABYLON.MeshBuilder.CreateLines(
      `collisionPair_${index}`,
      { points: [centerA, centerB] },
      this.scene
    );
    line.color = manifold.isNewCollision ? new BABYLON.Color3(1, 0, 0) : new BABYLON.Color3(1, 0.5, 0);
    line.renderingGroupId = 3;
    this.normalLines.push(line);
  }

  private calculateContactCenter(contacts: CollisionContact[]): any {
    if (contacts.length === 0) return (BABYLON as any).Vector3.Zero();
    const sum = contacts.reduce(
      (acc, c) => acc.add(new (BABYLON as any).Vector3(c.point.x, c.point.y, c.point.z)),
      (BABYLON as any).Vector3.Zero()
    );
    return sum.scale(1 / contacts.length);
  }

  private createMarkerMesh(position: any, index: number): any {
    const marker = BABYLON.MeshBuilder.CreateBox(`marker_${index}`, { size: 0.01 }, this.scene);
    marker.position = position;
    marker.isVisible = false;
    this.contactPointMeshes.push(marker);
    return marker;
  }

  clear(): void {
    this.contactPointMeshes.forEach((m) => m.dispose());
    this.contactPointMeshes = [];
    this.normalLines.forEach((l) => l.dispose());
    this.normalLines = [];
    this.penetrationTexts.forEach((t) => this.advancedTexture?.removeControl(t));
    this.penetrationTexts = [];
  }

  updateSettings(newSettings: Partial<VisualizationSettings>): void {
    Object.assign(this.settings, newSettings);
  }

  getSettings(): VisualizationSettings {
    return { ...this.settings };
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) this.clear();
  }

  dispose(): void {
    this.clear();
    if (this.advancedTexture) {
      this.advancedTexture.dispose();
      this.advancedTexture = null;
    }
  }
}

