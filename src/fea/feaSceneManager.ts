import { Scene, Vector3 } from "@babylonjs/core";
import { FEANode, FEAElement, MaterialProperties, BeamSection, FEAResult } from "./types";
import { StaticSolver } from "./solver/staticSolver";
import { ModalSolver } from "./solver/modalSolver";
import { DeformationVisualizer } from "./visualization/deformationVisualizer";
import { BeamMesher } from "./meshing/beamMesher";

export class FEASceneManager {
    private static instance: FEASceneManager;
    public scene: Scene | null = null;

    public nodes: FEANode[] = [];
    public elements: FEAElement[] = [];
    public materials: MaterialProperties[] = [];
    public sections: BeamSection[] = [];

    public result: FEAResult | null = null;
    public visualizer: DeformationVisualizer | null = null;

    private constructor() { }

    public static getInstance(): FEASceneManager {
        if (!FEASceneManager.instance) {
            FEASceneManager.instance = new FEASceneManager();
        }
        return FEASceneManager.instance;
    }

    public initialize(scene: Scene) {
        this.scene = scene;
        this.visualizer = new DeformationVisualizer(scene);
    }

    public clear() {
        this.nodes = [];
        this.elements = [];
        this.result = null;
        // Clear visualization
        if (this.visualizer) {
            this.visualizer.update([], [], { nodeDisplacements: new Map(), elementForces: new Map() });
        }
    }

    public createBeam(start: Vector3, end: Vector3, numElements: number, material: MaterialProperties, section: BeamSection) {
        const mesh = BeamMesher.meshLine(start, end, numElements, material, section, this.nodes.length);
        this.nodes.push(...mesh.nodes);
        this.elements.push(...mesh.elements);

        // Add material and section if not present
        if (!this.materials.includes(material)) this.materials.push(material);
        if (!this.sections.includes(section)) this.sections.push(section);
    }

    public applyLoad(nodeId: number, load: number[]) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            for (let i = 0; i < 6; i++) {
                node.loads[i] += load[i];
            }
        }
    }

    public applyRestraint(nodeId: number, restraint: boolean[]) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            node.restraints = restraint;
        }
    }

    public solveStatic() {
        console.time("FEA Static Solve");
        this.result = StaticSolver.solve(this.nodes, this.elements);
        console.timeEnd("FEA Static Solve");

        if (this.visualizer && this.result) {
            this.visualizer.update(this.nodes, this.elements, this.result, 100); // Default exaggeration
        }
    }

    public solveModal(numModes: number = 6) {
        console.time("FEA Modal Solve");
        const modalResult = ModalSolver.solve(this.nodes, this.elements, numModes);
        console.timeEnd("FEA Modal Solve");

        // Merge results? Or keep separate? For now, just store it.
        // Ideally we'd have a ResultManager
        if (this.result) {
            this.result.eigenvalues = modalResult.eigenvalues;
            this.result.eigenvectors = modalResult.eigenvectors;
        } else {
            this.result = modalResult;
        }
    }
}
