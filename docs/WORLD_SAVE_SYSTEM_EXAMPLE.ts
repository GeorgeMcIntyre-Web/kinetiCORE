/**
 * World Save System - Example Implementation
 * Agent 3 (Cursor) - Edwin
 * 
 * This is a reference implementation showing how the proposed save system would work
 */

import pako from 'pako';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Type Definitions (v3.0.0)
// ============================================================================

interface WorldSaveData {
  version: string; // "3.0.0"
  format: 'export' | 'database';
  timestamp: number;
  
  metadata: WorldMetadata;
  assetLibrary: AssetLibrary;
  assetInstances: AssetInstance[];
  sceneState: SceneState;
  externalAssets?: ExternalAssets;
  babylonScene?: any; // Optional - for visual fidelity
}

interface WorldMetadata {
  sceneName: string;
  description?: string;
  tags: string[];
  author: string;
  customProperties: Record<string, unknown>;
}

interface AssetLibrary {
  assets: LibraryAssetReference[];
}

interface LibraryAssetReference {
  id: string; // "lib_asset_kr270"
  name: string;
  loaderType: 'urdf' | 'glb' | 'jt' | 'mjcf' | 'usd';
  filePath: string;
  version: string;
  checksum: string;
  metadata: AssetCapabilities;
}

interface AssetCapabilities {
  manufacturer?: string;
  modelNumber?: string;
  dof?: number;
  payload?: number;
  reach?: number;
  [key: string]: any;
}

interface AssetInstance {
  id: string; // "inst_001"
  assetId: string; // Reference to library asset
  name: string;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  jointStates: Record<string, number>;
  attachments: Attachment[];
  customProperties: Record<string, unknown>;
  isVisible: boolean;
  isLocked: boolean;
}

interface Attachment {
  id: string;
  type: 'mechanical' | 'electrical' | 'pneumatic' | 'logical' | 'custom';
  targetInstanceId: string;
  sourceInstanceId?: string;
  connectionPoint: Vector3;
  connectionType: 'fixed' | 'hinge' | 'slider' | 'ball' | 'universal' | 'custom';
  name?: string;
  description?: string;
  customProperties: Record<string, unknown>;
}

interface SceneState {
  camera: CameraState;
  lighting: LightingState;
  physics: PhysicsState;
  kinematics: KinematicsState;
  environment: EnvironmentState;
}

interface CameraState {
  position: Vector3;
  target: Vector3;
  alpha: number;
  beta: number;
  radius: number;
}

interface LightingState {
  ambientIntensity: number;
  directionalLights: DirectionalLight[];
  pointLights: PointLight[];
}

interface DirectionalLight {
  id: string;
  direction: Vector3;
  intensity: number;
  color: Vector3;
  enabled: boolean;
}

interface PointLight {
  id: string;
  position: Vector3;
  intensity: number;
  color: Vector3;
  range: number;
  enabled: boolean;
}

interface PhysicsState {
  enabled: boolean;
  gravity: Vector3;
  timeStep: number;
  entities: PhysicsEntityState[];
}

interface PhysicsEntityState {
  instanceId: string;
  bodyType: 'static' | 'dynamic' | 'kinematic';
  mass: number;
  friction: number;
  restitution: number;
  linearVelocity: Vector3;
  angularVelocity: Vector3;
}

interface KinematicsState {
  chains: KinematicChain[];
  actuators: ActuatorState[];
}

interface KinematicChain {
  id: string;
  name: string;
  instanceId: string; // Which asset instance this chain belongs to
  joints: JointState[];
  isActive: boolean;
}

interface JointState {
  id: string;
  name: string;
  type: 'revolute' | 'prismatic' | 'fixed' | 'spherical' | 'cylindrical';
  position: number;
  velocity: number;
  effort: number;
  limits: JointLimits;
}

interface JointLimits {
  lower: number;
  upper: number;
  effort: number;
  velocity: number;
}

interface ActuatorState {
  id: string;
  name: string;
  type: 'servo' | 'stepper' | 'hydraulic' | 'pneumatic';
  position: number;
  velocity: number;
  effort: number;
  enabled: boolean;
}

interface EnvironmentState {
  backgroundColor: Vector3;
  fogEnabled: boolean;
  fogDensity: number;
  fogColor: Vector3;
  groundEnabled: boolean;
  groundSize: number;
  groundColor: Vector3;
}

interface ExternalAssets {
  meshes: ExternalMesh[];
  textures: ExternalTexture[];
}

interface ExternalMesh {
  id: string;
  assetId: string; // Which library asset this belongs to
  path: string;
  size: number;
  checksum: string;
  embedding: 'reference' | 'inline' | 'cdn';
  url?: string; // For CDN
  data?: string; // For inline base64
}

