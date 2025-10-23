/**
 * Asset Upload Service
 * Owner: Edwin (Agent 3)
 * 
 * Handles uploading assets to Cloudflare R2 via Worker
 * and saving metadata to Supabase
 */

import { createClient } from '@supabase/supabase-js';
import type { LibraryAsset } from './types';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  asset?: LibraryAsset;
  error?: string;
}

/**
 * Asset Upload Service
 */
export class AssetUploadService {
  private static instance: AssetUploadService;
  private workerUrl: string;
  private supabase: ReturnType<typeof createClient>;

  private constructor() {
    // Use your Cloudflare Worker URL
    this.workerUrl = import.meta.env.VITE_WORKER_URL || 'https://api.kineticore.io';
    
    // Supabase client
    this.supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL || '',
      import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    );
  }

  public static getInstance(): AssetUploadService {
    if (!AssetUploadService.instance) {
      AssetUploadService.instance = new AssetUploadService();
    }
    return AssetUploadService.instance;
  }

  /**
   * Upload asset to R2 and save metadata to Supabase
   */
  async uploadAsset(
    file: File,
    metadata: Partial<LibraryAsset>,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      console.log(`[AssetUploadService] Uploading asset: ${file.name}`);

      // 1. Generate file path
      const basePath = this.generateFilePath(metadata);
      const filePath = `${basePath}/${file.name}`;

      // 2. Upload main file to R2
      const fileUrl = await this.uploadToR2(file, filePath, onProgress);

      // 3. Generate and upload thumbnail
      let thumbnailUrl: string | undefined;
      try {
        const thumbnail = await this.generateThumbnail(file);
        if (thumbnail) {
          thumbnailUrl = await this.uploadToR2(
            thumbnail,
            `${basePath}/thumbnail.png`
          );
        }
      } catch (error) {
        console.warn('Failed to generate thumbnail:', error);
        // Continue without thumbnail
      }

      // 4. Extract and upload mesh files (if URDF/MJCF)
      let meshUrls: string[] = [];
      if (file.name.endsWith('.urdf') || file.name.endsWith('.xml')) {
        try {
          meshUrls = await this.extractAndUploadMeshes(file, basePath);
        } catch (error) {
          console.warn('Failed to extract mesh files:', error);
          // Continue without meshes
        }
      }

      // 5. Calculate checksum
      const checksum = await this.calculateChecksum(file);

      // 6. Save metadata to Supabase
      const asset = await this.saveMetadata({
        ...metadata,
        file_path: filePath,
        file_url: fileUrl,
        thumbnail_url: thumbnailUrl,
        mesh_files: meshUrls,
        file_size: file.size,
        checksum,
      });

      console.log(`[AssetUploadService] Asset uploaded successfully: ${asset.id}`);

      return {
        success: true,
        asset,
      };
    } catch (error) {
      console.error('[AssetUploadService] Upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Upload file to R2 via Cloudflare Worker
   */
  private async uploadToR2(
    file: File | Blob,
    path: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress({
              loaded: e.loaded,
              total: e.total,
              percentage: Math.round((e.loaded / e.total) * 100),
            });
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.url);
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.open('POST', `${this.workerUrl}/assets/${path}`);
      xhr.send(formData);
    });
  }

  /**
   * Download file from R2 (via CDN)
   */
  async downloadAsset(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    return await response.blob();
  }

  /**
   * Delete asset from R2
   */
  async deleteAsset(path: string): Promise<void> {
    const response = await fetch(`${this.workerUrl}/assets/${path}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  }

  /**
   * Generate thumbnail from file
   */
  private async generateThumbnail(file: File): Promise<Blob | null> {
    // Only generate thumbnails for images and 3D models
    if (!file.type.startsWith('image/') && !file.name.match(/\.(glb|gltf|obj|stl)$/i)) {
      return null;
    }

    // For images, resize to thumbnail
    if (file.type.startsWith('image/')) {
      return await this.resizeImage(file, 256, 256);
    }

    // For 3D models, would need to render a preview
    // This is complex - for now, return null
    return null;
  }

  /**
   * Resize image to thumbnail size
   */
  private async resizeImage(
    file: File,
    maxWidth: number,
    maxHeight: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw resized image
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail'));
            }
          },
          'image/png',
          0.9
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Extract and upload mesh files from URDF/MJCF
   */
  private async extractAndUploadMeshes(
    file: File,
    basePath: string
  ): Promise<string[]> {
    // Read URDF/MJCF file
    const text = await file.text();
    
    // Parse XML to find mesh references
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    
    // Find all mesh elements
    const meshElements = doc.querySelectorAll('mesh');
    const meshPaths: string[] = [];
    
    meshElements.forEach((element) => {
      const filename = element.getAttribute('filename');
      if (filename) {
        meshPaths.push(filename);
      }
    });

    // For now, just return the paths
    // In a full implementation, we would:
    // 1. Extract mesh files from a ZIP or folder
    // 2. Upload each mesh to R2
    // 3. Return the R2 URLs

    console.log(`Found ${meshPaths.length} mesh references:`, meshPaths);
    
    // Return empty array for now
    // TODO: Implement actual mesh extraction and upload
    return [];
  }

  /**
   * Calculate SHA-256 checksum of file
   */
  private async calculateChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  /**
   * Generate file path based on metadata
   */
  private generateFilePath(metadata: Partial<LibraryAsset>): string {
    const domain = metadata.domain || 'general';
    const assetClass = metadata.assetClass || 'unknown';
    const name = metadata.name || 'unnamed';
    
    // Sanitize name for filesystem
    const safeName = name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `${domain}/${assetClass}/${safeName}`;
  }

  /**
   * Save asset metadata to Supabase
   */
  private async saveMetadata(data: Partial<LibraryAsset>): Promise<LibraryAsset> {
    const { data: asset, error } = await this.supabase
      .from('library_assets')
      .insert({
        name: data.name,
        manufacturer: data.manufacturer,
        model_number: data.model_number,
        version: data.version,
        domain: data.domain,
        asset_class: data.assetClass,
        asset_type: data.assetType,
        loader_type: data.loaderType,
        file_path: data.file_path,
        file_url: data.file_url,
        thumbnail_url: data.thumbnail_url,
        file_size: data.file_size,
        checksum: data.checksum,
        metadata: data.metadata || {},
        tags: data.tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save metadata: ${error.message}`);
    }

    return asset as LibraryAsset;
  }

  /**
   * Update asset metadata
   */
  async updateMetadata(
    assetId: string,
    updates: Partial<LibraryAsset>
  ): Promise<LibraryAsset> {
    const { data: asset, error } = await this.supabase
      .from('library_assets')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assetId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }

    return asset as LibraryAsset;
  }

  /**
   * Get asset by ID
   */
  async getAsset(assetId: string): Promise<LibraryAsset | null> {
    const { data: asset, error } = await this.supabase
      .from('library_assets')
      .select('*')
      .eq('id', assetId)
      .single();

    if (error) {
      console.error('Failed to get asset:', error);
      return null;
    }

    return asset as LibraryAsset;
  }

  /**
   * List all assets
   */
  async listAssets(filters?: {
    domain?: string;
    assetClass?: string;
    search?: string;
  }): Promise<LibraryAsset[]> {
    let query = this.supabase.from('library_assets').select('*');

    if (filters?.domain) {
      query = query.eq('domain', filters.domain);
    }

    if (filters?.assetClass) {
      query = query.eq('asset_class', filters.assetClass);
    }

    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const { data: assets, error } = await query;

    if (error) {
      console.error('Failed to list assets:', error);
      return [];
    }

    return (assets as LibraryAsset[]) || [];
  }
}
