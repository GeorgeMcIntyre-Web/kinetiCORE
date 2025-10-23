# User Management & Authentication System Design
**Owner:** George  
**Date:** January 2025  
**Status:** Design Phase

## 🎯 Vision: Seamless User Experience with Enterprise-Grade Security

Create a user management system that scales from individual engineers to large enterprise teams, with intelligent role-based access control and seamless authentication.

## 🏗️ User Architecture Overview

### **Multi-Tier User System**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                    │
├─────────────────────────────────────────────────────────────┤
│  Login UI  │  Profile Management  │  Team Management       │
├─────────────────────────────────────────────────────────────┤
│                    AUTHENTICATION LAYER                     │
├─────────────────────────────────────────────────────────────┤
│  Auth Provider  │  Session Manager  │  Token Handler      │
├─────────────────────────────────────────────────────────────┤
│                    USER MANAGEMENT LAYER                   │
├─────────────────────────────────────────────────────────────┤
│  User Store     │  Role Manager     │  Permission Engine   │
│  Profile Store  │  Team Manager     │  Organization Mgr    │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Authentication Strategy

### **Phase 1: Local-First (No Auth Required)**
```typescript
// Anonymous user for local-only usage
interface AnonymousUser {
  id: 'anonymous';
  name: 'Local User';
  email: 'local@kineticore.local';
  role: 'individual';
  preferences: UserPreferences;
  isAnonymous: true;
}

// Graceful degradation - works offline
const useAuth = () => {
  const [user, setUser] = useState<User | AnonymousUser | null>(null);
  
  const login = async (provider: 'google' | 'email' | 'anonymous') => {
    if (provider === 'anonymous') {
      setUser(createAnonymousUser());
      return;
    }
    // Handle real authentication
  };
  
  return { user, login, logout, isAuthenticated: !!user && !user.isAnonymous };
};
```

### **Phase 2: Cloud Authentication (Supabase Auth)**
```typescript
// Supabase integration for cloud features
interface CloudUser extends User {
  supabaseId: string;
  emailVerified: boolean;
  lastSignIn: Date;
  subscription: 'free' | 'pro' | 'enterprise';
}

const useSupabaseAuth = () => {
  const supabase = createClient();
  
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };
  
  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
  };
};
```

## 👥 User Types & Roles

### **Individual Users**
```typescript
interface IndividualUser extends User {
  type: 'individual';
  role: 'engineer' | 'student' | 'hobbyist';
  subscription: 'free' | 'pro';
  limits: {
    maxAssets: 100;
    maxStorage: 1024; // MB
    maxProjects: 10;
  };
}

// Free tier limitations
const FREE_TIER_LIMITS = {
  maxAssets: 50,
  maxStorage: 500, // MB
  maxProjects: 5,
  cloudSync: false,
  teamSharing: false
};

// Pro tier benefits
const PRO_TIER_LIMITS = {
  maxAssets: 1000,
  maxStorage: 10240, // 10GB
  maxProjects: 100,
  cloudSync: true,
  teamSharing: true,
  prioritySupport: true
};
```

### **Team Users**
```typescript
interface TeamUser extends User {
  type: 'team';
  teamId: string;
  teamRole: 'member' | 'admin' | 'owner';
  organizationId?: string;
  permissions: TeamPermission[];
}

interface TeamPermission {
  resource: 'assets' | 'projects' | 'settings';
  action: 'read' | 'write' | 'delete' | 'share';
  scope: 'own' | 'team' | 'organization';
}

// Team management
interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: TeamMember[];
  settings: {
    allowPublicAssets: boolean;
    requireApprovalForSharing: boolean;
    maxAssetSize: number;
    allowedFileTypes: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

interface TeamMember {
  userId: string;
  role: 'member' | 'admin';
  joinedAt: Date;
  invitedBy: string;
  status: 'active' | 'pending' | 'suspended';
}
```

### **Enterprise Users**
```typescript
interface EnterpriseUser extends User {
  type: 'enterprise';
  organizationId: string;
  departmentId?: string;
  employeeId: string;
  managerId?: string;
  role: 'engineer' | 'manager' | 'admin' | 'executive';
  permissions: EnterprisePermission[];
  compliance: {
    gdpr: boolean;
    sox: boolean;
    hipaa: boolean;
    itar: boolean;
  };
}

interface Organization {
  id: string;
  name: string;
  domain: string; // company.com
  settings: {
    ssoEnabled: boolean;
    ldapEnabled: boolean;
    auditLogging: boolean;
    dataRetention: number; // days
    backupFrequency: 'daily' | 'weekly' | 'monthly';
  };
  departments: Department[];
  teams: Team[];
  assets: OrganizationAsset[];
}

interface Department {
  id: string;
  name: string;
  managerId: string;
  members: string[];
  assetQuota: number;
  budget: number;
}
```

## 🔑 Permission System

