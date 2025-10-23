// MJCF Selection Fix Debug - Comprehensive Analysis
// This script identifies and fixes the MJCF selection highlighting issue

(async () => {
  console.log('🔧 === MJCF SELECTION FIX DEBUG ===');
  
  const sceneManager = window.sceneManager;
  const scene = sceneManager.getScene();
  
  // Import required modules with error handling
  let EntityRegistry, SceneUtils;
  try {
    const entityModule = await import('./src/entities/EntityRegistry.ts');
    EntityRegistry = entityModule.EntityRegistry;
  } catch (e) {
    console.error('❌ Failed to import EntityRegistry:', e.message);
    return;
  }
  
  try {
    const sceneModule = await import('./src/scene/SceneUtils.ts');
    SceneUtils = sceneModule;
  } catch (e) {
    console.error('❌ Failed to import SceneUtils:', e.message);
    return;
  }
  
  const registry = EntityRegistry.getInstance();
  
  console.log('\n1. SCENE ANALYSIS');
  console.log('==================');
  console.log(`Scene meshes: ${scene.meshes.length}`);
  
  // Find all meshes that could be robot parts
  const allMeshes = scene.meshes;
  const robotMeshes = allMeshes.filter(mesh => 
    !mesh.name.includes('ground') && 
    !mesh.name.includes('grid') && 
    !mesh.name.includes('axis') &&
    !mesh.name.includes('__') &&
    mesh.isVisible &&
    mesh.name !== 'mjcf_root'
  );
  
  console.log(`Potential robot meshes: ${robotMeshes.length}`);
  robotMeshes.forEach((mesh, index) => {
    console.log(`  ${index + 1}. ${mesh.name} (visible: ${mesh.isVisible}, pickable: ${mesh.isPickable})`);
  });
  
  console.log('\n2. ENTITY REGISTRY ANALYSIS');
  console.log('============================');
  const allEntities = registry.getAll();
  const deviceEntities = allEntities.filter(entity => entity.getIsDevice());
  console.log(`Total entities: ${allEntities.length}`);
  console.log(`Device entities: ${deviceEntities.length}`);
  
  if (deviceEntities.length > 0) {
    deviceEntities.forEach((entity, index) => {
      const metadata = entity.getMetadata();
      console.log(`  ${index + 1}. ${metadata.name} (${metadata.type}) - Device: ${entity.getIsDevice()}`);
      
      const children = entity.getChildren();
      console.log(`    Children: ${children.length}`);
      children.forEach((child, childIndex) => {
        const childMesh = child.getMesh();
        console.log(`      ${childIndex + 1}. ${child.getMetadata().name} -> ${childMesh ? childMesh.name : 'no mesh'}`);
      });
    });
  }
  
  console.log('\n3. MESH-ENTITY LINKING ANALYSIS');
  console.log('=================================');
  let linkedMeshes = 0;
  robotMeshes.forEach(mesh => {
    const entity = registry.getByMesh(mesh);
    if (entity) {
      linkedMeshes++;
      console.log(`  ✅ ${mesh.name} -> ${entity.getId()} (${entity.getMetadata().type})`);
    } else {
      console.log(`  ❌ ${mesh.name} -> no entity`);
    }
  });
  
  console.log(`Linked meshes: ${linkedMeshes}/${robotMeshes.length}`);
  
  console.log('\n4. HIGHLIGHTING LAYER ANALYSIS');
  console.log('==============================');
  const highlightingLayer = scene.getHighlightLayerByName('highlight');
  if (highlightingLayer) {
    console.log('✅ Highlighting layer found');
    try {
      console.log(`Highlighted meshes: ${highlightingLayer.meshes ? highlightingLayer.meshes.length : 'undefined'}`);
    } catch (e) {
      console.log(`Highlighted meshes: Error accessing meshes - ${e.message}`);
    }
  } else {
    console.log('❌ No highlighting layer found');
  }
  
  console.log('\n5. MANUAL ENTITY CREATION TEST');
  console.log('================================');
  
  if (robotMeshes.length > 0 && deviceEntities.length === 0) {
    console.log('🔧 Creating device entity for robot meshes...');
    
    // Find the root node (mjcf_root)
    const rootNode = scene.getTransformNodeByName('mjcf_root');
    if (rootNode) {
      console.log(`Found root node: ${rootNode.name}`);
      
      // Get BABYLON from the scene manager
      const BABYLON = sceneManager.getEngine();
      
      // Create a device entity
      const deviceMesh = BABYLON.MeshBuilder.CreateBox(
        `${rootNode.name}_device_root`,
        { size: 0.01 },
        scene
      );
      deviceMesh.isVisible = false;
      deviceMesh.parent = rootNode;
      deviceMesh.position = BABYLON.Vector3.Zero();
      
      const deviceEntity = registry.create({
        mesh: deviceMesh,
        isDevice: true,
        rootTransformNode: rootNode,
        metadata: {
          name: rootNode.name,
          type: 'device',
          deviceType: 'mjcf',
        },
      });
      
      console.log(`✅ Created device entity: ${deviceEntity.getId()}`);
      
      // Create link entities for each robot mesh
      let linkCount = 0;
      robotMeshes.forEach(mesh => {
        const linkEntity = registry.create({
          mesh: mesh,
          metadata: {
            name: mesh.name,
            type: 'link',
          },
        });
        
        deviceEntity.addChild(linkEntity);
        linkCount++;
        console.log(`  ✅ Created link entity: ${mesh.name}`);
      });
      
      console.log(`✅ Created ${linkCount} link entities`);
      
      // Test highlighting
      console.log('\n6. TESTING HIGHLIGHTING');
      console.log('========================');
      
      if (highlightingLayer) {
        highlightingLayer.removeAllMeshes();
        
        // Get BABYLON for highlighting
        const BABYLON = sceneManager.getEngine();
        
        robotMeshes.forEach(mesh => {
          if (mesh.isVisible && !mesh.name.includes('_dummy')) {
            highlightingLayer.addMesh(mesh, new BABYLON.Color3(0.2, 0.8, 0.3));
            console.log(`  ✅ Highlighted: ${mesh.name}`);
          }
        });
        
        console.log('🎉 Robot should now be GREEN!');
      }
      
    } else {
      console.log('❌ No root node found (mjcf_root)');
    }
  } else if (deviceEntities.length > 0) {
    console.log('✅ Device entities already exist - testing highlighting...');
    
    const deviceEntity = deviceEntities[0];
    const children = deviceEntity.getChildren();
    
    if (highlightingLayer) {
      highlightingLayer.removeAllMeshes();
      
      // Get BABYLON for highlighting
      const BABYLON = sceneManager.getEngine();
      
      children.forEach(child => {
        const childMesh = child.getMesh();
        if (childMesh && childMesh.isVisible && !childMesh.name.includes('_dummy')) {
          highlightingLayer.addMesh(childMesh, new BABYLON.Color3(0.2, 0.8, 0.3));
          console.log(`  ✅ Highlighted: ${childMesh.name}`);
        }
      });
      
      console.log('🎉 Robot should now be GREEN!');
    }
  }
  
  console.log('\n7. EDITOR STORE TEST');
  console.log('=====================');
  
  if (window.useEditorStore) {
    const store = window.useEditorStore.getState();
    console.log(`Selected meshes: ${store.selectedMeshes.length}`);
    console.log(`Selected nodes: ${store.selectedNodeIds.length}`);
    
    // Test selection
    if (robotMeshes.length > 0) {
      const testMesh = robotMeshes[0];
      console.log(`Testing selection with: ${testMesh.name}`);
      
      store.selectMesh(testMesh);
      
      const newStore = window.useEditorStore.getState();
      console.log(`After selection - selected meshes: ${newStore.selectedMeshes.length}`);
      
      if (newStore.selectedMeshes.length > 0) {
        console.log('✅ Manual selection successful!');
      } else {
        console.log('❌ Manual selection failed');
      }
    }
  } else {
    console.log('❌ Editor store not available');
  }
  
  console.log('\n🎯 SUMMARY');
  console.log('===========');
  console.log('1. If robot meshes exist but no entities: Entity creation was attempted');
  console.log('2. If entities exist but no highlighting: Highlighting was applied manually');
  console.log('3. If highlighting works: The issue was missing entity registration');
  console.log('4. If highlighting still fails: Check SceneCanvas useEffect dependencies');
  
  console.log('\n💡 Next steps:');
  console.log('- Try clicking on the robot to see if selection works now');
  console.log('- If it works, the fix needs to be applied to the MJCF loader');
  console.log('- If it still fails, check the SceneCanvas highlighting logic');
})();
