/**
 * Asset Sharing and Collaboration System
 * Owner: George
 * 
 * Comprehensive sharing system with real-time collaboration,
 * permission management, and workflow automation
 */

import type { LibraryAsset } from './types';
import type { User } from '../auth/UserStore';
import type { AssetMetadata } from './AssetMetadataManager';
import type { AssetVersion } from './AssetVersionManager';

/**
 * Sharing and Collaboration Types
 */
export interface AssetShareRequest {
  id: string;
  assetId: string;
  requestedBy: string; // User ID
  requestedFrom: string; // User ID
  permission: 'view' | 'edit' | 'admin';
  message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

export interface AssetCollaboration {
  assetId: string;
  collaborators: AssetCollaborator[];
  permissions: AssetPermissions;
  sharingSettings: AssetSharingSettings;
  workflow: CollaborationWorkflow;
  notifications: CollaborationNotification[];
}

export interface AssetCollaborator {
  userId: string;
  userName: string;
  userEmail: string;
  role: 'viewer' | 'editor' | 'admin' | 'owner';
  permission: 'view' | 'edit' | 'admin';
  addedAt: Date;
  addedBy: string;
  lastActiveAt: Date;
  status: 'active' | 'pending' | 'suspended' | 'removed';
  accessLevel: 'full' | 'limited' | 'restricted';
  customPermissions?: CustomPermission[];
}

export interface AssetPermissions {
  // Basic permissions
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canDownload: boolean;
  canComment: boolean;
  
  // Advanced permissions
  canCreateVersions: boolean;
  canApproveVersions: boolean;
  canMergeBranches: boolean;
  canManageWorkflow: boolean;
  canViewAnalytics: boolean;
  canExportData: boolean;
  
  // Time-based restrictions
  accessExpiresAt?: Date;
  downloadLimit?: number;
  viewLimit?: number;
  
  // IP restrictions
  allowedIPs?: string[];
  blockedIPs?: string[];
}

export interface AssetSharingSettings {
  // Visibility settings
  visibility: 'private' | 'team' | 'organization' | 'public';
  allowPublicAccess: boolean;
  requireAuthentication: boolean;
  
  // Sharing restrictions
  allowDownload: boolean;
  allowModification: boolean;
  allowReSharing: boolean;
  requireApprovalForSharing: boolean;
  
  // Watermarking and branding
  addWatermark: boolean;
  watermarkText?: string;
  showAttribution: boolean;
  
  // Usage tracking
  trackUsage: boolean;
  requireAttribution: boolean;
  licenseType: string;
  
  // Expiration
  expiresAt?: Date;
  autoExpire: boolean;
  notifyBeforeExpiry: boolean;
  expiryNotificationDays: number;
}

export interface CollaborationWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  currentStep: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: 'approval' | 'review' | 'modification' | 'notification' | 'automation';
  assignees: string[]; // User IDs
  requiredApprovals: number;
  approvals: WorkflowApproval[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  dueDate?: Date;
  completedAt?: Date;
  completedBy?: string;
  data?: any; // Step-specific data
}

export interface WorkflowApproval {
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  timestamp: Date;
}

export interface CollaborationNotification {
  id: string;
  type: 'share_request' | 'approval_request' | 'workflow_update' | 'comment' | 'version_update' | 'access_granted' | 'access_revoked';
  title: string;
  message: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  assetId: string;
  assetName: string;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
  actionRequired: boolean;
  actionUrl?: string;
  metadata?: any;
}

export interface CustomPermission {
  id: string;
  name: string;
  description: string;
  resource: string; // 'metadata', 'versions', 'comments', 'analytics'
  action: string; // 'read', 'write', 'delete', 'create'
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface CollaborationSession {
  id: string;
  assetId: string;
  userId: string;
  sessionType: 'view' | 'edit' | 'review';
  startedAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
  userAgent: string;
  ipAddress: string;
  actions: CollaborationAction[];
}

export interface CollaborationAction {
  id: string;
  type: 'view' | 'edit' | 'comment' | 'download' | 'share' | 'approve' | 'reject';
  description: string;
  timestamp: Date;
  metadata?: any;
}

export interface AssetComment {
  id: string;
  assetId: string;
  versionId?: string;
  userId: string;
  userName: string;
  content: string;
  type: 'comment' | 'suggestion' | 'question' | 'issue';
  status: 'active' | 'resolved' | 'archived';
  parentCommentId?: string; // For threaded comments
  mentions: string[]; // User IDs mentioned
  attachments: CommentAttachment[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  reactions: CommentReaction[];
}

export interface CommentAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadedAt: Date;
}

export interface CommentReaction {
  userId: string;
  userName: string;
  emoji: string;
  timestamp: Date;
}

/**
 * Asset Collaboration Manager
 */
export class AssetCollaborationManager {
  private static instance: AssetCollaborationManager | null = null;
  private collaborationCache: Map<string, AssetCollaboration> = new Map();
  private shareRequestCache: Map<string, AssetShareRequest> = new Map();
  private notificationCache: Map<string, CollaborationNotification[]> = new Map();
  private sessionCache: Map<string, CollaborationSession> = new Map();
  private commentCache: Map<string, AssetComment[]> = new Map();

