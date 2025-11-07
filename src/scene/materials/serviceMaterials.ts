// Service Materials - Industrial/warehouse service identification materials
// Pipes, fluids, electrical, steam, etc. with color coding

import * as BABYLON from "@babylonjs/core";
import type { Scene } from "@babylonjs/core/scene";

/* --------------------------- Shared helpers --------------------------- */
const TEX = (p: string, s: Scene) => new BABYLON.Texture(p, s);

const setUV = (t: BABYLON.BaseTexture | null | undefined, s: number) => { 
  if (!t || !(t instanceof BABYLON.Texture)) return; 
  t.uScale = s; 
  t.vScale = s; 
};

function packMetalRough(m: BABYLON.PBRMaterial, tex: BABYLON.Texture) {
  m.metallicTexture = tex;
  m.useRoughnessFromMetallicTextureGreen = true; // G=roughness
}

/* ----------------------- Service color palette ------------------------ */
/* Neutral, non-standardized defaults (easy to tweak):
   If you must follow a site standard (ASME A13.1 / BS 1710 / SANS), swap these hex codes. */
export const ServiceColors = {
  water:       BABYLON.Color3.FromHexString("#2f7de1"),  // blue
  oil:         BABYLON.Color3.FromHexString("#7a4b18"),  // dark brown
  steam:       BABYLON.Color3.FromHexString("#9aa3ad"),  // warm gray
  electricity: BABYLON.Color3.FromHexString("#ffb000"),  // safety orange/yellow
  compressedAir: BABYLON.Color3.FromHexString("#77c7ff"),
  coolant:     BABYLON.Color3.FromHexString("#49b26b"),
  fireWater:   BABYLON.Color3.FromHexString("#c62828")
};

/* ------------------ 1) Service Pipe Paint (PBR shell) ----------------- */
/** Paint over steel pipe: steel base (galvanized) + colored topcoat.
 *  Use for pipe exteriors: tint carries the service identity. */
export function makeServicePipePaint(scene: Scene, service: keyof typeof ServiceColors): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial(`pipe_${service}`, scene);
  // Steel substrate
  m.albedoTexture   = TEX("/assets/metal/galv_baseColor.jpg", scene);
  m.bumpTexture     = TEX("/assets/metal/galv_normal.jpg", scene);
  packMetalRough(m,   TEX("/assets/metal/galv_metallicRoughness.jpg", scene));
  setUV(m.albedoTexture, 2); 
  setUV(m.bumpTexture, 2); 
  setUV(m.metallicTexture, 2);

  // Paint tint & sheen
  m.albedoColor = ServiceColors[service]; // paint body color
  m.metallic = 0.6;                      // galvanization undercoat
  m.roughness = 0.42;                    // semi-gloss industrial enamel
  // Optional subtle wear (edge AO/roughness variations) can be added via second detail map in your pipeline.
  return m;
}

/* -------------- 2) Fluid — WATER (sight glass / open tanks) ----------- */
export function makeFluidWater(scene: Scene): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("fluid_water", scene);
  m.albedoColor = new BABYLON.Color3(0.75, 0.92, 1.0);
  m.metallic    = 0.0;
  m.roughness   = 0.02; // clear
  m.indexOfRefraction = 1.333; // water IOR
  m.alpha       = 0.6;
  // Gentle ripple normals (scrolling)
  const n = TEX("/assets/water/normals01.jpg", scene);
  setUV(n, 8);
  m.bumpTexture = n;
  m.backFaceCulling = false;
  return m;
}

/* ----------------- 3) Fluid — OIL (dark, viscous look) ---------------- */
export function makeFluidOil(scene: Scene): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("fluid_oil", scene);
  m.albedoColor = new BABYLON.Color3(0.08, 0.06, 0.04);
  m.metallic  = 0.0;
  m.roughness = 0.08;          // slightly glossier than water due to film
  m.alpha     = 0.7;           // translucent in thin sections
  m.indexOfRefraction = 1.47;  // typical mineral oil IOR
  const n = TEX("/assets/oil/normals_oil.jpg", scene);
  setUV(n, 6);
  m.bumpTexture = n;
  m.backFaceCulling = false;
  return m;
}

