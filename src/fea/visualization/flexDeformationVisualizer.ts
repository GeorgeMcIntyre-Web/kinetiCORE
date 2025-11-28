import { Scene, Mesh, Vector3, StandardMaterial, Color3, MeshBuilder } from '@babylonjs/core';
import { FlexibleBody } from '../flexible/flexibleBody';

export class FlexDeformationVisualizer {
    private scene: Scene;
    private bodyMeshes: Map<string, Mesh> = new Map();

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public registerBody(body: FlexibleBody) {
        // Create a visual mesh for the flexible body
        // For MVP, we'll use a line system (tube) similar to the rigid beam, 
        // but we'll update its vertices based on modal superposition.

        // Actually, for "Flexible UR10e", we ideally want to deform the original GLTF mesh.
        // That requires skinning or vertex shader manipulation.
        // For this MVP, let's stick to the "Beam" visualization (Tubes) but make them flexible.

        const path = body.originalNodePositions;
        const mesh = MeshBuilder.CreateTube(body.name + "_visual", {
            path: path,
            radius: 0.05,
            updatable: true,
            sideOrientation: Mesh.DOUBLESIDE
        }, this.scene);

        const material = new StandardMaterial(body.name + "_mat", this.scene);
        material.diffuseColor = Color3.Red(); // Flexible bodies are RED
        mesh.material = material;

        this.bodyMeshes.set(body.name, mesh);
    }

    public update() {
        for (const [name, mesh] of this.bodyMeshes) {
            // Find the body
            const body = CoSimulationManager.getInstance()['bodies'].find(b => b.name === name);
            if (!body) continue;

            // Get current physical displacements
            // const u = body.getPhysicalDisplacements();  // Unused in current MVP

            // Update mesh vertices
            // This is a simplified approach: we update the "path" of the tube.
            // MeshBuilder.CreateTube with instance option is tricky for changing path length/topology,
            // but for small deformations we can update the path.

            const newPath: Vector3[] = [];
            for (let i = 0; i < body.originalNodePositions.length; i++) {
                const original = body.originalNodePositions[i];
                const disp = body.getNodeDisplacement(i);
                // Exaggeration
                const scale = 10.0;
                newPath.push(original.add(disp.scale(scale)));
            }

            // Update the tube
            MeshBuilder.CreateTube(body.name + "_visual", {
                path: newPath,
                instance: mesh
            });
        }
    }

    public clear() {
        for (const mesh of this.bodyMeshes.values()) {
            mesh.dispose();
        }
        this.bodyMeshes.clear();
    }
}
import { CoSimulationManager } from '../simulation/coSimulationManager';
