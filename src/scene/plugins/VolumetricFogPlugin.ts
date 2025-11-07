import * as BABYLON from '@babylonjs/core';

/**
 * Lightweight Volumetric Fog material plugin adapted from Babylon Playground example.
 * Enables per-material volumetric fog with simple sphere volume blending.
 */
export class VolumetricFogPluginMaterial extends BABYLON.MaterialPluginBase {
  public center = new BABYLON.Vector3(0, 0, 0);
  public radius = 60;
  public color = new BABYLON.Color3(1, 1, 1);
  public density = 4.5;

  private _enabled = false;
  private _varColorName: string;

  get isEnabled(): boolean {
    return this._enabled;
  }
  set isEnabled(enabled: boolean) {
    if (this._enabled === enabled) return;
    this._enabled = enabled;
    this.markAllDefinesAsDirty();
    this._enable(this._enabled);
  }

  constructor(material: BABYLON.Material) {
    super(material, 'VolumetricFog', 500, { VOLUMETRIC_FOG: false });
    this._varColorName = (material as any) instanceof BABYLON.PBRBaseMaterial ? 'finalColor' : 'color';
  }

  // Define shader macros
  prepareDefines(defines: any): void {
    defines.VOLUMETRIC_FOG = this._enabled;
  }

  // Provide uniform declarations
  getUniforms() {
    return {
      ubo: [
        { name: 'volFogCenter', size: 3, type: 'vec3' },
        { name: 'volFogRadius', size: 1, type: 'float' },
        { name: 'volFogColor', size: 3, type: 'vec3' },
        { name: 'volFogDensity', size: 1, type: 'float' },
      ],
      fragment: `#ifdef VOLUMETRIC_FOG\n
        uniform vec3 volFogCenter;\n
        uniform float volFogRadius;\n
        uniform vec3 volFogColor;\n
        uniform float volFogDensity;\n
      #endif`,
    };
  }

  // Update uniforms per subMesh
  bindForSubMesh(uniformBuffer: BABYLON.UniformBuffer): void {
    if (!this._enabled) return;
    uniformBuffer.updateVector3('volFogCenter', this.center);
    uniformBuffer.updateFloat('volFogRadius', this.radius);
    uniformBuffer.updateColor3('volFogColor', this.color);
    uniformBuffer.updateFloat('volFogDensity', this.density);
  }

  getClassName(): string {
    return 'VolumetricFogPluginMaterial';
  }

  // Inject fragment shader code to mix fog contribution
  getCustomCode(shaderType: string) {
    if (shaderType === 'vertex') return null;
    return {
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
        #ifdef VOLUMETRIC_FOG
          float volFogRadius2 = volFogRadius * volFogRadius;
          float distCamToPos = distance(vPositionW.xyz, vEyePosition.xyz);
          vec3 dir = normalize(vPositionW.xyz - vEyePosition.xyz);
          vec3 L = volFogCenter - vEyePosition.xyz;
          float tca = dot(L, dir);
          float d2 = dot(L, L) - tca * tca;
          if (d2 < volFogRadius2) {
            float thc = sqrt(volFogRadius2 - d2);
            float t0 = tca - thc;
            float t1 = tca + thc;
            float dist = 0.0;
            if (t0 < 0.0 && t1 > 0.0) {
              dist = min(distCamToPos, t1);
            } else if (t0 > 0.0 && t1 > 0.0 && t0 < distCamToPos) {
              dist = min(t1, distCamToPos) - t0;
            }
            float distToCenter = length(cross(volFogCenter - vEyePosition.xyz, dir));
            float fr = distToCenter < volFogRadius ? smoothstep(0.0, 1.0, cos(distToCenter/volFogRadius*3.141592/2.0)) : 0.0;
            float e = dist/(volFogRadius*2.0);
            e = 1.0 - exp(-e * volFogDensity);
            ${this._varColorName} = mix(${this._varColorName}, vec4(volFogColor, ${this._varColorName}.a), clamp(e*fr, 0.0, 1.0));
          }
        #endif
      `,
    } as any;
  }
}

// Helper to register plugin once
let registered = false;
export function ensureVolumetricFogRegistered() {
  if (registered) return;
  BABYLON.RegisterMaterialPlugin('VolumetricFog', (material) => new VolumetricFogPluginMaterial(material));
  registered = true;
}

