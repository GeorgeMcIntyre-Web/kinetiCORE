/**
 * FullBody IK Control Panel
 * Owner: George (Agent 1)
 * UI for multi-target IK and constraint configuration
 */

import React, { useState, useEffect } from 'react';
import { Move, RotateCw, Footprints, PawPrint, Grip, CheckCircle, XCircle, Loader, Plus, AlertCircle, Trash2, Play, RotateCcw } from 'lucide-react';
import * as BABYLON from '@babylonjs/core';
import { WholeBodyIKSolver, WholeBodyIKSolution } from '../../kinematics/WholeBodyIKSolver';
import type { WholeBodyIKConfig } from '../../kinematics/WholeBodyIKSolver';
import type { IKTarget } from '../../kinematics/InverseKinematicsSolver';
import { BalanceConstraint, CollisionAvoidanceConstraint, IKConstraint } from '../../kinematics/constraints/IKConstraint';
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { KinematicsManager } from '../../kinematics/KinematicsManager';
import type { KinematicChain } from '../../kinematics/KinematicsManager';

interface TargetConfig {
  chainName: string;
  position: { x: number; y: number; z: number };
  priority: number;
  enabled: boolean;
}

interface WholeBodyIKPanelProps {
  isVisible: boolean;
  onClose: () => void;
  zIndex?: number;
}

type SolverStatus = {
  type: 'idle' | 'solving' | 'success' | 'error';
  message: string;
  details?: string;
} | null;

