# Project Manager Integration with World Save System

**Agent 3 (Cursor) - Edwin**  
**Date:** 2025-10-23

---

## 🏗️ Complete Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                  kinetiCORE Architecture                        │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                        │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │  Asset Library  │  │ Project Manager │  │  3D Viewport   │ │
│  │     Panel       │  │     Panel       │  │                │ │
│  │                 │  │                 │  │  Babylon.js    │ │
│  │  • Browse       │  │  • Projects     │  │  Scene         │ │
│  │  • Search       │  │  • Saves        │  │                │ │
│  │  • Drag-drop    │  │  • Collab       │  │                │ │
│  └─────────────────┘  └─────────────────┘  └────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         UI State (Zustand Stores)                         │  │
│  │  • useAssetLibraryStore                                   │  │
│  │  • useProjectManagerStore  ← Manages UI state             │  │
│  │  • useEditorStore                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────────┐
│                    MANAGER LAYER                                │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              ProjectManager (Singleton)                 │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │  • Project CRUD operations                             │   │
│  │  • Asset instance management                           │   │
│  │  • Collaboration coordination                          │   │
│  │  • Save/Load operations                                │   │
│  │  • Team member management                              │   │
│  │  • Comments & annotations                              │   │
│  └─────────┬──────────────┬─────────────┬─────────────────┘   │
│            │              │             │                      │
│  ┌─────────▼──────┐  ┌───▼────────┐  ┌▼──────────────────┐   │
│  │ ProjectDatabase│  │   Asset    │  │ Collaboration     │   │
│  │   (IndexedDB)  │  │  Instance  │  │   Manager         │   │
│  │                │  │  Manager   │  │                   │   │
│  │ • Projects     │  │            │  │ • Sessions        │   │
│  │ • Saves        │  │ • Create   │  │ • Locks           │   │
│  │ • History      │  │ • Update   │  │ • Real-time sync  │   │
│  └────────────────┘  │ • Clone    │  └───────────────────┘   │
│                      └────────────┘                            │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │          ProjectWorldLoader (Singleton)                 │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │  • Capture current world state                         │   │
│  │  • Restore world from save                             │   │
│  │  • Integrates with scene managers                      │   │
│  └─────────┬──────────────────────────────────────────────┘   │
│            │                                                    │
└────────────┼────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────┐
│                   WORLD SAVE SYSTEM (NEW)                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐   │
│  │           WorldSaveManager (Singleton)                  │   │
│  ├────────────────────────────────────────────────────────┤   │
│  │  • Export world to file (JSON)                         │   │
│  │  • Import world from file                              │   │
│  │  • Save world to database (compressed)                 │   │
│  │  • Load world from database                            │   │
│  │  • Asset library deduplication                         │   │
│  │  • Version migration                                   │   │
│  │  • Compression (Brotli)                                │   │
│  │  • Checksum verification                               │   │
│  └────────┬───────────────┬───────────────────────────────┘   │
│           │               │                                    │
│  ┌────────▼──────┐  ┌────▼──────────────┐                     │
│  │  File Storage │  │ Database Storage  │                     │
│  │    (JSON)     │  │  (Supabase)       │                     │
│  │               │  │                   │                     │
│  │ • Downloads   │  │ • Compressed      │                     │
│  │ • Uploads     │  │ • Versioned       │                     │
│  │ • Sharing     │  │ • Collaborative   │                     │
│  └───────────────┘  └───────────────────┘                     │
└────────────────────────────────────────────────────────────────┘
             ↓
