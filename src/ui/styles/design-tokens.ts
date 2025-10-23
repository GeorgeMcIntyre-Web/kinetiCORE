/**
 * Design System Tokens for kinetiCORE
 * 
 * Provides consistent spacing, colors, z-index values, and component sizes
 * across the application. Based on Tailwind CSS design system.
 */

export const spacing = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
  '3xl': '4rem',  // 64px
} as const;

export const colors = {
  // Primary brand colors - Cyan theme (matches splash screen)
  primary: {
    50: '#e0f7ff',
    100: '#b3ecff',
    200: '#80e0ff',
    300: '#4dd4ff',
    400: '#26c9ff',
    500: '#00f0ff',  // Main cyan from splash screen
    600: '#00d4e6',
    700: '#00b8cc',
    800: '#009cb3',
    900: '#007a8c',
  },
  
  // Neutral grays
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // Status colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
} as const;

export const zIndex = {
  base: 0,
  dropdown: 10,
  toolbar: 20,
  sidebar: 30,
  modal: 50,
  toast: 100,
  tooltip: 200,
} as const;

export const panelSizes = {
  sm: 'max-w-md',    // 448px
  md: 'max-w-2xl',   // 672px
  lg: 'max-w-4xl',   // 896px
  xl: 'max-w-6xl',   // 1152px
  '2xl': 'max-w-7xl', // 1280px
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
} as const;

export const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px', // Extra large desktop
} as const;

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Consolas', 'monospace'],
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

export const transitions = {
  duration: {
    75: '75ms',
    100: '100ms',
    150: '150ms',
    200: '200ms',
    300: '300ms',
    500: '500ms',
    700: '700ms',
    1000: '1000ms',
  },
  timing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// Component-specific tokens
export const components = {
  button: {
    height: {
      sm: '2rem',     // 32px
      md: '2.5rem',   // 40px
      lg: '3rem',     // 48px
    },
    padding: {
      sm: '0.5rem 0.75rem',
      md: '0.625rem 1rem',
      lg: '0.75rem 1.5rem',
    },
  },
  
  input: {
    height: {
      sm: '2rem',     // 32px
      md: '2.5rem',   // 40px
      lg: '3rem',     // 48px
    },
    padding: {
      sm: '0.5rem 0.75rem',
      md: '0.625rem 0.75rem',
      lg: '0.75rem 1rem',
    },
  },
  
  panel: {
    header: {
      height: '3.5rem', // 56px
      padding: '1rem',
    },
    content: {
      padding: '1rem',
    },
    footer: {
      height: '3rem',   // 48px
      padding: '0.75rem 1rem',
    },
  },
  
  sidebar: {
    width: {
      sm: '16rem',    // 256px
      md: '20rem',    // 320px
      lg: '24rem',    // 384px
    },
  },
  
  toolbar: {
    height: '3rem',     // 48px
    padding: '0.5rem 1rem',
  },
} as const;

// Utility functions for common patterns
export const createShadow = (level: keyof typeof shadows) => shadows[level];
export const createSpacing = (size: keyof typeof spacing) => spacing[size];
export const createZIndex = (level: keyof typeof zIndex) => zIndex[level];
export const createBorderRadius = (size: keyof typeof borderRadius) => borderRadius[size];

// CSS-in-JS helpers
export const cssVars = {
  '--spacing-xs': spacing.xs,
  '--spacing-sm': spacing.sm,
  '--spacing-md': spacing.md,
  '--spacing-lg': spacing.lg,
  '--spacing-xl': spacing.xl,
  '--z-toolbar': zIndex.toolbar.toString(),
  '--z-modal': zIndex.modal.toString(),
  '--z-toast': zIndex.toast.toString(),
} as const;
