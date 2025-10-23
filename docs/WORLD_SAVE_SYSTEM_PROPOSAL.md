# World Save System - Comprehensive Design Proposal

**Agent 3 (Cursor) - Edwin**  
**Date:** 2025-10-23  
**Status:** Brainstorming / Design Phase

---

## Overview

This document proposes a comprehensive save/load system for kinetiCORE that handles:
- Complete world state (locations, joints, attachments, etc.)
- Asset library references (one-to-many relationship)
- Database storage with compression
- File export (JSON format)
- Version compatibility and migration
- Collaboration and multi-user scenarios

---

## Current State Analysis

### What We Have (WorldSerializer.ts)
✅ **Basic world serialization** - Scene tree nodes, positions, transforms  
✅ **Babylon scene serialization** - Full mesh/material/light data  
✅ **Comprehensive world data** - Physics, kinematics, assets  
✅ **Validation system** - Pre-save and post-load validation  

### What We Have (Project System)
✅ **Asset instances** - AssetInstance with transforms, joints, attachments  
✅ **Project structure** - Projects with team members, visibility, versioning  
✅ **Collaboration** - Comments, annotations, locking  
✅ **Change tracking** - History of modifications  

### What's Missing
❌ **Asset library reference deduplication** - No one-to-many asset instances  
❌ **Compression for database** - JSON stored as-is (large)  
❌ **Hybrid save format** - No distinction between file export vs DB storage  
❌ **External asset handling** - Mesh files referenced but not embedded  
❌ **Incremental saves** - No delta/diff-based saves  

---

## Proposed Architecture

### 1. Dual Save Format Strategy

#### Format A: File Export (Human-Readable JSON)
**Use Case:** Export world for sharing, backup, version control  
**Format:** Uncompressed JSON  
**Size:** Larger (~5-50 MB for complex scenes)  
**Storage:** Local filesystem or cloud storage  

