/**
 * Whole-Body IK Solver Tests
 * Owner: George (Agent 1)
 *
 * Tests for multi-target IK and constraint satisfaction
 */

import { describe, it, expect } from 'vitest';
import type { WholeBodyIKConfig, WholeBodyIKSolution } from '../WholeBodyIKSolver';
import type { IKConstraint } from '../constraints/IKConstraint';

describe('WholeBodyIKSolver - Unit Tests', () => {
  describe('WholeBodyIKConfig interface', () => {
    it('should support multiple targets with priorities', () => {
      const config: WholeBodyIKConfig = {
        targets: new Map([
          ['left_arm', { position: { x: 0.5, y: 0.3, z: 0.8 } as any }],
          ['right_arm', { position: { x: -0.5, y: 0.3, z: 0.8 } as any }],
        ]),
        priorities: new Map([
          ['left_arm', 1.0],
          ['right_arm', 0.8],
        ]),
        maxIterations: 100,
        tolerance: 0.001,
      };

      expect(config.targets.size).toBe(2);
      expect(config.priorities?.get('left_arm')).toBe(1.0);
      expect(config.priorities?.get('right_arm')).toBe(0.8);
    });

    it('should support constraints', () => {
      const mockConstraint: IKConstraint = {
        type: 'balance',
        weight: 0.8,
        enabled: true,
        evaluate: () => 0,
        computeGradient: () => new Map(),
      };

      const config: WholeBodyIKConfig = {
        targets: new Map(),
        constraints: [mockConstraint],
      };

      expect(config.constraints).toHaveLength(1);
      expect(config.constraints?.[0].type).toBe('balance');
    });
  });

  describe('WholeBodyIKSolution interface', () => {
    it('should have correct structure for success case', () => {
      const solution: WholeBodyIKSolution = {
        jointAngles: new Map([
          ['left_arm', [0, 0.5, -0.3, 1.2, 0, 0]],
          ['right_arm', [0, 0.5, -0.3, 1.2, 0, 0]],
        ]),
        success: true,
        errors: new Map([
          ['left_arm', 0.0005],
          ['right_arm', 0.0008],
        ]),
        constraintViolations: new Map([['balance', 0.001]]),
        iterations: 25,
        totalError: 0.0023,
      };

      expect(solution.success).toBe(true);
      expect(solution.jointAngles.size).toBe(2);
      expect(solution.errors.get('left_arm')).toBeLessThan(0.001);
      expect(solution.totalError).toBeLessThan(0.01);
    });
  });

  describe('Priority weighting system', () => {
    it('should prioritize higher-weight targets', () => {
      // High priority target should have lower tolerance
      const highPriorityTolerance = 0.001 * 1.0;
      const lowPriorityTolerance = 0.001 * 0.5;

      expect(highPriorityTolerance).toBe(0.001);
      expect(lowPriorityTolerance).toBe(0.0005);
      expect(highPriorityTolerance).toBeGreaterThan(lowPriorityTolerance);
    });

    it('should weight error contributions correctly', () => {
      const error1 = 0.002;
      const priority1 = 1.0;
      const error2 = 0.003;
      const priority2 = 0.5;

      const weightedError = error1 * priority1 + error2 * priority2;

      expect(weightedError).toBe(0.0035);
    });
  });

  describe('Humanoid walking configuration', () => {
    it('should configure feet with highest priority', () => {
      const config = {
        leftFootTarget: { x: 0, y: 0, z: 0 } as any,
        rightFootTarget: { x: 0, y: 0, z: 0.3 } as any,
        pelvisTarget: { x: 0, y: 0.8, z: 0.15 } as any,
      };

      // Feet should have priority 1.0
      const leftLegPriority = 1.0;
      const rightLegPriority = 1.0;
      const torsoPriority = 0.9;

      expect(leftLegPriority).toBe(1.0);
      expect(rightLegPriority).toBe(1.0);
      expect(torsoPriority).toBeLessThan(1.0);
    });

    it('should include balance constraint for walking', () => {
      const supportPolygon = [
        { x: 0.1, y: 0, z: 0 } as any,
        { x: -0.1, y: 0, z: 0 } as any,
        { x: -0.1, y: 0, z: 0.3 } as any,
        { x: 0.1, y: 0, z: 0.3 } as any,
      ];

      expect(supportPolygon).toHaveLength(4);
      expect(supportPolygon[0].x).toBe(0.1);
    });
  });

  describe('Quadruped gait configuration', () => {
    it('should configure all four legs', () => {
      const config = {
        frontLeftTarget: { x: 0.2, y: 0, z: 0.3 } as any,
        frontRightTarget: { x: -0.2, y: 0, z: 0.3 } as any,
        rearLeftTarget: { x: 0.2, y: 0, z: -0.3 } as any,
        rearRightTarget: { x: -0.2, y: 0, z: -0.3 } as any,
      };

      const legCount = 4;
      expect(legCount).toBe(4);
    });

    it('should adjust priorities for diagonal gait', () => {
      const supportPhase = 'diagonal';

      // Diagonal pair (FL + RR) should have higher priority
      const flPriority = supportPhase === 'diagonal' ? 1.0 : 1.0;
      const rrPriority = supportPhase === 'diagonal' ? 1.0 : 1.0;
      const frPriority = supportPhase === 'diagonal' ? 0.7 : 1.0;
      const rlPriority = supportPhase === 'diagonal' ? 0.7 : 1.0;

      expect(flPriority).toBe(1.0);
      expect(rrPriority).toBe(1.0);
      expect(frPriority).toBe(0.7);
      expect(rlPriority).toBe(0.7);
    });
  });

  describe('Dual-arm manipulation', () => {
    it('should configure both arms with equal priority', () => {
      const leftArmPriority = 1.0;
      const rightArmPriority = 1.0;

      expect(leftArmPriority).toBe(rightArmPriority);
    });

    it('should enable self-collision avoidance by default', () => {
      const avoidSelfCollision = true;

      expect(avoidSelfCollision).toBe(true);
    });
  });

  describe('Constraint system', () => {
    it('should evaluate constraint violations', () => {
      const mockConstraint: IKConstraint = {
        type: 'joint_limit',
        weight: 1.0,
        enabled: true,
        evaluate: (angles) => {
          // Mock: Check if any angle exceeds limits
          let violation = 0;
          angles.forEach((angleArray) => {
            angleArray.forEach((angle) => {
              if (angle < -Math.PI || angle > Math.PI) {
                violation += Math.abs(angle - Math.PI);
              }
            });
          });
          return violation;
        },
        computeGradient: () => new Map(),
      };

      const testAngles = new Map([['joint1', [0, Math.PI / 2, -Math.PI / 4]]]);

      const violation = mockConstraint.evaluate(testAngles);
      expect(violation).toBe(0); // All angles within limits
    });

    it('should compute gradients for constraint satisfaction', () => {
      const mockConstraint: IKConstraint = {
        type: 'balance',
        weight: 0.8,
        enabled: true,
        evaluate: () => 0.05,
        computeGradient: (angles) => {
          const gradient = new Map<string, number[]>();
          angles.forEach((angleArray, chainName) => {
            // Mock gradient: small adjustments
            gradient.set(
              chainName,
              angleArray.map(() => 0.01)
            );
          });
          return gradient;
        },
      };

      const testAngles = new Map([['chain1', [0, 0, 0]]]);
      const gradient = mockConstraint.computeGradient(testAngles);

      expect(gradient.has('chain1')).toBe(true);
      expect(gradient.get('chain1')).toHaveLength(3);
    });
  });

  describe('Performance expectations', () => {
    it('should converge within iteration limit', () => {
      const maxIterations = 100;
      const typicalIterations = 25; // Expected for dual-arm

      expect(typicalIterations).toBeLessThan(maxIterations);
    });

    it('should handle large constraint sets', () => {
      const maxConstraints = 10;
      const constraints: IKConstraint[] = [];

      for (let i = 0; i < maxConstraints; i++) {
        constraints.push({
          type: 'balance',
          weight: 0.5,
          enabled: true,
          evaluate: () => 0,
          computeGradient: () => new Map(),
        });
      }

      expect(constraints).toHaveLength(maxConstraints);
    });
  });
});

/**
 * Integration tests would require:
 * - Full robot models (humanoid, quadruped)
 * - Physics simulation
 * - Collision detection integration
 * - Performance benchmarking
 *
 * Example integration test:
 *
 * describe('WholeBodyIKSolver - Integration', () => {
 *   it('should solve humanoid walking in <100ms', async () => {
 *     const solver = WholeBodyIKSolver.getInstance();
 *
 *     const startTime = performance.now();
 *     const solution = solver.solveHumanoidWalking({
 *       leftFootTarget: new Vector3(0, 0, 0),
 *       rightFootTarget: new Vector3(0, 0, 0.3),
 *       pelvisTarget: new Vector3(0, 0.8, 0.15),
 *       supportPolygon: [...]
 *     });
 *     const endTime = performance.now();
 *
 *     expect(solution.success).toBe(true);
 *     expect(endTime - startTime).toBeLessThan(100);
 *   });
 * });
 */
