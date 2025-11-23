import * as numeric from "numeric";
import { FEANode, FEAElement, FEAResult } from "../types";
import { StiffnessAssembler } from "./stiffnessAssembler";

export class StaticSolver {
    static solve(nodes: FEANode[], elements: FEAElement[]): FEAResult {
        const numDof = nodes.length * 6;
        const K = StiffnessAssembler.assemble(nodes, elements);
        const F = Array(numDof).fill(0);

        // Assemble Force Vector
        nodes.forEach(node => {
            if (node.loads) {
                for (let i = 0; i < 6; i++) {
                    F[node.dofIndices[i]] += node.loads[i];
                }
            }
        });

        // Apply Boundary Conditions (Penalty Method)
        // A large number, but not too large to cause precision issues
        const penalty = 1e15;
        nodes.forEach(node => {
            if (node.restraints) {
                for (let i = 0; i < 6; i++) {
                    if (node.restraints[i]) {
                        const dofIndex = node.dofIndices[i];
                        K[dofIndex][dofIndex] += penalty;
                        F[dofIndex] = 0; // Enforce zero displacement
                    }
                }
            }
        });

        // Solve K * u = F
        // @ts-ignore
        const u = numeric.solve(K, F);

        // Map results back to nodes
        const nodeDisplacements = new Map<number, number[]>();
        nodes.forEach(node => {
            const disp = [];
            for (let i = 0; i < 6; i++) {
                disp.push(u[node.dofIndices[i]]);
            }
            nodeDisplacements.set(node.id, disp);
        });

        // Calculate element forces (optional for MVP, but good for visualization)
        const elementForces = new Map<number, number[]>();

        return {
            nodeDisplacements,
            elementForces
        };
    }
}
