/**
 * ThemeContext - Global theme management for kinetiCORE
 *
 * Provides theme switching between different color schemes:
 * - cyan: Modern cyan/turquoise accent (default, matches splash screen)
 * - classic: Classic violet/blue accent (original design)
 *
 * Usage:
 * ```tsx
 * import { useTheme } from './core/ThemeContext';
 *
 * function MyComponent() {
 *   const { theme, setTheme, toggleTheme } = useTheme();
 *   return <button onClick={toggleTheme}>Current: {theme}</button>;
 * }
 * ```
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'cyan' | 'classic';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'cyan'
}) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Try to load saved theme from localStorage
    const saved = localStorage.getItem('kineticore-theme');
    if (saved === 'cyan' || saved === 'classic') {
      return saved;
    }
    return defaultTheme;
  });

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Save to localStorage
    localStorage.setItem('kineticore-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'cyan' ? 'classic' : 'cyan');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 * @throws Error if used outside ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
