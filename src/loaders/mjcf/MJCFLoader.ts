import "@babylonjs/loaders";
import { OBJFileLoader } from "@babylonjs/loaders/OBJ";
import {
  Scene, SceneLoader, TransformNode, Texture, PBRMaterial,
  Color3, Vector3, Quaternion, AbstractMesh
} from "@babylonjs/core";
import JSZip from "jszip";

type LoadOpts = {
  rootUrl: string;         // folder that contains the XML and /assets
  mjcf: string;            // "robot.xml" or "iiwa14.xml"
  bakePivots?: boolean;    // default false
  fallbackGray?: boolean;  // default true
};

type MeshDef = {
  name: string;
  file: string;
  scale?: [number, number, number]; // from <asset><mesh scale="sx sy sz">
  className?: string | null;
};

type TexDef = { name: string; file: string };
type MatDef = { name: string; texture?: string; rgba?: [number, number, number, number] };

const textFetch = async (url: string) => {
  const r = await fetch(url);
  if (r.ok === false) throw new Error(`Fetch failed: ${r.status} ${r.statusText} @ ${url}`);
  const t = await r.text();
  if (t.trim().length === 0) throw new Error(`Empty file @ ${url}`);
  return t;
};

const toFloatArr = (s: string | null) => {
  if (s === null) return null;
  const parts = s.trim().split(/\s+/);
  if (parts.length === 0) return null;
  const vals = parts.map(Number);
  if (vals.some(v => Number.isFinite(v) === false)) return null;
  return vals;
};

const quatWXYZtoBabylon = (wxyz: number[]) => {
  if (wxyz.length < 4) return Quaternion.Identity();
  const [w, x, y, z] = wxyz;
  return new Quaternion(x, y, z, w);
};

const colorFromRGBA = (rgba: number[]) => {
  if (rgba.length < 3) return new Color3(0.7, 0.7, 0.7);
  return new Color3(rgba[0], rgba[1], rgba[2]);
};

const parseMJCF = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr !== null) throw new Error("Invalid MJCF XML");

  // compiler scale (global)
  let compilerScale = 1.0;
  const compiler = doc.querySelector("compiler");
  if (compiler !== null) {
    const s = compiler.getAttribute("scale");
    const v = s ? Number(s) : NaN;
    if (Number.isFinite(v) && v > 0) compilerScale = v;
  }

  const asset = doc.querySelector("asset");
  const meshMap: Record<string, MeshDef> = {};
  const texMap: Record<string, TexDef> = {};
  const matMap: Record<string, MatDef> = {};

  if (asset !== null) {
    asset.querySelectorAll("mesh").forEach(m => {
      const file = m.getAttribute("file");
      if (file === null || file.trim().length === 0) return;
      const nameAttr = m.getAttribute("name");
      const name = nameAttr && nameAttr.trim().length > 0
        ? nameAttr
        : file.replace(/\.(obj|stl)$/i, "");
      const s = toFloatArr(m.getAttribute("scale"));
      const scale = s && s.length >= 3 ? [s[0], s[1], s[2]] as [number, number, number] : undefined;
      meshMap[name] = { name, file, scale, className: m.getAttribute("class") };
    });

    asset.querySelectorAll("texture").forEach(t => {
      const name = t.getAttribute("name");
      const file = t.getAttribute("file");
      if (name === null || file === null) return;
      texMap[name] = { name, file };
    });

    asset.querySelectorAll("material").forEach(m => {
      const name = m.getAttribute("name");
      if (name === null) return;
      const texture = m.getAttribute("texture") || undefined;
      const rgba = toFloatArr(m.getAttribute("rgba")) as number[] | null;
      matMap[name] = { name, texture, rgba: (rgba || undefined) as any };
    });
  }

  const world = doc.querySelector("worldbody");
  if (world === null) throw new Error("No <worldbody> in MJCF");

  return { world, meshMap, texMap, matMap, compilerScale };
};

const makeMaterials = (
  scene: Scene,
  rootUrl: string,
  texMap: Record<string, TexDef>,
  matMap: Record<string, MatDef>
) => {
  const textures: Record<string, Texture> = {};
  const pbrs: Record<string, PBRMaterial> = {};

  Object.values(texMap).forEach(t => {
    const url = `${rootUrl}/assets/${t.file}`;
    textures[t.name] = new Texture(url, scene);
  });

  Object.values(matMap).forEach(m => {
    const p = new PBRMaterial(m.name, scene);
    if (typeof m.texture === "string" && textures[m.texture] !== undefined) p.albedoTexture = textures[m.texture];
    if (Array.isArray(m.rgba)) p.albedoColor = colorFromRGBA(m.rgba);
    p.metallic = 0.0; p.roughness = 0.7;
    pbrs[m.name] = p;
  });

  // Heuristic fallbacks for KUKA iiwa colors
  if (pbrs["orange"] === undefined) {
    const o = new PBRMaterial("orange", scene);
    o.albedoColor = new Color3(1.0, 0.423529, 0.0392157); o.metallic = 0; o.roughness = 0.7;
    pbrs["orange"] = o;
  }
  if (pbrs["gray"] === undefined) {
    const g = new PBRMaterial("gray", scene);
    g.albedoColor = new Color3(0.4, 0.4, 0.4); g.metallic = 0; g.roughness = 0.7;
    pbrs["gray"] = g;
  }
  if (pbrs["black"] === undefined) {
    const b = new PBRMaterial("black", scene);
    b.albedoColor = new Color3(0.0, 0.0, 0.0); b.metallic = 0; b.roughness = 0.7;
    pbrs["black"] = b;
  }

  return { textures, pbrs };
};