```json
{
  "version": "3.0.0",
  "format": "export",
  "timestamp": 1729702800000,
  "metadata": {
    "sceneName": "Factory Layout v1",
    "description": "Main assembly line simulation",
    "tags": ["manufacturing", "assembly"],
    "author": "user@company.com",
    "customProperties": {}
  },
  
  // Asset Library References (Deduplicated)
  "assetLibrary": {
    "assets": [
      {
        "id": "lib_asset_kr270",
        "name": "KUKA KR270 R2700",
        "loaderType": "urdf",
        "filePath": "robots/kuka/kr270/robot.urdf",
        "version": "1.0.0",
        "checksum": "sha256:abc123...",
        "metadata": {
          "manufacturer": "KUKA",
          "modelNumber": "KR270-R2700",
          "dof": 6,
          "payload": 270,
          "reach": 2700
        }
      },
      {
        "id": "lib_asset_conveyor_01",
        "name": "Belt Conveyor 2m",
        "loaderType": "glb",
        "filePath": "equipment/conveyors/belt_2m.glb",
        "version": "1.2.0"
      }
    ]
  },
  
  // Asset Instances (Reference library assets)
  "assetInstances": [
    {
      "id": "inst_001",
      "assetId": "lib_asset_kr270",  // Reference to library
      "name": "Robot_1_Welding",
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotation": { "x": 0, "y": 0, "z": 0, "w": 1 },
      "scale": { "x": 1, "y": 1, "z": 1 },
      
      // Robot-specific state
      "jointStates": {
        "joint_1": 0.0,
        "joint_2": -1.57,
        "joint_3": 1.57,
        "joint_4": 0.0,
        "joint_5": 0.0,
        "joint_6": 0.0
      },
      
      // Attachments (tools, grippers, sensors)
      "attachments": [
        {
          "id": "attach_001",
          "type": "mechanical",
          "targetInstanceId": "inst_002",  // Welding gun
          "connectionPoint": { "x": 0, "y": 0, "z": 0.15 },
          "connectionType": "fixed",
          "name": "Welding Gun Mount"
        }
      ],
      
      "customProperties": {
        "programName": "weld_cycle_1.krl",
        "toolOffset": { "x": 0, "y": 0, "z": 0.15 }
      },
      
      "isVisible": true,
      "isLocked": false
    },
    {
      "id": "inst_002",
      "assetId": "lib_asset_kr270",  // SAME asset, different instance
      "name": "Robot_2_Painting",
      "position": { "x": 5, "y": 0, "z": 0 },
      "rotation": { "x": 0, "y": 0, "z": 1.57, "w": 0.707 },
      "scale": { "x": 1, "y": 1, "z": 1 },
      
      "jointStates": {
        "joint_1": 0.5,
        "joint_2": -0.8,
        "joint_3": 1.2,
        "joint_4": 0.0,
        "joint_5": 0.3,
        "joint_6": -0.5
      },
      
      "attachments": [],
      "customProperties": {}
    },
    {
      "id": "inst_003",
      "assetId": "lib_asset_conveyor_01",
      "name": "Conveyor_Main",
      "position": { "x": 2.5, "y": 0, "z": 0 },
      "rotation": { "x": 0, "y": 0, "z": 0, "w": 1 },
      "scale": { "x": 1, "y": 1, "z": 1 },
      "jointStates": {},
      "attachments": []
    }
  ],
  
  // Scene State
  "sceneState": {
    "camera": {
      "position": { "x": 10, "y": 10, "z": 10 },
      "target": { "x": 0, "y": 0, "z": 0 },
      "alpha": 0.785,
      "beta": 0.785,
      "radius": 17.32
    },
    "lighting": {
      "ambientIntensity": 0.5,
      "directionalLights": [
        {
          "id": "sun",
          "direction": { "x": 1, "y": -1, "z": 1 },
          "intensity": 1.0,
          "color": { "x": 1, "y": 1, "z": 1 },
          "enabled": true
        }
      ],
      "pointLights": []
    },
    "physics": {
      "enabled": true,
      "gravity": { "x": 0, "y": 0, "z": -9.81 },
      "timeStep": 0.016,
      "entities": [
        {
          "instanceId": "inst_003",
          "bodyType": "static",
          "mass": 0,
          "friction": 0.5,
          "restitution": 0.3,
          "linearVelocity": { "x": 0, "y": 0, "z": 0 },
          "angularVelocity": { "x": 0, "y": 0, "z": 0 }
        }
      ]
    },
    "kinematics": {
      "chains": [
        {
          "id": "chain_robot1",
          "name": "Robot 1 Kinematic Chain",
          "instanceId": "inst_001",
          "joints": [
            {
              "id": "joint_1",
              "name": "Base Rotation",
              "type": "revolute",
              "position": 0.0,
              "velocity": 0.0,
              "effort": 0.0,
              "limits": {
                "lower": -3.14,
                "upper": 3.14,
                "effort": 100.0,
                "velocity": 2.0
              }
            }
            // ... more joints
          ],
          "isActive": true
        }
      ],
      "actuators": []
    },
    "environment": {
      "backgroundColor": { "x": 0.2, "y": 0.2, "z": 0.25 },
      "fogEnabled": false,
      "fogDensity": 0.01,
      "fogColor": { "x": 0.5, "y": 0.5, "z": 0.5 },
      "groundEnabled": true,
      "groundSize": 20,
      "groundColor": { "x": 0.3, "y": 0.3, "z": 0.3 }
    }
  },
  
  // External Assets (meshes, textures) - Optional
  "externalAssets": {
    "meshes": [
      {
        "id": "mesh_kr270_base",
        "assetId": "lib_asset_kr270",
        "path": "robots/kuka/kr270/meshes/base_link.stl",
        "size": 245000,
        "checksum": "sha256:def456...",
        "embedding": "reference"  // or "inline" for base64
      }
    ],
    "textures": []
  },
  
  // Babylon Scene Snapshot (Optional - for visual fidelity)
  "babylonScene": {
    // Full Babylon.js scene serialization
    // Useful for exact reproduction but LARGE
  }
}
```

**Advantages:**
- ✅ Human-readable for debugging
- ✅ Asset reuse via references (one asset → many instances)
- ✅ Easy to version control (Git-friendly)
- ✅ Can be edited manually if needed

**Disadvantages:**
- ❌ Large file size (5-50 MB for complex scenes)
- ❌ Slow to parse for large worlds

---

#### Format B: Database Storage (Compressed Binary)
**Use Case:** Cloud saves, auto-saves, collaboration  
**Format:** Compressed JSON (gzip/brotli) + Binary blobs  
**Size:** Smaller (~500 KB - 10 MB)  
**Storage:** PostgreSQL/Supabase with JSONB + Blob storage  

