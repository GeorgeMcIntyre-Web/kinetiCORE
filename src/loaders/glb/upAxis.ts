// upAxis.ts - Improved multi-method up-axis detection
import {
  AbstractMesh,
  Matrix,
  Quaternion,
  TransformNode,
  Vector3,
  Scene,
} from "@babylonjs/core";

type UpAxis = "Y" | "Z";
type Method = "PCA" | "AABB" | "NORMALS" | "COMBINED";

export type UpAxisDetectionResult = {
  detected: UpAxis;
  confidence: number;     // 0..1
  method: Method;
  applied: boolean;       // rotation/wrapper applied
  logs?: string[];
};

export type UpAxisOptions = {
  autoFix?: boolean;              // default true
  verbose?: boolean;              // default false
  confidenceThreshold?: number;   // default 0.6
  useWrapper?: boolean;           // default true (rotate container, no baking)
  fileKey?: string;               // cache key so siblings get same decision
};

const decisionCache = new Map<string, UpAxis>();
const yawCache = new Map<string, number>();
const radNeg90X = Quaternion.FromEulerAngles(-Math.PI / 2, 0, 0);

export function clearUpAxisCache(): void {
  decisionCache.clear();
  yawCache.clear();
  console.log("[UpAxis] Decision cache cleared");
}

export function autoFixUpAxis(
  fileContainer: TransformNode,
  opts: UpAxisOptions = {},
): UpAxisDetectionResult {
  const logs: string[] = [];
  const verbose = opts.verbose === true;
  const autoFix = opts.autoFix !== false;
  const useWrapper = opts.useWrapper !== false;
  const minConf = opts.confidenceThreshold ?? 0.5;

  if (!fileContainer) {
    return { detected: "Y", confidence: 1, method: "COMBINED", applied: false };
  }

  // 1) Cache: force siblings to share the same decision
  if (opts.fileKey && decisionCache.has(opts.fileKey)) {
    const forced = decisionCache.get(opts.fileKey)!;
    const applied = autoFix ? applyDecision(fileContainer, forced, useWrapper, logs) : false;
    if (verbose) logs.push(`[UpAxis] Using cached decision for ${opts.fileKey}: ${forced}`);
    console.log(`[UpAxis] CACHE HIT: ${opts.fileKey} -> ${forced} (sibling consistency)`);
    return { detected: forced, confidence: 1, method: "COMBINED", applied, logs };
  }

  // 2) Detect using all three methods
  const bbox = computeExtents(fileContainer);
  const pca = detectViaPCA(fileContainer, logs);
  const aabb = detectViaAABB(bbox, logs);
  const combined = combineDecisions(pca, aabb, bbox, fileContainer, logs);

  if (verbose) {
    logs.push(`[UpAxis] === DETECTION SUMMARY ===`);
    logs.push(`[UpAxis] PCA => ${pca.detected} (${(pca.confidence*100).toFixed(0)}%)`);
    logs.push(`[UpAxis] AABB => ${aabb.detected} (${(aabb.confidence*100).toFixed(0)}%)`);
    logs.push(`[UpAxis] Combined => ${combined.detected} (${(combined.confidence*100).toFixed(0)}%)`);
    logs.push(`[UpAxis] Extents: X=${bbox.x.toFixed(3)}, Y=${bbox.y.toFixed(3)}, Z=${bbox.z.toFixed(3)}`);
    logs.push(`[UpAxis] Confidence threshold: ${(minConf*100).toFixed(0)}%`);
    logs.forEach(log => console.log(log));
  }

  let decided: UpAxis = combined.detected as UpAxis;
  let confidence = combined.confidence;
  let method: Method = combined.method as Method;

  // 3) If confidence is low, default to Y (safer no-op)
  if (confidence < minConf) {
    decided = "Y";
    method = "COMBINED";
    confidence = minConf;
    if (verbose) {
      logs.push(`[UpAxis] Confidence too low (${(confidence*100).toFixed(0)}% < ${(minConf*100).toFixed(0)}%), defaulting to Y-up (no rotation).`);
      console.log(`[UpAxis] LOW CONFIDENCE - defaulting to Y-up for safety`);
    }
  } else {
    if (verbose) {
      logs.push(`[UpAxis] High confidence decision: ${decided}-up (${(confidence*100).toFixed(0)}%)`);
      console.log(`[UpAxis] HIGH CONFIDENCE - using ${decided}-up detection`);
    }
  }

  // 4) Special case: If we have strong evidence for Z-up but low combined confidence,
  // trust the individual methods that agree
  if (decided === "Y" && confidence < minConf) {
    // Check if PCA and AABB both agree on Z-up with high confidence
    if (pca.detected === "Z" && aabb.detected === "Z" && 
        pca.confidence > 0.7 && aabb.confidence > 0.7) {
      decided = "Z";
      confidence = Math.min(pca.confidence, aabb.confidence);
      method = "COMBINED";
      if (verbose) {
        logs.push(`[UpAxis] OVERRIDE: Strong PCA/AABB agreement on Z-up despite low combined confidence`);
        console.log(`[UpAxis] OVERRIDE: Using Z-up based on strong PCA/AABB agreement`);
      }
    }
  }

  if (opts.fileKey) {
    decisionCache.set(opts.fileKey, decided);
    console.log(`[UpAxis] CACHE SET: ${opts.fileKey} -> ${decided} (confidence: ${(confidence*100).toFixed(0)}%)`);
  }

  const applied = autoFix ? applyDecision(fileContainer, decided, useWrapper, logs) : false;
  return { detected: decided, confidence, method, applied, logs };
}