### **Hierarchical Permission Model**
```typescript
interface PermissionMatrix {
  // Resource-based permissions
  resources: {
    assets: {
      own: ['read', 'write', 'delete', 'share'];
      team: ['read', 'write', 'share'];
      organization: ['read'];
      public: ['read'];
    };
    projects: {
      own: ['read', 'write', 'delete', 'share'];
      team: ['read', 'write', 'share'];
      organization: ['read'];
    };
    settings: {
      own: ['read', 'write'];
      team: ['read', 'write'];
      organization: ['read', 'write'];
    };
  };
  
  // Role-based permissions
  roles: {
    individual: {
      assets: 'own';
      projects: 'own';
      settings: 'own';
    };
    team_member: {
      assets: ['own', 'team'];
      projects: ['own', 'team'];
      settings: 'own';
    };
    team_admin: {
      assets: ['own', 'team'];
      projects: ['own', 'team'];
      settings: ['own', 'team'];
    };
    org_admin: {
      assets: ['own', 'team', 'organization'];
      projects: ['own', 'team', 'organization'];
      settings: ['own', 'team', 'organization'];
    };
  };
}

// Permission checking
class PermissionEngine {
  hasPermission(
    user: User,
    resource: string,
    action: string,
    scope: string
  ): boolean {
    // Check user role permissions
    const rolePermissions = this.getRolePermissions(user.role);
    if (rolePermissions[resource]?.includes(scope)) {
      return true;
    }
    
    // Check specific user permissions
    const userPermissions = user.permissions || [];
    return userPermissions.some(p => 
      p.resource === resource && 
      p.action === action && 
      p.scope === scope
    );
  }
  
  canAccessAsset(user: User, asset: LibraryAsset): boolean {
    const ownership = asset.customMetadata?.ownership as EnhancedAssetOwnership;
    
    // Owner has full access
    if (ownership?.ownerId === user.id) return true;
    
    // Check collaborator permissions
    const collaborator = ownership?.collaborators.find(c => c.userId === user.id);
    if (collaborator) return true;
    
    // Check visibility permissions
    switch (ownership?.visibility) {
      case 'public':
        return true;
      case 'team':
        return user.teamIds.includes(ownership.ownerId);
      case 'organization':
        return user.organizationId === ownership.ownerId;
      default:
        return false;
    }
  }
}
```

## 🎨 User Interface Components

### **Authentication UI**
```typescript
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check for existing session
    checkAuthState();
  }, []);
  
  const checkAuthState = async () => {
    try {
      // Check localStorage for anonymous user
      const anonymousUser = localStorage.getItem('kineticore_anonymous_user');
      if (anonymousUser) {
        setUser(JSON.parse(anonymousUser));
        setLoading(false);
        return;
      }
      
      // Check Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const user = await fetchUserProfile(session.user.id);
        setUser(user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <AuthLoadingScreen />;
  }
  
  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }
  
  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

const LoginScreen: React.FC<{ onLogin: (user: User) => void }> = ({ onLogin }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'anonymous'>('signin');
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">kinetiCORE</h1>
          <p className="text-gray-600 mt-2">Industrial Simulation Platform</p>
        </div>
        
        {/* Anonymous Access */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Try Without Account</h3>
          <p className="text-sm text-blue-700 mb-3">
            Start using kinetiCORE immediately with local-only features
          </p>
          <button
            onClick={() => onLogin(createAnonymousUser())}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Continue Anonymously
          </button>
        </div>
        
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or sign in with</span>
          </div>
        </div>
        
        {/* Google OAuth */}
        <button
          onClick={() => signInWithGoogle()}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <GoogleIcon className="w-5 h-5 mr-2" />
          Continue with Google
        </button>
        
        {/* Email/Password */}
        <div className="mt-4">
          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
        
        {mode !== 'anonymous' && (
          <EmailPasswordForm mode={mode} onSuccess={onLogin} />
        )}
      </div>
    </div>
  );
};
```

### **User Profile Management**
```typescript
const UserProfile: React.FC = () => {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Profile</h2>
          <button
            onClick={() => setEditing(!editing)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {editing ? 'Save' : 'Edit'}
          </button>
        </div>
        
        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-xl font-medium text-gray-600">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-medium">{user.name}</h3>
              <p className="text-gray-600">{user.email}</p>
              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {user.role.name}
              </span>
            </div>
          </div>
          
          {/* User Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              {editing ? (
                <input
                  type="text"
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900">{user.name}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <p className="text-gray-900">{user.email}</p>
            </div>
          </div>
          
          {/* Preferences */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Preferences</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Auto-sync with cloud</span>
                <input
                  type="checkbox"
                  checked={user.preferences.autoSync}
                  onChange={(e) => setUser({
                    ...user,
                    preferences: { ...user.preferences, autoSync: e.target.checked }
                  })}
                  className="rounded"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Default asset visibility</span>
                <select
                  value={user.preferences.defaultAssetVisibility}
                  onChange={(e) => setUser({
                    ...user,
                    preferences: { 
                      ...user.preferences, 
                      defaultAssetVisibility: e.target.value as any 
                    }
                  })}
                  className="px-3 py-1 border border-gray-300 rounded"
                >
                  <option value="private">Private</option>
                  <option value="team">Team</option>
                  <option value="organization">Organization</option>
                  <option value="public">Public</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Usage Statistics */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Usage Statistics</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">42</p>
                <p className="text-sm text-gray-600">Assets</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">8</p>
                <p className="text-sm text-gray-600">Projects</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">1.2GB</p>
                <p className="text-sm text-gray-600">Storage</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

### **Team Management UI**
```typescript
const TeamManagement: React.FC = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Teams</h2>
        <button
          onClick={() => setShowCreateTeam(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Team
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>
      
      {showCreateTeam && (
        <CreateTeamDialog
          onClose={() => setShowCreateTeam(false)}
          onCreate={(team) => {
            setTeams(prev => [...prev, team]);
            setShowCreateTeam(false);
          }}
        />
      )}
    </div>
  );
};

