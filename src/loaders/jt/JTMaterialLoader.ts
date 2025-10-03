/**
 * JT Material Loader - Handles materials and embedded textures
 */

import * as BABYLON from '@babylonjs/core';
import { JTPart } from './types';

export class JTMaterialLoader {
    /**
     * Load material from JT part
     */
    async loadMaterial(part: JTPart, scene: BABYLON.Scene): Promise<BABYLON.Material> {
        const material = new BABYLON.PBRMaterial(part.name + "_mat", scene);

        if (!part.material) {
            // Default material
            material.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.8);
            return material;
        }

        const jtMat = part.material;

        // Base color
        if (jtMat.baseColor) {
            material.albedoColor = new BABYLON.Color3(
                jtMat.baseColor.r,
                jtMat.baseColor.g,
                jtMat.baseColor.b
            );
        }

        // PBR properties
        material.metallic = jtMat.metallic ?? 0.0;
        material.roughness = jtMat.roughness ?? 0.5;

        // Texture maps (JT can embed textures)
        if (jtMat.albedoTexture) {
            const textureData = await jtMat.albedoTexture.getData();
            material.albedoTexture = this.createTextureFromData(
                textureData,
                `${part.name}_albedo`,
                scene
            );
        }

        if (jtMat.normalMap) {
            const normalData = await jtMat.normalMap.getData();
            material.bumpTexture = this.createTextureFromData(
                normalData,
                `${part.name}_normal`,
                scene
            );
        }

        if (jtMat.metallicRoughnessTexture) {
            const mrData = await jtMat.metallicRoughnessTexture.getData();
            material.metallicTexture = this.createTextureFromData(
                mrData,
                `${part.name}_metallic`,
                scene
            );
        }

        // Transparency
        if (jtMat.opacity !== undefined && jtMat.opacity < 1.0) {
            material.alpha = jtMat.opacity;
            material.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        }

        return material;
    }

    /**
     * Create Babylon texture from embedded image data
     */
    private createTextureFromData(
        data: ImageData,
        _name: string,
        scene: BABYLON.Scene
    ): BABYLON.Texture {
        // Convert embedded texture data to Babylon texture
        const canvas = document.createElement('canvas');
        canvas.width = data.width;
        canvas.height = data.height;

        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(data, 0, 0);

        const dataUrl = canvas.toDataURL();
        return new BABYLON.Texture(dataUrl, scene);
    }
}