  private constructor() {}

  public static getInstance(): AssetCollaborationManager {
    if (!AssetCollaborationManager.instance) {
      AssetCollaborationManager.instance = new AssetCollaborationManager();
    }
    return AssetCollaborationManager.instance;
  }

  /**
   * Share asset with users
   */
  public async shareAsset(
    assetId: string,
    targetUsers: string[],
    permission: 'view' | 'edit' | 'admin',
    options: {
      message?: string;
      expiresAt?: Date;
      requireApproval?: boolean;
      allowDownload?: boolean;
      allowModification?: boolean;
    },
    requester: User
  ): Promise<AssetShareRequest[]> {
    const shareRequests: AssetShareRequest[] = [];
    
    for (const targetUserId of targetUsers) {
      const shareRequest: AssetShareRequest = {
        id: this.generateShareRequestId(),
        assetId,
        requestedBy: requester.id,
        requestedFrom: targetUserId,
        permission,
        message: options.message,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: options.expiresAt
      };
      
      shareRequests.push(shareRequest);
      this.shareRequestCache.set(shareRequest.id, shareRequest);
      
      // Send notification
      await this.sendNotification({
        type: 'share_request',
        title: 'Asset Share Request',
        message: `${requester.name} wants to share "${assetId}" with you`,
        recipientId: targetUserId,
        senderId: requester.id,
        senderName: requester.name,
        assetId,
        assetName: assetId, // Would get actual name from asset
        actionRequired: true,
        actionUrl: `/assets/${assetId}/share/${shareRequest.id}`
      });
    }
    
    return shareRequests;
  }

  /**
   * Approve share request
   */
  public async approveShareRequest(
    shareRequestId: string,
    approver: User,
    customPermissions?: Partial<AssetPermissions>
  ): Promise<void> {
    const shareRequest = this.shareRequestCache.get(shareRequestId);
    if (!shareRequest) {
      throw new Error('Share request not found');
    }
    
    if (shareRequest.status !== 'pending') {
      throw new Error('Share request is not pending');
    }
    
    // Update share request
    shareRequest.status = 'approved';
    shareRequest.approvedAt = new Date();
    shareRequest.approvedBy = approver.id;
    this.shareRequestCache.set(shareRequestId, shareRequest);
    
    // Add collaborator
    await this.addCollaborator(
      shareRequest.assetId,
      shareRequest.requestedFrom,
      shareRequest.permission,
      approver.id,
      customPermissions
    );
    
    // Send notification
    await this.sendNotification({
      type: 'access_granted',
      title: 'Access Granted',
      message: `You now have ${shareRequest.permission} access to the asset`,
      recipientId: shareRequest.requestedFrom,
      senderId: approver.id,
      senderName: approver.name,
      assetId: shareRequest.assetId,
      assetName: shareRequest.assetId
    });
  }

  /**
   * Reject share request
   */
  public async rejectShareRequest(
    shareRequestId: string,
    rejector: User,
    reason: string
  ): Promise<void> {
    const shareRequest = this.shareRequestCache.get(shareRequestId);
    if (!shareRequest) {
      throw new Error('Share request not found');
    }
    
    shareRequest.status = 'rejected';
    shareRequest.rejectedAt = new Date();
    shareRequest.rejectedBy = rejector.id;
    shareRequest.rejectionReason = reason;
    this.shareRequestCache.set(shareRequestId, shareRequest);
    
    // Send notification
    await this.sendNotification({
      type: 'access_revoked',
      title: 'Share Request Rejected',
      message: `Your request to access the asset was rejected: ${reason}`,
      recipientId: shareRequest.requestedFrom,
      senderId: rejector.id,
      senderName: rejector.name,
      assetId: shareRequest.assetId,
      assetName: shareRequest.assetId
    });
  }

