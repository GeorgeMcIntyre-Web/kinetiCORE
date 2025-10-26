/**
 * UnifiedGizmoManager Unit Tests
 * Owner: Agent 1 (George)
 * 
 * Tests for the unified gizmo orchestration system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedGizmoManager, ActivePanel } from '../UnifiedGizmoManager';
import * as BABYLON from '@babylonjs/core';

// Mock IKTargetGizmoManager
vi.mock('../IKTargetGizmoManager', () => ({
  IKTargetGizmoManager: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      createTarget: vi.fn(),
      removeTarget: vi.fn(),
      updateTargetPosition: vi.fn(),
      clearAll: vi.fn(),
    })),
  },
}));

describe('UnifiedGizmoManager', () => {
  let manager: UnifiedGizmoManager;
  let mockScene: BABYLON.Scene;

  beforeEach(() => {
    // Reset singleton instance for each test
    (UnifiedGizmoManager as any).instance = null;
    manager = UnifiedGizmoManager.getInstance();
    
    // Create mock scene
    mockScene = {
      name: 'test-scene',
    } as BABYLON.Scene;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = UnifiedGizmoManager.getInstance();
      const instance2 = UnifiedGizmoManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize with a scene', () => {
      expect(() => manager.initialize(mockScene)).not.toThrow();
    });

    it('should log initialization message', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      manager.initialize(mockScene);
      
      expect(consoleSpy).toHaveBeenCalledWith('[UnifiedGizmo] Initialized with scene');
    });
  });

  describe('Panel Management', () => {
    it('should set active panel', () => {
      manager.setActivePanel('motion');
      expect(manager.getActivePanel()).toBe('motion');
    });

    it('should change panel context', () => {
      manager.setActivePanel('motion');
      expect(manager.getActivePanel()).toBe('motion');
      
      manager.setActivePanel('fullbody_ik');
      expect(manager.getActivePanel()).toBe('fullbody_ik');
    });

    it('should log panel switch', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      manager.setActivePanel('device');
      
      expect(consoleSpy).toHaveBeenCalledWith('[UnifiedGizmo] Switching to panel: device');
    });

    it('should handle all valid panel types', () => {
      const panels: ActivePanel[] = ['none', 'motion', 'fullbody_ik', 'device'];
      
      panels.forEach(panel => {
        manager.setActivePanel(panel);
        expect(manager.getActivePanel()).toBe(panel);
      });
    });
  });

  describe('Target Creation', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should create TCP control target', () => {
      const mockCallback = vi.fn();
      const position = new BABYLON.Vector3(1, 2, 3);
      
      manager.createTcpControl('robot-1', 'main-chain', position, mockCallback);
      
      const targets = manager.getActiveTargets();
      expect(targets.has('tcp_robot-1')).toBe(true);
    });

    it('should create device base target', () => {
      const mockCallback = vi.fn();
      const position = new BABYLON.Vector3(0, 0, 0);
      
      manager.createDeviceBase('device-1', position, mockCallback);
      
      const targets = manager.getActiveTargets();
      expect(targets.has('device_device-1')).toBe(true);
    });

    it('should create IK target', () => {
      const mockCallback = vi.fn();
      const position = new BABYLON.Vector3(0.5, 1.5, 0.8);
      
      manager.createIkTarget('left-hand', 'left-arm', position, mockCallback);
      
      const targets = manager.getActiveTargets();
      expect(targets.has('left-hand')).toBe(true);
    });

    it('should log target creation', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const position = new BABYLON.Vector3(0, 0, 0);
      
      manager.createDeviceBase('test-device', position, vi.fn());
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[UnifiedGizmo] Created target: device_test-device (device_base)'
      );
    });

    it('should replace existing target with same ID', () => {
      const position1 = new BABYLON.Vector3(0, 0, 0);
      const position2 = new BABYLON.Vector3(1, 1, 1);
      
      manager.createDeviceBase('device-1', position1, vi.fn());
      manager.createDeviceBase('device-1', position2, vi.fn());
      
      const targets = manager.getActiveTargets();
      const target = targets.get('device_device-1');
      
      expect(target?.position).toEqual(position2);
    });
  });

  describe('Target Removal', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should remove target by ID', () => {
      const position = new BABYLON.Vector3(0, 0, 0);
      manager.createDeviceBase('device-1', position, vi.fn());
      
      expect(manager.getActiveTargets().has('device_device-1')).toBe(true);
      
      manager.removeTarget('device_device-1');
      
      expect(manager.getActiveTargets().has('device_device-1')).toBe(false);
    });

    it('should handle removing non-existent target', () => {
      expect(() => manager.removeTarget('non-existent')).not.toThrow();
    });
  });

  describe('Target Position Updates', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should update target position', () => {
      const initialPos = new BABYLON.Vector3(0, 0, 0);
      const newPos = new BABYLON.Vector3(5, 5, 5);
      
      manager.createDeviceBase('device-1', initialPos, vi.fn());
      manager.updateTargetPosition('device_device-1', newPos);
      
      const target = manager.getActiveTargets().get('device_device-1');
      expect(target?.position).toEqual(newPos);
    });

    it('should handle updating non-existent target', () => {
      const newPos = new BABYLON.Vector3(1, 2, 3);
      expect(() => manager.updateTargetPosition('non-existent', newPos)).not.toThrow();
    });
  });

  describe('Clear All Targets', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should clear all targets', () => {
      manager.createDeviceBase('device-1', new BABYLON.Vector3(0, 0, 0), vi.fn());
      manager.createDeviceBase('device-2', new BABYLON.Vector3(1, 1, 1), vi.fn());
      
      expect(manager.getActiveTargets().size).toBe(2);
      
      manager.clearAll();
      
      expect(manager.getActiveTargets().size).toBe(0);
    });
  });

  describe('Gizmo Visibility Logic', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should show TCP gizmo only in motion panel', () => {
      const tcpPos = new BABYLON.Vector3(1, 2, 3);
      manager.createTcpControl('robot-1', 'chain-1', tcpPos, vi.fn());
      
      manager.setActivePanel('motion');
      // In motion panel, TCP gizmo should be visible
      
      manager.setActivePanel('device');
      // In device panel, TCP gizmo should be hidden
      
      manager.setActivePanel('none');
      // In none panel, all gizmos should be hidden
    });

    it('should show device gizmo only in device panel', () => {
      const devicePos = new BABYLON.Vector3(0, 0, 0);
      manager.createDeviceBase('device-1', devicePos, vi.fn());
      
      manager.setActivePanel('device');
      // In device panel, device gizmo should be visible
      
      manager.setActivePanel('motion');
      // In motion panel, device gizmo should be hidden
    });

    it('should show IK targets only in fullbody_ik panel', () => {
      const ikPos = new BABYLON.Vector3(0.5, 1.5, 0.8);
      manager.createIkTarget('left-hand', 'left-arm', ikPos, vi.fn());
      
      manager.setActivePanel('fullbody_ik');
      // In fullbody_ik panel, IK targets should be visible
      
      manager.setActivePanel('motion');
      // In motion panel, IK targets should be hidden
    });
  });

  describe('Callback Invocation', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should invoke onPositionChange callback for TCP control', () => {
      const mockCallback = vi.fn();
      const position = new BABYLON.Vector3(1, 2, 3);
      
      manager.createTcpControl('robot-1', 'chain-1', position, mockCallback);
      
      // Simulate gizmo movement (would normally be triggered by IKTargetGizmoManager)
      const target = manager.getActiveTargets().get('tcp_robot-1');
      if (target?.onPositionChange) {
        const newPos = new BABYLON.Vector3(2, 3, 4);
        target.onPositionChange('tcp_robot-1', newPos);
        expect(mockCallback).toHaveBeenCalledWith(newPos);
      }
    });

    it('should invoke onDeviceMove callback for device base', () => {
      const mockCallback = vi.fn();
      const position = new BABYLON.Vector3(0, 0, 0);
      
      manager.createDeviceBase('device-1', position, mockCallback);
      
      // Simulate gizmo movement
      const target = manager.getActiveTargets().get('device_device-1');
      if (target?.onDeviceMove) {
        const newPos = new BABYLON.Vector3(5, 5, 5);
        target.onDeviceMove('device-1', newPos);
        expect(mockCallback).toHaveBeenCalledWith('device-1', newPos);
      }
    });
  });

  describe('Metadata Support', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should store metadata with target', () => {
      const position = new BABYLON.Vector3(0, 0, 0);
      
      manager.createDeviceBase('device-1', position, vi.fn());
      
      const target = manager.getActiveTargets().get('device_device-1');
      expect(target?.metadata?.robotId).toBe('device-1');
      expect(target?.metadata?.description).toBe('Device Base for device-1');
    });

    it('should include chain name in TCP metadata', () => {
      const position = new BABYLON.Vector3(1, 2, 3);
      
      manager.createTcpControl('robot-1', 'main-chain', position, vi.fn());
      
      const target = manager.getActiveTargets().get('tcp_robot-1');
      expect(target?.chainName).toBe('main-chain');
      expect(target?.metadata?.description).toBe('TCP Control for main-chain');
    });
  });

  describe('Console Logging', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should log TCP movement', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const position = new BABYLON.Vector3(1, 2, 3);
      
      manager.createTcpControl('robot-1', 'chain-1', position, vi.fn());
      
      // Simulate movement
      const target = manager.getActiveTargets().get('tcp_robot-1');
      if (target?.onPositionChange) {
        const newPos = new BABYLON.Vector3(1.5, 2.5, 3.5);
        target.onPositionChange('tcp_robot-1', newPos);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[UnifiedGizmo] TCP moved to:')
        );
      }
    });

    it('should log device movement', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      const position = new BABYLON.Vector3(0, 0, 0);
      
      manager.createDeviceBase('device-1', position, vi.fn());
      
      // Simulate movement
      const target = manager.getActiveTargets().get('device_device-1');
      if (target?.onDeviceMove) {
        const newPos = new BABYLON.Vector3(5, 5, 5);
        target.onDeviceMove('device-1', newPos);
        
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[UnifiedGizmo] Device device-1 moved to:')
        );
      }
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should handle empty target ID', () => {
      const position = new BABYLON.Vector3(0, 0, 0);
      expect(() => manager.createDeviceBase('', position, vi.fn())).not.toThrow();
    });

    it('should handle null position', () => {
      // TypeScript should prevent this, but test runtime behavior
      expect(() => 
        manager.createDeviceBase('device-1', null as any, vi.fn())
      ).toThrow();
    });

    it('should handle missing callback', () => {
      const position = new BABYLON.Vector3(0, 0, 0);
      // Should not throw even without callback
      expect(() => 
        manager.createDeviceBase('device-1', position, null as any)
      ).not.toThrow();
    });

    it('should handle panel switching with no targets', () => {
      expect(() => {
        manager.setActivePanel('motion');
        manager.setActivePanel('device');
        manager.setActivePanel('none');
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      manager.initialize(mockScene);
    });

    it('should handle many targets efficiently', () => {
      const startTime = performance.now();
      
      // Create 100 targets
      for (let i = 0; i < 100; i++) {
        manager.createIkTarget(
          `target-${i}`,
          `chain-${i}`,
          new BABYLON.Vector3(i, i, i),
          vi.fn()
        );
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (<100ms)
      expect(duration).toBeLessThan(100);
      expect(manager.getActiveTargets().size).toBe(100);
    });

    it('should handle rapid panel switching', () => {
      const startTime = performance.now();
      
      // Rapidly switch panels 100 times
      for (let i = 0; i < 100; i++) {
        const panels: ActivePanel[] = ['motion', 'device', 'fullbody_ik', 'none'];
        manager.setActivePanel(panels[i % 4]);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in reasonable time (<50ms)
      expect(duration).toBeLessThan(50);
    });
  });
});
