// BabylonJS ShaderMaterial Drop‑ins Pack (20)
// World‑building helpers — lightweight, fast, parameterized.
// Each factory returns a ready‑to‑use ShaderMaterial with sensible defaults.
// Requires: @babylonjs/core

import * as BABYLON from "@babylonjs/core";
import type { Scene } from "@babylonjs/core/scene";

// ---------------- Common minimal vertex shader (world‑space varyings) ----------------
BABYLON.Effect.ShadersStore["WB_CommonVertexShader"] = `
precision highp float;
attribute vec3 position; attribute vec3 normal; attribute vec2 uv;
uniform mat4 worldViewProjection; uniform mat4 world;
varying vec3 vWPos; varying vec3 vWNorm; varying vec2 vUV;
void main(){
  vec4 wpos = world * vec4(position,1.0);
  vWPos = wpos.xyz;
  vWNorm = normalize((world * vec4(normal,0.0)).xyz);
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position,1.0);
}`;

// Helper to make ShaderMaterial quickly
function makeMat(scene: Scene, name: string, fragKey: string, uniforms: string[], samplers: string[]) {
  return new BABYLON.ShaderMaterial(name, scene,
    { vertex: "WB_Common", fragment: fragKey },
    { attributes: ["position", "normal", "uv"], uniforms: ["world", "worldViewProjection", ...uniforms], samplers });
}

// 1) Triplanar Albedo + Macro/Micro Normal (lightweight, color‑only; relies on IBL from scene)
BABYLON.Effect.ShadersStore["WB_TriplanarFragShader"] = `
precision highp float; varying vec3 vWPos; varying vec3 vWNorm;
uniform sampler2D baseTex; uniform sampler2D macroN; uniform sampler2D microN; uniform sampler2D noiseTex;
uniform float macroScale; uniform float microScale; uniform float noiseScale; uniform float noiseMix; uniform float normalMix; 

vec3 an(vec3 n){ return abs(n)+1e-5; }
vec3 wts(vec3 n){ vec3 a=an(n); return a/(a.x+a.y+a.z); }
vec2 rot2(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(c*p.x-s*p.y,s*p.x+c*p.y);} 
vec4 triS(sampler2D t, vec3 p, vec3 n, float s, float r){ vec3 w=wts(n);
  vec2 ux=rot2(p.zy/s,r), uy=rot2(p.xz/s,r), uz=rot2(p.xy/s,r);
  return texture2D(t,ux)*w.x + texture2D(t,uy)*w.y + texture2D(t,uz)*w.z; }
vec3 decN(vec3 n){ return normalize(n*2.0-1.0);} 
vec3 triN(sampler2D t, vec3 p, vec3 n, float s, float r){ vec3 w=wts(n);
  vec3 nx=decN(texture2D(t,rot2(p.zy/s,r)).rgb);
  vec3 ny=decN(texture2D(t,rot2(p.xz/s,r)).rgb);
  vec3 nz=decN(texture2D(t,rot2(p.xy/s,r)).rgb);
  vec3 wx=normalize(vec3(nx.z,nx.x,nx.y));
  vec3 wy=normalize(vec3(ny.x,ny.z,ny.y));
  vec3 wz=normalize(vec3(nz.x,nz.y,nz.z));
  return normalize(wx*w.x + wy*w.y + wz*w.z);
}
void main(){
  float nval = texture2D(noiseTex, vWPos.xz/noiseScale).r; float rA=(nval*2.0-1.0)*1.5708; float rB=rA+1.0472; float mixv = smoothstep(0.4,0.6,nval)*noiseMix;
  vec3 albedo = mix( triS(baseTex,vWPos,vWNorm,macroScale,rA).rgb, triS(baseTex,vWPos,vWNorm,macroScale,rB).rgb, mixv );
  vec3 nMacro = triN(macroN,vWPos,vWNorm,macroScale,rA);
  vec3 nMicro = triN(microN,vWPos,vWNorm,microScale,0.0);
  vec3 nW = normalize(mix(nMacro,nMicro,0.5*normalMix));
  float nd = clamp(dot(nW, normalize(vec3(0.0,1.0,0.0))),0.0,1.0);
  vec3 color = albedo * (0.6 + 0.4*nd);
  gl_FragColor = vec4(color,1.0);
}`;
export function matTriplanar(scene: Scene, urls: { base: string; macroN: string; microN: string; noise: string; }){
  const m = makeMat(scene, "matTriplanar", "WB_TriplanarFrag", ["macroScale","microScale","noiseScale","noiseMix","normalMix"],["baseTex","macroN","microN","noiseTex"]);
  m.setFloat("macroScale", 10.0); m.setFloat("microScale", 48.0); m.setFloat("noiseScale", 14.0); m.setFloat("noiseMix", 0.6); m.setFloat("normalMix", 1.0);
  m.setTexture("baseTex", new BABYLON.Texture(urls.base, scene));
  m.setTexture("macroN", new BABYLON.Texture(urls.macroN, scene));
  m.setTexture("microN", new BABYLON.Texture(urls.microN, scene));
  m.setTexture("noiseTex", new BABYLON.Texture(urls.noise, scene));
  return m;
}

