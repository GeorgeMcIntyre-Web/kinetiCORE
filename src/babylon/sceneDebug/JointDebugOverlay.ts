import * as BABYLON from '@babylonjs/core';
import type { DetectedToolJoint } from '../sceneAnalysis/ToolingTypes';
import { projectVectorOnPlane } from '../kinematics/JointMath';

/**
 * Joint Debug Overlay Service
 * 
 * Visualizes DetectedToolJoint instances as simple glyphs in the 3D viewport.
 * - Revolute joints: Blue axis line + optional ring
 * - Prismatic joints: Green arrow
 * 
 * NO "car line" concepts - uses tooling/model origin only.
 */
export class JointDebugOverlay {
    private scene: BABYLON.Scene;
    private debugMeshes: BABYLON.Mesh[] = [];
    private isVisible: boolean = true;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * Show joints as debug glyphs in the scene.
     * Clears any previous glyphs first.
     */
    showJoints(joints: DetectedToolJoint[]): void {
        // Guard: clear existing
        this.clear();

        // Guard: empty array
        if (joints.length === 0) {
            return;
        }

        // Guard: no scene
        if (!this.scene) {
            console.warn('[JointDebugOverlay] No scene available');
            return;
        }

        for (const joint of joints) {
            this.createJointGlyph(joint);
        }

        console.log(`[JointDebugOverlay] Showing ${joints.length} joint glyphs`);
    }

    /**
     * Clear all debug meshes from the scene.
     */
    clear(): void {
        for (const mesh of this.debugMeshes) {
            mesh.dispose();
        }
        this.debugMeshes = [];
    }

    /**
     * Toggle visibility of all debug meshes.
     */
    setVisible(visible: boolean): void {
        this.isVisible = visible;
        for (const mesh of this.debugMeshes) {
            mesh.isVisible = visible;
        }
    }

    /**
     * Dispose all resources.
     */
    dispose(): void {
        this.clear();
    }

    // ============================================================================
    // Private Helpers
    // ============================================================================

    private createJointGlyph(joint: DetectedToolJoint): void {
        // Guard: missing geometry
        if (!joint.axisWorld || !joint.originWorld) {
            console.warn(`[JointDebugOverlay] Joint ${joint.jointId} missing geometry, skipping`);
            return;
        }

        if (joint.isPrismatic) {
            this.createPrismaticGlyph(joint);
            return;
        }

        this.createRevoluteGlyph(joint);
    }

    private createRevoluteGlyph(joint: DetectedToolJoint): void {
        // Type assertion safe because createJointGlyph already checks these exist
        const axis = joint.axisWorld!;
        const origin = joint.originWorld!;

        // Axis line (Blue Cylinder)
        const axisLength = 0.1; // 10cm
        const axisRadius = 0.002; // 2mm (thinner for precision)

        const axisCylinder = BABYLON.MeshBuilder.CreateCylinder(
            `joint_${joint.unitId}_${joint.jointId}_axis`,
            {
                height: axisLength,
                diameter: axisRadius * 2,
            },
            this.scene
        );

        // Position at origin, oriented along axis
        axisCylinder.position = origin.clone();

        // Orient cylinder along axis (default is Y-up)
        const defaultAxis = BABYLON.Vector3.Up();
        const rotationAxis = BABYLON.Vector3.Cross(defaultAxis, axis);
        const rotationAngle = Math.acos(BABYLON.Vector3.Dot(defaultAxis, axis.normalize()));

        if (rotationAxis.length() > 0.001) {
            axisCylinder.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
                rotationAxis.normalize(),
                rotationAngle
            );
        }

        // Blue emissive material for Axis
        const axisMaterial = new BABYLON.StandardMaterial(
            `joint_${joint.unitId}_${joint.jointId}_axis_mat`,
            this.scene
        );
        axisMaterial.emissiveColor = new BABYLON.Color3(0, 0.5, 1); // Blue
        axisMaterial.disableLighting = true;
        axisCylinder.material = axisMaterial;
        axisCylinder.isVisible = this.isVisible;
        this.debugMeshes.push(axisCylinder);