const importVisualMesh = async (scene: Scene, rootUrl: string, file: string, meshFilesMap?: Map<string, File>) => {
  // If we have mesh files from ZIP, use them directly
  if (meshFilesMap && meshFilesMap.has(file)) {
    const meshFile = meshFilesMap.get(file)!;
    console.log(`[MJCF Import] Loading mesh from ZIP: ${file} (${meshFile.size} bytes)`);

    try {
          // Read file as ArrayBuffer
      const arrayBuffer = await meshFile.arrayBuffer();
          const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
          const objectURL = URL.createObjectURL(blob);

      // Detect file type for plugin hint
      const isObj = file.toLowerCase().endsWith('.obj');
      const isStl = file.toLowerCase().endsWith('.stl');
      const pluginExt = isObj ? '.obj' : isStl ? '.stl' : '';

      // Use callback-based SceneLoader like the original Google Robot loader
      return new Promise<AbstractMesh[]>((resolve, reject) => {
        // Save and restore OBJ MTL skip setting
        const prevSkip = OBJFileLoader.SKIP_MATERIALS;
        OBJFileLoader.SKIP_MATERIALS = true;

        SceneLoader.ImportMesh(
                '',         // All meshes
                '',         // No root URL needed for blob
                objectURL,  // Blob URL
                scene,
                (loadedMeshes) => {
            console.log(`[MJCF Import] SceneLoader returned ${loadedMeshes.length} meshes for ${file}`);
                  URL.revokeObjectURL(objectURL);
            OBJFileLoader.SKIP_MATERIALS = prevSkip; // Restore
            loadedMeshes.forEach(m => m.scaling.set(1, 1, 1));
            resolve(loadedMeshes);
                },
                undefined, // Progress callback
                (_scene, message) => {
            console.error(`[MJCF Import] SceneLoader.ImportMesh failed for ${file}:`, message);
                  URL.revokeObjectURL(objectURL);
            OBJFileLoader.SKIP_MATERIALS = prevSkip; // Restore
                  reject(new Error(message));
                },
          pluginExt   // Plugin extension
              );
            });
  } catch (error) {
      console.error(`[MJCF Import] Failed to load mesh from ZIP: ${file}`, error);
      return [];
    }
  }

  // Regular URL-based loading
  const res = await SceneLoader.ImportMeshAsync("", `${rootUrl}/assets/`, file, scene);
  if (res.meshes.length === 0) return [] as AbstractMesh[];
  res.meshes.forEach(m => m.scaling.set(1, 1, 1));
  return res.meshes as AbstractMesh[];
};

const bakePivotsIfRequested = (meshes: AbstractMesh[]) => {
  meshes.forEach(m => {
    if (m.rotationQuaternion === null || m.rotationQuaternion === undefined) {
      m.rotationQuaternion = Quaternion.Identity();
    }
    // m.bakeCurrentTransformIntoVertices(); // May not be available in all Babylon.js versions
  });
};

const assignGeomMaterial = (
  meshes: AbstractMesh[],
  geom: Element,
  pbrs: Record<string, PBRMaterial>,
  fallbackGray: boolean,
  warned: Set<string>
) => {
  // per-geom RGBA overrides named material
  const rgba = toFloatArr(geom.getAttribute("rgba"));
  if (Array.isArray(rgba) && rgba.length >= 3) {
    const p = new PBRMaterial(`geom_rgba_${Math.random().toString(36).slice(2)}`, meshes[0].getScene());
    p.albedoColor = colorFromRGBA(rgba);
    p.metallic = 0; p.roughness = 0.7;
    meshes.forEach(m => (m.material = p));
    return;
  }

  const matName = geom.getAttribute("material");
  if (typeof matName === "string" && matName.length > 0 && pbrs[matName] !== undefined) {
    meshes.forEach(m => (m.material = pbrs[matName]));
    return;
  }

  if (fallbackGray === true) meshes.forEach(m => (m.material = pbrs["gray"]));
  if (typeof matName === "string" && matName.length > 0 && warned.has(matName) === false) {
    console.warn(`material '${matName}' not found; applied gray`);
    warned.add(matName);
  }
};

const multiplyScale = (node: TransformNode, v: Vector3) => {
  node.scaling.multiplyInPlace(v);
};

