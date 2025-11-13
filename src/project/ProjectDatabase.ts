/**
 * Project Database (IndexedDB)
 * Owner: George
 * 
 * Local storage system for projects using IndexedDB
 * Supports project versioning, collaboration data, and asset instance management
 */

import type {
  Project,
  ProjectSave,
  ProjectDatabaseEntry,
  ProjectSaveEntry,
  ProjectFilters,
  CreateProjectConfig,
  SaveProjectConfig,
} from './types';

/**
 * Database schema versions
 */
const DB_VERSION = 1;
const DB_NAME = 'kineticore_project_database';

/**
 * Store names
 */
const STORES = {
  PROJECTS: 'projects',
  PROJECT_SAVES: 'project_saves',
  COLLABORATION_SESSIONS: 'collaboration_sessions',
  COMMENTS: 'comments',
  ANNOTATIONS: 'annotations',
  CHANGE_HISTORY: 'change_history',
} as const;

/**
 * IndexedDB Project Database
 */
export class ProjectDatabase {
  private static instance: ProjectDatabase | null = null;
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ProjectDatabase {
    if (!ProjectDatabase.instance) {
      ProjectDatabase.instance = new ProjectDatabase();
    }
    return ProjectDatabase.instance;
  }

  /**
   * Initialize database
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this environment. Project data persistence is disabled.');
    }

    this.initializationPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      let settled = false;

      const cleanup = () => {
        settled = true;
        clearTimeout(timeoutId);
      };

      const resolveOnce = () => {
        if (settled) return;
        cleanup();
        this.db = request.result;
        this.isInitialized = true;
        console.log('[ProjectDatabase] Initialized successfully');
        resolve();
      };

      const rejectOnce = (error: Error) => {
        if (settled) return;
        cleanup();
        reject(error);
      };

      const timeoutId = window.setTimeout(() => {
        rejectOnce(
          new Error(
            'Project database initialization timed out. Close other KinetiCORE tabs or clear application data and try again.'
          )
        );
      }, 8000);

      request.onerror = () => {
        rejectOnce(
          new Error(`Failed to open project database: ${request.error?.message ?? 'Unknown error'}`)
        );
      };

      request.onblocked = () => {
        rejectOnce(
          new Error(
            'Project database upgrade is blocked by another open KinetiCORE tab. Please close other tabs and reload.'
          )
        );
      };

      request.onsuccess = () => {
        resolveOnce();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    }).finally(() => {
      this.initializationPromise = null;
    });

    return this.initializationPromise;
  }

  /**
   * Create database stores
   */
  private createStores(db: IDBDatabase): void {
    // Projects store
    if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
      const projectsStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
      projectsStore.createIndex('createdBy', 'project.createdBy', { unique: false });
      projectsStore.createIndex('status', 'project.status', { unique: false });
      projectsStore.createIndex('category', 'project.category', { unique: false });
      projectsStore.createIndex('visibility', 'project.visibility', { unique: false });
      projectsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      projectsStore.createIndex('tags', 'project.tags', { unique: false, multiEntry: true });
    }

    // Project saves store
    if (!db.objectStoreNames.contains(STORES.PROJECT_SAVES)) {
      const savesStore = db.createObjectStore(STORES.PROJECT_SAVES, { keyPath: 'id' });
      savesStore.createIndex('projectId', 'projectId', { unique: false });
      savesStore.createIndex('version', 'save.version', { unique: false });
      savesStore.createIndex('createdAt', 'createdAt', { unique: false });
      savesStore.createIndex('createdBy', 'save.createdBy', { unique: false });
    }

    // Collaboration sessions store
    if (!db.objectStoreNames.contains(STORES.COLLABORATION_SESSIONS)) {
      const sessionsStore = db.createObjectStore(STORES.COLLABORATION_SESSIONS, { keyPath: 'id' });
      sessionsStore.createIndex('projectId', 'projectId', { unique: false });
      sessionsStore.createIndex('lastActivity', 'lastActivity', { unique: false });
    }

