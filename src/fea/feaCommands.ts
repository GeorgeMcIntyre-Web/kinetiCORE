import { Vector3 } from "@babylonjs/core";
import { FEASceneManager } from "./feaSceneManager";
import { MaterialProperties, BeamSection } from "./types";

export interface Command {
    execute(): void;
    undo(): void;
}

export class CreateBeamCommand implements Command {
    private start: Vector3;
    private end: Vector3;
    private numElements: number;
    private material: MaterialProperties;
    private section: BeamSection;
    private addedNodeCount: number = 0;
    private addedElementCount: number = 0;

    constructor(start: Vector3, end: Vector3, numElements: number, material: MaterialProperties, section: BeamSection) {
        this.start = start;
        this.end = end;
        this.numElements = numElements;
        this.material = material;
        this.section = section;
    }

    execute() {
        const manager = FEASceneManager.getInstance();
        const initialNodeCount = manager.nodes.length;
        const initialElementCount = manager.elements.length;

        manager.createBeam(this.start, this.end, this.numElements, this.material, this.section);

        this.addedNodeCount = manager.nodes.length - initialNodeCount;
        this.addedElementCount = manager.elements.length - initialElementCount;
    }

    undo() {
        const manager = FEASceneManager.getInstance();
        // Remove the last N nodes and elements
        // This is a simplified undo. Robust undo needs ID tracking.
        manager.nodes.splice(manager.nodes.length - this.addedNodeCount, this.addedNodeCount);
        manager.elements.splice(manager.elements.length - this.addedElementCount, this.addedElementCount);

        // Clear results as mesh changed
        manager.result = null;
        if (manager.visualizer) {
            manager.visualizer.update([], [], { nodeDisplacements: new Map(), elementForces: new Map() });
        }
    }
}

export class ApplyLoadCommand implements Command {
    private nodeId: number;
    private load: number[];
    private previousLoad: number[];

    constructor(nodeId: number, load: number[]) {
        this.nodeId = nodeId;
        this.load = load;
        this.previousLoad = [0, 0, 0, 0, 0, 0];
    }

    execute() {
        const manager = FEASceneManager.getInstance();
        const node = manager.nodes.find(n => n.id === this.nodeId);
        if (node) {
            this.previousLoad = [...node.loads];
            manager.applyLoad(this.nodeId, this.load);
        }
    }

    undo() {
        const manager = FEASceneManager.getInstance();
        const node = manager.nodes.find(n => n.id === this.nodeId);
        if (node) {
            node.loads = [...this.previousLoad];
        }
    }
}

export class RunAnalysisCommand implements Command {
    execute() {
        FEASceneManager.getInstance().solveStatic();
    }

    undo() {
        // Undo analysis = clear results
        FEASceneManager.getInstance().result = null;
        // Update visualizer to clear
    }
}
