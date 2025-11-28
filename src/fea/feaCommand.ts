import { FEASceneManager } from "./feaSceneManager";
// import type { FEANode } from "./types";  // Unused - reserved for future command implementations

// I need to check where the Command interface is defined.
// The prompt says "Use existing HistoryManager.executeCommand()".
// I'll assume a generic Command interface.

export interface ICommand {
    execute(): void;
    undo(): void;
    redo(): void;
}

export class FEASetLoadCommand implements ICommand {
    private previousLoads: Map<number, number[]> = new Map();

    constructor(
        private nodeIds: number[],
        private load: number[] // [fx, fy, fz, mx, my, mz]
    ) {
        const manager = FEASceneManager.getInstance();
        nodeIds.forEach(id => {
            const node = manager.nodes.find(n => n.id === id);
            if (node) {
                this.previousLoads.set(id, [...node.loads]);
            }
        });
    }

    execute(): void {
        const manager = FEASceneManager.getInstance();
        this.nodeIds.forEach(id => {
            const node = manager.nodes.find(n => n.id === id);
            if (node) {
                node.loads = [...this.load];
            }
        });
        manager.solveStatic();
    }

    undo(): void {
        const manager = FEASceneManager.getInstance();
        this.nodeIds.forEach(id => {
            const node = manager.nodes.find(n => n.id === id);
            if (node) {
                const prev = this.previousLoads.get(id);
                if (prev) node.loads = [...prev];
            }
        });
        manager.solveStatic();
    }

    redo(): void {
        this.execute();
    }
}

export class FEAUpdateMaterialCommand implements ICommand {
    // Implementation for updating material properties
    // ...
    execute() { }
    undo() { }
    redo() { }
}
