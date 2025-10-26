/**
 * Authentication UI Components
 * Owner: George
 * 
 * React components for user authentication and management
 */

import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Building2,
  Users,
  Shield,
  Zap,
  AlertCircle
} from 'lucide-react';
import { useAuth, useUserPermissions, useTeamManagement } from './UserStore';
import type { User as UserType, Team } from './UserStore';

/**
 * Authentication Provider Component
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <AuthLoadingScreen />;
  }
  
  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }
  
  return <>{children}</>;
};

/**
 * Loading Screen Component
 */
const AuthLoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Loading kinetiCORE</h2>
        <p className="text-gray-600">Initializing user session...</p>
      </div>
    </div>
  );
};

/**
 * Main Login Screen Component
 */
const LoginScreen: React.FC = () => {
  const { login, error } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'anonymous'>('signin');
  const [isLoading, setIsLoading] = useState(false);

  const handleAnonymousLogin = async () => {
    setIsLoading(true);
    try {
      await login('anonymous');
    } catch (error) {
      console.error('Anonymous login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await login('google');
    } catch (error) {
      console.error('Google login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await login('email', { email, password });
    } catch (error) {
      console.error('Email login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-white">K</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">kinetiCORE</h1>
          <p className="text-gray-600 mt-2">Industrial Simulation Platform</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Anonymous Access */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center mb-3">
              <Zap className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="font-semibold text-blue-900">Try Without Account</h3>
            </div>
            <p className="text-sm text-blue-700 mb-4">
              Start using kinetiCORE immediately with local-only features. No signup required.
            </p>
            <button
              onClick={handleAnonymousLogin}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? 'Starting...' : 'Continue Anonymously'}
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or sign in with</span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <div className="w-5 h-5 mr-3 bg-red-500 rounded" />
            Continue with Google
          </button>

          {/* Email/Password Toggle */}
          <div className="mt-4 text-center">
            <button
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>

          {/* Email/Password Form */}
          {mode !== 'anonymous' && (
            <EmailPasswordForm 
              mode={mode} 
              onLogin={handleEmailLogin}
              isLoading={isLoading}
            />
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Shield className="w-6 h-6 text-green-600" />}
            title="Secure"
            description="Your data stays private and secure"
          />
          <FeatureCard
            icon={<Users className="w-6 h-6 text-blue-600" />}
            title="Collaborative"
            description="Share assets with your team"
          />
          <FeatureCard
            icon={<Building2 className="w-6 h-6 text-purple-600" />}
            title="Enterprise Ready"
            description="Scale from individual to enterprise"
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Email/Password Form Component
 */
interface EmailPasswordFormProps {
  mode: 'signin' | 'signup';
  onLogin: (email: string, password: string) => void;
  isLoading: boolean;
}

const EmailPasswordForm: React.FC<EmailPasswordFormProps> = ({ 
  mode, 
  onLogin, 
  isLoading 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (mode === 'signup') {
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onLogin(email, password);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {/* Email Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.email ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter your email"
          />
        </div>
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>

      {/* Password Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.password ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password}</p>
        )}
      </div>

      {/* Confirm Password Field (Signup only) */}
      {mode === 'signup' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Confirm your password"
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
          )}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {isLoading ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
      </button>
    </form>
  );
};

/**
 * Feature Card Component
 */
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <div className="text-center p-4">
      <div className="flex justify-center mb-2">{icon}</div>
      <h3 className="font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
};

/**
 * User Profile Component
 */
export const UserProfile: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  useUserPermissions(); // Hook must be called even if not using hasPermission
  const [editing, setEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!user) return null;

  const handleUpdateProfile = async (updates: Partial<UserType>) => {
    setIsLoading(true);
    try {
      await updateProfile(updates);
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Profile</h2>
          <div className="flex items-center space-x-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateProfile({})}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-xl font-medium text-gray-600">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-medium">{user.name}</h3>
            <p className="text-gray-600">{user.email}</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {user.role.name}
              </span>
              {user.isAnonymous && (
                <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                  Anonymous
                </span>
              )}
            </div>
          </div>
        </div>

        {/* User Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            {editing ? (
              <input
                type="text"
                value={user.name}
                onChange={(e) => handleUpdateProfile({ name: e.target.value })}
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
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Preferences</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Auto-sync with cloud</span>
              <input
                type="checkbox"
                checked={user.preferences.autoSync}
                onChange={(e) => handleUpdateProfile({
                  preferences: { ...user.preferences, autoSync: e.target.checked }
                })}
                className="rounded"
                disabled={user.isAnonymous}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Default asset visibility</span>
              <select
                value={user.preferences.defaultAssetVisibility}
                onChange={(e) => handleUpdateProfile({
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
              <p className="text-2xl font-bold text-blue-600">0</p>
              <p className="text-sm text-gray-600">Assets</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">0</p>
              <p className="text-sm text-gray-600">Projects</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">0MB</p>
              <p className="text-sm text-gray-600">Storage</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Team Management Component
 */
export const TeamManagement: React.FC = () => {
  const { canCreateTeam } = useTeamManagement();
  const [teams, setTeams] = useState<Team[]>([]);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Teams</h2>
        {canCreateTeam && (
          <button
            onClick={() => setShowCreateTeam(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Team
          </button>
        )}
      </div>
      
      {teams.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
          <p className="text-gray-600 mb-4">
            Create a team to start collaborating with others
          </p>
          {canCreateTeam && (
            <button
              onClick={() => setShowCreateTeam(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Your First Team
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
      
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

/**
 * Team Card Component
 */
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

/**
 * Create Team Dialog Component
 */
interface CreateTeamDialogProps {
  onClose: () => void;
  onCreate: (team: Team) => void;
}

const CreateTeamDialog: React.FC<CreateTeamDialogProps> = ({ onClose, onCreate }) => {
  const { createTeam } = useTeamManagement();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    allowPublicAssets: false,
    requireApprovalForSharing: false,
    maxAssetSize: 100
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const team = await createTeam({
        name: formData.name,
        description: formData.description,
        settings: {
          allowPublicAssets: formData.allowPublicAssets,
          requireApprovalForSharing: formData.requireApprovalForSharing,
          maxAssetSize: formData.maxAssetSize,
          allowedFileTypes: ['urdf', 'glb', 'gltf', 'stl', 'obj']
        }
      });
      
      onCreate(team);
    } catch (error) {
      console.error('Failed to create team:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Create Team</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter team name"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Describe your team"
              rows={3}
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Allow public assets</span>
              <input
                type="checkbox"
                checked={formData.allowPublicAssets}
                onChange={(e) => setFormData(prev => ({ ...prev, allowPublicAssets: e.target.checked }))}
                className="rounded"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Require approval for sharing</span>
              <input
                type="checkbox"
                checked={formData.requireApprovalForSharing}
                onChange={(e) => setFormData(prev => ({ ...prev, requireApprovalForSharing: e.target.checked }))}
                className="rounded"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
