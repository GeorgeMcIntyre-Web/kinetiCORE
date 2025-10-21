# Project World Loading Integration Example

## Overview

This example shows how to integrate the new Project Manager world loading functionality with your existing kinetiCORE system. The Project Manager now provides comprehensive world loading capabilities that restore complete scene states including assets, transforms, joint states, camera, lighting, physics, and kinematics.

## Key Features Implemented

### 1. **Complete World Restoration**
- **Asset Instances**: Restore all assets with their transforms, joint states, and custom properties
- **Scene State**: Camera position, lighting setup, physics settings, kinematics chains
- **Environment**: Background color, fog settings, ground configuration
- **Placeholder Support**: Create placeholders for missing assets with visual indicators

### 2. **Project Save Management**
- **Version Control**: Each save has a version number and timestamp
- **Save Metadata**: Name, description, file size, checksum for integrity
- **Save Types**: Manual saves, auto-saves, collaborative saves with comments
- **Save History**: Browse and load from any previous save

### 3. **Enhanced UI Components**
- **Project Load Dialog**: Browse saves with detailed information and preview
- **Load Integration**: Seamless integration with existing project panel
- **Loading States**: Visual feedback during save loading process
- **Error Handling**: Graceful handling of missing assets or corrupted saves

## Integration Example

### Basic Usage

```typescript
// Initialize Project Manager
const projectManager = ProjectManager.getInstance();
await projectManager.initialize();

// Create a new project
const project = await projectManager.createProject({
  name: "Factory Layout Q1 2025",
  description: "Main production line layout",
  category: "production",
  visibility: "team",
  tags: ["factory", "production", "robots"]
});

// Set as current project
await projectManager.setCurrentProject(project.id);

// Save current world state
const save = await projectManager.saveProject(project.id, {
  name: "Initial Layout",
  description: "Starting configuration with all robots positioned",
  isAutoSave: false,
  includeComments: true,
  includeAnnotations: true
});

// Later, load a specific save
await projectManager.loadProjectSave(project.id, save.id);
```

### Advanced World Loading

```typescript
// Load project save with full restoration
const worldLoader = ProjectWorldLoader.getInstance();

// Load specific save
const success = await worldLoader.loadProjectSave(projectId, saveId);
if (success) {
  console.log('World restored successfully');
  
  // The following are automatically restored:
  // - All asset instances with transforms
  // - Joint states for robots
  // - Camera position and settings
  // - Lighting configuration
  // - Physics settings
  // - Kinematics chains
  // - Environment settings
}

// Export current world to new save
const newSave = await worldLoader.exportCurrentWorldToSave(
  projectId, 
  "Updated Layout"
);
```

### UI Integration

```typescript
// In your main layout component
import { ProjectPanel } from './ui/components/ProjectPanel';
import { ProjectLoadDialog } from './ui/components/ProjectLoadDialog';

const MainLayout = () => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showLoadDialog, setShowLoadDialog] = useState(false);

  const handleProjectLoad = (save: ProjectSave) => {
    console.log(`Loaded save: ${save.name} (version ${save.version})`);
    // World is automatically restored
    // UI will update via scenetree-update event
  };

  return (
    <div className="h-screen flex">
      {/* Project Panel with Load Button */}
      <div className="w-80">
        <ProjectPanel
          onProjectSelect={setCurrentProject}
          onProjectLoad={handleProjectLoad}
        />
      </div>

      {/* Main 3D Viewport */}
      <div className="flex-1">
        {/* Your existing 3D viewport */}
      </div>

      {/* Load Dialog */}
      {showLoadDialog && currentProject && (
        <ProjectLoadDialog
          project={currentProject}
          onClose={() => setShowLoadDialog(false)}
          onLoad={handleProjectLoad}
        />
      )}
    </div>
  );
};
```

## World Restoration Process

### 1. **Scene Clearing**
```typescript
// Clear current scene completely
await clearScene(scene, tree, registry);
// - Remove all meshes (except ground/system)
// - Clear transform nodes
// - Reset entity registry
// - Dispose materials
```

### 2. **Asset Instance Restoration**
```typescript
// For each asset instance in the save
for (const instance of save.assetInstances) {
  // Load referenced asset
  const asset = await loadAsset(instance.assetId);
  
  if (asset) {
    // Clone mesh and apply transform
    const mesh = asset.mesh.clone(instance.name);
    mesh.position = instance.position;
    mesh.rotationQuaternion = instance.rotation;
    mesh.scaling = instance.scale;
    
    // Apply joint states for robots
    if (instance.jointStates) {
      await applyJointStates(mesh, instance.jointStates);
    }
  } else {
    // Create placeholder for missing asset
    await createPlaceholderInstance(instance);
  }
}
```