const buildBodies = async (
  scene: Scene,
  rootUrl: string,
  world: Element,
  meshMap: Record<string, MeshDef>,
  pbrs: Record<string, PBRMaterial>,
  bakePivots: boolean,
  fallbackGray: boolean,
  compilerScale: number,
  meshFilesMap?: Map<string, File>
) => {
  const root = new TransformNode("mjcf_root", scene);
  // No root rotation needed - STL loader already handles Y-up orientation
  root.scaling.set(1, 1, 1);

  const warnedMissingMaterials = new Set<string>();

  const visit = async (bodyEl: Element, parent: TransformNode) => {
    const name = bodyEl.getAttribute("name") || "body";
    const bodyNode = new TransformNode(name, scene);
    bodyNode.parent = parent;
    bodyNode.scaling.set(1, 1, 1);

    const bodyPos = toFloatArr(bodyEl.getAttribute("pos"));
    if (bodyPos !== null && bodyPos.length >= 3) {
      // Convert from MuJoCo Z-up to Babylon.js Y-up: (x,y,z) → (x,z,y)
      bodyNode.position.set(bodyPos[0], bodyPos[2], bodyPos[1]);
    }

    const bodyQuat = toFloatArr(bodyEl.getAttribute("quat"));
    if (bodyQuat !== null && bodyQuat.length >= 4) bodyNode.rotationQuaternion = quatWXYZtoBabylon(bodyQuat);

    // body-level scale (rare): MJCF bodies don't have scale; we only apply compilerScale
    if (compilerScale !== 1) multiplyScale(bodyNode, new Vector3(compilerScale, compilerScale, compilerScale));

    // Visual geoms on this body
    const geoms = Array.from(bodyEl.querySelectorAll(":scope > geom"));
    for (const geom of geoms) {
      const cls = geom.getAttribute("class");
      const type = geom.getAttribute("type");
      const meshRef = geom.getAttribute("mesh");

      // Treat as visual if class contains "visual" OR (no class) AND (type="mesh" && meshRef present)
      const isVisualByClass = typeof cls === "string" && cls.indexOf("visual") >= 0;
      const isMeshGeom = type === "mesh" && typeof meshRef === "string" && meshRef.length > 0;
      const isVisual = isVisualByClass || (cls === null && isMeshGeom === true);
      if (isVisual === false) continue;

      if (meshRef === null) {
        console.warn(`visual geom on '${name}' has no mesh`);
        continue;
      }

      const def = meshMap[meshRef];
      if (def === undefined) {
        console.warn(`mesh '${meshRef}' not found in <asset> for body '${name}'`);
        continue;
      }

      // geom-local transform
      const geomNode = new TransformNode(`${name}__geom_${meshRef}`, scene);
      geomNode.parent = bodyNode;
      geomNode.scaling.set(1, 1, 1);

      const gpos = toFloatArr(geom.getAttribute("pos"));
      if (gpos !== null && gpos.length >= 3) geomNode.position.set(gpos[0], gpos[1], gpos[2]);

      const gquat = toFloatArr(geom.getAttribute("quat"));
      if (gquat !== null && gquat.length >= 4) geomNode.rotationQuaternion = quatWXYZtoBabylon(gquat);

      // Effective scale: compiler * mesh.scale * geom.scale
      let sx = compilerScale, sy = compilerScale, sz = compilerScale;
      if (Array.isArray(def.scale) && def.scale.length === 3) {
        sx *= def.scale[0]; sy *= def.scale[1]; sz *= def.scale[2];
        console.log(`[MJCF Scale] Mesh '${meshRef}' has scale: (${def.scale[0]}, ${def.scale[1]}, ${def.scale[2]})`);
      }
      const gscale = toFloatArr(geom.getAttribute("scale"));
      if (Array.isArray(gscale) && gscale.length >= 3) {
        sx *= gscale[0]; sy *= gscale[1]; sz *= gscale[2];
        console.log(`[MJCF Scale] Geom '${name}/${meshRef}' has scale: (${gscale[0]}, ${gscale[1]}, ${gscale[2]})`);
      }

      multiplyScale(geomNode, new Vector3(sx, sy, sz));
      if (sx !== 1 || sy !== 1 || sz !== 1) {
        console.warn(`[MJCF Scale] Final effective scale @ '${name}/${meshRef}': (${sx.toFixed(4)}, ${sy.toFixed(4)}, ${sz.toFixed(4)})`);
      }

      const meshes = await importVisualMesh(scene, rootUrl, def.file, meshFilesMap);
      if (meshes.length === 0) {
        console.warn(`file '${def.file}' produced no meshes for body '${name}'`);
        continue;
      }
      meshes.forEach(m => { m.parent = geomNode; m.scaling.set(1, 1, 1); });

      assignGeomMaterial(meshes, geom, pbrs, fallbackGray, warnedMissingMaterials);
      if (bakePivots === true) bakePivotsIfRequested(meshes);
    }

    const children = Array.from(bodyEl.querySelectorAll(":scope > body"));
    for (const child of children) await visit(child, bodyNode);
  };

  const tops = Array.from(world.querySelectorAll(":scope > body"));
  if (tops.length === 0) {
    console.warn("No top-level <body> under <worldbody>");
    return root;
  }
  for (const b of tops) await visit(b, root);
  return root;
};

/**
 * Analyzes MJCF XML content to determine if it's a robot model
 * Returns true if this appears to be a robot model file
 */
