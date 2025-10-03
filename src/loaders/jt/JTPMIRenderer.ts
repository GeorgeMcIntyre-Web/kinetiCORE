/**
 * JT PMI (Product Manufacturing Information) Renderer
 * Renders annotations, dimensions, and tolerances as 3D overlays
 */

import * as BABYLON from '@babylonjs/core';
import { PMIData } from './types';

export class JTPMIRenderer {
    /**
     * Create 3D overlay for PMI annotation
     */
    createPMIOverlay(pmi: PMIData, scene: BABYLON.Scene): BABYLON.Mesh {
        // Create 2D plane for PMI text
        const plane = BABYLON.MeshBuilder.CreatePlane(
            "pmi_" + pmi.id,
            { size: 2 },
            scene
        );

        // Billboard mode to face camera
        plane.billboardMode = BABYLON.TransformNode.BILLBOARDMODE_ALL;

        // Position at attachment point
        plane.position = pmi.geometry.attachmentPoints[0];

        // Create dynamic texture for text
        const texture = new BABYLON.DynamicTexture(
            "pmiTexture_" + pmi.id,
            { width: 256, height: 64 },
            scene
        );

        const context = texture.getContext();
        context.font = "24px Arial";
        context.fillStyle = pmi.color.toHexString();
        context.fillText(pmi.text, 10, 32);
        texture.update();

        const material = new BABYLON.StandardMaterial("pmiMat_" + pmi.id, scene);
        material.diffuseTexture = texture;
        material.emissiveColor = BABYLON.Color3.White();
        material.disableLighting = true;
        plane.material = material;

        // Create leader lines
        pmi.geometry.leaders.forEach((leader, idx) => {
            const line = BABYLON.MeshBuilder.CreateLines(
                `leader_${pmi.id}_${idx}`,
                { points: [leader.start, leader.end] },
                scene
            );
            (line as any).color = pmi.color;
            line.parent = plane;
        });

        return plane;
    }

    /**
     * Create all PMI overlays for a set of annotations
     */
    createAllPMIOverlays(pmiData: PMIData[], scene: BABYLON.Scene): BABYLON.Mesh[] {
        return pmiData.map(pmi => this.createPMIOverlay(pmi, scene));
    }

    /**
     * Toggle visibility of PMI overlays
     */
    togglePMIVisibility(pmiMeshes: BABYLON.Mesh[], visible: boolean): void {
        pmiMeshes.forEach(mesh => {
            mesh.isVisible = visible;
        });
    }

    /**
     * Filter PMI by type
     */
    filterPMIByType(
        pmiData: PMIData[],
        types: PMIData['type'][]
    ): PMIData[] {
        return pmiData.filter(pmi => types.includes(pmi.type));
    }
}