interface ExternalTexture {
  id: string;
  path: string;
  size: number;
  checksum: string;
  embedding: 'reference' | 'inline' | 'cdn';
  url?: string;
  data?: string;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

// ============================================================================
// World Save Manager
// ============================================================================

export class WorldSaveManager {
  private static instance: WorldSaveManager;
  private supabase: any;
  
  private constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
  }
  
  public static getInstance(): WorldSaveManager {
    if (!WorldSaveManager.instance) {
      WorldSaveManager.instance = new WorldSaveManager();
    }
    return WorldSaveManager.instance;
  }
  
  // ========================================================================
  // File Export/Import
  // ========================================================================
  
  /**
   * Export world to downloadable JSON file
   */
  async exportWorldToFile(
    sceneName: string,
    options?: {
      includeExternalAssets?: boolean;
      includeBabylonScene?: boolean;
    }
  ): Promise<void> {
    console.log('🔄 Starting world export to file...');
    
    // 1. Collect all data
    const worldData = await this.captureWorldData('export', sceneName, options);
    
    // 2. Validate
    const validation = this.validateWorldData(worldData);
    if (!validation.isValid) {
      throw new Error(`World validation failed: ${validation.errors.join(', ')}`);
    }
    
    // 3. Serialize to JSON
    const jsonString = JSON.stringify(worldData, null, 2);
    
    // 4. Create download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kineticore_${sceneName}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`✅ World exported: ${jsonString.length} bytes`);
  }
  
