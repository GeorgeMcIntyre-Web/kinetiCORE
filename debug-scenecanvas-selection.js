// Targeted Debug: Test SceneCanvas Selection Logic
(async () => {
  console.log('🎯 === TARGETED DEBUG: SCENECANVAS SELECTION ===');
  
  const sceneManager = window.sceneManager;
  const scene = sceneManager.getScene();
  
  // Import required modules
  const { EntityRegistry } = await import('./src/entities/EntityRegistry.ts');
  const { SceneUtils } = await import('./src/scene/SceneUtils.ts');
  
  const registry = EntityRegistry.getInstance();
  
  console.log('\n1. TESTING MESH PICKING AT CENTER');
  console.log('==================================');
  
  // Test picking at center of screen
  const pickResult = scene.pick(scene.getEngine().getRenderWidth() / 2, scene.getEngine().getRenderHeight() / 2);
  console.log('Pick result:', {
    hit: pickResult.hit,
    pickedMesh: pickResult.pickedMesh?.name || 'none',
    distance: pickResult.distance
  });
  
  if (pickResult.hit && pickResult.pickedMesh) {
    const mesh = pickResult.pickedMesh;
    console.log(`✅ Picked mesh: ${mesh.name}`);
    
    console.log('\n2. TESTING SELECTABILITY');
    console.log('=========================');
    
    const isSelectable = SceneUtils.isSelectableObject(mesh);
    console.log(`Is selectable: ${isSelectable}`);
    
    if (isSelectable) {
      console.log('\n3. TESTING ENTITY LOOKUP');
      console.log('=========================');
      
      const entity = registry.getByMesh(mesh);
      console.log(`Entity found: ${entity ? entity.getId() : 'none'}`);
      
      if (entity) {
        console.log(`Entity metadata:`, entity.getMetadata());
        
        console.log('\n4. TESTING DEVICE ROOT');
        console.log('=======================');
        
        const deviceEntity = entity.getRootDevice();
        console.log(`Device entity: ${deviceEntity ? deviceEntity.getId() : 'none'}`);
        
        if (deviceEntity) {
          console.log(`Device metadata:`, deviceEntity.getMetadata());
          
          console.log('\n5. SIMULATING SELECTION');
          console.log('========================');
          
          // Get the device mesh
          const deviceMesh = deviceEntity.getMesh();
          console.log(`Device mesh: ${deviceMesh ? deviceMesh.name : 'none'}`);
          console.log(`Device mesh visible: ${deviceMesh?.isVisible || false}`);
          
          // Simulate the selection logic from SceneCanvas
          if (deviceMesh && deviceMesh.isVisible) {
            console.log('✅ Would select device mesh (visible)');
          } else {
            console.log('✅ Would select clicked mesh (device mesh invisible)');
          }
          
          console.log('\n6. TESTING EDITOR STORE SELECTION');
          console.log('==================================');
          
          // Test if editor store is available
          if (window.useEditorStore) {
            const store = window.useEditorStore.getState();
            console.log(`Current selected meshes: ${store.selectedMeshes.length}`);
            
            // Try to select the mesh
            console.log('Attempting to select mesh...');
            store.selectMesh(mesh);
            
            // Check if selection worked
            const newStore = window.useEditorStore.getState();
            console.log(`Selected meshes after: ${newStore.selectedMeshes.length}`);
            
            if (newStore.selectedMeshes.length > 0) {
              console.log('✅ Mesh selection successful!');
              console.log('Selected meshes:', newStore.selectedMeshes.map(m => m.name));
            } else {
              console.log('❌ Mesh selection failed');
            }
          } else {
            console.log('❌ Editor store not available');
          }
        }
      }
    }
  }
  
  console.log('\n7. TESTING HIGHLIGHTING LAYER');
  console.log('==============================');
  
  const highlightingLayer = scene.getHighlightLayerByName('highlight');
  if (highlightingLayer) {
    console.log('✅ Highlighting layer found');
    console.log(`Highlighted meshes: ${highlightingLayer.meshes.length}`);
  } else {
    console.log('❌ No highlighting layer found');
  }
  
  console.log('\n🎯 MANUAL TEST');
  console.log('==============');
  console.log('Now click on the robot in the 3D viewport.');
  console.log('If the robot highlights green, the issue is resolved.');
  console.log('If it does NOT highlight, run this script again after clicking.');
})();
