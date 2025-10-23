// Debug Selection Flow - Step by Step
(async () => {
  console.log('🔍 === DEBUGGING SELECTION FLOW ===');
  
  const sceneManager = window.sceneManager;
  const scene = sceneManager.getScene();
  
  // Import required modules
  const { EntityRegistry } = await import('./src/entities/EntityRegistry.ts');
  const { SceneUtils } = await import('./src/scene/SceneUtils.ts');
  
  const registry = EntityRegistry.getInstance();
  
  console.log('\n1. TESTING MESH PICKING');
  console.log('========================');
  
  // Test picking at center of screen
  const pickResult = scene.pick(scene.getEngine().getRenderWidth() / 2, scene.getEngine().getRenderHeight() / 2);
  console.log('Pick result:', {
    hit: pickResult.hit,
    pickedMesh: pickResult.pickedMesh?.name || 'none',
    distance: pickResult.distance
  });
  
  if (pickResult.hit && pickResult.pickedMesh) {
    const mesh = pickResult.pickedMesh;
    console.log(`Picked mesh: ${mesh.name}`);
    console.log(`Mesh type: ${mesh.constructor.name}`);
    console.log(`Mesh visible: ${mesh.isVisible}`);
    console.log(`Mesh pickable: ${mesh.isPickable}`);
    
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
        console.log(`Entity type: ${entity.getMetadata().type}`);
        console.log(`Is device: ${entity.getIsDevice()}`);
        
        console.log('\n4. TESTING DEVICE ROOT');
        console.log('=======================');
        
        const deviceEntity = entity.getRootDevice();
        console.log(`Device entity: ${deviceEntity ? deviceEntity.getId() : 'none'}`);
        
        if (deviceEntity) {
          console.log(`Device name: ${deviceEntity.getMetadata().name}`);
          console.log(`Device type: ${deviceEntity.getMetadata().deviceType}`);
          
          console.log('\n5. TESTING DEVICE CHILDREN');
          console.log('===========================');
          
          const children = deviceEntity.getChildren();
          console.log(`Device children: ${children.length}`);
          
          children.forEach((child, index) => {
            const childMesh = child.getMesh();
            console.log(`  ${index + 1}. ${child.getMetadata().name}: ${childMesh ? childMesh.name : 'no mesh'} (visible: ${childMesh?.isVisible || false})`);
          });
          
          console.log('\n6. TESTING HIGHLIGHTING');
          console.log('========================');
          
          const highlightingLayer = scene.getHighlightLayerByName('highlight');
          if (highlightingLayer) {
            console.log('✅ Highlighting layer found');
            
            // Clear existing highlights
            highlightingLayer.removeAllMeshes();
            
            // Highlight all visible children
            let highlightedCount = 0;
            children.forEach(child => {
              const childMesh = child.getMesh();
              if (childMesh && childMesh.isVisible && !childMesh.name.includes('_dummy')) {
                highlightingLayer.addMesh(childMesh, { r: 0, g: 1, b: 0 });
                highlightedCount++;
                console.log(`  ✅ Highlighted: ${childMesh.name}`);
              }
            });
            
            console.log(`✅ Highlighted ${highlightedCount} meshes - robot should be GREEN now!`);
          } else {
            console.log('❌ No highlighting layer found');
          }
        }
      }
    }
  }
  
  console.log('\n7. TESTING EDITOR STORE');
  console.log('========================');
  
  // Check if editor store is available
  if (window.useEditorStore) {
    console.log('✅ Editor store available');
    const store = window.useEditorStore.getState();
    console.log(`Selected meshes: ${store.selectedMeshes.length}`);
    console.log(`Selected nodes: ${store.selectedNodes.length}`);
  } else {
    console.log('❌ Editor store not available');
  }
  
  console.log('\n🎯 MANUAL TEST');
  console.log('==============');
  console.log('Now click on the robot in the 3D viewport and check if it highlights green.');
  console.log('If it does NOT highlight, the issue is in the SceneCanvas selection logic.');
  console.log('If it DOES highlight, the issue is in the editor store state management.');
})();