┌────────────────────────────────────────────────────────────────┐
│                    SCENE & ENTITY LAYER                         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ SceneManager │  │ SceneTreeMgr   │  │ EntityRegistry   │   │
│  │              │  │                │  │                  │   │
│  │ • Babylon    │  │ • Tree nodes   │  │ • All entities   │   │
│  │ • Camera     │  │ • Hierarchy    │  │ • Sync meshes    │   │
│  │ • Lights     │  │ • Updates      │  │ • Physics bodies │   │
│  └──────────────┘  └────────────────┘  └──────────────────┘   │
│                                                                 │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ AssetLoader  │  │ KinematicsMgr  │  │ PhysicsEngine    │   │
│  │              │  │                │  │                  │   │
│  │ • URDF       │  │ • Joints       │  │ • Rapier         │   │
│  │ • GLB        │  │ • Chains       │  │ • Collisions     │   │
│  │ • JT         │  │ • IK solvers   │  │ • Dynamics       │   │
│  │ • MJCF       │  │ • Actuators    │  │                  │   │
│  └──────────────┘  └────────────────┘  └──────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

---

## 📦 Data Flow: How It All Works Together

### Scenario 1: Creating a New Project

```typescript
// 1. User clicks "New Project" in Project Manager Panel
const projectManager = ProjectManager.getInstance();

// 2. Create project (saves to IndexedDB)
const project = await projectManager.createProject({
  name: "Factory Layout v1",
  description: "Main assembly line",
  category: "simulation",
  visibility: "private"
});

// 3. Project is now active
await projectManager.setCurrentProject(project.id);

// 4. User starts adding assets from library
// (Drag KUKA KR270 from asset library → 3D viewport)
const assetInstance = await projectManager.addAssetInstance(project.id, {
  assetId: "lib_asset_kr270",  // Reference to library
  name: "Robot_1_Welding",
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 }
});

// 5. Instance is tracked in project
// project.assetInstances = [assetInstance]

// 6. Auto-save timer triggers (30 seconds)
const worldSaveManager = WorldSaveManager.getInstance();
await worldSaveManager.saveWorldToDatabase(
  project.id,
  "Auto-save",
  undefined,
  true // isAutoSave
);
```

**What Gets Saved:**
- ✅ Project metadata (name, description, category)
- ✅ Asset instance references (assetId, transforms, joints)
- ✅ Scene state (camera, lights, physics)
- ❌ Asset geometry (already in library!)

---

### Scenario 2: Saving Project (Manual Save)

```typescript
// User clicks "Save" button

// Option 1: ProjectManager handles save internally (current)
const save = await projectManager.saveProject(project.id, {
  name: "Checkpoint 1",
  description: "Before adding second robot",
  isAutoSave: false
});

// Option 2: WorldSaveManager handles save (proposed)
const worldSaveManager = WorldSaveManager.getInstance();

// 2a. Save to database (compressed)
await worldSaveManager.saveWorldToDatabase(
  project.id,
  "Checkpoint 1",
  "Before adding second robot",
  false // Not auto-save
);

// 2b. ALSO export to file (dual save strategy)
await worldSaveManager.exportWorldToFile(
  "Factory_Layout_Checkpoint1",
  {
    includeExternalAssets: true,
    includeBabylonScene: false
  }
);
```

**Integration Strategy:**

```typescript
// Update ProjectManager to use WorldSaveManager
export class ProjectManager {
  private worldSaveManager: WorldSaveManager;
  
  constructor() {
    this.worldSaveManager = WorldSaveManager.getInstance();
  }
  
  public async saveProject(
    projectId: string, 
    config: SaveProjectConfig
  ): Promise<ProjectSave> {
    // Strategy 1: Save to database (compressed)
    const dbSaveId = await this.worldSaveManager.saveWorldToDatabase(
      projectId,
      config.name,
      config.description,
      config.isAutoSave || false
    );
    
    // Strategy 2: ALSO export to file (if manual save)
    if (!config.isAutoSave) {
      await this.worldSaveManager.exportWorldToFile(
        config.name,
        {
          includeExternalAssets: true,
          includeBabylonScene: false
        }
      );
    }
    
    // Return save metadata
    return await this.projectDatabase.getProjectSave(dbSaveId);
  }
}
```

---

### Scenario 3: Loading a Project Save