// 2) Infinite Grid (fade by distance)
BABYLON.Effect.ShadersStore["WB_GridFragShader"] = `
precision highp float; varying vec3 vWPos; 
uniform vec3 gridColor; uniform vec3 bgColor; uniform float cell; uniform float bold; uniform float fadeStart; uniform float fadeEnd; 
float grid(vec2 p,float s){ vec2 g=abs(fract(p/s-0.5)-0.5)/fwidth(p/s); float line=min(g.x,g.y); return 1.0-clamp(line,0.0,1.0); }
void main(){
  float d = length(vWPos.xz);
  float f = 1.0 - smoothstep(fadeStart, fadeEnd, d);
  float g1 = grid(vWPos.xz, cell);
  float g2 = grid(vWPos.xz, cell*bold);
  float g = max(g1, g2*0.75);
  vec3 col = mix(bgColor, gridColor, g*f);
  gl_FragColor = vec4(col, 1.0);
}`;
export function matGrid(scene: Scene){
  const m = makeMat(scene, "matGrid", "WB_GridFrag", ["gridColor","bgColor","cell","bold","fadeStart","fadeEnd"],[]);
  m.setColor3("gridColor", BABYLON.Color3.FromHexString("#4ee3ff")); m.setColor3("bgColor", BABYLON.Color3.FromHexString("#0b0f12"));
  m.setFloat("cell", 1.0); m.setFloat("bold", 10.0); m.setFloat("fadeStart", 30.0); m.setFloat("fadeEnd", 200.0);
  return m;
}

// 3) Checker (anti‑alias)
BABYLON.Effect.ShadersStore["WB_CheckerFragShader"] = `
precision highp float; varying vec3 vWPos; uniform vec3 a; uniform vec3 b; uniform float scale; 
float checker(vec2 p){ vec2 q=floor(p); return mod(q.x+q.y,2.0); }
void main(){ float c=checker(vWPos.xz/scale); vec3 col=mix(a,b,c); gl_FragColor=vec4(col,1.0);} 
`;
export function matChecker(scene: Scene){ const m=makeMat(scene,"matChecker","WB_CheckerFrag",["a","b","scale"],[]); m.setColor3("a",new BABYLON.Color3(0.18,0.18,0.2)); m.setColor3("b",new BABYLON.Color3(0.22,0.22,0.24)); m.setFloat("scale", 2.0); return m; }