function analyzeMJCFContent(content: string, filename: string): boolean {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');
    
    // Check for XML parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.warn(`[MJCF Analysis] XML parse error in ${filename}: ${parseError.textContent}`);
      return false;
    }
    
    // Look for mujoco root element
    const mujoco = doc.querySelector('mujoco');
    if (!mujoco) {
      console.log(`[MJCF Analysis] No <mujoco> root element in ${filename}`);
      return false;
    }
    
    // Check for worldbody with bodies (robot models have this)
    const worldbody = mujoco.querySelector('worldbody');
    if (!worldbody) {
      console.log(`[MJCF Analysis] No <worldbody> in ${filename}`);
      return false;
    }
    
    // Count bodies - robot models typically have multiple bodies
    const bodies = worldbody.querySelectorAll('body');
    const bodyCount = bodies.length;
    
    // Count assets - robot models typically have meshes/textures
    const meshes = mujoco.querySelectorAll('asset mesh');
    const textures = mujoco.querySelectorAll('asset texture');
    const materials = mujoco.querySelectorAll('asset material');
    
    // Count geoms - robot models have visual/collision geometry
    const geoms = mujoco.querySelectorAll('geom');
    const visualGeoms = mujoco.querySelectorAll('geom[class="visual"]');
    
    // Robot model indicators
    const hasMultipleBodies = bodyCount > 1;
    const hasAssets = meshes.length > 0 || textures.length > 0 || materials.length > 0;
    const hasGeometry = geoms.length > 0;
    const hasVisualGeometry = visualGeoms.length > 0;
    
    // Check for include statements (scene files often include robot models)
    const includes = mujoco.querySelectorAll('include');
    const hasIncludes = includes.length > 0;
    
    // Scene files typically have no bodies or very few bodies, but may include robot models
    const isSceneFile = filename.toLowerCase().includes('scene');
    
    // Gripper files are typically sub-components
    const isGripperFile = filename.toLowerCase().includes('gripper');
    
    console.log(`[MJCF Analysis] ${filename}: bodies=${bodyCount}, meshes=${meshes.length}, geoms=${geoms.length}, visual=${visualGeoms.length}, includes=${includes.length}`);
    
    // Decision logic - Only prioritize scene files if they have actual bodies
    if (isSceneFile && hasIncludes && bodyCount > 0) {
      console.log(`[MJCF Analysis] Detected scene file with includes AND bodies: ${filename}`);
      return true;
    }
    
    if (isSceneFile && !hasIncludes && bodyCount <= 1) {
      console.log(`[MJCF Analysis] Detected empty scene file: ${filename}`);
      return false;
    }
    
    if (isSceneFile && hasIncludes && bodyCount === 0) {
      console.log(`[MJCF Analysis] Detected scene file with includes but no bodies: ${filename} (will be skipped)`);
      return false;
    }
    
    if (isGripperFile && bodyCount <= 3) {
      console.log(`[MJCF Analysis] Detected gripper sub-component: ${filename}`);
      return false;
    }
    
    // Robot model criteria
    if (hasMultipleBodies && hasGeometry) {
      console.log(`[MJCF Analysis] Detected robot model: ${filename} (multiple bodies + geometry)`);
      return true;
    }
    
    if (hasAssets && hasVisualGeometry) {
      console.log(`[MJCF Analysis] Detected robot model: ${filename} (assets + visual geometry)`);
      return true;
    }
    
    if (bodyCount >= 3 && hasGeometry) {
      console.log(`[MJCF Analysis] Detected robot model: ${filename} (3+ bodies + geometry)`);
      return true;
    }
    
    console.log(`[MJCF Analysis] Not a robot model: ${filename}`);
    return false;
    
  } catch (error) {
    console.warn(`[MJCF Analysis] Error analyzing ${filename}:`, error);
    return false;
  }
}

