// Comprehensive Selection Debug - Find the Root Cause
(async () => {
  console.log('🔍 === COMPREHENSIVE SELECTION DEBUG ===');
  
  const sceneManager = window.sceneManager;
  const scene = sceneManager.getScene();
  
  // Import required modules
  const { EntityRegistry } = await import('./src/entities/EntityRegistry.ts');
  const { SceneUtils } = await import('./src/scene/SceneUtils.ts');
  
  const registry = EntityRegistry.getInstance();
  
  console.log('\n1. SCENE STATUS');
  console.log('===============');
  console.log(`Scene meshes: ${scene.meshes.length}`);
  console.log(`Scene cameras: ${scene.cameras.length}`);
  console.log(`Scene lights: ${scene.lights.length}`);
  
  console.log('\n2. ENTITY REGISTRY STATUS');
  console.log('=========================');
  const allEntities = registry.getAll();
  const deviceEntities = allEntities.filter(entity => entity.getIsDevice());
  console.log(`Total entities: ${allEntities.length}`);
  console.log(`Device entities: ${deviceEntities.length}`);
  
  deviceEntities.forEach((entity, index) => {
    const metadata = entity.getMetadata();
    console.log(`  ${index + 1}. ${metadata.name} (${metadata.type}) - Device: ${entity.getIsDevice()}`);
  });
  
  console.log('\n3. MESH ANALYSIS');
  console.log('================');
  
  // Find all STL meshes
  const stlMeshes = scene.meshes.filter(mesh => mesh.name.includes('.stl'));
  console.log(`STL meshes: ${stlMeshes.length}`);
  
  // Check entity linking
  let linkedMeshes = 0;
  stlMeshes.forEach(mesh => {
    const entity = registry.getByMesh(mesh);
    if (entity) {
      linkedMeshes++;
      console.log(`  ✅ ${mesh.name} -> ${entity.getId()}`);
    } else {
      console.log(`  ❌ ${mesh.name} -> no entity`);
    }
  });
  
  console.log(`Linked meshes: ${linkedMeshes}/${stlMeshes.length}`);
  
  console.log('\n4. EDITOR STORE STATUS');
  console.log('======================');
  
  if (window.useEditorStore) {
    const store = window.useEditorStore.getState();
    console.log(`Selected meshes: ${store.selectedMeshes.length}`);
    console.log(`Selected nodes: ${store.selectedNodeIds.length}`);
    console.log(`Selected node ID: ${store.selectedNodeId || 'none'}`);
    
    if (store.selectedMeshes.length > 0) {
      console.log('Selected meshes:');
      store.selectedMeshes.forEach((mesh, index) => {
        console.log(`  ${index + 1}. ${mesh.name}`);
      });
    }
  } else {
    console.log('❌ Editor store not available');
  }
  
  console.log('\n5. HIGHLIGHTING LAYER STATUS');
  console.log('============================');
  
  const highlightingLayer = scene.getHighlightLayerByName('highlight');
  if (highlightingLayer) {
    console.log('✅ Highlighting layer found');
    console.log(`Highlighted meshes: ${highlightingLayer.meshes.length}`);
    
    if (highlightingLayer.meshes.length > 0) {
      console.log('Currently highlighted meshes:');
      highlightingLayer.meshes.forEach((mesh, index) => {
        console.log(`  ${index + 1}. ${mesh.name}`);
      });
    }
  } else {
    console.log('❌ No highlighting layer found');
  }
  
  console.log('\n6. MANUAL SELECTION TEST');
  console.log('=========================');
  
  if (stlMeshes.length > 0 && window.useEditorStore) {
    const testMesh = stlMeshes[0];
    console.log(`Testing selection with: ${testMesh.name}`);
    
    const store = window.useEditorStore.getState();
    console.log(`Before selection - selected meshes: ${store.selectedMeshes.length}`);
    
    // Try to select the mesh
    store.selectMesh(testMesh);
    
    // Check if selection worked
    const newStore = window.useEditorStore.getState();
    console.log(`After selection - selected meshes: ${newStore.selectedMeshes.length}`);
    
    if (newStore.selectedMeshes.length > 0) {
      console.log('✅ Manual selection successful!');
      console.log('Selected meshes:', newStore.selectedMeshes.map(m => m.name));
      
      // Check if highlighting layer updated
      const updatedHighlightingLayer = scene.getHighlightLayerByName('highlight');
      if (updatedHighlightingLayer) {
        console.log(`Highlighting layer meshes: ${updatedHighlightingLayer.meshes.length}`);
        if (updatedHighlightingLayer.meshes.length > 0) {
          console.log('✅ Highlighting layer updated!');
        } else {
          console.log('❌ Highlighting layer not updated');
        }
      }
    } else {
      console.log('❌ Manual selection failed');
    }
  }
  
  console.log('\n7. REACT COMPONENT STATUS');
  console.log('=========================');
  
  // Check if SceneCanvas component is mounted
  const canvasElement = document.querySelector('canvas');
  if (canvasElement) {
    console.log('✅ Canvas element found');
    console.log(`Canvas size: ${canvasElement.width}x${canvasElement.height}`);
  } else {
    console.log('❌ No canvas element found');
  }
  
  console.log('\n🎯 DIAGNOSIS');
  console.log('=============');
  
  if (linkedMeshes === stlMeshes.length) {
    console.log('✅ Entity linking is working correctly');
  } else {
    console.log('❌ Entity linking has issues');
  }
  
  if (window.useEditorStore) {
    console.log('✅ Editor store is available');
  } else {
    console.log('❌ Editor store is not available');
  }
  
  if (highlightingLayer) {
    console.log('✅ Highlighting layer is available');
  } else {
    console.log('❌ Highlighting layer is not available');
  }
  
  console.log('\n📋 NEXT STEPS');
  console.log('==============');
  console.log('1. If entity linking is working AND editor store is available AND highlighting layer is available:');
  console.log('   → The issue is likely in the SceneCanvas selection logic or React state updates');
  console.log('2. If any of the above are missing:');
  console.log('   → Fix the missing component first');
  console.log('3. Run this script again after clicking on the robot to see what changes');
})();
