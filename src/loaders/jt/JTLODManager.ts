/**
 * JT LOD (Level of Detail) Manager
 * Handles progressive loading and distance-based LOD switching
 */

import * as BABYLON from '@babylonjs/core';
import { JTPart } from './types';

export class JTLODManager {
    private lodCache = new Map<string, BABYLON.Mesh>();
    private scene: BABYLON.Scene;

    constructor(scene: BABYLON.Scene) {
        this.scene = scene;
    }

    /**
     * Load mesh progressively with increasing quality
     */
    async loadProgressive(part: JTPart): Promise<BABYLON.Mesh> {
        // Load lowest quality immediately for responsiveness
        const lod3 = await this.loadLODLevel(part, 3);
        lod3.isVisible = true;

        // Stream higher quality levels in background
        setTimeout(async () => {
            const lod2 = await this.loadLODLevel(part, 2);
            this.swapMesh(lod3, lod2);
            lod3.dispose();

            setTimeout(async () => {
                const lod0 = await this.loadLODLevel(part, 0);
                this.swapMesh(lod2, lod0);
                lod2.dispose();
            }, 100);
        }, 100);

        return lod3;
    }

    /**
     * Load specific LOD level for a part
     */
    private async loadLODLevel(part: JTPart, level: number): Promise<BABYLON.Mesh> {
        const cacheKey = `${part.id}_lod${level}`;

        // Check cache
        if (this.lodCache.has(cacheKey)) {
            return this.lodCache.get(cacheKey)!.clone(`${part.name}_lod${level}_clone`);
        }

        // Create new mesh from LOD data
        const lodData = part.getLOD(level);
        const mesh = new BABYLON.Mesh(`${part.name}_lod${level}`, this.scene);

        const vertexData = new BABYLON.VertexData();
        vertexData.positions = lodData.vertices;
        vertexData.indices = lodData.indices;

        if (lodData.normals) {
            vertexData.normals = lodData.normals;
        } else {
            const normals: number[] = [];
            BABYLON.VertexData.ComputeNormals(
                vertexData.positions,
                vertexData.indices,
                normals
            );
            vertexData.normals = normals;
        }

        if (lodData.uvs) {
            vertexData.uvs = lodData.uvs;
        }

        vertexData.applyToMesh(mesh);

        mesh.metadata = {
            currentLOD: level,
            lodLevels: part.lodCount
        };

        this.lodCache.set(cacheKey, mesh);
        return mesh;
    }

    /**
     * Swap one mesh for another, preserving transform
     */
    private swapMesh(oldMesh: BABYLON.Mesh, newMesh: BABYLON.Mesh): void {
        newMesh.position = oldMesh.position.clone();
        newMesh.rotation = oldMesh.rotation.clone();
        newMesh.scaling = oldMesh.scaling.clone();
        newMesh.parent = oldMesh.parent;
        newMesh.material = oldMesh.material;
        newMesh.isVisible = true;
    }

    /**
     * Update LOD levels based on camera distance
     */
    updateLODLevels(camera: BABYLON.Camera, meshes: BABYLON.Mesh[]): void {
        meshes.forEach(mesh => {
            if (!mesh.metadata?.lodLevels) return;

            const distance = BABYLON.Vector3.Distance(
                camera.position,
                mesh.getBoundingInfo().boundingBox.center
            );

            const desiredLOD = this.selectLOD(distance, mesh.metadata.lodLevels);

            if (mesh.metadata.currentLOD !== desiredLOD) {
                // LOD switching would be implemented here
                // For now, just update metadata
                mesh.metadata.currentLOD = desiredLOD;
            }
        });
    }

    /**
     * Select appropriate LOD level based on distance
     */
    private selectLOD(distance: number, availableLODs: number): number {
        // Typical thresholds for JT visualization
        if (distance < 10) return 0;      // Full quality
        if (distance < 50) return 1;      // High quality
        if (distance < 200) return 2;     // Medium quality
        return Math.min(3, availableLODs - 1); // Low quality/bounding box
    }

    /**
     * Clear LOD cache
     */
    clearCache(): void {
        this.lodCache.forEach(mesh => mesh.dispose());
        this.lodCache.clear();
    }
}