const TeamCard: React.FC<{ team: Team }> = ({ team }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">{team.name}</h3>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
          {team.members.length} members
        </span>
      </div>
      
      <p className="text-gray-600 text-sm mb-4">{team.description}</p>
      
      <div className="flex items-center space-x-2">
        <button className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          View
        </button>
        <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Manage
        </button>
      </div>
    </div>
  );
};
```

## 🔄 State Management

### **User Store (Zustand)**
```typescript
interface UserStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (provider: 'google' | 'email' | 'anonymous', credentials?: any) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  
  // Team actions
  joinTeam: (teamId: string) => Promise<void>;
  leaveTeam: (teamId: string) => Promise<void>;
  createTeam: (teamData: CreateTeamData) => Promise<Team>;
}

const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  
  login: async (provider, credentials) => {
    set({ isLoading: true, error: null });
    
    try {
      let user: User;
      
      switch (provider) {
        case 'anonymous':
          user = createAnonymousUser();
          localStorage.setItem('kineticore_anonymous_user', JSON.stringify(user));
          break;
          
        case 'google':
          user = await signInWithGoogle();
          break;
          
        case 'email':
          user = await signInWithEmail(credentials.email, credentials.password);
          break;
      }
      
      set({ 
        user, 
        isAuthenticated: true, 
        isLoading: false 
      });
      
      // Initialize asset manager with user context
      const assetManager = UserAwareAssetManager.getInstance();
      await assetManager.initialize(user);
      
    } catch (error) {
      set({ 
        error: error.message, 
        isLoading: false 
      });
    }
  },
  
  logout: () => {
    localStorage.removeItem('kineticore_anonymous_user');
    set({ 
      user: null, 
      isAuthenticated: false 
    });
  },
  
  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return;
    
    const updatedUser = { ...user, ...updates };
    set({ user: updatedUser });
    
    // Update in backend
    await updateUserProfile(updatedUser);
  },
  
  refreshUser: async () => {
    const { user } = get();
    if (!user || user.isAnonymous) return;
    
    const refreshedUser = await fetchUserProfile(user.id);
    set({ user: refreshedUser });
  },
  
  joinTeam: async (teamId) => {
    // Implementation for joining team
  },
  
  leaveTeam: async (teamId) => {
    // Implementation for leaving team
  },
  
  createTeam: async (teamData) => {
    // Implementation for creating team
    return {} as Team;
  }
}));
```

## 🚀 Implementation Phases

### **Phase 1: Anonymous Users (Week 1)**
- ✅ Local-only mode with anonymous user
- ✅ Basic user preferences
- ✅ Asset ownership tracking
- ✅ Graceful degradation for offline use

### **Phase 2: Cloud Authentication (Week 2)**
- 🔄 Supabase Auth integration
- 🔄 Google OAuth
- 🔄 Email/password authentication
- 🔄 User profile management
- 🔄 Cloud asset sync

### **Phase 3: Team Features (Week 3)**
- ⏳ Team creation and management
- ⏳ Team-based asset sharing
- ⏳ Role-based permissions
- ⏳ Team analytics

### **Phase 4: Enterprise Features (Week 4)**
- ⏳ Organization management
- ⏳ SSO integration
- ⏳ Advanced compliance features
- ⏳ Enterprise analytics

## 🎯 Key Benefits

### **For Individual Users**
- **Zero friction**: Start using immediately with anonymous mode
- **Progressive enhancement**: Add authentication when needed
- **Privacy first**: Local data stays local by default

### **For Teams**
- **Seamless collaboration**: Share assets within teams
- **Role-based access**: Control who can do what
- **Team analytics**: Understand usage patterns

### **For Enterprises**
- **Enterprise security**: SSO, LDAP, audit logs
- **Compliance ready**: GDPR, SOX, HIPAA support
- **Scalable architecture**: Handle thousands of users

This user management system provides a smooth path from individual use to enterprise deployment while maintaining security and usability at every level.
