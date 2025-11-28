import { FlexibleBody } from '../flexible/flexibleBody';
import { FlexIntegrator } from '../flexible/flexIntegrator';
import { FlexDeformationVisualizer } from '../visualization/flexDeformationVisualizer';
import { FlexRapierBridge } from '../flexible/flexRapierBridge';
import { Scene } from '@babylonjs/core';

export class CoSimulationManager {
    private static instance: CoSimulationManager;
    private bodies: FlexibleBody[] = [];
    private integrator: FlexIntegrator;
    private visualizer: FlexDeformationVisualizer | null = null;
    private isRunning: boolean = false;

    private constructor() {
        this.integrator = new FlexIntegrator();
    }

    public static getInstance(): CoSimulationManager {
        if (!CoSimulationManager.instance) {
            CoSimulationManager.instance = new CoSimulationManager();
        }
        return CoSimulationManager.instance;
    }

    public initialize(scene: Scene) {
        this.visualizer = new FlexDeformationVisualizer(scene);
    }

    public addBody(body: FlexibleBody) {
        this.bodies.push(body);
        this.visualizer?.registerBody(body);
    }

    public start() {
        this.isRunning = true;
        this.loop();
    }

    public stop() {
        this.isRunning = false;
    }

    public reset() {
        this.bodies = [];
        this.visualizer?.clear();
        this.isRunning = false;
    }

    private loop = () => {
        if (!this.isRunning) return;

        const dt = 0.016; // Fixed time step for now (60 FPS)

        // 1. Step Rigid Physics (Rapier) - Handled by main game loop usually, 
        // but here we might need to synchronize or sub-step.
        // For this MVP, we assume Rapier is running in parallel or we just read its state.

        // 2. Step Flexible Dynamics
        for (const body of this.bodies) {
            // Get external forces from Rapier (Joints, Contacts)
            const F_ext = FlexRapierBridge.getJointForces(body);

            this.integrator.step(body, dt, F_ext);
        }

        // 3. Update Visualization
        this.visualizer?.update();

        requestAnimationFrame(this.loop);
    }
}