/* ---------------------- detection helpers ---------------------- */

function computeExtents(root: TransformNode) {
  const min = new Vector3(+Infinity, +Infinity, +Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);

  const meshes = root.getChildMeshes(false) as AbstractMesh[];
  for (const m of meshes) {
    if (!m.isVisible || m.getTotalVertices() === 0) continue;
    m.refreshBoundingInfo({});
    const bi = m.getBoundingInfo();
    const v = bi.boundingBox.vectors; // 8 corners in world space
    for (let i = 0; i < v.length; i++) {
      min.minimizeInPlace(v[i]);
      max.maximizeInPlace(v[i]);
    }
  }
  const ext = max.subtract(min);
  return { min, max, x: Math.abs(ext.x), y: Math.abs(ext.y), z: Math.abs(ext.z) };
}

function detectViaPCA(root: TransformNode, logs: string[]) {
  // PCA on vertex positions - identifies the axis with greatest spread
  const sums = { xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 };
  let totalVerts = 0;
  
  const meshes = root.getChildMeshes(false) as AbstractMesh[];

  for (const m of meshes) {
    const ps = m.getVerticesData("position");
    const idx = m.getIndices();
    if (!ps || !idx) continue;

    const world = m.getWorldMatrix();
    for (let i = 0; i < idx.length; i++) {
      const pi = idx[i] * 3;
      const pw = Vector3.TransformCoordinates(
        new Vector3(ps[pi], ps[pi + 1], ps[pi + 2]),
        world,
      );
      sums.xx += pw.x * pw.x;
      sums.yy += pw.y * pw.y;
      sums.zz += pw.z * pw.z;
      sums.xy += pw.x * pw.y;
      sums.xz += pw.x * pw.z;
      sums.yz += pw.y * pw.z;
      totalVerts++;
    }
  }

  if (totalVerts === 0) {
    return { detected: "Y" as UpAxis, confidence: 0.3, method: "PCA" as const };
  }

  // Normalize by vertex count
  const varY = sums.yy / totalVerts;
  const varZ = sums.zz / totalVerts;
  
  // Calculate relative difference
  const total = varY + varZ || 1;
  const diff = Math.abs(varZ - varY);
  const relDiff = diff / total;
  
  // Confidence based on variance separation
  let conf: number;
  if (relDiff < 0.1) {
    conf = 0.35; // Very similar variance
  } else if (relDiff < 0.25) {
    conf = 0.55;
  } else if (relDiff < 0.4) {
    conf = 0.7;
  } else if (relDiff < 0.6) {
    conf = 0.85;
  } else {
    conf = 0.95; // Clear dominant axis
  }

  const detected: UpAxis = varZ > varY ? "Z" : "Y";
  logs.push(`[UpAxis] PCA varY=${varY.toFixed(3)} varZ=${varZ.toFixed(3)} relDiff=${(relDiff*100).toFixed(1)}% conf=${conf.toFixed(2)}`);
  return { detected, confidence: conf, method: "PCA" as const };
}

