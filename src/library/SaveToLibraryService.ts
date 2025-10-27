/**
 * Save to Library Service
 * Owner: George (Agent 1)
 *
 * Handles saving imported world assets to the Asset Library
 * Supports both local (IndexedDB) and cloud (Supabase) storage
 *
 * User Asset Visibility:
 * - Private assets: Only visible to the creator
 * - Public assets: Visible to all users (factory-provided)
 * - Shared assets: Visible to specific users/teams
 */

import * as BABYLON from '@babylonjs/core';
import { AssetDatabase, AssetDatabaseEntry } from './AssetDatabase';
import { AssetUploadService } from './AssetUploadService';
import type { LibraryAsset } from './types';

export interface SaveToLibraryOptions {
  // Asset metadata
  name: string;
  description?: string;
  tags?: string[];

  // Asset classification
  domain: string; // 'manufacturing', 'logistics', 'custom', etc.
  assetClass: string; // 'robots', 'conveyors', 'structures', etc.
  assetType: string; // 'articulated', 'scara', 'delta', etc.
  loaderType: 'glb' | 'gltf' | 'obj' | 'urdf' | 'mjcf' | 'custom';

  // Visibility & Access Control
  visibility: 'private' | 'public' | 'shared';
  sharedWithUsers?: string[]; // User IDs for shared assets

  // Optional metadata
  manufacturer?: string;
  modelNumber?: string;
  version?: string;
  documentationUrl?: string;

  // Storage options
  saveToCloud?: boolean; // If true, save to Supabase + R2
  saveToLocal?: boolean; // If true, save to IndexedDB (default: true)
}

export interface SaveToLibraryResult {
  success: boolean;
  assetId?: string;
  asset?: LibraryAsset;
  error?: string;
}

/**
 * Service for saving world assets to the library
 */
export class SaveToLibraryService {
  private static instance: SaveToLibraryService;
  private assetDatabase: AssetDatabase;
  private uploadService: AssetUploadService | null;

  private constructor() {
    this.assetDatabase = AssetDatabase.getInstance();
    // Only initialize upload service if cloud credentials are available
    try {
      this.uploadService = AssetUploadService.getInstance();
    } catch (error) {
      console.warn('[SaveToLibrary] Cloud storage not configured, local-only mode');
      this.uploadService = null;
    }
  }

  public static getInstance(): SaveToLibraryService {
    if (!SaveToLibraryService.instance) {
      SaveToLibraryService.instance = new SaveToLibraryService();
    }
    return SaveToLibraryService.instance;
  }

  /**
   * Save a mesh to the asset library
   */
  async saveMeshToLibrary(
    mesh: BABYLON.Mesh,
    options: SaveToLibraryOptions
  ): Promise<SaveToLibraryResult> {
    try {
      console.log(`[SaveToLibrary] Saving mesh "${options.name}" to library`);

      // Generate unique asset ID
      const assetId = this.generateAssetId(options.name);

      // Serialize mesh to GLB format
      const glbBlob = await this.exportMeshToGLB(mesh);

      // Generate thumbnail
      const thumbnailBlob = await this.generateThumbnail(mesh);

      // Extract metadata from mesh
      const metadata = this.extractMeshMetadata(mesh);

      // Create asset entry
      const asset: LibraryAsset = {
        id: assetId,
        name: options.name,
        description: options.description || '',
        domain: options.domain,
        assetClass: options.assetClass,
        assetType: options.assetType,
        loaderType: options.loaderType,
        filePath: `custom/${assetId}.glb`,
        tags: options.tags || [],
        searchKeywords: [options.name, options.assetClass, options.assetType],
        manufacturer: options.manufacturer,
        modelNumber: options.modelNumber,
        version: options.version || '1.0',
        documentationUrl: options.documentationUrl,
        source: 'user-imported',
        isFavorite: false,
        usageCount: 0,
        metadata,

        // Access control
        visibility: options.visibility || 'private',
        owner: await this.getCurrentUserId(),
        sharedWith: options.sharedWithUsers || [],
      };

      // Save to local storage (IndexedDB)
      if (options.saveToLocal !== false) {
        await this.saveToLocal(asset, glbBlob, thumbnailBlob);
      }

      // Save to cloud storage (Supabase + R2)
      if (options.saveToCloud && this.uploadService) {
        await this.saveToCloud(asset, glbBlob, thumbnailBlob);
      } else if (options.saveToCloud && !this.uploadService) {
        console.warn('[SaveToLibrary] Cloud storage requested but not configured');
      }

      console.log(`✅ Asset saved successfully: ${assetId}`);

      return {
        success: true,
        assetId,
        asset,
      };
    } catch (error) {
      console.error('[SaveToLibrary] Failed to save asset:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save asset',
      };
    }
  }

