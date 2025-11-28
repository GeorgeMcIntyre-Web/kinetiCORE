import { Scene, Vector3 } from '@babylonjs/core';
import { BeamMesher } from '../fea/meshing/beamMesher';
import { IsotropicMaterial } from '../fea/materials/isotropicMaterial';
import { BeamSection } from '../fea/types';
import { CraigBamptonReducer } from '../fea/flexible/craigBamptonReducer';
import { FlexibleBody } from '../fea/flexible/flexibleBody';
import { CoSimulationManager } from '../fea/simulation/coSimulationManager';
import { MassAssembler } from '../fea/solver/massAssembler';
import { StiffnessAssembler } from '../fea/solver/stiffnessAssembler';

export class FlexibleUR10eDemo {
    public static setup(scene: Scene) {
        console.log("Setting up Flexible UR10e Demo...");

        // 1. Define Material and Section
        const steel = IsotropicMaterial.Steel();
        const section: BeamSection = {
            name: "UR10e Link",
            A: 0.01,
            Iy: 0.0001,
            Iz: 0.0001,
            J: 0.0002
        };

        // 2. Create a Beam (representing a robot link)
        // Start: (0,0,0), End: (1,0,0)
        const start = new Vector3(0, 0, 0);
        const end = new Vector3(1, 0, 0);
        const { nodes, elements } = BeamMesher.meshLine(start, end, 10, steel, section);

        // 3. Assemble Full Matrices
        const K = StiffnessAssembler.assemble(nodes, elements);
        // NOTE: Type cast needed - FEAElement will be extended to FrameElement3D in future
        const M = MassAssembler.assembleGlobalMassMatrix(nodes, elements as any);

        // 4. Perform Craig-Bampton Reduction
        // Fix the start node (Index 0)
        const boundaryNodeIndices = [0];
        const reducedModel = CraigBamptonReducer.reduce(K, M, {
            boundaryNodeIndices: boundaryNodeIndices,
            numFixedInterfaceModes: 5
        });

        console.log("Reduction Complete. Frequencies:", reducedModel.frequencies);

        // 5. Create Flexible Body
        const originalPositions = nodes.map(n => n.position.clone());
        const flexBody = new FlexibleBody("Link1", reducedModel, originalPositions);

        // 6. Register with Co-Simulation Manager
        const manager = CoSimulationManager.getInstance();
        manager.initialize(scene);
        manager.addBody(flexBody);

        // 7. Start Simulation
        manager.start();

        console.log("Flexible UR10e Demo Started.");
    }
}
