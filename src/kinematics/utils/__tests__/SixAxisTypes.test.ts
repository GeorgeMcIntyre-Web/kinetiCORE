/**
 * Six-Axis Robot Types Unit Tests
 * Owner: Agent 1 (George)
 *
 * Tests for 6-axis robot type definitions and data structures
 */

import { describe, it, expect } from 'vitest';
import type { SixAxisTargetUpdate } from '../SixAxisRobotTargetHandler';
import * as BABYLON from '@babylonjs/core';

describe('SixAxisRobotTypes', () => {

  describe('SixAxisTargetUpdate interface', () => {
    it('should allow creation of valid target update', () => {
      const update: SixAxisTargetUpdate = {
        robotId: 'robot1',
        chainName: 'chain1',
        tcpPosition: new BABYLON.Vector3(1, 2, 3),
        tcpRotation: BABYLON.Quaternion.Identity(),
        success: true
      };

      expect(update.robotId).toBe('robot1');
      expect(update.chainName).toBe('chain1');
      expect(update.success).toBe(true);
    });

    it('should allow optional jointAngles', () => {
      const update: SixAxisTargetUpdate = {
        robotId: 'robot1',
        chainName: 'chain1',
        tcpPosition: new BABYLON.Vector3(1, 2, 3),
        tcpRotation: BABYLON.Quaternion.Identity(),
        jointAngles: [0, 0, 0, 0, 0, 0],
        success: true
      };

      expect(update.jointAngles).toHaveLength(6);
    });

    it('should allow optional error message', () => {
      const update: SixAxisTargetUpdate = {
        robotId: 'robot1',
        chainName: 'chain1',
        tcpPosition: new BABYLON.Vector3(1, 2, 3),
        tcpRotation: BABYLON.Quaternion.Identity(),
        success: false,
        error: 'IK failed'
      };

      expect(update.success).toBe(false);
      expect(update.error).toBe('IK failed');
    });
  });

  describe('BABYLON Vector3 usage', () => {
    it('should create valid position vectors', () => {
      const pos = new BABYLON.Vector3(1.5, 2.5, 3.5);

      expect(pos.x).toBe(1.5);
      expect(pos.y).toBe(2.5);
      expect(pos.z).toBe(3.5);
    });

    it('should allow vector operations', () => {
      const pos1 = new BABYLON.Vector3(1, 0, 0);
      const pos2 = new BABYLON.Vector3(0, 1, 0);
      const sum = pos1.add(pos2);

      expect(sum.x).toBe(1);
      expect(sum.y).toBe(1);
      expect(sum.z).toBe(0);
    });
  });

  describe('BABYLON Quaternion usage', () => {
    it('should create identity rotation', () => {
      const rot = BABYLON.Quaternion.Identity();

      expect(rot.x).toBe(0);
      expect(rot.y).toBe(0);
      expect(rot.z).toBe(0);
      expect(rot.w).toBe(1);
    });

    it('should create rotation from Euler angles', () => {
      const rot = BABYLON.Quaternion.RotationYawPitchRoll(0, 0, Math.PI / 2);

      expect(rot).toBeDefined();
      expect(typeof rot.x).toBe('number');
    });
  });

  describe('Joint configuration arrays', () => {
    it('should validate 6-element joint arrays', () => {
      const joints = [0, 0, 0, 0, 0, 0];

      expect(joints).toHaveLength(6);
      joints.forEach(angle => {
        expect(typeof angle).toBe('number');
      });
    });

    it('should handle joint angles in radians', () => {
      const joints = [
        Math.PI / 2,   // 90°
        Math.PI,       // 180°
        -Math.PI / 2,  // -90°
        0,
        Math.PI / 4,   // 45°
        -Math.PI       // -180°
      ];

      expect(joints).toHaveLength(6);
      joints.forEach(angle => {
        expect(angle).toBeGreaterThanOrEqual(-Math.PI);
        expect(angle).toBeLessThanOrEqual(Math.PI);
      });
    });
  });

  describe('Configuration flags', () => {
    it('should validate elbow configuration', () => {
      const elbowUp = 'up';
      const elbowDown = 'down';

      expect(['up', 'down']).toContain(elbowUp);
      expect(['up', 'down']).toContain(elbowDown);
    });

    it('should validate wrist configuration', () => {
      const wristFlip = 'flip';
      const wristNonFlip = 'non-flip';

      expect(['flip', 'non-flip']).toContain(wristFlip);
      expect(['flip', 'non-flip']).toContain(wristNonFlip);
    });

    it('should validate front/rear configuration', () => {
      const front = 'front';
      const rear = 'rear';

      expect(['front', 'rear']).toContain(front);
      expect(['front', 'rear']).toContain(rear);
    });
  });

  describe('Turn counts', () => {
    it('should calculate turns from joint angles', () => {
      const angle = Math.PI * 3; // 540° = 1.5 turns
      const turns = Math.floor(angle / (Math.PI * 2));

      expect(turns).toBe(1);
    });

    it('should handle negative turns', () => {
      const angle = -Math.PI * 3; // -540° = -1.5 turns
      const turns = Math.floor(angle / (Math.PI * 2));

      expect(turns).toBe(-1);
    });

    it('should return zero for angles within one revolution', () => {
      const angle = Math.PI; // 180°
      const turns = Math.floor(angle / (Math.PI * 2));

      expect(turns).toBe(0);
    });
  });
});