```typescript
// Database Schema (Supabase)

// Table: projects
{
  id: uuid,
  name: text,
  description: text,
  created_at: timestamp,
  updated_at: timestamp,
  created_by: uuid,  // FK to users
  visibility: enum('private', 'team', 'public'),
  status: enum('draft', 'active', 'completed', 'archived'),
  category: text,
  tags: text[],
  current_version: integer,
  custom_properties: jsonb
}

// Table: project_saves
{
  id: uuid,
  project_id: uuid,  // FK to projects
  version: integer,
  name: text,
  description: text,
  created_at: timestamp,
  created_by: uuid,
  
  // Compressed world data
  world_data: bytea,  // gzip-compressed JSON
  world_data_hash: text,  // SHA-256 checksum
  
  // Metadata (searchable, not compressed)
  asset_instance_count: integer,
  file_size: integer,
  is_auto_save: boolean,
  
  // External assets
  external_assets: jsonb  // References to blob storage
}

// Table: project_asset_instances
// For efficient querying without decompressing
{
  id: uuid,
  project_save_id: uuid,
  asset_id: uuid,  // FK to library_assets
  instance_id: text,  // Instance ID within the world
  name: text,
  position: jsonb,
  rotation: jsonb,
  joint_states: jsonb,
  created_at: timestamp
}

// Table: library_assets
{
  id: uuid,
  name: text,
  loader_type: text,
  file_path: text,
  version: text,
  checksum: text,
  metadata: jsonb,
  created_at: timestamp
}

// Table: external_asset_blobs
// For large mesh/texture files
{
  id: uuid,
  asset_id: uuid,
  file_name: text,
  content_type: text,
  data: bytea,  // or reference to S3/R2
  size: integer,
  checksum: text,
  created_at: timestamp
}
```

**Compression Strategy:**
```typescript
// Save to database
async function saveWorldToDatabase(world: WorldData): Promise<void> {
  // 1. Serialize to JSON
  const jsonString = JSON.stringify(world);
  
  // 2. Compress with gzip
  const compressed = pako.gzip(jsonString);
  
  // 3. Calculate checksum
  const checksum = await calculateSHA256(compressed);
  
  // 4. Save to database
  const { data, error } = await supabase
    .from('project_saves')
    .insert({
      project_id: projectId,
      world_data: compressed,
      world_data_hash: checksum,
      file_size: compressed.length,
      asset_instance_count: world.assetInstances.length
    });
}

// Load from database
async function loadWorldFromDatabase(saveId: string): Promise<WorldData> {
  // 1. Fetch compressed data
  const { data, error } = await supabase
    .from('project_saves')
    .select('world_data, world_data_hash')
    .eq('id', saveId)
    .single();
  
  // 2. Verify checksum
  const checksum = await calculateSHA256(data.world_data);
  if (checksum !== data.world_data_hash) {
    throw new Error('Checksum mismatch - data corruption detected');
  }
  
  // 3. Decompress
  const jsonString = pako.ungzip(data.world_data, { to: 'string' });
  
  // 4. Parse JSON
  const world = JSON.parse(jsonString);
  
  return world;
}
```

**Advantages:**
- ✅ Smaller storage size (5-10x compression)
- ✅ Faster to save/load over network
- ✅ Checksum verification for integrity
- ✅ Can store metadata separately for querying

**Disadvantages:**
- ❌ Not human-readable in database
- ❌ Requires decompression to access data

---

### 2. Asset Library Reference System (One-to-Many)

**Problem:**  
If you have 50 KUKA KR270 robots in a scene, you don't want to store the entire URDF + mesh files 50 times.

**Solution:**  
Asset instances reference a shared library asset by ID.

```typescript
// Asset Library Entry (Stored once)
interface LibraryAsset {
  id: string;  // "lib_asset_kr270"
  name: string;
  loaderType: 'urdf' | 'glb' | 'jt' | 'mjcf';
  filePath: string;  // "robots/kuka/kr270/robot.urdf"
  version: string;
  checksum: string;
  metadata: AssetCapabilities;
}

// Asset Instance (Stored per instance)
interface AssetInstance {
  id: string;  // "inst_001"
  assetId: string;  // "lib_asset_kr270" ← REFERENCE
  name: string;  // "Robot_1_Welding"
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  jointStates: Record<string, number>;
  attachments: Attachment[];
  customProperties: any;
}
```

**Save Process:**
1. Collect all unique library assets used in the scene
2. Store asset library references at top level
3. Store instances with `assetId` references only
4. On load, lookup library asset by ID and recreate instances