function detectViaAABB(ext: { y: number; z: number }, logs: string[]) {
  const y = ext.y;
  const z = ext.z;
  
  // Calculate ratio and difference
  const ratio = y > z ? y / (z || 1e-6) : z / (y || 1e-6);
  const diff = Math.abs(y - z);
  const larger = Math.max(y, z);
  const relDiff = diff / (larger || 1e-6);
  
  const detected: UpAxis = z > y ? "Z" : "Y";
  
  // Nuanced confidence based on relative difference
  let conf: number;
  
  if (relDiff < 0.05) {
    // Nearly equal - very uncertain (within 5%)
    conf = 0.3;
  } else if (relDiff < 0.15) {
    // Close but distinguishable (5-15%)
    conf = 0.5;
  } else if (relDiff < 0.3) {
    // Moderate difference (15-30%)
    conf = 0.7;
  } else if (relDiff < 0.5) {
    // Clear difference (30-50%)
    conf = 0.85;
  } else {
    // Very clear difference (>50%)
    conf = 0.95;
  }
  
  logs.push(`[UpAxis] AABB y=${y.toFixed(3)} z=${z.toFixed(3)} ratio=${ratio.toFixed(2)} relDiff=${(relDiff*100).toFixed(1)}% conf=${conf.toFixed(2)}`);
  return { detected, confidence: conf, method: "AABB" as const };
}

function normalsVote(root: TransformNode, logs: string[]) {
  // Weighted triangle normal vote - most reliable for flat objects
  let sumY = 0;
  let sumZ = 0;
  let totalArea = 0;

  const meshes = root.getChildMeshes(false) as AbstractMesh[];
  for (const m of meshes) {
    const p = m.getVerticesData("position");
    const idx = m.getIndices();
    if (!p || !idx) continue;

    const w = m.getWorldMatrix();
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      const A = Vector3.TransformCoordinates(new Vector3(p[a], p[a + 1], p[a + 2]), w);
      const B = Vector3.TransformCoordinates(new Vector3(p[b], p[b + 1], p[b + 2]), w);
      const C = Vector3.TransformCoordinates(new Vector3(p[c], p[c + 1], p[c + 2]), w);
      const n = Vector3.Cross(B.subtract(A), C.subtract(A));
      const area = n.length() * 0.5;
      
      if (area < 1e-10) continue; // Skip degenerate triangles
      
      const an = n.normalizeToNew();

      sumY += Math.abs(an.y) * area;
      sumZ += Math.abs(an.z) * area;
      totalArea += area;
    }
  }

  const total = sumY + sumZ || 1;
  const relDiff = Math.abs(sumZ - sumY) / total;
  
  // More aggressive confidence scaling for normals
  // They are the most reliable indicator of orientation
  let conf: number;
  if (relDiff < 0.05) {
    conf = 0.3; // Very balanced - unclear
  } else if (relDiff < 0.15) {
    conf = 0.5; // Slight preference
  } else if (relDiff < 0.25) {
    conf = 0.7; // Moderate confidence
  } else if (relDiff < 0.35) {
    conf = 0.85; // Strong confidence
  } else {
    conf = 0.95; // Very strong confidence
  }
  
  const detected: UpAxis = sumZ > sumY ? "Z" : "Y";
  logs.push(`[UpAxis] NORMALS vote y=${sumY.toFixed(3)} z=${sumZ.toFixed(3)} relDiff=${(relDiff*100).toFixed(1)}% totalArea=${totalArea.toFixed(2)} conf=${conf.toFixed(2)}`);
  return { detected, confidence: conf, method: "NORMALS" as const };
}