### 3. **Scene State Restoration**
```typescript
// Restore camera
camera.setTarget(sceneState.camera.target);
camera.alpha = sceneState.camera.alpha;
camera.beta = sceneState.camera.beta;
camera.radius = sceneState.camera.radius;

// Restore lighting
scene.ambientLight = sceneState.lighting.ambientIntensity;
// Restore directional and point lights

// Restore physics
physicsManager.setGravity(sceneState.physics.gravity);
physicsManager.setTimeStep(sceneState.physics.timeStep);

// Restore kinematics chains
for (const chainData of sceneState.kinematics.chains) {
  // Restore joint positions and update chains
}
```

## Error Handling and Recovery

### Missing Assets
```typescript
// When asset is not found, create placeholder
const placeholder = BABYLON.MeshBuilder.CreateBox(
  `placeholder_${instance.name}`,
  { size: 1 },
  scene
);

// Apply semi-transparent material
const material = new BABYLON.StandardMaterial(`placeholder_mat`, scene);
material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
material.alpha = 0.5;
placeholder.material = material;

// Mark as placeholder in metadata
placeholder.metadata = {
  isPlaceholder: true,
  missingAsset: instance.assetId,
  instanceId: instance.id
};
```

### Corrupted Saves
```typescript
try {
  const success = await worldLoader.loadProjectSave(projectId, saveId);
  if (!success) {
    throw new Error('Failed to restore world state');
  }
} catch (error) {
  console.error('Failed to load project save:', error);
  
  // Show user-friendly error message
  toast.error('Failed to load project save. The file may be corrupted.');
  
  // Optionally, try to load a previous save
  const previousSaves = await projectManager.listProjectSaves(projectId);
  if (previousSaves.length > 1) {
    const lastGoodSave = previousSaves[1]; // Skip the corrupted one
    await worldLoader.loadProjectSave(projectId, lastGoodSave.id);
  }
}
```

## Performance Optimizations

### Lazy Loading
```typescript
// Load assets on-demand during restoration
private async loadAsset(assetId: string): Promise<any> {
  // Check if already loaded
  if (this.assetCache.has(assetId)) {
    return this.assetCache.get(assetId);
  }
  
  // Load from asset library
  const asset = await this.assetLibraryManager.loadAsset(assetId);
  
  // Cache for future use
  this.assetCache.set(assetId, asset);
  
  return asset;
}
```

### Batch Operations
```typescript
// Process multiple instances in batches
const BATCH_SIZE = 10;
for (let i = 0; i < instances.length; i += BATCH_SIZE) {
  const batch = instances.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(instance => this.restoreAssetInstance(instance)));
  
  // Allow UI to update between batches
  await new Promise(resolve => setTimeout(resolve, 10));
}
```

## Integration with Existing Systems

### World Serializer Integration
```typescript
// The ProjectWorldLoader integrates with existing WorldSerializer
// It uses the same restoration functions but adds project-specific features

// Existing comprehensive world loading
await restoreComprehensiveWorld(comprehensiveData);

// New project-based world loading
await worldLoader.loadProjectSave(projectId, saveId);
// This provides the same restoration but with project context
```

### Asset Library Integration
```typescript
// Project saves reference assets by ID
// The system automatically loads assets from the existing asset library

const asset = await AssetLibraryManager.getInstance().getAsset(instance.assetId);
if (asset) {
  // Use existing asset loading system
  const mesh = await AssetLoader.loadAsset(asset.filePath);
} else {
  // Create placeholder for missing asset
  await createPlaceholderInstance(instance);
}
```

## Benefits

### For Users:
1. **Complete World Restoration**: Everything is restored exactly as saved
2. **Version Control**: Load any previous state of the project
3. **Missing Asset Handling**: Graceful handling with visual placeholders
4. **Performance**: Optimized loading with progress feedback

### For Developers:
1. **Modular Design**: Easy to extend with new restoration features
2. **Error Recovery**: Robust error handling and recovery mechanisms
3. **Integration**: Seamless integration with existing systems
4. **Extensibility**: Easy to add new scene state components

This implementation provides a comprehensive world loading system that maintains full compatibility with your existing architecture while adding powerful project management capabilities.
