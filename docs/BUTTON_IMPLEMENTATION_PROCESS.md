# Button Implementation Process - Developer Guide

## Overview

This document establishes a systematic process for implementing buttons in kinetiCORE to prevent common mistakes and ensure reliable functionality.

## Common Mistakes We've Encountered

1. **Missing State Management**: Buttons created but not connected to store state
2. **Incomplete Event Handlers**: onClick handlers missing or incomplete
3. **Missing Dependencies**: useEffect dependencies not properly declared
4. **Store Integration**: Buttons not properly integrated with editorStore
5. **Type Safety**: Missing TypeScript types for button props
6. **Accessibility**: Missing ARIA labels and keyboard support
7. **Visual Feedback**: No loading states or disabled states
8. **Error Handling**: No error boundaries or fallback states

## Systematic Button Implementation Process

### Step 1: Define Button Requirements

Before writing any code, document:

```typescript
interface ButtonRequirements {
  // Functional Requirements
  id: string;                    // Unique identifier
  label: string;                 // Display text
  icon?: string;                 // Lucide icon name
  action: string;                // What the button does
  
  // State Requirements
  stateKey: string;              // Key in editorStore
  initialState: any;             // Default state value
  stateType: 'boolean' | 'string' | 'number' | 'object';
  
  // UI Requirements
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;            // When button should be disabled
  loading?: boolean;             // When button shows loading state
  
  // Accessibility
  ariaLabel: string;            // Screen reader text
  keyboardShortcut?: string;    // Keyboard shortcut
  
  // Integration
  storeMethod?: string;         // Method to call on editorStore
  callback?: (value: any) => void; // Custom callback
}
```

### Step 2: Update Store Interface

**File**: `src/ui/store/editorStore.ts`

```typescript
// Add to EditorState interface
interface EditorState {
  // ... existing state
  
  // NEW: Button states
  buttonStates: {
    [buttonId: string]: any;
  };
  
  // NEW: Button actions
  buttonActions: {
    [buttonId: string]: (value: any) => void;
  };
}

// Add to EditorStore class
class EditorStore {
  // ... existing methods
  
  // NEW: Button state management
  setButtonState(buttonId: string, value: any): void {
    this.setState(state => ({
      buttonStates: {
        ...state.buttonStates,
        [buttonId]: value
      }
    }));
  }
  
  getButtonState(buttonId: string): any {
    return this.state.buttonStates[buttonId];
  }
  
  // NEW: Button action management
  registerButtonAction(buttonId: string, action: (value: any) => void): void {
    this.setState(state => ({
      buttonActions: {
        ...state.buttonActions,
        [buttonId]: action
      }
    }));
  }
  
  executeButtonAction(buttonId: string, value?: any): void {
    const action = this.state.buttonActions[buttonId];
    if (action) {
      action(value);
    } else {
      console.warn(`[EditorStore] No action registered for button: ${buttonId}`);
    }
  }
}
```

### Step 3: Create Button Component Template

**File**: `src/ui/components/buttons/ButtonTemplate.tsx`

```typescript
import React from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button'; // Assuming we have a base Button component
import { Loader2 } from 'lucide-react';

interface ButtonTemplateProps {
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
  stateKey,
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
      setButtonState(id, initialState);
    }
  }, [id, initialState, getButtonState, setButtonState]);
  
  // Register button action
  React.useEffect(() => {
    const actionHandler = (value?: any) => {
      try {
        // Execute store method if provided
        if (storeMethod) {
          const store = useEditorStore.getState();
          if (typeof store[storeMethod] === 'function') {
            store[storeMethod](value);
          } else {
            console.warn(`[ButtonTemplate] Store method not found: ${storeMethod}`);
          }
        }
        
        // Execute custom callback if provided
        if (callback) {
          callback(value);
        }
        
        // Update button state
        const newValue = stateType === 'boolean' ? !getButtonState(id) : value;
        setButtonState(id, newValue);
        
        console.log(`[ButtonTemplate] Button ${id} executed action: ${action}`);
      } catch (error) {
        console.error(`[ButtonTemplate] Error executing button ${id}:`, error);
      }
    };
    
    registerButtonAction(id, actionHandler);
  }, [id, action, storeMethod, callback, stateType, getButtonState, setButtonState, registerButtonAction]);
  
  // Handle click
  const handleClick = () => {
    if (disabled || loading) return;
    
    const currentValue = getButtonState(id);
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
          handleClick();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [keyboardShortcut]);
  
  // Get current state for visual feedback
  const currentState = getButtonState(id);
  const isActive = stateType === 'boolean' ? currentState : false;
  
  return (
    <Button
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
    </Button>
  );
}
```

### Step 4: Create Specific Button Components

**File**: `src/ui/components/buttons/SnapTypeButton.tsx`

```typescript
import React from 'react';
import { ButtonTemplate } from './ButtonTemplate';

interface SnapTypeButtonProps {
  snapType: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

export function SnapTypeButton({ 
  snapType, 
  label, 
  icon, 
  disabled = false 
}: SnapTypeButtonProps) {
  return (
    <ButtonTemplate
      id={`snap_${snapType}`}
      label={label}
      icon={icon}
      action={`Toggle ${snapType} snapping`}
      stateKey={`snapSettings.${snapType}`}
      initialState={false}
      stateType="boolean"
      variant="ghost"
      size="sm"
      disabled={disabled}
      ariaLabel={`Toggle ${label} snapping`}
      keyboardShortcut={snapType.charAt(0)} // First letter as shortcut
      storeMethod="toggleSnapType"
      callback={(value) => {
        console.log(`[SnapTypeButton] ${snapType} snapping: ${value}`);
      }}
    />
  );
}
```

