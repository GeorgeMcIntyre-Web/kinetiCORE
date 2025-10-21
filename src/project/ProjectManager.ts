/**
 * Project Manager
 * Owner: George
 * 
 * Central manager for project operations, asset instance management,
 * and collaboration features
 */

import type {
  Project,
  ProjectSave,
  AssetInstance,
  CollaborationSession,
  Comment,
  Annotation,
  Change,
  ProjectManager as IProjectManager,
  CreateProjectConfig,
  AddAssetInstanceConfig,
  SaveProjectConfig,
  ProjectFilters,
  TeamMember,
  LockType,
  ActiveUser,
} from './types';

import { ProjectDatabase } from './ProjectDatabase';
import { AssetInstanceManager } from './AssetInstanceManager';
import { CollaborationManager } from './CollaborationManager';
import { IProjectWorldLoader } from './IProjectWorldLoader';
import { DIContainer } from '../core/DIContainer';

/**
 * Main Project Manager implementation
 */
export class ProjectManager implements IProjectManager {
  private static instance: ProjectManager | null = null;
  private projectDatabase: ProjectDatabase;
  private assetInstanceManager: AssetInstanceManager;
  private collaborationManager: CollaborationManager;
  private diContainer: DIContainer;
  private currentProject: Project | null = null;
  private currentUserId: string = 'current_user'; // TODO: Get from auth system

  private constructor() {
    this.projectDatabase = ProjectDatabase.getInstance();
    this.assetInstanceManager = AssetInstanceManager.getInstance();
    this.collaborationManager = CollaborationManager.getInstance();
    this.diContainer = DIContainer.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProjectManager {
    if (!ProjectManager.instance) {
      ProjectManager.instance = new ProjectManager();
    }
    return ProjectManager.instance;
  }

  /**
   * Get world loader with dependency injection
   */
  private getWorldLoader(): IProjectWorldLoader {
    return this.diContainer.get<IProjectWorldLoader>('ProjectWorldLoader');
  }

  /**
   * Initialize the project manager
   */
  public async initialize(): Promise<void> {
    await this.projectDatabase.initialize();
    await this.assetInstanceManager.initialize();
    await this.collaborationManager.initialize();
    console.log('[ProjectManager] Initialized successfully');
  }

  // ============================================================================
  // Project CRUD Operations
  // ============================================================================

  /**
   * Create new project
   */
  public async createProject(config: CreateProjectConfig): Promise<Project> {
    const project = await this.projectDatabase.createProject(config);
    
    // Initialize collaboration session
    await this.collaborationManager.createSession(project.id);
    
    console.log(`[ProjectManager] Created project: ${project.name} (${project.id})`);
    return project;
  }

  /**
   * Get project by ID
   */
  public async getProject(projectId: string): Promise<Project | null> {
    return await this.projectDatabase.getProject(projectId);
  }

  /**
   * Update project
   */
  public async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    await this.projectDatabase.updateProject(projectId, updates);
    
    // Update current project if it's the one being updated
    if (this.currentProject?.id === projectId) {
      this.currentProject = { ...this.currentProject, ...updates };
    }
    
    console.log(`[ProjectManager] Updated project: ${projectId}`);
  }

  /**
   * Delete project
   */
  public async deleteProject(projectId: string): Promise<void> {
    // Clean up collaboration session
    await this.collaborationManager.endSession(projectId);
    
    // Delete project and all related data
    await this.projectDatabase.deleteProject(projectId);
    
    // Clear current project if it's the one being deleted
    if (this.currentProject?.id === projectId) {
      this.currentProject = null;
    }
    
    console.log(`[ProjectManager] Deleted project: ${projectId}`);
  }

