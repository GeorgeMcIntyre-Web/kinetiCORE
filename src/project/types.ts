/**
 * Project Management Types
 * Owner: George
 * 
 * Core types for project-centric asset management and collaboration
 */

// Simple vector and quaternion types for project data
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

// ============================================================================
// Core Project Types
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // Asset References (not full assets)
  assetInstances: AssetInstance[];
  
  // Collaboration
  visibility: ProjectVisibility;
  teamMembers: TeamMember[];
  
  // Project Metadata
  tags: string[];
  status: ProjectStatus;
  category: ProjectCategory;
  
  // Versioning
  currentVersion: number;
  lastSavedAt?: Date;
  
  // Custom Properties
  customProperties: Record<string, unknown>;
}

export type ProjectVisibility = 'private' | 'team' | 'public';
export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';
export type ProjectCategory = 'simulation' | 'layout' | 'prototype' | 'production' | 'training' | 'research' | 'design' | 'analysis' | 'testing' | 'maintenance' | 'documentation' | 'integration' | 'optimization' | 'compliance';

export interface TeamMember {
  userId: string;
  name: string;
  email?: string;
  role: TeamRole;
  joinedAt: Date;
  lastActiveAt?: Date;
  permissions: ProjectPermissions;
}

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type ProjectPermissions = 'read' | 'write' | 'admin';

// ============================================================================
// Asset Instance Management
// ============================================================================

export interface AssetInstance {
  id: string; // Instance ID (unique within project)
  assetId: string; // Reference to library asset
  name: string; // Instance name (can differ from asset name)
  
  // Transform data
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  
  // Joint states (for robots)
  jointStates: Record<string, number>;
  
  // Attachments/connections
  attachments: Attachment[];
  
  // Instance-specific metadata
  customProperties: Record<string, unknown>;
  
  // Instance state
  isVisible: boolean;
  isLocked: boolean;
  lockedBy?: string;
  
  // Creation info
  createdAt: Date;
  createdBy: string;
}

export interface Attachment {
  id: string;
  type: AttachmentType;
  targetInstanceId: string; // What it's attached to
  sourceInstanceId?: string; // What's doing the attaching
  
  // Attachment data
  connectionPoint: Vector3;
  connectionType: ConnectionType;
  
  // Metadata
  name?: string;
  description?: string;
  customProperties: Record<string, unknown>;
}

export type AttachmentType = 'mechanical' | 'electrical' | 'pneumatic' | 'logical' | 'custom';
export type ConnectionType = 'fixed' | 'hinge' | 'slider' | 'ball' | 'universal' | 'custom';

// ============================================================================
// Project Saves and Versioning
// ============================================================================

export interface ProjectSave {
  id: string;
  projectId: string;
  version: number;
  name: string; // User-defined save name
  description?: string;
  createdAt: Date;
  createdBy: string;
  
  // Complete project state
  assetInstances: AssetInstance[];
  sceneState: SceneState;
  
  // Collaboration data
  comments: Comment[];
  annotations: Annotation[];
  
  // Change tracking
  changesSinceLastSave: Change[];
  
  // Save metadata
  isAutoSave: boolean;
  fileSize: number;
  checksum: string;
}

export interface SceneState {
  camera: CameraState;
  lighting: LightingState;
  physics: PhysicsState;
  kinematics: KinematicsState;
  environment: EnvironmentState;
}

export interface CameraState {
  position: Vector3;
  target: Vector3;
  alpha: number; // ArcRotateCamera alpha
  beta: number;  // ArcRotateCamera beta
  radius: number;
}

export interface LightingState {
  ambientIntensity: number;
  directionalLights: DirectionalLightState[];
  pointLights: PointLightState[];
}

export interface DirectionalLightState {
  id: string;
  direction: Vector3;
  intensity: number;
  color: Vector3;
  enabled: boolean;
}

export interface PointLightState {
  id: string;
  position: Vector3;
  intensity: number;
  color: Vector3;
  range: number;
  enabled: boolean;
}

export interface PhysicsState {
  gravity: Vector3;
  enabled: boolean;
  timeStep: number;
  entities: PhysicsEntityState[];
}

export interface PhysicsEntityState {
  instanceId: string;
  bodyType: 'static' | 'dynamic' | 'kinematic';
  mass: number;
  friction: number;
  restitution: number;
  linearVelocity: Vector3;
  angularVelocity: Vector3;
}

export interface KinematicsState {
  chains: KinematicChainState[];
  actuators: ActuatorState[];
}

export interface KinematicChainState {
  id: string;
  name: string;
  joints: JointState[];
  isActive: boolean;
}

export interface JointState {
  id: string;
  name: string;
  type: 'revolute' | 'prismatic' | 'fixed' | 'spherical' | 'cylindrical';
  position: number;
  velocity: number;
  effort: number;
  limits: JointLimits;
}

export interface JointLimits {
  lower: number;
  upper: number;
  effort: number;
  velocity: number;
}

export interface ActuatorState {
  id: string;
  name: string;
  type: 'servo' | 'stepper' | 'hydraulic' | 'pneumatic';
  position: number;
  velocity: number;
  effort: number;
  enabled: boolean;
}

export interface EnvironmentState {
  backgroundColor: Vector3;
  fogEnabled: boolean;
  fogDensity: number;
  fogColor: Vector3;
  groundEnabled: boolean;
  groundSize: number;
  groundColor: Vector3;
}

