import * as numeric from "numeric";
import { FEANode, FEAElement, FEAResult } from "../types";
import { StiffnessAssembler } from "./stiffnessAssembler";

export class ModalSolver {
    static solve(nodes: FEANode[], elements: FEAElement[], numModes: number = 6): FEAResult {
        const numDof = nodes.length * 6;
        const K = StiffnessAssembler.assemble(nodes, elements);

        // Assemble Mass Matrix
        const M = Array(numDof).fill(0).map(() => Array(numDof).fill(0));
        elements.forEach(element => {
            if (element.getMassMatrix) {
                const m_local = element.getMassMatrix();
                const nodeIds = element.nodeIds;
                const globalIndices: number[] = [];
                nodeIds.forEach(nodeId => {
                    const node = nodes.find(n => n.id === nodeId);
                    if (node) {
                        globalIndices.push(...node.dofIndices);
                    }
                });

                for (let i = 0; i < 12; i++) {
                    for (let j = 0; j < 12; j++) {
                        const gi = globalIndices[i];
                        const gj = globalIndices[j];
                        if (gi !== undefined && gj !== undefined) {
                            M[gi][gj] += m_local[i][j];
                        }
                    }
                }
            }
        });

        // Apply Boundary Conditions (Reduction Method)
        // For modal analysis, we must remove constrained DOFs to avoid infinite frequencies
        const freeDofIndices: number[] = [];
        nodes.forEach(node => {
            for (let i = 0; i < 6; i++) {
                if (!node.restraints[i]) {
                    freeDofIndices.push(node.dofIndices[i]);
                }
            }
        });

        const nFree = freeDofIndices.length;
        const K_reduced = Array(nFree).fill(0).map(() => Array(nFree).fill(0));
        const M_reduced = Array(nFree).fill(0).map(() => Array(nFree).fill(0));

        for (let i = 0; i < nFree; i++) {
            for (let j = 0; j < nFree; j++) {
                K_reduced[i][j] = K[freeDofIndices[i]][freeDofIndices[j]];
                M_reduced[i][j] = M[freeDofIndices[i]][freeDofIndices[j]];
            }
        }

        // Solve Generalized Eigenvalue Problem: K*v = lambda*M*v
        // M is diagonal-ish, K is symmetric.
        // For small systems, we can compute M^-1 * K and find eigenvalues
        // Note: This is computationally expensive for large systems. 
        // For v1 demo (small DOF), this is acceptable.

        // Invert M (simplified, assuming non-singular M)
        // @ts-ignore
        const M_inv = numeric.inv(M_reduced);
        // @ts-ignore
        const A = numeric.dot(M_inv, K_reduced);

        // @ts-ignore
        const eig = numeric.eig(A);

        // Sort modes by frequency (ascending real part)
        const modes = [];
        for (let i = 0; i < nFree; i++) {
            modes.push({
                lambda: eig.lambda.x[i],
                vector: eig.E.x.map((row: any) => row[i]) // Extract column
            });
        }

        modes.sort((a, b) => a.lambda - b.lambda);

        // Map back to full DOF
        const eigenvectors = new Map<number, number[][]>();

        for (let m = 0; m < Math.min(numModes, nFree); m++) {
            const modeVector = Array(numDof).fill(0);
            for (let i = 0; i < nFree; i++) {
                modeVector[freeDofIndices[i]] = modes[m].vector[i];
            }

            // Store per node
            const nodeDisps = [];
            nodes.forEach(node => {
                const disp = [];
                for (let i = 0; i < 6; i++) {
                    disp.push(modeVector[node.dofIndices[i]]);
                }
                nodeDisps.push(disp);
            });
            eigenvectors.set(m, nodeDisps);
        }

        return {
            nodeDisplacements: new Map(), // Not a static result
            elementForces: new Map(),
            eigenvalues: modes.slice(0, numModes).map(m => m.lambda),
            eigenvectors: eigenvectors
        };
    }
}