  /**
   * Import world from JSON file
   */
  async importWorldFromFile(file: File): Promise<void> {
    console.log('🔄 Starting world import from file...');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const jsonString = e.target?.result as string;
          const worldData = JSON.parse(jsonString) as WorldSaveData;
          
          // Validate
          const validation = this.validateWorldData(worldData);
          if (!validation.isValid) {
            throw new Error(`Invalid world data: ${validation.errors.join(', ')}`);
          }
          
          // Migrate if needed
          const migratedData = await this.migrateWorldData(worldData);
          
          // Restore world
          await this.restoreWorldData(migratedData);
          
          console.log('✅ World imported successfully');
          resolve();
        } catch (error) {
          console.error('Failed to import world:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }
  
  // ========================================================================
  // Database Save/Load (Compressed)
  // ========================================================================
  
  /**
   * Save world to database (compressed)
   */
  async saveWorldToDatabase(
    projectId: string,
    saveName: string,
    description?: string,
    isAutoSave: boolean = false
  ): Promise<string> {
    console.log('🔄 Starting world save to database...');
    
    // 1. Capture world data
    const worldData = await this.captureWorldData('database', saveName, {
      includeExternalAssets: true,
      includeBabylonScene: false // Too large for auto-saves
    });
    
    // 2. Serialize to JSON
    const jsonString = JSON.stringify(worldData);
    
    // 3. Compress
    const compressed = pako.gzip(jsonString);
    
    // 4. Calculate checksum
    const checksum = await this.calculateChecksum(compressed);
    
    // 5. Upload external assets to CDN (if any)
    if (worldData.externalAssets) {
      await this.uploadExternalAssets(worldData.externalAssets);
    }
    
    // 6. Save to database
    const { data, error } = await this.supabase
      .from('project_saves')
      .insert({
        project_id: projectId,
        name: saveName,
        description,
        world_data: compressed,
        world_data_hash: checksum,
        file_size: compressed.length,
        asset_instance_count: worldData.assetInstances.length,
        is_auto_save: isAutoSave,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to save to database: ${error.message}`);
    }
    
    // 7. Save asset instance metadata (for querying without decompression)
    await this.saveAssetInstanceMetadata(data.id, worldData.assetInstances);
    
    console.log(`✅ World saved to database: ${compressed.length} bytes (${Math.round(compressed.length / jsonString.length * 100)}% compression)`);
    
    return data.id;
  }
  
  /**
   * Load world from database
   */
  async loadWorldFromDatabase(saveId: string): Promise<void> {
    console.log('🔄 Starting world load from database...');
    
    // 1. Fetch compressed data
    const { data, error } = await this.supabase
      .from('project_saves')
      .select('world_data, world_data_hash')
      .eq('id', saveId)
      .single();
    
    if (error) {
      throw new Error(`Failed to load from database: ${error.message}`);
    }
    
    // 2. Verify checksum
    const checksum = await this.calculateChecksum(data.world_data);
    if (checksum !== data.world_data_hash) {
      throw new Error('Checksum mismatch - data corruption detected!');
    }
    
    // 3. Decompress
    const jsonString = pako.ungzip(data.world_data, { to: 'string' });
    
    // 4. Parse JSON
    const worldData = JSON.parse(jsonString) as WorldSaveData;
    
    // 5. Migrate if needed
    const migratedData = await this.migrateWorldData(worldData);
    
    // 6. Restore world
    await this.restoreWorldData(migratedData);
    
    console.log('✅ World loaded from database');
  }
  
  // ========================================================================
  // Core Serialization
  // ========================================================================
  
  /**
   * Capture complete world data
   */
  private async captureWorldData(
    format: 'export' | 'database',
    sceneName: string,
    options?: {
      includeExternalAssets?: boolean;
      includeBabylonScene?: boolean;
    }
  ): Promise<WorldSaveData> {
    const worldData: WorldSaveData = {
      version: '3.0.0',
      format,
      timestamp: Date.now(),
      
      metadata: await this.captureMetadata(sceneName),
      assetLibrary: await this.captureAssetLibrary(),
      assetInstances: await this.captureAssetInstances(),
      sceneState: await this.captureSceneState(),
    };
    
    // Optional: Include external assets
    if (options?.includeExternalAssets) {
      worldData.externalAssets = await this.captureExternalAssets();
    }
    
    // Optional: Include full Babylon scene
    if (options?.includeBabylonScene) {
      worldData.babylonScene = await this.captureBabylonScene();
    }
    
    return worldData;
  }
  
  /**
   * Capture metadata
   */
  private async captureMetadata(sceneName: string): Promise<WorldMetadata> {
    // TODO: Get from EditorStore or SceneManager
    return {
      sceneName,
      description: '',
      tags: [],
      author: 'current_user', // TODO: Get from auth
      customProperties: {}
    };
  }
  
  /**
   * Capture asset library (deduplicated)
   */
  private async captureAssetLibrary(): Promise<AssetLibrary> {
    // TODO: Get all unique library assets used in scene
    // This requires tracking which assets are instantiated
    
    const usedAssetIds = new Set<string>();
    const assets: LibraryAssetReference[] = [];
    
    // Collect unique asset IDs from scene
    // For each unique asset, fetch from library and add to list
    
    return { assets };
  }
  
  /**
   * Capture all asset instances
   */
  private async captureAssetInstances(): Promise<AssetInstance[]> {
    // TODO: Get from AssetInstanceManager or SceneTreeManager
    // Convert Babylon meshes to AssetInstance format
    
    const instances: AssetInstance[] = [];
    
    // Example:
    // const allEntities = EntityRegistry.getInstance().getAll();
    // for (const entity of allEntities) {
    //   const instance = this.entityToAssetInstance(entity);
    //   instances.push(instance);
    // }
    
    return instances;
  }
  
  /**
   * Capture complete scene state
   */
  private async captureSceneState(): Promise<SceneState> {
    // TODO: Integrate with SceneManager, PhysicsEngine, KinematicsManager
    
    return {
      camera: {
        position: { x: 10, y: 10, z: 10 },
        target: { x: 0, y: 0, z: 0 },
        alpha: 0.785,
        beta: 0.785,
        radius: 17.32
      },
      lighting: {
        ambientIntensity: 0.5,
        directionalLights: [],
        pointLights: []
      },
      physics: {
        enabled: true,
        gravity: { x: 0, y: 0, z: -9.81 },
        timeStep: 0.016,
        entities: []
      },
      kinematics: {
        chains: [],
        actuators: []
      },
      environment: {
        backgroundColor: { x: 0.2, y: 0.2, z: 0.25 },
        fogEnabled: false,
        fogDensity: 0.01,
        fogColor: { x: 0.5, y: 0.5, z: 0.5 },
        groundEnabled: true,
        groundSize: 20,
        groundColor: { x: 0.3, y: 0.3, z: 0.3 }
      }
    };
  }
  
  /**
   * Capture external assets (meshes, textures)
   */
  private async captureExternalAssets(): Promise<ExternalAssets> {
    // TODO: Collect all external mesh/texture files
    return {
      meshes: [],
      textures: []
    };
  }
  
  /**
   * Capture Babylon scene
   */
  private async captureBabylonScene(): Promise<any> {
    // TODO: Use Babylon SceneSerializer
    return {};
  }
  
  // ========================================================================
  // Core Restoration
  // ========================================================================
  
  /**
   * Restore complete world data
   */
  private async restoreWorldData(worldData: WorldSaveData): Promise<void> {
    console.log('🔄 Restoring world data...');
    
    // 1. Clear current scene
    await this.clearScene();
    
    // 2. Restore asset library references
    await this.restoreAssetLibrary(worldData.assetLibrary);
    
    // 3. Restore asset instances
    await this.restoreAssetInstances(worldData.assetInstances);
    
    // 4. Restore scene state
    await this.restoreSceneState(worldData.sceneState);
    
    // 5. Restore external assets if present
    if (worldData.externalAssets) {
      await this.restoreExternalAssets(worldData.externalAssets);
    }
    
    // 6. Restore Babylon scene if present
    if (worldData.babylonScene) {
      await this.restoreBabylonScene(worldData.babylonScene);
    }
    
    console.log('✅ World restored');
  }
  
  private async clearScene(): Promise<void> {
    // TODO: Clear all meshes, entities, etc.
  }
  
  private async restoreAssetLibrary(library: AssetLibrary): Promise<void> {
    // TODO: Load library assets into memory
    // Store mapping of assetId -> LibraryAsset for instance restoration
  }
  
  private async restoreAssetInstances(instances: AssetInstance[]): Promise<void> {
    // TODO: For each instance:
    // 1. Lookup library asset by assetId
    // 2. Load asset (URDF/GLB/JT/etc.)
    // 3. Create instance with correct transform
    // 4. Apply joint states
    // 5. Create attachments
  }
  
  private async restoreSceneState(state: SceneState): Promise<void> {
    // TODO: Restore camera, lighting, physics, kinematics, environment
  }
  
  private async restoreExternalAssets(assets: ExternalAssets): Promise<void> {
    // TODO: Download/load mesh and texture files
  }
  
  private async restoreBabylonScene(scene: any): Promise<void> {
    // TODO: Use Babylon SceneLoader
  }
  
  // ========================================================================
  // Utilities
  // ========================================================================
  
  /**
   * Validate world data
   */
  private validateWorldData(data: WorldSaveData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Check version
    if (!data.version) {
      errors.push('Missing version field');
    }
    
    // Check format
    if (!data.format || (data.format !== 'export' && data.format !== 'database')) {
      errors.push('Invalid format field');
    }
    
    // Check metadata
    if (!data.metadata || !data.metadata.sceneName) {
      errors.push('Missing metadata.sceneName');
    }
    
    // Check asset library
    if (!data.assetLibrary || !Array.isArray(data.assetLibrary.assets)) {
      errors.push('Invalid assetLibrary structure');
    }
    
    // Check asset instances
    if (!Array.isArray(data.assetInstances)) {
      errors.push('assetInstances must be an array');
    }
    
    // Validate each instance references a library asset
    const assetIds = new Set(data.assetLibrary.assets.map(a => a.id));
    for (const instance of data.assetInstances) {
      if (!assetIds.has(instance.assetId)) {
        errors.push(`Instance ${instance.id} references non-existent asset ${instance.assetId}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Migrate world data to current version
   */
  private async migrateWorldData(data: WorldSaveData): Promise<WorldSaveData> {
    const currentVersion = data.version;
    
    if (currentVersion === '3.0.0') {
      return data; // Already current version
    }
    
    // TODO: Implement migration chain
    // if (currentVersion === '1.0.0') {
    //   data = migrateV1toV2(data);
    // }
    // if (currentVersion === '2.0.0') {
    //   data = migrateV2toV3(data);
    // }
    
    return data;
  }
  
  /**
   * Calculate SHA-256 checksum
   */
  private async calculateChecksum(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
  
  /**
   * Upload external assets to CDN
   */
  private async uploadExternalAssets(assets: ExternalAssets): Promise<void> {
    // TODO: Upload meshes and textures to Cloudflare R2 or similar
  }
  
  /**
   * Save asset instance metadata (for querying)
   */
  private async saveAssetInstanceMetadata(
    saveId: string,
    instances: AssetInstance[]
  ): Promise<void> {
    const metadata = instances.map(inst => ({
      project_save_id: saveId,
      asset_id: inst.assetId,
      instance_id: inst.id,
      name: inst.name,
      position: inst.position,
      rotation: inst.rotation,
      joint_states: inst.jointStates
    }));
    
    await this.supabase
      .from('project_asset_instances')
      .insert(metadata);
  }
}

// ============================================================================
// Example Usage
// ============================================================================

async function exampleUsage() {
  const saveManager = WorldSaveManager.getInstance();
  
  // Export to file
  await saveManager.exportWorldToFile('Factory_Layout_v1', {
    includeExternalAssets: true,
    includeBabylonScene: false
  });
  
  // Save to database (compressed)
  const saveId = await saveManager.saveWorldToDatabase(
    'project_123',
    'Checkpoint 1',
    'Before adding second robot',
    false // Not auto-save
  );
  
  // Load from database
  await saveManager.loadWorldFromDatabase(saveId);
  
  // Import from file
  const file = new File([], 'world.json'); // User-selected file
  await saveManager.importWorldFromFile(file);
}