/* ------------------------ 4) Steam (volumetric) ------------------------ */
/* Billboarded "puffs" material (use on quads/particles); soft alpha noise with warm rim */
(function registerSteamShader(){
  if (BABYLON.Effect.ShadersStore["Steam_VS"]) return;
  BABYLON.Effect.ShadersStore["Steam_VS"] = `
    precision highp float;
    attribute vec3 position; attribute vec2 uv;
    uniform mat4 worldViewProjection; uniform float time;
    varying vec2 vUV; varying float vPhase;
    void main(){
      vUV = uv;
      vPhase = time;
      gl_Position = worldViewProjection * vec4(position,1.0);
    }
  `;
  BABYLON.Effect.ShadersStore["Steam_FS"] = `
    precision highp float;
    varying vec2 vUV; varying float vPhase;
    uniform sampler2D noiseTex; uniform vec3 tint; uniform float softness; uniform float intensity;
    void main(){
      vec2 p = vUV*2.0-1.0;
      float r = length(p);
      float mask = smoothstep(1.0, 0.7, r);
      float n = texture2D(noiseTex, vUV*1.2 + vec2(0.0, vPhase*0.05)).r;
      float alpha = mask * (0.4 + 0.6*n) * softness;
      vec3 col = mix(vec3(0.9,0.92,0.95), tint, 0.3) * (0.6 + 0.4*n) * intensity;
      gl_FragColor = vec4(col, alpha);
    }
  `;
})();

export function makeSteamBillboard(scene: Scene, noiseUrl = "/assets/noise/noise.png"): BABYLON.ShaderMaterial {
  const m = new BABYLON.ShaderMaterial("steam_vol", scene, 
    { vertex: "Steam", fragment: "Steam" },
    { 
      attributes: ["position","uv"], 
      uniforms: ["world","worldViewProjection","time","softness","intensity","tint"], 
      samplers: ["noiseTex"] 
    });
  m.setTexture("noiseTex", TEX(noiseUrl, scene));
  m.setColor3("tint", ServiceColors.steam);
  m.setFloat("softness", 0.9);
  m.setFloat("intensity", 1.0);
  let t = 0;
  scene.onBeforeRenderObservable.add(() => { 
    t += scene.getEngine().getDeltaTime()/1000; 
    m.setFloat("time", t); 
  });
  m.backFaceCulling = false;
  return m;
}

/* ----------- 5) Electrical Conduit — PVC (non-metallic) ---------------- */
export function makeElectricalPVC(scene: Scene): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("conduit_pvc", scene);
  m.albedoColor = ServiceColors.electricity.clone().scale(0.95);
  m.metallic  = 0.0;
  m.roughness = 0.55; // satin PVC
  m.albedoTexture = TEX("/assets/pvc/pvc_base.jpg", scene); 
  setUV(m.albedoTexture, 3);
  m.bumpTexture   = TEX("/assets/pvc/pvc_normal.jpg", scene); 
  setUV(m.bumpTexture, 3);
  return m;
}

/* ----------------- 6) Cable Tray — Galvanized steel ------------------- */
export function makeCableTray(scene: Scene): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("cable_tray", scene);
  m.albedoTexture = TEX("/assets/metal/galv_baseColor.jpg", scene);
  m.bumpTexture   = TEX("/assets/metal/galv_normal.jpg", scene);
  packMetalRough(m,  TEX("/assets/metal/galv_metallicRoughness.jpg", scene));
  m.metallic  = 0.9;
  m.roughness = 0.35;
  setUV(m.albedoTexture, 2); 
  setUV(m.bumpTexture, 2); 
  setUV(m.metallicTexture, 2);
  return m;
}

