import type { FEANode } from '../types';
// import * as numeric from 'numeric';  // Unused in current MVP

// Placeholder type for FrameElement3D (not yet implemented)
interface FrameElement3D {
    node1: FEANode;
    node2: FEANode;
    getMassMatrix(): number[][];
}

export class MassAssembler {
    public static assembleGlobalMassMatrix(
        nodes: FEANode[],
        elements: FrameElement3D[]
    ): number[][] {
        const dofPerNode = 6;
        const totalDof = nodes.length * dofPerNode;

        // Initialize sparse matrix (using array of arrays for MVP)
        const M: number[][] = Array(totalDof).fill(0).map(() => Array(totalDof).fill(0));

        for (const element of elements) {
            const mLocal = element.getMassMatrix(); // Need to implement this in FrameElement3D
            const nodeIndices = [element.node1.id, element.node2.id]; // Assuming IDs are indices for now

            // Scatter local M to global M
            for (let i = 0; i < 12; i++) {
                const globalRow = this.mapLocalToGlobal(i, nodeIndices, dofPerNode);
                for (let j = 0; j < 12; j++) {
                    const globalCol = this.mapLocalToGlobal(j, nodeIndices, dofPerNode);
                    M[globalRow][globalCol] += mLocal[i][j];
                }
            }
        }

        return M;
    }

    private static mapLocalToGlobal(localIndex: number, nodeIndices: number[], dofPerNode: number): number {
        const localNodeIndex = Math.floor(localIndex / dofPerNode);
        const dofIndex = localIndex % dofPerNode;
        return nodeIndices[localNodeIndex] * dofPerNode + dofIndex;
    }
}