// 4) Hologram (scanlines + fresnel + alpha)
BABYLON.Effect.ShadersStore["WB_HologramFragShader"] = `
precision highp float; varying vec3 vWPos; varying vec3 vWNorm; uniform float time; uniform vec3 tint; uniform float alpha;
void main(){
  float fres = pow(1.0 - clamp(dot(normalize(vWNorm), normalize(vec3(0,1,0))), 0.0, 1.0), 2.0);
  float scan = 0.5 + 0.5*sin(vWPos.y*20.0 + time*8.0);
  vec3 col = tint*(0.4+0.6*scan) + fres*0.8;
  gl_FragColor = vec4(col, alpha*(0.6+0.4*scan));
}`;
export function matHologram(scene: Scene){ const m=makeMat(scene,"matHologram","WB_HologramFrag",["time","tint","alpha"],[]); m.setFloat("time",0); m.setColor3("tint", new BABYLON.Color3(0.2,0.9,1)); m.setFloat("alpha",0.6); return m; }

// 5) Fresnel Rim (additive highlight)
BABYLON.Effect.ShadersStore["WB_FresnelFragShader"] = `
precision highp float; varying vec3 vWNorm; uniform vec3 color; uniform float power; 
void main(){ float f=pow(1.0-abs(dot(normalize(vWNorm), normalize(vec3(0,1,0)))), power); gl_FragColor=vec4(color*f, 1.0);} 
`;
export function matFresnel(scene: Scene){ const m=makeMat(scene,"matFresnel","WB_FresnelFrag",["color","power"],[]); m.setColor3("color", BABYLON.Color3.White()); m.setFloat("power", 2.0); return m; }

// 6) X‑Ray (depthish via normal facing)
BABYLON.Effect.ShadersStore["WB_XRayFragShader"] = `
precision highp float; varying vec3 vWNorm; uniform vec3 back; uniform vec3 edge; 
void main(){ float f=1.0-abs(dot(normalize(vWNorm), normalize(vec3(0,1,0)))); vec3 col=mix(back, edge, smoothstep(0.2,0.9,f)); gl_FragColor=vec4(col,1.0);} 
`;
export function matXRay(scene: Scene){ const m=makeMat(scene,"matXRay","WB_XRayFrag",["back","edge"],[]); m.setColor3("back", new BABYLON.Color3(0.0,0.1,0.2)); m.setColor3("edge", new BABYLON.Color3(0.2,0.9,1)); return m; }

// 7) Depth Fog (world‑space y height & distance)
BABYLON.Effect.ShadersStore["WB_FogFragShader"] = `
precision highp float; varying vec3 vWPos; uniform vec3 base; uniform vec3 fog; uniform float start; uniform float end; uniform float height;
void main(){ float d=length(vWPos.xz); float fd=smoothstep(start,end,d); float fh=clamp((vWPos.y)/height,0.0,1.0); vec3 col=mix(base,fog,max(fd,fh)); gl_FragColor=vec4(col,1.0);} 
`;
export function matFog(scene: Scene){ const m=makeMat(scene,"matFog","WB_FogFrag",["base","fog","start","end","height"],[]); m.setColor3("base", new BABYLON.Color3(0.15,0.16,0.18)); m.setColor3("fog", new BABYLON.Color3(0.4,0.45,0.5)); m.setFloat("start", 30); m.setFloat("end", 200); m.setFloat("height", 5); return m; }

// 8) Toon Ramp (1D ramp texture)
BABYLON.Effect.ShadersStore["WB_ToonFragShader"] = `
precision highp float; varying vec3 vWNorm; uniform sampler2D ramp; uniform vec3 tint; 
void main(){ float nd = clamp(dot(normalize(vWNorm), normalize(vec3(0,1,0))),0.0,1.0); vec3 col = texture2D(ramp, vec2(nd,0.5)).rgb * tint; gl_FragColor=vec4(col,1.0);} 
`;
export function matToon(scene: Scene, rampUrl: string){ const m=makeMat(scene,"matToon","WB_ToonFrag",["tint"],["ramp"]); m.setTexture("ramp", new BABYLON.Texture(rampUrl, scene)); m.setColor3("tint", BABYLON.Color3.White()); return m; }

