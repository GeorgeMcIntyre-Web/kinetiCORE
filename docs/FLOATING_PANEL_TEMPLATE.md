# Floating Panel Template

**Owner:** Edwin (UI/UX)
**Last Updated:** 2025-01-23

## Overview

All floating panels in kinetiCORE MUST use the `FloatingPanel` component for consistency. This provides:
- Draggable header (click and drag to move)
- 4 control buttons: Pin, Minimize, Maximize/Dock, Close
- Resizable frame (drag bottom-right corner)
- Dark theme styling
- Consistent z-index management
- Responsive positioning

## Template Code

```tsx
/**
 * [PanelName] Panel
 * Owner: [Your Name]
 * [Brief description of what this panel does]
 */

import React, { useState } from 'react';
import { IconName } from 'lucide-react'; // Import your icon(s)
import { FloatingPanel } from './FloatingPanel/FloatingPanel';

interface [PanelName]PanelProps {
  isVisible: boolean;
  onClose: () => void;
  zIndex?: number;
  // Add any other props specific to your panel
}

export const [PanelName]Panel: React.FC<[PanelName]PanelProps> = ({
  isVisible,
  onClose,
  zIndex = 1004  // Default z-index, adjust if needed
}) => {
  // Panel-specific state
  const [someState, setSomeState] = useState<string>('');

  // Icon for the panel (shown in header and when minimized)
  const icon = <IconName size={16} />;

  // For composite icons (like 2x2 grid):
  // const icon = (
  //   <div style={{ position: 'relative', width: '24px', height: '24px' }}>
  //     <Icon1 size={10} style={{ position: 'absolute', left: '0px', top: '0px' }} />
  //     <Icon2 size={10} style={{ position: 'absolute', right: '0px', top: '0px' }} />
  //     <Icon3 size={10} style={{ position: 'absolute', left: '0px', bottom: '0px' }} />
  //     <Icon4 size={10} style={{ position: 'absolute', right: '0px', bottom: '0px' }} />
  //   </div>
  // );

  return (
    <FloatingPanel
      title="[Panel Title]"
      subtitle="[Brief subtitle]"
      icon={icon}
      isVisible={isVisible}
      onClose={onClose}
      zIndex={zIndex}
      defaultSize={{ width: 450, height: 600 }}  // Adjust as needed
      defaultPosition={{ x: window.innerWidth - 500, y: 120 }}  // Right side, below header

      // Optional: customize behavior
      // draggable={true}
      // resizable={true}
      // minimizable={true}
      // dockable={true}
      // closable={true}
      // minWidth={300}
      // minHeight={200}
      // maxWidth={1200}
      // maxHeight={800}
    >
      {/* Your panel content goes here */}

      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Section Title</h4>
        {/* Section content */}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Another Section</h4>
        {/* More content */}
      </div>

      {/* Optional: footer with notes */}
      <div style={{
        marginTop: '20px',
        fontSize: '12px',
        color: '#999',
        borderTop: '1px solid #444',
        paddingTop: '10px'
      }}>
        <p style={{ margin: '5px 0' }}>
          <strong>Note:</strong> Your helpful notes here.
        </p>
      </div>
    </FloatingPanel>
  );
};
```

## Integration in Layout

In `EssentialModeLayout.tsx` or similar:

```tsx
// 1. Import the panel
import { [PanelName]Panel } from '../components/[PanelName]Panel';

// 2. Add state for visibility
const [show[PanelName]Panel, setShow[PanelName]Panel] = useState(false);

// 3. Add handler to ribbonProps
const ribbonProps = {
  // ... other handlers
  on[PanelName]Click: () => setShow[PanelName]Panel(!show[PanelName]Panel),
};

// 4. Render the panel in the layout
<[PanelName]Panel
  isVisible={show[PanelName]Panel}
  onClose={() => setShow[PanelName]Panel(false)}
  zIndex={1004}  // Adjust as needed (1001-1010 range)
/>
```

## Adding a Ribbon Button

In `RibbonToolbar.tsx`:

```tsx
// 1. Add to interface
export interface RibbonToolbarProps {
  // ... other props
  on[PanelName]Click?: () => void;
}

// 2. Destructure in component
export const RibbonToolbar: React.FC<RibbonToolbarProps> = ({
  // ... other props
  on[PanelName]Click,
}) => {

// 3. Add button to appropriate category
<button
  className="ribbon-btn"
  onClick={on[PanelName]Click}
  title="[Panel Title]"
>
  <div style={{ position: 'relative', width: '32px', height: '32px' }}>
    {/* Your icon(s) here */}
    <IconName size={24} />
  </div>
</button>
```

## Dark Theme Styling Guide

### Colors
- **Borders:** `#444` (medium gray)
- **Backgrounds:** `#1a1a1a` (dark gray)
- **Text:** `#999` (light gray) for secondary text
- **Dividers:** `1px solid #444`

### Example Styled Elements

```tsx
// Input/select boxes (FloatingPanel.css handles most of this)
<input
  type="text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  style={{ width: '150px' }}
/>

// Container boxes
<div style={{
  border: '1px solid #444',
  padding: '10px',
  marginBottom: '10px',
  borderRadius: '4px',
  backgroundColor: '#1a1a1a',
}}>
  {/* Content */}
</div>

// Footer notes
<div style={{
  marginTop: '20px',
  fontSize: '12px',
  color: '#999',
  borderTop: '1px solid #444',
  paddingTop: '10px'
}}>
  <p style={{ margin: '5px 0' }}>Note text here</p>
</div>
```

## Z-Index Guidelines

Use these z-index values for different panel types:

- **1001-1003:** General utility panels (transforms, properties, etc.)
- **1004-1006:** Specialized panels (IK, kinematics, physics)
- **1007-1009:** Modal-like panels (settings, preferences)
- **1010+:** Alerts, tooltips, critical overlays

## Common Panel Sizes

| Panel Type | Width | Height | Position |
|-----------|-------|--------|----------|
| Small utility | 350px | 400px | Right side |
| Medium control | 450px | 600px | Right side |
| Large editor | 600px | 700px | Center |
| Full-width | 80vw | 600px | Center |

## Position Guidelines

```tsx
// Right side, below header
defaultPosition={{ x: window.innerWidth - 500, y: 120 }}

// Center of screen
defaultPosition={{
  x: (window.innerWidth - 450) / 2,
  y: (window.innerHeight - 600) / 2
}}

// Left side
defaultPosition={{ x: 50, y: 120 }}
```

## Examples in Codebase

- **WholeBodyIKPanel.tsx** - Complex panel with multiple sections, custom 2x2 icon
- **FloatingPanel.tsx** - The base component itself (reference for all props)
- **EssentialModeLayout.tsx** - Shows how panels are integrated in layouts

## Best Practices

1. **Always use FloatingPanel** - Never create custom floating divs
2. **Provide meaningful icons** - Use lucide-react icons or composite icons
3. **Include subtitles** - Help users understand the panel's purpose
4. **Consistent styling** - Use the dark theme colors above
5. **Responsive sizing** - Consider different screen sizes
6. **Proper z-index** - Follow the guidelines to avoid overlapping issues
7. **Clean up state** - Use `onClose` to reset panel state if needed
8. **Keyboard accessibility** - FloatingPanel handles this, but test tab navigation

## Testing Checklist

- [ ] Panel opens when ribbon button is clicked
- [ ] Panel can be dragged by header
- [ ] Minimize button collapses panel to icon
- [ ] Maximize button docks/undocks panel
- [ ] Close button hides panel and calls `onClose`
- [ ] Pin button keeps panel in place
- [ ] Resize handle works (bottom-right corner)
- [ ] Panel renders correctly on different screen sizes
- [ ] Dark theme styling looks consistent
- [ ] No TypeScript compilation errors
- [ ] No console errors or warnings

## Questions?

- **FloatingPanel API:** See [FloatingPanel.tsx](../src/ui/components/FloatingPanel/FloatingPanel.tsx)
- **Styling:** See [FloatingPanel.css](../src/ui/components/FloatingPanel/FloatingPanel.css)
- **Examples:** Look at existing panels in `src/ui/components/`
- **Team:** Ask Edwin for UI/UX questions, George for integration questions
