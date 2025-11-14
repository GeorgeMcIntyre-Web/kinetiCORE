/**
 * Diagnostic tool for bottom-up pairing - shows detailed mesh-to-container traversal
 * 
 * Run: await import('/src/dev/diagnoseBottomUpPairing.js').then(m => m.diagnoseBottomUpPairing());
 */

export async function diagnoseBottomUpPairing(unitName = 'UNIT_112') {
  try {
    const BAB = window.BABYLON || (await import('/node_modules/@babylonjs/core/Legacy/legacy.js'));
    const smMod = await import('/src/scene/SceneManager').catch(() => ({}));
    const SceneManager = smMod.SceneManager;
    const scene =
      SceneManager?.getInstance?.()?.getScene?.() ||
      BAB.EngineStore?.LastCreatedScene ||
      (BAB.EngineStore?.Instances?.[0]?.scenes?.[0]) ||
      (BAB.Engine?.LastCreatedEngine?.scenes?.[0]);
    if (!scene) throw new Error('No scene');

    const unit = scene.getTransformNodeByName(unitName) || 
                 scene.transformNodes.find(t => (t.name || '').includes(unitName));
    if (!unit) throw new Error(`${unitName} not found`);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Diagnosing bottom-up pairing: ${unit.name}`);
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

    // Step 2: Show sample mesh paths
    console.log('Sample meshes (first 10):');
    const sampleMeshes = allMeshes.slice(0, 10);
    for (const mesh of sampleMeshes) {
      const path = [];
      let cur = mesh;
      while (cur && cur !== unit.parent) {
        path.unshift(cur.name || String(cur.uniqueId));
        cur = cur.parent;
      }
      console.log(`  - ${path.join(' → ')}`);
    }
    console.log('');

    // Step 3: Simulate findMeaningfulContainer for a few meshes
    const computeAggregateBBox = (tn) => {
      tn.computeWorldMatrix(true);
      const allMeshes = tn.getChildMeshes(false) || [];
      if (allMeshes.length === 0) return null;
      
      let min = new BAB.Vector3(+Infinity, +Infinity, +Infinity);
      let max = new BAB.Vector3(-Infinity, -Infinity, -Infinity);
      
      for (const m of allMeshes) {
        m.computeWorldMatrix(true);
        const bb = m.getBoundingInfo().boundingBox;
        min = BAB.Vector3.Minimize(min, bb.minimumWorld);
        max = BAB.Vector3.Maximize(max, bb.maximumWorld);
      }
      
      const size = max.subtract(min);
      const volume = Math.abs(size.x * size.y * size.z);
      return { volume, meshCount: allMeshes.length };
    };

    const findMeaningfulContainer = (startNode, unitRoot) => {
      let current = startNode;
      let bestContainer = null;
      let bestScore = -1;
      const path = [];
      let depth = 0;

      while (current && current !== unitRoot && current.parent) {
        depth++;
        current = current.parent;
        
        if (!(current instanceof BAB.TransformNode) || current instanceof BAB.AbstractMesh) {
          continue;
        }

        const tn = current;
        const bbox = computeAggregateBBox(tn);
        if (!bbox) continue;

        const children = (tn.getChildren?.() || []);
        const childCount = children.length;
        
        const volumeScore = bbox.volume >= 0.0001 * 100 ? 1 : 0;
        const connectivityScore = childCount >= 2 ? 1 : 0;
        const depthScore = depth >= 2 && depth <= 5 ? 1 : 0;
        
        const score = (volumeScore * 0.5 + connectivityScore * 0.3 + depthScore * 0.2);
        
        path.push({
          name: tn.name,
          depth,
          volume: bbox.volume,
          meshCount: bbox.meshCount,
          childCount,
          score: score.toFixed(2),
        });

        if (score > bestScore && bbox.volume >= 0.0001 * 50) {
          bestScore = score;
          bestContainer = tn;
        }
        
        if (depth > 6) break;
      }

      return { container: bestContainer, path };
    };

    // Test a few meshes
    console.log('🔍 Step 2: Mesh → Container Traversal (sample):\n');
    const testMeshes = allMeshes.slice(0, 5);
    for (const mesh of testMeshes) {
      const { container, path } = findMeaningfulContainer(mesh, unit);
      console.log(`Mesh: ${mesh.name || mesh.uniqueId}`);
      console.log(`  Path upward:`);
      for (const step of path) {
        const marker = step.name === container?.name ? ' ⭐ BEST' : '';
        console.log(`    [d${step.depth}] ${step.name}: vol=${step.volume.toExponential(2)}m³, meshes=${step.meshCount}, children=${step.childCount}, score=${step.score}${marker}`);
      }
      console.log(`  → Selected container: ${container?.name || 'NONE'}\n`);
    }

    // Step 4: Run actual analyzer
    console.log(`${'='.repeat(80)}`);
    console.log('Running GeometricToolAnalyzer...\n');
    
    const { GeometricToolAnalyzer } = await import('/src/babylon/sceneAnalysis/GeometricToolAnalyzer');
    const analyzer = new GeometricToolAnalyzer();

    const toolGraph = analyzer.analyze(
      scene,
      {
        similarityThreshold: 0.95,
        minVolume: 0.0001,
      },
      unit
    );

    console.log(`\n✅ Analysis Results:`);
    console.log(`   Total units: ${toolGraph.units.length}`);
    console.log(`   Fixed: ${toolGraph.units.filter(u => u.isFixed).length}`);
    console.log(`   Moving: ${toolGraph.units.filter(u => !u.isFixed).length}`);

    const idToName = (idStr) => {
      const idNum = parseInt(idStr, 10);
      const tn = Number.isFinite(idNum) ? scene.getTransformNodeByUniqueId(idNum) : null;
      return tn?.name || idStr;
    };

    console.log('\nUnits found:');
    for (const u of toolGraph.units) {
      console.log(`  ${u.isFixed ? '🔒 FIXED' : '🔓 MOVING'}: ${idToName(u.root)} (${u.nodes.length} nodes)`);
    }

    return { toolGraph, diagnostics: { totalMeshes: allMeshes.length } };
  } catch (err) {
    console.error('[Diagnostic] Error:', err);
    throw err;
  }
}

if (typeof window !== 'undefined') {
  console.log('[DEV] Diagnostic available: await import("/src/dev/diagnoseBottomUpPairing.js").then(m => m.diagnoseBottomUpPairing());');
}

