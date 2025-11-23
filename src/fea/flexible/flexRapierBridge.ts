import { FlexibleBody } from './flexibleBody';
import * as numeric from 'numeric';

export class FlexRapierBridge {
    /**
     * Updates the Rapier rigid body position based on the flexible body's deformation.
     * In Floating Frame of Reference, we:
     * 1. Rapier handles the large rigid body motion
     * 2. FEA handles small deformations relative to that frame
     * 3. We update visualization, not colliders (for performance)
     */
    public static updateColliders(_body: FlexibleBody) {
        // For MVP: We use simplified approach where Rapier handles rigid motion
        // and flexible deformations are visual only.
        // In a full implementation with deformable contacts:
        // - Use Rapier's trimesh colliders
        // - Update vertices based on modal displacement
        // - Mark collider as modified
        // 
        // This is expensive (O(n) vertices * frame rate), so we skip for 60+ FPS goal.
    }

    /**
     * Extracts joint reaction forces from Rapier and maps them to the FEA nodes.
     * For co-simulation, we need to:
     * 1. Query Rapier constraints (joints) for reaction forces
     * 2. Map from Rapier world space to FEA boundary DOFs
     * 3. Transform forces to reduced coordinates (modal space)
     */
    public static getJointForces(body: FlexibleBody, rapierId?: number): number[] {
        const numDofs = body.reducedModel.M_cb.length;
        const F_reduced = new Array(numDofs).fill(0);

        // For MVP demo: Apply synthetic loads for visualization
        // In production: Query actual Rapier joint constraints

        if (!rapierId) {
            // Demo mode: Apply sinusoidal tip load
            const time = performance.now() / 1000;
            const tipForceZ = Math.sin(time * 2 * Math.PI) * 50; // 50N @ 1 Hz

            // Assume last boundary DOF corresponds to tip Z-translation
            // This mapping needs to be established during reduction
            const numBoundaryDofs = body.reducedModel.boundaryDofs.length;
            if (numBoundaryDofs > 2) {
                F_reduced[2] = tipForceZ; // Z-force on first boundary node
            }

            return F_reduced;
        }

        // Production path: Extract from Rapier
        // const world = usePhysicsStore.getState().world;
        // const joints = world.joints();
        // for (let joint of joints) {
        //     if (joint.body1() === rapierId || joint.body2() === rapierId) {
        //         const reactionForce = joint.reactionForce();
        //         const reactionTorque = joint.reactionTorque();
        //         // Map to boundary DOFs, then transform to reduced space
        //     }
        // }

        return F_reduced;
    }

    /**
     * Computes the external force vector in reduced coordinates from full-space loads.
     * F_reduced = Phi_cb^T * F_full
     */
    public static transformForcesToReduced(
        F_full: number[],
        Phi_cb: number[][]
    ): number[] {
        const Phi_cb_T = numeric.transpose(Phi_cb);
        const F_reduced = numeric.dot(Phi_cb_T, F_full) as number[];
        return F_reduced;
    }
}
