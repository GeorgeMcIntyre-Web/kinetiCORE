import { FEAElement } from "../types";

export class TetrahedronElement implements FEAElement {
    constructor(
        public id: number,
        public nodeIds: number[],
        public materialId: string,
        public sectionId: string
    ) { }

    getLocalStiffnessMatrix(): number[][] {
        throw new Error("Method not implemented.");
    }
    getGlobalStiffnessMatrix(): number[][] {
        throw new Error("Method not implemented.");
    }
    getRotationMatrix(): number[][] {
        throw new Error("Method not implemented.");
    }
}
