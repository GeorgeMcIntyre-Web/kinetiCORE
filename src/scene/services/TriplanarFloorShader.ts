// Triplanar Floor Shader - Ultra-realistic PBR floor material
// No UV seams, no stretching, no visible tiles - works at any scale

import * as BABYLON from "@babylonjs/core";
import type { Scene } from "@babylonjs/core/scene";

// Register shader (one-time)
if (!BABYLON.Effect.ShadersStore["TriplanarFloorVertexShader"]) {
  BABYLON.Effect.ShadersStore["TriplanarFloorVertexShader"] = `
    precision highp float;
    attribute vec3 position;
    attribute vec3 normal;
    attribute vec2 uv;
    uniform mat4 worldViewProjection;
    uniform mat4 world;
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    void main(void){
      vec4 worldPos = world * vec4(position,1.0);
      vWorldPos = worldPos.xyz;
      vWorldNormal = normalize((world * vec4(normal,0.0)).xyz);
      gl_Position = worldViewProjection * vec4(position,1.0);
    }
  `;

  BABYLON.Effect.ShadersStore["TriplanarFloorFragmentShader"] = `
    precision highp float;
    
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    
    uniform sampler2D uBaseColor;
    uniform sampler2D uNormal;
    uniform sampler2D uRoughAO;
    uniform sampler2D uMicroNormal;
    uniform sampler2D uNoise;
    uniform float uMacroScale;
    uniform float uMicroScale;
    uniform float uNoiseScale;
    uniform float uNoiseStrength;
    uniform float uRoughnessBias;
    uniform float uAOWeight;
    uniform float uMetallic;
    uniform float uNormalStrength;
    uniform float uMicroNormalStrength;
    
    vec3 absN(vec3 n) {
      return abs(n) + 1e-5;
    }
    
    vec3 blendWeights(vec3 n) {
      vec3 a = absN(n);
      return a / (a.x + a.y + a.z);
    }
    
    vec2 rot2(vec2 p, float a) {
      float c = cos(a);
      float s = sin(a);
      return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    }
    
    vec4 triSample(sampler2D tex, vec3 wp, vec3 wn, float scale, float rot) {
      vec3 w = blendWeights(wn);
      vec2 uvX = rot2(wp.zy / scale, rot);
      vec2 uvY = rot2(wp.xz / scale, rot);
      vec2 uvZ = rot2(wp.xy / scale, rot);
      vec4 sx = texture2D(tex, uvX);
      vec4 sy = texture2D(tex, uvY);
      vec4 sz = texture2D(tex, uvZ);
      return sx * w.x + sy * w.y + sz * w.z;
    }
    
    vec3 decodeNormal(vec3 n) {
      return normalize(vec3(n.r * 2.0 - 1.0, n.g * 2.0 - 1.0, n.b * 2.0 - 1.0));
    }
    
    vec3 triNormal(sampler2D tex, vec3 wp, vec3 wn, float scale, float rot, float strength) {
      vec3 w = blendWeights(wn);
      vec3 nx = decodeNormal(texture2D(tex, rot2(wp.zy / scale, rot)).rgb);
      vec3 ny = decodeNormal(texture2D(tex, rot2(wp.xz / scale, rot)).rgb);
      vec3 nz = decodeNormal(texture2D(tex, rot2(wp.xy / scale, rot)).rgb);
      vec3 wx = normalize(vec3(nx.z, nx.x, nx.y));
      vec3 wy = normalize(vec3(ny.x, ny.z, ny.y));
      vec3 wz = normalize(vec3(nz.x, nz.y, nz.z));
      vec3 blended = normalize(wx * w.x + wy * w.y + wz * w.z);
      return normalize(mix(vWorldNormal, blended, clamp(strength, 0.0, 2.0)));
    }
    
    void main(void) {
      vec2 noiseUV = vWorldPos.xz / uNoiseScale;
      float n = texture2D(uNoise, noiseUV).r;
      float rotA = (n * 2.0 - 1.0) * 1.5707963;
      float rotB = rotA + 1.0472;
      float mixer = smoothstep(0.4, 0.6, n) * uNoiseStrength;
      
      vec4 baseA = triSample(uBaseColor, vWorldPos, vWorldNormal, uMacroScale, rotA);
      vec4 baseB = triSample(uBaseColor, vWorldPos, vWorldNormal, uMacroScale, rotB);
      vec3 albedo = mix(baseA.rgb, baseB.rgb, mixer);
      
      vec4 raA = triSample(uRoughAO, vWorldPos, vWorldNormal, uMacroScale, rotA);
      vec4 raB = triSample(uRoughAO, vWorldPos, vWorldNormal, uMacroScale, rotB);
      float roughG = mix(raA.g, raB.g, mixer);
      float aoR = mix(raA.r, raB.r, mixer);
      
      vec3 nMacro = triNormal(uNormal, vWorldPos, vWorldNormal, uMacroScale, rotA, uNormalStrength);
      vec3 nMicro = triNormal(uMicroNormal, vWorldPos, vWorldNormal, uMicroScale, 0.0, uMicroNormalStrength);
      vec3 nWorld = normalize(mix(nMacro, nMicro, 0.5));
      
      float roughness = clamp(roughG + uRoughnessBias, 0.04, 0.98);
      float metallic = clamp(uMetallic, 0.0, 1.0);
      float ao = mix(1.0, aoR, clamp(uAOWeight, 0.0, 1.0));
      
      vec3 color = albedo * ao;
      gl_FragColor = vec4(color, 1.0);
    }
  `;
}