// 9) Matcap (view‑space shading)
BABYLON.Effect.ShadersStore["WB_MatcapFragShader"] = `
precision highp float; varying vec3 vWNorm; uniform sampler2D matcap; 
vec2 ndc(vec3 n){ n=normalize(n); return n.xy*0.5+0.5; }
void main(){ vec2 uv = ndc(vWNorm); vec3 col = texture2D(matcap, uv).rgb; gl_FragColor=vec4(col,1.0);} 
`;
export function matMatcap(scene: Scene, url: string){ const m=makeMat(scene,"matMatcap","WB_MatcapFrag",[],["matcap"]); m.setTexture("matcap", new BABYLON.Texture(url, scene)); return m; }

// 10) Emissive Stripes (animate)
BABYLON.Effect.ShadersStore["WB_StripesFragShader"] = `
precision highp float; varying vec3 vWPos; uniform float time; uniform vec3 color; uniform float width; uniform float speed; uniform float scale; 
void main(){ float p = (vWPos.x + vWPos.z)*scale + time*speed; float s = smoothstep(0.0,width, abs(fract(p)-0.5)); vec3 col = color*(1.0-s*0.8); gl_FragColor=vec4(col,1.0);} 
`;
export function matStripes(scene: Scene){ const m=makeMat(scene,"matStripes","WB_StripesFrag",["time","color","width","speed","scale"],[]); m.setFloat("time",0); m.setColor3("color", new BABYLON.Color3(1,0.7,0.1)); m.setFloat("width",0.08); m.setFloat("speed",0.6); m.setFloat("scale",0.5); return m; }

// 11) Simple Water (scroll normals + tint)
BABYLON.Effect.ShadersStore["WB_WaterFragShader"] = `
precision highp float; varying vec3 vWPos; varying vec3 vWNorm; uniform sampler2D n1; uniform sampler2D n2; uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform float scale; 
vec3 dn(sampler2D t, vec2 uv){ vec3 n=texture2D(t,uv).rgb*2.0-1.0; return normalize(n);} 
void main(){ vec2 uv1 = vWPos.xz/scale + vec2(time*0.03, 0.0); vec2 uv2 = vWPos.xz/(scale*1.7) + vec2(0.0, time*0.02);
  vec3 n = normalize(dn(n1,uv1) + dn(n2,uv2)); float nd = clamp(dot(n, normalize(vec3(0,1,0))),0.0,1.0);
  vec3 col = mix(deep, shallow, nd);
  gl_FragColor = vec4(col, 0.9);
}`;
export function matWater(scene: Scene, n1url: string, n2url: string){ const m=makeMat(scene,"matWater","WB_WaterFrag",["time","deep","shallow","scale"],["n1","n2"]); m.setTexture("n1", new BABYLON.Texture(n1url, scene)); m.setTexture("n2", new BABYLON.Texture(n2url, scene)); m.setFloat("time",0); m.setColor3("deep", new BABYLON.Color3(0.02,0.08,0.12)); m.setColor3("shallow", new BABYLON.Color3(0.1,0.3,0.5)); m.setFloat("scale", 20); return m; }

// 12) Thin Glass (fake fresnel + tint)
BABYLON.Effect.ShadersStore["WB_GlassFragShader"] = `
precision highp float; varying vec3 vWNorm; uniform vec3 tint; uniform float alpha; uniform float fresnelPow; 
void main(){ float f=pow(1.0-abs(dot(normalize(vWNorm), normalize(vec3(0,1,0)))), fresnelPow); vec3 col = mix(tint, vec3(1.0), f*0.6); gl_FragColor=vec4(col, alpha*(0.4+0.6*f)); } 
`;
export function matGlass(scene: Scene){ const m=makeMat(scene,"matGlass","WB_GlassFrag",["tint","alpha","fresnelPow"],[]); m.setColor3("tint", new BABYLON.Color3(0.75,0.9,1.0)); m.setFloat("alpha", 0.2); m.setFloat("fresnelPow", 3.0); return m; }

