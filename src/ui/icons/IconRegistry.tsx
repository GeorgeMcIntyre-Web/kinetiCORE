/**
 * Centralized Icon Registry
 * Owner: George
 * 
 * Provides consistent icon mapping across all toolbars and UI components
 * Maps semantic actions to Lucide React icons with proper sizing and styling
 */

import React from 'react';
import {
  // Transform & Movement
  Move,
  RotateCw,
  RotateCcw,
  Scale,
  
  // File Operations
  Upload,
  Download,
  Save,
  FolderOpen,
  FolderPlus,
  
  // Object Creation
  Box,
  Circle,
  Cylinder,
  
  // Physics & Simulation
  Zap,
  Play,
  Pause,
  Square,
  
  // Kinematics & Robotics
  GitBranch,
  Link,
  Settings,
  Cog,
  
  // Boolean Operations
  Plus,
  Minus,
  X,
  Scissors,
  
  // Views & Navigation
  Layers,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  
  // Search & Filter
  Search,
  Filter,
  
  // Status & Feedback
  Check,
  XCircle,
  AlertTriangle,
  Info,
  
  // Tools & Utilities
  Wrench,
  Package,
  Grid3x3,
  List,
  
  // Arrows & Directions
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  
  // Specialized
  Hand,
  Grip,
  Target,
  Crosshair
} from 'lucide-react';

/**
 * Icon size variants
 */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Icon style variants
 */
export type IconStyle = 'default' | 'outline' | 'filled' | 'minimal';

/**
 * Icon configuration
 */
export interface IconConfig {
  size: IconSize;
  style: IconStyle;
  className?: string;
  color?: string;
  strokeWidth?: number;
}

/**
 * Semantic icon mappings
 */
export const IconRegistry = {
  // Transform Operations
  transform: {
    move: Move,
    translate: Move,
    rotate: RotateCw,
    scale: Scale,
    reset: RotateCcw
  },
  
  // File Operations
  file: {
    upload: Upload,
    import: Upload,
    download: Download,
    export: Download,
    save: Save,
    load: FolderOpen,
    open: FolderOpen,
    new: FolderPlus,
    create: FolderPlus
  },
  
  // Object Creation
  object: {
    box: Box,
    cube: Box,
    sphere: Circle,
    cylinder: Cylinder,
    primitive: Box
  },
  
  // Physics & Simulation
  physics: {
    enable: Zap,
    disable: Square,
    play: Play,
    pause: Pause,
    stop: Square,
    simulate: Play,
    gravity: ArrowDown,
    collision: Target
  },
  
  // Kinematics & Robotics
  kinematics: {
    chain: GitBranch,
    joint: Link,
    configure: Settings,
    setup: Cog,
    robot: Cog,
    gripper: Hand,
    grip: Grip,
    endEffector: Target,
    tcp: Crosshair,
    valve: RotateCw,        // Valve control
    actuator: Move,         // Linear actuator
    motor: RotateCw,        // Servo motor
    sensor: Eye,            // Sensor/feedback
    tool: Wrench,           // Specialized tool
    clamp: Grip,            // Clamping device
    pump: Zap,              // Fluid pump
    gear: Cog,              // Gear mechanism
    bearing: Circle         // Bearing/support
  },
  
  // Boolean Operations
  boolean: {
    union: Plus,
    combine: Plus,
    subtract: Minus,
    difference: Minus,
    intersect: X,
    intersection: X,
    split: Scissors,
    cut: Scissors
  },
  
  // Views & Navigation
  view: {
    projection: Layers,
    orthographic: Layers,
    perspective: Eye,
    hide: EyeOff,
    show: Eye,
    maximize: Maximize2,
    minimize: Minimize2,
    fullscreen: Maximize2
  },
  
  // Search & Filter
  search: {
    search: Search,
    find: Search,
    filter: Filter,
    sort: Filter
  },
  
  // Status & Feedback
  status: {
    success: Check,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
    loading: RotateCw
  },
  
  // Tools & Utilities
  tool: {
    wrench: Wrench,
    settings: Settings,
    configure: Cog,
    package: Package,
    library: Package,
    grid: Grid3x3,
    list: List
  },
  
  // Directions & Movement
  direction: {
    up: ArrowUp,
    down: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight,
    forward: ArrowUp,
    backward: ArrowDown
  }
} as const;

