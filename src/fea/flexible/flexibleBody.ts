import type { ReducedModel } from './craigBamptonReducer';
import { Vector3 } from '@babylonjs/core';

export class FlexibleBody {
    public name: string;
    public reducedModel: ReducedModel;

    // State Vectors (Reduced Coordinates)
    // Size = numBoundaryDofs + numFixedInterfaceModes
    public q: number[];      // Displacement
    public q_dot: number[];  // Velocity
    public q_ddot: number[]; // Acceleration

    // Physical Mapping
    public originalNodePositions: Vector3[]; // Initial positions of all nodes
    public originalIndices: number[] = []; // Mapping from local node index to global system if needed

    constructor(name: string, reducedModel: ReducedModel, originalNodePositions: Vector3[]) {
        this.name = name;
        this.reducedModel = reducedModel;
        this.originalNodePositions = originalNodePositions;

        const numDofs = reducedModel.M_cb.length;
        this.q = new Array(numDofs).fill(0);
        this.q_dot = new Array(numDofs).fill(0);
        this.q_ddot = new Array(numDofs).fill(0);
    }

    /**
     * Computes the full physical displacement vector (u) from current reduced coordinates (q).
     * u = Phi_cb * q
     */
    public getPhysicalDisplacements(): number[] {
        const u = new Array(this.reducedModel.Phi_cb.length).fill(0);
        const Phi = this.reducedModel.Phi_cb;
        const q = this.q;

        for (let i = 0; i < u.length; i++) {
            let sum = 0;
            for (let j = 0; j < q.length; j++) {
                sum += Phi[i][j] * q[j];
            }
            u[i] = sum;
        }
        return u;
    }

    /**
     * Gets the displacement for a specific node.
     */
    public getNodeDisplacement(nodeIndex: number): Vector3 {
        const u = this.getPhysicalDisplacements();
        const dofStart = nodeIndex * 6;
        return new Vector3(u[dofStart], u[dofStart + 1], u[dofStart + 2]);
    }

    public getNumBoundaryDofs(): number {
        return this.reducedModel.boundaryDofs.length;
    }

    public getNumModes(): number {
        return this.reducedModel.M_cb.length - this.getNumBoundaryDofs();
    }
}