function combineDecisions(
  pca: { detected: UpAxis; confidence: number; method: Method },
  aabb: { detected: UpAxis; confidence: number; method: Method },
  ext: { y: number; z: number },
  root: TransformNode,
  logs: string[],
) {
  const nv = normalsVote(root, logs);
  
  // Check for ambiguous geometry
  const yzRatio = Math.min(ext.y, ext.z) / Math.max(ext.y, ext.z);
  const isAmbiguous = yzRatio > 0.7; // Within 30% = ambiguous
  
  // RULE 1: Strong PCA/AABB agreement (>80%) overrides everything
  if (pca.detected === aabb.detected && 
      pca.confidence > 0.8 && 
      aabb.confidence > 0.8) {
    const conf = Math.max(pca.confidence, aabb.confidence);
    logs.push(`[UpAxis] STRONG PCA/AABB AGREEMENT: ${pca.detected}-up (PCA: ${(pca.confidence*100).toFixed(0)}%, AABB: ${(aabb.confidence*100).toFixed(0)}%)`);
    return { detected: pca.detected, confidence: conf, method: "COMBINED" as const };
  }
  
  // RULE 2: Triple agreement (all methods agree)
  if (pca.detected === aabb.detected && aabb.detected === nv.detected) {
    const avgConf = (pca.confidence + aabb.confidence + nv.confidence) / 3;
    logs.push(`[UpAxis] TRIPLE AGREEMENT: ${pca.detected}-up (all methods agree)`);
    return { detected: pca.detected, confidence: Math.min(0.95, avgConf + 0.15), method: "COMBINED" as const };
  }
  
  // RULE 3: High-confidence normals (>60%)
  if (nv.confidence > 0.6) {
    logs.push(`[UpAxis] HIGH-CONFIDENCE NORMALS: ${nv.detected}-up (${(nv.confidence*100).toFixed(0)}%)`);
    return { detected: nv.detected, confidence: nv.confidence, method: "NORMALS" as const };
  }
  
  // RULE 4: Ambiguous geometry - trust normals at lower confidence
  if (isAmbiguous && nv.confidence >= 0.45) {
    logs.push(`[UpAxis] AMBIGUOUS GEOMETRY: trusting normals at ${(nv.confidence*100).toFixed(0)}%`);
    return { detected: nv.detected, confidence: nv.confidence + 0.1, method: "NORMALS" as const };
  }
  
  // RULE 5: Majority vote (2 out of 3)
  const votes = [
    { method: 'PCA', axis: pca.detected, conf: pca.confidence },
    { method: 'AABB', axis: aabb.detected, conf: aabb.confidence },
    { method: 'NORMALS', axis: nv.detected, conf: nv.confidence }
  ];
  
  const yVotes = votes.filter(v => v.axis === 'Y');
  const zVotes = votes.filter(v => v.axis === 'Z');
  
  if (yVotes.length >= 2) {
    const avgConf = yVotes.reduce((sum, v) => sum + v.conf, 0) / yVotes.length;
    logs.push(`[UpAxis] MAJORITY: Y-up (${yVotes.map(v => v.method).join(', ')})`);
    return { detected: 'Y', confidence: Math.min(0.8, avgConf + 0.1), method: "COMBINED" as const };
  }
  
  if (zVotes.length >= 2) {
    const avgConf = zVotes.reduce((sum, v) => sum + v.conf, 0) / zVotes.length;
    logs.push(`[UpAxis] MAJORITY: Z-up (${zVotes.map(v => v.method).join(', ')})`);
    return { detected: 'Z', confidence: Math.min(0.8, avgConf + 0.1), method: "COMBINED" as const };
  }
  
  // RULE 6: Weighted scoring (last resort)
  const weights = isAmbiguous 
    ? { PCA: 0.2, AABB: 0.2, NORMALS: 0.6 }
    : { PCA: 0.3, AABB: 0.3, NORMALS: 0.4 };
  
  let yScore = 0, zScore = 0;
  if (pca.detected === 'Y') yScore += weights.PCA * pca.confidence;
  else zScore += weights.PCA * pca.confidence;
  if (aabb.detected === 'Y') yScore += weights.AABB * aabb.confidence;
  else zScore += weights.AABB * aabb.confidence;
  if (nv.detected === 'Y') yScore += weights.NORMALS * nv.confidence;
  else zScore += weights.NORMALS * nv.confidence;
  
  const detected: UpAxis = yScore > zScore ? 'Y' : 'Z';
  const confidence = Math.max(yScore, zScore);
  
  logs.push(`[UpAxis] WEIGHTED: ${detected}-up (Y=${yScore.toFixed(2)}, Z=${zScore.toFixed(2)})`);
  return { detected, confidence, method: "COMBINED" as const };
}

/* ---------------------- application helpers ---------------------- */

