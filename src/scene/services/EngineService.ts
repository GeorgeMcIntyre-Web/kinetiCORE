// Engine Service - Handles Babylon.js engine initialization
// Owner: Cole

import * as BABYLON from '@babylonjs/core';

export class EngineService {
  private static instance: EngineService | null = null;
  private engine: BABYLON.Engine | BABYLON.WebGPUEngine | null = null;
  private isUsingWebGPU: boolean = false;

  private constructor() {}

  static getInstance(): EngineService {
    if (!EngineService.instance) {
      EngineService.instance = new EngineService();
    }
    return EngineService.instance;
  }

  /**
   * Initialize the Babylon.js engine with WebGPU fallback
   */
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Try WebGPU first, fallback to WebGL2
    const useWebGPU = localStorage.getItem('preferWebGPU') !== 'false';

    if (useWebGPU && await BABYLON.WebGPUEngine.IsSupportedAsync) {
      try {
        console.log('🚀 Initializing WebGPU engine...');
        const webgpuEngine = new BABYLON.WebGPUEngine(canvas, {
          antialias: true,
          stencil: true,
        });
        await webgpuEngine.initAsync();
        this.engine = webgpuEngine;
        this.isUsingWebGPU = true;
        console.log('✅ WebGPU engine ready');
      } catch (error) {
        console.warn('⚠️ WebGPU initialization failed, falling back to WebGL2:', error);
        this.engine = new BABYLON.Engine(canvas, true, {
          preserveDrawingBuffer: true,
          stencil: true,
        });
        this.isUsingWebGPU = false;
        console.log('Using WebGL2 engine (fallback)');
      }
    } else {
      this.engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
      });
      this.isUsingWebGPU = false;
      if (!useWebGPU) {
        console.log('Using WebGL2 engine (user preference)');
      } else {
        console.log('Using WebGL2 engine (WebGPU not supported)');
      }
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine?.resize();
    });
  }

  getEngine(): BABYLON.Engine | BABYLON.WebGPUEngine | null {
    return this.engine;
  }

  isWebGPU(): boolean {
    return this.isUsingWebGPU;
  }

  getRenderingEngineName(): string {
    return this.isUsingWebGPU ? 'WebGPU' : 'WebGL2';
  }

  dispose(): void {
    this.engine?.dispose();
    this.engine = null;
    this.isUsingWebGPU = false;
  }
}
