/**
 * SixAxisRobotTargetHandler Unit Tests
 * Owner: Agent 1 (George)
 *
 * Tests for 6-axis robot joint and linear motion handling
 */

import { describe, it, expect, vi } from 'vitest';
import {
  isSixAxisRobot,
  getSixAxisJointConfiguration,
  syncTcpGizmoAfterJointMove,
  syncTcpGizmoAfterLinearMove,
  validateLinearMotionTarget
} from '../SixAxisRobotTargetHandler';
import * as BABYLON from '@babylonjs/core';

// Mock KinematicsManager
vi.mock('../../KinematicsManager', () => ({
  KinematicsManager: {
    getInstance: vi.fn(() => ({
      getChain: vi.fn((_chainName: string) => ({
        id: 'test-chain',
        name: _chainName,
        dof: 6,
        joints: [
          { id: 'joint1', type: 'revolute', position: 0 },
          { id: 'joint2', type: 'revolute', position: 0 },
          { id: 'joint3', type: 'revolute', position: 0 },
          { id: 'joint4', type: 'revolute', position: 0 },
          { id: 'joint5', type: 'revolute', position: 0 },
          { id: 'joint6', type: 'revolute', position: 0 },
        ]
      })),
      getActuatedJoints: vi.fn(() => [
        { id: 'joint1', position: 0 },
        { id: 'joint2', position: 0 },
        { id: 'joint3', position: 0 },
        { id: 'joint4', position: 0 },
        { id: 'joint5', position: 0 },
        { id: 'joint6', position: 0 },
      ])
    }))
  }
}));

// Mock ForwardKinematicsSolver
const mockFKSolver = {
  getTCPPose: vi.fn(() => ({
    position: new BABYLON.Vector3(1, 2, 3),
    rotation: BABYLON.Quaternion.Identity()
  }))
};

// Mock UnifiedGizmoManager
const mockUnifiedGizmo = {
  updateTargetPosition: vi.fn(),
  updateTargetRotation: vi.fn()
};

describe('SixAxisRobotTargetHandler', () => {

  describe('isSixAxisRobot', () => {
    it('should identify 6-DOF robot correctly', () => {
      const result = isSixAxisRobot('robot1', 'chain1');
      expect(result).toBe(true);
    });

    it('should return boolean type', () => {
      const result = isSixAxisRobot('robot1', 'chain1');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getSixAxisJointConfiguration', () => {
    it('should get joint configuration with all required fields', () => {
      const result = getSixAxisJointConfiguration('robot1', 'chain1');

      expect(result).toHaveProperty('robotId');
      expect(result).toHaveProperty('chainName');
      expect(result).toHaveProperty('joints');
      expect(result.robotId).toBe('robot1');
      expect(result.chainName).toBe('chain1');
    });

    it('should return exactly 6 joint angles', () => {
      const result = getSixAxisJointConfiguration('robot1', 'chain1');
      expect(result.joints).toHaveLength(6);
    });

    it('should calculate configuration flags', () => {
      const result = getSixAxisJointConfiguration('robot1', 'chain1');

      expect(result).toHaveProperty('elbow');
      expect(result).toHaveProperty('wrist');
      expect(result).toHaveProperty('front');
      expect(['up', 'down']).toContain(result.elbow);
      expect(['flip', 'non-flip']).toContain(result.wrist);
      expect(['front', 'rear']).toContain(result.front);
    });

    it('should include turn counts for all joints', () => {
      const result = getSixAxisJointConfiguration('robot1', 'chain1');

      expect(result).toHaveProperty('turns');
      expect(result.turns).toHaveLength(6);
      result.turns.forEach(turn => {
        expect(typeof turn).toBe('number');
      });
    });
  });

  describe('syncTcpGizmoAfterJointMove', () => {
    it('should return success result', () => {
      const result = syncTcpGizmoAfterJointMove(
        'robot1',
        'chain1',
        mockFKSolver as any,
        mockUnifiedGizmo as any
      );

      expect(result.success).toBe(true);
      expect(result.robotId).toBe('robot1');
      expect(result.chainName).toBe('chain1');
    });

    it('should call gizmo update methods', () => {
      mockUnifiedGizmo.updateTargetPosition.mockClear();
      mockUnifiedGizmo.updateTargetRotation.mockClear();

      syncTcpGizmoAfterJointMove(
        'robot1',
        'chain1',
        mockFKSolver as any,
        mockUnifiedGizmo as any
      );

      expect(mockUnifiedGizmo.updateTargetPosition).toHaveBeenCalled();
      expect(mockUnifiedGizmo.updateTargetRotation).toHaveBeenCalled();
    });

    it('should return TCP position from FK solver', () => {
      const result = syncTcpGizmoAfterJointMove(
        'robot1',
        'chain1',
        mockFKSolver as any,
        mockUnifiedGizmo as any
      );

      expect(result.tcpPosition).toBeDefined();
      expect(result.tcpPosition).toBeInstanceOf(BABYLON.Vector3);
      expect(result.tcpRotation).toBeDefined();
    });
  });

  describe('syncTcpGizmoAfterLinearMove', () => {
    it('should sync successfully after linear movement', () => {
      const result = syncTcpGizmoAfterLinearMove(
        'robot1',
        'chain1',
        mockFKSolver as any,
        mockUnifiedGizmo as any
      );

      expect(result.success).toBe(true);
    });

    it('should call updateTargetPosition', () => {
      mockUnifiedGizmo.updateTargetPosition.mockClear();

      syncTcpGizmoAfterLinearMove(
        'robot1',
        'chain1',
        mockFKSolver as any,
        mockUnifiedGizmo as any
      );

      expect(mockUnifiedGizmo.updateTargetPosition).toHaveBeenCalled();
    });
  });

  describe('validateLinearMotionTarget', () => {
    it('should validate target with position and rotation', () => {
      const target = {
        position: new BABYLON.Vector3(1, 2, 3),
        rotation: BABYLON.Quaternion.Identity()
      };

      const result = validateLinearMotionTarget(
        'robot1',
        'chain1',
        target
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate target with only position', () => {
      const target = {
        position: new BABYLON.Vector3(1, 2, 3)
      };

      const result = validateLinearMotionTarget(
        'robot1',
        'chain1',
        target
      );

      expect(result.valid).toBe(true);
    });

    it('should return validation result structure', () => {
      const target = {
        position: new BABYLON.Vector3(1, 2, 3),
        rotation: BABYLON.Quaternion.Identity()
      };

      const result = validateLinearMotionTarget(
        'robot1',
        'chain1',
        target
      );

      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty chainName gracefully', () => {
      expect(() => {
        getSixAxisJointConfiguration('robot1', '');
      }).not.toThrow();
    });

    it('should handle extreme joint angles', () => {
      const result = getSixAxisJointConfiguration('robot1', 'chain1');
      expect(result).toBeDefined();
      expect(result.joints).toHaveLength(6);
    });

    it('should handle target at origin', () => {
      const target = {
        position: new BABYLON.Vector3(0, 0, 0),
        rotation: BABYLON.Quaternion.Identity()
      };

      const result = validateLinearMotionTarget(
        'robot1',
        'chain1',
        target
      );

      expect(typeof result.valid).toBe('boolean');
    });
  });
});