```typescript
// User selects save from Project Manager panel

// 1. Load save from database
const worldSaveManager = WorldSaveManager.getInstance();
await worldSaveManager.loadWorldFromDatabase(saveId);

// Behind the scenes:
// 1. Fetch compressed data from Supabase
// 2. Decompress (Brotli)
// 3. Verify checksum
// 4. Parse JSON
// 5. Migrate version (if needed)
// 6. Restore world state:

async function restoreWorldData(worldData: WorldSaveData): Promise<void> {
  // Clear current scene
  await clearScene();
  
  // Restore asset library references
  const assetCache = new Map<string, LoadedAsset>();
  for (const libAsset of worldData.assetLibrary.assets) {
    const loadedAsset = await AssetLoader.load(libAsset);
    assetCache.set(libAsset.id, loadedAsset);
  }
  
  // Restore asset instances
  for (const instance of worldData.assetInstances) {
    // Get library asset
    const asset = assetCache.get(instance.assetId);
    
    // Clone for this instance
    const clone = asset.clone();
    clone.setPosition(instance.position);
    clone.setRotation(instance.rotation);
    clone.setScale(instance.scale);
    
    // Apply joint states (for robots)
    if (instance.jointStates) {
      for (const [jointId, position] of Object.entries(instance.jointStates)) {
        clone.setJointPosition(jointId, position);
      }
    }
    
    // Create attachments
    for (const attachment of instance.attachments) {
      await attachmentManager.createAttachment(attachment);
    }
    
    // Add to scene
    scene.add(clone);
    
    // Update project
    await projectManager.addAssetInstance(projectId, {
      ...instance,
      // Update with new runtime IDs
    });
  }
  
  // Restore scene state
  await restoreSceneState(worldData.sceneState);
}
```

---

### Scenario 4: Collaboration (Real-Time + Save-Based)

```typescript
// Multi-user collaboration workflow

// ============================================================
// User 1: Create project and start collaboration
// ============================================================
const project = await projectManager.createProject({ ... });
await projectManager.joinProject(project.id, user1Id);

// Add robot
const robot1 = await projectManager.addAssetInstance(project.id, {
  assetId: "lib_asset_kr270",
  name: "Robot_1",
  position: { x: 0, y: 0, z: 0 }
});

// Real-time sync: Broadcast to all users in session
websocket.broadcast({
  type: 'asset_instance_added',
  projectId: project.id,
  instance: robot1
});

// ============================================================
// User 2: Join project and see real-time updates
// ============================================================
await projectManager.joinProject(project.id, user2Id);

// Receive real-time update
websocket.on('asset_instance_added', (data) => {
  // Update scene immediately
  scene.addAssetInstance(data.instance);
});

// User 2 moves robot
await projectManager.updateAssetInstance(project.id, robot1.id, {
  position: { x: 5, y: 0, z: 0 }
});

// Real-time sync: Update for all users
websocket.broadcast({
  type: 'asset_instance_updated',
  projectId: project.id,
  instanceId: robot1.id,
  updates: { position: { x: 5, y: 0, z: 0 } }
});

// ============================================================
// Auto-save: Create checkpoint every 30 seconds
// ============================================================
setInterval(async () => {
  if (hasUnsavedChanges()) {
    // Save to database (doesn't interrupt work)
    await worldSaveManager.saveWorldToDatabase(
      project.id,
      `Auto-save ${new Date().toISOString()}`,
      undefined,
      true // isAutoSave
    );
    
    // Notify all users
    websocket.broadcast({
      type: 'project_saved',
      projectId: project.id,
      savedBy: currentUserId,
      timestamp: Date.now()
    });
  }
}, 30000); // 30 seconds

// ============================================================
// Manual save: Create named checkpoint
// ============================================================
// User 1 clicks "Save" button
await projectManager.saveProject(project.id, {
  name: "Checkpoint - Two Robots Positioned",
  description: "Ready for testing",
  isAutoSave: false
});

// Both database save AND file export
// All users get notified of new checkpoint
```