/* ------------- 7) Floor Service Stripe (world-space) ------------------- */
(function registerStripe(){
  if (BABYLON.Effect.ShadersStore["SvcStripe_VS"]) return;
  BABYLON.Effect.ShadersStore["SvcStripe_VS"] = `
    precision highp float;
    attribute vec3 position; uniform mat4 worldViewProjection; uniform mat4 world;
    varying vec3 vW; void main(){ vW = (world*vec4(position,1.0)).xyz; gl_Position = worldViewProjection*vec4(position,1.0); }
  `;
  BABYLON.Effect.ShadersStore["SvcStripe_FS"] = `
    precision highp float; varying vec3 vW;
    uniform vec3 color; uniform float width; uniform float angle; uniform float feather;
    void main(){
      float c=cos(angle), s=sin(angle);
      vec2 p = vec2(c*vW.x + s*vW.z, -s*vW.x + c*vW.z);
      float k = smoothstep(0.5-width, 0.5-width+feather, abs(fract(p.x)-0.5));
      vec3 col = mix(color, vec3(0.0), k*0.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `;
})();

export function makeServiceStripe(
  scene: Scene, 
  service: keyof typeof ServiceColors, 
  opts?: { width?: number; angle?: number; feather?: number }
): BABYLON.ShaderMaterial {
  const m = new BABYLON.ShaderMaterial(`svc_stripe_${service}`, scene, 
    { vertex: "SvcStripe", fragment: "SvcStripe" },
    { attributes: ["position"], uniforms: ["world","worldViewProjection","color","width","angle","feather"] });
  m.setColor3("color", ServiceColors[service]);
  m.setFloat("width",   opts?.width ?? 0.12);
  m.setFloat("angle",   opts?.angle ?? 0.0);
  m.setFloat("feather", opts?.feather ?? 0.05);
  return m;
}

/* ------------- 8) Service Label Decal (emissive text band) ------------- */
/* Use with a DynamicTexture for text; here we just provide the shader shell */
(function registerDecal(){
  if (BABYLON.Effect.ShadersStore["SvcDecal_VS"]) return;
  BABYLON.Effect.ShadersStore["SvcDecal_VS"] = `
    precision highp float; attribute vec3 position; attribute vec2 uv;
    uniform mat4 worldViewProjection; varying vec2 vUV;
    void main(){ vUV=uv; gl_Position=worldViewProjection*vec4(position,1.0); }
  `;
  BABYLON.Effect.ShadersStore["SvcDecal_FS"] = `
    precision highp float; varying vec2 vUV; uniform sampler2D label; uniform vec3 tint;
    void main(){ vec4 s = texture2D(label, vUV); gl_FragColor = vec4(s.rgb * tint, s.a); }
  `;
})();

export function makeServiceLabelDecal(
  scene: Scene, 
  labelTexture: BABYLON.Texture, 
  service: keyof typeof ServiceColors
): BABYLON.ShaderMaterial {
  const m = new BABYLON.ShaderMaterial(`svc_label_${service}`, scene, 
    { vertex: "SvcDecal", fragment: "SvcDecal" },
    { attributes: ["position","uv"], uniforms: ["world","worldViewProjection","tint"], samplers: ["label"] });
  m.setTexture("label", labelTexture);
  m.setColor3("tint", ServiceColors[service]);
  m.backFaceCulling = false;
  return m;
}

/* ----------------- 9) Valve Handle (powder-coat PBR) ------------------ */
export function makeValveHandle(
  scene: Scene, 
  service: keyof typeof ServiceColors = "fireWater"
): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial(`valve_${service}`, scene);
  m.albedoColor = ServiceColors[service];
  m.metallic  = 0.0;   // powder coat
  m.roughness = 0.55;  // satin
  m.albedoTexture = TEX("/assets/paint/texture_base.jpg", scene); 
  setUV(m.albedoTexture, 4);
  m.bumpTexture   = TEX("/assets/paint/texture_normal.jpg", scene); 
  setUV(m.bumpTexture, 4);
  return m;
}