// ZIP handling functions
export const loadMJCFFromFile = async (file: File, scene: Scene): Promise<{ success: boolean; rootNodes: TransformNode[]; meshes: AbstractMesh[]; joints: any[]; actuators: any[]; errors: string[]; warnings: string[] }> => {
  if (!file || !file.name) {
    throw new Error("Invalid file: missing name property");
  }
  
  console.log(`[MJCF Import] Starting import of ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

  try {
    // Check if it's a ZIP file
    if (file.name.toLowerCase().endsWith('.zip')) {
      console.log(`[MJCF Import] Extracting ZIP file: ${file.name}`);
      
      const zip = new JSZip();
      const zipData = await file.arrayBuffer();
      const zipContents = await zip.loadAsync(zipData);

      const extractedMeshFiles = new Map<string, File>();
      let mjcfContent = '';
      let primaryMjcfFile = '';

      // First pass: collect all MJCF files and analyze them
      const mjcfFiles: Array<{basename: string, content: string, isRobotModel: boolean}> = [];
      
      for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
        if (zipEntry.dir) continue;

        const lowerName = filename.toLowerCase();
        const basename = filename.split('/').pop() || filename;

        // Look for MJCF files
        if (lowerName.endsWith('.xml')) {
          const content = await zipEntry.async('text');
          console.log(`[MJCF Import] Found MJCF file in ZIP: ${basename}`);
          
          // Analyze XML content to determine if it's a robot model
          const isRobotModel = analyzeMJCFContent(content, basename);
          mjcfFiles.push({basename, content, isRobotModel});
        }
      }
      
      // Second pass: select the best MJCF file
      // Priority: 1) Valid robot models, 2) Non-scene fallback files
      for (const mjcfFile of mjcfFiles) {
        if (mjcfFile.isRobotModel) {
          console.log(`[MJCF Import] Detected robot model in: ${mjcfFile.basename}`);
          mjcfContent = mjcfFile.content;
          primaryMjcfFile = mjcfFile.basename;
          console.log(`[MJCF Import] Selected primary MJCF file: ${mjcfFile.basename}`);
          break; // Use the first valid robot model found
        }
      }
      
      // If no robot model found, use first non-scene file as fallback
      if (mjcfContent === '') {
        for (const mjcfFile of mjcfFiles) {
          const isSceneFile = mjcfFile.basename.toLowerCase().includes('scene');
          if (!isSceneFile) {
            console.log(`[MJCF Import] Using fallback file: ${mjcfFile.basename}`);
            mjcfContent = mjcfFile.content;
            primaryMjcfFile = mjcfFile.basename;
            break;
          }
        }
      }
      
      // Third pass: extract mesh files
      for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
        if (zipEntry.dir) continue;

        const lowerName = filename.toLowerCase();
        const basename = filename.split('/').pop() || filename;

        // Look for mesh files
        if (lowerName.endsWith('.obj') || lowerName.endsWith('.stl')) {
          const blob = await zipEntry.async('blob');
          const meshFile = new File([blob], basename, { type: 'application/octet-stream' });
          extractedMeshFiles.set(basename, meshFile);
          console.log(`[MJCF Import] Found mesh file in ZIP: ${basename} (from ${filename})`);
        }
      }

      if (mjcfContent === '') {
        throw new Error('No MJCF file found in ZIP');
      }

      console.log(`[MJCF Import] Using ${primaryMjcfFile} as primary MJCF file`);
      console.log(`[MJCF Import] Extracted ${extractedMeshFiles.size} mesh files from ZIP`);

      // Parse MJCF directly and build the model
      const { world, meshMap, texMap, matMap, compilerScale } = parseMJCF(mjcfContent);
      const { pbrs } = makeMaterials(scene, "", texMap, matMap);

      // root: Apply model-specific coordinate system rotations
      const root = new TransformNode("mjcf_root", scene);
      root.scaling.set(1, 1, 1);

      // warn if compiler scale is not 1
      if (compilerScale !== 1) console.warn(`compiler scale = ${compilerScale}`);
      console.log(`[MJCF Debug] Compiler scale: ${compilerScale}`);

      const warnedMissingMaterials = new Set<string>();
      const allMeshes: AbstractMesh[] = [];
      const rgbaCache = new Map<string, PBRMaterial>(); // geom rgba override cache

      const allBodyNodes: TransformNode[] = [];
      
      const visit = async (bodyEl: Element, parent: TransformNode): Promise<TransformNode> => {
        const name = bodyEl.getAttribute("name") || "body";
        console.log(`[MJCF Debug] Processing body: ${name}`);
        const bodyNode = new TransformNode(name, scene);
        bodyNode.parent = parent;
        bodyNode.scaling.set(1, 1, 1);
        
        // Track all body nodes for kinematic chain
        allBodyNodes.push(bodyNode);

        const bodyPos = toFloatArr(bodyEl.getAttribute("pos"));
        if (bodyPos !== null && bodyPos.length >= 3) {
          // Convert from MuJoCo Z-up to Babylon.js Y-up: (x,y,z) → (x,z,y)
          bodyNode.position.set(bodyPos[0], bodyPos[2], bodyPos[1]);
          console.log(`[MJCF Debug] Transformed body position for ${name}: (${bodyPos[0]}, ${bodyPos[1]}, ${bodyPos[2]}) -> (${bodyPos[0]}, ${bodyPos[2]}, ${bodyPos[1]})`);
        }

        const bodyQuat = toFloatArr(bodyEl.getAttribute("quat"));
        if (bodyQuat !== null && bodyQuat.length >= 4) bodyNode.rotationQuaternion = quatWXYZtoBabylon(bodyQuat);

        // apply compiler scale on body node as scale (keeps mesh scale neutral)
        if (compilerScale !== 1) bodyNode.scaling.multiplyInPlace(new Vector3(compilerScale, compilerScale, compilerScale));

        // Process joints within this body
        const joints = Array.from(bodyEl.querySelectorAll(":scope > joint"));
        console.log(`[MJCF Debug] Body '${name}' has ${joints.length} joints`);
        for (const joint of joints) {
          const jointName = joint.getAttribute("name") || "joint";
          const jointType = joint.getAttribute("type") || "fixed";
          console.log(`[MJCF Debug] Processing joint: ${jointName} (type: ${jointType})`);
          
          // Debug: Log all joint attributes
          const jointAttrs = Array.from(joint.attributes).map(attr => `${attr.name}="${attr.value}"`).join(", ");
          console.log(`[MJCF Debug] Joint ${jointName} attributes: ${jointAttrs}`);
          
          // Process joint position
          const jointPos = toFloatArr(joint.getAttribute("pos"));
          if (jointPos !== null && jointPos.length >= 3) {
            // Transform joint position from MuJoCo Z-up to Babylon.js Y-up coordinate system
            // Z-up: (x, y, z) -> Y-up: (x, z, -y)
            const transformedPos = new Vector3(jointPos[0], jointPos[2], -jointPos[1]);
            console.log(`[MJCF Debug] Joint ${jointName} position: (${jointPos[0]}, ${jointPos[1]}, ${jointPos[2]}) -> (${transformedPos.x}, ${transformedPos.y}, ${transformedPos.z})`);
            
            // Apply joint position to body node
            bodyNode.position.addInPlace(transformedPos);
          }
          
          // Process joint axis and apply rotation for fixed joints
          const jointAxis = toFloatArr(joint.getAttribute("axis"));
          if (jointAxis !== null && jointAxis.length >= 3) {
            // Transform joint axis from MuJoCo Z-up to Babylon.js Y-up coordinate system
            const transformedAxis = new Vector3(jointAxis[0], jointAxis[2], -jointAxis[1]);
            console.log(`[MJCF Debug] Joint ${jointName} axis: (${jointAxis[0]}, ${jointAxis[1]}, ${jointAxis[2]}) -> (${transformedAxis.x}, ${transformedAxis.y}, ${transformedAxis.z})`);
            
            // Apply joint rotation based on joint type and range
            if (jointType === "fixed" || jointType === "hinge") {
              // Get joint range to determine starting position
              const jointRange = joint.getAttribute("range");
              let jointValue = 0; // Default starting value
              
              if (jointRange) {
                const rangeValues = jointRange.split(" ").map(parseFloat);
                if (rangeValues.length >= 2) {
                  // For starting pose, use the midpoint of the range or a specific starting value
                  // This is a heuristic - in a full implementation, we'd need to know the actual starting pose
                  const minRange = rangeValues[0];
                  const maxRange = rangeValues[1];
                  
                  // Use midpoint as starting position for now
                  jointValue = (minRange + maxRange) / 2;
                  
                  console.log(`[MJCF Debug] Joint ${jointName} range: [${minRange}, ${maxRange}], starting value: ${jointValue}`);
                }
              }
              
              // Normalize the axis vector
              const normalizedAxis = transformedAxis.normalize();
              
              // Apply rotation based on joint value
              if (normalizedAxis.length() > 0.1 && Math.abs(jointValue) > 0.001) {
                const rotationQuat = Quaternion.RotationAxis(normalizedAxis, jointValue);
                
                // Apply rotation to body node
                if (bodyNode.rotationQuaternion) {
                  bodyNode.rotationQuaternion.multiplyInPlace(rotationQuat);
        } else {
                  bodyNode.rotationQuaternion = rotationQuat;
                }
                
                console.log(`[MJCF Debug] Applied joint rotation for ${jointName}: ${jointValue} radians around axis (${normalizedAxis.x}, ${normalizedAxis.y}, ${normalizedAxis.z})`);
              }
            }
          }
          
          // Process joint quaternion if present (for more precise orientation)
          const jointQuat = toFloatArr(joint.getAttribute("quat"));
          if (jointQuat !== null && jointQuat.length >= 4) {
            // Transform joint quaternion from MuJoCo Z-up to Babylon.js Y-up coordinate system
            const transformedQuat = quatWXYZtoBabylon(jointQuat);
            console.log(`[MJCF Debug] Joint ${jointName} quaternion: (${jointQuat[0]}, ${jointQuat[1]}, ${jointQuat[2]}, ${jointQuat[3]}) -> applied to body`);
            
            // Apply joint quaternion to body node
            if (bodyNode.rotationQuaternion) {
              bodyNode.rotationQuaternion.multiplyInPlace(transformedQuat);
        } else {
              bodyNode.rotationQuaternion = transformedQuat;
            }
          }
        }

        // Visual geoms on this body
        const geoms = Array.from(bodyEl.querySelectorAll(":scope > geom"));
        console.log(`[MJCF Debug] Body '${name}' has ${geoms.length} geoms`);
        for (const geom of geoms) {
          // Treat as visual if class contains "visual" OR (type="mesh" AND mesh present)
          const cls = geom.getAttribute("class");
          const type = geom.getAttribute("type");
          const meshRef = geom.getAttribute("mesh");
          const hasClassVisual = typeof cls === "string" && cls.indexOf("visual") >= 0;
          const isMeshType = typeof type === "string" && type === "mesh";
          const looksVisual = hasClassVisual || (isMeshType && typeof meshRef === "string");

          console.log(`[MJCF Debug] Geom: class='${cls}', type='${type}', mesh='${meshRef}', looksVisual=${looksVisual}`);
          if (looksVisual === false) continue;
          if (meshRef === null) {
            console.warn(`visual geom on '${name}' has no mesh`);
            continue;
          }
          const def = meshMap[meshRef];
          if (def === undefined) {
            console.warn(`mesh '${meshRef}' not found in <asset> for body '${name}'`);
            continue;
          }

          // geom-local transform
          const geomNode = new TransformNode(`${name}__geom_${meshRef}`, scene);
          geomNode.parent = bodyNode;
          geomNode.scaling.set(1, 1, 1);

          const gpos = toFloatArr(geom.getAttribute("pos"));
          if (gpos !== null && gpos.length >= 3) geomNode.position.set(gpos[0], gpos[1], gpos[2]);

          const gquat = toFloatArr(geom.getAttribute("quat"));
          if (gquat !== null && gquat.length >= 4) geomNode.rotationQuaternion = quatWXYZtoBabylon(gquat);

          // TEMPORARY FIX: Disable all scaling to prevent kinematic chain accumulation
          // TODO: Implement proper scaling that doesn't compound through hierarchy
          console.log(`[MJCF Debug] Skipping scaling for geom '${name}/${meshRef}' to prevent kinematic accumulation`);

          const meshes = await importVisualMesh(scene, "", def.file, extractedMeshFiles);
          if (meshes.length === 0) {
            console.warn(`file '${def.file}' produced no meshes for body '${name}'`);
            continue;
          }
          meshes.forEach(m => { 
            m.scaling.set(1, 1, 1);
            
            // Don't apply rotation to individual meshes - coordinate system conversion
            // will be applied at the root level to preserve kinematic relationships
            
            m.parent = geomNode;
            
            // Log detailed transformation info
            const bbox = m.getBoundingInfo().boundingBox;
            const size = bbox.maximum.subtract(bbox.minimum);
            console.log(`[MJCF Debug] Mesh '${def.file}' BEFORE parent assignment:`);
            console.log(`  - Mesh scaling: (${m.scaling.x}, ${m.scaling.y}, ${m.scaling.z})`);
            console.log(`  - Mesh position: (${m.position.x}, ${m.position.y}, ${m.position.z})`);
            console.log(`  - Mesh dimensions: (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`);
            console.log(`  - GeomNode scaling: (${geomNode.scaling.x}, ${geomNode.scaling.y}, ${geomNode.scaling.z})`);
            console.log(`  - GeomNode position: (${geomNode.position.x}, ${geomNode.position.y}, ${geomNode.position.z})`);
            console.log(`  - BodyNode scaling: (${bodyNode.scaling.x}, ${bodyNode.scaling.y}, ${bodyNode.scaling.z})`);
            console.log(`  - BodyNode position: (${bodyNode.position.x}, ${bodyNode.position.y}, ${bodyNode.position.z})`);
            console.log(`  - Root scaling: (${root.scaling.x}, ${root.scaling.y}, ${root.scaling.z})`);
            console.log(`  - Mesh rotation quaternion: (${m.rotationQuaternion?.x || 0}, ${m.rotationQuaternion?.y || 0}, ${m.rotationQuaternion?.z || 0}, ${m.rotationQuaternion?.w || 1})`);
          });
          
          // Log AFTER parent assignment to see final world transform
          meshes.forEach(m => {
            const worldPos = m.getAbsolutePosition();
            const worldScale = m.absoluteScaling;
            console.log(`[MJCF Debug] Mesh '${def.file}' AFTER parent assignment:`);
            console.log(`  - World position: (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
            console.log(`  - World scaling: (${worldScale.x.toFixed(3)}, ${worldScale.y.toFixed(3)}, ${worldScale.z.toFixed(3)})`);
          });
          
          meshes.forEach(m => allMeshes.push(m));

          // Material assignment
          const rgbaAttr = toFloatArr(geom.getAttribute("rgba"));
          if (rgbaAttr !== null && rgbaAttr.length >= 3) {
            const key = rgbaAttr.slice(0, 4).join(",");
            let mat = rgbaCache.get(key);
            if (mat === undefined) {
              mat = new PBRMaterial(`rgba_${key}`, scene);
              mat.albedoColor = colorFromRGBA(rgbaAttr);
              mat.metallic = 0; mat.roughness = 0.7;
              rgbaCache.set(key, mat);
            }
            meshes.forEach(m => (m.material = mat));
  } else {
            const matName = geom.getAttribute("material");
            if (typeof matName === "string" && matName.length > 0 && pbrs[matName] !== undefined) {
              meshes.forEach(m => (m.material = pbrs[matName]));
            } else {
              meshes.forEach(m => (m.material = pbrs["gray"]));
              if (typeof matName === "string" && matName.length > 0 && warnedMissingMaterials.has(matName) === false) {
                console.warn(`material '${matName}' not found; applied gray`);
                warnedMissingMaterials.add(matName);
              }
            }
          }
        }

        const children = Array.from(bodyEl.querySelectorAll(":scope > body"));
        console.log(`[MJCF Debug] Body '${name}' has ${children.length} child bodies`);
        for (const child of children) {
          const childName = child.getAttribute("name") || "child";
          console.log(`[MJCF Debug] Processing child body: ${childName} under parent: ${name}`);
          await visit(child, bodyNode);
        }
        
        return bodyNode;
      };

      const tops = Array.from(world.querySelectorAll(":scope > body"));
      if (tops.length === 0) {
        console.warn("No top-level <body> under <worldbody>");
        const flattened = root.getChildMeshes() as AbstractMesh[];
        return {
    success: true,
          meshes: flattened.length > 0 ? flattened : allMeshes,
          rootNodes: [root],
    joints: [],
          actuators: [],
    errors: [],
    warnings: []
  };
      }
      
      // Process all bodies first to collect them
      for (const b of tops) {
        await visit(b, root);
      }
      
      // Preserve kinematic hierarchy - don't flatten all bodies to root
      // The recursive visit() function already establishes correct parent-child relationships
      console.log(`[MJCF Debug] Preserving kinematic hierarchy with ${allBodyNodes.length} bodies`);
      
      // Debug: Show the actual hierarchy being created
      console.log(`[MJCF Debug] Final hierarchy structure:`);
      const logHierarchy = (node: TransformNode, indent: string = "") => {
        console.log(`${indent}${node.name} (parent: ${node.parent?.name || 'none'})`);
        node.getChildren().forEach(child => {
          if (child instanceof TransformNode) {
            logHierarchy(child, indent + "  ");
          }
        });
      };
      logHierarchy(root);
      
      // Apply Z-up to Y-up coordinate system conversion
      // Convert positions from MuJoCo Z-up to Babylon.js Y-up: (x,y,z) → (x,z,y)
      // No root rotation needed - STL loader already handles Y-up orientation
      console.log(`[MJCF Debug] Applying MuJoCo Z-up→Babylon.js Y-up coordinate conversion for ${primaryMjcfFile}`);
      
      // Coordinate system conversion is handled by position transformation
      console.log(`[MJCF Debug] Coordinate system conversion applied via position transformation for ${primaryMjcfFile}`);
      
      // Get all meshes for final verification
      const finalMeshes = root.getChildMeshes() as AbstractMesh[];
      
      // Final verification: check world positions after coordinate transformation
      console.log(`[MJCF Debug] Final verification - checking world positions after coordinate transformation:`);
      finalMeshes.forEach(mesh => {
        const worldPos = mesh.getAbsolutePosition();
        console.log(`[MJCF Debug] ${mesh.name}: World position (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
      });
      
      const flattened = finalMeshes;
      return {
        success: true,
        meshes: flattened.length > 0 ? flattened : [],
        rootNodes: [root],
        joints: [],
        actuators: [],
        errors: [],
        warnings: []
      };
    }

    // Handle single MJCF file
    const mjcfUrl = URL.createObjectURL(file);
    try {
      const rootNode = await loadMJCF(scene, {
        rootUrl: mjcfUrl.replace(/\/[^\/]*$/, ''),
        mjcf: file.name,
        bakePivots: false,
        fallbackGray: true
      });
      
      return {
        success: true,
        meshes: [],
        rootNodes: [rootNode],
        joints: [],
        actuators: [],
        errors: [],
        warnings: []
      };
    } finally {
      URL.revokeObjectURL(mjcfUrl);
    }

  } catch (error) {
    console.error(`[MJCF Import] Error loading MJCF:`, error);
    return {
      success: false,
      meshes: [],
      rootNodes: [],
      joints: [],
      actuators: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      warnings: []
    };
  }
};

export const loadMJCF = async (scene: Scene, opts: LoadOpts) => {
  if (opts === undefined || typeof opts.rootUrl !== "string" || typeof opts.mjcf !== "string") {
    throw new Error("rootUrl and mjcf are required");
  }
  const bake = opts.bakePivots === true;
  const gray = opts.fallbackGray === false ? false : true;

  // Ensure OBJ loader active & skip MTLs (then restore)
  const prevSkip = OBJFileLoader.SKIP_MATERIALS;
  OBJFileLoader.SKIP_MATERIALS = true;

  try {
    const xml = await textFetch(`${opts.rootUrl}/${opts.mjcf}`);
    const { world, meshMap, texMap, matMap, compilerScale } = parseMJCF(xml);
    const { pbrs } = makeMaterials(scene, opts.rootUrl, texMap, matMap);

    const root = await buildBodies(scene, opts.rootUrl, world, meshMap, pbrs, bake, gray, compilerScale);
    return root;
  } finally {
    OBJFileLoader.SKIP_MATERIALS = prevSkip;
  }
};

// ---------- VERIFICATION ----------
export const verifyMJCFLoad = (root: TransformNode) => {
  if (!root) throw new Error("verify: root missing");
  const meshes = root.getChildMeshes() as AbstractMesh[];
  if (meshes.length === 0) throw new Error("verify: no meshes under root");

  const bad = meshes.filter(m =>
    !Number.isFinite(m.getBoundingInfo()?.boundingBox?.extendSize?.length()) ||
    m.getTotalVertices() === 0
  );
  if (bad.length > 0) throw new Error(`verify: ${bad.length} zero-vertex/invalid meshes`);

  const scaled = new Set<string>();
  root.getChildren().forEach(node => {
    const s = (node as TransformNode).scaling;
    if (!s) return;
    if (Math.abs(s.x - 1) > 1e-6 || Math.abs(s.y - 1) > 1e-6 || Math.abs(s.z - 1) > 1e-6) {
      scaled.add(node.name);
    }
  });
  // Only geom/body nodes may carry scale; meshes must be at (1,1,1). We already enforce this.
  console.log(`verify: nodes=${root.getChildren().length}, meshes=${meshes.length}, scaledNodes=${scaled.size}`);
};

// ---------- USAGE ----------
// Google robot:
// await loadMJCF(scene, { rootUrl: "/google_robot", mjcf: "robot.xml" });
//
// KUKA iiwa 14:
// await loadMJCF(scene, { rootUrl: "/iiwa14", mjcf: "iiwa14.xml" });