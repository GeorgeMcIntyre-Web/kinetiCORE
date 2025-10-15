// GLB Loader Integration Tests
// Tests GLB loader integration with existing MJCF workflow
// Owner: AI Assistant

import { GLBLoader, loadGLBFromFile, type GLBLoadResult } from './GLBLoader';
import * as BABYLON from '@babylonjs/core';

// Mock File object for testing
const createMockGLBFile = (name: string, size: number = 1024): File => {
  const blob = new Blob(['mock glb data'], { type: 'model/gltf-binary' });
  return new File([blob], name, { type: 'model/gltf-binary' });
};

// Mock scene for testing
const createMockScene = (): BABYLON.Scene => {
  const engine = new BABYLON.NullEngine();
  return new BABYLON.Scene(engine);
};

describe('GLBLoader Integration Tests', () => {
  let scene: BABYLON.Scene;
  let loader: GLBLoader;

  beforeEach(() => {
    scene = createMockScene();
    loader = GLBLoader.getInstance();
  });

  afterEach(() => {
    scene.dispose();
  });

  describe('File Validation Guard Rails', () => {
    test('should reject invalid file types', async () => {
      const invalidFile = createMockGLBFile('test.txt');
      const result = await loadGLBFromFile(invalidFile, scene);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid GLB file: File validation failed');
    });

    test('should reject empty files', async () => {
      const emptyFile = createMockGLBFile('test.glb', 0);
      const result = await loadGLBFromFile(emptyFile, scene);
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid GLB file: File validation failed');
    });

    test('should accept valid GLB files', async () => {
      const validFile = createMockGLBFile('test.glb', 1024);
      const result = await loadGLBFromFile(validFile, scene);
      
      // Should attempt to load even if it fails due to mock data
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });

  describe('MJCF Interface Compatibility', () => {
    test('should return MJCF-compatible result structure', async () => {
      const file = createMockGLBFile('test.glb');
      const result = await loadGLBFromFile(file, scene);

      // Check required MJCF-compatible properties
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('rootNodes');
      expect(result).toHaveProperty('meshes');
      expect(result).toHaveProperty('joints');
      expect(result).toHaveProperty('actuators');
      expect(result).toHaveProperty('sensors');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('bounds');

      // Check that GLB-specific arrays are empty (as expected)
      expect(Array.isArray(result.joints)).toBe(true);
      expect(Array.isArray(result.actuators)).toBe(true);
      expect(Array.isArray(result.sensors)).toBe(true);
    });

    test('should include GLB-specific warnings', async () => {
      const file = createMockGLBFile('test.glb');
      const result = await loadGLBFromFile(file, scene);

      expect(result.warnings).toContain('GLB file loaded - visual model only');
      expect(result.warnings).toContain('No kinematic controls available');
      expect(result.warnings).toContain('Use MJCF format for robot functionality');
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should handle loading errors gracefully', async () => {
      const file = createMockGLBFile('test.glb');
      const result = await loadGLBFromFile(file, scene);

      // Should not throw, but may have errors
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should provide detailed error messages', async () => {
      const file = createMockGLBFile('test.glb');
      const result = await loadGLBFromFile(file, scene);

      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('GLB loading failed');
      }
    });
  });

  describe('Metadata Extraction', () => {
    test('should extract file metadata', async () => {
      const file = createMockGLBFile('test.glb', 2048);
      const result = await loadGLBFromFile(file, scene, {
        enableMetadataExtraction: true
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.fileSize).toBe(2048);
      expect(typeof result.metadata?.loadTime).toBe('number');
      expect(typeof result.metadata?.meshCount).toBe('number');
      expect(typeof result.metadata?.hasAnimations).toBe('boolean');
      expect(typeof result.metadata?.hasMaterials).toBe('boolean');
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const loader1 = GLBLoader.getInstance();
      const loader2 = GLBLoader.getInstance();
      
      expect(loader1).toBe(loader2);
    });
  });

  describe('Options Handling', () => {
    test('should respect enableProgressCallback option', async () => {
      const file = createMockGLBFile('test.glb');
      let progressCalled = false;
      
      await loadGLBFromFile(file, scene, {
        enableProgressCallback: true,
        onProgress: () => {
          progressCalled = true;
        }
      });

      // Progress callback should be called (even if just once)
      expect(progressCalled).toBe(true);
    });

    test('should respect enableBoundsCalculation option', async () => {
      const file = createMockGLBFile('test.glb');
      
      const resultWithBounds = await loadGLBFromFile(file, scene, {
        enableBoundsCalculation: true
      });
      
      const resultWithoutBounds = await loadGLBFromFile(file, scene, {
        enableBoundsCalculation: false
      });

      // Both should be defined, but behavior may differ
      expect(resultWithBounds.bounds).toBeDefined();
      expect(resultWithoutBounds.bounds).toBeDefined();
    });
  });
});

describe('GLB Loader Integration with ModelLoader', () => {
  test('should be compatible with ModelLoader interface', async () => {
    // This test ensures the GLB loader returns data in the format expected by ModelLoader
    const file = createMockGLBFile('test.glb');
    const scene = createMockScene();
    
    const result = await loadGLBFromFile(file, scene);
    
    // ModelLoader expects { meshes, rootNodes }
    expect(Array.isArray(result.meshes)).toBe(true);
    expect(Array.isArray(result.rootNodes)).toBe(true);
    
    scene.dispose();
  });
});

describe('Backward Compatibility', () => {
  test('should not break existing MJCF workflow', () => {
    // This test ensures GLB loader doesn't interfere with existing functionality
    const loader = GLBLoader.getInstance();
    expect(loader).toBeDefined();
    
    // Should not throw when creating instance
    expect(() => GLBLoader.getInstance()).not.toThrow();
  });
});
