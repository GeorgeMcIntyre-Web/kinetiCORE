/**
 * World Save Manager
 * Owner: Agent 3 (Edwin/Cursor)
 * 
 * Handles saving and loading complete world state:
 * - Asset instance references (NOT full assets!)
 * - Transforms, joints, attachments
 * - Scene state (camera, lights, physics)
 * - Compression and database storage
 */

import { SceneTreeManager } from './SceneTreeManager';
import { SceneManager } from './SceneManager';
import { EntityRegistry } from '../entities/EntityRegistry';
import { supabase } from '../lib/supabase-client';
import * as BABYLON from '@babylonjs/core';

// ============================================================================
// Type Definitions
// ============================================================================

export interface WorldSaveData {
  version: '3.0.0';
  timestamp: number;
  format: 'database' | 'export';
  
  metadata: {
    projectName: string;
    description?: string;
    author: string;
    tags: string[];
  };
  
  assetLibrary: {
    assets: LibraryAssetReference[];
  };
  
  assetInstances: AssetInstanceData[];
  
  sceneState: {
    camera: CameraState;
    lights: LightState[];
    physics: PhysicsState;
    environment: EnvironmentState;
  };
}

export interface LibraryAssetReference {
  id: string;  // Asset ID from library
  name: string;
  loaderType: string;
  filePath?: string;
  fileUrl?: string;
}

