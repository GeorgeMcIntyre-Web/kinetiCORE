/**
 * User Management & Authentication System
 * Owner: George
 * 
 * Client-side user management with progressive enhancement from anonymous to enterprise
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * User Types and Interfaces
 */
export interface UserPreferences {
  defaultAssetVisibility: 'private' | 'team' | 'organization' | 'public';
  autoSync: boolean;
  cacheSize: number; // MB
  notificationSettings: {
    assetShared: boolean;
    assetUpdated: boolean;
    teamActivity: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
}

export interface UserRole {
  id: string;
  name: string;
  permissions: AssetPermission[];
  limits: {
    maxAssets: number;
    maxStorage: number; // MB
    maxProjects: number;
    cloudSync: boolean;
    teamSharing: boolean;
  };
}

export interface AssetPermission {
  resource: 'assets' | 'projects' | 'settings';
  action: 'read' | 'write' | 'delete' | 'share';
  scope: 'own' | 'team' | 'organization' | 'public';
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  organizationId?: string;
  teamIds: string[];
  preferences: UserPreferences;
  createdAt: Date;
  lastActiveAt: Date;
  isAnonymous?: boolean;
  subscription?: 'free' | 'pro' | 'enterprise';
}

export interface AnonymousUser extends User {
  isAnonymous: true;
  id: 'anonymous';
  email: 'local@kineticore.local';
  name: 'Local User';
}

export interface TeamMember {
  userId: string;
  role: 'member' | 'admin';
  joinedAt: Date;
  invitedBy: string;
  status: 'active' | 'pending' | 'suspended';
}

export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: TeamMember[];
  settings: {
    allowPublicAssets: boolean;
    requireApprovalForSharing: boolean;
    maxAssetSize: number; // MB
    allowedFileTypes: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Store State
 */
interface UserStore {
  user: User | AnonymousUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (provider: 'google' | 'email' | 'anonymous', credentials?: LoginCredentials) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  
  // Team actions
  joinTeam: (teamId: string) => Promise<void>;
  leaveTeam: (teamId: string) => Promise<void>;
  createTeam: (teamData: CreateTeamData) => Promise<Team>;
  
  // Utility methods
  hasPermission: (resource: string, action: string, scope: string) => boolean;
  canAccessAsset: (assetId: string) => Promise<boolean>;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface CreateTeamData {
  name: string;
  description: string;
  settings?: Partial<Team['settings']>;
}

/**
 * Default User Roles
 */
const DEFAULT_ROLES: Record<string, UserRole> = {
  individual: {
    id: 'individual',
    name: 'Individual User',
    permissions: [
      { resource: 'assets', action: 'read', scope: 'own' },
      { resource: 'assets', action: 'write', scope: 'own' },
      { resource: 'assets', action: 'delete', scope: 'own' },
      { resource: 'projects', action: 'read', scope: 'own' },
      { resource: 'projects', action: 'write', scope: 'own' },
      { resource: 'projects', action: 'delete', scope: 'own' },
      { resource: 'settings', action: 'read', scope: 'own' },
      { resource: 'settings', action: 'write', scope: 'own' }
    ],
    limits: {
      maxAssets: 100,
      maxStorage: 1024, // 1GB
      maxProjects: 10,
      cloudSync: false,
      teamSharing: false
    }
  },
  
  team_member: {
    id: 'team_member',
    name: 'Team Member',
    permissions: [
      { resource: 'assets', action: 'read', scope: 'own' },
      { resource: 'assets', action: 'write', scope: 'own' },
      { resource: 'assets', action: 'delete', scope: 'own' },
      { resource: 'assets', action: 'read', scope: 'team' },
      { resource: 'assets', action: 'write', scope: 'team' },
      { resource: 'assets', action: 'share', scope: 'team' },
      { resource: 'projects', action: 'read', scope: 'own' },
      { resource: 'projects', action: 'write', scope: 'own' },
      { resource: 'projects', action: 'delete', scope: 'own' },
      { resource: 'projects', action: 'read', scope: 'team' },
      { resource: 'projects', action: 'write', scope: 'team' },
      { resource: 'projects', action: 'share', scope: 'team' },
      { resource: 'settings', action: 'read', scope: 'own' },
      { resource: 'settings', action: 'write', scope: 'own' }
    ],
    limits: {
      maxAssets: 1000,
      maxStorage: 10240, // 10GB
      maxProjects: 100,
      cloudSync: true,
      teamSharing: true
    }
  },
  
  team_admin: {
    id: 'team_admin',
    name: 'Team Admin',
    permissions: [
      { resource: 'assets', action: 'read', scope: 'own' },
      { resource: 'assets', action: 'write', scope: 'own' },
      { resource: 'assets', action: 'delete', scope: 'own' },
      { resource: 'assets', action: 'read', scope: 'team' },
      { resource: 'assets', action: 'write', scope: 'team' },
      { resource: 'assets', action: 'delete', scope: 'team' },
      { resource: 'assets', action: 'share', scope: 'team' },
      { resource: 'projects', action: 'read', scope: 'own' },
      { resource: 'projects', action: 'write', scope: 'own' },
      { resource: 'projects', action: 'delete', scope: 'own' },
      { resource: 'projects', action: 'read', scope: 'team' },
      { resource: 'projects', action: 'write', scope: 'team' },
      { resource: 'projects', action: 'delete', scope: 'team' },
      { resource: 'projects', action: 'share', scope: 'team' },
      { resource: 'settings', action: 'read', scope: 'own' },
      { resource: 'settings', action: 'write', scope: 'own' },
      { resource: 'settings', action: 'read', scope: 'team' },
      { resource: 'settings', action: 'write', scope: 'team' }
    ],
    limits: {
      maxAssets: 5000,
      maxStorage: 51200, // 50GB
      maxProjects: 500,
      cloudSync: true,
      teamSharing: true
    }
  },
  
  enterprise_admin: {
    id: 'enterprise_admin',
    name: 'Enterprise Admin',
    permissions: [
      { resource: 'assets', action: 'read', scope: 'own' },
      { resource: 'assets', action: 'write', scope: 'own' },
      { resource: 'assets', action: 'delete', scope: 'own' },
      { resource: 'assets', action: 'read', scope: 'team' },
      { resource: 'assets', action: 'write', scope: 'team' },
      { resource: 'assets', action: 'delete', scope: 'team' },
      { resource: 'assets', action: 'share', scope: 'team' },
      { resource: 'assets', action: 'read', scope: 'organization' },
      { resource: 'assets', action: 'write', scope: 'organization' },
      { resource: 'assets', action: 'delete', scope: 'organization' },
      { resource: 'assets', action: 'share', scope: 'organization' },
      { resource: 'projects', action: 'read', scope: 'own' },
      { resource: 'projects', action: 'write', scope: 'own' },
      { resource: 'projects', action: 'delete', scope: 'own' },
      { resource: 'projects', action: 'read', scope: 'team' },
      { resource: 'projects', action: 'write', scope: 'team' },
      { resource: 'projects', action: 'delete', scope: 'team' },
      { resource: 'projects', action: 'share', scope: 'team' },
      { resource: 'projects', action: 'read', scope: 'organization' },
      { resource: 'projects', action: 'write', scope: 'organization' },
      { resource: 'projects', action: 'delete', scope: 'organization' },
      { resource: 'projects', action: 'share', scope: 'organization' },
      { resource: 'settings', action: 'read', scope: 'own' },
      { resource: 'settings', action: 'write', scope: 'own' },
      { resource: 'settings', action: 'read', scope: 'team' },
      { resource: 'settings', action: 'write', scope: 'team' },
      { resource: 'settings', action: 'read', scope: 'organization' },
      { resource: 'settings', action: 'write', scope: 'organization' }
    ],
    limits: {
      maxAssets: -1, // Unlimited
      maxStorage: -1, // Unlimited
      maxProjects: -1, // Unlimited
      cloudSync: true,
      teamSharing: true
    }
  }
};

/**
 * Default User Preferences
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  defaultAssetVisibility: 'private',
  autoSync: false,
  cacheSize: 500, // 500MB
  notificationSettings: {
    assetShared: true,
    assetUpdated: true,
    teamActivity: false
  },
  theme: 'auto',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
};

/**
 * Create Anonymous User
 */
function createAnonymousUser(): AnonymousUser {
  return {
    id: 'anonymous',
    email: 'local@kineticore.local',
    name: 'Local User',
    role: DEFAULT_ROLES.individual,
    teamIds: [],
    preferences: DEFAULT_PREFERENCES,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    isAnonymous: true,
    subscription: 'free'
  };
}

/**
 * User Store Implementation
 */
export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: async (provider, credentials) => {
        set({ isLoading: true, error: null });
        
        try {
          let user: User | AnonymousUser;
          
          switch (provider) {
            case 'anonymous':
              user = createAnonymousUser();
              console.log('[UserStore] Logged in anonymously');
              break;
              
            case 'google':
              user = await signInWithGoogle();
              console.log('[UserStore] Logged in with Google');
              break;
              
            case 'email':
              if (!credentials) {
                throw new Error('Email credentials required');
              }
              user = await signInWithEmail(credentials.email, credentials.password);
              console.log('[UserStore] Logged in with email');
              break;
              
            default:
              throw new Error(`Unsupported login provider: ${provider}`);
          }
          
          set({ 
            user, 
            isAuthenticated: true, 
            isLoading: false 
          });
          
          // Update last active time
          user.lastActiveAt = new Date();
          
          // Initialize asset manager with user context
          try {
            const { UserAwareAssetManager } = await import('../library/UserAwareAssetManager');
            const assetManager = UserAwareAssetManager.getInstance();
            await assetManager.initialize(user);
            console.log('[UserStore] Asset manager initialized');
          } catch (error) {
            console.warn('[UserStore] Failed to initialize asset manager:', error);
          }
          
        } catch (error) {
          console.error('[UserStore] Login failed:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Login failed', 
            isLoading: false 
          });
        }
      },
      
      logout: () => {
        console.log('[UserStore] Logging out');
        set({ 
          user: null, 
          isAuthenticated: false,
          error: null
        });
      },
      
      updateProfile: async (updates) => {
        const { user } = get();
        if (!user) {
          throw new Error('No user logged in');
        }
        
        const updatedUser = { ...user, ...updates };
        set({ user: updatedUser });
        
        // Update in backend if not anonymous
        if (!user.isAnonymous) {
          try {
            await updateUserProfile(updatedUser);
            console.log('[UserStore] Profile updated');
          } catch (error) {
            console.error('[UserStore] Failed to update profile:', error);
            // Revert changes
            set({ user });
            throw error;
          }
        }
      },
      
      refreshUser: async () => {
        const { user } = get();
        if (!user || user.isAnonymous) return;
        
        try {
          const refreshedUser = await fetchUserProfile(user.id);
          set({ user: refreshedUser });
          console.log('[UserStore] User refreshed');
        } catch (error) {
          console.error('[UserStore] Failed to refresh user:', error);
        }
      },
      
      joinTeam: async (teamId) => {
        const { user } = get();
        if (!user) {
          throw new Error('No user logged in');
        }
        
        try {
          await joinTeamAPI(teamId);
          set({ 
            user: { 
              ...user, 
              teamIds: [...user.teamIds, teamId] 
            } 
          });
          console.log('[UserStore] Joined team:', teamId);
        } catch (error) {
          console.error('[UserStore] Failed to join team:', error);
          throw error;
        }
      },
      
      leaveTeam: async (teamId) => {
        const { user } = get();
        if (!user) {
          throw new Error('No user logged in');
        }
        
        try {
          await leaveTeamAPI(teamId);
          set({ 
            user: { 
              ...user, 
              teamIds: user.teamIds.filter(id => id !== teamId) 
            } 
          });
          console.log('[UserStore] Left team:', teamId);
        } catch (error) {
          console.error('[UserStore] Failed to leave team:', error);
          throw error;
        }
      },
      
      createTeam: async (teamData) => {
        const { user } = get();
        if (!user) {
          throw new Error('No user logged in');
        }
        
        try {
          const team = await createTeamAPI(teamData, user.id);
          console.log('[UserStore] Created team:', team.id);
          return team;
        } catch (error) {
          console.error('[UserStore] Failed to create team:', error);
          throw error;
        }
      },
      
      hasPermission: (resource, action, scope) => {
        const { user } = get();
        if (!user) return false;
        
        return user.role.permissions.some(permission => 
          permission.resource === resource && 
          permission.action === action && 
          permission.scope === scope
        );
      },
      
      canAccessAsset: async (assetId) => {
        const { user } = get();
        if (!user) return false;
        
        try {
          const { UserAwareAssetManager } = await import('../library/UserAwareAssetManager');
          const assetManager = UserAwareAssetManager.getInstance();
          const asset = await assetManager.getAsset(assetId);
          return !!asset;
        } catch (error) {
          console.error('[UserStore] Failed to check asset access:', error);
          return false;
        }
      }
    }),
    {
      name: 'kineticore-user-store',
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

/**
 * Authentication API Functions (Placeholders)
 */
async function signInWithGoogle(): Promise<User> {
  // Placeholder for Google OAuth
  // In real implementation, this would integrate with Supabase Auth
  return {
    id: 'google_user_123',
    email: 'user@gmail.com',
    name: 'Google User',
    role: DEFAULT_ROLES.individual,
    teamIds: [],
    preferences: DEFAULT_PREFERENCES,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    subscription: 'free'
  };
}

async function signInWithEmail(email: string, _password: string): Promise<User> {
  // Placeholder for email/password authentication
  // In real implementation, this would integrate with Supabase Auth
  return {
    id: 'email_user_123',
    email,
    name: email.split('@')[0],
    role: DEFAULT_ROLES.individual,
    teamIds: [],
    preferences: DEFAULT_PREFERENCES,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    subscription: 'free'
  };
}

async function updateUserProfile(user: User): Promise<void> {
  // Placeholder for profile update API
  console.log('[AuthAPI] Updating profile:', user.id);
}

async function fetchUserProfile(userId: string): Promise<User> {
  // Placeholder for user profile fetch API
  console.log('[AuthAPI] Fetching profile:', userId);
  return createAnonymousUser() as User;
}

async function joinTeamAPI(teamId: string): Promise<void> {
  // Placeholder for join team API
  console.log('[AuthAPI] Joining team:', teamId);
}

async function leaveTeamAPI(teamId: string): Promise<void> {
  // Placeholder for leave team API
  console.log('[AuthAPI] Leaving team:', teamId);
}

async function createTeamAPI(teamData: CreateTeamData, ownerId: string): Promise<Team> {
  // Placeholder for create team API
  console.log('[AuthAPI] Creating team:', teamData.name);
  return {
    id: 'team_' + Date.now(),
    name: teamData.name,
    description: teamData.description,
    ownerId,
    members: [],
    settings: {
      allowPublicAssets: false,
      requireApprovalForSharing: false,
      maxAssetSize: 100,
      allowedFileTypes: ['urdf', 'glb', 'gltf', 'stl', 'obj']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * React Hooks for User Management
 */
export const useAuth = () => {
  const store = useUserStore();
  
  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    login: store.login,
    logout: store.logout,
    updateProfile: store.updateProfile,
    refreshUser: store.refreshUser
  };
};

export const useUserPermissions = () => {
  const { user, hasPermission } = useUserStore();
  
  return {
    hasPermission: (resource: string, action: string, scope: string) => 
      hasPermission(resource, action, scope),
    canReadAssets: (scope: string) => hasPermission('assets', 'read', scope),
    canWriteAssets: (scope: string) => hasPermission('assets', 'write', scope),
    canDeleteAssets: (scope: string) => hasPermission('assets', 'delete', scope),
    canShareAssets: (scope: string) => hasPermission('assets', 'share', scope),
    canManageSettings: (scope: string) => hasPermission('settings', 'write', scope),
    userRole: user?.role,
    isAnonymous: user?.isAnonymous || false
  };
};

export const useTeamManagement = () => {
  const { user, joinTeam, leaveTeam, createTeam } = useUserStore();
  
  return {
    userTeams: user?.teamIds || [],
    joinTeam,
    leaveTeam,
    createTeam,
    canCreateTeam: user?.role.id === 'team_admin' || user?.role.id === 'enterprise_admin'
  };
};

/**
 * Utility Functions
 */
export const getUserDisplayName = (user: User | AnonymousUser | null): string => {
  if (!user) return 'Unknown User';
  return user.name || user.email.split('@')[0];
};

export const getUserInitials = (user: User | AnonymousUser | null): string => {
  if (!user) return '?';
  return user.name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const isUserAnonymous = (user: User | AnonymousUser | null): boolean => {
  return user?.isAnonymous || false;
};

export const getUserSubscriptionTier = (user: User | AnonymousUser | null): string => {
  if (!user) return 'free';
  return user.subscription || 'free';
};

export const canUserSyncToCloud = (user: User | AnonymousUser | null): boolean => {
  if (!user) return false;
  return user.role.limits.cloudSync && !user.isAnonymous;
};

export const canUserShareWithTeam = (user: User | AnonymousUser | null): boolean => {
  if (!user) return false;
  return user.role.limits.teamSharing && !user.isAnonymous;
};
