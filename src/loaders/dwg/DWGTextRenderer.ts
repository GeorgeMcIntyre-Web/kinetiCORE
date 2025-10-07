/**
 * DWG Text Renderer Service
 * Owner: George
 *
 * Renders TEXT entities from DWG files using Babylon.js MSDF TextRenderer
 * Provides crisp, scalable text at any zoom level for CAD labels
 */

import * as BABYLON from '@babylonjs/core';
import * as ADDONS from '@babylonjs/addons';

/**
 * TEXT entity data extracted from DWG
 */
export interface DWGTextEntity {
  contents: string;
  position: BABYLON.Vector3;
  height: number; // Text height in world units
  rotation: number; // Rotation in radians
  layer: string;
  color?: string;
}

/**
 * Service for rendering DWG TEXT entities using MSDF
 */
export class DWGTextRenderer {
  private textRenderer: ADDONS.TextRenderer | null = null;
  private fontAsset: ADDONS.FontAsset | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize MSDF text renderer (async, call once)
   */
  async initialize(engine: BABYLON.Engine): Promise<void> {
    // Return existing initialization promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Already initialized
    if (this.isInitialized && this.textRenderer) {
      return;
    }

    this.initPromise = (async () => {
      try {
        console.log('[DWG Text Renderer] Initializing MSDF text renderer...');

        // Load font definition and atlas
        const fontUrl = 'https://assets.babylonjs.com/fonts/roboto-regular.json';
        const atlasUrl = 'https://assets.babylonjs.com/fonts/roboto-regular.png';

        const sdfFontDefinition = await (await fetch(fontUrl)).text();
        this.fontAsset = new ADDONS.FontAsset(sdfFontDefinition, atlasUrl);

        // Create text renderer
        this.textRenderer = await ADDONS.TextRenderer.CreateTextRendererAsync(
          this.fontAsset,
          engine
        );

        // Configure for billboard mode (text faces camera)
        this.textRenderer.isBillboard = true;
        this.textRenderer.isBillboardScreenProjected = false; // Keep world-space sizing

        this.isInitialized = true;
        console.log('[DWG Text Renderer] MSDF text renderer initialized successfully');
      } catch (error) {
        console.error('[DWG Text Renderer] Failed to initialize MSDF renderer:', error);
        this.initPromise = null; // Allow retry
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Add a single TEXT entity to the scene
   */
  addText(textEntity: DWGTextEntity): void {
    if (!this.textRenderer || !this.isInitialized) {
      console.warn('[DWG Text Renderer] Cannot add text - renderer not initialized');
      return;
    }

    if (!textEntity.contents || textEntity.contents.trim().length === 0) {
      return; // Skip empty text
    }

    try {
      // Create transform matrix for text position and rotation
      const transform = BABYLON.Matrix.Compose(
        new BABYLON.Vector3(textEntity.height, textEntity.height, 1), // Scale by text height
        BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, textEntity.rotation), // Rotate around Z
        textEntity.position // Position
      );

      // Add paragraph with transform
      // Note: TextRenderer.addParagraph API may not support all options
      // Check Babylon.js docs for available paragraph options
      this.textRenderer.addParagraph(
        textEntity.contents,
        {
          textAlign: 'left' // CAD text is typically left-aligned
        },
        transform
      );
    } catch (error) {
      console.warn(
        `[DWG Text Renderer] Failed to add text "${textEntity.contents}":`,
        error
      );
    }
  }

  /**
   * Batch add multiple TEXT entities
   */
  addTexts(textEntities: DWGTextEntity[]): void {
    if (!this.textRenderer || !this.isInitialized) {
      console.warn('[DWG Text Renderer] Cannot add texts - renderer not initialized');
      return;
    }

    console.log(`[DWG Text Renderer] Adding ${textEntities.length} TEXT entities...`);
    const startTime = performance.now();

    let addedCount = 0;
    for (const textEntity of textEntities) {
      if (textEntity.contents && textEntity.contents.trim().length > 0) {
        this.addText(textEntity);
        addedCount++;
      }
    }

    const duration = performance.now() - startTime;
    console.log(
      `[DWG Text Renderer] Added ${addedCount} TEXT labels in ${duration.toFixed(2)}ms`
    );
  }

  /**
   * Clear all text from the renderer
   */
  clear(): void {
    if (this.textRenderer) {
      // Note: TextRenderer may not have clear() method
      // Alternative: dispose and reinitialize if needed
      console.log('[DWG Text Renderer] Clear not yet implemented');
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.textRenderer) {
      this.textRenderer.dispose();
      this.textRenderer = null;
    }

    if (this.fontAsset) {
      this.fontAsset.dispose();
      this.fontAsset = null;
    }

    this.isInitialized = false;
    this.initPromise = null;
  }

  /**
   * Check if renderer is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
}

/**
 * Singleton instance for global access
 */
let globalTextRenderer: DWGTextRenderer | null = null;

/**
 * Get or create global DWG text renderer instance
 */
export function getDWGTextRenderer(): DWGTextRenderer {
  if (!globalTextRenderer) {
    globalTextRenderer = new DWGTextRenderer();
  }
  return globalTextRenderer;
}

/**
 * Dispose global text renderer
 */
export function disposeDWGTextRenderer(): void {
  if (globalTextRenderer) {
    globalTextRenderer.dispose();
    globalTextRenderer = null;
  }
}
