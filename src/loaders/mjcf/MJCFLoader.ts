import "@babylonjs/loaders";
import { OBJFileLoader } from "@babylonjs/loaders/OBJ";
import {
  Scene, SceneLoader, TransformNode, Texture, PBRMaterial,
  Color3, Vector3, Quaternion, AbstractMesh,
  StandardMaterial, DirectionalLight, HemisphericLight, MeshBuilder
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

/**
 * Transform quaternion from MuJoCo Z-up coordinate system to Babylon.js Y-up coordinate system
 * Based on unitree_mujoco implementation patterns
 */
const transformQuaternionZupToYup = (wxyz: number[]) => {
  if (wxyz.length < 4) return Quaternion.Identity();
  const [w, x, y, z] = wxyz;

  // Convert from MuJoCo (w,x,y,z) to Babylon.js (x,y,z,w) format only.
  // Global coordinate conversion is handled at the root node.
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

  // Parse keyframes for initial joint positions
  const keyframes: Record<string, number[]> = {};
  const keyframeElements = doc.querySelectorAll("keyframe key");
  keyframeElements.forEach(keyEl => {
    const name = keyEl.getAttribute("name");
    const qpos = keyEl.getAttribute("qpos");
    if (name && qpos) {
      const values = toFloatArr(qpos);
      if (values) {
        keyframes[name] = values;
        console.log(`[MJCF Keyframe] Found keyframe '${name}' with ${values.length} joint values`);
      }
    }
  });

  // Parse joints to map joint names to body names and store their axes
  const jointMap: Record<string, string> = {};
  const jointAxes: Record<string, number[]> = {};
  const jointElements = doc.querySelectorAll("joint");
  let jointIndex = 0;
  jointElements.forEach(jointEl => {
    const name = jointEl.getAttribute("name");
    if (name) {
      // Map joint name to body name based on naming convention
      // Most joints follow pattern: bodyName_joint -> bodyName_link
      let bodyName = name;
      if (name.endsWith('_joint')) {
        bodyName = name.replace('_joint', '_link');
      } else if (name.endsWith('_j')) {
        bodyName = name.replace('_j', '_link');
      }
      
      jointMap[name] = bodyName;
      
      // Parse joint axis
      const axisAttr = jointEl.getAttribute("axis");
      if (axisAttr) {
        const axisValues = toFloatArr(axisAttr);
        if (axisValues && axisValues.length >= 3) {
          jointAxes[name] = [axisValues[0], axisValues[1], axisValues[2]];
        }
      }
      
      jointIndex++;
    }
  });

  // Parse bodies to track which ones have pre-existing quaternions
  const bodyQuaternions: Record<string, number[]> = {};
  const bodyElements = doc.querySelectorAll("body");
  bodyElements.forEach(bodyEl => {
    const name = bodyEl.getAttribute("name");
    const quatAttr = bodyEl.getAttribute("quat");
    if (name && quatAttr) {
      const quatValues = toFloatArr(quatAttr);
      if (quatValues && quatValues.length >= 4) {
        bodyQuaternions[name] = quatValues;
      }
    }
  });

  // Parse actuators
  const actuators: Array<{name: string, joint: string, ctrlrange?: [number, number]}> = [];
  const actuatorElements = doc.querySelectorAll("actuator motor");
  actuatorElements.forEach(actuatorEl => {
    const name = actuatorEl.getAttribute("name");
    const joint = actuatorEl.getAttribute("joint");
    const ctrlrange = actuatorEl.getAttribute("ctrlrange");
    
    if (name && joint) {
      let range: [number, number] | undefined;
      if (ctrlrange) {
        const rangeValues = toFloatArr(ctrlrange);
        if (rangeValues && rangeValues.length >= 2) {
          range = [rangeValues[0], rangeValues[1]];
        }
      }
      
      actuators.push({ name, joint, ctrlrange: range });
    }
  });

  // Parse sensors
  const sensors: Array<{name: string, type: string, joint?: string, site?: string}> = [];
  const sensorElements = doc.querySelectorAll("sensor > *");
  sensorElements.forEach(sensorEl => {
    const name = sensorEl.getAttribute("name");
    const type = sensorEl.tagName.toLowerCase();
    const joint = sensorEl.getAttribute("joint") || undefined;
    const site = sensorEl.getAttribute("site") || undefined;
    
    if (name) {
      sensors.push({ name, type, joint, site });
    }
  });

  const world = doc.querySelector("worldbody");
  if (world === null) throw new Error("No <worldbody> in MJCF");

  console.log(`[MJCF Parse] Found ${jointElements.length} joints, ${actuators.length} actuators, ${sensors.length} sensors`);

  return { world, meshMap, texMap, matMap, compilerScale, keyframes, jointMap, jointAxes, bodyQuaternions, actuators, sensors };
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

  // Heuristic fallbacks for robot colors - match MuJoCo viewer appearance
  if (pbrs["orange"] === undefined) {
    const o = new PBRMaterial("orange", scene);
    o.albedoColor = new Color3(1.0, 0.423529, 0.0392157); o.metallic = 0; o.roughness = 0.7;
    pbrs["orange"] = o;
  }
  if (pbrs["gray"] === undefined) {
    const g = new PBRMaterial("gray", scene);
    g.albedoColor = new Color3(0.2, 0.2, 0.2); g.metallic = 0.1; g.roughness = 0.8; // Darker gray for MuJoCo look
    pbrs["gray"] = g;
  }
  if (pbrs["black"] === undefined) {
    const b = new PBRMaterial("black", scene);
    b.albedoColor = new Color3(0.1, 0.1, 0.1); b.metallic = 0.2; b.roughness = 0.7; // Slightly lighter black with metallic
    pbrs["black"] = b;
  }
  
  // Add default robot material for MuJoCo-style appearance
  if (pbrs["robot_default"] === undefined) {
    const r = new PBRMaterial("robot_default", scene);
    r.albedoColor = new Color3(0.15, 0.15, 0.15); // Dark gray
    r.metallic = 0.1; 
    r.roughness = 0.8;
    pbrs["robot_default"] = r;
  }

  return { textures, pbrs };
};

const importVisualMesh = async (scene: Scene, rootUrl: string, file: string, meshFilesMap?: Map<string, File>) => {
  // If we have mesh files from ZIP, use them directly
  if (meshFilesMap && meshFilesMap.has(file)) {
    const meshFile = meshFilesMap.get(file)!;
    console.log(`[MJCF Import] Loading mesh from ZIP: ${file} (${meshFile.size} bytes)`);

    try {
      // Handle GLB files with GLB loader
      if (file.toLowerCase().endsWith('.glb')) {
        console.log(`[MJCF Import] Loading GLB file: ${file}`);
        
        // Import GLB loader dynamically
        const { loadGLBFromFile } = await import('../glb/GLBLoader');
        
        // Load GLB file
        const glbResult = await loadGLBFromFile(meshFile, scene, {
          enableProgressCallback: false,
          enableBoundsCalculation: false,
          enableMetadataExtraction: false,
          fallbackToBasicLoader: true
        });
        
        if (glbResult.success && glbResult.meshes.length > 0) {
          console.log(`[MJCF Import] Successfully loaded GLB: ${file} (${glbResult.meshes.length} meshes)`);
          return glbResult.meshes;
        } else {
          console.warn(`[MJCF Import] GLB load failed for ${file}:`, glbResult.errors);
          return [];
        }
      }

      // Handle traditional mesh files (OBJ, STL)
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

  if (fallbackGray === true) meshes.forEach(m => (m.material = pbrs["robot_default"] || pbrs["gray"]));
  if (typeof matName === "string" && matName.length > 0 && warned.has(matName) === false) {
    console.warn(`material '${matName}' not found; applied robot_default`);
    warned.add(matName);
  }
};

const multiplyScale = (node: TransformNode, v: Vector3) => {
  node.scaling.multiplyInPlace(v);
};

/**
 * Applies keyframe data to the robot hierarchy after all bodies are created
 * This mimics how MuJoCo automatically applies keyframe data on model load
 */
const applyKeyframeData = (
  rootNode: TransformNode,
  keyframes: Record<string, number[]>,
  jointMap: Record<string, string>,
  jointAxes: Record<string, number[]>,
  meshFilesMap?: Map<string, File>
) => {
  // Guard against double application - check if keyframes have already been applied
  // Only disable for OBJ-based models that need debugging
  const isOBJBasedModel = meshFilesMap ? Array.from(meshFilesMap.keys()).some(f => f.toLowerCase().endsWith('.obj')) : false;
  const hasSTLFiles = meshFilesMap ? Array.from(meshFilesMap.keys()).some(f => f.toLowerCase().endsWith('.stl')) : false;
  const isPureOBJModel = isOBJBasedModel && !hasSTLFiles;
  
  if (!isPureOBJModel && rootNode.metadata && rootNode.metadata.keyframesApplied) {
    console.log('[MJCF Keyframe] Keyframes already applied to this STL-based model, skipping to prevent double application');
    return;
  }
  console.log(`[MJCF Keyframe] Found ${Object.keys(keyframes).length} keyframes, ${Object.keys(jointMap).length} joints`);
  console.log(`[MJCF Keyframe] Root node: ${rootNode.name}`);
  console.log(`[MJCF Keyframe] DEBUGGING: applyKeyframeData function called - idempotence guard disabled`);
  
  // Apply only the first keyframe (usually "home")
  for (const [keyframeName, qposValues] of Object.entries(keyframes)) {
    console.log(`[MJCF Keyframe] Processing keyframe '${keyframeName}' with ${qposValues.length} values:`, qposValues);
    
    if (qposValues.length < 7) {
      console.warn(`[MJCF Keyframe] Keyframe '${keyframeName}' has insufficient values (${qposValues.length} < 7)`);
      continue;
    }
    
    // Find the root body (pelvis or base_link)
    const rootBody = rootNode.getChildren().find(child => 
      child.name === "pelvis" || child.name === "base_link"
    ) as TransformNode;
    
    if (!rootBody) {
      console.warn(`[MJCF Keyframe] No root body found (pelvis/base_link)`);
      continue;
    }
    
            // Determine model type based on mesh files to apply appropriate pose logic
            // STL models (H1/H1_2): meshes are pre-posed, need neutral pose
            // OBJ models (B2/B2W/GO2/G1): meshes are neutral, need keyframe pose
            const objCount = Array.from(meshFilesMap?.keys() || []).filter(f => f.toLowerCase().endsWith('.obj')).length;
            const stlCount = Array.from(meshFilesMap?.keys() || []).filter(f => f.toLowerCase().endsWith('.stl')).length;
            const hasOBJFiles = objCount > 0;
            const hasSTLFiles = stlCount > 0;
            
            // Heuristic:
            // - Pure OBJ => OBJ-based
            // - Pure STL => STL-based
            // - Mixed => treat as OBJ-based if OBJ count >= STL count (base meshes are usually OBJ)
            const isOBJBasedModel = hasOBJFiles && (!hasSTLFiles || objCount >= stlCount);
            const isSTLBasedModel = hasSTLFiles && !hasOBJFiles;
            const isMixedModel = hasOBJFiles && hasSTLFiles;
            
            console.log(`[MJCF Keyframe] Model analysis: OBJ=${hasOBJFiles}(${objCount}), STL=${hasSTLFiles}(${stlCount}), Type=${isOBJBasedModel ? 'OBJ-based' : isSTLBasedModel ? 'STL-based' : isMixedModel ? 'Mixed' : 'Unknown'}`);
            
            // Apply base pose: use keyframe base for OBJ-based; use default neutral for STL-based
            if (isOBJBasedModel) {
              // qpos[0..2] = base position (x,y,z) in Z-up; qpos[3..6] = base quat (w,x,y,z)
              const kBasePos = [qposValues[0] || 0, qposValues[1] || 0, qposValues[2] || 0];
              const kBaseQuat = [qposValues[3] || 1, qposValues[4] || 0, qposValues[5] || 0, qposValues[6] || 0];
              // Convert Z-up (x,y,z) → Y-up (x,z,y)
              rootBody.position.set(kBasePos[0], kBasePos[2], kBasePos[1]);
              
              // OBJ meshes are authored lying on their side - apply rotation to stand upright
              const keyframeQuat = transformQuaternionZupToYup(kBaseQuat);
              const uprightRotation = Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2); // -90° around X-axis
              rootBody.rotationQuaternion = uprightRotation.multiply(keyframeQuat);
              
              console.log(`[MJCF Keyframe] Applied KEYFRAME base pose (OBJ): pos(${kBasePos[0]}, ${kBasePos[1]}, ${kBasePos[2]}), quat(${kBaseQuat[0]}, ${kBaseQuat[1]}, ${kBaseQuat[2]}, ${kBaseQuat[3]}) + upright rotation`);
            } else {
              // Use keyframe base position for STL-based models with proper coordinate conversion
              const kBasePos = [qposValues[0] || 0, qposValues[1] || 0, qposValues[2] || 0];
              const kBaseQuat = [qposValues[3] || 1, qposValues[4] || 0, qposValues[5] || 0, qposValues[6] || 0];
              // Convert Z-up (x,y,z) → Y-up (x,z,y) for base position
              rootBody.position.set(kBasePos[0], kBasePos[2], kBasePos[1]);
              // Transform quaternion from MuJoCo Z-up to Babylon.js Y-up coordinate system
              rootBody.rotationQuaternion = transformQuaternionZupToYup(kBaseQuat);
              console.log(`[MJCF Keyframe] Applied KEYFRAME base pose (STL): pos(${kBasePos[0]}, ${kBasePos[1]}, ${kBasePos[2]}), quat(${kBaseQuat[0]}, ${kBaseQuat[1]}, ${kBaseQuat[2]}, ${kBaseQuat[3]})`);
            }
            
            // Apply joint rotations: OBJ-based models use keyframe values, STL-based models use default poses
            if (isOBJBasedModel) {
              console.log(`[MJCF Keyframe] OBJ-based model detected - applying actual keyframe values for correct joint positioning`);
              
              // Extract joint values from keyframe (starting from index 7, after base pos + quat)
              const jointValues: Record<string, number> = {};
              const jointNames = Object.keys(jointMap);
              for (let i = 0; i < jointNames.length; i++) {
                const jointName = jointNames[i];
                const keyframeIndex = 7 + i;
                const jointValue = keyframeIndex < qposValues.length ? qposValues[keyframeIndex] : 0;
                jointValues[jointName] = jointValue;
                console.log(`[MJCF Keyframe] OBJ model - using keyframe value for ${jointName}: ${jointValue} radians`);
              }
              
              // Reset all joint rotations first to ensure clean application
              console.log(`[MJCF Keyframe] Resetting all joint rotations for clean reapplication`);
              for (const jointName of Object.keys(jointValues)) {
                const bodyName = jointMap[jointName];
                if (bodyName && bodyName !== 'NONE') {
                  const bodyNode = rootNode.getChildTransformNodes(false).find(n => n.name === bodyName);
                  if (bodyNode) {
                    bodyNode.rotationQuaternion = Quaternion.Identity();
                  }
                }
              }
              
              // Apply joint rotations to all bodies
              for (const [jointName, jointValue] of Object.entries(jointValues)) {
                const bodyName = jointMap[jointName];
                if (bodyName && bodyName !== 'NONE') {
                  const bodyNode = rootNode.getChildTransformNodes(false).find(n => n.name === bodyName);
                  if (bodyNode) {
                    console.log(`[MJCF Keyframe] Applying joint ${jointName}: ${jointValue} radians`);
                    console.log(`[MJCF Debug] BEFORE rotation - ${bodyName} rotationQuaternion:`, bodyNode.rotationQuaternion);
                    const axisSrc = jointAxes[jointName] || [1, 0, 0];
                    console.log(`[MJCF Debug] ${jointName} axisSrc: [${axisSrc[0]}, ${axisSrc[1]}, ${axisSrc[2]}]`);
                    let axis = new Vector3(axisSrc[0], axisSrc[2], axisSrc[1]); // Convert from MuJoCo Z-up to Babylon.js Y-up (swap Y and Z)
                    console.log(`[MJCF Debug] ${jointName} converted axis: (${axis.x}, ${axis.y}, ${axis.z})`);
                    
                    // Mirror fix for right-side legs in OBJ-based models
                    if (isOBJBasedModel) {
                      const isRightSide = /^(FR_|RR_)/i.test(jointName);
                      const isThighOrCalf = /(thigh_joint|calf_joint)/i.test(jointName);
                      const isYAxisSrc = Array.isArray(axisSrc) && axisSrc.length === 3 && axisSrc[0] === 0 && axisSrc[1] === 1 && axisSrc[2] === 0;
                      if (isRightSide && isThighOrCalf && isYAxisSrc) {
                        axis = axis.scale(-1);
                        console.log(`[MJCF Mirror] Mirrored axis for right-side ${jointName}: (${axis.x.toFixed(6)}, ${axis.y.toFixed(6)}, ${axis.z.toFixed(6)})`);
                      }
                    }
                    
                    // Apply joint rotation as local rotation
                    const q = Quaternion.RotationAxis(axis, jointValue);
                    console.log(`[MJCF Debug] ${jointName} quaternion from axis/angle:`, q);
                    bodyNode.rotationQuaternion = q;
                    bodyNode.rotationQuaternion.normalize();
                    console.log(`[MJCF Debug] AFTER rotation - ${bodyName} rotationQuaternion:`, bodyNode.rotationQuaternion);
                    
                    console.log(`[MJCF Keyframe] Applied joint ${jointName}: ${jointValue} radians around axis (${axis.x}, ${axis.y}, ${axis.z})`);
                  }
                }
              }
            } else {
              console.log(`[MJCF Keyframe] STL-based model detected - applying keyframe joint rotations`);
              
              // Extract joint values from keyframe (starting from index 7, after base pos + quat)
              const jointValues: Record<string, number> = {};
              const jointNames = Object.keys(jointMap);
              for (let i = 0; i < jointNames.length; i++) {
                const jointName = jointNames[i];
                const keyframeIndex = 7 + i;
                const jointValue = keyframeIndex < qposValues.length ? qposValues[keyframeIndex] : 0;
                jointValues[jointName] = jointValue;
                console.log(`[MJCF Keyframe] STL model - using keyframe value for ${jointName}: ${jointValue} radians`);
              }
              
              // Reset all joint rotations first to ensure clean application
              console.log(`[MJCF Keyframe] Resetting all joint rotations for clean reapplication`);
              for (const jointName of Object.keys(jointValues)) {
                const bodyName = jointMap[jointName];
                if (bodyName && bodyName !== 'NONE') {
                  const bodyNode = rootNode.getChildTransformNodes(false).find(n => n.name === bodyName);
                  if (bodyNode) {
                    bodyNode.rotationQuaternion = Quaternion.Identity();
                  }
                }
              }
              
              // Apply joint rotations to all bodies
              for (const [jointName, jointValue] of Object.entries(jointValues)) {
                const bodyName = jointMap[jointName];
                if (bodyName && bodyName !== 'NONE') {
                  const bodyNode = rootNode.getChildTransformNodes(false).find(n => n.name === bodyName);
                  if (bodyNode) {
                    console.log(`[MJCF Keyframe] Applying joint ${jointName}: ${jointValue} radians`);
                    console.log(`[MJCF Debug] BEFORE rotation - ${bodyName} rotationQuaternion:`, bodyNode.rotationQuaternion);
                    const axisSrc = jointAxes[jointName] || [1, 0, 0];
                    console.log(`[MJCF Debug] ${jointName} axisSrc: [${axisSrc[0]}, ${axisSrc[1]}, ${axisSrc[2]}]`);
                    let axis = new Vector3(axisSrc[0], axisSrc[2], axisSrc[1]); // Convert from MuJoCo Z-up to Babylon.js Y-up (swap Y and Z)
                    console.log(`[MJCF Debug] ${jointName} converted axis: (${axis.x}, ${axis.y}, ${axis.z})`);
                    
                    // Apply joint rotation as local rotation
                    const q = Quaternion.RotationAxis(axis, jointValue);
                    console.log(`[MJCF Debug] ${jointName} quaternion from axis/angle:`, q);
                    bodyNode.rotationQuaternion = q;
                    bodyNode.rotationQuaternion.normalize();
                    console.log(`[MJCF Debug] AFTER rotation - ${bodyName} rotationQuaternion:`, bodyNode.rotationQuaternion);
                    
                    console.log(`[MJCF Keyframe] Applied joint ${jointName}: ${jointValue} radians around axis (${axis.x}, ${axis.y}, ${axis.z})`);
                  }
                }
              }
            }
    
    
  // Only apply the first keyframe
  break;
  }
  
  // Mark that keyframes have been applied to prevent double application
  // Only set flag for STL-based models to prevent double application
  if (!isPureOBJModel) {
    if (!rootNode.metadata) {
      rootNode.metadata = {};
    }
    rootNode.metadata.keyframesApplied = true;
  }
};



/**
 * Creates MuJoCo-style lighting for MJCF models
 * Note: Floor is handled by the main scene manager to avoid duplication
 */
const createMuJoCoEnvironment = (scene: Scene) => {
  // Add directional light similar to MuJoCo viewer
  const directionalLight = new DirectionalLight("muJoCoDirectionalLight", new Vector3(0, -1, 0), scene);
  directionalLight.diffuse = new Color3(0.6, 0.6, 0.6);
  directionalLight.specular = new Color3(0, 0, 0);
  directionalLight.intensity = 1.0;

  // Add hemispheric light for ambient lighting
  const hemisphericLight = new HemisphericLight("muJoCoHemisphericLight", new Vector3(0, 1, 0), scene);
  hemisphericLight.diffuse = new Color3(0.3, 0.3, 0.3);
  hemisphericLight.specular = new Color3(0, 0, 0);
  hemisphericLight.intensity = 0.3;

  console.log("[MJCF Environment] Created MuJoCo-style lighting (using existing scene floor)");
  
  return { directionalLight, hemisphericLight };
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
  keyframes: Record<string, number[]>,
  jointMap: Record<string, string>,
  jointAxes: Record<string, number[]>,
  meshFilesMap?: Map<string, File>
) => {
  const root = new TransformNode("mjcf_root", scene);
  root.scaling.set(1, 1, 1);
  // No global rotation - coordinate conversion handled by position mapping

  const warnedMissingMaterials = new Set<string>();

  // Determine model type for position handling
  const objCountForBuild = Array.from(meshFilesMap?.keys() || []).filter(f => f.toLowerCase().endsWith('.obj')).length;
  const stlCountForBuild = Array.from(meshFilesMap?.keys() || []).filter(f => f.toLowerCase().endsWith('.stl')).length;
  const hasOBJForBuild = objCountForBuild > 0;
  const hasSTLForBuild = stlCountForBuild > 0;
  const isSTLBasedForBuild = hasSTLForBuild && !hasOBJForBuild; // H1/H1_2

  // Note: jointMap is passed but not used in current implementation
  // It's kept for future joint manipulation features
  console.log(`[MJCF Debug] jointMap contains ${Object.keys(jointMap).length} joints`);

  const visit = async (bodyEl: Element, parent: TransformNode) => {
    const name = bodyEl.getAttribute("name") || "body";
    const bodyNode = new TransformNode(name, scene);
    bodyNode.parent = parent;
    bodyNode.scaling.set(1, 1, 1);

    const bodyPos = toFloatArr(bodyEl.getAttribute("pos"));
    if (bodyPos !== null && bodyPos.length >= 3) {
      // STL-based models require Y/Z swap for local positions
      if (isSTLBasedForBuild) {
        bodyNode.position.set(bodyPos[0], bodyPos[2], bodyPos[1]);
        console.log(`[MJCF Debug] STL-based model - transformed body position for ${name}: (${bodyPos[0]}, ${bodyPos[1]}, ${bodyPos[2]}) -> (${bodyPos[0]}, ${bodyPos[2]}, ${bodyPos[1]})`);
      } else {
        // OBJ-based (or mixed) keep original local coordinates
        bodyNode.position.set(bodyPos[0], bodyPos[1], bodyPos[2]);
        console.log(`[MJCF Debug] OBJ-based model - body position for ${name}: (${bodyPos[0]}, ${bodyPos[1]}, ${bodyPos[2]}) (no conversion)`);
      }
    }

    const bodyQuat = toFloatArr(bodyEl.getAttribute("quat"));
    if (bodyQuat !== null && bodyQuat.length >= 4) {
      // Transform quaternion from MuJoCo Z-up to Babylon.js Y-up coordinate system
      bodyNode.rotationQuaternion = transformQuaternionZupToYup(bodyQuat);
      console.log(`[MJCF Debug] Transformed body quaternion for ${name}: (${bodyQuat[0]}, ${bodyQuat[1]}, ${bodyQuat[2]}, ${bodyQuat[3]}) -> Z-up to Y-up`);
    }

    // Store keyframe data for later application after all bodies are created
    // We'll apply keyframes after the entire hierarchy is built

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
      if (gpos !== null && gpos.length >= 3) {
        // STL-based models require Y/Z swap for geom positions
        if (isSTLBasedForBuild) {
          geomNode.position.set(gpos[0], gpos[2], gpos[1]);
          console.log(`[MJCF Debug] STL-based model - transformed geom position for ${name}__geom_${meshRef}: (${gpos[0]}, ${gpos[1]}, ${gpos[2]}) -> (${gpos[0]}, ${gpos[2]}, ${gpos[1]})`);
        } else {
          // OBJ-based (or mixed) keep original local coordinates
          geomNode.position.set(gpos[0], gpos[1], gpos[2]);
          console.log(`[MJCF Debug] OBJ-based model - geom position for ${name}__geom_${meshRef}: (${gpos[0]}, ${gpos[1]}, ${gpos[2]}) (no conversion)`);
        }
      }

      const gquat = toFloatArr(geom.getAttribute("quat"));
      if (gquat !== null && gquat.length >= 4) {
        // Transform quaternion from MuJoCo Z-up to Babylon.js Y-up coordinate system
        geomNode.rotationQuaternion = transformQuaternionZupToYup(gquat);
        console.log(`[MJCF Debug] Transformed geom quaternion for ${name}__geom_${meshRef}: (${gquat[0]}, ${gquat[1]}, ${gquat[2]}, ${gquat[3]}) -> Z-up to Y-up`);
      }

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

      // Apply local upright rotation to OBJ meshes ONLY for OBJ-based models (not STL-based models like H1/H1_2)
      // Check if this is an OBJ-based model by looking at the meshFilesMap
      const isOBJBasedModel = meshFilesMap ? Array.from(meshFilesMap.keys()).some(f => f.toLowerCase().endsWith('.obj')) : false;
      const hasSTLFiles = meshFilesMap ? Array.from(meshFilesMap.keys()).some(f => f.toLowerCase().endsWith('.stl')) : false;
      const isPureOBJModel = isOBJBasedModel && !hasSTLFiles;
      
      if (def.file.toLowerCase().endsWith('.obj') && isPureOBJModel) {
        const objUprightRotation = Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2); // +90° around X-axis
        if (geomNode.rotationQuaternion) {
          geomNode.rotationQuaternion = objUprightRotation.multiply(geomNode.rotationQuaternion);
        } else {
          geomNode.rotationQuaternion = objUprightRotation;
        }
        console.log(`[MJCF Mesh] Applied local upright rotation to OBJ mesh: ${geomNode.name} (OBJ-based model)`);
      } else if (def.file.toLowerCase().endsWith('.obj')) {
        console.log(`[MJCF Mesh] Skipping OBJ mesh rotation for ${geomNode.name} (mixed model - STL files present)`);
      }

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
  
  // Apply keyframe data after all bodies are created
  applyKeyframeData(root, keyframes, jointMap, jointAxes, meshFilesMap);
  
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
export const loadMJCFFromFile = async (file: File, scene: Scene): Promise<{ success: boolean; rootNodes: TransformNode[]; meshes: AbstractMesh[]; joints: any[]; actuators: any[]; sensors: any[]; errors: string[]; warnings: string[]; bounds: any }> => {
  if (!file || !file.name) {
    throw new Error("Invalid file: missing name property");
  }
  
  // Import MJCF loading status system (optional)
  let mjcfLoading: any = null;
  try {
    const mjcfLoadingModule = await import('../../ui/components/MJCFLoadingStatus');
    mjcfLoading = mjcfLoadingModule.mjcfLoading;
  } catch (error) {
    console.warn('[MJCF Import] Could not load MJCF status system:', error);
  }
  
  console.log(`[MJCF Import] Starting import of ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
  
  // Start loading status popup (if available)
  if (mjcfLoading) {
    mjcfLoading.start(file.name);
  }

  try {
    // Check if it's a ZIP file
    if (file.name.toLowerCase().endsWith('.zip')) {
      console.log(`[MJCF Import] Extracting ZIP file: ${file.name}`);
      if (mjcfLoading) mjcfLoading.updateProgress(10, 'Extracting ZIP file...');
      
      const zip = new JSZip();
      const zipData = await file.arrayBuffer();
      const zipContents = await zip.loadAsync(zipData);

      const extractedMeshFiles = new Map<string, File>();
      let mjcfContent = '';
      let primaryMjcfFile = '';

      // First pass: collect all MJCF files and analyze them
      if (mjcfLoading) mjcfLoading.updateProgress(20, 'Analyzing MJCF files...');
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
      if (mjcfLoading) mjcfLoading.updateProgress(30, 'Extracting mesh files...');
      for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
        if (zipEntry.dir) continue;

        const lowerName = filename.toLowerCase();
        const basename = filename.split('/').pop() || filename;

        // Look for mesh files (including GLB files)
        if (lowerName.endsWith('.obj') || lowerName.endsWith('.stl') || lowerName.endsWith('.glb')) {
          const blob = await zipEntry.async('blob');
          const meshFile = new File([blob], basename, { 
            type: lowerName.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream' 
          });
          extractedMeshFiles.set(basename, meshFile);
          console.log(`[MJCF Import] Found mesh file in ZIP: ${basename} (from ${filename})`);
        }
      }

      if (mjcfContent === '') {
        throw new Error('No MJCF file found in ZIP');
      }

      console.log(`[MJCF Import] Using ${primaryMjcfFile} as primary MJCF file`);
      console.log(`[MJCF Import] Extracted ${extractedMeshFiles.size} mesh files from ZIP`);

      // Create MuJoCo-style environment
      createMuJoCoEnvironment(scene);

      // Parse MJCF content
      if (mjcfLoading) mjcfLoading.updateProgress(40, 'Parsing MJCF content...');
      const { world, meshMap, texMap, matMap, compilerScale, keyframes, jointMap, jointAxes, actuators, sensors } = parseMJCF(mjcfContent);
      
      // Update model analysis
      const objCount = Array.from(extractedMeshFiles.keys()).filter(f => f.toLowerCase().endsWith('.obj')).length;
      const stlCount = Array.from(extractedMeshFiles.keys()).filter(f => f.toLowerCase().endsWith('.stl')).length;
      const glbCount = Array.from(extractedMeshFiles.keys()).filter(f => f.toLowerCase().endsWith('.glb')).length;
      const isOBJBased = objCount > 0 && (!stlCount || objCount >= stlCount);
      const isSTLBased = stlCount > 0 && !objCount;
      const isMixed = objCount > 0 && stlCount > 0;
      const hasGLBAssets = glbCount > 0;
      
      if (mjcfLoading) {
        mjcfLoading.setModelAnalysis(
          { isOBJBased, isSTLBased, isMixed },
          { 
            bodies: world.querySelectorAll('body').length,
            meshes: extractedMeshFiles.size,
            joints: Object.keys(jointMap).length,
            actuators: actuators.length,
            sensors: sensors.length
          }
        );
        
        mjcfLoading.setKeyframeInfo({
          found: Object.keys(keyframes).length > 0,
          count: Object.keys(keyframes).length,
          applied: false // Will be updated after application
        });
      }
      const { pbrs } = makeMaterials(scene, "", texMap, matMap);

      // root: Apply a single, consistent coordinate system rotation for all MJCF
      const root = new TransformNode("mjcf_root", scene);
      root.scaling.set(1, 1, 1);
      // No global rotation - coordinate conversion handled by position mapping
      console.log(`[MJCF Debug] Using position mapping for Z-up→Y-up conversion for ${primaryMjcfFile}`);

      // warn if compiler scale is not 1
      if (compilerScale !== 1) console.warn(`compiler scale = ${compilerScale}`);
      console.log(`[MJCF Debug] Compiler scale: ${compilerScale}`);

      const warnedMissingMaterials = new Set<string>();
      const allMeshes: AbstractMesh[] = [];
      const rgbaCache = new Map<string, PBRMaterial>(); // geom rgba override cache

      const allBodyNodes: TransformNode[] = [];
      
      // Determine model type for position handling (same logic as buildBodies)
      const objCountForZip = Array.from(extractedMeshFiles?.keys() || []).filter(f => f.toLowerCase().endsWith('.obj')).length;
      const stlCountForZip = Array.from(extractedMeshFiles?.keys() || []).filter(f => f.toLowerCase().endsWith('.stl')).length;
      const hasOBJForZip = objCountForZip > 0;
      const hasSTLForZip = stlCountForZip > 0;
      const isSTLBasedForZip = hasSTLForZip && !hasOBJForZip; // H1/H1_2
      
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
          // STL-based models require Y/Z swap for local positions
          if (isSTLBasedForZip) {
            bodyNode.position.set(bodyPos[0], bodyPos[2], bodyPos[1]);
            console.log(`[MJCF Debug] STL-based model - transformed body position for ${name}: (${bodyPos[0]}, ${bodyPos[1]}, ${bodyPos[2]}) -> (${bodyPos[0]}, ${bodyPos[2]}, ${bodyPos[1]})`);
          } else {
            // OBJ-based (or mixed) keep original local coordinates
            bodyNode.position.set(bodyPos[0], bodyPos[1], bodyPos[2]);
            console.log(`[MJCF Debug] OBJ-based model - body position for ${name}: (${bodyPos[0]}, ${bodyPos[1]}, ${bodyPos[2]}) (no conversion)`);
          }
        }

        const bodyQuat = toFloatArr(bodyEl.getAttribute("quat"));
        if (bodyQuat !== null && bodyQuat.length >= 4) {
          // Transform quaternion from MuJoCo Z-up to Babylon.js Y-up coordinate system
          bodyNode.rotationQuaternion = transformQuaternionZupToYup(bodyQuat);
        }

        // SKIP keyframe joint positions during body building
        // The STL mesh files are already in the keyframe pose (dynamic pose)
        // Applying joint rotations here would compound the issue
        // console.log(`[MJCF Keyframe] SKIPPING joint application during body building for ${name} - STL meshes are already in keyframe pose`);

        // apply compiler scale on body node as scale (keeps mesh scale neutral)
        if (compilerScale !== 1) bodyNode.scaling.multiplyInPlace(new Vector3(compilerScale, compilerScale, compilerScale));


        // Visual geoms on this body
        const geoms = Array.from(bodyEl.querySelectorAll(":scope > geom"));
        for (const geom of geoms) {
          // Treat as visual if class contains "visual" OR (type="mesh" AND mesh present)
          const cls = geom.getAttribute("class");
          const type = geom.getAttribute("type");
          const meshRef = geom.getAttribute("mesh");
          const hasClassVisual = typeof cls === "string" && cls.indexOf("visual") >= 0;
          const isMeshType = typeof type === "string" && type === "mesh";
          const looksVisual = hasClassVisual || (isMeshType && typeof meshRef === "string");

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
          if (gpos !== null && gpos.length >= 3) {
            // STL-based models require Y/Z swap for geom positions
            if (isSTLBasedForZip) {
              geomNode.position.set(gpos[0], gpos[2], gpos[1]);
              console.log(`[MJCF Debug] STL-based model - transformed geom position for ${name}__geom_${meshRef}: (${gpos[0]}, ${gpos[1]}, ${gpos[2]}) -> (${gpos[0]}, ${gpos[2]}, ${gpos[1]})`);
            } else {
              // OBJ-based (or mixed) keep original local coordinates
              geomNode.position.set(gpos[0], gpos[1], gpos[2]);
              console.log(`[MJCF Debug] OBJ-based model - geom position for ${name}__geom_${meshRef}: (${gpos[0]}, ${gpos[1]}, ${gpos[2]}) (no conversion)`);
            }
          }

          const gquat = toFloatArr(geom.getAttribute("quat"));
          if (gquat !== null && gquat.length >= 4) {
            // Transform quaternion from MuJoCo Z-up to Babylon.js Y-up coordinate system
            geomNode.rotationQuaternion = transformQuaternionZupToYup(gquat);
          }

          // TEMPORARY FIX: Disable all scaling to prevent kinematic chain accumulation
          // TODO: Implement proper scaling that doesn't compound through hierarchy

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
              meshes.forEach(m => (m.material = pbrs["robot_default"] || pbrs["gray"]));
              if (typeof matName === "string" && matName.length > 0 && warnedMissingMaterials.has(matName) === false) {
                console.warn(`material '${matName}' not found; applied robot_default`);
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
          sensors: [],
          errors: [],
          warnings: [],
          bounds: null
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
      
      // Apply keyframe data after all bodies are created
      if (mjcfLoading) mjcfLoading.updateProgress(80, 'Applying keyframe data...');
      applyKeyframeData(root, keyframes, jointMap, jointAxes, extractedMeshFiles);
      if (mjcfLoading) mjcfLoading.setKeyframeInfo({ applied: true });
      
      // Check for warnings
      if (Object.keys(keyframes).length === 0 && mjcfLoading) {
        mjcfLoading.addWarning('No keyframes found - robot may appear in default pose');
      }
      
      // Global conversion handled via position mapping; no root rotation needed
      console.log(`[MJCF Debug] Using position mapping for Z-up→Y-up conversion for ${primaryMjcfFile}`);
      
      // Get all meshes for final verification
      const finalMeshes = root.getChildMeshes() as AbstractMesh[];
      
      // Final verification: check world positions after coordinate transformation
      console.log(`[MJCF Debug] Final verification - checking world positions after coordinate transformation:`);
      finalMeshes.forEach(mesh => {
        const worldPos = mesh.getAbsolutePosition();
        console.log(`[MJCF Debug] ${mesh.name}: World position (${worldPos.x.toFixed(3)}, ${worldPos.y.toFixed(3)}, ${worldPos.z.toFixed(3)})`);
      });
      
      const flattened = finalMeshes;
      
      // Final success status
      if (mjcfLoading) {
        mjcfLoading.updateProgress(100, 'Import complete!');
        mjcfLoading.success(
          file.name,
          `${primaryMjcfFile} loaded successfully - Model type: ${isOBJBased ? 'OBJ-based' : isSTLBased ? 'STL-based' : isMixed ? 'Mixed' : 'Unknown'}${hasGLBAssets ? ' + GLB assets' : ''}, Bodies: ${world.querySelectorAll('body').length}, Meshes: ${extractedMeshFiles.size} (${objCount} OBJ, ${stlCount} STL, ${glbCount} GLB), Joints: ${Object.keys(jointMap).length}, Keyframes: ${Object.keys(keyframes).length > 0 ? `${Object.keys(keyframes).length} found and applied` : 'None found'}`
        );
      }
      
      // Calculate bounds for camera fitting
      let bounds: any = null;
      if (flattened.length > 0) {
        // Create bounding info from meshes
        const min = Vector3.Zero();
        const max = Vector3.Zero();
        let first = true;
        
        flattened.forEach(mesh => {
          if (mesh.getBoundingInfo) {
            const meshBounds = mesh.getBoundingInfo();
            if (first) {
              min.copyFrom(meshBounds.minimum);
              max.copyFrom(meshBounds.maximum);
              first = false;
            } else {
              min.x = Math.min(min.x, meshBounds.minimum.x);
              min.y = Math.min(min.y, meshBounds.minimum.y);
              min.z = Math.min(min.z, meshBounds.minimum.z);
              max.x = Math.max(max.x, meshBounds.maximum.x);
              max.y = Math.max(max.y, meshBounds.maximum.y);
              max.z = Math.max(max.z, meshBounds.maximum.z);
            }
          }
        });
        
        if (!first) {
          bounds = {
            min: min,
            max: max,
            center: Vector3.Center(min, max),
            size: max.subtract(min)
          };
        }
      }

      return {
        success: true,
        meshes: flattened.length > 0 ? flattened : [],
        rootNodes: [root],
        joints: Object.keys(jointMap),
        actuators: actuators,
        sensors: sensors,
        errors: [],
        warnings: [],
        bounds: bounds
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
        sensors: [],
        errors: [],
        warnings: [],
        bounds: null
      };
    } finally {
      URL.revokeObjectURL(mjcfUrl);
    }

  } catch (error) {
    console.error(`[MJCF Import] Error loading MJCF:`, error);
    
    // Show error in popup
    if (mjcfLoading) {
      mjcfLoading.error(
        file.name,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    
    return {
      success: false,
      meshes: [],
      rootNodes: [],
      joints: [],
      actuators: [],
      sensors: [],
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      warnings: [],
      bounds: null
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
    const { world, meshMap, texMap, matMap, compilerScale, keyframes, jointMap, jointAxes, actuators, sensors } = parseMJCF(xml);
    const { pbrs } = makeMaterials(scene, opts.rootUrl, texMap, matMap);

    const root = await buildBodies(scene, opts.rootUrl, world, meshMap, pbrs, bake, gray, compilerScale, keyframes, jointMap, jointAxes, undefined);
    
    // Log parsed data for debugging
    console.log(`[MJCF Load] Loaded ${Object.keys(jointMap).length} joints, ${actuators.length} actuators, ${sensors.length} sensors`);
    
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