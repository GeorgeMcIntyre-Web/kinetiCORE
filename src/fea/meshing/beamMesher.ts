import { Vector3 } from "@babylonjs/core";
import { FEANode, FEAElement, MaterialProperties, BeamSection } from "../types";
import { FrameElement3D } from "../elements/frame3d";

export class BeamMesher {
    static meshLine(
        start: Vector3,
        end: Vector3,
        numElements: number,
        material: MaterialProperties,
        section: BeamSection,
        startId: number = 0
    ): { nodes: FEANode[], elements: FEAElement[] } {
        const nodes: FEANode[] = [];
        const elements: FEAElement[] = [];

        const step = end.subtract(start).scale(1 / numElements);
        let currentId = startId;

        // Create Nodes
        for (let i = 0; i <= numElements; i++) {
            const position = start.add(step.scale(i));
            nodes.push({
                id: currentId,
                position: position,
                dofIndices: [
                    currentId * 6, currentId * 6 + 1, currentId * 6 + 2,
                    currentId * 6 + 3, currentId * 6 + 4, currentId * 6 + 5
                ],
                restraints: [false, false, false, false, false, false],
                loads: [0, 0, 0, 0, 0, 0]
            });
            currentId++;
        }

        // Create Elements
        for (let i = 0; i < numElements; i++) {
            const n1 = nodes[i];
            const n2 = nodes[i + 1];
            elements.push(new FrameElement3D(i, [n1, n2], material, section));
        }

        return { nodes, elements };
    }
}
