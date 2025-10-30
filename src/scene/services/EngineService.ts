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
    // Performance flags via localStorage
    const antialias = (localStorage.getItem('perf.antialias') ?? 'true') !== 'false';
    const preserveDrawingBuffer = (localStorage.getItem('perf.preserveDrawingBuffer') ?? 'true') === 'true';
    const alpha = (localStorage.getItem('perf.alpha') ?? 'true') === 'true';
    const scaleStr = localStorage.getItem('perf.scale');
    const renderScale = Math.min(1, Math.max(0.5, scaleStr ? parseFloat(scaleStr) : 1));

    if (useWebGPU && await BABYLON.WebGPUEngine.IsSupportedAsync) {
      try {
        console.log('🚀 Initializing WebGPU engine...');
        const webgpuEngine = new BABYLON.WebGPUEngine(canvas, {
          antialias,
          stencil: true,
        });
        await webgpuEngine.initAsync();
        this.engine = webgpuEngine;
        // Apply dynamic resolution if requested
        if (renderScale !== 1) {
          const e: any = webgpuEngine as any;
          if (e && typeof e.setHardwareScalingLevel === 'function') {
            e.setHardwareScalingLevel(1 / renderScale);
          }
        }
        this.isUsingWebGPU = true;
        console.log('✅ WebGPU engine ready');
      } catch (error) {
        console.warn('⚠️ WebGPU initialization failed, falling back to WebGL2:', error);
        this.engine = new BABYLON.Engine(canvas, true, {
          preserveDrawingBuffer,
          stencil: true,
          alpha,
          antialias,
        });
        this.isUsingWebGPU = false;
        console.log('Using WebGL2 engine (fallback)');
        if (renderScale !== 1) {
          (this.engine as BABYLON.Engine).setHardwareScalingLevel(1 / renderScale);
        }
      }
    } else {
      this.engine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer,
        stencil: true,
        alpha,
        antialias,
      });
      this.isUsingWebGPU = false;
      if (renderScale !== 1) {
        (this.engine as BABYLON.Engine).setHardwareScalingLevel(1 / renderScale);
      }
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
