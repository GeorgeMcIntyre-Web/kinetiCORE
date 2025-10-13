/**
 * Button Template Component
 * Owner: George
 * 
 * Systematic button implementation to prevent common mistakes
 * Follows the Button Implementation Process guidelines
 */

import React from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Loader2 } from 'lucide-react';

// Base Button component (assuming it exists)
interface BaseButtonProps {
  id?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  className?: string;
  children?: React.ReactNode;
  'data-button-id'?: string;
  'data-button-action'?: string;
}

// Simple button component if it doesn't exist
function BaseButton({
  id,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
  className = '',
  children,
  'data-button-id': dataButtonId,
  'data-button-action': dataButtonAction,
  ...props
}: BaseButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    ghost: 'hover:bg-accent hover:text-accent-foreground'
  };
  
  const sizeClasses = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 py-2',
    lg: 'h-11 px-8 text-lg'
  };
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
  
  return (
    <button
      id={id}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      data-button-id={dataButtonId}
      data-button-action={dataButtonAction}
      {...props}
    >
      {children}
    </button>
  );
}

// Icon component
interface IconProps {
  name: string;
  className?: string;
}

function Icon({ name, className }: IconProps) {
  // This would normally import from lucide-react dynamically
  // For now, we'll use a simple div as placeholder
  return <div className={`icon-${name} ${className}`} />;
}

export interface ButtonTemplateProps {
  // Requirements from Step 1
  id: string;
  label: string;
  icon?: string;
  action: string;
  stateKey: string;
  initialState: any;
  stateType: 'boolean' | 'string' | 'number' | 'object';
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  ariaLabel: string;
  keyboardShortcut?: string;
  storeMethod?: string;
  callback?: (value: any) => void;
  
  // Additional props
  className?: string;
  children?: React.ReactNode;
}

export function ButtonTemplate({
  id,
  label,
  icon,
  action,
  // stateKey,
  initialState,
  stateType,
  variant,
  size,
  disabled = false,
  loading = false,
  ariaLabel,
  keyboardShortcut,
  storeMethod,
  callback,
  className,
  children
}: ButtonTemplateProps) {
  const { 
    getButtonState, 
    setButtonState, 
    executeButtonAction,
    registerButtonAction 
  } = useEditorStore();
  
  // Initialize button state if not exists
  React.useEffect(() => {
    const currentState = getButtonState(id);
    if (currentState === undefined) {
      console.log(`[ButtonTemplate] Initializing button ${id} with state:`, initialState);
      setButtonState(id, initialState);
    }
  }, [id, initialState, getButtonState, setButtonState]);
  
  // Register button action
  React.useEffect(() => {
    const actionHandler = (value?: any) => {
      try {
        console.log(`[ButtonTemplate] Executing action for button ${id}:`, { action, value });
        
        // Execute store method if provided
        if (storeMethod) {
          const store = useEditorStore.getState();
          if (typeof (store as any)[storeMethod] === 'function') {
            console.log(`[ButtonTemplate] Calling store method: ${storeMethod}`);
            (store as any)[storeMethod](value);
          } else {
            console.warn(`[ButtonTemplate] Store method not found: ${storeMethod}`);
          }
        }
        
        // Execute custom callback if provided
        if (callback) {
          console.log(`[ButtonTemplate] Executing custom callback for button ${id}`);
          callback(value);
        }
        
        // Update button state
        const newValue = stateType === 'boolean' ? !getButtonState(id) : value;
        setButtonState(id, newValue);
        
        console.log(`[ButtonTemplate] Button ${id} executed action: ${action}, new state:`, newValue);
      } catch (error) {
        console.error(`[ButtonTemplate] Error executing button ${id}:`, error);
      }
    };
    
    registerButtonAction(id, actionHandler);
  }, [id, action, storeMethod, callback, stateType, getButtonState, setButtonState, registerButtonAction]);
  
  // Handle click
  const handleClick = () => {
    if (disabled || loading) {
      console.log(`[ButtonTemplate] Button ${id} click ignored (disabled: ${disabled}, loading: ${loading})`);
      return;
    }
    
    const currentValue = getButtonState(id);
    console.log(`[ButtonTemplate] Button ${id} clicked, current value:`, currentValue);
    executeButtonAction(id, currentValue);
  };
  
  // Handle keyboard shortcut
  React.useEffect(() => {
    if (!keyboardShortcut) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (keyboardShortcut.toLowerCase() === key) {
          event.preventDefault();
          console.log(`[ButtonTemplate] Keyboard shortcut triggered for button ${id}: Ctrl+${key}`);
          handleClick();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcut, id]);
  
  // Get current state for visual feedback
  const currentState = getButtonState(id);
  const isActive = stateType === 'boolean' ? currentState : false;
  
  return (
    <BaseButton
      id={id}
      variant={variant}
      size={size}
      disabled={disabled || loading}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-pressed={stateType === 'boolean' ? isActive : undefined}
      className={className}
      data-button-id={id}
      data-button-action={action}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {icon && <Icon name={icon} className="w-4 h-4" />}
          {label}
        </>
      )}
      {children}
    </BaseButton>
  );
}