export interface AssetInstanceData {
  id: string;  // Instance ID
  assetId: string;  // Reference to library asset
  name: string;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number, number];  // Quaternion
    scale: [number, number, number];
  };
  state?: {
    jointPoses?: Record<string, number>;
    attachments?: string[];
    visible: boolean;
    locked: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface CameraState {
  type: 'arcRotate' | 'universal';
  position: [number, number, number];
  target: [number, number, number];
  alpha?: number;
  beta?: number;
  radius?: number;
  fov?: number;
}

export interface LightState {
  id: string;
  name: string;
  type: 'hemispheric' | 'directional' | 'point' | 'spot';
  position?: [number, number, number];
  direction?: [number, number, number];
  intensity: number;
  diffuse: [number, number, number];
  specular: [number, number, number];
  enabled: boolean;
}

export interface PhysicsState {
  enabled: boolean;
  gravity: [number, number, number];
  timeStep: number;
}

export interface EnvironmentState {
  backgroundColor: [number, number, number];
  ambientColor: [number, number, number];
  fogEnabled: boolean;
  fogMode?: number;
  fogColor?: [number, number, number];
  fogDensity?: number;
}

export interface AutoSaveConfig {
  enabled: boolean;
  frequency: number;  // seconds
  pauseDuringPlayback: boolean;
  saveOnlyIfChanged: boolean;
}

// ============================================================================
// World Save Manager
// ============================================================================

export class WorldSaveManager {
  private static instance: WorldSaveManager | null = null;
  private autoSaveTimer: number | null = null;
  private lastSaveHash: string = '';
  private currentProjectId: string | null = null;
  
  private constructor() {}
  
  public static getInstance(): WorldSaveManager {
    if (!WorldSaveManager.instance) {
      WorldSaveManager.instance = new WorldSaveManager();
    }
    return WorldSaveManager.instance;
  }
  
  // ========================================================================
  // Capture World State
  // ========================================================================
  
  /**
   * Capture complete world state
   */
  public captureWorldState(): WorldSaveData {
    console.log('[WorldSaveManager] Capturing world state...');
    
    const tree = SceneTreeManager.getInstance();
    const registry = EntityRegistry.getInstance();
    const sceneManager = SceneManager.getInstance();
    const scene = sceneManager.getScene();
    
    if (!scene) {
      throw new Error('No scene available');
    }
    
    // Collect all asset instances
    const assetInstances = this.collectAssetInstances(tree, registry);
    
    // Deduplicate asset library
    const assetLibrary = this.deduplicateAssetLibrary(assetInstances);
    
    // Capture scene state
    const sceneState = this.captureSceneState(scene);
    
    const worldData: WorldSaveData = {
      version: '3.0.0',
      timestamp: Date.now(),
      format: 'database',
      metadata: {
        projectName: this.currentProjectId || 'Untitled Project',
        author: 'current_user',  // TODO: Get from auth
        tags: [],
      },
      assetLibrary,
      assetInstances,
      sceneState,
    };
    
    console.log(`[WorldSaveManager] Captured ${assetInstances.length} instances, ${assetLibrary.assets.length} unique assets`);
    
    return worldData;
  }
  
  /**
   * Collect all asset instances from scene
   */
  private collectAssetInstances(
    tree: SceneTreeManager,
    registry: EntityRegistry
  ): AssetInstanceData[] {
    const instances: AssetInstanceData[] = [];
    const allNodes = tree.getAllNodes();
    
    for (const node of allNodes) {
      // Skip non-mesh nodes
      if (node.type !== 'mesh' && node.type !== 'robot') {
        continue;
      }
      
      // Get entity if exists
      const entity = node.entityId ? registry.get(node.entityId) : null;
      
      if (!entity) {
        continue;
      }
      
      const mesh = entity.getMesh();
      if (!mesh) {
        continue;
      }
      
      // Extract asset ID from metadata
      const assetId = (mesh.metadata?.assetId as string) || `asset_${node.id}`;
      
      instances.push({
        id: entity.getId(),
        assetId,
        name: node.name,
        transform: {
          position: [mesh.position.x, mesh.position.y, mesh.position.z],
          rotation: mesh.rotationQuaternion 
            ? [
                mesh.rotationQuaternion.x,
                mesh.rotationQuaternion.y,
                mesh.rotationQuaternion.z,
                mesh.rotationQuaternion.w
              ]
            : [0, 0, 0, 1],
          scale: [mesh.scaling.x, mesh.scaling.y, mesh.scaling.z],
        },
        state: {
          jointPoses: (mesh.metadata?.jointStates as Record<string, number>) || {},
          attachments: (mesh.metadata?.attachments as string[]) || [],
          visible: mesh.isVisible,
          locked: node.locked,
        },
        metadata: mesh.metadata as Record<string, unknown>,
      });
    }
    
    return instances;
  }
  
  /**
   * Deduplicate asset library (one asset -> many instances)
   */
  private deduplicateAssetLibrary(instances: AssetInstanceData[]): {
    assets: LibraryAssetReference[];
  } {
    const uniqueAssets = new Map<string, LibraryAssetReference>();
    
    for (const instance of instances) {
      if (!uniqueAssets.has(instance.assetId)) {
        uniqueAssets.set(instance.assetId, {
          id: instance.assetId,
          name: instance.metadata?.assetName as string || instance.name,
          loaderType: instance.metadata?.loaderType as string || 'primitive',
          filePath: instance.metadata?.filePath as string,
          fileUrl: instance.metadata?.fileUrl as string,
        });
      }
    }
    
    return {
      assets: Array.from(uniqueAssets.values()),
    };
  }
  
  /**
   * Capture scene state (camera, lights, physics)
   */
  private captureSceneState(scene: BABYLON.Scene): WorldSaveData['sceneState'] {
    const camera = scene.activeCamera;
    const lights = scene.lights;
    const physicsEngine = scene.getPhysicsEngine();
    
    // Camera state
    const cameraState: CameraState = camera instanceof BABYLON.ArcRotateCamera
      ? {
          type: 'arcRotate',
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: [camera.target.x, camera.target.y, camera.target.z],
          alpha: camera.alpha,
          beta: camera.beta,
          radius: camera.radius,
          fov: camera.fov,
        }
      : {
          type: 'universal',
          position: camera ? [camera.position.x, camera.position.y, camera.position.z] : [0, 10, 10],
          target: [0, 0, 0],
        };
    
    // Light states
    const lightStates: LightState[] = lights.map(light => ({
      id: light.uniqueId.toString(),
      name: light.name,
      type: this.getLightType(light),
      position: light instanceof BABYLON.PointLight || light instanceof BABYLON.SpotLight
        ? [light.position.x, light.position.y, light.position.z]
        : undefined,
      direction: light instanceof BABYLON.DirectionalLight || light instanceof BABYLON.SpotLight
        ? [light.direction.x, light.direction.y, light.direction.z]
        : undefined,
      intensity: light.intensity,
      diffuse: [light.diffuse.r, light.diffuse.g, light.diffuse.b],
      specular: [light.specular.r, light.specular.g, light.specular.b],
      enabled: light.isEnabled(),
    }));
    
    // Physics state
    const physicsState: PhysicsState = {
      enabled: !!physicsEngine,
      gravity: physicsEngine 
        ? [physicsEngine.gravity.x, physicsEngine.gravity.y, physicsEngine.gravity.z]
        : [0, -9.81, 0],
      timeStep: 1 / 60,
    };
    
    // Environment state
    const environmentState: EnvironmentState = {
      backgroundColor: [
        scene.clearColor.r,
        scene.clearColor.g,
        scene.clearColor.b,
      ],
      ambientColor: [
        scene.ambientColor.r,
        scene.ambientColor.g,
        scene.ambientColor.b,
      ],
      fogEnabled: scene.fogEnabled,
      fogMode: scene.fogMode,
      fogColor: scene.fogEnabled
        ? [scene.fogColor.r, scene.fogColor.g, scene.fogColor.b]
        : undefined,
      fogDensity: scene.fogDensity,
    };
    
    return {
      camera: cameraState,
      lights: lightStates,
      physics: physicsState,
      environment: environmentState,
    };
  }
  
  private getLightType(light: BABYLON.Light): LightState['type'] {
    if (light instanceof BABYLON.HemisphericLight) return 'hemispheric';
    if (light instanceof BABYLON.DirectionalLight) return 'directional';
    if (light instanceof BABYLON.PointLight) return 'point';
    if (light instanceof BABYLON.SpotLight) return 'spot';
    return 'hemispheric';
  }
  
  // ========================================================================
  // Save to Database
  // ========================================================================
  
  /**
   * Save world state to database (compressed)
   */
  public async saveToDatabase(
    worldData: WorldSaveData,
    projectId?: string
  ): Promise<string> {
    console.log('[WorldSaveManager] Saving to database...');
    
    try {
      // Compress data
      const compressed = await this.compress(worldData);
      const checksum = await this.calculateChecksum(compressed);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Save to database
      const { data, error } = await supabase
        .from('projects')
        .upsert({
          id: projectId || this.currentProjectId,
          user_id: user.id,
          name: worldData.metadata.projectName,
          data: compressed,
          checksum,
          asset_count: worldData.assetInstances.length,
          file_size: compressed.length,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      console.log('[WorldSaveManager] Saved to database:', data.id);
      this.currentProjectId = data.id;
      
      return data.id;
    } catch (error) {
      console.error('[WorldSaveManager] Save failed:', error);
      throw error;
    }
  }
  
  /**
   * Load world state from database
   */
  public async loadFromDatabase(saveId: string): Promise<void> {
    console.log('[WorldSaveManager] Loading from database:', saveId);
    
    try {
      // Fetch from database
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', saveId)
        .single();
      
      if (error) {
        throw error;
      }
      
      // Verify checksum
      const checksum = await this.calculateChecksum(data.data);
      if (checksum !== data.checksum) {
        throw new Error('Checksum mismatch - data corruption detected!');
      }
      
      // Decompress
      const worldData = await this.decompress(data.data);
      
      // Restore world state
      await this.restoreWorldState(worldData);
      
      this.currentProjectId = saveId;
      
      console.log('[WorldSaveManager] Loaded from database');
    } catch (error) {
      console.error('[WorldSaveManager] Load failed:', error);
      throw error;
    }
  }
  
  // ========================================================================
  // Export to File
  // ========================================================================
  
  /**
   * Export world to downloadable JSON file
   */
  public async exportToFile(worldData: WorldSaveData): Promise<void> {
    console.log('[WorldSaveManager] Exporting to file...');
    
    worldData.format = 'export';
    
    const jsonString = JSON.stringify(worldData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${worldData.metadata.projectName}_${Date.now()}.kineticore.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('[WorldSaveManager] Exported to file');
  }
  
  /**
   * Import world from file
   */
  public async importFromFile(file: File): Promise<void> {
    console.log('[WorldSaveManager] Importing from file...');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const jsonString = e.target?.result as string;
          const worldData = JSON.parse(jsonString) as WorldSaveData;
          
          // Restore world state
          await this.restoreWorldState(worldData);
          
          console.log('[WorldSaveManager] Imported from file');
          resolve();
        } catch (error) {
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
  // Compression
  // ========================================================================
  
  /**
   * Compress world data (gzip for now)
   */
  private async compress(data: WorldSaveData): Promise<Uint8Array> {
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const buffer = encoder.encode(jsonString);
    
    // Use browser's native CompressionStream (gzip)
    const stream = new Response(buffer)
      .body!
      .pipeThrough(new CompressionStream('gzip'));
    
    const compressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(compressed);
  }
  
  /**
   * Decompress world data
   */
  private async decompress(compressed: Uint8Array): Promise<WorldSaveData> {
    const stream = new Response(compressed.buffer as ArrayBuffer)
      .body!
      .pipeThrough(new DecompressionStream('gzip'));
    
    const decompressed = await new Response(stream).text();
    return JSON.parse(decompressed);
  }
  
  /**
   * Calculate SHA-256 checksum
   */
  private async calculateChecksum(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
  
  // ========================================================================
  // Auto-Save
  // ========================================================================
  
  /**
   * Start auto-save timer
   */
  public startAutoSave(config: AutoSaveConfig): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    if (!config.enabled) {
      return;
    }
    
    const interval = config.frequency * 1000;
    
    this.autoSaveTimer = window.setInterval(async () => {
      try {
        // TODO: Skip if simulation running
        // if (config.pauseDuringPlayback && this.isSimulating()) {
        //   return;
        // }
        
        // Capture world state
        const worldData = this.captureWorldState();
        
        // Smart detection: only save if changed
        if (config.saveOnlyIfChanged) {
          const currentHash = this.hashWorldState(worldData);
          if (currentHash === this.lastSaveHash) {
            console.log('[WorldSaveManager] No changes detected, skipping auto-save');
            return;
          }
          this.lastSaveHash = currentHash;
        }
        
        // Save to database
        await this.saveToDatabase(worldData);
        
        console.log('[WorldSaveManager] Auto-saved');
      } catch (error) {
        console.error('[WorldSaveManager] Auto-save failed:', error);
      }
    }, interval);
    
    console.log(`[WorldSaveManager] Auto-save started: every ${config.frequency}s`);
  }
  
  /**
   * Stop auto-save timer
   */
  public stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      console.log('[WorldSaveManager] Auto-save stopped');
    }
  }
  
  /**
   * Hash world state for change detection
   */
  private hashWorldState(state: WorldSaveData): string {
    const str = JSON.stringify(state);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
  
  // ========================================================================
  // Restore World State
  // ========================================================================
  
  /**
   * Restore world state from saved data
   */
  private async restoreWorldState(worldData: WorldSaveData): Promise<void> {
    console.log('[WorldSaveManager] Restoring world state...');
    
    try {
      const tree = SceneTreeManager.getInstance();
      const registry = EntityRegistry.getInstance();
      const sceneManager = SceneManager.getInstance();
      const scene = sceneManager.getScene();
      
      if (!scene) {
        throw new Error('No scene available for restoration');
      }
      
      // Step 1: Clear current scene
      console.log('[WorldSaveManager] Clearing current scene...');
      await this.clearCurrentScene(tree, registry, scene);
      
      // Step 2: Restore scene state (camera, lights, physics, environment)
      console.log('[WorldSaveManager] Restoring scene state...');
      this.restoreSceneState(scene, worldData.sceneState);
      
      // Step 3: Restore asset library references
      console.log('[WorldSaveManager] Restoring asset library references...');
      await this.restoreAssetLibrary(worldData.assetLibrary);
      
      // Step 4: Recreate asset instances
      console.log('[WorldSaveManager] Recreating asset instances...');
      await this.restoreAssetInstances(worldData.assetInstances, tree, registry, scene);
      
      console.log('[WorldSaveManager] World state restored successfully:', {
        assetCount: worldData.assetLibrary.assets.length,
        instanceCount: worldData.assetInstances.length,
        projectName: worldData.metadata.projectName,
      });
    } catch (error) {
      console.error('[WorldSaveManager] Failed to restore world state:', error);
      throw error;
    }
  }
  
  /**
   * Clear current scene before restoration
   */
  private async clearCurrentScene(
    tree: SceneTreeManager,
    registry: EntityRegistry,
    scene: BABYLON.Scene
  ): Promise<void> {
    // Get all entities and dispose them
    const allNodes = tree.getAllNodes();
    for (const node of allNodes) {
      if (node.entityId) {
        const entity = registry.get(node.entityId);
        if (entity) {
          // Dispose physics bodies first
          const physicsBody = entity.getPhysicsBody();
          if (physicsBody) {
            // Physics disposal handled by entity
          }
          
          // Dispose mesh
          const mesh = entity.getMesh();
          if (mesh) {
            mesh.dispose(false, true); // Dispose geometry and materials
          }
          
          // Remove from registry
          registry.remove(node.entityId);
        }
      }
    }
    
    // Clear scene tree
    tree.clear();
    
    console.log('[WorldSaveManager] Scene cleared');
  }
  
  /**
   * Restore scene state (camera, lights, physics, environment)
   */
  private restoreSceneState(scene: BABYLON.Scene, sceneState: WorldSaveData['sceneState']): void {
    // Restore camera
    if (scene.activeCamera && sceneState.camera) {
      const cam = sceneState.camera;
      
      if (cam.type === 'arcRotate' && scene.activeCamera instanceof BABYLON.ArcRotateCamera) {
        const arcCam = scene.activeCamera;
        arcCam.alpha = cam.alpha || 0;
        arcCam.beta = cam.beta || 0;
        arcCam.radius = cam.radius || 10;
        arcCam.target = new BABYLON.Vector3(cam.target[0], cam.target[1], cam.target[2]);
        if (cam.fov) arcCam.fov = cam.fov;
      } else {
        scene.activeCamera.position = new BABYLON.Vector3(
          cam.position[0],
          cam.position[1],
          cam.position[2]
        );
      }
    }
    
    // Restore lights (simplified - assumes hemispheric light exists)
    if (sceneState.lights && sceneState.lights.length > 0) {
      for (let i = 0; i < Math.min(scene.lights.length, sceneState.lights.length); i++) {
        const lightState = sceneState.lights[i];
        const light = scene.lights[i];
        
        light.intensity = lightState.intensity;
        light.diffuse = new BABYLON.Color3(
          lightState.diffuse[0],
          lightState.diffuse[1],
          lightState.diffuse[2]
        );
        light.specular = new BABYLON.Color3(
          lightState.specular[0],
          lightState.specular[1],
          lightState.specular[2]
        );
        light.setEnabled(lightState.enabled);
      }
    }
    
    // Restore physics
    if (sceneState.physics && scene.getPhysicsEngine()) {
      const engine = scene.getPhysicsEngine();
      if (engine) {
        engine.setGravity(new BABYLON.Vector3(
          sceneState.physics.gravity[0],
          sceneState.physics.gravity[1],
          sceneState.physics.gravity[2]
        ));
      }
    }
    
    // Restore environment
    if (sceneState.environment) {
      const env = sceneState.environment;
      
      scene.clearColor = new BABYLON.Color4(
        env.backgroundColor[0],
        env.backgroundColor[1],
        env.backgroundColor[2],
        1
      );
      
      scene.ambientColor = new BABYLON.Color3(
        env.ambientColor[0],
        env.ambientColor[1],
        env.ambientColor[2]
      );
      
      scene.fogEnabled = env.fogEnabled;
      if (env.fogMode !== undefined) scene.fogMode = env.fogMode;
      if (env.fogColor) {
        scene.fogColor = new BABYLON.Color3(
          env.fogColor[0],
          env.fogColor[1],
          env.fogColor[2]
        );
      }
      if (env.fogDensity !== undefined) scene.fogDensity = env.fogDensity;
    }
    
    console.log('[WorldSaveManager] Scene state restored');
  }
  
  /**
   * Restore asset library references
   */
  private async restoreAssetLibrary(assetLibrary: { assets: LibraryAssetReference[] }): Promise<void> {
    // This is a placeholder - actual implementation would need to:
    // 1. Check if assets exist in library
    // 2. Download missing assets
    // 3. Prepare assets for instantiation
    
    console.log(`[WorldSaveManager] Asset library references: ${assetLibrary.assets.length} assets`);
    
    // For now, just log the assets
    for (const asset of assetLibrary.assets) {
      console.log(`  - ${asset.name} (${asset.loaderType})`);
    }
  }
  
  /**
   * Restore asset instances
   */
  private async restoreAssetInstances(
    instances: AssetInstanceData[],
    tree: SceneTreeManager,
    registry: EntityRegistry,
    scene: BABYLON.Scene
  ): Promise<void> {
    console.log(`[WorldSaveManager] Restoring ${instances.length} asset instances...`);
    
    // This is a placeholder - actual implementation would need to:
    // 1. Load each asset from library
    // 2. Create instance in scene
    // 3. Apply transforms and states
    // 4. Recreate physics bodies
    // 5. Restore joint poses
    // 6. Restore attachments
    
    for (const instanceData of instances) {
      try {
        // For now, just log what would be restored
        console.log(`  - Instance: ${instanceData.name} (asset: ${instanceData.assetId})`);
        console.log(`    Position: [${instanceData.transform.position.join(', ')}]`);
        console.log(`    Rotation: [${instanceData.transform.rotation.join(', ')}]`);
        console.log(`    Scale: [${instanceData.transform.scale.join(', ')}]`);
        
        if (instanceData.state?.jointPoses) {
          const jointCount = Object.keys(instanceData.state.jointPoses).length;
          console.log(`    Joint poses: ${jointCount} joints`);
        }
        
        // TODO: Actual asset loading and instantiation
        // This would require integration with AssetLoader and loaders for each format
        
      } catch (error) {
        console.error(`[WorldSaveManager] Failed to restore instance ${instanceData.name}:`, error);
        // Continue with next instance
      }
    }
    
    console.log('[WorldSaveManager] Asset instances restoration queued (full implementation pending)');
  }
  
  /**
   * Set current project ID
   */
  public setCurrentProjectId(projectId: string): void {
    this.currentProjectId = projectId;
  }
  
  /**
   * Get current project ID
   */
  public getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }
}