### Step 5: Integration Checklist

Before deploying any button, verify:

- [ ] **Store Integration**: Button state properly managed in editorStore
- [ ] **Event Handling**: onClick handler properly connected
- [ ] **State Persistence**: Button state persists across component re-renders
- [ ] **Type Safety**: All props properly typed
- [ ] **Accessibility**: ARIA labels and keyboard support
- [ ] **Visual Feedback**: Loading states, disabled states, active states
- [ ] **Error Handling**: Try-catch blocks and error logging
- [ ] **Console Logging**: Debug information for troubleshooting
- [ ] **Testing**: Manual testing of all button states

### Step 6: Testing Protocol

**File**: `src/__tests__/buttons/ButtonTemplate.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ButtonTemplate } from '../../ui/components/buttons/ButtonTemplate';
import { useEditorStore } from '../../ui/store/editorStore';

// Mock the store
jest.mock('../../ui/store/editorStore');

describe('ButtonTemplate', () => {
  beforeEach(() => {
    // Reset store state
    useEditorStore.setState({
      buttonStates: {},
      buttonActions: {}
    });
  });
  
  it('should initialize with default state', () => {
    render(
      <ButtonTemplate
        id="test-button"
        label="Test Button"
        action="test action"
        stateKey="test"
        initialState={false}
        stateType="boolean"
        variant="primary"
        size="md"
        ariaLabel="Test button"
      />
    );
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
  
  it('should toggle state on click', () => {
    render(
      <ButtonTemplate
        id="test-button"
        label="Test Button"
        action="test action"
        stateKey="test"
        initialState={false}
        stateType="boolean"
        variant="primary"
        size="md"
        ariaLabel="Test button"
      />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
  
  it('should handle keyboard shortcuts', () => {
    render(
      <ButtonTemplate
        id="test-button"
        label="Test Button"
        action="test action"
        stateKey="test"
        initialState={false}
        stateType="boolean"
        variant="primary"
        size="md"
        ariaLabel="Test button"
        keyboardShortcut="t"
      />
    );
    
    const button = screen.getByRole('button');
    
    // Simulate Ctrl+T
    fireEvent.keyDown(document, { key: 't', ctrlKey: true });
    
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});
```

## Implementation Examples

### Example 1: Snap Type Button

```typescript
// In SceneCanvas.tsx
import { SnapTypeButton } from '../buttons/SnapTypeButton';

export function SceneCanvas() {
  return (
    <div className="snap-controls">
      <SnapTypeButton snapType="vertex" label="Vertex" icon="circle" />
      <SnapTypeButton snapType="edge" label="Edge" icon="minus" />
      <SnapTypeButton snapType="face" label="Face" icon="square" />
      {/* ... other snap buttons */}
    </div>
  );
}
```

### Example 2: Physics Engine Button

```typescript
// In PhysicsSettings.tsx
import { ButtonTemplate } from '../buttons/ButtonTemplate';

export function PhysicsSettings() {
  return (
    <div className="physics-settings">
      <ButtonTemplate
        id="physics-engine-rapier"
        label="Rapier"
        action="Switch to Rapier physics"
        stateKey="physicsEngine"
        initialState="rapier"
        stateType="string"
        variant="primary"
        size="md"
        ariaLabel="Switch to Rapier physics engine"
        storeMethod="setPhysicsEngine"
        callback={(engine) => {
          console.log(`[PhysicsSettings] Switched to ${engine}`);
        }}
      />
    </div>
  );
}
```

## Debugging Tools

### Button State Inspector

**File**: `src/ui/components/debug/ButtonStateInspector.tsx`

```typescript
import React from 'react';
import { useEditorStore } from '../../store/editorStore';

export function ButtonStateInspector() {
  const { state } = useEditorStore();
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg max-w-sm">
      <h3 className="font-bold mb-2">Button States</h3>
      <div className="space-y-1 text-xs">
        {Object.entries(state.buttonStates).map(([id, value]) => (
          <div key={id} className="flex justify-between">
            <span>{id}:</span>
            <span className="text-green-400">{JSON.stringify(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Best Practices

1. **Always use ButtonTemplate**: Never create buttons from scratch
2. **Test immediately**: Test buttons as soon as they're created
3. **Use TypeScript**: Leverage type safety to catch errors early
4. **Console logging**: Add debug logs for troubleshooting
5. **Error boundaries**: Wrap button components in error boundaries
6. **Accessibility first**: Always include ARIA labels and keyboard support
7. **State management**: Always use the store for button state
8. **Documentation**: Document button requirements before implementation

## Common Anti-Patterns to Avoid

❌ **Don't**: Create buttons without state management
❌ **Don't**: Hardcode button behavior in components
❌ **Don't**: Skip accessibility attributes
❌ **Don't**: Forget error handling
❌ **Don't**: Test only in isolation
❌ **Don't**: Ignore TypeScript errors
❌ **Don't**: Skip console logging for debugging

## Conclusion

This systematic process ensures that every button in kinetiCORE:
- Works reliably
- Is properly integrated with the store
- Has proper error handling
- Is accessible
- Is testable
- Is maintainable

Follow this process for all future button implementations to avoid the common mistakes we've encountered.
