/**
 * Collaboration Manager
 * Owner: George
 * 
 * Manages real-time collaboration features including user presence,
 * asset locking, comments, annotations, and change tracking
 */

import type {
  CollaborationSession,
  ActiveUser,
  AssetLock,
  Comment,
  Annotation,
  Change,
  LockType,
  PresenceStatus,
  Vector3,
} from './types';

/**
 * Collaboration Manager
 */
export class CollaborationManager {
  private static instance: CollaborationManager | null = null;
  private sessions: Map<string, CollaborationSession> = new Map();
  private activeUsers: Map<string, ActiveUser> = new Map();
  private comments: Map<string, Comment[]> = new Map();
  private annotations: Map<string, Annotation[]> = new Map();
  private changeHistory: Map<string, Change[]> = new Map();
  private locks: Map<string, AssetLock[]> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): CollaborationManager {
    if (!CollaborationManager.instance) {
      CollaborationManager.instance = new CollaborationManager();
    }
    return CollaborationManager.instance;
  }

  /**
   * Initialize the collaboration manager
   */
  public async initialize(): Promise<void> {
    console.log('[CollaborationManager] Initialized');
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Create collaboration session for project
   */
  public async createSession(projectId: string): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      projectId,
      activeUsers: [],
      locks: [],
      presence: [],
      startedAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
    };

    this.sessions.set(projectId, session);
    console.log(`[CollaborationManager] Created session for project: ${projectId}`);
    return session;
  }

  /**
   * Join collaboration session
   */
  public async joinSession(projectId: string, userId: string): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      throw new Error('Collaboration session not found');
    }

    // Check if user is already in session
    const existingUser = session.activeUsers.find(u => u.userId === userId);
    if (existingUser) {
      existingUser.lastSeen = new Date();
      return;
    }

    // Add new user to session
    const activeUser: ActiveUser = {
      userId,
      name: `User ${userId}`, // TODO: Get real name
      role: 'viewer', // TODO: Get from project permissions
      cursor: { x: 0, y: 0, z: 0 },
      selection: [],
      viewport: {
        position: { x: 0, y: 10, z: 10 },
        target: { x: 0, y: 0, z: 0 },
        alpha: 0,
        beta: Math.PI / 4,
        radius: 10,
      },
      lastSeen: new Date(),
      isTyping: false,
    };

    session.activeUsers.push(activeUser);
    session.lastActivity = new Date();
    this.activeUsers.set(`${projectId}_${userId}`, activeUser);

    console.log(`[CollaborationManager] User ${userId} joined project ${projectId}`);
  }

  /**
   * Leave collaboration session
   */
  public async leaveSession(projectId: string, userId: string): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    // Remove user from session
    session.activeUsers = session.activeUsers.filter(u => u.userId !== userId);
    session.lastActivity = new Date();
    this.activeUsers.delete(`${projectId}_${userId}`);

    // Release any locks held by this user
    await this.releaseUserLocks(projectId, userId);

    console.log(`[CollaborationManager] User ${userId} left project ${projectId}`);
  }

  /**
   * End collaboration session
   */
  public async endSession(projectId: string): Promise<void> {
    const session = this.sessions.get(projectId);
    if (session) {
      session.isActive = false;
      session.lastActivity = new Date();
    }

    // Clean up all locks for this project
    this.locks.delete(projectId);

    console.log(`[CollaborationManager] Ended session for project: ${projectId}`);
  }

  /**
   * Get collaboration session
   */
  public getSession(projectId: string): CollaborationSession | null {
    return this.sessions.get(projectId) || null;
  }

  /**
   * Get active users in project
   */
  public getActiveUsers(projectId: string): ActiveUser[] {
    const session = this.sessions.get(projectId);
    return session?.activeUsers || [];
  }

  // ============================================================================
  // User Presence Management
  // ============================================================================

  /**
   * Update user presence
   */
  public async updatePresence(
    projectId: string,
    userId: string,
    _status: PresenceStatus,
    cursor?: Vector3,
    selection?: string[]
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    const user = session.activeUsers.find(u => u.userId === userId);
    if (user) {
      user.lastSeen = new Date();
      if (cursor) {
        user.cursor = cursor;
      }
      if (selection) {
        user.selection = selection;
      }
    }

    session.lastActivity = new Date();
  }

  /**
   * Update user viewport
   */
  public async updateViewport(
    projectId: string,
    userId: string,
    viewport: ActiveUser['viewport']
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    const user = session.activeUsers.find(u => u.userId === userId);
    if (user) {
      user.viewport = viewport;
      user.lastSeen = new Date();
    }

    session.lastActivity = new Date();
  }

  /**
   * Set user typing status
   */
  public async setTypingStatus(
    projectId: string,
    userId: string,
    isTyping: boolean,
    action?: string
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    const user = session.activeUsers.find(u => u.userId === userId);
    if (user) {
      user.isTyping = isTyping;
      user.currentAction = action;
      user.lastSeen = new Date();
    }

    session.lastActivity = new Date();
  }

  // ============================================================================
  // Asset Locking
  // ============================================================================

  /**
   * Lock asset for editing
   */
  public async lockAsset(
    projectId: string,
    instanceId: string,
    userId: string,
    lockType: LockType
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      throw new Error('Collaboration session not found');
    }

    // Check if asset is already locked
    const existingLock = session.locks.find(l => l.assetInstanceId === instanceId);
    if (existingLock && existingLock.lockedBy !== userId) {
      if (lockType === 'hard') {
        throw new Error('Asset is already locked by another user');
      } else {
        // Soft lock - just warn
        console.warn(`[CollaborationManager] Asset ${instanceId} is being edited by ${existingLock.lockedBy}`);
      }
    }

    // Create or update lock
    const lock: AssetLock = {
      assetInstanceId: instanceId,
      lockedBy: userId,
      lockType,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      createdAt: new Date(),
    };

    // Remove existing lock if any
    session.locks = session.locks.filter(l => l.assetInstanceId !== instanceId);
    session.locks.push(lock);

    console.log(`[CollaborationManager] Locked asset ${instanceId} for user ${userId}`);
  }

  /**
   * Unlock asset
   */
  public async unlockAsset(
    projectId: string,
    instanceId: string,
    userId: string
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    session.locks = session.locks.filter(l => 
      !(l.assetInstanceId === instanceId && l.lockedBy === userId)
    );

    console.log(`[CollaborationManager] Unlocked asset ${instanceId} for user ${userId}`);
  }

  /**
   * Release all locks held by a user
   */
  private async releaseUserLocks(projectId: string, userId: string): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    session.locks = session.locks.filter(l => l.lockedBy !== userId);
  }

  /**
   * Check if asset is locked
   */
  public isAssetLocked(projectId: string, instanceId: string): AssetLock | null {
    const session = this.sessions.get(projectId);
    if (!session) {
      return null;
    }

    return session.locks.find(l => l.assetInstanceId === instanceId) || null;
  }

  /**
   * Extend lock expiration
   */
  public async extendLock(
    projectId: string,
    instanceId: string,
    userId: string,
    minutes: number = 5
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    const lock = session.locks.find(l => 
      l.assetInstanceId === instanceId && l.lockedBy === userId
    );

    if (lock) {
      lock.expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    }
  }

  // ============================================================================
  // Comments Management
  // ============================================================================

  /**
   * Add comment to project
   */
  public async addComment(projectId: string, comment: Comment): Promise<void> {
    const projectComments = this.comments.get(projectId) || [];
    projectComments.push(comment);
    this.comments.set(projectId, projectComments);

    console.log(`[CollaborationManager] Added comment to project ${projectId}`);
  }

  /**
   * Get project comments
   */
  public getProjectComments(projectId: string): Comment[] {
    return this.comments.get(projectId) || [];
  }

  /**
   * Update comment
   */
  public async updateComment(projectId: string, commentId: string, content: string): Promise<void> {
    const projectComments = this.comments.get(projectId) || [];
    const comment = projectComments.find(c => c.id === commentId);
    if (comment) {
      comment.content = content;
      comment.updatedAt = new Date();
    }

    console.log(`[CollaborationManager] Updated comment ${commentId} in project ${projectId}`);
  }

  /**
   * Resolve comment
   */
  public async resolveComment(
    projectId: string,
    commentId: string,
    resolvedBy: string
  ): Promise<void> {
    const projectComments = this.comments.get(projectId) || [];
    const comment = projectComments.find(c => c.id === commentId);
    if (comment) {
      comment.isResolved = true;
      comment.resolvedBy = resolvedBy;
      comment.resolvedAt = new Date();
    }

    console.log(`[CollaborationManager] Resolved comment ${commentId} in project ${projectId}`);
  }

  // ============================================================================
  // Annotations Management
  // ============================================================================

  /**
   * Add annotation to project
   */
  public async addAnnotation(projectId: string, annotation: Annotation): Promise<void> {
    const projectAnnotations = this.annotations.get(projectId) || [];
    projectAnnotations.push(annotation);
    this.annotations.set(projectId, projectAnnotations);

    console.log(`[CollaborationManager] Added annotation to project ${projectId}`);
  }

  /**
   * Get project annotations
   */
  public getProjectAnnotations(projectId: string): Annotation[] {
    return this.annotations.get(projectId) || [];
  }

  /**
   * Update annotation
   */
  public async updateAnnotation(
    projectId: string,
    annotationId: string,
    updates: Partial<Annotation>
  ): Promise<void> {
    const projectAnnotations = this.annotations.get(projectId) || [];
    const annotation = projectAnnotations.find(a => a.id === annotationId);
    if (annotation) {
      Object.assign(annotation, updates);
    }

    console.log(`[CollaborationManager] Updated annotation ${annotationId} in project ${projectId}`);
  }

  /**
   * Remove annotation
   */
  public async removeAnnotation(projectId: string, annotationId: string): Promise<void> {
    const projectAnnotations = this.annotations.get(projectId) || [];
    this.annotations.set(
      projectId,
      projectAnnotations.filter(a => a.id !== annotationId)
    );

    console.log(`[CollaborationManager] Removed annotation ${annotationId} from project ${projectId}`);
  }

  // ============================================================================
  // Change Tracking
  // ============================================================================

  /**
   * Record change for history tracking
   */
  public async recordChange(projectId: string, change: Change): Promise<void> {
    const projectChanges = this.changeHistory.get(projectId) || [];
    projectChanges.push(change);
    this.changeHistory.set(projectId, projectChanges);

    console.log(`[CollaborationManager] Recorded change in project ${projectId}`);
  }

  /**
   * Get project change history
   */
  public getProjectChanges(projectId: string): Change[] {
    return this.changeHistory.get(projectId) || [];
  }

  /**
   * Get changes for specific asset instance
   */
  public getInstanceChanges(projectId: string, instanceId: string): Change[] {
    const projectChanges = this.changeHistory.get(projectId) || [];
    return projectChanges.filter(c => c.assetInstanceId === instanceId);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Cleanup expired locks
   */
  public cleanupExpiredLocks(): void {
    const now = new Date();
    
    for (const [_projectId, session] of this.sessions) {
      session.locks = session.locks.filter(lock => lock.expiresAt > now);
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.sessions.clear();
    this.activeUsers.clear();
    this.comments.clear();
    this.annotations.clear();
    this.changeHistory.clear();
    this.locks.clear();

    console.log('[CollaborationManager] Cleaned up resources');
  }
}