  /**
   * Save multiple meshes as a collection/assembly
   */
  async saveMeshCollectionToLibrary(
    meshes: BABYLON.Mesh[],
    options: SaveToLibraryOptions
  ): Promise<SaveToLibraryResult> {
    try {
      console.log(`[SaveToLibrary] Saving mesh collection "${options.name}" (${meshes.length} meshes)`);

      // Create a parent transform node for the collection
      const scene = meshes[0].getScene();
      const root = new BABYLON.TransformNode(`collection_${options.name}`, scene);

      // Parent all meshes to the root
      meshes.forEach(mesh => {
        mesh.parent = root;
      });

      // Export the entire collection
      const glbBlob = await this.exportCollectionToGLB(meshes, scene);

      // Generate thumbnail from the first mesh
      const thumbnailBlob = await this.generateThumbnail(meshes[0]);

      // Generate asset ID
      const assetId = this.generateAssetId(options.name);

      // Create asset entry
      const asset: LibraryAsset = {
        id: assetId,
        name: options.name,
        description: options.description || '',
        domain: options.domain,
        assetClass: options.assetClass,
        assetType: options.assetType,
        loaderType: 'glb',
        filePath: `custom/${assetId}.glb`,
        tags: options.tags || [],
        searchKeywords: [options.name, options.assetClass, options.assetType, 'collection'],
        manufacturer: options.manufacturer,
        modelNumber: options.modelNumber,
        version: options.version || '1.0',
        documentationUrl: options.documentationUrl,
        source: 'user-imported',
        isFavorite: false,
        usageCount: 0,
        metadata: {
          meshCount: meshes.length,
          collectionType: 'assembly',
        },

        // Access control
        visibility: options.visibility || 'private',
        owner: await this.getCurrentUserId(),
        sharedWith: options.sharedWithUsers || [],
      };

      // Save to local storage
      if (options.saveToLocal !== false) {
        await this.saveToLocal(asset, glbBlob, thumbnailBlob);
      }

      // Save to cloud storage
      if (options.saveToCloud) {
        await this.saveToCloud(asset, glbBlob, thumbnailBlob);
      }

      // Clean up temporary root
      root.dispose();

      console.log(`✅ Mesh collection saved successfully: ${assetId}`);

      return {
        success: true,
        assetId,
        asset,
      };
    } catch (error) {
      console.error('[SaveToLibrary] Failed to save mesh collection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save mesh collection',
      };
    }
  }

  /**
   * Export mesh to GLB blob
   */
  private async exportMeshToGLB(mesh: BABYLON.Mesh): Promise<Blob> {
    const scene = mesh.getScene();

    // Use Babylon.js GLTF exporter
    const { GLTF2Export } = await import('@babylonjs/serializers');

    const glb = await GLTF2Export.GLBAsync(scene, mesh.name, {
      shouldExportNode: (node) => node === mesh || node.isDescendantOf(mesh),
    });

    return glb.glTFFiles[mesh.name + '.glb'] as Blob;
  }

  /**
   * Export mesh collection to GLB blob
   */
  private async exportCollectionToGLB(
    meshes: BABYLON.Mesh[],
    scene: BABYLON.Scene
  ): Promise<Blob> {
    const { GLTF2Export } = await import('@babylonjs/serializers');

    const glb = await GLTF2Export.GLBAsync(scene, 'collection', {
      shouldExportNode: (node) => {
        return meshes.some(mesh => node === mesh || node.isDescendantOf(mesh));
      },
    });

    return glb.glTFFiles['collection.glb'] as Blob;
  }