  /**
   * Add collaborator directly
   */
  public async addCollaborator(
    assetId: string,
    userId: string,
    permission: 'view' | 'edit' | 'admin',
    addedBy: string,
    customPermissions?: Partial<AssetPermissions>
  ): Promise<void> {
    let collaboration = this.collaborationCache.get(assetId);
    
    if (!collaboration) {
      collaboration = {
        assetId,
        collaborators: [],
        permissions: this.getDefaultPermissions(),
        sharingSettings: this.getDefaultSharingSettings(),
        workflow: this.getDefaultWorkflow(),
        notifications: []
      };
    }
    
    // Check if collaborator already exists
    const existingCollaborator = collaboration.collaborators.find(c => c.userId === userId);
    if (existingCollaborator) {
      // Update existing collaborator
      existingCollaborator.permission = permission;
      existingCollaborator.lastActiveAt = new Date();
      existingCollaborator.status = 'active';
    } else {
      // Add new collaborator
      const collaborator: AssetCollaborator = {
        userId,
        userName: '', // Would be fetched from user service
        userEmail: '', // Would be fetched from user service
        role: this.getRoleFromPermission(permission),
        permission,
        addedAt: new Date(),
        addedBy,
        lastActiveAt: new Date(),
        status: 'active',
        accessLevel: 'full',
        customPermissions: customPermissions ? [{
          id: this.generateCustomPermissionId(),
          name: 'Custom Permissions',
          description: 'Custom permission set',
          resource: 'all',
          action: 'all'
        }] : undefined
      };
      
      collaboration.collaborators.push(collaborator);
    }
    
    this.collaborationCache.set(assetId, collaboration);
  }

  /**
   * Remove collaborator
   */
  public async removeCollaborator(
    assetId: string,
    userId: string,
    removedBy: string,
    reason?: string
  ): Promise<void> {
    const collaboration = this.collaborationCache.get(assetId);
    if (!collaboration) return;
    
    const collaboratorIndex = collaboration.collaborators.findIndex(c => c.userId === userId);
    if (collaboratorIndex === -1) return;
    
    const collaborator = collaboration.collaborators[collaboratorIndex];
    collaborator.status = 'removed';
    
    // Send notification
    await this.sendNotification({
      type: 'access_revoked',
      title: 'Access Revoked',
      message: `Your access to the asset has been revoked${reason ? `: ${reason}` : ''}`,
      recipientId: userId,
      senderId: removedBy,
      senderName: '', // Would be fetched from user service
      assetId,
      assetName: assetId
    });
  }

  /**
   * Update collaborator permissions
   */
  public async updateCollaboratorPermissions(
    assetId: string,
    userId: string,
    newPermission: 'view' | 'edit' | 'admin',
    updatedBy: string
  ): Promise<void> {
    const collaboration = this.collaborationCache.get(assetId);
    if (!collaboration) return;
    
    const collaborator = collaboration.collaborators.find(c => c.userId === userId);
    if (!collaborator) return;
    
    const oldPermission = collaborator.permission;
    collaborator.permission = newPermission;
    collaborator.role = this.getRoleFromPermission(newPermission);
    
    // Send notification
    await this.sendNotification({
      type: 'workflow_update',
      title: 'Permissions Updated',
      message: `Your permission level has been changed from ${oldPermission} to ${newPermission}`,
      recipientId: userId,
      senderId: updatedBy,
      senderName: '', // Would be fetched from user service
      assetId,
      assetName: assetId
    });
  }

  /**
   * Add comment to asset
   */
  public async addComment(
    assetId: string,
    comment: Omit<AssetComment, 'id' | 'createdAt' | 'updatedAt' | 'reactions'>,
    user: User
  ): Promise<AssetComment> {
    const assetComment: AssetComment = {
      ...comment,
      id: this.generateCommentId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      reactions: []
    };
    
    // Add to cache
    const comments = this.commentCache.get(assetId) || [];
    comments.push(assetComment);
    this.commentCache.set(assetId, comments);
    
    // Send notifications to mentioned users
    for (const mentionedUserId of comment.mentions) {
      await this.sendNotification({
        type: 'comment',
        title: 'Mentioned in Comment',
        message: `${user.name} mentioned you in a comment`,
        recipientId: mentionedUserId,
        senderId: user.id,
        senderName: user.name,
        assetId,
        assetName: assetId,
        actionUrl: `/assets/${assetId}#comment-${assetComment.id}`
      });
    }
    
    return assetComment;
  }