/**
 * Size mapping to pixel values
 */
const SIZE_MAP: Record<IconSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24
};

/**
 * Stroke width mapping
 */
const STROKE_WIDTH_MAP: Record<IconSize, number> = {
  xs: 1.5,
  sm: 1.5,
  md: 2,
  lg: 2,
  xl: 2.5
};

/**
 * Get icon component by semantic path
 */
export function getIcon(path: string): React.ComponentType<any> | null {
  const parts = path.split('.');
  let current: any = IconRegistry;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  
  const result = (typeof current === 'function' || (current && typeof current === 'object' && current.$$typeof === Symbol.for('react.forward_ref'))) ? current : null;
  return result;
}

/**
 * Create icon component with consistent styling
 */
export function createIcon(
  path: string,
  config: Partial<IconConfig> = {}
): React.ReactElement | null {
  const IconComponent = getIcon(path);
  
  if (!IconComponent) {
    console.warn(`Icon not found: ${path}`);
    return null;
  }
  
  const {
    size = 'md',
    style = 'default',
    className = '',
    color,
    strokeWidth
  } = config;
  
  const sizePx = SIZE_MAP[size];
  const defaultStrokeWidth = STROKE_WIDTH_MAP[size];
  
  // Style-specific classes
  const styleClasses = {
    default: '',
    outline: 'icon-outline',
    filled: 'icon-filled',
    minimal: 'icon-minimal'
  };
  
  const combinedClassName = [
    'kineticore-icon',
    styleClasses[style],
    className
  ].filter(Boolean).join(' ');
  
  return React.createElement(IconComponent, {
    size: sizePx,
    className: combinedClassName,
    color,
    strokeWidth: strokeWidth || defaultStrokeWidth
  });
}

/**
 * Predefined icon sets for common use cases
 */
export const IconSets = {
  // Toolbar transform icons
  transformToolbar: {
    move: () => createIcon('transform.move', { size: 'md' }),
    rotate: () => createIcon('transform.rotate', { size: 'md' }),
    scale: () => createIcon('transform.scale', { size: 'md' })
  },
  
  // File operation icons
  fileOperations: {
    import: () => createIcon('file.import', { size: 'md' }),
    export: () => createIcon('file.export', { size: 'md' }),
    save: () => createIcon('file.save', { size: 'md' }),
    load: () => createIcon('file.load', { size: 'md' })
  },
  
  // Object creation icons
  objectCreation: {
    box: () => createIcon('object.box', { size: 'md' }),
    sphere: () => createIcon('object.sphere', { size: 'md' }),
    cylinder: () => createIcon('object.cylinder', { size: 'md' })
  },
  
  // Physics control icons
  physicsControls: {
    enable: () => createIcon('physics.enable', { size: 'md', color: '#10b981' }),
    disable: () => createIcon('physics.disable', { size: 'md', color: '#ef4444' }),
    play: () => createIcon('physics.play', { size: 'md', color: '#3b82f6' }),
    pause: () => createIcon('physics.pause', { size: 'md', color: '#f59e0b' })
  },
  
  // Kinematics icons
  kinematicsControls: {
    setup: () => createIcon('kinematics.setup', { size: 'md' }),
    chain: () => createIcon('kinematics.chain', { size: 'md' }),
    joint: () => createIcon('kinematics.joint', { size: 'md' }),
    gripper: () => createIcon('kinematics.gripper', { size: 'md' })
  },
  
  // Boolean operation icons
  booleanOperations: {
    union: () => createIcon('boolean.union', { size: 'md' }),
    subtract: () => createIcon('boolean.subtract', { size: 'md' }),
    intersect: () => createIcon('boolean.intersect', { size: 'md' }),
    split: () => createIcon('boolean.split', { size: 'md' })
  },
  
  // Status icons
  statusIcons: {
    success: () => createIcon('status.success', { size: 'sm', color: '#10b981' }),
    error: () => createIcon('status.error', { size: 'sm', color: '#ef4444' }),
    warning: () => createIcon('status.warning', { size: 'sm', color: '#f59e0b' }),
    info: () => createIcon('status.info', { size: 'sm', color: '#3b82f6' })
  }
};

