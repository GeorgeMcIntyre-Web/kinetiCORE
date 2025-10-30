import React, { useState } from 'react';
import { Menu, X, Settings, HelpCircle, Zap, ZapOff, ZapIcon } from 'lucide-react';
import { zIndex, colors } from '../styles/design-tokens';
import { RibbonToolbar, RibbonToolbarProps } from './RibbonToolbar';
import { useTheme } from '../core/ThemeContext';

export interface HeaderProps {
  currentMode: 'essential' | 'professional' | 'expert';
  onModeChange: (mode: 'essential' | 'professional' | 'expert') => void;
  onSettingsClick: () => void;
  onHelpClick: () => void;
  className?: string;
  style?: React.CSSProperties;
  ribbonProps?: RibbonToolbarProps;
}

const modeConfig = {
  essential: {
    label: 'Essential',
    icon: ZapOff,
    description: 'Simplified interface for basic operations',
    color: colors.primary[500],
  },
  professional: {
    label: 'Professional',
    icon: Zap,
    description: 'Full feature set for advanced users',
    color: colors.success[500],
  },
  expert: {
    label: 'Expert',
    icon: ZapIcon,
    description: 'Complete toolkit for power users',
    color: colors.warning[500],
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onModeChange,
  onSettingsClick,
  onHelpClick,
  className = '',
  style = {},
  ribbonProps,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const currentModeConfig = modeConfig[currentMode];
  const CurrentModeIcon = currentModeConfig.icon;

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-700
        ${className}
      `}
      style={{ zIndex: zIndex.toolbar, ...style }}
    >
      {/* Single Row: Logo, Ribbon, Mode Switcher, Actions */}
      <div className="flex items-center justify-between px-4 py-2 gap-4">
        {/* Logo and App Name */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/50">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">kinetic CORE</h1>
            <p className="text-xs text-gray-400">Industrial Simulation</p>
          </div>
        </div>

        {/* Ribbon Toolbar - Centered */}
        {ribbonProps && (
          <div className="flex-1 flex justify-center overflow-x-auto">
            <RibbonToolbar {...ribbonProps} />
          </div>
        )}

        {/* Right side: Theme + Mode Switcher + Actions */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="hidden md:inline-flex items-center gap-2 px-2 py-1.5 rounded-md border bg-white border-gray-200 hover:bg-gray-50 transition-colors"
            title={`Theme: ${theme}`}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: 'var(--kc-accent)' }}
            />
          </button>
          {/* Mode Switcher - Desktop */}
          <div className="hidden md:block">
        <div className="relative">
          <button
            onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
            className={`
              flex items-center space-x-1 px-2 py-1.5 rounded-md border
              transition-colors duration-200
              ${isModeMenuOpen 
                ? 'bg-gray-50 border-gray-300' 
                : 'bg-white border-gray-200 hover:bg-gray-50'
              }
            `}
            title={`${currentModeConfig.label} - ${currentModeConfig.description}`}
          >
            <CurrentModeIcon 
              className="w-3.5 h-3.5" 
              style={{ color: currentModeConfig.color }}
            />
            <div className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: currentModeConfig.color }} />
          </button>

          {/* Mode Dropdown */}
          {isModeMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="p-2">
                {Object.entries(modeConfig).map(([mode, config]) => {
                  const Icon = config.icon;
                  const isActive = mode === currentMode;
                  
                  return (
                    <button
                      key={mode}
                      onClick={() => {
                        onModeChange(mode as 'essential' | 'professional' | 'expert');
                        setIsModeMenuOpen(false);
                      }}
                      className={`
                        w-full flex items-start space-x-3 p-3 rounded-lg
                        transition-colors duration-200 text-left
                        ${isActive 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'hover:bg-gray-50'
                        }
                      `}
                    >
                      <Icon 
                        className="w-5 h-5 mt-0.5 flex-shrink-0" 
                        style={{ color: config.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>
                            {config.label}
                          </span>
                          {isActive && (
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                          )}
                        </div>
                        <p className={`text-xs mt-1 ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
                          {config.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

          {/* Action Buttons */}
          <button
            onClick={onSettingsClick}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors duration-200"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <button
            onClick={onHelpClick}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors duration-200"
            title="Help & Documentation"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors duration-200"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg md:hidden">
          <div className="p-4 space-y-4">
            {/* Mobile Mode Switcher */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Interface Mode</h3>
              {Object.entries(modeConfig).map(([mode, config]) => {
                const Icon = config.icon;
                const isActive = mode === currentMode;
                
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      onModeChange(mode as 'essential' | 'professional' | 'expert');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`
                      w-full flex items-center space-x-3 p-3 rounded-lg
                      transition-colors duration-200 text-left
                      ${isActive 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'hover:bg-gray-50'
                      }
                    `}
                  >
                    <Icon 
                      className="w-5 h-5 flex-shrink-0" 
                      style={{ color: config.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${isActive ? 'text-blue-900' : 'text-gray-900'}`}>
                          {config.label}
                        </span>
                        {isActive && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                        )}
                      </div>
                      <p className={`text-xs mt-1 ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
                        {config.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close mode menu */}
      {isModeMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsModeMenuOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;
