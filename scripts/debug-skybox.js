/**
 * Skybox Debugging Script
 * Run this in the browser console via MCP Chrome DevTools to diagnose sky rendering issues
 * 
 * Usage: Copy and paste into browser console or run via: mcp__chrome-devtools__console
 */

(function debugSkybox() {
  console.log('🔍 SKYBOX DEBUGGING SESSION STARTED');
  console.log('='.repeat(60));
  
  // Get the Babylon scene
  const scene = window.scene || window.babylonScene;
  if (!scene) {
    console.error('❌ No Babylon scene found! Make sure the scene is exposed to window.');
    return;
  }
  
  console.log('✅ Scene found:', scene);
  
  // Find skybox mesh
  const skybox = scene.getMeshByName('warehouse_skybox');
  if (!skybox) {
    console.error('❌ SKYBOX NOT FOUND!');
    console.log('Available meshes:', scene.meshes.map(m => m.name).filter(n => n));
    console.log('Total meshes:', scene.meshes.length);
    return;
  }
  
  console.log('✅ Skybox mesh found:', skybox);
  console.log('');
  
  // Check skybox properties
  console.log('📊 SKYBOX PROPERTIES:');
  console.log('  - Name:', skybox.name);
  console.log('  - Enabled:', skybox.isEnabled());
  console.log('  - Visible:', skybox.isVisible);
  console.log('  - Position:', `(${skybox.position.x}, ${skybox.position.y}, ${skybox.position.z})`);
  console.log('  - Scaling:', `(${skybox.scaling.x}, ${skybox.scaling.y}, ${skybox.scaling.z})`);
  console.log('  - InfiniteDistance:', skybox.infiniteDistance);
  console.log('  - RenderingGroupId:', skybox.renderingGroupId);
  console.log('  - IsPickable:', skybox.isPickable);
  console.log('  - BoundingInfo:', skybox.getBoundingInfo());
  console.log('');
  
  // Check material
  const material = skybox.material;
  if (!material) {
    console.error('❌ SKYBOX HAS NO MATERIAL!');
    return;
  }
  
  console.log('✅ Skybox material found:', material.name);
  console.log('📊 MATERIAL PROPERTIES:');
  console.log('  - Name:', material.name);
  console.log('  - BackFaceCulling:', material.backFaceCulling);
  console.log('  - DisableLighting:', material.disableLighting);
  console.log('  - DisableDepthWrite:', material.disableDepthWrite);
  console.log('');
  
  // Check texture
  const texture = material.reflectionTexture;
  if (!texture) {
    console.error('❌ SKYBOX HAS NO TEXTURE!');
    console.log('Material:', material);
    return;
  }
  
  console.log('✅ Skybox texture found');
  console.log('📊 TEXTURE PROPERTIES:');
  console.log('  - Type:', texture.constructor.name);
  console.log('  - CoordinatesMode:', texture.coordinatesMode);
  console.log('  - IsReady:', texture.isReady());
  console.log('  - Size:', texture.getSize ? texture.getSize() : 'N/A');
  console.log('');
  
  // Check camera
  const camera = scene.activeCamera;
  if (camera) {
    console.log('📷 CAMERA PROPERTIES:');
    console.log('  - Type:', camera.constructor.name);
    console.log('  - Position:', `(${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})`);
    if (camera instanceof BABYLON.ArcRotateCamera) {
      console.log('  - Target:', `(${camera.target.x.toFixed(2)}, ${camera.target.y.toFixed(2)}, ${camera.target.z.toFixed(2)})`);
      console.log('  - Radius:', camera.radius.toFixed(2));
      console.log('  - Alpha:', camera.alpha.toFixed(2));
      console.log('  - Beta:', camera.beta.toFixed(2));
    }
    console.log('  - minZ:', camera.minZ);
    console.log('  - maxZ:', camera.maxZ);
    console.log('  - Can see skybox?', camera.maxZ > skybox.getBoundingInfo().boundingBox.maximumWorld.y);
    console.log('');
  }
  
  // Check scene environment
  console.log('🌍 SCENE ENVIRONMENT:');
  console.log('  - EnvironmentTexture:', scene.environmentTexture ? 'YES' : 'NO');
  console.log('  - ClearColor:', scene.clearColor);
  console.log('  - FogEnabled:', scene.fogEnabled);
  if (scene.fogEnabled) {
    console.log('  - FogColor:', scene.fogColor);
    console.log('  - FogDensity:', scene.fogDensity);
    console.log('  - FogStart:', scene.fogStart);
    console.log('  - FogEnd:', scene.fogEnd);
  }
  console.log('');
  
  // Check rendering pipeline
  const pipelines = scene.postProcessRenderPipelineManager.registeredPipelines;
  if (pipelines.length > 0) {
    console.log('🎬 RENDERING PIPELINES:');
    pipelines.forEach((pipeline, i) => {
      console.log(`  - Pipeline ${i}:`, pipeline.name);
    });
    console.log('');
  }
  
  // Check if skybox is in view frustum
  const cameraFrustum = camera.getViewMatrix();
  const skyboxBoundingInfo = skybox.getBoundingInfo();
  const isInView = camera.frustumPlanes && camera.frustumPlanes.length > 0 
    ? BABYLON.Frustum.GetPlanes(camera.getTransformationMatrix()).some(plane => 
        BABYLON.Plane.Transform(plane, skyboxBoundingInfo.boundingBox.centerWorld)
      )
    : true;
  
  console.log('👁️ VISIBILITY CHECK:');
  console.log('  - Skybox in view frustum:', isInView);
  console.log('  - Skybox bounding box center:', skyboxBoundingInfo.boundingBox.centerWorld);
  console.log('  - Skybox bounding box size:', skyboxBoundingInfo.boundingBox.maximumWorld.subtract(skyboxBoundingInfo.boundingBox.minimumWorld));
  console.log('');
  
  // Try to fix common issues
  console.log('🔧 ATTEMPTING FIXES:');
  let fixesApplied = [];
  
  // Fix 1: Ensure skybox is enabled and visible
  if (!skybox.isEnabled()) {
    skybox.setEnabled(true);
    fixesApplied.push('Enabled skybox');
  }
  
  if (!skybox.isVisible) {
    skybox.isVisible = true;
    fixesApplied.push('Made skybox visible');
  }
  
  // Fix 2: Ensure rendering group is correct
  if (skybox.renderingGroupId !== 0) {
    skybox.renderingGroupId = 0;
    fixesApplied.push('Set renderingGroupId to 0');
  }
  
  // Fix 3: Ensure infinite distance
  if (!skybox.infiniteDistance) {
    skybox.infiniteDistance = true;
    fixesApplied.push('Enabled infiniteDistance');
  }
  
  // Fix 4: Ensure material settings
  if (material.disableDepthWrite !== true) {
    material.disableDepthWrite = true;
    fixesApplied.push('Enabled disableDepthWrite on material');
  }
  
  if (material.disableLighting !== true) {
    material.disableLighting = true;
    fixesApplied.push('Enabled disableLighting on material');
  }
  
  // Fix 5: Ensure camera can see skybox
  if (camera && camera.maxZ < skyboxBoundingInfo.boundingBox.maximumWorld.y * 2) {
    const newMaxZ = skyboxBoundingInfo.boundingBox.maximumWorld.y * 2;
    camera.maxZ = newMaxZ;
    fixesApplied.push(`Updated camera.maxZ to ${newMaxZ.toFixed(2)}`);
  }
  
  if (fixesApplied.length > 0) {
    console.log('✅ Applied fixes:', fixesApplied);
  } else {
    console.log('ℹ️ No fixes needed (all settings look correct)');
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('🔍 SKYBOX DEBUGGING COMPLETE');
  console.log('');
  console.log('💡 TIPS:');
  console.log('  - If skybox is still not visible, check if it\'s being occluded by other meshes');
  console.log('  - Try rotating the camera to look up at the sky');
  console.log('  - Check if the skybox texture is loading correctly');
  console.log('  - Verify the skybox size is large enough (should be 1000x warehouse size)');
  
  return {
    skybox,
    material,
    texture,
    camera,
    fixesApplied
  };
})();