**Example:**
```json
{
  "assetLibrary": {
    "assets": [
      { "id": "lib_asset_kr270", ... }  // Stored ONCE
    ]
  },
  "assetInstances": [
    { "id": "inst_001", "assetId": "lib_asset_kr270", ... },
    { "id": "inst_002", "assetId": "lib_asset_kr270", ... },
    { "id": "inst_003", "assetId": "lib_asset_kr270", ... }
    // 50 instances → 50 small JSON objects
    // 1 asset → 1 large asset definition
  ]
}
```

**Storage Savings:**
- Without references: 50 robots × 10 MB = **500 MB**
- With references: 1 asset × 10 MB + 50 instances × 2 KB = **10.1 MB**
- **98% reduction!**

---

### 3. External Asset Handling

**Problem:**  
URDF/MJCF files reference external meshes (.stl, .dae, .obj). How do we save these?

**Options:**

#### Option A: Reference Only (Lightweight)
```json
{
  "externalAssets": {
    "meshes": [
      {
        "id": "mesh_kr270_base",
        "path": "robots/kuka/kr270/meshes/base_link.stl",
        "checksum": "sha256:abc123",
        "embedding": "reference"
      }
    ]
  }
}
```
- ✅ Small file size
- ❌ User must have mesh files locally
- ❌ Breaks if files move

#### Option B: Inline Base64 (Self-Contained)
```json
{
  "externalAssets": {
    "meshes": [
      {
        "id": "mesh_kr270_base",
        "path": "robots/kuka/kr270/meshes/base_link.stl",
        "checksum": "sha256:abc123",
        "embedding": "inline",
        "data": "base64:SGVsbG8gV29ybGQ..."  // Encoded mesh
      }
    ]
  }
}
```
- ✅ Self-contained (portable)
- ✅ Always works
- ❌ HUGE file size (meshes can be 5-50 MB each)

#### Option C: Hybrid (Recommended)
```json
{
  "externalAssets": {
    "meshes": [
      {
        "id": "mesh_kr270_base",
        "path": "robots/kuka/kr270/meshes/base_link.stl",
        "checksum": "sha256:abc123",
        "embedding": "cdn",  // Stored on CDN/S3/R2
        "url": "https://cdn.kineticore.io/assets/meshes/abc123.stl"
      }
    ]
  }
}
```
- ✅ Small save file
- ✅ Always available (CDN)
- ✅ Cached for performance
- ❌ Requires internet connection

**Recommendation:**
- File exports: Option A (reference) with optional inline for critical assets
- Database saves: Option C (CDN) with automatic upload

---

### 4. Versioning & Migration

**Problem:**  
World save format changes over time. How do we load old saves?

**Solution:**  
Version field + migration system

```typescript
interface WorldData {
  version: string;  // "3.0.0"
  // ... rest of data
}

// Migration registry
const migrations = {
  '1.0.0': migrateV1toV2,
  '2.0.0': migrateV2toV3,
  '3.0.0': null  // Current version
};

// Auto-migrate on load
function loadWorldData(data: any): WorldData {
  let currentVersion = data.version || '1.0.0';
  
  while (currentVersion !== CURRENT_VERSION) {
    const migrationFn = migrations[currentVersion];
    if (!migrationFn) {
      throw new Error(`No migration path from ${currentVersion} to ${CURRENT_VERSION}`);
    }
    
    data = migrationFn(data);
    currentVersion = getNextVersion(currentVersion);
  }
  
  return data as WorldData;
}

// Example migration
function migrateV1toV2(data: any): any {
  // V1: position was { x, y, z } in mm
  // V2: position is { x, y, z } in meters
  data.assetInstances.forEach(inst => {
    inst.position.x /= 1000;
    inst.position.y /= 1000;
    inst.position.z /= 1000;
  });
  
  data.version = '2.0.0';
  return data;
}
```

---

### 5. Incremental Saves (Delta/Diff)

**Problem:**  
Saving entire world every time is slow. Most changes are small.

**Solution:**  
Save deltas for auto-saves, full saves for manual saves.

