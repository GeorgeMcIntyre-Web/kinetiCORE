// Verify Robot Selection Fix
// Run this in browser console after loading the robot

(async () => {
  console.log('🔍 === ROBOT SELECTION VERIFICATION ===\n');

  const sceneManager = window.sceneManager;
  const useEditorStore = window.useEditorStore;

  if (!sceneManager) {
    console.error('❌ SceneManager not found');
    return;
  }

  if (!useEditorStore) {
    console.error('❌ useEditorStore not found');
    return;
  }

  const scene = sceneManager.getScene();
  const { EntityRegistry } = await import('./src/entities/EntityRegistry.ts');
  const registry = EntityRegistry.getInstance();

  console.log('✅ Environment ready\n');

  // Find STL meshes (robot parts)
  const stlMeshes = scene.meshes.filter(m => m.name.includes('.stl'));
  console.log(`📊 Found ${stlMeshes.length} STL meshes (robot parts)\n`);

  if (stlMeshes.length === 0) {
    console.error('❌ No robot parts found. Load a robot first.');
    return;
  }

  // Test with first robot part
  const testMesh = stlMeshes[0];
  console.log(`🎯 Testing with: ${testMesh.name}`);

  // Get entity info
  const entity = registry.getByMesh(testMesh);
  if (!entity) {
    console.error('❌ No entity found for mesh');
    return;
  }

  const deviceEntity = entity.getRootDevice();
  console.log(`  - Link Entity: ${entity.getId()}`);
  console.log(`  - Device Entity: ${deviceEntity ? deviceEntity.getId() : 'none'}`);
  console.log(`  - Is Device: ${entity.getIsDevice()}`);

  // Clear selection
  const store = useEditorStore.getState();
  store.clearSelection();

  console.log('\n📝 Testing selection flow...');

  // Get device root mesh
  const deviceRootMesh = deviceEntity.getMesh();
  console.log(`  - Device root mesh: ${deviceRootMesh.name}`);

  // Get tree node
  const { SceneTreeManager } = await import('./src/ui/sceneTree/SceneTreeManager.ts');
  const tree = SceneTreeManager.getInstance();
  const deviceNode = tree.getNodeByBabylonMeshId(deviceRootMesh.uniqueId.toString());

  if (!deviceNode) {
    console.error('❌ No tree node found for device root mesh');
    return;
  }

  console.log(`  - Tree node: ${deviceNode.id} (${deviceNode.name})`);
  console.log(`  - Node type: ${deviceNode.type}`);

  // Select the node (this triggers highlighting)
  store.selectNode(deviceNode.id);

  console.log('\n⏳ Waiting for highlighting to apply...');

  // Wait for useEffect to run
  await new Promise(resolve => setTimeout(resolve, 100));

  // Check results
  const currentState = useEditorStore.getState();
  const highlightLayer = scene.getHighlightLayerByName('highlight');

  console.log('\n📊 RESULTS:');
  console.log('===========');
  console.log(`Selected Node IDs: ${currentState.selectedNodeIds.length}`);
  if (currentState.selectedNodeIds.length > 0) {
    currentState.selectedNodeIds.forEach(id => {
      const node = tree.getNode(id);
      console.log(`  - ${id} (${node?.name || 'unknown'}) [${node?.type}]`);
    });
  }

  console.log(`\nHighlighted Meshes: ${highlightLayer?.meshes.length || 0}`);
  if (highlightLayer && highlightLayer.meshes.length > 0) {
    highlightLayer.meshes.forEach(m => {
      console.log(`  - ${m.name}`);
    });

    // Check color of first highlighted mesh
    const firstMesh = highlightLayer.meshes[0];
    const color = highlightLayer.getMeshColor(firstMesh);
    if (color) {
      const isGreen = color.r < 0.3 && color.g > 0.3 && color.b < 0.3;
      const colorName = isGreen ? 'GREEN ✅' : 'ORANGE ❌';
      console.log(`\nHighlight Color: ${colorName}`);
      console.log(`  RGB: (${color.r.toFixed(2)}, ${color.g.toFixed(2)}, ${color.b.toFixed(2)})`);
    }
  }

  // Check gizmo visibility
  console.log('\n🔧 Transform Gizmo:');
  const gizmos = scene.getTransformGizmos?.() || [];
  if (gizmos.length > 0) {
    const activeGizmo = gizmos.find(g => g.attachedMesh);
    if (activeGizmo) {
      console.log(`  ❌ Gizmo is visible on: ${activeGizmo.attachedMesh.name}`);
    } else {
      console.log('  ✅ Gizmo is hidden');
    }
  } else {
    console.log('  ✅ No gizmo found (hidden)');
  }

  console.log('\n🎯 VERIFICATION:');
  console.log('================');

  let allGood = true;

  // Check 1: Correct node selected
  const selectedNode = tree.getNode(currentState.selectedNodeIds[0]);
  if (selectedNode && selectedNode.type === 'collection') {
    console.log('✅ Correct node selected (collection/device root)');
  } else {
    console.log('❌ Wrong node type selected (should be collection)');
    allGood = false;
  }

  // Check 2: Robot highlighted
  if (highlightLayer && highlightLayer.meshes.length > 0) {
    console.log('✅ Robot parts are highlighted');
  } else {
    console.log('❌ Robot parts are NOT highlighted');
    allGood = false;
  }

  // Check 3: Green color
  if (highlightLayer && highlightLayer.meshes.length > 0) {
    const color = highlightLayer.getMeshColor(highlightLayer.meshes[0]);
    if (color && color.r < 0.3 && color.g > 0.3 && color.b < 0.3) {
      console.log('✅ Highlight color is GREEN');
    } else {
      console.log('❌ Highlight color is NOT green');
      allGood = false;
    }
  }

  // Check 4: No gizmo
  const activeGizmos = gizmos.filter(g => g.attachedMesh);
  if (activeGizmos.length === 0) {
    console.log('✅ Transform gizmo is hidden');
  } else {
    console.log('❌ Transform gizmo is visible');
    allGood = false;
  }

  console.log('\n' + (allGood ? '✅ ALL CHECKS PASSED!' : '❌ SOME CHECKS FAILED'));

  console.log('\n💡 Now try clicking the robot manually to verify click handler works!');
})();