function applyDecision(
  container: TransformNode,
  decided: UpAxis,
  useWrapper: boolean,
  logs: string[],
) {
  if (decided === "Y") return false; // no change needed

  if (useWrapper) {
    applyWrapperZtoY(container, logs);
    return true;
  }

  // fallback: destructive bake (not recommended)
  rotateContainerZtoY_Bake(container, logs);
  return true;
}

function applyWrapperZtoY(container: TransformNode, logs: string[]) {
  const scene = container.getScene() as Scene;
  const parent = container.parent as TransformNode | null;
  
  // Get container's current world position (this is the intended CAD position)
  const worldPos = container.getAbsolutePosition().clone();
  
  // Create wrapper at the SAME position as container
  const wrapper = new TransformNode(`${container.name}__upfix`, scene);
  wrapper.position.copyFrom(worldPos);

  if (parent) wrapper.setParent(parent, true);
  
  // CRITICAL: Parent container to wrapper WITHOUT changing world matrix
  container.setParent(wrapper, true); // keepWorldMatrix=true preserves world position
  
  // Now apply rotation to wrapper
  // Since container's local position relative to wrapper is (0,0,0), 
  // rotation happens around the wrapper's position (which is the model's position)
  const q = wrapper.rotationQuaternion ?? Quaternion.Identity();
  wrapper.rotationQuaternion = q.multiply(radNeg90X);

  wrapper.metadata = wrapper.metadata || {};
  wrapper.metadata.__axisWrapper = true;

  container.metadata = container.metadata || {};
  container.metadata.__axisFixed = true;
  container.metadata.__wrapperNode = wrapper;

  logs.push(`[UpAxis] Wrapper created at ${worldPos.toString()}, rotation applied in-place`);
}

function rotateContainerZtoY_Bake(container: TransformNode, logs: string[]) {
  const meshes = container.getChildMeshes(false) as AbstractMesh[];
  const rmat = Matrix.RotationX(-Math.PI / 2);

  for (const m of meshes) {
    if (!(m instanceof AbstractMesh)) continue;
    // Apply rotation to the mesh's transform instead of baking into vertices
    m.rotationQuaternion = (m.rotationQuaternion ?? Quaternion.Identity()).multiply(Quaternion.FromRotationMatrix(rmat));
    m.refreshBoundingInfo({});
    m.computeWorldMatrix(true);
  }

  container.rotation = Vector3.Zero();
  container.rotationQuaternion = Quaternion.Identity();
  container.computeWorldMatrix(true);

  logs.push(`[UpAxis] Applied Z→Y via baking`);
}

/* ---------------------- yaw normalization ---------------------- */

function ensureAxisWrapper(container: TransformNode): TransformNode {
  // 1) Check if wrapper already exists in metadata
  if (container.metadata?.__wrapperNode) {
    const existing = container.metadata.__wrapperNode as TransformNode;
    if (existing && !existing.isDisposed()) {
      return existing;
    }
  }

  // 2) Check if parent is already a wrapper
  const parent = container.parent as TransformNode | null;
  if (parent?.metadata?.__axisWrapper === true) {
    container.metadata = container.metadata || {};
    container.metadata.__wrapperNode = parent;
    return parent;
  }

  // 3) Prevent circular references
  if (parent && (parent.name.includes('__wrap') || parent.name.includes('__upfix'))) {
    console.warn(`[UpAxis] Circular reference prevented for ${container.name}`);
    return container; // Return self to avoid creating wrapper
  }

  // 4) Create new wrapper
  const scene = container.getScene() as Scene;
  const wrapper = new TransformNode(`${container.name}__wrap`, scene);
  
  // Preserve world position
  const worldPos = container.getAbsolutePosition().clone();
  wrapper.position.copyFrom(worldPos);

  // Maintain hierarchy
  if (parent) wrapper.setParent(parent, true);
  container.setParent(wrapper, true); // keepWorldMatrix

  // Mark as wrapper
  wrapper.metadata = { __axisWrapper: true };
  container.metadata = container.metadata || {};
  container.metadata.__wrapperNode = wrapper;

  return wrapper;
}

/**
 * Normalize yaw on the ground plane so similar files share the same "landscape" orientation.
 * Rule: if extX < extZ by a small margin, rotate +90° around Y.
 */