  /**
   * Resolve comment
   */
  public async resolveComment(
    commentId: string,
    assetId: string,
    resolver: User
  ): Promise<void> {
    const comments = this.commentCache.get(assetId) || [];
    const comment = comments.find(c => c.id === commentId);
    
    if (!comment) return;
    
    comment.status = 'resolved';
    comment.resolvedAt = new Date();
    comment.resolvedBy = resolver.id;
    
    // Send notification to comment author
    await this.sendNotification({
      type: 'comment',
      title: 'Comment Resolved',
      message: `Your comment has been resolved by ${resolver.name}`,
      recipientId: comment.userId,
      senderId: resolver.id,
      senderName: resolver.name,
      assetId,
      assetName: assetId
    });
  }

  /**
   * Start collaboration session
   */
  public async startCollaborationSession(
    assetId: string,
    userId: string,
    sessionType: 'view' | 'edit' | 'review',
    userAgent: string,
    ipAddress: string
  ): Promise<CollaborationSession> {
    const session: CollaborationSession = {
      id: this.generateSessionId(),
      assetId,
      userId,
      sessionType,
      startedAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
      userAgent,
      ipAddress,
      actions: []
    };
    
    this.sessionCache.set(session.id, session);
    return session;
  }

  /**
   * End collaboration session
   */
  public async endCollaborationSession(sessionId: string): Promise<void> {
    const session = this.sessionCache.get(sessionId);
    if (!session) return;
    
    session.isActive = false;
    this.sessionCache.set(sessionId, session);
  }

  /**
   * Record collaboration action
   */
  public async recordCollaborationAction(
    sessionId: string,
    action: Omit<CollaborationAction, 'id' | 'timestamp'>
  ): Promise<void> {
    const session = this.sessionCache.get(sessionId);
    if (!session) return;
    
    const collaborationAction: CollaborationAction = {
      ...action,
      id: this.generateActionId(),
      timestamp: new Date()
    };
    
    session.actions.push(collaborationAction);
    session.lastActivityAt = new Date();
    
    this.sessionCache.set(sessionId, session);
  }

  /**
   * Get collaboration info
   */
  public getCollaboration(assetId: string): AssetCollaboration | null {
    return this.collaborationCache.get(assetId) || null;
  }

  /**
   * Get asset comments
   */
  public getAssetComments(assetId: string): AssetComment[] {
    return this.commentCache.get(assetId) || [];
  }

  /**
   * Get user notifications
   */
  public getUserNotifications(userId: string): CollaborationNotification[] {
    return this.notificationCache.get(userId) || [];
  }

  /**
   * Mark notification as read
   */
  public async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    const notifications = this.notificationCache.get(userId) || [];
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.read = true;
      notification.readAt = new Date();
    }
  }

  /**
   * Get share requests
   */
  public getShareRequests(userId: string): AssetShareRequest[] {
    const requests: AssetShareRequest[] = [];
    
    for (const request of this.shareRequestCache.values()) {
      if (request.requestedFrom === userId || request.requestedBy === userId) {
        requests.push(request);
      }
    }
    
    return requests;
  }

  /**
   * Private helper methods
   */
  private async sendNotification(notification: Omit<CollaborationNotification, 'id' | 'read' | 'createdAt'>): Promise<void> {
    const fullNotification: CollaborationNotification = {
      ...notification,
      id: this.generateNotificationId(),
      read: false,
      createdAt: new Date()
    };
    
    // Add to user's notifications
    const userNotifications = this.notificationCache.get(notification.recipientId) || [];
    userNotifications.push(fullNotification);
    this.notificationCache.set(notification.recipientId, userNotifications);
    
    // In a real implementation, this would also send email/push notifications
    console.log(`[AssetCollaborationManager] Notification sent to ${notification.recipientId}: ${notification.title}`);
  }

  private getDefaultPermissions(): AssetPermissions {
    return {
      canView: true,
      canEdit: false,
      canDelete: false,
      canShare: false,
      canDownload: true,
      canComment: true,
      canCreateVersions: false,
      canApproveVersions: false,
      canMergeBranches: false,
      canManageWorkflow: false,
      canViewAnalytics: false,
      canExportData: false
    };
  }

  private getDefaultSharingSettings(): AssetSharingSettings {
    return {
      visibility: 'private',
      allowPublicAccess: false,
      requireAuthentication: true,
      allowDownload: true,
      allowModification: false,
      allowReSharing: false,
      requireApprovalForSharing: true,
      addWatermark: false,
      showAttribution: true,
      trackUsage: true,
      requireAttribution: false,
      licenseType: 'MIT',
      autoExpire: false,
      notifyBeforeExpiry: false,
      expiryNotificationDays: 7
    };
  }