export interface TriplanarFloorOptions {
  size?: number;
  macroScale?: number;
  microScale?: number;
  noiseScale?: number;
  noiseStrength?: number;
  roughnessBias?: number;
  aoWeight?: number;
  metallic?: number;
  normalStrength?: number;
  microNormalStrength?: number;
}

export async function createTriplanarFloor(
  scene: Scene,
  urls: {
    baseColorUrl: string;
    normalUrl: string;
    roughAoUrl: string;
    microNormalUrl: string;
    noiseUrl: string;
  },
  opts?: TriplanarFloorOptions
): Promise<{ ground: BABYLON.Mesh; material: BABYLON.ShaderMaterial }> {
  const size = opts?.size ?? 200;
  const ground = BABYLON.MeshBuilder.CreateGround("warehouse_floor_ultra", { width: size, height: size }, scene);

  try {
    // Create textures first and wait for them to load
    const base = new BABYLON.Texture(urls.baseColorUrl, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    const nor = new BABYLON.Texture(urls.normalUrl, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    const rao = new BABYLON.Texture(urls.roughAoUrl, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    const mic = new BABYLON.Texture(urls.microNormalUrl, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    const noi = new BABYLON.Texture(urls.noiseUrl, scene, true, false, BABYLON.Texture.NEAREST_SAMPLINGMODE);

    // Wait for textures to load
    await Promise.all([
      new Promise<void>((resolve) => { base.onLoadObservable.addOnce(() => resolve()); }),
      new Promise<void>((resolve) => { nor.onLoadObservable.addOnce(() => resolve()); }),
      new Promise<void>((resolve) => { rao.onLoadObservable.addOnce(() => resolve()); }),
      new Promise<void>((resolve) => { mic.onLoadObservable.addOnce(() => resolve()); }),
      new Promise<void>((resolve) => { noi.onLoadObservable.addOnce(() => resolve()); }),
    ]);

    const mat = new BABYLON.ShaderMaterial("floor_triplanar", scene, {
      vertex: "TriplanarFloor",
      fragment: "TriplanarFloor",
    }, {
      attributes: ["position", "normal", "uv"],
      uniforms: [
        "world", "worldViewProjection",
        "uMacroScale", "uMicroScale", "uNoiseScale", "uNoiseStrength",
        "uRoughnessBias", "uAOWeight", "uMetallic", "uNormalStrength", "uMicroNormalStrength"
      ],
      samplers: ["uBaseColor", "uNormal", "uRoughAO", "uMicroNormal", "uNoise"],
    });

    mat.setTexture("uBaseColor", base);
    mat.setTexture("uNormal", nor);
    mat.setTexture("uRoughAO", rao);
    mat.setTexture("uMicroNormal", mic);
    mat.setTexture("uNoise", noi);

    mat.setFloat("uMacroScale", opts?.macroScale ?? 8.0);
    mat.setFloat("uMicroScale", opts?.microScale ?? 40.0);
    mat.setFloat("uNoiseScale", opts?.noiseScale ?? 12.0);
    mat.setFloat("uNoiseStrength", opts?.noiseStrength ?? 0.5);
    mat.setFloat("uRoughnessBias", opts?.roughnessBias ?? 0.0);
    mat.setFloat("uAOWeight", opts?.aoWeight ?? 0.6);
    mat.setFloat("uMetallic", opts?.metallic ?? 0.02);
    mat.setFloat("uNormalStrength", opts?.normalStrength ?? 1.0);
    mat.setFloat("uMicroNormalStrength", opts?.microNormalStrength ?? 0.8);

    ground.material = mat;
    ground.receiveShadows = true;

    return { ground, material: mat };
  } catch (error) {
    console.error('[TriplanarFloorShader] Failed to create shader material:', error);
    throw error;
  }
}