// 13) Heat Haze (shimmer color)
BABYLON.Effect.ShadersStore["WB_HeatFragShader"] = `
precision highp float; varying vec3 vWPos; uniform float time; uniform vec3 base; 
void main(){ float w = sin(vWPos.x*3.0 + time*8.0)*sin(vWPos.z*2.5 + time*6.0); vec3 col = base + vec3(0.1*w, 0.08*w, 0.05*w); gl_FragColor=vec4(col,1.0);} 
`;
export function matHeat(scene: Scene){ const m=makeMat(scene,"matHeat","WB_HeatFrag",["time","base"],[]); m.setFloat("time",0); m.setColor3("base", new BABYLON.Color3(0.2,0.2,0.2)); return m; }

// 14) Asphalt (macro albedo + micro noise normal)
BABYLON.Effect.ShadersStore["WB_AsphaltFragShader"] = `
precision highp float; varying vec3 vWPos; varying vec3 vWNorm; uniform sampler2D base; uniform sampler2D microN; uniform float macro; uniform float micro; 
vec3 dn(sampler2D t, vec2 uv){ vec3 n=texture2D(t,uv).rgb*2.0-1.0; return normalize(n);} 
void main(){ vec3 albedo = texture2D(base, vWPos.xz/macro).rgb; vec3 n = normalize(mix(vWNorm, dn(microN, vWPos.xz/micro), 0.5)); float nd = clamp(dot(n, normalize(vec3(0,1,0))),0.0,1.0); vec3 col = albedo*(0.6+0.4*nd); gl_FragColor=vec4(col,1.0);} 
`;
export function matAsphalt(scene: Scene, baseUrl: string, microNUrl: string){ const m=makeMat(scene,"matAsphalt","WB_AsphaltFrag",["macro","micro"],["base","microN"]); m.setTexture("base", new BABYLON.Texture(baseUrl, scene)); m.setTexture("microN", new BABYLON.Texture(microNUrl, scene)); m.setFloat("macro", 8); m.setFloat("micro", 40); return m; }

// 15) Painted Line (mask blend on floor)
BABYLON.Effect.ShadersStore["WB_LineFragShader"] = `
precision highp float; varying vec3 vWPos; uniform vec3 line; uniform vec3 base; uniform float width; uniform float fade;
void main(){ float k = smoothstep(0.0, fade, abs(fract(vWPos.x/width)-0.5)); vec3 col = mix(line, base, k); gl_FragColor=vec4(col,1.0);} 
`;
export function matPaintLine(scene: Scene){ const m=makeMat(scene,"matPaintLine","WB_LineFrag",["line","base","width","fade"],[]); m.setColor3("line", new BABYLON.Color3(1,0.9,0.2)); m.setColor3("base", new BABYLON.Color3(0.22,0.23,0.25)); m.setFloat("width", 2.0); m.setFloat("fade", 0.1); return m; }

// 16) Brushed Metal (anisotropic look)
BABYLON.Effect.ShadersStore["WB_BrushedFragShader"] = `
precision highp float; varying vec3 vWPos; varying vec3 vWNorm; uniform vec3 base; uniform float streaks; 
void main(){ float a = sin((vWPos.x+vWPos.z)*streaks); float nd = clamp(dot(normalize(vWNorm), normalize(vec3(0,1,0))),0.0,1.0); vec3 col = base*(0.4+0.6*nd) + vec3(0.06*a);
  gl_FragColor=vec4(col,1.0);} 
`;
export function matBrushed(scene: Scene){ const m=makeMat(scene,"matBrushed","WB_BrushedFrag",["base","streaks"],[]); m.setColor3("base", new BABYLON.Color3(0.55,0.57,0.6)); m.setFloat("streaks", 15); return m; }

