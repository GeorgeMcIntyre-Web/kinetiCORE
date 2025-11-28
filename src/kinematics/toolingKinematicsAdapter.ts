import { Matrix, Vector3 } from '@babylonjs/core';
import type { UnitsV2Output } from '../domain/tooling/unitsV2Pipeline';
import type { JointDefinitionOutput } from '../babylon/io/Schemas';
import type { ToolMotionJoint } from '../domain/tooling/toolingMotion';
import type { KinematicChain, JointConfig, JointType } from './KinematicsManager';
import { KinematicsManager } from './KinematicsManager';
import type { DetectedToolJoint } from '../babylon/sceneAnalysis/ToolingTypes';

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

    static registerChains(
        output: UnitsV2Output,
        context: KinematicsAdapterContext
    ): string[] {
        const manager = KinematicsManager.getInstance();
        const chains = this.buildChains(output, context);
        const ids: string[] = [];

        for (const chain of chains) {
            manager.registerToolingChain(chain);
            ids.push(chain.id);
        }

        return ids;
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

    static registerSingleChainFromAnimator(
        rootNodeId: string,
        jointsOut: JointDefinitionOutput[],
        context: KinematicsAdapterContext
    ): string | null {
        const runtimeJoints: JointConfig[] = [];
        for (const j of jointsOut) {
            const parentWorld = context.getNodeWorldMatrix(j.parentId);
            if (!parentWorld) continue;
            const parentInv = parentWorld.clone().invert();
            const axisWorldVec = new Vector3(j.axisWorld.x, j.axisWorld.y, j.axisWorld.z);
            const axisLocal = Vector3.TransformNormal(axisWorldVec, parentInv).normalize();
            const originWorldVec = new Vector3(j.anchorWorld.x, j.anchorWorld.y, j.anchorWorld.z);
            const originLocal = Vector3.TransformCoordinates(originWorldVec, parentInv);
            const type: JointType = j.type === 'hinge' ? 'revolute' : j.type === 'prismatic' ? 'prismatic' : 'fixed';
            runtimeJoints.push({
                id: j.id,
                name: j.id,
                type,
                parentNodeId: j.parentId,
                childNodeId: j.childId,
                axis: { x: axisLocal.x, y: axisLocal.y, z: axisLocal.z },
                origin: { x: originLocal.x, y: originLocal.y, z: originLocal.z },
                limits: {
                    lower: j.limits.lower,
                    upper: j.limits.upper,
                    velocity: 1.0,
                    effort: 100.0,
                },
                position: 0,
                velocity: 0,
                effort: 0,
                showAxis: true,
                showLimits: false,
            });
        }
        if (runtimeJoints.length === 0) return null;
        const chain: KinematicChain = {
            id: `tooling_animator_chain_${rootNodeId}`,
            name: `Tooling Animator Chain`,
            type: 'tree',
            rootNodeId,
            joints: runtimeJoints,
            dof: runtimeJoints.length,
            tcpFrames: [],
        } as any;
        const manager = KinematicsManager.getInstance();
        manager.registerToolingChain(chain);
        return chain.id;
    }

    /**
     * Simplify tooling joints by preferring revolute over prismatic and keeping only primary joint.
     * Most BIW tooling (clamps, locators) have a single primary motion: either hinge OR slide, not both.
     * This prevents false prismatic detections from contaminating pure revolute fixtures.
     *
     * Strategy:
     * - If any revolute joints exist, keep only the largest revolute (by angle)
     * - Otherwise, keep only the largest prismatic (by travel)
     * - This can be enhanced later to detect genuine hybrid fixtures
     */
    private static simplifyToolingJoints(joints: DetectedToolJoint[]): DetectedToolJoint[] {
        if (joints.length === 0) return joints;

        const revolute = joints.filter(j => j.deltaType === 'revolute');
        const prismatic = joints.filter(j => j.deltaType === 'prismatic');

        // Prefer revolute joints (hinges/clamps are most common)
        if (revolute.length > 0) {
            // Keep only the revolute with the largest angle
            const sorted = [...revolute].sort((a, b) =>
                (b.angleDeg ?? 0) - (a.angleDeg ?? 0)
            );
            return [sorted[0]];
        }

        // Fall back to prismatic if no revolute found
        if (prismatic.length > 0) {
            // Keep only the prismatic with the largest travel
            const sorted = [...prismatic].sort((a, b) =>
                Math.abs(b.travelWorld ?? 0) - Math.abs(a.travelWorld ?? 0)
            );
            return [sorted[0]];
        }

        return [];
    }

    /**
     * Register tooling joints directly from StructureBasedToolAnalyzer detected joints.
     * This is the ONE-CLICK AUTO-FIT path - no manual state capture required.
     *
     * @param fixtureRootId - ID of the fixture root node
     * @param detectedJoints - Joints from StructureBasedToolAnalyzer.getDetectedToolJoints()
     * @param context - Context for resolving world matrices
     * @returns Chain ID if successful, null if no valid joints
     */
    static registerFromDetectedJoints(
        fixtureRootId: string,
        detectedJoints: DetectedToolJoint[],
        context: KinematicsAdapterContext
    ): { chainId: string | null; jointsRegistered: number; errors: string[] } {
        const errors: string[] = [];

        if (detectedJoints.length === 0) {
            return { chainId: null, jointsRegistered: 0, errors: ['No detected joints provided'] };
        }

        // Apply tooling-specific simplification: prefer single primary joint
        const simplifiedJoints = this.simplifyToolingJoints(detectedJoints);

        if (simplifiedJoints.length === 0) {
            return { chainId: null, jointsRegistered: 0, errors: ['No valid joints after simplification'] };
        }

        console.log(`[ToolingKinematicsAdapter] Simplified ${detectedJoints.length} detected joints to ${simplifiedJoints.length} primary joint(s)`);

        const runtimeJoints: JointConfig[] = [];

        for (const dj of simplifiedJoints) {
            // Guard: skip joints with insufficient motion
            // Use 5° threshold to filter out noise/floating-point drift while allowing small real motions
            if (dj.deltaType === 'revolute' && (dj.angleDeg === undefined || dj.angleDeg < 5)) {
                errors.push(`Skipped joint ${dj.jointId}: insufficient rotation (< 5° minimum) (${dj.angleDeg?.toFixed(1) ?? 0}°)`);
                continue;
            }

            // Guard: skip prismatic joints with zero travel
            if (dj.deltaType === 'prismatic' && (!dj.travelWorld || Math.abs(dj.travelWorld) < 0.100)) {
                errors.push(`Skipped joint ${dj.jointId}: insufficient travel (< 100mm minimum) (${((dj.travelWorld ?? 0) * 1000).toFixed(1)}mm)`);
                continue;
            }

            // Use nodeAId as parent (fixed state) and nodeBId as child (moving state)
            const parentNodeId = dj.nodeAId;
            const childNodeId = dj.nodeBId;

            // Get parent world matrix for local transform computation
            const parentWorld = context.getNodeWorldMatrix(parentNodeId);
            if (parentWorld === null) {
                errors.push(`Skipped joint ${dj.jointId}: could not resolve parent node ${parentNodeId}`);
                continue;
            }

            // Use unit scene node name from analyzer (e.g., "UNIT_112", "RH")
            // This is more reliable than resolving from child node which might be "MOVING" or deep nested
            const jointName = dj.unitName || dj.unitId; // Fallback to internal ID if name unavailable

            const parentInv = parentWorld.clone().invert();

            // Transform axis to local space (fallback to global axis if axisWorld not available)
            const worldAxis = dj.axisWorld ?? dj.axis;
            const axisLocal = Vector3.TransformNormal(worldAxis.clone(), parentInv).normalize();

            // Transform origin to local space (fallback to anchor if originWorld not available)
            const worldOrigin = dj.originWorld ?? dj.anchor;
            const originLocal = Vector3.TransformCoordinates(worldOrigin.clone(), parentInv);

            // Determine joint type
            const type: JointType = dj.deltaType === 'revolute' ? 'revolute' : 'prismatic';

            // Compute limits
            let lower = 0;
            let upper = 0;

            if (type === 'revolute') {
                // Revolute: use detected angle as range (0 to angleDeg in radians)
                const angleDeg = dj.angleDeg ?? 90;
                upper = (angleDeg * Math.PI) / 180;
            }
            if (type === 'prismatic') {
                // Prismatic: use travel distance
                upper = Math.abs(dj.travelWorld ?? 0);
            }

            const jointConfig: JointConfig = {
                id: `autofit_${dj.jointId}`,
                name: jointName, // Use resolved scene node name (e.g., "UNIT_112")
                type,
                parentNodeId,
                childNodeId,
                axis: { x: axisLocal.x, y: axisLocal.y, z: axisLocal.z },
                origin: { x: originLocal.x, y: originLocal.y, z: originLocal.z },
                limits: {
                    lower,
                    upper,
                    velocity: 1.0,
                    effort: 100.0,
                },
                position: 0,
                velocity: 0,
                effort: 0,
                showAxis: true,
                showLimits: false,
            };

            runtimeJoints.push(jointConfig);
        }

        if (runtimeJoints.length === 0) {
            return { chainId: null, jointsRegistered: 0, errors };
        }

        // Create the chain
        const chain: KinematicChain = {
            id: `autofit_tooling_${fixtureRootId}`,
            name: `Auto-Fit Tooling`,
            type: 'tree',
            rootNodeId: fixtureRootId,
            joints: runtimeJoints,
            dof: runtimeJoints.length,
            tcpFrames: [],
        };

        // Register with KinematicsManager
        const manager = KinematicsManager.getInstance();
        manager.registerToolingChain(chain);

        console.log(`[ToolingKinematicsAdapter] Registered ${runtimeJoints.length} joints for fixture ${fixtureRootId}`);

        return { chainId: chain.id, jointsRegistered: runtimeJoints.length, errors };
    }
}
