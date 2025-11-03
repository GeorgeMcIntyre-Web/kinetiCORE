import * as BABYLON from '@babylonjs/core';
import { GLTF2Export } from '@babylonjs/serializers/glTF/2.0/glTFExporter';

export interface MaterialExportMetadata {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface GLBExportMetadata {
  version: string;
  materials: MaterialExportMetadata[];
  environmentTexture?: string | null;
}

export interface GLBExportOptions {
  fileName?: string;
  includeEnvironment?: boolean;
  embedMaterialMetadata?: boolean;
}

export interface GLBExportResult {
  glb: Blob;
  metadata?: GLBExportMetadata;
}

function pickMaterialProperties(material: BABYLON.Material): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const anyMaterial = material as any;

  if (anyMaterial.diffuseColor) {
    props.diffuseColor = {
      r: anyMaterial.diffuseColor.r,
      g: anyMaterial.diffuseColor.g,
      b: anyMaterial.diffuseColor.b,
    };
  }

  if (anyMaterial.albedoColor) {
    props.albedoColor = {
      r: anyMaterial.albedoColor.r,
      g: anyMaterial.albedoColor.g,
      b: anyMaterial.albedoColor.b,
    };
  }

  if (typeof anyMaterial.alpha === 'number') {
    props.alpha = anyMaterial.alpha;
  }

  if (typeof anyMaterial.metallic === 'number') {
    props.metallic = anyMaterial.metallic;
  }

  if (typeof anyMaterial.roughness === 'number') {
    props.roughness = anyMaterial.roughness;
  }

  if (anyMaterial.diffuseTexture?.name) {
    props.diffuseTexture = anyMaterial.diffuseTexture.name;
  }

  if (anyMaterial.environmentTexture?.name) {
    props.environmentTexture = anyMaterial.environmentTexture.name;
  }

  if (material.metadata?.textureUrl) {
    props.textureUrl = material.metadata.textureUrl;
  }

  return props;
}

export class GLBExporter {
  static collectMaterialMetadata(scene: BABYLON.Scene): MaterialExportMetadata[] {
    return (scene.materials ?? []).map((material) => ({
      id: material.uniqueId?.toString() ?? material.name,
      name: material.name,
      type: typeof material.getClassName === 'function' ? material.getClassName() : 'Material',
      properties: pickMaterialProperties(material),
    }));
  }

  static getEnvironmentReference(scene: BABYLON.Scene): string | null {
    const environment = scene.environmentTexture as any;
    if (!environment) {
      return null;
    }

    return environment.name ?? environment.metadata?.url ?? null;
  }

  static async export(scene: BABYLON.Scene, options: GLBExportOptions = {}): Promise<GLBExportResult> {
    const { fileName = 'scene', includeEnvironment = true, embedMaterialMetadata = true } = options;

    const exportData = await GLTF2Export.GLBAsync(scene, fileName, {
      shouldExportNode: (node) => !(node.metadata?.skipExport),
    });

    const glbKey = `${fileName}.glb`;
    const glbBlob = (exportData.glTFFiles[glbKey] ?? exportData.glTFFiles['scene.glb']) as Blob | undefined;

    if (!glbBlob) {
      throw new Error('GLB export did not produce a binary payload');
    }

    let metadata: GLBExportMetadata | undefined;
    if (embedMaterialMetadata) {
      metadata = {
        version: '1.0.0',
        materials: GLBExporter.collectMaterialMetadata(scene),
        environmentTexture: includeEnvironment ? GLBExporter.getEnvironmentReference(scene) : null,
      };
    }

    return { glb: glbBlob, metadata };
  }
}

export default GLBExporter;
