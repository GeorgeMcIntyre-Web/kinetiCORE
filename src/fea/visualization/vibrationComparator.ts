import { Scene, Vector3, Color3, Mesh, LinesMesh } from '@babylonjs/core';
import { FlexibleBody } from '../flexible/flexibleBody';

interface TrajectoryPoint {
    position: Vector3;
    timestamp: number;
}

export class VibrationComparator {
    private scene: Scene;
    private rigidTrajectory: TrajectoryPoint[] = [];
    private flexTrajectory: TrajectoryPoint[] = [];
    private maxPoints: number = 500; // Keep last 500 points
    private rigidMesh: LinesMesh | null = null;
    private flexMesh: LinesMesh | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Record a rigid body trajectory point
     */
    public recordRigidPoint(position: Vector3) {
        this.rigidTrajectory.push({
            position: position.clone(),
            timestamp: performance.now()
        });

        if (this.rigidTrajectory.length > this.maxPoints) {
            this.rigidTrajectory.shift();
        }

        this.updateRigidMesh();
    }

    /**
     * Record a flexible body end-effector trajectory point
     */
    public recordFlexPoint(body: FlexibleBody, tipNodeIndex: number) {
        // Get deformed position of tip node
        const originalPos = body.originalNodePositions[tipNodeIndex];

        // Compute deformed position using modal displacement
        const disp = body.getNodeDisplacement(tipNodeIndex);
        const deformedPos = originalPos.clone().add(disp);

        this.flexTrajectory.push({
            position: deformedPos,
            timestamp: performance.now()
        });

        if (this.flexTrajectory.length > this.maxPoints) {
            this.flexTrajectory.shift();
        }

        this.updateFlexMesh();
    }

    private updateRigidMesh() {
        if (this.rigidTrajectory.length > 1) {
            const points = this.rigidTrajectory.map(p => p.position);
            this.rigidMesh?.dispose();

            this.rigidMesh = Mesh.CreateLines(
                "rigidTraj",
                points,
                this.scene,
                false,
                null
            ) as LinesMesh;

            this.rigidMesh.color = Color3.Blue();
        }
    }

    private updateFlexMesh() {
        if (this.flexTrajectory.length > 1) {
            const points = this.flexTrajectory.map(p => p.position);
            this.flexMesh?.dispose();

            this.flexMesh = Mesh.CreateLines(
                "flexTraj",
                points,
                this.scene,
                false,
                null
            ) as LinesMesh;

            this.flexMesh.color = Color3.Red();
        }
    }

    /**
     * Clear all trajectory data
     */
    public clear() {
        this.rigidTrajectory = [];
        this.flexTrajectory = [];
        this.rigidMesh?.dispose();
        this.flexMesh?.dispose();
        this.rigidMesh = null;
        this.flexMesh = null;
    }

    /**
     * Toggle visibility of trajectories
     */
    public setVisible(visible: boolean) {
        if (this.rigidMesh) this.rigidMesh.setEnabled(visible);
        if (this.flexMesh) this.flexMesh.setEnabled(visible);
    }

    /**
     * Get current deviation between rigid and flexible trajectories
     */
    public getCurrentDeviation(): number {
        if (this.rigidTrajectory.length === 0 || this.flexTrajectory.length === 0) {
            return 0;
        }

        const rigidLast = this.rigidTrajectory[this.rigidTrajectory.length - 1];
        const flexLast = this.flexTrajectory[this.flexTrajectory.length - 1];

        return Vector3.Distance(rigidLast.position, flexLast.position);
    }
}