/**
 * Icon with tooltip wrapper
 */
export function IconWithTooltip({
  iconPath,
  tooltip,
  shortcut,
  config = {},
  onClick,
  disabled = false
}: {
  iconPath: string;
  tooltip: string;
  shortcut?: string;
  config?: Partial<IconConfig>;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const icon = createIcon(iconPath, {
    ...config,
    className: disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
  });
  
  if (!icon) return null;
  
  const tooltipText = shortcut ? `${tooltip} (${shortcut})` : tooltip;
  
  return (
    <div
      className="icon-with-tooltip"
      title={tooltipText}
      onClick={disabled ? undefined : onClick}
    >
      {icon}
      {shortcut && (
        <kbd className="shortcut-badge">
          {shortcut}
        </kbd>
      )}
    </div>
  );
}

/**
 * Icon button component
 */
export function IconButton({
  iconPath,
  label,
  shortcut,
  config = {},
  onClick,
  disabled = false,
  active = false,
  variant = 'default'
}: {
  iconPath: string;
  label: string;
  shortcut?: string;
  config?: Partial<IconConfig>;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: 'default' | 'primary' | 'secondary' | 'danger';
}) {
  const icon = createIcon(iconPath, config);
  
  if (!icon) return null;
  
  const variantClasses = {
    default: 'icon-button-default',
    primary: 'icon-button-primary',
    secondary: 'icon-button-secondary',
    danger: 'icon-button-danger'
  };
  
  const buttonClasses = [
    'icon-button',
    variantClasses[variant],
    active && 'active',
    disabled && 'disabled'
  ].filter(Boolean).join(' ');
  
  return (
    <button
      className={buttonClasses}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {icon}
      <span className="button-label">{label}</span>
      {shortcut && (
        <kbd className="shortcut-badge">{shortcut}</kbd>
      )}
    </button>
  );
}

/**
 * Icon badge for status indicators
 */
export function IconBadge({
  iconPath,
  config = {},
  badge,
  position = 'top-right'
}: {
  iconPath: string;
  config?: Partial<IconConfig>;
  badge?: React.ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}) {
  const icon = createIcon(iconPath, config);
  
  if (!icon) return null;
  
  return (
    <div className={`icon-badge icon-badge-${position}`}>
      {icon}
      {badge && (
        <div className="icon-badge-content">
          {badge}
        </div>
      )}
    </div>
  );
}

/**
 * Export commonly used icon paths for easy access
 */
export const IconPaths = {
  // Transform
  MOVE: 'transform.move',
  ROTATE: 'transform.rotate',
  SCALE: 'transform.scale',
  
  // File
  IMPORT: 'file.import',
  EXPORT: 'file.export',
  SAVE: 'file.save',
  LOAD: 'file.load',
  
  // Objects
  BOX: 'object.box',
  SPHERE: 'object.sphere',
  CYLINDER: 'object.cylinder',
  
  // Physics
  PHYSICS_ENABLE: 'physics.enable',
  PHYSICS_DISABLE: 'physics.disable',
  PLAY: 'physics.play',
  PAUSE: 'physics.pause',
  
  // Kinematics
  KINEMATICS_SETUP: 'kinematics.setup',
  CHAIN: 'kinematics.chain',
  JOINT: 'kinematics.joint',
  GRIPPER: 'kinematics.gripper',
  VALVE: 'kinematics.valve',
  ACTUATOR: 'kinematics.actuator',
  MOTOR: 'kinematics.motor',
  SENSOR: 'kinematics.sensor',
  TOOL: 'kinematics.tool',
  CLAMP: 'kinematics.clamp',
  PUMP: 'kinematics.pump',
  GEAR: 'kinematics.gear',
  BEARING: 'kinematics.bearing',
  
  // Boolean
  UNION: 'boolean.union',
  SUBTRACT: 'boolean.subtract',
  INTERSECT: 'boolean.intersect',
  SPLIT: 'boolean.split',
  
  // Status
  SUCCESS: 'status.success',
  ERROR: 'status.error',
  WARNING: 'status.warning',
  INFO: 'status.info'
} as const;
