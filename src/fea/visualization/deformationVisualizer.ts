import { Scene, Mesh, Vector3, MeshBuilder, StandardMaterial, Color3, LinesMesh } from "@babylonjs/core";
import { FEANode, FEAElement, FEAResult } from "../types";
import { StressColorMapper } from "./stressColorMapper";

export class DeformationVisualizer {
    private scene: Scene;
    private deformedMesh: Mesh | null = null;
    private wireframeMesh: LinesMesh | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    update(nodes: FEANode[], elements: FEAElement[], result: FEAResult, scaleFactor: number = 1.0) {
        if (this.deformedMesh) {
            this.deformedMesh.dispose();
        }
        if (this.wireframeMesh) {
            this.wireframeMesh.dispose();
        }

        // 1. Create Deformed Geometry
        // For beams, we can use Tube or ExtrudeShape
        // For MVP, we'll use lines for wireframe and tubes for solid

        const path: Vector3[] = [];
        const colors: Color4[] = [];

        // Collect all deformed positions
        const deformedPositions = new Map<number, Vector3>();
        let maxDisp = 0;

        nodes.forEach(node => {
            const disp = result.nodeDisplacements.get(node.id);
            if (disp) {
                const d = new Vector3(disp[0], disp[1], disp[2]);
                maxDisp = Math.max(maxDisp, d.length());
                deformedPositions.set(node.id, node.position.add(d.scale(scaleFactor)));
            } else {
                deformedPositions.set(node.id, node.position);
            }
        });

        // Build Tube Path
        // Assuming sequential elements for now (valid for single beam)
        // A more robust approach would handle disjoint elements

        const tubePaths: Vector3[][] = [];

        elements.forEach(el => {
            const p1 = deformedPositions.get(el.nodeIds[0]);
            const p2 = deformedPositions.get(el.nodeIds[1]);
            if (p1 && p2) {
                tubePaths.push([p1, p2]);
            }
        });

        // Create Tube Mesh
        // We create one tube per element to handle sharp corners if needed, 
        // or merge them if continuous. For MVP, individual tubes.

        const meshes: Mesh[] = [];
        elements.forEach(el => {
            const p1 = deformedPositions.get(el.nodeIds[0]);
            const p2 = deformedPositions.get(el.nodeIds[1]);
            if (p1 && p2) {
                const tube = MeshBuilder.CreateTube("el_" + el.id, {
                    path: [p1, p2],
                    radius: 0.05, // Should come from section
                    updatable: true
                }, this.scene);

                // Color based on displacement or stress
                const mat = new StandardMaterial("mat_" + el.id, this.scene);
                // Simple color mapping based on displacement magnitude relative to max
                const d1 = result.nodeDisplacements.get(el.nodeIds[0]) || [0, 0, 0];
                const mag = new Vector3(d1[0], d1[1], d1[2]).length();
                mat.diffuseColor = StressColorMapper.getViridisColor(mag, 0, maxDisp);
                tube.material = mat;

                meshes.push(tube);
            }
        });

        // Merge for performance? For demo, individual is fine.
        // this.deformedMesh = Mesh.MergeMeshes(meshes, true, true, undefined, false, true);
    }

    animateMode(nodes: FEANode[], elements: FEAElement[], eigenvectors: Map<number, number[][]>, modeIndex: number, amplitude: number, time: number) {
        // Sinusoidal animation
        const factor = Math.sin(time * 5) * amplitude;

        // Construct a temporary result object
        const tempResult: FEAResult = {
            nodeDisplacements: new Map(),
            elementForces: new Map()
        };

        const modeDisps = eigenvectors.get(modeIndex);
        if (modeDisps) {
            nodes.forEach((node, i) => {
                tempResult.nodeDisplacements.set(node.id, modeDisps[i]);
            });
            this.update(nodes, elements, tempResult, factor);
        }
    }
}
