/**
 * ARCHIVED – behaviour now covered by Playwright E2E tests.
 * See: tests/e2e/auto-kinematics/u112/*.spec.ts
 *
 * This suite is excluded in vitest.config.ts because it depends on WebGL/Babylon.js.
 * The KinematicsManager tooling chain functionality is now validated in a real browser
 * environment with full WebGL support via Playwright tests.
 *
 * Original purpose: Tests for tooling chain registration, discovery, and isolation from robot chains.
 * Part of U112 MOTION PANEL GOLD standard validation.
 *
 * See: docs/auto-kinematics/U112_MOTION_PANEL_GOLD.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KinematicsManager, type KinematicChain, type JointConfig } from '../../src/kinematics/KinematicsManager';

describe('KinematicsManager - Tooling Chains', () => {
  let kinematicsManager: KinematicsManager;

  beforeEach(() => {
    kinematicsManager = KinematicsManager.getInstance();
    // Reset the manager before each test
    kinematicsManager.reset();
  });

  describe('Tooling Chain Registration', () => {
    it('should register a tooling chain successfully', () => {
      // Arrange
      const toolingChain: KinematicChain = {
        id: 'tooling_chain_test_001',
        name: 'Test Tooling Chain',
        type: 'serial',
        rootNodeId: 'node_root',
        joints: [
          {
            id: 'joint_test_001',
            name: 'UNIT_112_hinge',
            type: 'revolute',
            parentNodeId: 'node_parent',
            childNodeId: 'node_child',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 2, velocity: 1.0, effort: 10.0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(toolingChain);

      // Assert
      const toolingChains = kinematicsManager.getToolingChains();
      expect(toolingChains).toHaveLength(1);
      expect(toolingChains[0].id).toBe('tooling_chain_test_001');
      expect(toolingChains[0].name).toBe('Test Tooling Chain');
      expect(toolingChains[0].joints).toHaveLength(1);
    });

    it('should handle duplicate chain IDs by overwriting', () => {
      // Arrange
      const chain1: KinematicChain = {
        id: 'tooling_chain_duplicate',
        name: 'First Chain',
        type: 'serial',
        rootNodeId: 'node_root',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      const chain2: KinematicChain = {
        id: 'tooling_chain_duplicate',
        name: 'Second Chain (Overwrite)',
        type: 'serial',
        rootNodeId: 'node_root',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(chain1);
      kinematicsManager.registerToolingChain(chain2);

      // Assert
      const toolingChains = kinematicsManager.getToolingChains();
      expect(toolingChains).toHaveLength(1);
      expect(toolingChains[0].name).toBe('Second Chain (Overwrite)');
    });

    it('should register multiple distinct tooling chains', () => {
      // Arrange
      const chain1: KinematicChain = {
        id: 'tooling_chain_001',
        name: 'Chain 1',
        type: 'serial',
        rootNodeId: 'node_root_1',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      const chain2: KinematicChain = {
        id: 'tooling_chain_002',
        name: 'Chain 2',
        type: 'serial',
        rootNodeId: 'node_root_2',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(chain1);
      kinematicsManager.registerToolingChain(chain2);

      // Assert
      const toolingChains = kinematicsManager.getToolingChains();
      expect(toolingChains).toHaveLength(2);
      expect(toolingChains.map(c => c.id)).toEqual(['tooling_chain_001', 'tooling_chain_002']);
    });
  });

  describe('Tooling Chain Discovery', () => {
    it('should find tooling joints via getJoint()', () => {
      // Arrange
      const toolingChain: KinematicChain = {
        id: 'tooling_chain_discovery',
        name: 'Discovery Test Chain',
        type: 'serial',
        rootNodeId: 'node_root',
        joints: [
          {
            id: 'joint_tooling_001',
            name: 'UNIT_112_hinge',
            type: 'revolute',
            parentNodeId: 'node_parent',
            childNodeId: 'node_child',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 2, velocity: 1.0, effort: 10.0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(toolingChain);
      const joint = kinematicsManager.getJoint('joint_tooling_001');

      // Assert
      expect(joint).toBeDefined();
      expect(joint?.id).toBe('joint_tooling_001');
      expect(joint?.name).toBe('UNIT_112_hinge');
      expect(joint?.type).toBe('revolute');
    });

    it('should find tooling chains via getAllChains()', () => {
      // Arrange
      const toolingChain: KinematicChain = {
        id: 'tooling_chain_getall',
        name: 'GetAll Test Chain',
        type: 'serial',
        rootNodeId: 'node_root',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(toolingChain);
      const allChains = kinematicsManager.getAllChains();

      // Assert
      expect(allChains).toHaveLength(1);
      expect(allChains[0].id).toBe('tooling_chain_getall');
    });

    it('should find tooling chains via getChainById()', () => {
      // Arrange
      const toolingChain: KinematicChain = {
        id: 'tooling_chain_byid',
        name: 'ById Test Chain',
        type: 'serial',
        rootNodeId: 'node_root',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(toolingChain);
      const chain = kinematicsManager.getChainById('tooling_chain_byid');

      // Assert
      expect(chain).toBeDefined();
      expect(chain?.id).toBe('tooling_chain_byid');
      expect(chain?.name).toBe('ById Test Chain');
    });

    it('should find tooling chain joints via getChainJoints()', () => {
      // Arrange
      const joint1: JointConfig = {
        id: 'joint_1',
        name: 'Joint 1',
        type: 'revolute',
        parentNodeId: 'node_parent',
        childNodeId: 'node_child',
        axis: { x: 0, y: 1, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
        limits: { lower: 0, upper: Math.PI, velocity: 1.0, effort: 10.0 },
        position: 0,
        velocity: 0,
        effort: 0,
        showAxis: true,
        showLimits: true,
      };

      const joint2: JointConfig = {
        id: 'joint_2',
        name: 'Joint 2',
        type: 'prismatic',
        parentNodeId: 'node_child',
        childNodeId: 'node_child2',
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        limits: { lower: 0, upper: 0.1, velocity: 0.5, effort: 5.0 },
        position: 0,
        velocity: 0,
        effort: 0,
        showAxis: true,
        showLimits: true,
      };

      const toolingChain: KinematicChain = {
        id: 'tooling_chain_joints',
        name: 'Joints Test Chain',
        type: 'serial',
        rootNodeId: 'node_root',
        joints: [joint1, joint2],
        dof: 2,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(toolingChain);
      const joints = kinematicsManager.getChainJoints('tooling_chain_joints');

      // Assert
      expect(joints).toHaveLength(2);
      expect(joints[0].id).toBe('joint_1');
      expect(joints[1].id).toBe('joint_2');
    });

    it('should return undefined for non-existent joint ID', () => {
      // Act
      const joint = kinematicsManager.getJoint('non_existent_joint');

      // Assert
      expect(joint).toBeUndefined();
    });

    it('should return undefined for non-existent chain ID', () => {
      // Act
      const chain = kinematicsManager.getChainById('non_existent_chain');

      // Assert
      expect(chain).toBeUndefined();
    });

    it('should return empty array for non-existent chain joints', () => {
      // Act
      const joints = kinematicsManager.getChainJoints('non_existent_chain');

      // Assert
      expect(joints).toEqual([]);
    });
  });

  describe('Isolation from Robot Chains', () => {
    it('should not mix tooling chains with robot chains in getAllChains()', () => {
      // Arrange
      const robotChain = kinematicsManager.createChain('Robot Chain', 'robot_root', 'serial');

      const toolingChain: KinematicChain = {
        id: 'tooling_chain_isolation',
        name: 'Tooling Chain',
        type: 'serial',
        rootNodeId: 'tooling_root',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(toolingChain);
      const allChains = kinematicsManager.getAllChains();

      // Assert
      expect(allChains).toHaveLength(2);

      const robotChains = allChains.filter(c => c.name === 'Robot Chain');
      const toolingChains = allChains.filter(c => c.name === 'Tooling Chain');

      expect(robotChains).toHaveLength(1);
      expect(toolingChains).toHaveLength(1);
    });

    it('should distinguish tooling joints from robot joints', () => {
      // Arrange
      // Create robot chain with joint
      const robotJoint = kinematicsManager.createJoint({
        name: 'Robot Joint 1',
        type: 'revolute',
        parentNodeId: 'robot_parent',
        childNodeId: 'robot_child',
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        limits: { lower: -Math.PI, upper: Math.PI, velocity: 1.0, effort: 10.0 },
      });

      // Create tooling chain with joint
      const toolingChain: KinematicChain = {
        id: 'tooling_chain_distinction',
        name: 'Tooling Chain',
        type: 'serial',
        rootNodeId: 'tooling_root',
        joints: [
          {
            id: 'tooling_joint_001',
            name: 'Tooling Joint 1',
            type: 'revolute',
            parentNodeId: 'tooling_parent',
            childNodeId: 'tooling_child',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 2, velocity: 1.0, effort: 10.0 },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(toolingChain);

      const robotJointLookup = kinematicsManager.getJoint(robotJoint!.id);
      const toolingJointLookup = kinematicsManager.getJoint('tooling_joint_001');

      // Assert
      expect(robotJointLookup).toBeDefined();
      expect(toolingJointLookup).toBeDefined();
      expect(robotJointLookup?.parentNodeId).toBe('robot_parent');
      expect(toolingJointLookup?.parentNodeId).toBe('tooling_parent');
    });

    it('should not return tooling chains from getToolingChainById when querying robot chains', () => {
      // Arrange
      const robotChain = kinematicsManager.createChain('Robot Chain', 'robot_root', 'serial');

      const toolingChain: KinematicChain = {
        id: 'tooling_chain_separation',
        name: 'Tooling Chain',
        type: 'serial',
        rootNodeId: 'tooling_root',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(toolingChain);

      // Query using specific tooling method
      const toolingChainLookup = kinematicsManager.getToolingChainById('tooling_chain_separation');
      const robotChainAsTooling = kinematicsManager.getToolingChainById(robotChain.id);

      // Assert
      expect(toolingChainLookup).toBeDefined();
      expect(toolingChainLookup?.name).toBe('Tooling Chain');
      expect(robotChainAsTooling).toBeUndefined(); // Robot chain should not be found in tooling chains
    });
  });

  describe('Error Handling with Guard Clauses', () => {
    it('should handle empty tooling chains gracefully', () => {
      // Act
      const toolingChains = kinematicsManager.getToolingChains();

      // Assert
      expect(toolingChains).toEqual([]);
    });

    it('should handle invalid joint lookup without throwing', () => {
      // Act & Assert - should not throw
      expect(() => {
        const joint = kinematicsManager.getJoint('invalid_joint_id');
        expect(joint).toBeUndefined();
      }).not.toThrow();
    });

    it('should handle invalid chain lookup without throwing', () => {
      // Act & Assert - should not throw
      expect(() => {
        const chain = kinematicsManager.getChainById('invalid_chain_id');
        expect(chain).toBeUndefined();
      }).not.toThrow();
    });

    it('should handle getChainJoints with empty chain gracefully', () => {
      // Arrange
      const emptyChain: KinematicChain = {
        id: 'empty_chain',
        name: 'Empty Chain',
        type: 'serial',
        rootNodeId: 'node_root',
        joints: [],
        dof: 0,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(emptyChain);
      const joints = kinematicsManager.getChainJoints('empty_chain');

      // Assert
      expect(joints).toEqual([]);
    });
  });

  describe('U112 GOLD Scenario', () => {
    it('should match U112 Gold Standard invariants', () => {
      // Arrange - Simulate U112 fixture with 1 hinge joint
      const u112Chain: KinematicChain = {
        id: 'tooling_animator_chain_u112',
        name: 'Tooling Animator Chain',
        type: 'serial',
        rootNodeId: 'UNIT_101', // Fixed base
        joints: [
          {
            id: 'joint_u112_hinge',
            name: 'UNIT_112',
            type: 'revolute',
            parentNodeId: 'UNIT_101',
            childNodeId: 'UNIT_112',
            axis: { x: 0, y: 1, z: 0 },
            origin: { x: 0, y: 0, z: 0 },
            limits: { lower: 0, upper: Math.PI / 2, velocity: 1.0, effort: 10.0 }, // 0° to 90°
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: true,
          },
        ],
        dof: 1,
        tcpFrames: [],
      };

      // Act
      kinematicsManager.registerToolingChain(u112Chain);

      // Assert Invariant 1: Joint Registration
      const allChains = kinematicsManager.getAllChains();
      expect(allChains).toHaveLength(1);

      const toolingChain = allChains[0];
      expect(toolingChain.joints).toHaveLength(1);
      expect(toolingChain.joints[0].type).toBe('revolute');
      expect(toolingChain.joints[0].parentNodeId).toBe('UNIT_101');
      expect(toolingChain.joints[0].childNodeId).toBe('UNIT_112');

      // Assert: Joint is discoverable
      const joint = kinematicsManager.getJoint('joint_u112_hinge');
      expect(joint).toBeDefined();
      expect(joint?.name).toBe('UNIT_112');
      expect(joint?.limits.lower).toBe(0);
      expect(joint?.limits.upper).toBeCloseTo(Math.PI / 2, 5);
    });
  });
});
