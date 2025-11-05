// materials.ts
// 10 Drop-in Warehouse Materials (Babylon.js)
// Style: guard clauses, minimal nesting, sensible defaults.

import * as BABYLON from "@babylonjs/core";
import type { Scene } from "@babylonjs/core/scene";
import type { Material, AbstractMesh } from "@babylonjs/core";

/* ----------------------------- 0) Helpers ----------------------------- */
// Texture cache to avoid duplicate loads and race conditions
const texCache = new Map<string, BABYLON.Texture>();

function T(scene: Scene, url: string, sampling = BABYLON.Texture.TRILINEAR_SAMPLINGMODE): BABYLON.Texture {
  if (texCache.has(url)) return texCache.get(url)!;
  const t = new BABYLON.Texture(url, scene, true, false, sampling);
  texCache.set(url, t);
  return t;
}

// Unused function - keeping for potential future use
// async function ready(t: BABYLON.Texture): Promise<void> {
//   if (t.isReady()) return;
//   await new Promise<void>(res => t.onLoadObservable.addOnce(() => res()));
// }

function setUVScale(t: BABYLON.BaseTexture | null | undefined, s: number) {
  if (!t || !(t instanceof BABYLON.Texture)) return;
  t.uScale = s; 
  t.vScale = s;
}

function packedMetalRough(mat: BABYLON.PBRMaterial, tex: BABYLON.Texture) {
  mat.metallicTexture = tex;
  mat.useRoughnessFromMetallicTextureGreen = true;    // G = roughness
  mat.useMetallnessFromMetallicTextureBlue = false;   // B unused (ok)
}

// Material swap with proper disposal
export function swapMaterial(mesh: AbstractMesh, next: Material): void {
  const prev = mesh.material;
  mesh.material = next;
  if (prev && prev !== next) {
    prev.dispose(true, true);
  }
}

// Material logging helper
export function logMat(mat: Material | null | undefined): void {
  if (!mat) {
    console.log("[Material] No material assigned");
    return;
  }
  const m = mat as any;
  console.table({
    name: m.name ?? "unnamed",
    kind: m._kind ?? "unknown",
    roughness: m.roughness ?? "(shader)",
    metallic: m.metallic ?? "(shader)",
    albedoTex: m.albedoTexture?.name ?? "none",
    bumpTex: m.bumpTexture?.name ?? "none",
  });
}

/* ------------------ 1) Sealed Concrete (PBR, default) ----------------- */
export function makeSealedConcrete(scene: Scene): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("sealed_concrete", scene);
  m.metallic = 0.02;
  m.roughness = 0.78; // Increased for better visual distinction
  m.albedoTexture   = T(scene, "/assets/warehouse_floor/baseColor.jpg");
  m.bumpTexture     = T(scene, "/assets/warehouse_floor/normal.jpg");
  m.ambientTexture  = T(scene, "/assets/warehouse_floor/ao.jpg");
  packedMetalRough(m, T(scene, "/assets/warehouse_floor/roughness.jpg"));
  const uv = 12;
  [m.albedoTexture, m.bumpTexture, m.ambientTexture, m.metallicTexture].forEach(t => setUVScale(t, uv));
  (m as any)._kind = "sealedConcrete";
  return m;
}

/* ---------------- 2) Epoxy Floor (PBR, semi-gloss clean) --------------- */
export function makeEpoxyFloor(scene: Scene): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("epoxy_floor", scene);
  m.metallic = 0.10; // Increased for better distinction
  m.roughness = 0.42; // Slightly reduced for more gloss
  m.albedoColor = new BABYLON.Color3(0.96, 0.97, 1.00); // subtle cool tint
  m.albedoTexture   = T(scene, "/assets/epoxy/baseColor.jpg");
  m.bumpTexture     = T(scene, "/assets/epoxy/normal.jpg");
  m.ambientTexture  = T(scene, "/assets/epoxy/ao.jpg");
  packedMetalRough(m, T(scene, "/assets/epoxy/roughness.jpg"));
  const uv = 10;
  [m.albedoTexture, m.bumpTexture, m.ambientTexture, m.metallicTexture].forEach(t => {
    setUVScale(t, uv);
    if (t) (t as any).level = 1.1; // Slightly brighter for epoxy
  });
  (m as any)._kind = "epoxy";
  return m;
}

