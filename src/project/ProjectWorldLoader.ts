/**
 * Project World Loader - Simplified Version
 * Owner: George
 * 
 * Simplified version that works with existing APIs
 */

import { ProjectManager } from './ProjectManager';
import type {
  ProjectSave,
  SceneState,
  AssetInstance,
} from './types';

/**
 * Simplified Project World Loader
 */
export class ProjectWorldLoader {
  private static instance: ProjectWorldLoader | null = null;
  private projectManager: ProjectManager;

  private constructor() {
    // Lazy initialization to avoid circular dependency
    this.projectManager = null as any;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProjectWorldLoader {
    if (!ProjectWorldLoader.instance) {
      ProjectWorldLoader.instance = new ProjectWorldLoader();
    }
    return ProjectWorldLoader.instance;
  }

  /**
   * Get project manager with lazy initialization
   */
  private getProjectManager(): ProjectManager {
    if (!this.projectManager) {
      this.projectManager = ProjectManager.getInstance();
    }
    return this.projectManager;
  }

  /**
   * Load project save and restore world state
   */
  public async loadProjectSave(projectId: string, saveId: string): Promise<void> {
    try {
      console.log(`[ProjectWorldLoader] Loading project save: ${saveId} from project: ${projectId}`);
      
      const project = await this.getProjectManager().getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      
      const saves = await this.getProjectManager().listProjectSaves(projectId);
      const save = saves.find(s => s.id === saveId);
      if (!save) {
        throw new Error('Project save not found');
      }
      
      console.log(`[ProjectWorldLoader] Found save: ${save.name}, version: ${save.version}`);
      
      // Basic restoration - just restore asset instances for now
      await this.restoreAssetInstances([]);
      
      console.log(`[ProjectWorldLoader] Successfully loaded project save: ${save.name}`);
    } catch (error) {
      console.error('[ProjectWorldLoader] Failed to load project save:', error);
      throw error;
    }
  }

  /**
   * Export current world to project save
   */
  public async exportCurrentWorldToSave(projectId: string, saveName: string): Promise<ProjectSave> {
    try {
      console.log(`[ProjectWorldLoader] Exporting current world to save: ${saveName}`);
      
      // Create project save
      const save = await this.getProjectManager().saveProject(projectId, {
        name: saveName,
        description: 'Exported from current world state',
        isAutoSave: false,
        includeComments: false,
        includeAnnotations: false,
      });
      
      console.log(`[ProjectWorldLoader] Successfully exported world to save: ${save.name}`);
      return save;
    } catch (error) {
      console.error('[ProjectWorldLoader] Failed to export world to save:', error);
      throw error;
    }
  }

  /**
   * Restore asset instances (simplified)
   */
  private async restoreAssetInstances(instances: AssetInstance[]): Promise<void> {
    console.log(`[ProjectWorldLoader] Restoring ${instances.length} asset instances`);
    
    // For now, just log the instances
    // In a full implementation, this would restore them to the scene
    instances.forEach(instance => {
      console.log(`[ProjectWorldLoader] Instance: ${instance.name} at position (${instance.position.x}, ${instance.position.y}, ${instance.position.z})`);
    });
    
    // Trigger UI update
    setTimeout(() => {
      window.dispatchEvent(new Event('scenetree-update'));
    }, 100);
  }

  /**
   * Capture current scene state (simplified)
   */
  public async captureCurrentSceneState(): Promise<SceneState> {
    console.log('[ProjectWorldLoader] Capturing current scene state');
    
    // Return a basic scene state
    return {
      camera: {
        position: { x: 0, y: 10, z: 10 },
        target: { x: 0, y: 0, z: 0 },
        alpha: 0,
        beta: Math.PI / 4,
        radius: 10,
      },
      lighting: {
        ambientIntensity: 0.3,
        directionalLights: [],
        pointLights: [],
      },
      physics: {
        gravity: { x: 0, y: -9.81, z: 0 },
        enabled: true,
        timeStep: 1/60,
        entities: [],
      },
      kinematics: {
        chains: [],
        actuators: [],
      },
      environment: {
        backgroundColor: { x: 0.2, y: 0.2, z: 0.2 },
        fogEnabled: false,
        fogColor: { x: 0.5, y: 0.5, z: 0.5 },
        fogDensity: 0.1,
        groundColor: { x: 0.8, y: 0.8, z: 0.8 },
        groundEnabled: true,
        groundSize: 10,
      },
    };
  }

  /**
   * Capture current asset instances (simplified)
   */
  public async captureCurrentAssetInstances(): Promise<AssetInstance[]> {
    console.log('[ProjectWorldLoader] Capturing current asset instances');
    
    // Return empty array for now
    // In a full implementation, this would scan the scene for asset instances
    return [];
  }
}