  private getDefaultWorkflow(): CollaborationWorkflow {
    return {
      id: this.generateWorkflowId(),
      name: 'Default Workflow',
      description: 'Default collaboration workflow',
      steps: [],
      currentStep: 0,
      status: 'active',
      createdBy: '',
      createdAt: new Date()
    };
  }

  private getRoleFromPermission(permission: 'view' | 'edit' | 'admin'): 'viewer' | 'editor' | 'admin' | 'owner' {
    switch (permission) {
      case 'view': return 'viewer';
      case 'edit': return 'editor';
      case 'admin': return 'admin';
      default: return 'viewer';
    }
  }

  private generateShareRequestId(): string {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCommentId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCustomPermissionId(): string {
    return `custom_perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Collaboration API
 */
export class CollaborationAPI {
  private collaborationManager: AssetCollaborationManager;

  constructor() {
    this.collaborationManager = AssetCollaborationManager.getInstance();
  }

  /**
   * Share asset
   */
  public async shareAsset(
    assetId: string,
    targetUsers: string[],
    permission: 'view' | 'edit' | 'admin',
    options: any,
    requester: User
  ) {
    return await this.collaborationManager.shareAsset(assetId, targetUsers, permission, options, requester);
  }

  /**
   * Approve share request
   */
  public async approveShareRequest(
    shareRequestId: string,
    approver: User,
    customPermissions?: Partial<AssetPermissions>
  ) {
    return await this.collaborationManager.approveShareRequest(shareRequestId, approver, customPermissions);
  }

  /**
   * Reject share request
   */
  public async rejectShareRequest(
    shareRequestId: string,
    rejector: User,
    reason: string
  ) {
    return await this.collaborationManager.rejectShareRequest(shareRequestId, rejector, reason);
  }

  /**
   * Add collaborator
   */
  public async addCollaborator(
    assetId: string,
    userId: string,
    permission: 'view' | 'edit' | 'admin',
    addedBy: string,
    customPermissions?: Partial<AssetPermissions>
  ) {
    return await this.collaborationManager.addCollaborator(assetId, userId, permission, addedBy, customPermissions);
  }

  /**
   * Remove collaborator
   */
  public async removeCollaborator(
    assetId: string,
    userId: string,
    removedBy: string,
    reason?: string
  ) {
    return await this.collaborationManager.removeCollaborator(assetId, userId, removedBy, reason);
  }

  /**
   * Update collaborator permissions
   */
  public async updateCollaboratorPermissions(
    assetId: string,
    userId: string,
    newPermission: 'view' | 'edit' | 'admin',
    updatedBy: string
  ) {
    return await this.collaborationManager.updateCollaboratorPermissions(assetId, userId, newPermission, updatedBy);
  }

  /**
   * Add comment
   */
  public async addComment(
    assetId: string,
    comment: any,
    user: User
  ) {
    return await this.collaborationManager.addComment(assetId, comment, user);
  }

  /**
   * Resolve comment
   */
  public async resolveComment(
    commentId: string,
    assetId: string,
    resolver: User
  ) {
    return await this.collaborationManager.resolveComment(commentId, assetId, resolver);
  }

  /**
   * Start collaboration session
   */
  public async startCollaborationSession(
    assetId: string,
    userId: string,
    sessionType: 'view' | 'edit' | 'review',
    userAgent: string,
    ipAddress: string
  ) {
    return await this.collaborationManager.startCollaborationSession(assetId, userId, sessionType, userAgent, ipAddress);
  }

  /**
   * End collaboration session
   */
  public async endCollaborationSession(sessionId: string) {
    return await this.collaborationManager.endCollaborationSession(sessionId);
  }

  /**
   * Record collaboration action
   */
  public async recordCollaborationAction(
    sessionId: string,
    action: any
  ) {
    return await this.collaborationManager.recordCollaborationAction(sessionId, action);
  }

  /**
   * Get collaboration info
   */
  public getCollaboration(assetId: string) {
    return this.collaborationManager.getCollaboration(assetId);
  }

  /**
   * Get asset comments
   */
  public getAssetComments(assetId: string) {
    return this.collaborationManager.getAssetComments(assetId);
  }

  /**
   * Get user notifications
   */
  public getUserNotifications(userId: string) {
    return this.collaborationManager.getUserNotifications(userId);
  }

  /**
   * Mark notification as read
   */
  public async markNotificationAsRead(notificationId: string, userId: string) {
    return await this.collaborationManager.markNotificationAsRead(notificationId, userId);
  }

  /**
   * Get share requests
   */
  public getShareRequests(userId: string) {
    return this.collaborationManager.getShareRequests(userId);
  }
}