// ============================================================================
// Collaboration and Comments
// ============================================================================

export interface Comment {
  id: string;
  projectId: string;
  assetInstanceId?: string; // Optional - comment on specific asset
  position?: Vector3; // Optional - 3D position in scene
  
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  
  // Threading
  parentCommentId?: string;
  replies: string[]; // Comment IDs
  
  // Status
  isResolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  
  // Mentions
  mentions: string[]; // User IDs
}

export interface Annotation {
  id: string;
  projectId: string;
  assetInstanceId?: string;
  position: Vector3;
  
  type: AnnotationType;
  content: string;
  authorId: string;
  createdAt: Date;
  
  // Visual properties
  color: string;
  size: number;
  opacity: number;
  
  // Interaction
  isVisible: boolean;
  isLocked: boolean;
}

export type AnnotationType = 'note' | 'warning' | 'question' | 'highlight' | 'measurement' | 'custom';

// ============================================================================
// Change Tracking
// ============================================================================

export interface Change {
  id: string;
  type: ChangeType;
  timestamp: Date;
  userId: string;
  
  // What changed
  assetInstanceId?: string;
  property: string;
  oldValue: unknown;
  newValue: unknown;
  
  // Context
  description?: string;
  isUndoable: boolean;
}

export type ChangeType = 'create' | 'update' | 'delete' | 'move' | 'rotate' | 'scale' | 'attach' | 'detach' | 'joint_change';

// ============================================================================
// Collaboration Session
// ============================================================================

export interface CollaborationSession {
  projectId: string;
  activeUsers: ActiveUser[];
  locks: AssetLock[];
  presence: UserPresence[];
  
  // Session metadata
  startedAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface ActiveUser {
  userId: string;
  name: string;
  role: TeamRole;
  cursor: Vector3;
  selection: string[]; // Selected asset instance IDs
  viewport: CameraState;
  lastSeen: Date;
  
  // Status
  isTyping: boolean;
  currentAction?: string;
}

export interface AssetLock {
  assetInstanceId: string;
  lockedBy: string;
  lockType: LockType;
  expiresAt: Date;
  reason?: string;
  createdAt: Date;
}

export type LockType = 'soft' | 'hard';

export interface UserPresence {
  userId: string;
  name: string;
  status: PresenceStatus;
  lastSeen: Date;
  currentProject?: string;
}

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

// ============================================================================
// Project Manager Interfaces
// ============================================================================

export interface ProjectManager {
  // Project CRUD
  createProject(config: CreateProjectConfig): Promise<Project>;
  getProject(projectId: string): Promise<Project | null>;
  updateProject(projectId: string, updates: Partial<Project>): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  listProjects(filters?: ProjectFilters): Promise<Project[]>;
  
  // Asset Instance Management
  addAssetInstance(projectId: string, config: AddAssetInstanceConfig): Promise<AssetInstance>;
  updateAssetInstance(projectId: string, instanceId: string, updates: Partial<AssetInstance>): Promise<void>;
  removeAssetInstance(projectId: string, instanceId: string): Promise<void>;
  getAssetInstance(projectId: string, instanceId: string): Promise<AssetInstance | null>;
  
  // Project Saves
  saveProject(projectId: string, config: SaveProjectConfig): Promise<ProjectSave>;
  loadProjectSave(projectId: string, saveId: string): Promise<void>;
  listProjectSaves(projectId: string): Promise<ProjectSave[]>;
  
  // Collaboration
  joinProject(projectId: string, userId: string): Promise<void>;
  leaveProject(projectId: string, userId: string): Promise<void>;
  addComment(projectId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment>;
  addAnnotation(projectId: string, annotation: Omit<Annotation, 'id' | 'createdAt'>): Promise<Annotation>;
  
  // Locking
  lockAsset(projectId: string, instanceId: string, userId: string, lockType: LockType): Promise<void>;
  unlockAsset(projectId: string, instanceId: string, userId: string): Promise<void>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface CreateProjectConfig {
  name: string;
  description?: string;
  category: ProjectCategory;
  visibility: ProjectVisibility;
  tags?: string[];
  customProperties?: Record<string, unknown>;
}

export interface AddAssetInstanceConfig {
  assetId: string;
  name: string;
  position: Vector3;
  rotation?: Quaternion;
  scale?: Vector3;
  jointStates?: Record<string, number>;
  customProperties?: Record<string, unknown>;
}

export interface SaveProjectConfig {
  name: string;
  description?: string;
  isAutoSave?: boolean;
  includeComments?: boolean;
  includeAnnotations?: boolean;
}

export interface ProjectFilters {
  status?: ProjectStatus[];
  category?: ProjectCategory[];
  visibility?: ProjectVisibility[];
  tags?: string[];
  createdBy?: string;
  teamMember?: string;
  search?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// ============================================================================
// Database Schema Types
// ============================================================================

export interface ProjectDatabaseEntry {
  id: string;
  project: Project;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface ProjectSaveEntry {
  id: string;
  projectId: string;
  save: ProjectSave;
  createdAt: Date;
  fileSize: number;
  checksum: string;
}

export interface CollaborationSessionEntry {
  id: string;
  projectId: string;
  session: CollaborationSession;
  createdAt: Date;
  lastActivity: Date;
}
