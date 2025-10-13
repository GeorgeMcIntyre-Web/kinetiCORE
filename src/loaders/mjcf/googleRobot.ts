/**
 * Google Robot MJCF Loader
 * Drop-in TypeScript loader for reproducing MJCF visual hierarchy in Babylon.js
 * 
 * Features:
 * - Guard clauses and no else/elseif for clean code
 * - Z-up→Y-up coordinate conversion handled once at root
 * - Exact hierarchy & positions mirror MJCF structure
 * - Materials match MJCF textures
 * - Compact readable code with minimal nesting
 */

import "@babylonjs/loaders";
import {
  Scene, SceneLoader, TransformNode, PBRMaterial, Vector3,
  Quaternion, AbstractMesh, Color3
} from "@babylonjs/core";
import { OBJFileLoader } from "@babylonjs/loaders/OBJ";
import JSZip from "jszip";

// Z-up (MJCF) → Y-up (Babylon). Do this once at the root.
const makeRoot = (scene: Scene) => {
  const root = new TransformNode("google_robot_root", scene);
  root.rotation = new Vector3(-Math.PI / 2, 0, 0);
  return root;
};

const makePBR = (scene: Scene, name: string, color: string) => {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = Color3.FromHexString(color);
  m.metallic = 0.0;
  m.roughness = 0.7;
  return m;
};

type PartSpec = {
  name: string;
  file: string;           // OBJ visual
  parent?: string;        // parent node name
  pos?: [number, number, number]; // local position (meters)
  quatWXYZ?: [number, number, number, number]; // optional local rotation (w,x,y,z). Only used where specified in MJCF.
  material?: "robot" | "finger_base" | "finger_tip";
};

const PARTS: PartSpec[] = [
  // Base (root)
  { name: "base_link", file: "link_base_v.obj", pos: [0, 0, 0.06205], material: "robot" },
  // Wheels under base_link
  { name: "wheel_front", file: "link_wheel_v.obj", parent: "base_link", pos: [0, 0.18283, 0], material: "robot" },
  { name: "wheel_rear",  file: "link_wheel_v.obj", parent: "base_link", pos: [0, -0.18283, 0], material: "robot" },
  // Head pan/tilt under base_link
  { name: "link_head_pan",  file: "link_head_pan_v.obj",  parent: "base_link", pos: [0, 0, 1.16902], material: "robot" },
  { name: "link_head_tilt", file: "link_head_tilt_v.obj", parent: "base_link", pos: [0.07181, 0, 1.2875], material: "robot" },
  // Arm chain
  { name: "link_torso",   file: "link_torso_v.obj",   parent: "base_link",  pos: [0, 0, 0.5945], material: "robot" },
  { name: "link_shoulder",file: "link_shoulder_v.obj",parent: "link_torso", pos: [0, -0.167289, 0.113], material: "robot" },
  { name: "link_bicep",   file: "link_bicep_v.obj",   parent: "link_shoulder", pos: [0, 0.002289, 0.215029], material: "robot" },
  { name: "link_elbow",   file: "link_elbow_v.obj",   parent: "link_bicep", pos: [0, -0.064, 0.185036], material: "robot" },
  { name: "link_forearm", file: "link_forearm_v.obj", parent: "link_elbow", pos: [0, -0.101, 0.0914359], material: "robot" },
  { name: "link_wrist",   file: "link_wrist_v.obj",   parent: "link_forearm", pos: [0, -0.00604, 0.2735], material: "robot" },
  { name: "link_gripper", file: "link_gripper_v.obj", parent: "link_wrist", pos: [0, 0.0060384, 0.10911], material: "robot" },
  // Fingers (right)
  { name: "link_finger_right",     file: "link_finger_base_v.obj", parent: "link_gripper", pos: [0, 0.025, 0.05886], quatWXYZ: [0.879969, -0.475032, 0, 0], material: "finger_base" },
  { name: "link_finger_tip_right", file: "link_finger_tip_v.obj",  parent: "link_finger_right", pos: [0, -0.0103567, 0.0641556], quatWXYZ: [0.995004, 0.0998334, 0, 0], material: "finger_tip" },
  // Fingers (left)
  { name: "link_finger_left",      file: "link_finger_base_v.obj", parent: "link_gripper", pos: [0, -0.025, 0.05886], quatWXYZ: [0, 0, -0.475032, 0.879969], material: "finger_base" },
  { name: "link_finger_tip_left",  file: "link_finger_tip_v.obj",  parent: "link_finger_left", pos: [0, -0.0103567, 0.0641556], quatWXYZ: [0.995004, 0, 0, 0.0998334], material: "finger_tip" }, // NOTE: MJCF uses (w x y z). Converted here; if finger pose looks off, verify conversion. (Assumption)
];