export const WholeBodyIKPanel: React.FC<WholeBodyIKPanelProps> = ({ isVisible, onClose, zIndex = 1004 }) => {
  // Robot & Chain Management
  const [availableChains, setAvailableChains] = useState<KinematicChain[]>([]);

  // IK Configuration
  const [targets, setTargets] = useState<TargetConfig[]>([]);
  const [enableBalance, setEnableBalance] = useState(false);
  const [enableCollisionAvoidance, setEnableCollisionAvoidance] = useState(true);
  const [maxIterations, setMaxIterations] = useState(100);
  const [tolerance, setTolerance] = useState(0.001);

  // Solution State
  const [lastSolution, setLastSolution] = useState<WholeBodyIKSolution | null>(null);
  const [solverStatus, setSolverStatus] = useState<SolverStatus>(null);
  const [showGuidance, setShowGuidance] = useState(true);

  const wholeBodySolver = WholeBodyIKSolver.getInstance();
  const kinematicsManager = KinematicsManager.getInstance();

  // Discover available kinematic chains on mount
  useEffect(() => {
    if (isVisible) {
      const chains = kinematicsManager.getAllChains();
      setAvailableChains(chains);
      console.log(`[FullBody IK] Found ${chains.length} kinematic chains:`, chains.map(c => c.name));
    }
  }, [isVisible]);

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
      setSolverStatus({
        type: 'error',
        message: 'No targets to solve',
        details: 'Add at least one target and select a chain name'
      });
      return;
    }

    // Build constraints
    const constraints: IKConstraint[] = [];

    if (enableCollisionAvoidance) {
      constraints.push(new CollisionAvoidanceConstraint(0.01, true, false));
    }

    if (enableBalance) {
      const balanceConstraint = new BalanceConstraint(
        BABYLON.Vector3.Zero(),
        [],
        0.05
      );
      constraints.push(balanceConstraint);
    }

    // Set solving status
    setSolverStatus({
      type: 'solving',
      message: 'Calculating robot pose...',
      details: `Solving for ${targetsMap.size} target position${targetsMap.size > 1 ? 's' : ''}`
    });

    // Solve (using setTimeout to allow UI to update)
    setTimeout(() => {
      const config: WholeBodyIKConfig = {
        targets: targetsMap,
        priorities: prioritiesMap,
        constraints,
        maxIterations,
        tolerance,
      };

      const solution = wholeBodySolver.solve(config);
      setLastSolution(solution);

      if (solution.success) {
        setSolverStatus({
          type: 'success',
          message: 'Target positions reached successfully',
          details: `Solved in ${solution.iterations} iteration${solution.iterations > 1 ? 's' : ''} • Position error: ${(solution.totalError * 1000).toFixed(1)}mm • Click Apply to move robot`
        });
      } else {
        // Provide helpful feedback based on iterations
        const progressHint = solution.iterations >= maxIterations 
          ? 'Try increasing Max Iterations or adjusting target positions'
          : 'Target positions may be unreachable';
        
        setSolverStatus({
          type: 'error',
          message: 'Could not reach target positions',
          details: `Position error: ${(solution.totalError * 1000).toFixed(1)}mm (tolerance: ${(tolerance * 1000).toFixed(1)}mm) • ${progressHint}`
        });
      }
    }, 50);
  };

  const applySolution = () => {
    if (!lastSolution || !lastSolution.success) return;

    // Apply joint angles to robot
    lastSolution.jointAngles.forEach((angles, chainName) => {
      const chain = kinematicsManager.getChain(chainName);
      if (!chain) {
        console.warn(`[FullBody IK] Chain not found: ${chainName}`);
        return;
      }

      // Apply angles to each joint in the chain
      chain.joints.forEach((joint, i) => {
        if (angles[i] !== undefined) {
          // Update joint position (current angle/position)
          joint.position = angles[i];

          console.log(`✅ Updated ${joint.name}: ${angles[i].toFixed(3)} rad`);
        }
      });

      console.log(`✅ Applied solution to chain: ${chainName}`);
    });

    setSolverStatus({
      type: 'success',
      message: '✅ Solution applied to robot',
      details: `${lastSolution.jointAngles.size} chain(s) updated`
    });
  };

  const resetToCurrentPose = () => {
    setLastSolution(null);
    setSolverStatus(null);
  };

  const solveHumanoidWalking = () => {
    console.log('[FullBody IK] Solving humanoid walking pose');

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

    setLastSolution(solution);
    
    if (solution.success) {
      console.log(`✅ Humanoid walking solved in ${solution.iterations} iterations`);
      setSolverStatus({
        type: 'success',
        message: 'Walking pose reached successfully',
        details: `Solved in ${solution.iterations} iteration${solution.iterations > 1 ? 's' : ''} • Click Apply to move robot`
      });
    } else {
      console.warn(`❌ Humanoid walking failed to converge`);
      setSolverStatus({
        type: 'error',
        message: 'Walking pose not reachable',
        details: 'This preset may not work with the current robot configuration'
      });
    }
  };

  const solveQuadrupedStance = () => {
    console.log('[FullBody IK] Solving quadruped stance');

    const solution = wholeBodySolver.solveQuadrupedGait({
      frontLeftTarget: new BABYLON.Vector3(0.3, 0, 0.3),
      frontRightTarget: new BABYLON.Vector3(-0.3, 0, 0.3),
      rearLeftTarget: new BABYLON.Vector3(0.3, 0, -0.3),
      rearRightTarget: new BABYLON.Vector3(-0.3, 0, -0.3),
      bodyTarget: new BABYLON.Vector3(0, 0.4, 0),
      supportPhase: 'all',
    });

    setLastSolution(solution);
    
    if (solution.success) {
      console.log(`✅ Quadruped stance solved in ${solution.iterations} iterations`);
      setSolverStatus({
        type: 'success',
        message: 'Standing pose reached successfully',
        details: `Solved in ${solution.iterations} iteration${solution.iterations > 1 ? 's' : ''} • Click Apply to move robot`
      });
    } else {
      console.warn(`❌ Quadruped stance failed to converge`);
      setSolverStatus({
        type: 'error',
        message: 'Standing pose not reachable',
        details: 'This preset is designed for quadruped robots (4 legs)'
      });
    }
  };

  const solveDualArm = () => {
    console.log('[FullBody IK] Solving dual-arm manipulation');

    const solution = wholeBodySolver.solveDualArmManipulation({
      leftHandTarget: new BABYLON.Vector3(0.3, 0.5, 0.3),
      rightHandTarget: new BABYLON.Vector3(-0.3, 0.5, 0.3),
      avoidSelfCollision: true,
    });

    setLastSolution(solution);
    
    if (solution.success) {
      console.log(`✅ Dual-arm manipulation solved in ${solution.iterations} iterations`);
      setSolverStatus({
        type: 'success',
        message: 'Grasp pose reached successfully',
        details: `Solved in ${solution.iterations} iteration${solution.iterations > 1 ? 's' : ''} • Click Apply to move robot`
      });
    } else {
      console.warn(`❌ Dual-arm manipulation failed to converge`);
      setSolverStatus({
        type: 'error',
        message: 'Grasp pose not reachable',
        details: 'This preset requires a robot with two arms'
      });
    }
  };

  // Icon: 2x2 grid of Move + RotateCw icons representing multi-body control
  const icon = (
    <div style={{ position: 'relative', width: '24px', height: '24px' }}>
      <Move size={10} style={{ position: 'absolute', left: '0px', top: '0px' }} />
      <Move size={10} style={{ position: 'absolute', right: '0px', top: '0px' }} />
      <RotateCw size={10} style={{ position: 'absolute', left: '0px', bottom: '0px' }} />
      <RotateCw size={10} style={{ position: 'absolute', right: '0px', bottom: '0px' }} />
    </div>
  );

  return (
    <FloatingPanel
      title="FullBody IK"
      subtitle="Full-body pose control"
      icon={icon}
      isVisible={isVisible}
      onClose={onClose}
      zIndex={zIndex}
      defaultSize={{ width: 450, height: 700 }}
      defaultPosition={{
        x: (window.innerWidth - 450) / 2,
        y: (window.innerHeight - 700) / 2
      }}
      dockable={false}
      minimizable={false}
    >
      {/* Status Banner */}
      {solverStatus && (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          borderRadius: '4px',
          backgroundColor: solverStatus.type === 'success' ? '#1a4d2e' :
                           solverStatus.type === 'error' ? '#4d1a1a' :
                           solverStatus.type === 'solving' ? '#4d4d1a' : '#2a2a2a',
          borderLeft: `4px solid ${solverStatus.type === 'success' ? '#28a745' :
                                    solverStatus.type === 'error' ? '#dc3545' :
                                    solverStatus.type === 'solving' ? '#ffc107' : '#666'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ marginTop: '2px' }}>
              {solverStatus.type === 'solving' && <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              {solverStatus.type === 'success' && <CheckCircle size={16} color="#28a745" />}
              {solverStatus.type === 'error' && <XCircle size={16} color="#dc3545" />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{solverStatus.message}</div>
              {solverStatus.details && (
                <div style={{ fontSize: '12px', opacity: 0.9 }}>{solverStatus.details}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Available Chains Info or Warning */}
      {availableChains.length > 0 ? (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          borderRadius: '4px',
          backgroundColor: '#1a2a3a',
          borderLeft: '4px solid #0d6efd',
          fontSize: '12px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>
            Available Chains ({availableChains.length})
          </div>
          <div style={{ color: '#aaa' }}>
            {availableChains.map(c => c.name).join(', ')}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '12px',
          marginBottom: '20px',
          borderRadius: '4px',
          backgroundColor: '#4d3a1a',
          borderLeft: '4px solid #ffc107',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertCircle size={20} color="#ffc107" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>No Kinematic Chains Found</div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                Load a robot (URDF/MJCF) from the Asset Library to use FullBody IK
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Quick Actions</h4>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={solveHumanoidWalking}
            title="Humanoid Walk Pose"
            style={{
              flex: 1,
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <Footprints size={20} />
            <span style={{ fontSize: '11px', fontWeight: '500' }}>Walk</span>
          </button>
          <button
            onClick={solveQuadrupedStance}
            title="Quadruped Stance"
            style={{
              flex: 1,
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <PawPrint size={20} />
            <span style={{ fontSize: '11px', fontWeight: '500' }}>Stand</span>
          </button>
          <button
            onClick={solveDualArm}
            title="Dual-Arm Grasp"
            style={{
              flex: 1,
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <Grip size={20} />
            <span style={{ fontSize: '11px', fontWeight: '500' }}>Grasp</span>
          </button>
        </div>
      </div>

      {/* Custom Targets */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Custom Targets</h4>
        <button
          onClick={addTarget}
          title="Add Target"
          style={{
            marginBottom: '10px',
            width: '40px',
            height: '40px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={20} />
        </button>

        {/* Empty State Guidance */}
        {targets.length === 0 && showGuidance && availableChains.length > 0 && (
          <div style={{
            padding: '16px',
            marginBottom: '16px',
            borderRadius: '6px',
            backgroundColor: '#1a2a3a',
            border: '1px solid #0d6efd',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ fontSize: '24px' }}>💡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                  Getting Started
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#ccc' }}>
                  Choose one of these options:
                  <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                    <li style={{ marginBottom: '4px' }}>
                      Use <strong>Quick Actions</strong> above for preset poses (Walk, Stand, Grasp)
                    </li>
                    <li>
                      Click <strong>[+]</strong> below to add a custom target and set X/Y/Z coordinates
                    </li>
                  </ul>
                </div>
              </div>
              <button
                onClick={() => setShowGuidance(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0',
                  lineHeight: 1
                }}
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {targets.map((target, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #444',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '4px',
              backgroundColor: '#1a1a1a',
            }}
          >
            <div style={{ marginBottom: '5px' }}>
              <label>
                Chain:{' '}
                <select
                  value={target.chainName}
                  onChange={(e) => updateTarget(index, 'chainName', e.target.value)}
                  style={{ width: '150px' }}
                >
                  <option value="">-- Select Chain --</option>
                  {availableChains.map((chain) => (
                    <option key={chain.id} value={chain.name}>
                      {chain.name}
                    </option>
                  ))}
                </select>
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
              <label title="Higher priority targets are favored when conflicts occur (1.0 = highest)">
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
              <button
                onClick={() => removeTarget(index)}
                title="Remove Target"
                style={{
                  marginLeft: '10px',
                  width: '32px',
                  height: '32px',
                  padding: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#dc3545',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {targets.length > 0 && (
          <button
            onClick={solveWholeBodyIK}
            title="Solve FullBody IK"
            style={{
              marginTop: '10px',
              width: '100%',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 'bold',
              fontSize: '15px',
              backgroundColor: '#0d6efd',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <Play size={18} />
          </button>
        )}
      </div>

      {/* Constraints */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Constraints</h4>
        <label style={{ display: 'block', marginBottom: '8px' }} title="Prevent robot parts from intersecting each other">
          <input
            type="checkbox"
            checked={enableCollisionAvoidance}
            onChange={(e) => setEnableCollisionAvoidance(e.target.checked)}
          />
          Collision Avoidance
          <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>(Recommended)</span>
        </label>
        <label style={{ display: 'block', marginBottom: '5px' }} title="Keep robot balanced (useful for walking/standing poses)">
          <input
            type="checkbox"
            checked={enableBalance}
            onChange={(e) => setEnableBalance(e.target.checked)}
          />
          Balance Constraint
          <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>(For humanoids/quadrupeds)</span>
        </label>
      </div>

      {/* Solver Settings */}
      <div>
        <h4>Solver Settings</h4>
        <label style={{ display: 'block', marginBottom: '10px' }} title="How many attempts the solver makes to reach targets">
          Max Iterations:{' '}
          <input
            type="number"
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value))}
            style={{ width: '80px' }}
          />
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            Higher = more accurate but slower (default: 100)
          </div>
        </label>
        <label style={{ display: 'block' }} title="How close the robot needs to get to targets">
          Tolerance (m):{' '}
          <input
            type="number"
            step="0.0001"
            value={tolerance}
            onChange={(e) => setTolerance(parseFloat(e.target.value))}
            style={{ width: '80px' }}
          />
          <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
            Position accuracy in meters (default: 0.001 = 1mm)
          </div>
        </label>
      </div>

      {/* Apply/Reset Actions */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginTop: '24px',
        paddingTop: '20px',
        borderTop: '2px solid #555'
      }}>
        <button
          onClick={applySolution}
          disabled={!lastSolution || !lastSolution.success}
          title={!lastSolution?.success ? 'Solve IK first to get a valid solution' : 'Apply solution to robot'}
          style={{
            flex: 1,
            padding: '14px',
            fontSize: '15px',
            fontWeight: 'bold',
            backgroundColor: lastSolution?.success ? '#28a745' : '#333',
            color: lastSolution?.success ? '#fff' : '#666',
            cursor: lastSolution?.success ? 'pointer' : 'not-allowed',
            border: 'none',
            borderRadius: '4px',
            transition: 'all 0.2s'
          }}
        >
          <CheckCircle size={18} />
        </button>

        <button
          onClick={resetToCurrentPose}
          disabled={!lastSolution}
          title="Clear solution and reset status"
          style={{
            padding: '14px 20px',
            fontSize: '15px',
            backgroundColor: '#444',
            color: lastSolution ? '#fff' : '#666',
            cursor: lastSolution ? 'pointer' : 'not-allowed',
            border: 'none',
            borderRadius: '4px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <RotateCcw size={18} />
        </button>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#999', borderTop: '1px solid #444', paddingTop: '10px' }}>
        <p style={{ margin: '5px 0' }}>
          <strong>💡 Quick Tip:</strong> Try a Quick Action preset above, or create Custom Targets to control specific robot parts
        </p>
      </div>
    </FloatingPanel>
  );
};
