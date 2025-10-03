/**
 * DXF Import Controller
 * High-level API for importing DXF files with Web Worker support
 */

import * as BABYLON from '@babylonjs/core';
import { DXFParser } from './DXFParser';
import { DXFToBabylonConverter } from './DXFToBabylonConverter';
import type {
  DXFDocument,
  DXFParseOptions,
  DXFToBabylonOptions,
  DXFConversionResult,
  DXFParseProgress,
  DXFWorkerRequest,
  DXFWorkerResponse,
  DXFLayerController,
} from './types';

export interface DXFImportResult extends DXFConversionResult {
  document: DXFDocument;
  layerController: DXFLayerController;
}

export class DXFController {
  private scene: BABYLON.Scene;
  private converter: DXFToBabylonConverter;
  private worker?: Worker;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.converter = new DXFToBabylonConverter(scene);
  }

  /**
   * Import DXF file from File object
   * Automatically uses Web Worker for files >1MB
   */
  async importFile(
    file: File,
    parseOptions: DXFParseOptions = {},
    conversionOptions: DXFToBabylonOptions = {},
    onProgress?: (progress: DXFParseProgress) => void
  ): Promise<DXFImportResult> {
    // Auto-enable worker for large files
    const useWorker =
      parseOptions.useWorker ?? file.size > 1024 * 1024; // 1MB threshold

    let document: DXFDocument;

    if (useWorker && typeof Worker !== 'undefined') {
      document = await this.parseWithWorker(file, parseOptions, onProgress);
    } else {
      document = await this.parseInMainThread(file, parseOptions, onProgress);
    }

    // Convert to Babylon.js meshes
    if (onProgress) {
      onProgress({
        phase: 'converting',
        entitiesParsed: document.entities.length,
        totalEntities: document.entities.length,
        percentage: 90,
      });
    }

    const conversionResult = this.converter.convert(document, {
      mergeByLayer: true, // Default to merging for performance
      maxVerticesPerMesh: 65535,
      extrusionThickness: 0.1,
      ...conversionOptions,
    });

    if (onProgress) {
      onProgress({
        phase: 'rendering',
        entitiesParsed: document.entities.length,
        totalEntities: document.entities.length,
        percentage: 100,
      });
    }

    // Create layer controller
    const layerController = this.createLayerController(
      conversionResult.layerGroups
    );

    return {
      ...conversionResult,
      document,
      layerController,
    };
  }

  /**
   * Import DXF from raw string content
   */
  async importFromString(
    content: string,
    parseOptions: DXFParseOptions = {},
    conversionOptions: DXFToBabylonOptions = {},
    onProgress?: (progress: DXFParseProgress) => void
  ): Promise<DXFImportResult> {
    const parser = new DXFParser(parseOptions);
    const document = await parser.parse(content, onProgress);

    if (onProgress) {
      onProgress({
        phase: 'converting',
        entitiesParsed: document.entities.length,
        totalEntities: document.entities.length,
        percentage: 90,
      });
    }

    const conversionResult = this.converter.convert(document, {
      mergeByLayer: true,
      maxVerticesPerMesh: 65535,
      extrusionThickness: 0.1,
      ...conversionOptions,
    });

    const layerController = this.createLayerController(
      conversionResult.layerGroups
    );

    return {
      ...conversionResult,
      document,
      layerController,
    };
  }

  /**
   * Parse DXF using Web Worker (non-blocking)
   */
  private async parseWithWorker(
    file: File,
    options: DXFParseOptions,
    onProgress?: (progress: DXFParseProgress) => void
  ): Promise<DXFDocument> {
    return new Promise((resolve, reject) => {
      // Create worker
      this.worker = new Worker(
        new URL('./dxf.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<DXFWorkerResponse>) => {
        const { type, data, progress, error } = event.data;

        switch (type) {
          case 'progress':
            if (progress && onProgress) {
              onProgress(progress);
            }
            break;

          case 'complete':
            if (data) {
              // Reconstruct Map objects (they don't serialize)
              data.layers = new Map(Object.entries(data.layers || {}));
              data.blocks = new Map(Object.entries(data.blocks || {}));
              resolve(data as DXFDocument);
            }
            this.terminateWorker();
            break;

          case 'error':
            reject(new Error(error || 'Worker parsing failed'));
            this.terminateWorker();
            break;
        }
      };

      this.worker.onerror = (error) => {
        reject(error);
        this.terminateWorker();
      };

      // Send file to worker
      file.arrayBuffer().then((buffer) => {
        const request: DXFWorkerRequest = {
          type: 'parse',
          fileData: buffer,
          options,
        };
        this.worker!.postMessage(request);
      });
    });
  }

  /**
   * Parse DXF in main thread (blocking but simpler)
   */
  private async parseInMainThread(
    file: File,
    options: DXFParseOptions,
    onProgress?: (progress: DXFParseProgress) => void
  ): Promise<DXFDocument> {
    const content = await file.text();
    const parser = new DXFParser(options);
    return parser.parse(content, onProgress);
  }

  /**
   * Create layer visibility controller
   */
  private createLayerController(
    layerGroups: Map<string, BABYLON.Mesh[]>
  ): DXFLayerController {
    return {
      setLayerVisibility: (layerName: string, visible: boolean) => {
        const meshes = layerGroups.get(layerName);
        if (meshes) {
          meshes.forEach((mesh) => {
            mesh.isVisible = visible;
          });
        }
      },

      setLayerOpacity: (layerName: string, opacity: number) => {
        const meshes = layerGroups.get(layerName);
        if (meshes) {
          meshes.forEach((mesh) => {
            if (mesh.material) {
              mesh.material.alpha = opacity;
            }
          });
        }
      },

      getLayerMeshes: (layerName: string) => {
        return layerGroups.get(layerName) || [];
      },

      getAllLayers: () => {
        return Array.from(layerGroups.keys());
      },
    };
  }

  /**
   * Terminate Web Worker if active
   */
  private terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.terminateWorker();
    this.converter.dispose();
  }
}
