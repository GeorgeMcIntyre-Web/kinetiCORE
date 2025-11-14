/**
 * Direct bounding-box pairing test - no dependencies on selection
 * Copy-paste this entire block into browser console
 */

(async () => {
  // Resolve BABYLON
  const BAB = window.BABYLON;
  if (!BAB) throw new Error('BABYLON not found on window. Ensure the viewer is loaded.');

  // Resolve scene
  const smMod = await import('/src/scene/SceneManager').catch(() => ({}));
  const SceneManager = smMod.SceneManager;
  const scene =
    SceneManager?.getInstance?.()?.getScene?.() ||
    BAB.EngineStore?.LastCreatedScene ||
    (BAB.EngineStore?.Instances?.[0]?.scenes?.[0]);
  if (!scene) throw new Error('No scene found');

  console.log(`Scene found: ${scene.meshes.length} meshes, ${scene.transformNodes.length} transformNodes`);

  // Helper: compute bbox signature
  const sigOf = (tn) => {
    if (!tn) return null;
    tn.computeWorldMatrix(true);
    const meshes = tn.getChildMeshes(false);
    if (!meshes || meshes.length === 0) return null;

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
    return { tn, name: tn.name, dims, volume, pos: tn.getAbsolutePosition(), meshCount: meshes.length };
  };

  // Helper: dimension similarity
  const sim = (a, b) => {
    const diff = [
      Math.abs(a[0] - b[0]) / Math.max(a[0], b[0], 1e-6),
      Math.abs(a[1] - b[1]) / Math.max(a[1], b[1], 1e-6),
      Math.abs(a[2] - b[2]) / Math.max(a[2], b[2], 1e-6),
    ];
    return Math.max(0, 1 - (diff[0] * 0.2 + diff[1] * 0.3 + diff[2] * 0.5));
  };

  // Find all UNIT_* transform nodes
  const unitRoots = scene.transformNodes.filter(t => /^UNIT_/.test(t.name));
  console.log(`Found ${unitRoots.length} UNIT_* nodes:`, unitRoots.map(u => u.name));

  if (unitRoots.length === 0) {
    console.error('No UNIT_* nodes found. Ensure GLB is loaded.');
    return;
  }

  const results = [];

  for (const unit of unitRoots.slice(0, 5)) { // Test first 5 units
    console.log(`\n=== Processing ${unit.name} ===`);

    // Collect all descendants (TransformNodes only)
    const descendants = [];
    const stack = [unit];
    const visited = new Set();
    while (stack.length) {
      const n = stack.pop();
      if (!n || visited.has(n.uniqueId)) continue;
      visited.add(n.uniqueId);
      if (n instanceof BAB.TransformNode && !(n instanceof BAB.AbstractMesh)) {
        descendants.push(n);
      }
      const children = n.getChildren?.() || [];
      stack.push(...children);
    }

    console.log(`  ${descendants.length} TransformNode descendants found`);

    // Filter to those with meshes
    const candidates = descendants.filter(tn => {
      const meshes = tn.getChildMeshes(false);
      return meshes && meshes.length > 0;
    });

    console.log(`  ${candidates.length} candidates with meshes:`);
    candidates.forEach(c => console.log(`    - ${c.name} (${c.getChildMeshes(false).length} meshes)`));

    // Compute signatures
    const sigs = candidates.map(sigOf).filter(Boolean);
    console.log(`  ${sigs.length} valid signatures`);

    // Pair by bbox similarity
    const pairs = [];
    for (let i = 0; i < sigs.length; i++) {
      for (let j = i + 1; j < sigs.length; j++) {
        const A = sigs[i];
        const B = sigs[j];
        const vr = A.volume / B.volume;
        if (vr < 0.9 || vr > 1.1) continue; // Volume ratio check
        const s = sim(A.dims, B.dims);
        if (s < 0.95) continue; // Similarity check
        const d = BAB.Vector3.Distance(A.pos, B.pos);
        pairs.push({ unit: unit.name, A, B, sim: s, volRatio: vr, posDelta: d });
        console.log(`  ✓ MATCH: ${A.name} ↔ ${B.name} (sim=${s.toFixed(3)}, volRatio=${vr.toFixed(3)})`);
      }
    }

    // Pick best pair per unit
    if (pairs.length > 0) {
      pairs.sort((p, q) => q.sim - p.sim);
      const p = pairs[0];
      const conn = (tn) => (tn.getChildren?.() || []).length;
      const scoreA = (p.A.pos.length() < p.B.pos.length() ? 1 : 0) * 0.4 + (conn(p.A.tn) > conn(p.B.tn) ? 1 : 0) * 0.6;
      const scoreB = (p.B.pos.length() < p.A.pos.length() ? 1 : 0) * 0.4 + (conn(p.B.tn) > conn(p.A.tn) ? 1 : 0) * 0.6;
      const fixed = scoreA >= scoreB ? p.A : p.B;
      const moving = scoreA >= scoreB ? p.B : p.A;
      results.push({
        unit: unit.name,
        fixed: fixed.name,
        moving: moving.name,
        sim: p.sim.toFixed(3),
        volRatio: p.volRatio.toFixed(3),
        posDelta_m: p.posDelta.toFixed(3),
      });
    } else {
      console.log(`  No pairs found for ${unit.name}`);
    }
  }

  if (results.length === 0) {
    console.warn('\n⚠️ No bbox pairs found. Try lowering similarity threshold from 0.95 to 0.90.');
  } else {
    console.log('\n=== RESULTS ===');
    console.table(results);
  }

  return results;
})();