    // Comments store
    if (!db.objectStoreNames.contains(STORES.COMMENTS)) {
      const commentsStore = db.createObjectStore(STORES.COMMENTS, { keyPath: 'id' });
      commentsStore.createIndex('projectId', 'projectId', { unique: false });
      commentsStore.createIndex('assetInstanceId', 'assetInstanceId', { unique: false });
      commentsStore.createIndex('authorId', 'authorId', { unique: false });
      commentsStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Annotations store
    if (!db.objectStoreNames.contains(STORES.ANNOTATIONS)) {
      const annotationsStore = db.createObjectStore(STORES.ANNOTATIONS, { keyPath: 'id' });
      annotationsStore.createIndex('projectId', 'projectId', { unique: false });
      annotationsStore.createIndex('assetInstanceId', 'assetInstanceId', { unique: false });
      annotationsStore.createIndex('authorId', 'authorId', { unique: false });
      annotationsStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Change history store
    if (!db.objectStoreNames.contains(STORES.CHANGE_HISTORY)) {
      const changesStore = db.createObjectStore(STORES.CHANGE_HISTORY, { keyPath: 'id' });
      changesStore.createIndex('projectId', 'projectId', { unique: false });
      changesStore.createIndex('assetInstanceId', 'assetInstanceId', { unique: false });
      changesStore.createIndex('userId', 'userId', { unique: false });
      changesStore.createIndex('timestamp', 'timestamp', { unique: false });
    }
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate checksum for data integrity
   */
  private async calculateChecksum(data: unknown): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ============================================================================
  // Project CRUD Operations
  // ============================================================================

  /**
   * Create new project
   */
  public async createProject(config: CreateProjectConfig): Promise<Project> {
    await this.ensureInitialized();

    const now = new Date();
    const project: Project = {
      id: this.generateId(),
      name: config.name,
      description: config.description,
      createdAt: now,
      updatedAt: now,
      createdBy: 'current_user', // TODO: Get from auth system
      assetInstances: [],
      visibility: config.visibility || 'private',
      teamMembers: [],
      tags: config.tags || [],
      status: 'draft',
      category: config.category,
      currentVersion: 1,
      customProperties: config.customProperties || {},
    };

    const entry: ProjectDatabaseEntry = {
      id: project.id,
      project,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.put(entry);

      request.onsuccess = () => {
        console.log(`[ProjectDatabase] Created project: ${project.name} (${project.id})`);
        resolve(project);
      };

      request.onerror = () => {
        reject(new Error('Failed to create project'));
      };
    });
  }

  /**
   * Get project by ID
   */
  public async getProject(projectId: string): Promise<Project | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readonly');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.get(projectId);

      request.onsuccess = () => {
        const entry = request.result as ProjectDatabaseEntry | undefined;
        resolve(entry?.project || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to get project'));
      };
    });
  }

  /**
   * Update project
   */
  public async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORES.PROJECTS);
      const getRequest = store.get(projectId);

      getRequest.onsuccess = () => {
        const entry = getRequest.result as ProjectDatabaseEntry | undefined;
        if (!entry) {
          reject(new Error('Project not found'));
          return;
        }

        // Update project data
        const updatedProject = { ...entry.project, ...updates, updatedAt: new Date() };
        const updatedEntry = { ...entry, project: updatedProject, updatedAt: new Date() };

        const putRequest = store.put(updatedEntry);
        putRequest.onsuccess = () => {
          console.log(`[ProjectDatabase] Updated project: ${projectId}`);
          resolve();
        };
        putRequest.onerror = () => {
          reject(new Error('Failed to update project'));
        };
      };

      getRequest.onerror = () => {
        reject(new Error('Failed to get project for update'));
      };
    });
  }

  /**
   * Delete project
   */
  public async deleteProject(projectId: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([
        STORES.PROJECTS,
        STORES.PROJECT_SAVES,
        STORES.COLLABORATION_SESSIONS,
        STORES.COMMENTS,
        STORES.ANNOTATIONS,
        STORES.CHANGE_HISTORY,
      ], 'readwrite');

      // Delete project
      const projectsStore = transaction.objectStore(STORES.PROJECTS);
      projectsStore.delete(projectId);

      // Delete all related data
      const savesStore = transaction.objectStore(STORES.PROJECT_SAVES);
      const savesIndex = savesStore.index('projectId');
      const savesRequest = savesIndex.openCursor(IDBKeyRange.only(projectId));
      savesRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Similar cleanup for other stores...
      transaction.oncomplete = () => {
        console.log(`[ProjectDatabase] Deleted project: ${projectId}`);
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error('Failed to delete project'));
      };
    });
  }

  /**
   * List projects with filters
   */
  public async listProjects(filters?: ProjectFilters): Promise<Project[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readonly');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as ProjectDatabaseEntry[];
        let projects = entries.map(entry => entry.project);

        // Apply filters
        if (filters) {
          if (filters.status && filters.status.length > 0) {
            projects = projects.filter(p => filters.status!.includes(p.status));
          }
          if (filters.category && filters.category.length > 0) {
            projects = projects.filter(p => filters.category!.includes(p.category));
          }
          if (filters.visibility && filters.visibility.length > 0) {
            projects = projects.filter(p => filters.visibility!.includes(p.visibility));
          }
          if (filters.tags && filters.tags.length > 0) {
            projects = projects.filter(p => 
              filters.tags!.some(tag => p.tags.includes(tag))
            );
          }
          if (filters.createdBy) {
            projects = projects.filter(p => p.createdBy === filters.createdBy);
          }
          if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            projects = projects.filter(p => 
              p.name.toLowerCase().includes(searchLower) ||
              p.description?.toLowerCase().includes(searchLower)
            );
          }
        }

        // Sort by updated date (newest first)
        projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        resolve(projects);
      };

      request.onerror = () => {
        reject(new Error('Failed to list projects'));
      };
    });
  }

  // ============================================================================
  // Project Save Operations
  // ============================================================================

  /**
   * Save project state
   */
  public async saveProject(projectId: string, config: SaveProjectConfig): Promise<ProjectSave> {
    await this.ensureInitialized();

    // Get current project
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const now = new Date();
    const save: ProjectSave = {
      id: this.generateId(),
      projectId,
      version: project.currentVersion + 1,
      name: config.name,
      description: config.description,
      createdAt: now,
      createdBy: 'current_user', // TODO: Get from auth system
      assetInstances: [...project.assetInstances], // Deep copy
      sceneState: await this.captureSceneState(),
      comments: config.includeComments ? await this.getProjectComments(projectId) : [],
      annotations: config.includeAnnotations ? await this.getProjectAnnotations(projectId) : [],
      changesSinceLastSave: [], // TODO: Implement change tracking
      isAutoSave: config.isAutoSave || false,
      fileSize: 0, // TODO: Calculate actual size
      checksum: '', // TODO: Calculate checksum
    };

    // Calculate checksum and file size
    save.checksum = await this.calculateChecksum(save);
    save.fileSize = JSON.stringify(save).length;

    const entry: ProjectSaveEntry = {
      id: save.id,
      projectId,
      save,
      createdAt: now,
      fileSize: save.fileSize,
      checksum: save.checksum,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECT_SAVES, STORES.PROJECTS], 'readwrite');
      
      // Save the project save
      const savesStore = transaction.objectStore(STORES.PROJECT_SAVES);
      savesStore.put(entry);

      // Update project version
      const projectsStore = transaction.objectStore(STORES.PROJECTS);
      const getRequest = projectsStore.get(projectId);
      getRequest.onsuccess = () => {
        const projectEntry = getRequest.result as ProjectDatabaseEntry;
        if (projectEntry) {
          projectEntry.project.currentVersion = save.version;
          projectEntry.project.lastSavedAt = now;
          projectEntry.updatedAt = now;
          projectsStore.put(projectEntry);
        }
      };

      transaction.oncomplete = () => {
        console.log(`[ProjectDatabase] Saved project: ${project.name} (version ${save.version})`);
        resolve(save);
      };

      transaction.onerror = () => {
        reject(new Error('Failed to save project'));
      };
    });
  }

  /**
   * Create project save (for import/duplicate operations)
   */
  public async createProjectSave(save: ProjectSave): Promise<ProjectSave> {
    await this.ensureInitialized();

    const now = new Date();
    const entry: ProjectSaveEntry = {
      id: save.id,
      projectId: save.projectId,
      save,
      createdAt: now,
      fileSize: save.fileSize || JSON.stringify(save).length,
      checksum: save.checksum || await this.calculateChecksum(save),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECT_SAVES], 'readwrite');
      const store = transaction.objectStore(STORES.PROJECT_SAVES);
      const request = store.put(entry);

      request.onsuccess = () => {
        console.log(`[ProjectDatabase] Created project save: ${save.name} (${save.id})`);
        resolve(save);
      };

      request.onerror = () => {
        reject(new Error('Failed to create project save'));
      };
    });
  }

  /**
   * Get project saves
   */
  public async getProjectSaves(projectId: string): Promise<ProjectSave[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECT_SAVES], 'readonly');
      const store = transaction.objectStore(STORES.PROJECT_SAVES);
      const index = store.index('projectId');
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const entries = request.result as ProjectSaveEntry[];
        const saves = entries.map(entry => entry.save);
        saves.sort((a, b) => b.version - a.version); // Sort by version (newest first)
        resolve(saves);
      };

      request.onerror = () => {
        reject(new Error('Failed to get project saves'));
      };
    });
  }

  // ============================================================================
  // Helper Methods (TODO: Implement)
  // ============================================================================

  private async captureSceneState() {
    // Import the ProjectWorldLoader to capture scene state
    const { ProjectWorldLoader } = await import('./ProjectWorldLoader');
    const worldLoader = ProjectWorldLoader.getInstance();
    
    try {
      return await worldLoader.captureCurrentSceneState();
    } catch (error) {
      console.error('[ProjectDatabase] Failed to capture scene state:', error);
      // Return default state as fallback
      return {
        camera: { 
          position: { x: 0, y: 0, z: 0 } as any, 
          target: { x: 0, y: 0, z: 0 } as any, 
          alpha: 0, 
          beta: 0, 
          radius: 10 
        },
        lighting: { 
          ambientIntensity: 0.3, 
          directionalLights: [], 
          pointLights: [] 
        },
        physics: { 
          gravity: { x: 0, y: -9.81, z: 0 } as any, 
          enabled: true, 
          timeStep: 1/60, 
          entities: [] 
        },
        kinematics: { 
          chains: [], 
          actuators: [] 
        },
        environment: { 
          backgroundColor: { x: 0.5, y: 0.5, z: 0.5 } as any, 
          fogEnabled: false, 
          fogDensity: 0.1, 
          fogColor: { x: 1, y: 1, z: 1 } as any, 
          groundEnabled: true, 
          groundSize: 100, 
          groundColor: { x: 0.8, y: 0.8, z: 0.8 } as any 
        }
      };
    }
  }

  private async getProjectComments(_projectId: string) {
    // TODO: Implement comment retrieval
    return [];
  }

  private async getProjectAnnotations(_projectId: string) {
    // TODO: Implement annotation retrieval
    return [];
  }

  /**
   * Close database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }
}