/* --------- 3) Triplanar Concrete (no tiling, huge spaces, shader) ------ */
export function makeTriplanarConcrete(scene: Scene): BABYLON.ShaderMaterial {
  // Fragment shader (lightweight: albedo + normal mix; rely on IBL for specular)
  if (!BABYLON.Effect.ShadersStore["M_Trip_VS"]) {
    BABYLON.Effect.ShadersStore["M_Trip_VS"] = `
      precision highp float;
      attribute vec3 position; attribute vec3 normal; attribute vec2 uv;
      uniform mat4 worldViewProjection; uniform mat4 world;
      varying vec3 vWPos; varying vec3 vWNorm;
      void main(){ 
        vec4 wp = world*vec4(position,1.0); 
        vWPos = wp.xyz; 
        vWNorm = normalize((world*vec4(normal,0.0)).xyz);
        gl_Position = worldViewProjection*vec4(position,1.0); 
      }
    `;
    BABYLON.Effect.ShadersStore["M_Trip_FS"] = `
      precision highp float;
      varying vec3 vWPos; varying vec3 vWNorm;
      uniform sampler2D baseTex; uniform sampler2D nMacro; uniform sampler2D nMicro; uniform sampler2D noiseTex;
      uniform float macroScale; uniform float microScale; uniform float noiseScale; uniform float noiseMix;
      vec3 wts(vec3 n){ n=abs(n)+1e-5; return n/(n.x+n.y+n.z); }
      vec2 rot2(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }
      vec4 triS(sampler2D t, vec3 p, vec3 n, float s, float r){
        vec3 w = wts(n);
        vec2 ux=rot2(p.zy/s,r), uy=rot2(p.xz/s,r), uz=rot2(p.xy/s,r);
        return texture2D(t,ux)*w.x + texture2D(t,uy)*w.y + texture2D(t,uz)*w.z;
      }
      vec3 decN(vec3 n){ return normalize(n*2.0-1.0); }
      vec3 triN(sampler2D t, vec3 p, vec3 n, float s, float r){
        vec3 w=wts(n);
        vec3 nx=decN(texture2D(t,rot2(p.zy/s,r)).rgb);
        vec3 ny=decN(texture2D(t,rot2(p.xz/s,r)).rgb);
        vec3 nz=decN(texture2D(t,rot2(p.xy/s,r)).rgb);
        vec3 wx=normalize(vec3(nx.z,nx.x,nx.y));
        vec3 wy=normalize(vec3(ny.x,ny.z,ny.y));
        vec3 wz=normalize(vec3(nz.x,nz.y,nz.z));
        return normalize(wx*w.x + wy*w.y + wz*w.z);
      }
      void main(){
        float n = texture2D(noiseTex, vWPos.xz/noiseScale).r;
        float rA = (n*2.0-1.0)*1.5708;
        float rB = rA + 1.0472;
        float m  = smoothstep(0.4,0.6,n) * noiseMix;
        vec3 albedo = mix( triS(baseTex,vWPos,vWNorm,macroScale,rA).rgb,
                           triS(baseTex,vWPos,vWNorm,macroScale,rB).rgb, m);
        vec3 nMacro = triN(nMacro, vWPos, vWNorm, macroScale, rA);
        vec3 nMicro = triN(nMicro, vWPos, vWNorm, microScale, 0.0);
        vec3 nW = normalize(mix(nMacro, nMicro, 0.5));
        float nd = clamp(dot(nW, normalize(vec3(0.0,1.0,0.0))),0.0,1.0);
        vec3 color = albedo * (0.6 + 0.4*nd);
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  const mat = new BABYLON.ShaderMaterial("triplanar_concrete", scene, 
    { vertex: "M_Trip_VS", fragment: "M_Trip_FS" },
    { 
      attributes: ["position","normal","uv"], 
      uniforms: ["world","worldViewProjection","macroScale","microScale","noiseScale","noiseMix"], 
      samplers: ["baseTex","nMacro","nMicro","noiseTex"] 
    });

  mat.setTexture("baseTex", T(scene, "/assets/warehouse_floor_ultra/baseColor.jpg"));
  mat.setTexture("nMacro",  T(scene, "/assets/warehouse_floor_ultra/normal.jpg"));
  mat.setTexture("nMicro",  T(scene, "/assets/warehouse_floor_ultra/microNormal.jpg"));
  mat.setTexture("noiseTex",T(scene, "/assets/warehouse_floor_ultra/noise.png", BABYLON.Texture.NEAREST_SAMPLINGMODE));
  mat.setFloat("macroScale", 10.0);
  mat.setFloat("microScale", 48.0);
  mat.setFloat("noiseScale", 14.0);
  mat.setFloat("noiseMix",   0.55);
  (mat as any)._kind = "triplanarConcrete";
  return mat;
}

/* ------------- 4) Stone (PBR, rough natural stone) -------------------- */
export function makeStone(scene: Scene): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("stone", scene);
  m.metallic = 0.01;
  m.roughness = 0.90; // Increased for better visual distinction
  m.albedoColor = new BABYLON.Color3(0.4, 0.4, 0.4); // Darker base
  m.albedoTexture   = T(scene, "/assets/stone/baseColor.jpg");
  m.bumpTexture     = T(scene, "/assets/stone/normal.jpg");
  m.ambientTexture  = T(scene, "/assets/stone/ao.jpg");
  packedMetalRough(m, T(scene, "/assets/stone/roughness.jpg"));
  const uv = 8;
  [m.albedoTexture, m.bumpTexture, m.ambientTexture, m.metallicTexture].forEach(t => setUVScale(t, uv));
  (m as any)._kind = "stone";
  return m;
}

/* ------------ 5) Patchy Cement (PBR, weathered concrete) -------------- */
/** Weathered patchy cement with varied surface texture.
 *  Expected texture files from Unity texture pack:
 *  - patchy_cement1_AlbedoTransparency.png (or patchy_cement1_Albedo.png)
 *  - patchy_cement1_Normal.png
 *  - patchy_cement1_MetallicSmoothness.png (or separate Metallic/Roughness)
 *  - patchy_cement1_AO.png (Ambient Occlusion)
 *  - patchy_cement1_Height.png (optional, for displacement)
 */
export function makePatchyCement(scene: Scene, uvScale: number = 10): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("patchy_cement", scene);
  m.metallic = 0.0;  // Cement is non-metallic
  m.roughness = 0.85; // Rough weathered surface
  
  // Try Unity naming convention first
  const albedoPath = "/assets/patchy_cement/patchy_cement1_AlbedoTransparency.png";
  const normalPath = "/assets/patchy_cement/patchy_cement1_Normal.png";
  const aoPath = "/assets/patchy_cement/patchy_cement1_AO.png";
  const metallicPath = "/assets/patchy_cement/patchy_cement1_MetallicSmoothness.png";
  
  // Albedo (base color)
  m.albedoTexture = T(scene, albedoPath);
  setUVScale(m.albedoTexture, uvScale);
  
  // Normal map
  m.bumpTexture = T(scene, normalPath);
  setUVScale(m.bumpTexture, uvScale);
  
  // Ambient occlusion
  m.ambientTexture = T(scene, aoPath);
  setUVScale(m.ambientTexture, uvScale);
  
  // Metallic/Smoothness (Unity packed format: R=metallic, A=smoothness, where smoothness = 1-roughness)
  // Babylon.js uses roughness directly, so we'll extract roughness from smoothness
  try {
    const metallicTex = T(scene, metallicPath);
    m.metallicTexture = metallicTex;
    m.useRoughnessFromMetallicTextureAlpha = true; // Use alpha channel for roughness (smoothness inverted)
    m.useMetallnessFromMetallicTextureBlue = true;  // Use blue channel for metallic (or set manually)
    // Note: Unity MetallicSmoothness uses R for metallic, but Babylon.js expects B channel
    // For now, we set metallic manually above (0.0) since cement is non-metallic
    setUVScale(metallicTex, uvScale);
  } catch (error) {
    // Fallback if texture not found - use default values
    console.warn("[patchy_cement] MetallicSmoothness texture not found, using defaults");
  }
  
  (m as any)._kind = "patchyCement";
  return m;
}

/* ------------------------- Quick usage examples ------------------------ */
// Floor (sealed concrete):
export function addSealedConcreteFloor(scene: Scene, size = 160): BABYLON.Mesh {
  const g = BABYLON.MeshBuilder.CreateGround("floor_concrete", { width: size, height: size }, scene);
  g.material = makeSealedConcrete(scene);
  g.receiveShadows = true;
  return g;
}

// Ultra floor (no tiling):
export function addTriplanarFloor(scene: Scene, size = 160): BABYLON.Mesh {
  const g = BABYLON.MeshBuilder.CreateGround("floor_triplanar", { width: size, height: size }, scene);
  g.material = makeTriplanarConcrete(scene);
  g.receiveShadows = true;
  return g;
}

/* --------------------- Robust Factory Pattern ------------------------ */
export type FloorKind = "sealedConcrete" | "epoxy" | "stone" | "triplanarConcrete" | "patchyCement";

export function makeFloor(scene: Scene, kind: FloorKind): BABYLON.Material {
  switch (kind) {
    case "triplanarConcrete": {
      try {
        const m = makeTriplanarConcrete(scene);
        (m as any)._kind = kind;
        return m;
      } catch (error) {
        console.warn("[floor] triplanar assets missing → fallback to sealed concrete", error);
        const m = makeSealedConcrete(scene);
        (m as any)._kind = "sealedConcrete";
        return m;
      }
    }
    case "epoxy": {
      const m = makeEpoxyFloor(scene);
      (m as any)._kind = kind;
      return m;
    }
    case "stone": {
      const m = makeStone(scene);
      (m as any)._kind = kind;
      return m;
    }
    case "patchyCement": {
      const m = makePatchyCement(scene);
      (m as any)._kind = kind;
      return m;
    }
    default: {
      const m = makeSealedConcrete(scene);
      (m as any)._kind = "sealedConcrete";
      return m;
    }
  }
}

// Idempotent floor material setter
export function setFloorMaterial(scene: Scene, floor: AbstractMesh, kind: FloorKind): void {
  const next = makeFloor(scene, kind);
  if (floor.material && (floor.material as any)._kind === (next as any)._kind) {
    next.dispose(true, true);
    console.log("[floor] same kind, skip swap");
    return;
  }
  swapMaterial(floor, next);
  console.log("[floor] applied:", (next as any)._kind);
  logMat(floor.material);
}

