/**
 * JT Memory Manager - Manages memory usage for large assemblies
 * Automatically evicts distant/low-priority meshes when memory budget exceeded
 */

import * as BABYLON from '@babylonjs/core';

export class JTMemoryManager {
    private memoryBudget = 1.5 * 1024 * 1024 * 1024; // 1.5GB (safe browser limit)
    private currentUsage = 0;
    private meshes: BABYLON.Mesh[] = [];

    /**
     * Track a mesh and its memory usage
     */
    trackMesh(mesh: BABYLON.Mesh): void {
        const size = this.estimateMemoryUsage(mesh);

        mesh.metadata = {
            ...mesh.metadata,
            memorySize: size
        };

        this.meshes.push(mesh);
        this.currentUsage += size;

        if (this.currentUsage > this.memoryBudget) {
            this.evictLowPriorityMeshes();
        }
    }

    /**
     * Remove mesh from tracking
     */
    untrackMesh(mesh: BABYLON.Mesh): void {
        const index = this.meshes.indexOf(mesh);
        if (index !== -1) {
            this.meshes.splice(index, 1);
            this.currentUsage -= mesh.metadata?.memorySize || 0;
        }
    }

    /**
     * Estimate memory usage of a mesh in bytes
     */
    private estimateMemoryUsage(mesh: BABYLON.Mesh): number {
        let size = 0;

        // Vertex data
        const vertexData = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        if (vertexData) {
            size += vertexData.length * 4; // Float32
        }

        const normalData = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
        if (normalData) {
            size += normalData.length * 4;
        }

        const uvData = mesh.getVerticesData(BABYLON.VertexBuffer.UVKind);
        if (uvData) {
            size += uvData.length * 4;
        }

        // Index data
        const indices = mesh.getIndices();
        if (indices) {
            size += indices.length * 4; // Uint32
        }

        // Material textures (rough estimate)
        if (mesh.material) {
            const material = mesh.material as BABYLON.PBRMaterial;
            if (material.albedoTexture) {
                size += this.estimateTextureSize(material.albedoTexture);
            }
            if (material.bumpTexture) {
                size += this.estimateTextureSize(material.bumpTexture);
            }
            if (material.metallicTexture) {
                size += this.estimateTextureSize(material.metallicTexture);
            }
        }

        return size;
    }

    /**
     * Estimate texture memory usage
     */
    private estimateTextureSize(texture: BABYLON.BaseTexture): number {
        const size = texture.getSize();
        return size.width * size.height * 4; // RGBA
    }

    /**
     * Evict low-priority meshes when over budget
     */
    private evictLowPriorityMeshes(): void {
        // Sort by distance from camera and LOD level
        const camera = this.meshes[0]?.getScene().activeCamera;
        if (!camera) return;

        const candidates = this.meshes
            .filter(m => m.metadata?.currentLOD !== undefined && m.metadata.currentLOD < 3)
            .map(mesh => ({
                mesh,
                distance: BABYLON.Vector3.Distance(
                    camera.position,
                    mesh.getBoundingInfo().boundingBox.center
                )
            }))
            .sort((a, b) => b.distance - a.distance);

        // Downgrade LOD or dispose distant meshes
        for (const { mesh } of candidates) {
            if (this.currentUsage < this.memoryBudget * 0.8) break;

            if (mesh.metadata.currentLOD < 3) {
                // Downgrade to lower LOD
                mesh.metadata.currentLOD++;
                console.log(`Downgraded ${mesh.name} to LOD ${mesh.metadata.currentLOD}`);
            } else {
                // Dispose mesh entirely
                this.untrackMesh(mesh);
                mesh.dispose();
                console.log(`Disposed ${mesh.name} to free memory`);
            }
        }
    }

    /**
     * Get current memory usage statistics
     */
    getMemoryStats(): { current: number; budget: number; usage: number } {
        return {
            current: this.currentUsage,
            budget: this.memoryBudget,
            usage: (this.currentUsage / this.memoryBudget) * 100
        };
    }

    /**
     * Clear all tracked meshes
     */
    clear(): void {
        this.meshes = [];
        this.currentUsage = 0;
    }
}
