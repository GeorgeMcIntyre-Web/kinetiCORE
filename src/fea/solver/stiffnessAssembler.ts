import { FEAElement, FEANode } from "../types";

export class StiffnessAssembler {
    static assemble(nodes: FEANode[], elements: FEAElement[]): number[][] {
        const numDof = nodes.length * 6;
        const K = Array(numDof).fill(0).map(() => Array(numDof).fill(0));

        elements.forEach(element => {
            const k_global = element.getGlobalStiffnessMatrix();
            const nodeIds = element.nodeIds;

            // Map local indices to global indices
            const globalIndices: number[] = [];
            nodeIds.forEach(nodeId => {
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                    globalIndices.push(...node.dofIndices);
                }
            });

            // Add to global K
            for (let i = 0; i < 12; i++) {
                for (let j = 0; j < 12; j++) {
                    const gi = globalIndices[i];
                    const gj = globalIndices[j];
                    if (gi !== undefined && gj !== undefined) {
                        K[gi][gj] += k_global[i][j];
                    }
                }
            }
        });

        return K;
    }
}
