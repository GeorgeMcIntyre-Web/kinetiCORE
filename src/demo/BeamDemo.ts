import { Vector3, Scene, Color3, MeshBuilder } from "@babylonjs/core";
import { FEASceneManager } from "../fea/feaSceneManager";
import { IsotropicMaterial } from "../fea/materials/isotropicMaterial";
import { BeamSection } from "../fea/types";

export class BeamDemo {
    static setupCantilever(scene: Scene) {
        const manager = FEASceneManager.getInstance();
        manager.initialize(scene);
        manager.clear();

        // 1. Define Properties
        const steel = IsotropicMaterial.Steel();
        const section: BeamSection = {
            name: "I-Beam",
            A: 0.005, // m^2
            Iy: 0.0001, // m^4
            Iz: 0.00005, // m^4
            J: 0.000001, // m^4
            height: 0.2,
            width: 0.1
        };

        // 2. Create Beam
        const start = new Vector3(0, 2, 0);
        const end = new Vector3(6, 2, 0);
        manager.createBeam(start, end, 20, steel, section);

        // 3. Apply Boundary Conditions (Fixed at start)
        // Node 0 is at start
        manager.applyRestraint(0, [true, true, true, true, true, true]);

        // 4. Apply Load (Tip load at end)
        // Last node
        const lastNodeId = manager.nodes.length - 1;
        manager.applyLoad(lastNodeId, [0, -50000, 0, 0, 0, 0]); // 50kN down

        // 5. Create Analytical Overlay (Red Line)
        // Deflection v = -P*x^2*(3L-x) / (6EI)
        const P = 50000;
        const L = 6;
        const E = steel.E;
        const I = section.Iz; // Bending about Z

        const path = [];
        for (let i = 0; i <= 100; i++) {
            const x = (i / 100) * L;
            const v = -(P * x * x * (3 * L - x)) / (6 * E * I);
            path.push(new Vector3(x, 2 + v, 0));
        }

        const analyticalLine = MeshBuilder.CreateLines("analytical", { points: path }, scene);
        analyticalLine.color = Color3.Red();

        // 6. Solve
        manager.solveStatic();
    }
}
