import { Matrix, Vector3 } from '@babylonjs/core';
import type { UnitsV2Output } from '../domain/tooling/unitsV2Pipeline';
import type { ToolMotionJoint } from '../domain/tooling/toolingMotion';
import type { KinematicChain, JointConfig, JointType } from './KinematicsManager';

/**
 * Interface for looking up world transforms during adaptation.
 * Allows decoupling from the actual Scene/Babylon instance for testing.
 */
export interface KinematicsAdapterContext {
    /**
     * Get the world matrix of a node by its ID.
     * Used to transform world-space joint data into parent-local space.
     */
    getNodeWorldMatrix(nodeId: string): Matrix | null;
}

/**
 * Adapter to convert Domain Tooling Units (UnitsV2) into Runtime Kinematic Chains.
 */
export class ToolingKinematicsAdapter {
    /**
     * Build kinematic chains for all units in the V2 output.
     */
    static buildChains(
        output: UnitsV2Output,
        context: KinematicsAdapterContext
    ): KinematicChain[] {
        if (!output.motionJoints || output.motionJoints.length === 0) {
            return [];
        }

        // Group joints by unitId
        const jointsByUnit = new Map<string, ToolMotionJoint[]>();

        for (const joint of output.motionJoints) {
            // If unitId is missing, we can't assign it to a chain reliably yet.
            // In the future we might infer it, but for now we skip.
            if (!joint.unitId) continue;

            const list = jointsByUnit.get(joint.unitId) || [];
            list.push(joint);
            jointsByUnit.set(joint.unitId, list);
        }

        const chains: KinematicChain[] = [];

        for (const [unitId, joints] of jointsByUnit) {
            const chain = this.buildChainForUnit(unitId, joints, context);
            if (chain) {
                chains.push(chain);
            }
        }

        return chains;
    }

    /**
     * Build a single kinematic chain for a specific unit.
     */
    static buildChainForUnit(
        unitId: string,
        joints: ToolMotionJoint[],
        context: KinematicsAdapterContext
    ): KinematicChain | null {
        if (joints.length === 0) return null;

        // Sort joints to ensure deterministic order (optional but good)
        joints.sort((a, b) => a.id.localeCompare(b.id));

        const runtimeJoints: JointConfig[] = [];

        for (const motionJoint of joints) {
            const config = this.mapJointToConfig(motionJoint, context);
            if (config) {
                runtimeJoints.push(config);
            }
        }

        if (runtimeJoints.length === 0) return null;

        // Determine root node of the chain.
        // For a tooling unit, the "base" of the first joint is a reasonable root candidate.
        // Or we could look up the unit's baseGroupId -> node.
        // For now, we use the baseNodeId of the first joint.
        const rootNodeId = joints[0].baseNodeId;

        return {
            id: `tooling_chain_${unitId}`,
            name: `Tooling Unit ${unitId}`,
            type: 'tree', // Tooling often branches
            rootNodeId,
            joints: runtimeJoints,
            dof: runtimeJoints.length,
            tcpFrames: [], // Tooling might have TCPs, but unknown for now
        };
    }

    /**
     * Map a single ToolMotionJoint to a Runtime JointConfig.
     */
    private static mapJointToConfig(
        joint: ToolMotionJoint,
        context: KinematicsAdapterContext
    ): JointConfig | null {
        // 1. Map Motion Type
        let type: JointType;
        if (joint.motionType === 'revolute') type = 'revolute';
        else if (joint.motionType === 'prismatic') type = 'prismatic';
        else return null; // Skip unknown types

        // 2. Get Parent World Matrix to compute Local Axis/Origin
        const parentWorld = context.getNodeWorldMatrix(joint.baseNodeId);
        if (!parentWorld) {
            // Cannot compute local transform without parent matrix
            return null;
        }

        const parentInv = parentWorld.clone().invert();

        // 3. Transform Axis (Direction) to Local Space
        // Axis is a vector, so we only rotate it (set translation to 0)
        const axisWorldVec = new Vector3(joint.axisWorld.x, joint.axisWorld.y, joint.axisWorld.z);
        const axisLocal = Vector3.TransformNormal(axisWorldVec, parentInv).normalize();

        // 4. Transform Origin (Point) to Local Space
        const originWorldVec = new Vector3(joint.axisOriginWorld.x, joint.axisOriginWorld.y, joint.axisOriginWorld.z);
        const originLocal = Vector3.TransformCoordinates(originWorldVec, parentInv);

        // 5. Map Limits
        // Revolute: degrees -> radians
        // Prismatic: units -> units (usually meters in Babylon, but check domain units)
        // Domain toolingMotion.ts usually outputs degrees for revolute.
        let lower = joint.rangeMin;
        let upper = joint.rangeMax;

        if (type === 'revolute') {
            lower = (lower * Math.PI) / 180;
            upper = (upper * Math.PI) / 180;
        }

        return {
            id: `joint_${joint.unitId}_${joint.id}`,
            name: joint.id,
            type,
            parentNodeId: joint.baseNodeId,
            childNodeId: joint.movingNodeId,
            axis: { x: axisLocal.x, y: axisLocal.y, z: axisLocal.z },
            origin: { x: originLocal.x, y: originLocal.y, z: originLocal.z },
            limits: {
                lower,
                upper,
                velocity: 1.0, // Default
                effort: 100.0, // Default
            },
            position: 0,
            velocity: 0,
            effort: 0,
            showAxis: true,
            showLimits: false,
        };
    }
}