  /**
   * Duplicate project
   */
  public async duplicateProject(projectId: string, newName?: string): Promise<Project> {
    const originalProject = await this.getProject(projectId);
    if (!originalProject) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Create new project with duplicated data
    const duplicatedProject: Project = {
      ...originalProject,
      id: crypto.randomUUID(),
      name: newName || `${originalProject.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft', // Reset status to draft for new copy
      assetInstances: [...originalProject.assetInstances], // Deep copy asset instances
    };

    // Update asset instance IDs to avoid conflicts
    duplicatedProject.assetInstances = duplicatedProject.assetInstances.map(instance => ({
      ...instance,
      id: crypto.randomUUID(),
    }));

    // Save the duplicated project
    await this.projectDatabase.createProject(duplicatedProject);

    // Duplicate all project saves
    const originalSaves = await this.listProjectSaves(projectId);
    for (const save of originalSaves) {
      const duplicatedSave: ProjectSave = {
        ...save,
        id: crypto.randomUUID(),
        projectId: duplicatedProject.id,
        createdAt: new Date(),
        name: `${save.name} (Copy)`,
      };
      await this.projectDatabase.createProjectSave(duplicatedSave);
    }

    console.log(`[ProjectManager] Duplicated project: ${projectId} -> ${duplicatedProject.id}`);
    return duplicatedProject;
  }

  /**
   * Export project to JSON file
   */
  public async exportProject(projectId: string): Promise<string> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Get all project saves
    const saves = await this.listProjectSaves(projectId);

    // Create export data
    const exportData = {
      project,
      saves,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import project from JSON data
   */
  public async importProject(jsonData: string, newName?: string): Promise<Project> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.project) {
        throw new Error('Invalid project data');
      }

      // Create new project with imported data
      const importedProject: Project = {
        ...importData.project,
        id: crypto.randomUUID(),
        name: newName || `${importData.project.name} (Imported)`,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft', // Reset status to draft for imported project
        assetInstances: importData.project.assetInstances?.map((instance: AssetInstance) => ({
          ...instance,
          id: crypto.randomUUID(), // Generate new IDs to avoid conflicts
        })) || [],
      };

      // Save the imported project
      await this.projectDatabase.createProject(importedProject);

      // Import project saves if they exist
      if (importData.saves && Array.isArray(importData.saves)) {
        for (const save of importData.saves) {
          const importedSave: ProjectSave = {
            ...save,
            id: crypto.randomUUID(),
            projectId: importedProject.id,
            createdAt: new Date(),
            name: `${save.name} (Imported)`,
          };
          await this.projectDatabase.createProjectSave(importedSave);
        }
      }

      console.log(`[ProjectManager] Imported project: ${importedProject.id}`);
      return importedProject;
    } catch (error) {
      throw new Error(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List projects with filters
   */
  public async listProjects(filters?: ProjectFilters): Promise<Project[]> {
    return await this.projectDatabase.listProjects(filters);
  }

  /**
   * Set current project
   */
  public async setCurrentProject(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    this.currentProject = project;
    
    // Join collaboration session
    await this.collaborationManager.joinSession(projectId, this.currentUserId);
    
    console.log(`[ProjectManager] Set current project: ${project.name}`);
  }

  /**
   * Get current project
   */
  public getCurrentProject(): Project | null {
    return this.currentProject;
  }

  // ============================================================================
  // Asset Instance Management
  // ============================================================================

  /**
   * Add asset instance to project
   */
  public async addAssetInstance(projectId: string, config: AddAssetInstanceConfig): Promise<AssetInstance> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const instance = await this.assetInstanceManager.createInstance(config);
    
    // Add to project
    project.assetInstances.push(instance);
    project.updatedAt = new Date();
    
    await this.projectDatabase.updateProject(projectId, project);
    
    // Record change
    await this.recordChange(projectId, {
      type: 'create',
      assetInstanceId: instance.id,
      property: 'assetInstance',
      oldValue: null,
      newValue: instance,
      description: `Added asset instance: ${instance.name}`,
      isUndoable: true,
    });
    
    console.log(`[ProjectManager] Added asset instance: ${instance.name} to project ${projectId}`);
    return instance;
  }

  /**
   * Update asset instance
   */
  public async updateAssetInstance(projectId: string, instanceId: string, updates: Partial<AssetInstance>): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const instanceIndex = project.assetInstances.findIndex(i => i.id === instanceId);
    if (instanceIndex === -1) {
      throw new Error('Asset instance not found');
    }

    const oldInstance = { ...project.assetInstances[instanceIndex] };
    const updatedInstance = { ...oldInstance, ...updates };
    
    project.assetInstances[instanceIndex] = updatedInstance;
    project.updatedAt = new Date();
    
    await this.projectDatabase.updateProject(projectId, project);
    
    // Record changes
    for (const [key, value] of Object.entries(updates)) {
      if (value !== oldInstance[key as keyof AssetInstance]) {
        await this.recordChange(projectId, {
          type: 'update',
          assetInstanceId: instanceId,
          property: key,
          oldValue: oldInstance[key as keyof AssetInstance],
          newValue: value,
          description: `Updated ${key} for ${updatedInstance.name}`,
          isUndoable: true,
        });
      }
    }
    
    console.log(`[ProjectManager] Updated asset instance: ${instanceId}`);
  }

  /**
   * Remove asset instance from project
   */
  public async removeAssetInstance(projectId: string, instanceId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const instanceIndex = project.assetInstances.findIndex(i => i.id === instanceId);
    if (instanceIndex === -1) {
      throw new Error('Asset instance not found');
    }

    const instance = project.assetInstances[instanceIndex];
    project.assetInstances.splice(instanceIndex, 1);
    project.updatedAt = new Date();
    
    await this.projectDatabase.updateProject(projectId, project);
    
    // Record change
    await this.recordChange(projectId, {
      type: 'delete',
      assetInstanceId: instanceId,
      property: 'assetInstance',
      oldValue: instance,
      newValue: null,
      description: `Removed asset instance: ${instance.name}`,
      isUndoable: true,
    });
    
    console.log(`[ProjectManager] Removed asset instance: ${instanceId} from project ${projectId}`);
  }

  /**
   * Get asset instance
   */
  public async getAssetInstance(projectId: string, instanceId: string): Promise<AssetInstance | null> {
    const project = await this.getProject(projectId);
    if (!project) {
      return null;
    }

    return project.assetInstances.find(i => i.id === instanceId) || null;
  }

  // ============================================================================
  // Project Save Operations
  // ============================================================================

  /**
   * Save project state
   */
  public async saveProject(projectId: string, config: SaveProjectConfig): Promise<ProjectSave> {
    const save = await this.projectDatabase.saveProject(projectId, config);
    
    console.log(`[ProjectManager] Saved project: ${projectId} (version ${save.version})`);
    return save;
  }

  /**
   * Load project save
   */
  public async loadProjectSave(projectId: string, saveId: string): Promise<void> {
    await this.getWorldLoader().loadProjectSave(projectId, saveId);
    console.log(`[ProjectManager] Successfully loaded project save: ${saveId} for project ${projectId}`);
  }

  /**
   * List project saves
   */
  public async listProjectSaves(projectId: string): Promise<ProjectSave[]> {
    return await this.projectDatabase.getProjectSaves(projectId);
  }

  /**
   * Export current world state to project save
   */
  public async exportCurrentWorldToSave(projectId: string, saveName: string): Promise<ProjectSave> {
    return await this.getWorldLoader().exportCurrentWorldToSave(projectId, saveName);
  }

  // ============================================================================
  // Collaboration Operations
  // ============================================================================

  /**
   * Join project collaboration session
   */
  public async joinProject(projectId: string, userId: string): Promise<void> {
    await this.collaborationManager.joinSession(projectId, userId);
    
    // Add user to project team if not already a member
    const project = await this.getProject(projectId);
    if (project && !project.teamMembers.some(member => member.userId === userId)) {
      const newMember: TeamMember = {
        userId,
        name: `User ${userId}`, // TODO: Get real name
        role: 'viewer',
        joinedAt: new Date(),
        permissions: 'read',
      };
      
      project.teamMembers.push(newMember);
      await this.updateProject(projectId, project);
    }
    
    console.log(`[ProjectManager] User ${userId} joined project ${projectId}`);
  }

  /**
   * Leave project collaboration session
   */
  public async leaveProject(projectId: string, userId: string): Promise<void> {
    await this.collaborationManager.leaveSession(projectId, userId);
    console.log(`[ProjectManager] User ${userId} left project ${projectId}`);
  }

  /**
   * Add comment to project
   */
  public async addComment(projectId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
    const fullComment: Comment = {
      ...comment,
      id: this.generateId(),
      createdAt: new Date(),
    };
    
    await this.collaborationManager.addComment(projectId, fullComment);
    console.log(`[ProjectManager] Added comment to project ${projectId}`);
    return fullComment;
  }

  /**
   * Add annotation to project
   */
  public async addAnnotation(projectId: string, annotation: Omit<Annotation, 'id' | 'createdAt'>): Promise<Annotation> {
    const fullAnnotation: Annotation = {
      ...annotation,
      id: this.generateId(),
      createdAt: new Date(),
    };
    
    await this.collaborationManager.addAnnotation(projectId, fullAnnotation);
    console.log(`[ProjectManager] Added annotation to project ${projectId}`);
    return fullAnnotation;
  }

  // ============================================================================
  // Asset Locking Operations
  // ============================================================================

  /**
   * Lock asset for editing
   */
  public async lockAsset(projectId: string, instanceId: string, userId: string, lockType: LockType): Promise<void> {
    await this.collaborationManager.lockAsset(projectId, instanceId, userId, lockType);
    console.log(`[ProjectManager] Locked asset ${instanceId} for user ${userId}`);
  }

  /**
   * Unlock asset
   */
  public async unlockAsset(projectId: string, instanceId: string, userId: string): Promise<void> {
    await this.collaborationManager.unlockAsset(projectId, instanceId, userId);
    console.log(`[ProjectManager] Unlocked asset ${instanceId} for user ${userId}`);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `pm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Record change for history tracking
   */
  private async recordChange(projectId: string, change: Omit<Change, 'id' | 'timestamp' | 'userId'>): Promise<void> {
    const fullChange: Change = {
      ...change,
      id: this.generateId(),
      timestamp: new Date(),
      userId: this.currentUserId,
    };
    
    await this.collaborationManager.recordChange(projectId, fullChange);
  }

  /**
   * Get active users in current project
   */
  public getActiveUsers(): ActiveUser[] {
    if (!this.currentProject) {
      return [];
    }
    
    return this.collaborationManager.getActiveUsers(this.currentProject.id);
  }

  /**
   * Get project collaboration session
   */
  public getCollaborationSession(projectId: string): CollaborationSession | null {
    return this.collaborationManager.getSession(projectId);
  }

  /**
   * Set current user ID
   */
  public setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  /**
   * Get current user ID
   */
  public getCurrentUserId(): string {
    return this.currentUserId;
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this.currentProject) {
      await this.leaveProject(this.currentProject.id, this.currentUserId);
    }
    
    await this.collaborationManager.cleanup();
    this.projectDatabase.close();
    
    console.log('[ProjectManager] Cleaned up resources');
  }
}