```typescript
interface DeltaSave {
  version: string;
  baselineVersion: number;  // Full save this is based on
  timestamp: number;
  changes: Change[];
}

interface Change {
  type: 'create' | 'update' | 'delete';
  instanceId: string;
  property: string;
  oldValue: any;
  newValue: any;
}

// Example delta save
{
  "version": "3.0.0",
  "baselineVersion": 5,
  "timestamp": 1729702900000,
  "changes": [
    {
      "type": "update",
      "instanceId": "inst_001",
      "property": "position.x",
      "oldValue": 0,
      "newValue": 1.5
    },
    {
      "type": "update",
      "instanceId": "inst_001",
      "property": "jointStates.joint_1",
      "oldValue": 0.0,
      "newValue": 0.5
    }
  ]
}
```

**Save Strategy:**
- Auto-save every 30 seconds: Delta save
- Manual save: Full save
- Every 10 delta saves: Create new baseline full save

---

## Implementation Plan

### Phase 1: Core Save/Load (Week 1)
- [ ] Define `WorldSaveData` interface (v3.0.0)
- [ ] Implement asset library reference system
- [ ] Add asset instance serialization
- [ ] Add scene state serialization
- [ ] Implement file export (JSON)
- [ ] Implement file import (JSON)
- [ ] Add validation and error handling

### Phase 2: Database Integration (Week 2)
- [ ] Set up Supabase schema
- [ ] Implement compression (gzip)
- [ ] Add checksum verification
- [ ] Implement database save
- [ ] Implement database load
- [ ] Add project management UI

### Phase 3: External Assets (Week 3)
- [ ] Implement CDN upload for meshes
- [ ] Add reference-based loading
- [ ] Add fallback to local files
- [ ] Implement asset caching

### Phase 4: Advanced Features (Week 4)
- [ ] Implement version migration
- [ ] Add delta/diff saves
- [ ] Add auto-save system
- [ ] Add conflict resolution for collaboration
- [ ] Add save history UI

---

## API Design

```typescript
// WorldSaveManager.ts

class WorldSaveManager {
  // File Export/Import
  async exportWorldToFile(options?: ExportOptions): Promise<void>;
  async importWorldFromFile(file: File): Promise<void>;
  
  // Database Save/Load
  async saveWorldToDatabase(projectId: string, saveName: string): Promise<ProjectSave>;
  async loadWorldFromDatabase(saveId: string): Promise<void>;
  
  // Asset Library
  async collectUsedAssets(): Promise<LibraryAsset[]>;
  async resolveAssetReference(assetId: string): Promise<LibraryAsset>;
  
  // Asset Instances
  async serializeAssetInstances(): Promise<AssetInstance[]>;
  async restoreAssetInstances(instances: AssetInstance[]): Promise<void>;
  
  // Scene State
  async captureSceneState(): Promise<SceneState>;
  async restoreSceneState(state: SceneState): Promise<void>;
  
  // Utilities
  async validateWorldData(data: WorldSaveData): Promise<ValidationResult>;
  async compressWorldData(data: WorldSaveData): Promise<Uint8Array>;
  async decompressWorldData(compressed: Uint8Array): Promise<WorldSaveData>;
}
```

---

## Questions for Discussion

1. **File vs Database:** Should we always save to both, or let user choose?
2. **External Assets:** CDN upload automatic or manual?
3. **Compression:** gzip (standard) or brotli (better compression)?
4. **Collaboration:** Real-time sync or save-based?
5. **Auto-save frequency:** 30 seconds? 1 minute?
6. **Version migration:** Automatic or prompt user?
7. **Asset caching:** How long to cache mesh files?
8. **Attachment serialization:** How to handle complex connections?

---

## Next Steps

1. **Review this proposal** with Agent 1 (George) for architecture approval
2. **Define final JSON schema** for WorldSaveData v3.0.0
3. **Set up Supabase schema** for project saves
4. **Implement Phase 1** (core save/load to file)
5. **Create test worlds** for validation

---

## File Size Estimates

**Small World (10 objects):**
- Uncompressed JSON: 50 KB
- Compressed: 10 KB
- Database storage: 15 KB

**Medium World (100 objects, 5 robots):**
- Uncompressed JSON: 2 MB
- Compressed: 300 KB
- Database storage: 350 KB

**Large World (500 objects, 20 robots, complex scene):**
- Uncompressed JSON: 25 MB
- Compressed: 3 MB
- Database storage: 3.5 MB

**With Embedded Meshes:**
- Add 5-50 MB per unique robot
- Compression helps (50-70% reduction)

---

## References

- Existing code: `src/scene/WorldSerializer.ts`
- Project system: `src/project/types.ts`
- Asset instances: `src/project/AssetInstanceManager.ts`
- Library assets: `src/library/types.ts`