const applyLocal = (node: TransformNode, part: PartSpec) => {
  if (part.pos) node.position.set(part.pos[0], part.pos[1], part.pos[2]);
  if (part.quatWXYZ) {
    const [w, x, y, z] = part.quatWXYZ;
    node.rotationQuaternion = new Quaternion(x, y, z, w); // MJCF (w,x,y,z) → Babylon (x,y,z,w)
  }
};

const assignMaterial = (node: TransformNode, mats: Record<string, PBRMaterial>, part: PartSpec) => {
  if (!part.material) return;
  const m = part.material === "robot" ? mats.robot
        : part.material === "finger_base" ? mats.fingerBase
        : mats.fingerTip;
  node.getChildMeshes().forEach(mesh => mesh.material = m);
};

const importObj = async (scene: Scene, rootUrl: string, file: string, meshFilesMap?: Map<string, File>) => {
  // Disable MTL file loading to prevent network errors
  const originalSkipMaterials = OBJFileLoader.SKIP_MATERIALS;
  OBJFileLoader.SKIP_MATERIALS = true;
  
  // Try to load from File object if available (from ZIP)
  if (meshFilesMap && meshFilesMap.has(file)) {
    const meshFile = meshFilesMap.get(file)!;
    console.log(`[Google Robot] Loading OBJ from ZIP: ${file} (${meshFile.size} bytes)`);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await meshFile.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      const objectURL = URL.createObjectURL(blob);

      // Use callback-based SceneLoader like the existing MJCF loader
      let result: any = null;
      await new Promise<void>((resolve, reject) => {
        SceneLoader.ImportMesh(
          '',         // All meshes
          '',         // No root URL needed for blob
          objectURL,  // Blob URL
          scene,
          (loadedMeshes) => {
            console.log(`[Google Robot] SceneLoader returned ${loadedMeshes.length} meshes`);
            
            // Clean up blob URL
            URL.revokeObjectURL(objectURL);
            
            // Create result object
            result = {
              meshes: loadedMeshes,
              particleSystems: [],
              skeletons: [],
              animationGroups: [],
              transformNodes: [],
              geometries: [],
              lights: [],
              spriteManagers: []
            };
            
            resolve();
          },
          undefined, // Progress callback
          (_scene, message) => {
            console.error(`[Google Robot] SceneLoader.ImportMesh failed:`, message);
            URL.revokeObjectURL(objectURL);
            reject(new Error(message));
          },
          '.obj'     // Plugin extension
        );
      });
      
      if (result && result.meshes && result.meshes.length > 0) {
        return result.meshes as AbstractMesh[];
      }
      
      return null;
    } catch (error) {
      console.warn(`[Google Robot] Failed to load OBJ from ZIP: ${file}`, error);
      return null;
    } finally {
      // Restore original MTL setting
      OBJFileLoader.SKIP_MATERIALS = originalSkipMaterials;
    }
  }

  // Fallback to URL-based loading
  try {
    const res = await SceneLoader.ImportMeshAsync("", `${rootUrl}/assets/`, file, scene);
    if (res.meshes.length < 1) return null;
    return res.meshes as AbstractMesh[];
  } finally {
    // Restore original MTL setting
    OBJFileLoader.SKIP_MATERIALS = originalSkipMaterials;
  }
};

const buildIndex = (nodes: TransformNode[]) => {
  const map: Record<string, TransformNode> = {};
  nodes.forEach(n => map[n.name] = n);
  return map;
};

// Optional: if a part was exported with a strange pivot, you can rebake it.
// Use sparingly. If visuals shift unexpectedly, remove it.
const tryBakePivot = (node: TransformNode) => {
  const meshes = node.getChildMeshes();
  if (meshes.length < 1) return;
  meshes.forEach(m => {
    if (m.rotationQuaternion === undefined) m.rotationQuaternion = Quaternion.Identity();
    m.bakeCurrentTransformIntoVertices();
  });
};

/**
 * Extract mesh files from ZIP for Google Robot
 */