---

## 🔄 Integration Points

### 1. ProjectManager ↔ WorldSaveManager

**Current State:**
- ProjectManager has `saveProject()` that saves to IndexedDB
- ProjectWorldLoader captures scene state

**Proposed Integration:**
```typescript
// ProjectManager.ts

import { WorldSaveManager } from '../scene/WorldSaveManager';

export class ProjectManager {
  private worldSaveManager: WorldSaveManager;
  
  constructor() {
    this.worldSaveManager = WorldSaveManager.getInstance();
  }
  
  /**
   * Save project with dual strategy
   */
  public async saveProject(
    projectId: string, 
    config: SaveProjectConfig
  ): Promise<ProjectSave> {
    console.log('[ProjectManager] Saving project with WorldSaveManager...');
    
    // 1. Use WorldSaveManager for comprehensive save
    const saveId = await this.worldSaveManager.saveWorldToDatabase(
      projectId,
      config.name,
      config.description,
      config.isAutoSave || false
    );
    
    // 2. Also export to file (if manual save)
    if (!config.isAutoSave) {
      await this.worldSaveManager.exportWorldToFile(
        config.name,
        {
          includeExternalAssets: true,
          includeBabylonScene: false
        }
      );
    }
    
    // 3. Return ProjectSave for compatibility
    return {
      id: saveId,
      projectId,
      name: config.name,
      description: config.description,
      version: await this.getNextVersion(projectId),
      createdAt: new Date(),
      createdBy: this.currentUserId,
      // ... rest from WorldSaveManager
    };
  }
  
  /**
   * Load project save with WorldSaveManager
   */
  public async loadProjectSave(
    projectId: string, 
    saveId: string
  ): Promise<void> {
    console.log('[ProjectManager] Loading project with WorldSaveManager...');
    
    // Use WorldSaveManager to restore world
    await this.worldSaveManager.loadWorldFromDatabase(saveId);
    
    // Update current project reference
    const project = await this.getProject(projectId);
    this.currentProject = project;
  }
}
```

---

### 2. ProjectWorldLoader ↔ WorldSaveManager

**Current State:**
- ProjectWorldLoader captures scene state
- ProjectWorldLoader restores scene state

**Proposed Integration:**
```typescript
// WorldSaveManager.ts uses ProjectWorldLoader

export class WorldSaveManager {
  private projectWorldLoader: IProjectWorldLoader;
  
  constructor() {
    this.projectWorldLoader = DIContainer.getInstance()
      .get<IProjectWorldLoader>('ProjectWorldLoader');
  }
  
  /**
   * Capture world data using existing infrastructure
   */
  private async captureWorldData(
    format: 'export' | 'database',
    sceneName: string,
    options?: CaptureOptions
  ): Promise<WorldSaveData> {
    // 1. Use ProjectWorldLoader to capture scene state
    const sceneState = await this.projectWorldLoader.captureCurrentSceneState();
    
    // 2. Use ProjectWorldLoader to capture asset instances
    const assetInstances = await this.projectWorldLoader.captureCurrentAssetInstances();
    
    // 3. Deduplicate asset library references
    const assetLibrary = await this.deduplicateAssetLibrary(assetInstances);
    
    // 4. Assemble complete world data
    return {
      version: '3.0.0',
      format,
      timestamp: Date.now(),
      metadata: { sceneName, ... },
      assetLibrary,
      assetInstances,
      sceneState,
      externalAssets: options?.includeExternalAssets 
        ? await this.captureExternalAssets() 
        : undefined,
      babylonScene: options?.includeBabylonScene 
        ? await this.captureBabylonScene() 
        : undefined
    };
  }
  
  /**
   * Restore world using existing infrastructure
   */
  private async restoreWorldData(worldData: WorldSaveData): Promise<void> {
    // Use ProjectWorldLoader to restore
    await this.projectWorldLoader.restoreWorld(worldData);
  }
}
```

