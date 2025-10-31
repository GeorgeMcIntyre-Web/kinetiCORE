/**
 * Quick test for bottom-up mesh-to-container pairing algorithm
 * 
 * Run in browser console:
 * await import('/src/dev/testBottomUpPairing.js').then(m => m.testBottomUpPairing());
 */

export async function testBottomUpPairing() {
  try {
    // 1) Resolve scene robustly
    const BAB = window.BABYLON || (await import('/node_modules/@babylonjs/core/Legacy/legacy.js'));
    const smMod = await import('/src/scene/SceneManager').catch(() => ({}));
    const SceneManager = smMod.SceneManager;
    const scene =
      SceneManager?.getInstance?.()?.getScene?.() ||
      BAB.EngineStore?.LastCreatedScene ||
      (BAB.EngineStore?.Instances?.[0]?.scenes?.[0]) ||
      (BAB.Engine?.LastCreatedEngine?.scenes?.[0]);
    if (!scene) throw new Error('No scene - make sure the viewer is running and the GLB is loaded.');

    // 2) Locate UNIT_112 TransformNode (exact or fallback)
    const candidates = scene.transformNodes.filter(t => /^UNIT_/i.test(t.name || ''));
    let unit =
      scene.getTransformNodeByName('UNIT_112') ||
      candidates.find(t => t.name === 'UNIT_112') ||
      candidates.find(t => (t.name || '').includes('UNIT_112'));

    if (!unit) {
      console.warn('UNIT_112 not found. Available UNIT_* names:', candidates.map(t => t.name));
      unit = candidates[0];
      if (!unit) throw new Error('No UNIT_* nodes found in scene.');
      console.warn(`Falling back to: ${unit.name}`);
    }

    // 3) Run bottom-up pairing via analyzer
    const { GeometricToolAnalyzer } = await import('/src/babylon/sceneAnalysis/GeometricToolAnalyzer');
    const analyzer = new GeometricToolAnalyzer();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing bottom-up pairing on: ${unit.name}`);
    console.log(`${'='.repeat(80)}\n`);

    const toolGraph = analyzer.analyze(
      scene,
      {
        similarityThreshold: 0.95,
        minVolume: 0.0001,
      },
      unit
    );

    // 4) Pretty print results
    const idToName = (idStr) => {
      const idNum = parseInt(idStr, 10);
      const tn = Number.isFinite(idNum) ? scene.getTransformNodeByUniqueId(idNum) : null;
      return tn?.name || idStr;
    };

    console.log(`\n✅ Analysis complete!`);
    console.log(`Found ${toolGraph.units.length} units\n`);

    const fixedUnits = toolGraph.units.filter(u => u.isFixed);
    const movingUnits = toolGraph.units.filter(u => !u.isFixed);

    console.log(`Fixed: ${fixedUnits.length} | Moving: ${movingUnits.length}\n`);

    // Group by pairs
    const pairs = [];
    for (let i = 0; i < toolGraph.units.length; i += 2) {
      if (i + 1 < toolGraph.units.length) {
        const fixed = toolGraph.units[i];
        const moving = toolGraph.units[i + 1];
        pairs.push({
          pair: `${Math.floor(i/2) + 1}`,
          fixed: idToName(fixed.root),
          moving: idToName(moving.root),
          fixedId: fixed.root,
          movingId: moving.root,
        });
      }
    }

    console.log('PAIRS FOUND:');
    console.table(pairs);

    console.log('\nALL UNITS:');
    console.table(toolGraph.units.map(u => ({
      name: u.name,
      isFixed: u.isFixed ? 'FIXED' : 'MOVING',
      rootName: idToName(u.root),
      nodesCount: u.nodes.length,
      type: u.type,
    })));

    // Validate results
    if (toolGraph.units.length === 0) {
      console.warn('⚠️  No units found. Check:');
      console.warn('  1. Are there meshes in this UNIT?');
      console.warn('  2. Are containers meeting volume threshold?');
      console.warn('  3. Try lowering minVolume or similarityThreshold');
    } else if (fixedUnits.length !== movingUnits.length) {
      console.warn(`⚠️  Unbalanced pairs: ${fixedUnits.length} fixed vs ${movingUnits.length} moving`);
    } else {
      console.log(`\n✅ Perfect pairs: ${fixedUnits.length} fixed/moving pairs detected!`);
    }

    return toolGraph;
  } catch (err) {
    console.error('[Bottom-up pairing test] Error:', err);
    throw err;
  }
}

// Auto-run if imported directly
if (typeof window !== 'undefined') {
  console.log('[DEV] Bottom-up pairing test available: await import("/src/dev/testBottomUpPairing.js").then(m => m.testBottomUpPairing());');
}