        // Pivot Point (Gold Sphere)
        const pivotSphere = BABYLON.MeshBuilder.CreateSphere(
            `joint_${joint.unitId}_${joint.jointId}_pivot`,
            { diameter: 0.015 }, // 1.5cm
            this.scene
        );
        pivotSphere.position = origin.clone();

        const pivotMaterial = new BABYLON.StandardMaterial(
            `joint_${joint.unitId}_${joint.jointId}_pivot_mat`,
            this.scene
        );
        pivotMaterial.emissiveColor = new BABYLON.Color3(1, 0.84, 0); // Gold
        pivotMaterial.disableLighting = true;
        pivotSphere.material = pivotMaterial;
        pivotSphere.isVisible = this.isVisible;
        this.debugMeshes.push(pivotSphere);

        // Swing Sector (Orange Arc) & Lever Arms (Yellow Lines)
        // Use Circle Fit projected vectors if available, otherwise fallback to fromCenter/toCenter
        if (joint.fromVector && joint.toVector) {
            // Circle Fit approach: use projected vectors for flat circular sector
            const fromVec = new BABYLON.Vector3(joint.fromVector.x, joint.fromVector.y, joint.fromVector.z);

            const radius = fromVec.length();

            if (radius > 0.001) {
                const points: BABYLON.Vector3[] = [];
                const segments = 20;
                const totalAngle = joint.travelWorld ?? Math.PI / 2; // Radians, default 90°

                // Generate arc points by rotating fromVector around axis
                for (let i = 0; i <= segments; i++) {
                    const angle = (i / segments) * totalAngle;
                    const rotation = BABYLON.Quaternion.RotationAxis(axis, angle);
                    const rotatedVector = fromVec.applyRotationQuaternion(rotation);
                    points.push(origin.add(rotatedVector));
                }

                // Orange Arc
                const arcLines = BABYLON.MeshBuilder.CreateLines(
                    `joint_${joint.unitId}_${joint.jointId}_arc`,
                    { points: points },
                    this.scene
                );
                arcLines.color = new BABYLON.Color3(1, 0.5, 0); // Orange
                arcLines.isVisible = this.isVisible;
                this.debugMeshes.push(arcLines);

                // Yellow Lever Arms (Radius Vectors)
                // 1. Pivot -> Start Point
                const startArm = BABYLON.MeshBuilder.CreateLines(
                    `joint_${joint.unitId}_${joint.jointId}_arm_start`,
                    { points: [origin, points[0]] },
                    this.scene
                );
                startArm.color = new BABYLON.Color3(1, 1, 0); // Yellow
                startArm.isVisible = this.isVisible;
                this.debugMeshes.push(startArm);

                // 2. Pivot -> End Point
                const endArm = BABYLON.MeshBuilder.CreateLines(
                    `joint_${joint.unitId}_${joint.jointId}_arm_end`,
                    { points: [origin, points[points.length - 1]] },
                    this.scene
                );
                endArm.color = new BABYLON.Color3(1, 1, 0); // Yellow
                endArm.isVisible = this.isVisible;
                this.debugMeshes.push(endArm);
            }
        } else if (joint.fromCenter && joint.toCenter) {
            // Fallback: use fromCenter/toCenter (legacy approach)
            const from = new BABYLON.Vector3(joint.fromCenter.x, joint.fromCenter.y, joint.fromCenter.z);
            // Calculate radius from pivot to the moving center
            let radiusVector = from.subtract(origin);

            // Project radius vector onto the plane perpendicular to the axis
            // This ensures the arc is a flat circle sector, removing 3D drift artifacts
            radiusVector = projectVectorOnPlane(radiusVector, axis.normalize());

            const radius = radiusVector.length();

            if (radius > 0.001) {
                const points: BABYLON.Vector3[] = [];
                const segments = 20;
                const totalAngle = joint.travelWorld ?? Math.PI / 2; // Radians, default 90°

                // Generate arc points
                for (let i = 0; i <= segments; i++) {
                    const angle = (i / segments) * totalAngle;
                    const rotation = BABYLON.Quaternion.RotationAxis(axis, angle);
                    const rotatedVector = radiusVector.applyRotationQuaternion(rotation);
                    points.push(origin.add(rotatedVector));
                }

                // Orange Arc
                const arcLines = BABYLON.MeshBuilder.CreateLines(
                    `joint_${joint.unitId}_${joint.jointId}_arc`,
                    { points: points },
                    this.scene
                );
                arcLines.color = new BABYLON.Color3(1, 0.5, 0); // Orange
                arcLines.isVisible = this.isVisible;
                this.debugMeshes.push(arcLines);

                // Yellow Lever Arms (Radius Vectors)
                // 1. Pivot -> Start Point
                const startArm = BABYLON.MeshBuilder.CreateLines(
                    `joint_${joint.unitId}_${joint.jointId}_arm_start`,
                    { points: [origin, points[0]] },
                    this.scene
                );
                startArm.color = new BABYLON.Color3(1, 1, 0); // Yellow
                startArm.isVisible = this.isVisible;
                this.debugMeshes.push(startArm);

                // 2. Pivot -> End Point
                const endArm = BABYLON.MeshBuilder.CreateLines(
                    `joint_${joint.unitId}_${joint.jointId}_arm_end`,
                    { points: [origin, points[points.length - 1]] },
                    this.scene
                );
                endArm.color = new BABYLON.Color3(1, 1, 0); // Yellow
                endArm.isVisible = this.isVisible;
                this.debugMeshes.push(endArm);
            }
        }
    }

    private createPrismaticGlyph(joint: DetectedToolJoint): void {
        // Type assertion safe because createJointGlyph already checks these exist
        const direction = joint.axisWorld!.normalize();
        const origin = joint.originWorld!;

        // Arrow length based on travel distance estimate
        const arrowLength = Math.min(0.15, Math.max(0.05, joint.travelWorld ?? 0.1));
        const arrowRadius = 0.005; // 5mm

        // Arrow shaft (cylinder)
        const shaft = BABYLON.MeshBuilder.CreateCylinder(
            `joint_${joint.unitId}_${joint.jointId}_shaft`,
            {
                height: arrowLength * 0.7,
                diameter: arrowRadius * 2,
            },
            this.scene
        );

        // Position and orient
        shaft.position = origin.clone().add(direction.scale(arrowLength * 0.35));

        const defaultAxis = BABYLON.Vector3.Up();
        const rotationAxis = BABYLON.Vector3.Cross(defaultAxis, direction);
        const rotationAngle = Math.acos(BABYLON.Vector3.Dot(defaultAxis, direction));

        if (rotationAxis.length() > 0.001) {
            shaft.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
                rotationAxis.normalize(),
                rotationAngle
            );
        }

        // Green emissive material
        const material = new BABYLON.StandardMaterial(
            `joint_${joint.unitId}_${joint.jointId}_mat`,
            this.scene
        );
        material.emissiveColor = new BABYLON.Color3(0, 1, 0); // Green
        material.disableLighting = true;
        shaft.material = material;

        shaft.isVisible = this.isVisible;
        this.debugMeshes.push(shaft);

        // Arrow head (cone)
        const cone = BABYLON.MeshBuilder.CreateCylinder(
            `joint_${joint.unitId}_${joint.jointId}_cone`,
            {
                height: arrowLength * 0.3,
                diameterTop: 0,
                diameterBottom: arrowRadius * 4,
            },
            this.scene
        );

        cone.position = origin.clone().add(direction.scale(arrowLength * 0.85));
        cone.rotationQuaternion = shaft.rotationQuaternion?.clone() ?? null;
        cone.material = material;
        cone.isVisible = this.isVisible;
        this.debugMeshes.push(cone);

        // Small sphere at origin
        const marker = BABYLON.MeshBuilder.CreateSphere(
            `joint_${joint.unitId}_${joint.jointId}_marker`,
            { diameter: 0.015 },
            this.scene
        );
        marker.position = origin.clone();
        marker.material = material;
        marker.isVisible = this.isVisible;
        this.debugMeshes.push(marker);
    }
}