/* -------------- 10) Junction Box (painted steel PBR) ------------------ */
export function makeJunctionBox(
  scene: Scene, 
  service: keyof typeof ServiceColors = "electricity"
): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial(`jbox_${service}`, scene);
  m.albedoColor = ServiceColors[service].clone().scale(0.95);
  m.albedoTexture = TEX("/assets/paint/paint_base.jpg", scene);
  m.bumpTexture   = TEX("/assets/paint/paint_normal.jpg", scene);
  packMetalRough(m,  TEX("/assets/paint/paint_metalRough.jpg", scene));
  setUV(m.albedoTexture, 3); 
  setUV(m.bumpTexture, 3); 
  setUV(m.metallicTexture, 3);
  m.metallic  = 0.2;
  m.roughness = 0.5;
  return m;
}

/* -------------- 11) Worn Rusted Painted Metal (industrial PBR) ------------ */
/** Weathered industrial metal with rust and paint wear.
 *  Textures from: C:\Users\George\source\repos\kinetiCORE_DATA\Textures\worn-rusted-painted-unity
 *  Note: metallic.psd needs to be converted to PNG for full PBR support */
export function makeWornRustedPainted(scene: Scene, uvScale: number = 2): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("worn_rusted_painted", scene);
  
  // Base color (albedo)
  m.albedoTexture = TEX("/assets/worn_rusted/worn-rusted-painted_albedo.png", scene);
  setUV(m.albedoTexture, uvScale);
  
  // Normal map (OpenGL format)
  m.bumpTexture = TEX("/assets/worn_rusted/worn-rusted-painted_normal-ogl.png", scene);
  setUV(m.bumpTexture, uvScale);
  
  // Ambient occlusion
  m.ambientTexture = TEX("/assets/worn_rusted/worn-rusted-painted_ao.png", scene);
  setUV(m.ambientTexture, uvScale);
  
  // Height map (can be used for parallax or displacement if needed)
  // Note: Height map available but not used by default - can be added for advanced effects
  
  // Metallic and roughness - using defaults since PSD needs conversion
  // TODO: Convert worn-rusted-painted_metallic.psd to PNG format for proper metallic/roughness mapping
  m.metallic = 0.7;  // Rusted metal has moderate metallic properties
  m.roughness = 0.85; // Weathered surface is quite rough
  
  // Optional: Add height map for parallax mapping if needed
  // m.parallaxScaleBias = 0.05;
  // m.parallaxTexture = TEX("/assets/worn_rusted/worn-rusted-painted_height.png", scene);
  
  (m as any)._kind = "wornRustedPainted";
  return m;
}

/* -------------- 12) Damascus Steel (patterned metal PBR) ---------------- */
/** Damascus steel with distinctive pattern texture.
 *  Textures from: C:\Users\George\source\repos\kinetiCORE_DATA\Textures\damascus-steel-unity
 *  Note: metallic.psd needs to be converted to PNG for full PBR support */
export function makeDamascusSteel(scene: Scene, uvScale: number = 2): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial("damascus_steel", scene);
  
  // Base color (albedo) - Damascus steel has distinctive pattern
  m.albedoTexture = TEX("/assets/damascus_steel/damascus-steel_albedo.png", scene);
  setUV(m.albedoTexture, uvScale);
  
  // Normal map (OpenGL format) - for surface detail
  m.bumpTexture = TEX("/assets/damascus_steel/damascus-steel_normal-ogl.png", scene);
  setUV(m.bumpTexture, uvScale);
  
  // Ambient occlusion
  m.ambientTexture = TEX("/assets/damascus_steel/damascus-steel_ao.png", scene);
  setUV(m.ambientTexture, uvScale);
  
  // Metallic and roughness - using defaults since PSD needs conversion
  // TODO: Convert damascus-steel_metallic.psd to PNG format for proper metallic/roughness mapping
  m.metallic = 0.9;  // Steel is highly metallic
  m.roughness = 0.3; // Polished steel surface (can be adjusted for worn vs polished)
  
  // Height map (available but not used by default - can be added for parallax/displacement)
  // Note: Height map available at /assets/damascus_steel/damascus-steel_height.png
  
  (m as any)._kind = "damascusSteel";
  return m;
}