// 17) Glow Mask (pattern)
BABYLON.Effect.ShadersStore["WB_GlowMaskFragShader"] = `
precision highp float; varying vec3 vWPos; uniform vec3 base; uniform vec3 glow; uniform float scale; 
float pat(vec2 p){ p*=scale; return step(0.85, fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453)); }
void main(){ float m = pat(vWPos.xz); vec3 col = mix(base, glow, m); gl_FragColor=vec4(col,1.0);} 
`;
export function matGlowMask(scene: Scene){ const m=makeMat(scene,"matGlowMask","WB_GlowMaskFrag",["base","glow","scale"],[]); m.setColor3("base", new BABYLON.Color3(0.1,0.12,0.14)); m.setColor3("glow", new BABYLON.Color3(0.2,0.8,1)); m.setFloat("scale", 4); return m; }

// 18) Unlit Albedo (with AO multiply)
BABYLON.Effect.ShadersStore["WB_UnlitFragShader"] = `
precision highp float; varying vec3 vWPos; uniform sampler2D albedo; uniform sampler2D ao; uniform float macro; uniform float aoW; 
void main(){ vec3 c = texture2D(albedo, vWPos.xz/macro).rgb; float a = mix(1.0, texture2D(ao, vWPos.xz/macro).r, aoW); gl_FragColor = vec4(c*a,1.0);} 
`;
export function matUnlit(scene: Scene, albedoUrl: string, aoUrl: string){ const m=makeMat(scene,"matUnlit","WB_UnlitFrag",["macro","aoW"],["albedo","ao"]); m.setTexture("albedo", new BABYLON.Texture(albedoUrl, scene)); m.setTexture("ao", new BABYLON.Texture(aoUrl, scene)); m.setFloat("macro", 8); m.setFloat("aoW", 0.5); return m; }

// 19) SDF Ring Marker (placement gizmo)
BABYLON.Effect.ShadersStore["WB_RingFragShader"] = `
precision highp float; varying vec3 vWPos; uniform vec3 inner; uniform vec3 outer; uniform float radius; uniform float thickness; 
void main(){ float r = length(vWPos.xz); float ring = smoothstep(radius, radius+thickness, r) - smoothstep(radius+thickness, radius+thickness*1.5, r); vec3 col = mix(inner, outer, ring); gl_FragColor=vec4(col,1.0);} 
`;
export function matRing(scene: Scene){ const m=makeMat(scene,"matRing","WB_RingFrag",["inner","outer","radius","thickness"],[]); m.setColor3("inner", new BABYLON.Color3(0.0,0.6,1.0)); m.setColor3("outer", new BABYLON.Color3(0.0,0.1,0.2)); m.setFloat("radius", 1.0); m.setFloat("thickness", 0.15); return m; }

// 20) Height Gradient (terrain/wall grime)
BABYLON.Effect.ShadersStore["WB_HeightGradFragShader"] = `
precision highp float; varying vec3 vWPos; uniform vec3 low; uniform vec3 high; uniform float minY; uniform float maxY; 
void main(){ float t = clamp((vWPos.y - minY) / max(0.0001, (maxY - minY)), 0.0, 1.0); vec3 col = mix(low, high, t); gl_FragColor=vec4(col,1.0);} 
`;
export function matHeightGrad(scene: Scene){ const m=makeMat(scene,"matHeightGrad","WB_HeightGradFrag",["low","high","minY","maxY"],[]); m.setColor3("low", new BABYLON.Color3(0.15,0.15,0.16)); m.setColor3("high", new BABYLON.Color3(0.35,0.36,0.38)); m.setFloat("minY", 0); m.setFloat("maxY", 4); return m; }

// --- Time updaters for animated materials ---
export function tickMaterials(mats: BABYLON.ShaderMaterial[], t: number){
  for(const m of mats){ if(m.getEffect()?.getUniformIndex("time")!==-1){ m.setFloat("time", t); } }
}

// Usage example:
// const grid = matGrid(scene);
// mesh.material = grid;
// In render loop: tickMaterials([grid, ...], performance.now()*0.001);