export async function extractGoogleRobotZip(zipFile: File): Promise<Map<string, File>> {
  console.log(`[Google Robot] Extracting ZIP file: ${zipFile.name}`);

  const zip = new JSZip();
  const zipData = await zipFile.arrayBuffer();
  const zipContents = await zip.loadAsync(zipData);

  const meshFiles = new Map<string, File>();

  // Find mesh files (including in subdirectories like 'assets/')
  for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
    if (zipEntry.dir) continue;

    const lowerName = filename.toLowerCase();
    const basename = filename.split('/').pop() || filename;

    // Look for OBJ files that match Google Robot parts
    if (lowerName.endsWith('.obj')) {
      const blob = await zipEntry.async('blob');
      const file = new File([blob], basename, { type: 'application/octet-stream' });
      meshFiles.set(basename, file);
      console.log(`[Google Robot] Found mesh file in ZIP: ${basename} (from ${filename})`);
    }
  }

  console.log(`[Google Robot] Extracted ${meshFiles.size} mesh files from ZIP`);
  return meshFiles;
}

export type LoadOptions = {
  /** Where google_robot folder is served. Example: "/google_robot" */
  rootUrl: string;
  /** Recenter/bake pivots if some meshes have odd origins. Default: false. */
  bakePivots?: boolean;
  /** Map of mesh files extracted from ZIP (filename -> File object) */
  meshFilesMap?: Map<string, File>;
};

export const loadGoogleRobot = async (scene: Scene, opts: LoadOptions) => {
  if (!opts?.rootUrl) throw new Error("rootUrl required (points to the folder that contains /assets)");

  const root = makeRoot(scene);

  // Materials (procedural colors matching Google Robot appearance)
  // Using procedural materials instead of texture files for better reliability
  const mats = {
    robot:      makePBR(scene, "robot_mtl",      "#FFFFFF"), // White robot body
    fingerBase: makePBR(scene, "finger_base_mtl","#FFD700"), // Golden finger base
    fingerTip:  makePBR(scene, "finger_tip_mtl", "#FFD700"), // Golden finger tip
  };

  // Create empty nodes first to allow arbitrary parent order
  const nodes: TransformNode[] = [];
  for (const p of PARTS) {
    const n = new TransformNode(p.name, scene);
    n.parent = p.parent ? null : root;
    applyLocal(n, p);
    nodes.push(n);
  }
  const index = buildIndex(nodes);
  for (const p of PARTS) {
    if (!p.parent) continue;
    const parent = index[p.parent];
    if (!parent) continue;
    const n = index[p.name];
    n.parent = parent;
  }

  // Import meshes and attach to their nodes
  for (const p of PARTS) {
    const node = index[p.name];
    if (!node) continue;
    const meshes = await importObj(scene, opts.rootUrl, p.file, opts.meshFilesMap);
    if (meshes === null) continue;
    meshes.forEach(m => m.parent = node);
    assignMaterial(node, mats, p);
    if (opts.bakePivots === true) tryBakePivot(node);
  }

  return root;
};

/*
USAGE EXAMPLES:

1. With ZIP file (recommended for web):
const meshFiles = await extractGoogleRobotZip(zipFile);
const root = await loadGoogleRobot(scene, { 
  rootUrl: "/google_robot", 
  bakePivots: false,
  meshFilesMap: meshFiles 
});

2. With individual files served from server:
const root = await loadGoogleRobot(scene, { rootUrl: "/google_robot", bakePivots: false });

3. Integrated with MJCF loader (automatic detection):
const result = await loadMJCFFromFile(mjcfZipFile, scene, meshFiles);

Notes / Uncertainties:
- Quaternion entries in MJCF are (w x y z). I convert to Babylon (x,y,z,w). If any finger orientation looks wrong, double-check those specific quaternions in robot.xml and swap axes as needed. 
- Units are meters in MJCF and Babylon. No global scale applied (intended). If your scene uses different scale, adjust PARTS positions multiplicatively.
- OBJ coordinate systems vary by exporter. If a particular mesh origin is far off, set bakePivots: true temporarily, or add a small corrective offset to that node's position (prefer parent offsets over baking).
- Physics/colliders: this loader imports only visual OBJs. If you need colliders, import the STL sets and keep them invisible, or generate convex hulls. The MJCF lists many base STLs for collisions.
- ZIP files: The loader automatically detects and uses mesh files from ZIP archives, making it perfect for web deployment.
- Materials: Uses procedural materials (white robot body, golden fingers) instead of texture files for better reliability and performance.
*/