export function normalizeYawOnGroundPlane(
  container: TransformNode,
  opts: { fileKey?: string; verbose?: boolean } = {}
): { applied: boolean; angle: number } {
  const verbose = !!opts.verbose;

  // 1) Check cache
  if (opts.fileKey && yawCache.has(opts.fileKey)) {
    const cached = yawCache.get(opts.fileKey)!;
    if (cached !== 0) {
      // Reuse existing wrapper if available
      const w = container.metadata?.__wrapperNode || ensureAxisWrapper(container);
      const q = w.rotationQuaternion ?? Quaternion.Identity();
      w.rotationQuaternion = q.multiply(Quaternion.FromEulerAngles(0, cached, 0));
    }
    if (verbose) console.log(`[Yaw] Cached: ${(cached * 180 / Math.PI).toFixed(0)}°`);
    return { applied: cached !== 0, angle: cached };
  }

  // 2) Calculate angle
  const ext = computeExtents(container);
  const x = Math.abs(ext.x);
  const z = Math.abs(ext.z);
  const THRESH = 1.05;
  const angle = z > x * THRESH ? Math.PI / 2 : 0;

  if (opts.fileKey) yawCache.set(opts.fileKey, angle);
  if (angle === 0) {
    if (verbose) console.log("[Yaw] No rotation needed");
    return { applied: false, angle: 0 };
  }

  // 3) Apply rotation - REUSE existing wrapper
  const w = container.metadata?.__wrapperNode || ensureAxisWrapper(container);
  const q = w.rotationQuaternion ?? Quaternion.Identity();
  w.rotationQuaternion = q.multiply(Quaternion.FromEulerAngles(0, angle, 0));
  
  if (verbose) console.log(`[Yaw] Applied +90° around Y`);
  return { applied: true, angle };
}

/* ---------------------- diagnostic utilities ---------------------- */

/**
 * Diagnose up-axis without applying any transformations
 * Useful for debugging and understanding what detection thinks
 */
export function diagnoseUpAxis(
  container: TransformNode,
  fileKey?: string
): {
  extents: { x: number; y: number; z: number };
  pca: { detected: UpAxis; confidence: number };
  aabb: { detected: UpAxis; confidence: number };
  normals: { detected: UpAxis; confidence: number };
  recommendation: { detected: UpAxis; confidence: number };
  logs: string[];
} {
  const logs: string[] = [];
  
  const bbox = computeExtents(container);
  const pca = detectViaPCA(container, logs);
  const aabb = detectViaAABB(bbox, logs);
  const nv = normalsVote(container, logs);
  const combined = combineDecisions(pca, aabb, bbox, container, logs);
  
  console.group(`[UpAxis Diagnostic]${fileKey ? ` ${fileKey}` : ''}`);
  console.log('Extents:', `X=${bbox.x.toFixed(3)}, Y=${bbox.y.toFixed(3)}, Z=${bbox.z.toFixed(3)}`);
  console.log('PCA:', `${pca.detected}-up (${(pca.confidence*100).toFixed(0)}% confidence)`);
  console.log('AABB:', `${aabb.detected}-up (${(aabb.confidence*100).toFixed(0)}% confidence)`);
  console.log('Normals:', `${nv.detected}-up (${(nv.confidence*100).toFixed(0)}% confidence)`);
  console.log('Recommendation:', `${combined.detected}-up (${(combined.confidence*100).toFixed(0)}% confidence)`);
  logs.forEach(log => console.log(log));
  console.groupEnd();
  
  return {
    extents: { x: bbox.x, y: bbox.y, z: bbox.z },
    pca: { detected: pca.detected as UpAxis, confidence: pca.confidence },
    aabb: { detected: aabb.detected as UpAxis, confidence: aabb.confidence },
    normals: { detected: nv.detected as UpAxis, confidence: nv.confidence },
    recommendation: { detected: combined.detected as UpAxis, confidence: combined.confidence },
    logs
  };
}

/**
 * Test if a file should be detected as Y-up or Z-up by manually inspecting
 * You can call this from console: window.testUpAxis(yourTransformNode, "test-file")
 */
if (typeof window !== 'undefined') {
  (window as any).diagnoseUpAxis = diagnoseUpAxis;
}