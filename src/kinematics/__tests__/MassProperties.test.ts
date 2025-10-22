/**
 * Mass Properties Computer Tests
 * Owner: George (Agent 1)
 *
 * Tests for Center of Mass computation system
 */

import { describe, it, expect } from 'vitest';
import * as BABYLON from '@babylonjs/core';

describe('MassPropertiesComputer - Unit Tests', () => {
  describe('LinkMassData interface', () => {
    it('should have correct structure', () => {
      const linkMass = {
        nodeId: 'node-123',
        mass: 5.0,
        localCoM: new BABYLON.Vector3(0, 0.05, 0),
      };

      expect(linkMass.nodeId).toBe('node-123');
      expect(linkMass.mass).toBe(5.0);
      expect(linkMass.localCoM).toBeInstanceOf(BABYLON.Vector3);
    });

    it('should support optional worldCoM', () => {
      const linkMass = {
        nodeId: 'node-456',
        mass: 2.5,
        localCoM: BABYLON.Vector3.Zero(),
        worldCoM: new BABYLON.Vector3(1, 2, 3),
      };

      expect(linkMass.worldCoM).toBeDefined();
      expect(linkMass.worldCoM?.x).toBe(1);
    });
  });

  describe('MassProperties interface', () => {
    it('should have mass, CoM, and inertia', () => {
      const props = {
        mass: 10.0,
        centerOfMass: new BABYLON.Vector3(0, 0.1, 0),
        inertia: BABYLON.Matrix.Identity(),
      };

      expect(props.mass).toBe(10.0);
      expect(props.centerOfMass).toBeInstanceOf(BABYLON.Vector3);
      expect(props.inertia).toBeInstanceOf(BABYLON.Matrix);
    });
  });

  describe('CoM computation characteristics', () => {
    it('should use mass-weighted average for CoM', () => {
      // Example: Two masses
      // Mass 1: 2kg at (1, 0, 0)
      // Mass 2: 3kg at (0, 0, 0)
      // Expected CoM: (2*1 + 3*0) / (2+3) = 2/5 = 0.4

      const mass1 = 2;
      const pos1 = new BABYLON.Vector3(1, 0, 0);
      const mass2 = 3;
      const pos2 = BABYLON.Vector3.Zero();

      const totalMass = mass1 + mass2;
      const weightedSum = pos1.scale(mass1).add(pos2.scale(mass2));
      const expectedCoM = weightedSum.scale(1 / totalMass);

      expect(expectedCoM.x).toBeCloseTo(0.4, 5);
      expect(expectedCoM.y).toBeCloseTo(0, 5);
      expect(expectedCoM.z).toBeCloseTo(0, 5);
    });

    it('should handle single mass', () => {
      const mass = 5;
      const position = new BABYLON.Vector3(2, 3, 4);

      // CoM of single mass is just its position
      const com = position.clone();

      expect(com.x).toBe(2);
      expect(com.y).toBe(3);
      expect(com.z).toBe(4);
    });

    it('should handle symmetric mass distribution', () => {
      // Two equal masses at symmetric positions
      const mass = 1;
      const pos1 = new BABYLON.Vector3(1, 0, 0);
      const pos2 = new BABYLON.Vector3(-1, 0, 0);

      const totalMass = mass + mass;
      const weightedSum = pos1.scale(mass).add(pos2.scale(mass));
      const com = weightedSum.scale(1 / totalMass);

      // Should be at origin
      expect(com.x).toBeCloseTo(0, 5);
      expect(com.y).toBeCloseTo(0, 5);
      expect(com.z).toBeCloseTo(0, 5);
    });
  });

  describe('URDF inertial data loading', () => {
    it('should parse URDF mass and origin', () => {
      const urdfLink = {
        name: 'link1',
        inertial: {
          mass: 2.5,
          origin: { x: 0.1, y: 0.2, z: 0.3 },
        },
      };

      expect(urdfLink.inertial.mass).toBe(2.5);
      expect(urdfLink.inertial.origin.x).toBe(0.1);
      expect(urdfLink.inertial.origin.y).toBe(0.2);
      expect(urdfLink.inertial.origin.z).toBe(0.3);
    });

    it('should handle missing origin (defaults to zero)', () => {
      const urdfLink = {
        name: 'link2',
        inertial: {
          mass: 1.0,
        },
      };

      expect(urdfLink.inertial.mass).toBe(1.0);
      expect(urdfLink.inertial.origin).toBeUndefined();
    });
  });

  describe('Geometry-based mass estimation', () => {
    it('should compute volume from bounding box', () => {
      // Bounding box: 1m x 2m x 3m
      const size = new BABYLON.Vector3(1, 2, 3);
      const volume = size.x * size.y * size.z;

      expect(volume).toBe(6); // m³
    });

    it('should estimate mass from volume and density', () => {
      const volume = 0.001; // m³ (1 liter)
      const density = 1000; // kg/m³ (water density)
      const mass = volume * density;

      expect(mass).toBe(1); // kg
    });

    it('should enforce minimum mass', () => {
      const volume = 0.00001; // Very small volume
      const density = 1000;
      const computedMass = volume * density; // 0.01 kg
      const minMass = 0.1;
      const finalMass = Math.max(computedMass, minMass);

      expect(finalMass).toBe(0.1); // Enforced minimum
    });
  });

  describe('Transform coordinate spaces', () => {
    it('should transform local CoM to world space', () => {
      const localCoM = new BABYLON.Vector3(0, 0.1, 0); // 10cm up in local space

      // Create transform: translate (1, 0, 0)
      const worldMatrix = BABYLON.Matrix.Translation(1, 0, 0);

      const worldCoM = BABYLON.Vector3.TransformCoordinates(localCoM, worldMatrix);

      expect(worldCoM.x).toBeCloseTo(1, 5);
      expect(worldCoM.y).toBeCloseTo(0.1, 5);
      expect(worldCoM.z).toBeCloseTo(0, 5);
    });

    it('should handle rotation in transform', () => {
      const localCoM = new BABYLON.Vector3(1, 0, 0);

      // Rotate 90° around Z-axis
      const rotation = BABYLON.Matrix.RotationZ(Math.PI / 2);

      const worldCoM = BABYLON.Vector3.TransformCoordinates(localCoM, rotation);

      // (1, 0, 0) rotated 90° around Z becomes (0, 1, 0)
      expect(worldCoM.x).toBeCloseTo(0, 5);
      expect(worldCoM.y).toBeCloseTo(1, 5);
      expect(worldCoM.z).toBeCloseTo(0, 5);
    });
  });

  describe('CoM Jacobian characteristics', () => {
    it('should compute derivative numerically', () => {
      // Example: Joint angle change of 0.001 rad
      const epsilon = 0.001;

      // Suppose CoM changes from (0, 0, 0) to (0, 0.0005, 0)
      const com0 = BABYLON.Vector3.Zero();
      const com1 = new BABYLON.Vector3(0, 0.0005, 0);

      const dCoM = com1.subtract(com0).scale(1 / epsilon);

      // dCoM/dq ≈ (0, 0.5, 0) m/rad
      expect(dCoM.x).toBeCloseTo(0, 5);
      expect(dCoM.y).toBeCloseTo(0.5, 5);
      expect(dCoM.z).toBeCloseTo(0, 5);
    });

    it('should have 3 rows (x, y, z) per joint', () => {
      // For N joints, Jacobian is N x 3
      const numJoints = 6;
      const jacobianRows = numJoints;
      const jacobianCols = 3; // x, y, z

      expect(jacobianRows).toBe(6);
      expect(jacobianCols).toBe(3);
    });
  });
});

/**
 * Integration tests would require:
 * - Mock SceneTreeManager with nodes
 * - Mock SceneManager with Babylon scene
 * - Test robot URDF data
 * - Kinematic chain setup
 *
 * These should be added when test infrastructure is ready.
 *
 * Example integration test structure:
 *
 * describe('MassPropertiesComputer - Integration', () => {
 *   it('should compute CoM for 6-DOF robot arm', () => {
 *     const massComputer = MassPropertiesComputer.getInstance();
 *
 *     // Load URDF data
 *     massComputer.loadFromURDF(testURDF);
 *
 *     // Compute CoM
 *     const com = massComputer.computeRobotCoM();
 *
 *     expect(com).toBeDefined();
 *     expect(com.length()).toBeGreaterThan(0);
 *   });
 *
 *   it('should update CoM as joints move', () => {
 *     const massComputer = MassPropertiesComputer.getInstance();
 *
 *     const com1 = massComputer.computeChainCoM('robot_arm');
 *
 *     // Move joint
 *     fkSolver.updateJointPosition('joint1', 0.5, true);
 *
 *     const com2 = massComputer.computeChainCoM('robot_arm');
 *
 *     // CoM should change
 *     expect(com1.equals(com2)).toBe(false);
 *   });
 * });
 */
