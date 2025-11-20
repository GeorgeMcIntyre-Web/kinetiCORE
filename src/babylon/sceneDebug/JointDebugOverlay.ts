import * as BABYLON from '@babylonjs/core';
import type { DetectedToolJoint } from '../sceneAnalysis/ToolingTypes';

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
        const axis = joint.axisWorld;
        const origin = joint.originWorld;

        // Axis line (small cylinder)
        const axisLength = 0.1; // 10cm
        const axisRadius = 0.01; // 1cm

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

        // Blue emissive material
        const material = new BABYLON.StandardMaterial(
            `joint_${joint.unitId}_${joint.jointId}_mat`,
            this.scene
        );
        material.emissiveColor = new BABYLON.Color3(0, 0.5, 1); // Blue
        material.disableLighting = true;
        axisCylinder.material = material;

        axisCylinder.isVisible = this.isVisible;
        this.debugMeshes.push(axisCylinder);

        // Optional: Small ring/torus at origin (simplified - just a sphere for now)
        const marker = BABYLON.MeshBuilder.CreateSphere(
            `joint_${joint.unitId}_${joint.jointId}_marker`,
            { diameter: 0.02 },
            this.scene
        );
        marker.position = origin.clone();
        marker.material = material;
        marker.isVisible = this.isVisible;
        this.debugMeshes.push(marker);
    }

    private createPrismaticGlyph(joint: DetectedToolJoint): void {
        const direction = joint.axisWorld.normalize();
        const origin = joint.originWorld;

        // Arrow length based on travel distance estimate
        const arrowLength = Math.min(0.15, Math.max(0.05, joint.travelWorld));
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
