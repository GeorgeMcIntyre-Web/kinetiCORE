// MJCF Selection Deep Debug - Identifies exact selection failure point
// Run this in browser console after loading an MJCF model

(async () => {
  console.log('🔍 === MJCF SELECTION DEEP DEBUG ===');
  
  const sceneManager = window.sceneManager;
  const scene = sceneManager.getScene();
  
  // Import required modules
  let EntityRegistry, SceneUtils, SceneTreeManager;
  try {
    const entityModule = await import('./src/entities/EntityRegistry.ts');
    EntityRegistry = entityModule.EntityRegistry;
    
    const sceneModule = await import('./src/scene/SceneUtils.ts');
    SceneUtils = sceneModule;
    
    const treeModule = await import('./src/scene/SceneTreeManager.ts');
    SceneTreeManager = treeModule.SceneTreeManager;
  } catch (e) {
    console.error('❌ Failed to import modules:', e.message);
    return;
  }
  
  const registry = EntityRegistry.getInstance();
  const tree = SceneTreeManager.getInstance();
  
  console.log('\n1. MJCF MESH ANALYSIS');
  console.log('=====================');
  
  // Find all MJCF-related meshes
  const allMeshes = scene.meshes;
  const mjcfMeshes = allMeshes.filter(mesh => 
    mesh.name.includes('mjcf') || 
    mesh.name.includes('body') ||
    mesh.name.includes('geom')
  );
  
  console.log(`Found ${mjcfMeshes.length} MJCF-related meshes:`);
  mjcfMeshes.forEach((mesh, index) => {
    const isSelectable = SceneUtils.isSelectableObject(mesh);
    const isInfrastructure = SceneUtils.isInfrastructureObject(mesh);
    console.log(`  ${index + 1}. ${mesh.name}`);
    console.log(`     - Visible: ${mesh.isVisible}, Pickable: ${mesh.isPickable}`);
    console.log(`     - Selectable: ${isSelectable}, Infrastructure: ${isInfrastructure}`);
  });
  
  console.log('\n2. DEVICE ENTITY ANALYSIS');
  console.log('==========================');
  
  const allEntities = registry.getAll();
  const deviceEntities = allEntities.filter(entity => entity.getIsDevice());
  
  console.log(`Total entities: ${allEntities.length}`);
  console.log(`Device entities: ${deviceEntities.length}`);
  
  if (deviceEntities.length > 0) {
    deviceEntities.forEach((entity, index) => {
      const metadata = entity.getMetadata();
      console.log(`\n  Device ${index + 1}: ${metadata.name}`);
      console.log(`    - ID: ${entity.getId()}`);
      console.log(`    - Type: ${metadata.type}`);
      
      const deviceMesh = entity.getMesh();
      if (deviceMesh) {
        console.log(`    - Device mesh: ${deviceMesh.name} (visible: ${deviceMesh.isVisible})`);
      }
      
      const children = entity.getChildren();
      console.log(`    - Children: ${children.length}`);
      children.forEach((child, childIndex) => {
        const childMesh = child.getMesh();
        if (childMesh) {
          console.log(`      ${childIndex + 1}. ${child.getMetadata().name} -> ${childMesh.name}`);
        }
      });
    });
  }
  
  console.log('\n3. TREE NODE ANALYSIS');
  console.log('======================');
  
  const allNodes = tree.getAllNodes();
  const collectionNodes = allNodes.filter(node => node.type === 'collection');
  
  console.log(`Total tree nodes: ${allNodes.length}`);
  console.log(`Collection nodes: ${collectionNodes.length}`);
  
  collectionNodes.forEach((node, index) => {
    console.log(`\n  Collection ${index + 1}: ${node.name}`);
    console.log(`    - ID: ${node.id}`);
    console.log(`    - Entity ID: ${node.entityId || 'none'}`);
    console.log(`    - Babylon Mesh ID: ${node.babylonMeshId || 'none'}`);
    
    // Check if this collection has a device entity
    if (node.entityId) {
      const entity = registry.get(node.entityId);
      if (entity && entity.getIsDevice()) {
        console.log(`    - ✅ Has device entity: ${entity.getId()}`);
        
        // Check if the device mesh exists and is linked
        const deviceMesh = entity.getMesh();
        if (deviceMesh) {
          console.log(`    - Device mesh: ${deviceMesh.name} (ID: ${deviceMesh.uniqueId})`);
          console.log(`    - Tree mesh ID match: ${node.babylonMeshId === deviceMesh.uniqueId.toString()}`);
        }
      } else {
        console.log(`    - ❌ Entity not found or not a device`);
      }
    }
  });
  
  console.log('\n4. SELECTION SIMULATION');
  console.log('========================');
  
  // Find a visible, selectable MJCF mesh to test with
  const testMesh = mjcfMeshes.find(mesh => 
    mesh.isVisible && 
    mesh.isPickable && 
    SceneUtils.isSelectableObject(mesh) &&
    !SceneUtils.isInfrastructureObject(mesh)
  );
  
  if (testMesh) {
    console.log(`Testing with mesh: ${testMesh.name}`);
    
    // Check entity mapping
    const entity = registry.getByMesh(testMesh);
    if (entity) {
      console.log(`✅ Mesh mapped to entity: ${entity.getId()}`);
      
      // Check device relationship
      const deviceEntity = entity.getRootDevice();
      if (deviceEntity) {
        console.log(`✅ Part of device: ${deviceEntity.getId()}`);
        
        // Check if device has tree node
        const deviceMesh = deviceEntity.getMesh();
        if (deviceMesh) {
          console.log(`Device mesh: ${deviceMesh.name} (ID: ${deviceMesh.uniqueId})`);
          
          const deviceNode = tree.getNodeByBabylonMeshId(deviceMesh.uniqueId.toString());
          if (deviceNode) {
            console.log(`✅ Device has tree node: ${deviceNode.id}`);
            console.log(`Node type: ${deviceNode.type}`);
            console.log(`Node name: ${deviceNode.name}`);
            
            // Test the selection path
            console.log('\n5. SELECTION PATH TEST');
            console.log('======================');
            
            if (window.useEditorStore) {
              const store = window.useEditorStore.getState();
              console.log(`Before selection - selected nodes: ${store.selectedNodeIds.length}`);
              
              // Test node selection (this is what should happen when clicking MJCF mesh)
              store.selectNode(deviceNode.id);
              
              const newStore = window.useEditorStore.getState();
              console.log(`After node selection - selected nodes: ${newStore.selectedNodeIds.length}`);
              
              if (newStore.selectedNodeIds.includes(deviceNode.id)) {
                console.log('✅ Node selection successful!');
                
                // Check if highlighting triggered
                const highlightingLayer = scene.getHighlightLayerByName('highlight');
                if (highlightingLayer) {
                  console.log(`Highlighted meshes: ${highlightingLayer.meshes ? highlightingLayer.meshes.length : 'undefined'}`);
                  
                  if (highlightingLayer.meshes && highlightingLayer.meshes.length > 0) {
                    console.log('✅ Highlighting triggered!');
                    console.log('🎉 MJCF selection should work!');
                  } else {
                    console.log('❌ No highlighting triggered - check SceneCanvas useEffect');
                  }
                } else {
                  console.log('❌ No highlighting layer found');
                }
              } else {
                console.log('❌ Node selection failed');
              }
            } else {
              console.log('❌ Editor store not available');
            }
          } else {
            console.log('❌ Device has no tree node - this is the problem!');
            console.log(`Looking for mesh ID: ${deviceMesh.uniqueId}`);
            
            // Check what tree nodes exist
            const allTreeNodes = tree.getAllNodes();
            console.log('Available tree nodes:');
            allTreeNodes.forEach(node => {
              console.log(`  - ${node.name} (${node.type}) - Mesh ID: ${node.babylonMeshId || 'none'}`);
            });
          }
        } else {
          console.log('❌ Device has no mesh');
        }
      } else {
        console.log('❌ Entity is not part of a device');
      }
    } else {
      console.log('❌ Mesh not mapped to any entity');
    }
  } else {
    console.log('❌ No suitable test mesh found');
  }
  
  console.log('\n6. SUMMARY');
  console.log('===========');
  console.log('This debug identifies the exact failure point:');
  console.log('1. If no MJCF meshes found: Problem in mesh creation');
  console.log('2. If meshes not selectable: Problem in SceneUtils filtering');
  console.log('3. If no device entities: Problem in MJCF loader');
  console.log('4. If device has no tree node: Problem in editor store linking');
  console.log('5. If node selection fails: Problem in editor store selectNode');
  console.log('6. If no highlighting: Problem in SceneCanvas useEffect');
})();