---

### 3. UI Integration (Project Manager Panel)

**Current UI:**
```typescript
// useProjectManagerStore.ts - Zustand store
interface ProjectManagerStore {
  selectedProject: Project | null;
  selectedSave: ProjectSave | null;
  // ...
}
```

**Enhanced UI:**
```typescript
// Add save options to store
interface ProjectManagerStore {
  // ... existing fields
  
  // Save options
  saveFormat: 'database' | 'file' | 'both';
  setSaveFormat: (format: 'database' | 'file' | 'both') => void;
  
  autoSaveEnabled: boolean;
  autoSaveFrequency: number; // seconds
  setAutoSaveConfig: (config: AutoSaveConfig) => void;
  
  // Compression options
  compressionEnabled: boolean;
  compressionType: 'gzip' | 'brotli';
  setCompressionConfig: (config: CompressionConfig) => void;
}

// ProjectManagerPanelV2.tsx - UI component
export function ProjectManagerPanelV2() {
  const projectManager = ProjectManager.getInstance();
  const worldSaveManager = WorldSaveManager.getInstance();
  
  const handleSave = async () => {
    const saveFormat = useProjectManagerStore(s => s.saveFormat);
    
    switch (saveFormat) {
      case 'database':
        await worldSaveManager.saveWorldToDatabase(...);
        break;
      case 'file':
        await worldSaveManager.exportWorldToFile(...);
        break;
      case 'both':
        await Promise.all([
          worldSaveManager.saveWorldToDatabase(...),
          worldSaveManager.exportWorldToFile(...)
        ]);
        break;
    }
  };
  
  return (
    <div className="project-manager-panel">
      {/* Save options UI */}
      <SaveOptionsPanel />
      
      {/* Project list */}
      <ProjectList />
      
      {/* Save history */}
      <SaveHistory />
    </div>
  );
}
```

---

## 📊 Data Storage Comparison

### Current System (ProjectDatabase - IndexedDB)

```
┌─────────────────────────────────────────┐
│       IndexedDB (Local Browser)         │
├─────────────────────────────────────────┤
│  Store: projects                         │
│  ├─ project_1                            │
│  │  ├─ name: "Factory Layout"           │
│  │  ├─ assetInstances: [...]  ← FULL    │
│  │  └─ ...                               │
│                                          │
│  Store: project_saves                    │
│  ├─ save_1                               │
│  │  ├─ projectId: "project_1"           │
│  │  ├─ assetInstances: [...] ← FULL     │
│  │  ├─ sceneState: {...}                │
│  │  └─ fileSize: 5000000  (5 MB!)       │
│  └─ save_2  (another 5 MB)              │
└─────────────────────────────────────────┘

Problems:
❌ No asset deduplication
❌ No compression
❌ Limited to browser (no cloud sync)
❌ 5-10 MB per save
```

---

### Proposed System (WorldSaveManager + Supabase)

```
┌─────────────────────────────────────────────────────────────┐
│              Supabase (Cloud Database)                       │
├─────────────────────────────────────────────────────────────┤
│  Table: projects                                             │
│  ├─ project_1                                                │
│  │  ├─ name: "Factory Layout"                               │
│  │  ├─ assetInstances: []  ← REFERENCES ONLY!              │
│  │  └─ ...                                                   │
│                                                              │
│  Table: project_saves                                        │
│  ├─ save_1                                                   │
│  │  ├─ projectId: "project_1"                               │
│  │  ├─ world_data: BYTEA ← COMPRESSED!                      │
│  │  │   └─ Brotli compressed JSON (2 MB)                    │
│  │  ├─ world_data_hash: "sha256:..."                        │
│  │  └─ fileSize: 2000000  (2 MB - 60% reduction!)           │
│  └─ save_2  (another 2 MB)                                  │
│                                                              │
│  Table: library_assets ← DEDUPLICATED!                       │
│  ├─ lib_asset_kr270                                          │
│  │  ├─ name: "KUKA KR270"                                   │
│  │  ├─ file_path: "robots/kuka/..."                         │
│  │  └─ ...                                                   │
│  └─ (Stored once, referenced many times)                    │
│                                                              │
│  Table: project_asset_instances ← QUERYABLE!                │
│  ├─ Instance metadata (searchable)                          │
│  └─ Denormalized for fast queries                           │
└─────────────────────────────────────────────────────────────┘

Benefits:
✅ Asset deduplication (98% reduction)
✅ Brotli compression (60% reduction)
✅ Cloud sync (work anywhere)
✅ Checksum verification
✅ Collaborative (multi-user)
✅ ~500 KB - 2 MB per save
```

