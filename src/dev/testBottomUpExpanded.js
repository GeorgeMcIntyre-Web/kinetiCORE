/**
 * Expanded test showing detailed bottom-up pairing results
 */

export async function testBottomUpExpanded(unitName = 'UNIT_112') {
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
    if (!unit) {
      const all = scene.transformNodes.filter(t => /^UNIT_/i.test(t.name || ''));
      console.log('Available UNIT_*:', all.map(t => t.name));
      throw new Error(`${unitName} not found`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing: ${unit.name}`);
    console.log(`${'='.repeat(80)}\n`);

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

    const idToName = (idStr) => {
      const idNum = parseInt(idStr, 10);
      const tn = Number.isFinite(idNum) ? scene.getTransformNodeByUniqueId(idNum) : null;
      return tn?.name || idStr;
    };

    console.log(`\n📊 RESULTS:\n`);
    console.log(`Total units: ${toolGraph.units.length}`);
    
    const fixed = toolGraph.units.filter(u => u.isFixed);
    const moving = toolGraph.units.filter(u => !u.isFixed);
    
    console.log(`Fixed: ${fixed.length}`);
    console.log(`Moving: ${moving.length}`);
    
    if (toolGraph.units.length % 2 !== 0) {
      console.warn(`\n⚠️  WARNING: Odd number of units (${toolGraph.units.length}) - should be even for pairs!`);
    }

    // Show all units with full details
    console.log(`\n📋 ALL UNITS DETAILED:\n`);
    const unitsTable = toolGraph.units.map((u, idx) => ({
      '#': idx + 1,
      name: u.name,
      type: u.isFixed ? 'FIXED' : 'MOVING',
      rootName: idToName(u.root),
      rootId: u.root,
      nodeCount: u.nodes.length,
      unitType: u.type,
    }));
    console.table(unitsTable);

    // Try to pair them up
    console.log(`\n🔗 ATTEMPTED PAIRS:\n`);
    const pairs = [];
    const used = new Set();
    
    for (let i = 0; i < toolGraph.units.length; i++) {
      if (used.has(i)) continue;
      const fixedUnit = toolGraph.units[i];
      
      if (!fixedUnit.isFixed) continue; // Skip if not fixed
      
      // Find matching moving unit
      let foundMoving = null;
      let movingIdx = -1;
      
      for (let j = i + 1; j < toolGraph.units.length; j++) {
        if (used.has(j)) continue;
        const movingUnit = toolGraph.units[j];
        
        if (movingUnit.isFixed) continue;
        
        // Check if they're from same pair (name similarity)
        const fixedBase = fixedUnit.name.replace(/\/FIXED.*$/, '');
        const movingBase = movingUnit.name.replace(/\/MOVING.*$/, '');
        
        if (fixedBase === movingBase) {
          foundMoving = movingUnit;
          movingIdx = j;
          break;
        }
      }
      
      if (foundMoving) {
        pairs.push({
          pair: pairs.length + 1,
          fixed: idToName(fixedUnit.root),
          moving: idToName(foundMoving.root),
          fixedNodes: fixedUnit.nodes.length,
          movingNodes: foundMoving.nodes.length,
        });
        used.add(i);
        used.add(movingIdx);
      }
    }
    
    if (pairs.length > 0) {
      console.table(pairs);
    } else {
      console.log('⚠️  No clear pairs detected from naming pattern');
    }
    
    // Show unpaired units
    const unpaired = [];
    for (let i = 0; i < toolGraph.units.length; i++) {
      if (!used.has(i)) {
        const u = toolGraph.units[i];
        unpaired.push({
          unit: idToName(u.root),
          type: u.isFixed ? 'FIXED' : 'MOVING',
          name: u.name,
        });
      }
    }
    
    if (unpaired.length > 0) {
      console.log(`\n⚠️  UNPAIRED UNITS (${unpaired.length}):\n`);
      console.table(unpaired);
    }

    return {
      toolGraph,
      summary: {
        total: toolGraph.units.length,
        fixed: fixed.length,
        moving: moving.length,
        pairs: pairs.length,
        unpaired: unpaired.length,
      },
      pairs,
      unpaired,
    };
  } catch (err) {
    console.error('[Test] Error:', err);
    throw err;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.testBottomUpExpanded = testBottomUpExpanded;
  console.log('[DEV] Expanded test: await import("/src/dev/testBottomUpExpanded.js").then(m => m.testBottomUpExpanded("UNIT_112"));');
}

