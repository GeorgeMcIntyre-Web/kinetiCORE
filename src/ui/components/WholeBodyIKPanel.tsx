/**
 * Whole-Body IK Control Panel
 * Owner: George (Agent 1)
 * UI for multi-target IK and constraint configuration
 */

import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { WholeBodyIKSolver } from '../../kinematics/WholeBodyIKSolver';
import type { WholeBodyIKConfig } from '../../kinematics/WholeBodyIKSolver';
import type { IKTarget } from '../../kinematics/InverseKinematicsSolver';
import { BalanceConstraint, CollisionAvoidanceConstraint } from '../../kinematics/constraints/IKConstraint';

interface TargetConfig {
  chainName: string;
  position: { x: number; y: number; z: number };
  priority: number;
  enabled: boolean;
}

export const WholeBodyIKPanel: React.FC = () => {
  const [targets, setTargets] = useState<TargetConfig[]>([]);
  const [enableBalance, setEnableBalance] = useState(false);
  const [enableCollisionAvoidance, setEnableCollisionAvoidance] = useState(true);
  const [maxIterations, setMaxIterations] = useState(100);
  const [tolerance, setTolerance] = useState(0.001);

  const wholeBodySolver = WholeBodyIKSolver.getInstance();

  const addTarget = () => {
    setTargets([
      ...targets,
      {
        chainName: '',
        position: { x: 0, y: 0, z: 0 },
        priority: 1.0,
        enabled: true,
      },
    ]);
  };

  const updateTarget = (index: number, field: keyof TargetConfig, value: any) => {
    const newTargets = [...targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setTargets(newTargets);
  };

  const removeTarget = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index));
  };

  const solveWholeBodyIK = () => {
    // Build targets map
    const targetsMap = new Map<string, IKTarget>();
    const prioritiesMap = new Map<string, number>();

    targets.forEach((target) => {
      if (!target.enabled || !target.chainName) return;

      targetsMap.set(target.chainName, {
        position: new BABYLON.Vector3(target.position.x, target.position.y, target.position.z),
      });
      prioritiesMap.set(target.chainName, target.priority);
    });

    if (targetsMap.size === 0) {
      console.warn('No valid targets configured');
      return;
    }

    // Build constraints
    const constraints = [];

    if (enableCollisionAvoidance) {
      constraints.push(new CollisionAvoidanceConstraint(0.01, true, false));
    }

    if (enableBalance) {
      // Would need actual support polygon data
      // For now, create empty balance constraint
      const balanceConstraint = new BalanceConstraint(
        BABYLON.Vector3.Zero(),
        [],
        0.05
      );
      constraints.push(balanceConstraint);
    }

    // Solve
    const config: WholeBodyIKConfig = {
      targets: targetsMap,
      priorities: prioritiesMap,
      constraints,
      maxIterations,
      tolerance,
    };

    console.log('[Whole-Body IK] Solving with config:', config);
    const solution = wholeBodySolver.solve(config);

    if (solution.success) {
      console.log(`✅ Whole-Body IK solved in ${solution.iterations} iterations`);
      console.log(`Total error: ${solution.totalError.toFixed(4)}`);
      solution.errors.forEach((error, chainName) => {
        console.log(`  ${chainName}: ${error.toFixed(4)}m`);
      });
    } else {
      console.warn(`❌ Whole-Body IK failed to converge`);
      console.warn(`Final error: ${solution.totalError.toFixed(4)}`);
    }
  };

  const solveHumanoidWalking = () => {
    console.log('[Whole-Body IK] Solving humanoid walking pose');

    const solution = wholeBodySolver.solveHumanoidWalking({
      leftFootTarget: new BABYLON.Vector3(0.1, 0, 0),
      rightFootTarget: new BABYLON.Vector3(-0.1, 0, 0.3),
      pelvisTarget: new BABYLON.Vector3(0, 0.8, 0.15),
      supportPolygon: [
        new BABYLON.Vector3(0.15, 0, -0.05),
        new BABYLON.Vector3(-0.05, 0, -0.05),
        new BABYLON.Vector3(-0.05, 0, 0.35),
        new BABYLON.Vector3(0.15, 0, 0.35),
      ],
    });

    if (solution.success) {
      console.log(`✅ Humanoid walking solved in ${solution.iterations} iterations`);
    } else {
      console.warn(`❌ Humanoid walking failed to converge`);
    }
  };

  const solveQuadrupedStance = () => {
    console.log('[Whole-Body IK] Solving quadruped stance');

    const solution = wholeBodySolver.solveQuadrupedGait({
      frontLeftTarget: new BABYLON.Vector3(0.3, 0, 0.3),
      frontRightTarget: new BABYLON.Vector3(-0.3, 0, 0.3),
      rearLeftTarget: new BABYLON.Vector3(0.3, 0, -0.3),
      rearRightTarget: new BABYLON.Vector3(-0.3, 0, -0.3),
      bodyTarget: new BABYLON.Vector3(0, 0.4, 0),
      supportPhase: 'all',
    });

    if (solution.success) {
      console.log(`✅ Quadruped stance solved in ${solution.iterations} iterations`);
    } else {
      console.warn(`❌ Quadruped stance failed to converge`);
    }
  };

  const solveDualArm = () => {
    console.log('[Whole-Body IK] Solving dual-arm manipulation');

    const solution = wholeBodySolver.solveDualArmManipulation({
      leftHandTarget: new BABYLON.Vector3(0.3, 0.5, 0.3),
      rightHandTarget: new BABYLON.Vector3(-0.3, 0.5, 0.3),
      avoidSelfCollision: true,
    });

    if (solution.success) {
      console.log(`✅ Dual-arm manipulation solved in ${solution.iterations} iterations`);
    } else {
      console.warn(`❌ Dual-arm manipulation failed to converge`);
    }
  };

  return (
    <div style={{ padding: '10px', maxHeight: '600px', overflowY: 'auto' }}>
      <h3 style={{ marginTop: 0 }}>Whole-Body IK Control</h3>

      {/* Quick Actions */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Quick Actions</h4>
        <button onClick={solveHumanoidWalking} style={{ marginRight: '5px', marginBottom: '5px' }}>
          Humanoid Walk Pose
        </button>
        <button onClick={solveQuadrupedStance} style={{ marginRight: '5px', marginBottom: '5px' }}>
          Quadruped Stance
        </button>
        <button onClick={solveDualArm} style={{ marginBottom: '5px' }}>
          Dual-Arm Grasp
        </button>
      </div>

      {/* Custom Targets */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Custom Targets</h4>
        <button onClick={addTarget} style={{ marginBottom: '10px' }}>
          + Add Target
        </button>

        {targets.map((target, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #ccc',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '4px',
            }}
          >
            <div style={{ marginBottom: '5px' }}>
              <label>
                Chain Name:{' '}
                <input
                  type="text"
                  value={target.chainName}
                  onChange={(e) => updateTarget(index, 'chainName', e.target.value)}
                  placeholder="e.g., left_arm"
                  style={{ width: '150px' }}
                />
              </label>
              <label style={{ marginLeft: '10px' }}>
                <input
                  type="checkbox"
                  checked={target.enabled}
                  onChange={(e) => updateTarget(index, 'enabled', e.target.checked)}
                />
                Enabled
              </label>
            </div>

            <div style={{ marginBottom: '5px' }}>
              <label>
                X:{' '}
                <input
                  type="number"
                  step="0.1"
                  value={target.position.x}
                  onChange={(e) =>
                    updateTarget(index, 'position', {
                      ...target.position,
                      x: parseFloat(e.target.value),
                    })
                  }
                  style={{ width: '60px' }}
                />
              </label>
              <label style={{ marginLeft: '10px' }}>
                Y:{' '}
                <input
                  type="number"
                  step="0.1"
                  value={target.position.y}
                  onChange={(e) =>
                    updateTarget(index, 'position', {
                      ...target.position,
                      y: parseFloat(e.target.value),
                    })
                  }
                  style={{ width: '60px' }}
                />
              </label>
              <label style={{ marginLeft: '10px' }}>
                Z:{' '}
                <input
                  type="number"
                  step="0.1"
                  value={target.position.z}
                  onChange={(e) =>
                    updateTarget(index, 'position', {
                      ...target.position,
                      z: parseFloat(e.target.value),
                    })
                  }
                  style={{ width: '60px' }}
                />
              </label>
            </div>

            <div>
              <label>
                Priority:{' '}
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={target.priority}
                  onChange={(e) => updateTarget(index, 'priority', parseFloat(e.target.value))}
                  style={{ width: '60px' }}
                />
              </label>
              <button onClick={() => removeTarget(index)} style={{ marginLeft: '10px' }}>
                Remove
              </button>
            </div>
          </div>
        ))}

        {targets.length > 0 && (
          <button onClick={solveWholeBodyIK} style={{ marginTop: '10px', fontWeight: 'bold' }}>
            Solve Whole-Body IK
          </button>
        )}
      </div>

      {/* Constraints */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Constraints</h4>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={enableCollisionAvoidance}
            onChange={(e) => setEnableCollisionAvoidance(e.target.checked)}
          />
          Collision Avoidance
        </label>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={enableBalance}
            onChange={(e) => setEnableBalance(e.target.checked)}
          />
          Balance Constraint
        </label>
      </div>

      {/* Solver Settings */}
      <div>
        <h4>Solver Settings</h4>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Max Iterations:{' '}
          <input
            type="number"
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value))}
            style={{ width: '80px' }}
          />
        </label>
        <label style={{ display: 'block' }}>
          Tolerance (m):{' '}
          <input
            type="number"
            step="0.0001"
            value={tolerance}
            onChange={(e) => setTolerance(parseFloat(e.target.value))}
            style={{ width: '80px' }}
          />
        </label>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p>
          <strong>Note:</strong> Whole-body IK solves multiple kinematic chains simultaneously with
          priority weighting and constraint satisfaction.
        </p>
        <p>Chain names must match existing kinematic chains in the scene.</p>
      </div>
    </div>
  );
};
