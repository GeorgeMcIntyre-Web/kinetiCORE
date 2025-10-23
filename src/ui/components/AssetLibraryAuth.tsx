/**
 * Authentication Component for Asset Library
 * File: src/ui/components/AssetLibraryAuth.tsx
 * Owner: George
 * 
 * Login/logout functionality integrated with Cloudflare Supabase proxy
 */

import React, { useState, useEffect } from 'react';
import { 
  LogIn, 
  LogOut, 
  User, 
  UserPlus,
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase, supabaseHelpers } from '../../lib/supabase-client';

interface AuthState {
  user: any | null;
  loading: boolean;
  error: string | null;
}

interface LoginFormData {
  email: string;
  password: string;
}

interface AssetLibraryAuthProps {
  onAuthChange?: (user: any | null) => void;
  className?: string;
}

export const AssetLibraryAuth: React.FC<AssetLibraryAuthProps> = ({
  onAuthChange,
  className = ''
}) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  });
  
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showSignUpForm, setShowSignUpForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    checkAuthState();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthState(prev => ({
          ...prev,
          user: session?.user || null,
          loading: false
        }));
        onAuthChange?.(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }, [onAuthChange]);

  const checkAuthState = async () => {
    try {
      const user = await supabaseHelpers.getCurrentUser();
      setAuthState(prev => ({
        ...prev,
        user,
        loading: false
      }));
      onAuthChange?.(user);
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to check authentication state'
      }));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthState(prev => ({ ...prev, error: null }));

    try {
      const { data, error } = await supabaseHelpers.signIn(formData.email, formData.password);
      
      if (error) {
        setAuthState(prev => ({ ...prev, error: error.message }));
      } else {
        setShowLoginForm(false);
        setFormData({ email: '', password: '' });
      }
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, error: error.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthState(prev => ({ ...prev, error: null }));

    try {
      const { data, error } = await supabaseHelpers.signUp(formData.email, formData.password);
      
      if (error) {
        setAuthState(prev => ({ ...prev, error: error.message }));
      } else {
        setShowSignUpForm(false);
        setFormData({ email: '', password: '' });
        // Show success message
        setAuthState(prev => ({ 
          ...prev, 
          error: 'Check your email for verification link!' 
        }));
      }
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, error: error.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabaseHelpers.signOut();
      setShowLoginForm(false);
      setShowSignUpForm(false);
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, error: error.message }));
    }
  };

  const toggleForm = () => {
    setShowLoginForm(!showLoginForm);
    setShowSignUpForm(false);
    setAuthState(prev => ({ ...prev, error: null }));
  };

  const toggleSignUpForm = () => {
    setShowSignUpForm(!showSignUpForm);
    setShowLoginForm(false);
    setAuthState(prev => ({ ...prev, error: null }));
  };

  if (authState.loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Checking auth...</span>
      </div>
    );
  }

  if (authState.user) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {/* User Info - Compact */}
        <div className="flex items-center space-x-1 text-xs user-info">
          <User className="w-3 h-3 text-green-400" />
          <span className="font-medium max-w-24 truncate">
            {authState.user.email.split('@')[0]}
          </span>
        </div>
        
        {/* Logout Button - Icon Only */}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
          title={`Logout ${authState.user.email}`}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Login Button - Icon Only */}
      <button
        onClick={toggleForm}
        className="asset-library-control-btn"
        title="Login to access your assets"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: 'white',
          borderRadius: '6px',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        <LogIn size={16} style={{ color: 'white' }} />
      </button>

      {/* Login Form Dropdown - Pro Theme */}
      {showLoginForm && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg shadow-2xl z-50" style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
          border: '2px solid #ffd700',
          boxShadow: '0 20px 40px rgba(255, 215, 0, 0.3), 0 0 0 1px rgba(255, 215, 0, 0.1)'
        }}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ 
                background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Pro Login
              </h3>
              <button
                onClick={toggleForm}
                className="text-gray-400 hover:text-white transition-colors"
                style={{ fontSize: '20px' }}
              >
                ×
              </button>
            </div>

            {authState.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                  <span className="text-sm text-red-700">{authState.error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 rounded-lg transition-all duration-200"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 215, 0, 0.3)',
                      color: 'white'
                    }}
                    placeholder="Enter your email"
                    required
                    onFocus={(e) => {
                      e.target.style.border = '1px solid #ffd700';
                      e.target.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.target.style.border = '1px solid rgba(255, 215, 0, 0.3)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    onKeyDown={(e) => {
                      // Ensure all keyboard events work properly
                      e.stopPropagation();
                    }}
                    className="w-full pl-10 pr-10 py-3 rounded-lg transition-all duration-200"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 215, 0, 0.3)',
                      color: 'white'
                    }}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    onFocus={(e) => {
                      e.target.style.border = '1px solid #ffd700';
                      e.target.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.target.style.border = '1px solid rgba(255, 215, 0, 0.3)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white hover:text-yellow-300 transition-colors"
                    style={{ 
                      background: 'transparent', 
                      border: 'none',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                    color: '#1a1a1a',
                    border: '1px solid #ffd700',
                    boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)',
                    fontWeight: '600'
                  }}
                  onMouseEnter={(e) => {
                    if (!e.target.disabled) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.4)';
                      e.target.style.background = 'linear-gradient(135deg, #ffed4e, #ffd700)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
                    e.target.style.background = 'linear-gradient(135deg, #ffd700, #ffed4e)';
                  }}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" style={{ color: '#1a1a1a' }} />
                  ) : (
                    <LogIn className="w-4 h-4 mr-2" style={{ color: '#1a1a1a' }} />
                  )}
                  Pro Login
                </button>
                
                <button
                  type="button"
                  onClick={toggleSignUpForm}
                  className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    minWidth: '100px',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 215, 0, 0.1)';
                    e.target.style.borderColor = '#ffd700';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                  }}
                >
                  Sign Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign Up Form Dropdown - Pro Theme */}
      {showSignUpForm && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg shadow-2xl z-50" style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
          border: '2px solid #ffd700',
          boxShadow: '0 20px 40px rgba(255, 215, 0, 0.3), 0 0 0 1px rgba(255, 215, 0, 0.1)'
        }}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{
                background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Pro Sign Up
              </h3>
              <button
                onClick={toggleSignUpForm}
                className="text-gray-400 hover:text-white transition-colors"
                style={{ fontSize: '20px' }}
              >
                ×
              </button>
            </div>

            {authState.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                  <span className="text-sm text-red-700">{authState.error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 rounded-lg transition-all duration-200"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 215, 0, 0.3)',
                      color: 'white'
                    }}
                    placeholder="Enter your email"
                    required
                    onFocus={(e) => {
                      e.target.style.border = '1px solid #ffd700';
                      e.target.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.target.style.border = '1px solid rgba(255, 215, 0, 0.3)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    onKeyDown={(e) => {
                      // Ensure all keyboard events work properly
                      e.stopPropagation();
                    }}
                    className="w-full pl-10 pr-10 py-3 rounded-lg transition-all duration-200"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 215, 0, 0.3)',
                      color: 'white'
                    }}
                    placeholder="Create a password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    onFocus={(e) => {
                      e.target.style.border = '1px solid #ffd700';
                      e.target.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.target.style.border = '1px solid rgba(255, 215, 0, 0.3)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white hover:text-yellow-300 transition-colors"
                    style={{ 
                      background: 'transparent', 
                      border: 'none',
                      padding: '4px',
                      borderRadius: '4px'
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                    color: '#1a1a1a',
                    border: '1px solid #ffd700',
                    boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)',
                    fontWeight: '600',
                    minWidth: '140px',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    if (!e.target.disabled) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.4)';
                      e.target.style.background = 'linear-gradient(135deg, #ffed4e, #ffd700)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
                    e.target.style.background = 'linear-gradient(135deg, #ffd700, #ffed4e)';
                  }}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" style={{ color: '#1a1a1a' }} />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" style={{ color: '#1a1a1a' }} />
                  )}
                  Pro Sign Up
                </button>

                <button
                  type="button"
                  onClick={toggleSignUpForm}
                  className="px-6 py-3 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    minWidth: '100px',
                    textAlign: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 215, 0, 0.1)';
                    e.target.style.borderColor = '#ffd700';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                  }}
                >
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
