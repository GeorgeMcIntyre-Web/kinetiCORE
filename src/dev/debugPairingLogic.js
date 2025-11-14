/**
 * Debug why some containers don't have pairs
 */

export async function debugPairingLogic(unitName = 'UNIT_112') {
  try {
    const BAB = window.BABYLON;
    const scene = BAB.EngineStore?.LastCreatedScene;
    if (!scene) throw new Error('No scene');

    const unit = scene.getTransformNodeByName(unitName);
    if (!unit) throw new Error(`${unitName} not found`);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Debugging pairing logic for: ${unit.name}`);
    console.log(`${'='.repeat(80)}\n`);

    // Step 1: Collect all meshes
    const allMeshes = [];
    const collectMeshes = (node) => {
      if (node instanceof BAB.AbstractMesh) {
        allMeshes.push(node);
      }
      const children = (node.getChildren?.() || []);
      for (const child of children) {
        collectMeshes(child);
      }
    };
    collectMeshes(unit);

    console.log(`📦 Step 1: Found ${allMeshes.length} meshes\n`);

    // Step 2: Find meaningful containers (simplified version of the algorithm)
    const computeAggregateBBox = (tn) => {
      tn.computeWorldMatrix(true);
      const meshes = tn.getChildMeshes(false) || [];
      if (meshes.length === 0) return null;

      let min = new BAB.Vector3(+Infinity, +Infinity, +Infinity);
      let max = new BAB.Vector3(-Infinity, -Infinity, -Infinity);

      for (const m of meshes) {
        m.computeWorldMatrix(true);
        const bb = m.getBoundingInfo().boundingBox;
        min = BAB.Vector3.Minimize(min, bb.minimumWorld);
        max = BAB.Vector3.Maximize(max, bb.maximumWorld);
      }

      const size = max.subtract(min);
      const dims = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)].sort((a, b) => a - b);
      const volume = Math.abs(size.x * size.y * size.z);
      const pos = tn.getAbsolutePosition();
      const conn = (tn.getChildren?.() || []).length;

      return { dims, volume, pos, meshCount: meshes.length, connectivity: conn };
    };

    const findMeaningfulContainer = (startNode, unitRoot) => {
      let current = startNode;
      let bestContainer = null;
      let bestScore = -1;
      let depth = 0;
      const minVolume = 0.0001 * 50; // Same threshold as in code

      while (current && current !== unitRoot && current.parent) {
        depth++;
        current = current.parent;

        if (!(current instanceof BAB.TransformNode) || current instanceof BAB.AbstractMesh) {
          continue;
        }

        const tn = current;
        const bbox = computeAggregateBBox(tn);
        if (!bbox || bbox.volume < minVolume) continue;

        const children = (tn.getChildren?.() || []);
        const childCount = children.length;

        const volumeScore = bbox.volume >= 0.0001 * 100 ? 1 : 0;
        const connectivityScore = childCount >= 2 ? 1 : 0;
        const depthScore = depth >= 2 && depth <= 5 ? 1 : 0;

        const score = (volumeScore * 0.5 + connectivityScore * 0.3 + depthScore * 0.2);

        if (score > bestScore) {
          bestScore = score;
          bestContainer = tn;
        }

        if (depth > 6) break;
      }

      return bestContainer;
    };

    // Find containers
    const meshToContainer = new Map();
    for (const mesh of allMeshes) {
      const container = findMeaningfulContainer(mesh, unit);
      if (container) {
        meshToContainer.set(mesh, container);
      }
    }

    const uniqueContainers = new Set(Array.from(meshToContainer.values()));
    console.log(`📦 Step 2: Found ${uniqueContainers.size} unique meaningful containers from ${allMeshes.length} meshes\n`);

    // Step 3: Compute signatures
    const containerSigs = Array.from(uniqueContainers)
      .map(tn => ({ tn, sig: computeAggregateBBox(tn) }))
      .filter(x => x.sig && x.sig.volume >= 0.0001 * 50);

    console.log(`📊 Step 3: ${containerSigs.length} containers after volume filter\n`);

    // Show all containers
    console.log('All containers found:');
    for (const { tn, sig } of containerSigs) {
      console.log(`  - ${tn.name}: vol=${sig.volume.toExponential(2)}m³, dims=[${sig.dims.map(d => d.toFixed(3)).join(',')}], meshes=${sig.meshCount}, children=${sig.connectivity}`);
    }

    // Step 4: Try to find pairs
    const dimSimilarity = (a, b) => {
      const diff = [
        Math.abs(a[0] - b[0]) / Math.max(a[0], b[0], 1e-6),
        Math.abs(a[1] - b[1]) / Math.max(a[1], b[1], 1e-6),
        Math.abs(a[2] - b[2]) / Math.max(a[2], b[2], 1e-6),
      ];
      const w = [0.2, 0.3, 0.5];
      const d = diff[0] * w[0] + diff[1] * w[1] + diff[2] * w[2];
      return Math.max(0, 1 - d);
    };

    const SIM_THRESHOLD = 0.95;
    const VOL_RATIO_MIN = 0.9;
    const VOL_RATIO_MAX = 1.1;

    console.log(`\n🔍 Step 4: Finding pairs (sim >= ${SIM_THRESHOLD}, vol ratio ${VOL_RATIO_MIN}-${VOL_RATIO_MAX})...\n`);

    const pairs = [];
    const used = new Set();
    const unmatched = [];

    for (let i = 0; i < containerSigs.length; i++) {
      if (used.has(containerSigs[i].tn)) continue;

      let bestMatch = null;
      let bestSim = 0;

      for (let j = i + 1; j < containerSigs.length; j++) {
        if (used.has(containerSigs[j].tn)) continue;

        const A = containerSigs[i];
        const B = containerSigs[j];

        const vr = A.sig.volume / B.sig.volume;
        if (vr < VOL_RATIO_MIN || vr > VOL_RATIO_MAX) {
          continue; // Volume ratio doesn't match
        }

        const sim = dimSimilarity(A.sig.dims, B.sig.dims);
        if (sim < SIM_THRESHOLD) {
          continue; // Dimensions don't match
        }

        if (sim > bestSim) {
          bestSim = sim;
          bestMatch = { A, B, sim, vr };
        }
      }

      if (bestMatch) {
        pairs.push(bestMatch);
        used.add(bestMatch.A.tn);
        used.add(bestMatch.B.tn);
        console.log(`✓ PAIR: ${bestMatch.A.tn.name} ↔ ${bestMatch.B.tn.name} (sim=${bestSim.toFixed(3)}, volRatio=${bestMatch.vr.toFixed(3)})`);
      } else {
        unmatched.push(containerSigs[i]);
        console.log(`✗ NO MATCH: ${containerSigs[i].tn.name} (vol=${containerSigs[i].sig.volume.toExponential(2)}m³, dims=[${containerSigs[i].sig.dims.map(d => d.toFixed(3)).join(',')}])`);
      }
    }

    console.log(`\n📊 SUMMARY:`);
    console.log(`  Total containers: ${containerSigs.length}`);
    console.log(`  Paired: ${pairs.length * 2}`);
    console.log(`  Unmatched: ${unmatched.length}`);

    if (unmatched.length > 0) {
      console.log(`\n⚠️  Unmatched containers (these cause the imbalance):`);
      for (const { tn, sig } of unmatched) {
        console.log(`  - ${tn.name}: vol=${sig.volume.toExponential(2)}m³, dims=[${sig.dims.map(d => d.toFixed(3)).join(',')}], meshes=${sig.meshCount}`);
      }
    }

    return { pairs, unmatched, containers: containerSigs };
  } catch (err) {
    console.error('[Debug] Error:', err);
    throw err;
  }
}

if (typeof window !== 'undefined') {
  window.debugPairingLogic = debugPairingLogic;
  console.log('[DEV] Debug available: await import("/src/dev/debugPairingLogic.js").then(m => m.debugPairingLogic("UNIT_112"));');
}