---

## 🚀 Migration Path

### Phase 1: Keep Both Systems (Backward Compatible)

```typescript
// Support both old and new save systems

export class ProjectManager {
  public async saveProject(
    projectId: string, 
    config: SaveProjectConfig
  ): Promise<ProjectSave> {
    // Save to BOTH systems during migration
    
    // 1. Old system (IndexedDB)
    const oldSave = await this.projectDatabase.saveProject(projectId, config);
    
    // 2. New system (WorldSaveManager + Supabase)
    await this.worldSaveManager.saveWorldToDatabase(
      projectId,
      config.name,
      config.description,
      config.isAutoSave || false
    );
    
    return oldSave;
  }
}
```

### Phase 2: Migrate Existing Data

```typescript
// Migration tool
async function migrateProjectsToNewSystem() {
  const projectDatabase = ProjectDatabase.getInstance();
  const worldSaveManager = WorldSaveManager.getInstance();
  
  // Get all projects from IndexedDB
  const oldProjects = await projectDatabase.listProjects();
  
  for (const project of oldProjects) {
    console.log(`Migrating project: ${project.name}`);
    
    // Get all saves
    const oldSaves = await projectDatabase.getProjectSaves(project.id);
    
    for (const save of oldSaves) {
      // Convert old format to new format
      const worldData = convertOldToNew(save);
      
      // Save to new system
      await worldSaveManager.saveWorldToDatabase(
        project.id,
        save.name,
        save.description,
        save.isAutoSave
      );
    }
  }
  
  console.log('Migration complete!');
}
```

### Phase 3: Deprecate Old System

```typescript
// Remove ProjectDatabase usage
// Use WorldSaveManager exclusively
```

---

## 📝 Summary: What Changes?

### What Stays the Same
- ✅ ProjectManager API (backward compatible)
- ✅ UI (ProjectManagerPanel) - just enhanced
- ✅ AssetInstanceManager
- ✅ CollaborationManager
- ✅ Project CRUD operations

### What Gets Added
- ✅ WorldSaveManager (new)
- ✅ Asset library deduplication
- ✅ Brotli compression
- ✅ Supabase cloud storage
- ✅ File export/import
- ✅ Version migration system
- ✅ Checksum verification

### What Gets Enhanced
- ✅ ProjectManager.saveProject() → uses WorldSaveManager
- ✅ ProjectManager.loadProjectSave() → uses WorldSaveManager
- ✅ ProjectWorldLoader → integrates with WorldSaveManager
- ✅ UI → save options, compression settings

---

## 🎯 Action Items

1. **Create WorldSaveManager** (Phase 1)
   - Implement core save/load logic
   - Asset library deduplication
   - File export/import

2. **Set up Supabase** (Phase 2)
   - Create database tables
   - Configure RLS policies
   - Test compression

3. **Integrate with ProjectManager** (Phase 3)
   - Update saveProject()
   - Update loadProjectSave()
   - Keep backward compatibility

4. **Enhance UI** (Phase 4)
   - Add save options
   - Add compression settings
   - Add auto-save config

5. **Migration** (Phase 5)
   - Create migration tool
   - Test with existing data
   - Deprecate old system

Ready to implement! 🚀