  /**
   * Generate thumbnail from mesh
   */
  private async generateThumbnail(mesh: BABYLON.Mesh): Promise<Blob> {
    const scene = mesh.getScene();
    const engine = scene.getEngine();

    // Create a temporary camera for thumbnail
    const camera = new BABYLON.ArcRotateCamera(
      'thumbnailCamera',
      Math.PI / 4,
      Math.PI / 3,
      10,
      mesh.getBoundingInfo().boundingBox.centerWorld,
      scene
    );

    // Frame the mesh
    camera.setTarget(mesh.getBoundingInfo().boundingBox.centerWorld);
    const radius = mesh.getBoundingInfo().boundingSphere.radiusWorld;
    camera.radius = radius * 3;

    // Set active camera temporarily
    const originalCamera = scene.activeCamera;
    scene.activeCamera = camera;

    // Render to texture
    const size = 256;
    const renderTarget = new BABYLON.RenderTargetTexture(
      'thumbnail',
      size,
      scene,
      false
    );

    renderTarget.renderList = [mesh];
    scene.render();

    // Read pixels
    const pixels = await renderTarget.readPixels();

    // Convert to blob
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(size, size);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create thumbnail'));
      }, 'image/png');
    });

    // Cleanup
    renderTarget.dispose();
    camera.dispose();
    scene.activeCamera = originalCamera;

    return blob;
  }

  /**
   * Extract metadata from mesh
   */
  private extractMeshMetadata(mesh: BABYLON.Mesh): Record<string, any> {
    const boundingInfo = mesh.getBoundingInfo();
    const boundingBox = boundingInfo.boundingBox;
    const dimensions = boundingBox.maximum.subtract(boundingBox.minimum);

    return {
      vertexCount: mesh.getTotalVertices(),
      triangleCount: mesh.getTotalIndices() / 3,
      dimensions: {
        x: Math.round(dimensions.x * 1000), // mm
        y: Math.round(dimensions.y * 1000),
        z: Math.round(dimensions.z * 1000),
      },
      boundingRadius: boundingInfo.boundingSphere.radiusWorld * 1000, // mm
      hasMaterial: !!mesh.material,
      materialType: mesh.material?.getClassName(),
    };
  }

  /**
   * Save to local IndexedDB
   */
  private async saveToLocal(
    asset: LibraryAsset,
    glbBlob: Blob,
    thumbnailBlob: Blob
  ): Promise<void> {
    await this.assetDatabase.initialize();

    // Convert blobs to base64
    const glbData = await this.blobToBase64(glbBlob);
    const thumbnailData = await this.blobToBase64(thumbnailBlob);

    const entry: AssetDatabaseEntry = {
      id: asset.id,
      name: asset.name,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      assetData: asset,
      thumbnailData,
      meshData: glbData,
      fileSize: glbBlob.size,
      checksum: await this.calculateChecksum(glbBlob),
      tags: asset.tags,
      usageCount: 0,
      isFavorite: false,
      origin: asset.origin,
      provenanceHistory: asset.provenanceHistory,
    };

    await this.assetDatabase.saveAsset(entry);
  }

  /**
   * Save to cloud (Supabase + R2)
   */
  private async saveToCloud(
    asset: LibraryAsset,
    glbBlob: Blob,
    thumbnailBlob: Blob
  ): Promise<void> {
    if (!this.uploadService) {
      throw new Error('Cloud storage not configured');
    }

    const glbFile = new File([glbBlob], `${asset.id}.glb`, { type: 'model/gltf-binary' });

    await this.uploadService.uploadAsset(glbFile, asset, (progress) => {
      console.log(`Upload progress: ${progress.percentage}%`);
    });
  }

  /**
   * Get current user ID from auth
   */
  private async getCurrentUserId(): Promise<string> {
    // TODO: Integrate with Supabase auth
    // For now, return a placeholder
    return 'local-user';
  }

  /**
   * Generate unique asset ID
   */
  private generateAssetId(name: string): string {
    const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${sanitized}-${timestamp}-${random}`;
  }

  /**
   * Convert blob to base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Calculate SHA-256 checksum
   */
  private async calculateChecksum(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
