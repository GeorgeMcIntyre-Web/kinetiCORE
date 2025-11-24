import { describe, it, expect, vi } from 'vitest';
import { Matrix, Vector3 } from '@babylonjs/core';
import { ToolingKinematicsAdapter, KinematicsAdapterContext } from '../../src/kinematics/toolingKinematicsAdapter';
import { KinematicsManager } from '../../src/kinematics/KinematicsManager';
import type { UnitsV2Output } from '../../src/domain/tooling/unitsV2Pipeline';
import type { ToolMotionJoint } from '../../src/domain/tooling/toolingMotion';

describe('ToolingKinematicsAdapter', () => {
    // Mock Context
    const mockContext: KinematicsAdapterContext = {
        getNodeWorldMatrix: (nodeId: string) => {
            // Return Identity for simplicity, or specific matrices if needed
            if (nodeId === 'missing_node') return null;
            return Matrix.Identity();
        },
    };

    it('should return empty array if no motion joints', () => {
        const output: UnitsV2Output = {
            units: [],
            motionJoints: [],
        } as any;

        const chains = ToolingKinematicsAdapter.buildChains(output, mockContext);
        expect(chains).toEqual([]);
    });

    it('should skip joints without unitId', () => {
        const output: UnitsV2Output = {
            units: [],
            motionJoints: [
                {
                    id: 'j1',
                    motionType: 'revolute',
                    baseNodeId: 'base1',
                    movingNodeId: 'move1',
                    axisWorld: { x: 0, y: 1, z: 0 },
                    axisOriginWorld: { x: 0, y: 0, z: 0 },
                    rangeMin: -90,
                    rangeMax: 90,
                    // No unitId
                } as ToolMotionJoint,
            ],
        } as any;

        const chains = ToolingKinematicsAdapter.buildChains(output, mockContext);
        expect(chains).toHaveLength(0);
    });

    it('should build a chain for a valid revolute joint', () => {
        const joint: ToolMotionJoint = {
            id: 'j1',
            motionType: 'revolute',
            baseNodeId: 'base1',
            movingNodeId: 'move1',
            axisWorld: { x: 0, y: 1, z: 0 }, // Y-up
            axisOriginWorld: { x: 10, y: 0, z: 0 },
            rangeMin: -90,
            rangeMax: 90,
            unitId: 'unit1',
        };

        const output: UnitsV2Output = {
            units: [],
            motionJoints: [joint],
        } as any;

        const chains = ToolingKinematicsAdapter.buildChains(output, mockContext);

        expect(chains).toHaveLength(1);
        const chain = chains[0];
        expect(chain.id).toBe('tooling_chain_unit1');
        expect(chain.joints).toHaveLength(1);

        const jConfig = chain.joints[0];
        expect(jConfig.type).toBe('revolute');
        expect(jConfig.axis).toEqual({ x: 0, y: 1, z: 0 }); // Identity parent -> local axis same as world
        expect(jConfig.origin).toEqual({ x: 10, y: 0, z: 0 });

        // Check limits (degrees -> radians)
        expect(jConfig.limits.lower).toBeCloseTo(-Math.PI / 2);
        expect(jConfig.limits.upper).toBeCloseTo(Math.PI / 2);
    });

    it('should build a chain for a valid prismatic joint', () => {
        const joint: ToolMotionJoint = {
            id: 'j2',
            motionType: 'prismatic',
            baseNodeId: 'base2',
            movingNodeId: 'move2',
            axisWorld: { x: 1, y: 0, z: 0 }, // X-axis
            axisOriginWorld: { x: 0, y: 0, z: 0 },
            rangeMin: 0,
            rangeMax: 100,
            unitId: 'unit2',
        };

        const output: UnitsV2Output = {
            units: [],
            motionJoints: [joint],
        } as any;

        const chains = ToolingKinematicsAdapter.buildChains(output, mockContext);

        expect(chains).toHaveLength(1);
        const jConfig = chains[0].joints[0];
        expect(jConfig.type).toBe('prismatic');
        expect(jConfig.limits.lower).toBe(0);
        expect(jConfig.limits.upper).toBe(100);
    });

    it('should handle multiple units', () => {
        const output: UnitsV2Output = {
            units: [],
            motionJoints: [
                {
                    id: 'j1',
                    motionType: 'revolute',
                    baseNodeId: 'b1',
                    movingNodeId: 'm1',
                    axisWorld: { x: 0, y: 1, z: 0 },
                    axisOriginWorld: { x: 0, y: 0, z: 0 },
                    rangeMin: 0,
                    rangeMax: 0,
                    unitId: 'u1',
                },
                {
                    id: 'j2',
                    motionType: 'revolute',
                    baseNodeId: 'b2',
                    movingNodeId: 'm2',
                    axisWorld: { x: 0, y: 1, z: 0 },
                    axisOriginWorld: { x: 0, y: 0, z: 0 },
                    rangeMin: 0,
                    rangeMax: 0,
                    unitId: 'u2',
                },
            ] as ToolMotionJoint[],
        } as any;

        const chains = ToolingKinematicsAdapter.buildChains(output, mockContext);
        expect(chains).toHaveLength(2);
        expect(chains.find(c => c.id === 'tooling_chain_u1')).toBeDefined();
        expect(chains.find(c => c.id === 'tooling_chain_u2')).toBeDefined();
    });

    it('should transform world coordinates to local', () => {
        // Setup a context where parent is rotated 90 deg around X
        // World Y -> Local Z
        const rotatedContext: KinematicsAdapterContext = {
            getNodeWorldMatrix: (nodeId) => {
                return Matrix.RotationX(Math.PI / 2);
            },
        };

        const joint: ToolMotionJoint = {
            id: 'j_rot',
            motionType: 'revolute',
            baseNodeId: 'base_rot',
            movingNodeId: 'move_rot',
            axisWorld: { x: 0, y: 1, z: 0 }, // World Y
            axisOriginWorld: { x: 0, y: 10, z: 0 }, // World Y=10
            rangeMin: 0,
            rangeMax: 0,
            unitId: 'u_rot',
        };

        const output: UnitsV2Output = {
            units: [],
            motionJoints: [joint],
        } as any;

        const chains = ToolingKinematicsAdapter.buildChains(output, rotatedContext);
        const jConfig = chains[0].joints[0];

        // Parent is rotated 90 deg X.
        // World Y (0,1,0) -> Local Z (0,0,1) roughly (or Y->Z depending on handedness)
        // Let's check the math:
        // Parent = RotX(90).
        // ParentInv = RotX(-90).
        // Vec(0,1,0) * RotX(-90) -> (0, cos(-90)*1 - sin(-90)*0, ...)
        // Actually:
        // y' = y*cos(theta) - z*sin(theta)
        // z' = y*sin(theta) + z*cos(theta)
        // theta = -90.
        // y' = 0 - 0 = 0.
        // z' = 1*(-1) + 0 = -1.
        // So World Y -> Local -Z?
        // Let's just verify it's NOT (0,1,0)

        expect(jConfig.axis.y).toBeCloseTo(0);
        expect(Math.abs(jConfig.axis.z)).toBeCloseTo(1);
    });

    it('should register chains with KinematicsManager', () => {
        const manager = KinematicsManager.getInstance();
        manager.reset();

        const joint: ToolMotionJoint = {
            id: 'j_reg',
            motionType: 'revolute',
            baseNodeId: 'base_reg',
            movingNodeId: 'move_reg',
            axisWorld: { x: 0, y: 1, z: 0 },
            axisOriginWorld: { x: 0, y: 0, z: 0 },
            rangeMin: -45,
            rangeMax: 45,
            unitId: 'unit_reg',
        };

        const output: UnitsV2Output = {
            units: [],
            motionJoints: [joint],
        } as any;

        const ids = ToolingKinematicsAdapter.registerChains(output, mockContext);
        expect(ids).toHaveLength(1);

        const toolingChains = manager.getToolingChains();
        expect(toolingChains).toHaveLength(1);
        expect(toolingChains[0].id).toBe(ids[0]);
        expect(toolingChains[0].joints).toHaveLength(1);
        expect(toolingChains[0].joints[0].type).toBe('revolute');
    });
});
