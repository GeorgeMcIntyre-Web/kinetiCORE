/**
 * Migration Tool for Existing Saves
 * Owner: George
 * 
 * Converts existing .kicore files and comprehensive world saves to Project Manager format
 */

import { ProjectManager } from './ProjectManager';
import { ProjectWorldLoader } from './ProjectWorldLoader';
import type { Project, AssetInstance, CreateProjectConfig } from './types';

/**
 * Migration Tool for converting existing saves to projects
 */
export class MigrationTool {
  private static instance: MigrationTool | null = null;
  private projectManager: ProjectManager;
  private worldLoader: ProjectWorldLoader;

  private constructor() {
    this.projectManager = ProjectManager.getInstance();
    this.worldLoader = ProjectWorldLoader.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MigrationTool {
    if (!MigrationTool.instance) {
      MigrationTool.instance = new MigrationTool();
    }
    return MigrationTool.instance;
  }

  /**
   * Migrate .kicore file to project
   */
  public async migrateKicoreFile(
    file: File,
    projectConfig: CreateProjectConfig
  ): Promise<Project> {
    try {
      console.log(`[MigrationTool] Starting migration of ${file.name} to project`);

      // Create new project
      const project = await this.projectManager.createProject(projectConfig);
      console.log(`[MigrationTool] Created project: ${project.name}`);

      // Load the .kicore file
      const kicoreData = await this.loadKicoreFile(file);
      if (!kicoreData) {
        throw new Error('Failed to load .kicore file');
      }

      // Convert to asset instances
      const instances = await this.convertKicoreToInstances(kicoreData);
      console.log(`[MigrationTool] Converted ${instances.length} objects to asset instances`);

      // Add instances to project
      for (const instance of instances) {
        await this.projectManager.addAssetInstance(project.id, instance);
      }

      // Create initial save
      await this.projectManager.saveProject(project.id, {
        name: 'Migrated from ' + file.name,
        description: `Migrated from existing .kicore file: ${file.name}`,
        isAutoSave: false,
        includeComments: false,
        includeAnnotations: false,
      });

      console.log(`[MigrationTool] Migration completed successfully: ${project.name}`);
      return project;
    } catch (error) {
      console.error('[MigrationTool] Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate comprehensive world file to project
   */
  public async migrateComprehensiveWorldFile(
    file: File,
    projectConfig: CreateProjectConfig
  ): Promise<Project> {
    try {
      console.log(`[MigrationTool] Starting migration of comprehensive world: ${file.name}`);

      // Create new project
      const project = await this.projectManager.createProject(projectConfig);
      console.log(`[MigrationTool] Created project: ${project.name}`);

      // Load the comprehensive world file
      const worldData = await this.loadComprehensiveWorldFile(file);
      if (!worldData) {
        throw new Error('Failed to load comprehensive world file');
      }

      // Convert to asset instances
      const instances = await this.convertComprehensiveWorldToInstances(worldData);
      console.log(`[MigrationTool] Converted ${instances.length} objects to asset instances`);

      // Add instances to project
      for (const instance of instances) {
        await this.projectManager.addAssetInstance(project.id, instance);
      }

      // Create initial save with comprehensive data
      await this.projectManager.saveProject(project.id, {
        name: 'Migrated from ' + file.name,
        description: `Migrated from comprehensive world file: ${file.name}`,
        isAutoSave: false,
        includeComments: false,
        includeAnnotations: false,
      });

      console.log(`[MigrationTool] Comprehensive migration completed: ${project.name}`);
      return project;
    } catch (error) {
      console.error('[MigrationTool] Comprehensive migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate current world state to project
   */
  public async migrateCurrentWorldToProject(
    projectConfig: CreateProjectConfig
  ): Promise<Project> {
    try {
      console.log(`[MigrationTool] Starting migration of current world state`);

      // Create new project
      const project = await this.projectManager.createProject(projectConfig);
      console.log(`[MigrationTool] Created project: ${project.name}`);

      // Export current world to project save
      await this.worldLoader.exportCurrentWorldToSave(
        project.id,
        'Initial Migration'
      );

      console.log(`[MigrationTool] Current world migration completed: ${project.name}`);
      return project;
    } catch (error) {
      console.error('[MigrationTool] Current world migration failed:', error);
      throw error;
    }
  }

  /**
   * Batch migrate multiple files
   */
  public async batchMigrateFiles(
    files: File[],
    baseProjectConfig: Omit<CreateProjectConfig, 'name'>
  ): Promise<Project[]> {
    const projects: Project[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const projectName = this.generateProjectName(file.name, i);
      
      try {
        const projectConfig: CreateProjectConfig = {
          ...baseProjectConfig,
          name: projectName,
        };

        let project: Project;
        
        if (file.name.toLowerCase().endsWith('.json')) {
          // Try to determine if it's comprehensive or regular
          const isComprehensive = await this.isComprehensiveFile(file);
          if (isComprehensive) {
            project = await this.migrateComprehensiveWorldFile(file, projectConfig);
          } else {
            project = await this.migrateKicoreFile(file, projectConfig);
          }
        } else {
          // Default to kicore migration
          project = await this.migrateKicoreFile(file, projectConfig);
        }

        projects.push(project);
        console.log(`[MigrationTool] Migrated ${i + 1}/${files.length}: ${file.name}`);
      } catch (error) {
        console.error(`[MigrationTool] Failed to migrate ${file.name}:`, error);
        // Continue with other files
      }
    }

    console.log(`[MigrationTool] Batch migration completed: ${projects.length}/${files.length} successful`);
    return projects;
  }

  /**
   * Load .kicore file
   */
  private async loadKicoreFile(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse .kicore file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Load comprehensive world file
   */
  private async loadComprehensiveWorldFile(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          resolve(data);
        } catch (error) {
          reject(new Error('Failed to parse comprehensive world file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Check if file is comprehensive format
   */
  private async isComprehensiveFile(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          resolve(data.format === 'comprehensive');
        } catch (error) {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.readAsText(file.slice(0, 1024)); // Read only first 1KB
    });
  }

  /**
   * Convert .kicore data to asset instances
   */
  private async convertKicoreToInstances(kicoreData: any): Promise<AssetInstance[]> {
    const instances: AssetInstance[] = [];

    if (!kicoreData.tree || !kicoreData.tree.nodes) {
      console.warn('[MigrationTool] No tree data found in .kicore file');
      return instances;
    }

    for (const node of kicoreData.tree.nodes) {
      if (node.type === 'world' || node.type === 'scene' || node.type === 'system') {
        continue; // Skip system nodes
      }

      const instance: AssetInstance = {
        id: this.generateInstanceId(node.id || node.name),
        assetId: this.generateAssetId(node), // Generate asset ID based on node data
        name: node.name || 'Migrated Object',
        position: node.position || { x: 0, y: 0, z: 0 },
        rotation: node.rotation || { x: 0, y: 0, z: 0, w: 1 },
        scale: node.scale || { x: 1, y: 1, z: 1 },
        jointStates: node.jointData ? { [node.jointData.name]: node.jointData.position } : {},
        attachments: [],
        customProperties: {
          ...node.customProperties,
          migratedFrom: 'kicore',
          originalNodeId: node.id,
          originalType: node.type,
        },
        isVisible: node.isVisible !== false,
        isLocked: false,
        createdAt: new Date(),
        createdBy: 'migration_tool',
      };

      instances.push(instance);
    }

    return instances;
  }

  /**
   * Convert comprehensive world data to asset instances
   */
  private async convertComprehensiveWorldToInstances(worldData: any): Promise<AssetInstance[]> {
    const instances: AssetInstance[] = [];

    if (!worldData.tree || !worldData.tree.nodes) {
      console.warn('[MigrationTool] No tree data found in comprehensive world file');
      return instances;
    }

    for (const node of worldData.tree.nodes) {
      if (node.type === 'world' || node.type === 'scene' || node.type === 'system') {
        continue; // Skip system nodes
      }

      const instance: AssetInstance = {
        id: this.generateInstanceId(node.id || node.name),
        assetId: this.generateAssetId(node),
        name: node.name || 'Migrated Object',
        position: node.position || { x: 0, y: 0, z: 0 },
        rotation: node.rotation || { x: 0, y: 0, z: 0, w: 1 },
        scale: node.scale || { x: 1, y: 1, z: 1 },
        jointStates: node.jointData ? { [node.jointData.name]: node.jointData.position } : {},
        attachments: [],
        customProperties: {
          ...node.customProperties,
          migratedFrom: 'comprehensive',
          originalNodeId: node.id,
          originalType: node.type,
          hasMeshData: !!worldData.assets?.meshes?.find((m: any) => m.name === node.name),
        },
        isVisible: node.isVisible !== false,
        isLocked: false,
        createdAt: new Date(),
        createdBy: 'migration_tool',
      };

      instances.push(instance);
    }

    return instances;
  }

  /**
   * Generate project name from filename
   */
  private generateProjectName(filename: string, index: number): string {
    const baseName = filename.replace(/\.[^/.]+$/, ''); // Remove extension
    const cleanName = baseName.replace(/[^a-zA-Z0-9\s-_]/g, ''); // Remove special chars
    return cleanName || `Migrated Project ${index + 1}`;
  }

  /**
   * Generate instance ID
   */
  private generateInstanceId(originalId: string): string {
    return `inst_${originalId}_${Date.now()}`;
  }

  /**
   * Generate asset ID based on node data
   */
  private generateAssetId(node: any): string {
    // For migrated objects, create a synthetic asset ID
    // In a real implementation, this would reference actual assets in the library
    const type = node.type || 'unknown';
    const name = node.name || 'object';
    return `asset_${type}_${name}_${Date.now()}`;
  }

  /**
   * Get migration statistics
   */
  public getMigrationStats(): {
    totalProjects: number;
    totalSaves: number;
    totalInstances: number;
  } {
    // This would be implemented to track migration statistics
    return {
      totalProjects: 0,
      totalSaves: 0,
      totalInstances: 0,
    };
  }

  /**
   * Cleanup migration tool
   */
  public async cleanup(): Promise<void> {
    console.log('[MigrationTool] Cleanup completed');
  }
}
