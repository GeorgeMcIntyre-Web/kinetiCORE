# Floating Panel System Documentation

## Overview

The kinetiCORE Floating Panel System provides a reusable, scalable architecture for creating draggable, resizable floating UI panels that match the Asset Library's dark theme styling.

**Owner:** Edwin (with review by George - Agent 1)

---

## Architecture

### Component Hierarchy

```
FloatingPanel (Base Container)
└── AssetLibraryDarkPanel (Styling Wrapper)
    └── Your Custom Content
        ├── AssetLibraryDarkSection (Optional)
        ├── AssetLibraryDarkButton (Optional)
        ├── AssetLibraryDarkSelect (Optional)
        └── AssetLibraryDarkDisabled (Optional)
```

### Core Components

1. **FloatingPanel** (`src/ui/components/FloatingPanel/FloatingPanel.tsx`)
   - Provides drag, resize, minimize, dock functionality
   - Handles z-index management
   - Manages panel state (position, size, visibility)

2. **AssetLibraryDarkPanel** (`src/ui/components/FloatingPanel/AssetLibraryDarkPanel.tsx`)
   - Applies consistent dark theme styling
   - Provides reusable UI components (sections, buttons, selects)
   - Matches AssetLibraryPanelV2 design exactly

---

## Quick Start

### Basic Usage

```typescript
import { FloatingPanel } from './FloatingPanel/FloatingPanel';
import { AssetLibraryDarkPanel } from './FloatingPanel/AssetLibraryDarkPanel';
import { Settings } from 'lucide-react';

export const MyCustomPanel = ({ isVisible, onClose }) => {
  return (
    <FloatingPanel
      title="My Panel"
      icon={<Settings size={20} />}
      isVisible={isVisible}
      onClose={onClose}
      zIndex={1001}
      defaultSize={{ width: 400, height: 600 }}
      minWidth={350}
      minHeight={400}
    >
      <AssetLibraryDarkPanel title="" onClose={undefined}>
        {/* Your content here */}
        <div>Panel content goes here</div>
      </AssetLibraryDarkPanel>
    </FloatingPanel>
  );
};
```

### Using Built-in Components

```typescript
import {
  AssetLibraryDarkPanel,
  AssetLibraryDarkSection,
  AssetLibraryDarkButton,
  AssetLibraryDarkSelect,
  AssetLibraryDarkDisabled
} from './FloatingPanel/AssetLibraryDarkPanel';

const content = (
  <AssetLibraryDarkPanel title="" onClose={undefined}>
    {/* Section with title and hint */}
    <AssetLibraryDarkSection title="Device Selection" hint="Select a device to enable">
      <AssetLibraryDarkSelect value={selected} onChange={handleChange}>
        <option value="">Select device...</option>
        <option value="device1">Device 1</option>
      </AssetLibraryDarkSelect>
    </AssetLibraryDarkSection>

    {/* Action buttons */}
    <AssetLibraryDarkSection title="Quick Actions">
      <div style={{ display: 'flex', gap: '8px' }}>
        <AssetLibraryDarkButton icon={<Play size={16} />}>
          Start
        </AssetLibraryDarkButton>
        <AssetLibraryDarkButton icon={<Square size={16} />} disabled>
          Stop
        </AssetLibraryDarkButton>
      </div>
    </AssetLibraryDarkSection>

    {/* Disabled state */}
    <AssetLibraryDarkSection title="Advanced">
      <AssetLibraryDarkDisabled
        icon={<Settings size={24} />}
        message="Select a device to enable"
      />
    </AssetLibraryDarkSection>
  </AssetLibraryDarkPanel>
);
```

---

## FloatingPanel Props

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Panel title displayed in header |
| `children` | `React.ReactNode` | Panel content |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `React.ReactNode` | - | Icon displayed next to title |
| `onClose` | `() => void` | - | Called when close button clicked |
| `onMinimize` | `() => void` | - | Called when minimize button clicked |
| `onMaximize` | `() => void` | - | Called when maximize button clicked |

### Position & Size

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultPosition` | `{ x: number, y: number }` | centered | Initial panel position |
| `defaultSize` | `{ width: number, height: number }` | `{ 450, 650 }` | Initial panel size |
| `minWidth` | `number` | `300` | Minimum panel width |
| `minHeight` | `number` | `200` | Minimum panel height |
| `maxWidth` | `number` | `1200` | Maximum panel width |
| `maxHeight` | `number` | `800` | Maximum panel height |

### Behavior

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `draggable` | `boolean` | `true` | Enable drag to move |
| `resizable` | `boolean` | `true` | Enable resize handles |
| `minimizable` | `boolean` | `true` | Show minimize button |
| `dockable` | `boolean` | `true` | Enable docking to edges |
| `closable` | `boolean` | `true` | Show close button |

### State

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isVisible` | `boolean` | `true` | Panel visibility |
| `zIndex` | `number` | `1000` | CSS z-index value |
| `defaultDockPosition` | `'floating' \| 'left' \| 'right' \| 'bottom'` | `'floating'` | Initial dock state |
| `defaultMinimized` | `boolean` | `false` | Start minimized |

### Styling

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `''` | Additional CSS classes |
| `style` | `React.CSSProperties` | `{}` | Inline styles |

---

## AssetLibraryDarkPanel Components

### AssetLibraryDarkPanel

Main wrapper component that provides dark theme container.

```typescript
<AssetLibraryDarkPanel
  title=""          // Usually empty when used inside FloatingPanel
  icon={<Icon />}   // Optional icon
  onClose={fn}      // Optional close handler
  className=""      // Optional additional classes
>
  {children}
</AssetLibraryDarkPanel>
```

### AssetLibraryDarkSection

Styled section with optional title and hint.

```typescript
<AssetLibraryDarkSection
  title="Section Title"       // Optional section title
  hint="Helper text"          // Optional hint text
>
  {children}
</AssetLibraryDarkSection>
```

### AssetLibraryDarkButton

Styled button matching the dark theme.

```typescript
<AssetLibraryDarkButton
  icon={<Icon />}             // Optional icon
  disabled={false}            // Optional disabled state
  onClick={handleClick}       // Click handler
  {...buttonProps}            // All standard button props
>
  Button Text
</AssetLibraryDarkButton>
```

### AssetLibraryDarkSelect

Styled select dropdown.

```typescript
<AssetLibraryDarkSelect
  value={selectedValue}
  onChange={handleChange}
  {...selectProps}            // All standard select props
>
  <option value="">Select...</option>
  <option value="1">Option 1</option>
</AssetLibraryDarkSelect>
```

### AssetLibraryDarkDisabled

Disabled state placeholder with icon and message.

```typescript
<AssetLibraryDarkDisabled
  icon={<Icon />}             // Optional icon
  message="No data available" // Message text
/>
```

---

## Real-World Examples

### Example 1: FloatingKinematicsPanel

See [FloatingKinematicsPanel.tsx](../src/ui/components/FloatingKinematicsPanel.tsx) for a complete implementation showing:
- Device selection with dropdown
- Conditional rendering based on selection
- Disabled state placeholders
- Multiple sections with different layouts

### Example 2: FloatingActuatorPanel

See [FloatingActuatorPanel.tsx](../src/ui/components/FloatingActuatorPanel.tsx) for:
- Status metrics display
- Quick action buttons
- Manual control sliders
- Joint state visualization

---

## Common Patterns

### Pattern 1: Conditional Content Based on Selection

```typescript
const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

return (
  <AssetLibraryDarkSection title="Controls">
    {selectedDevice ? (
      <div>Active controls for {selectedDevice}</div>
    ) : (
      <AssetLibraryDarkDisabled
        icon={<Settings size={24} />}
        message="Select a device to enable controls"
      />
    )}
  </AssetLibraryDarkSection>
);
```

### Pattern 2: Grid Layout for Buttons

```typescript
<AssetLibraryDarkSection title="Tools">
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
    <AssetLibraryDarkButton icon={<Icon1 />}>Tool 1</AssetLibraryDarkButton>
    <AssetLibraryDarkButton icon={<Icon2 />}>Tool 2</AssetLibraryDarkButton>
    <AssetLibraryDarkButton icon={<Icon3 />}>Tool 3</AssetLibraryDarkButton>
    <AssetLibraryDarkButton icon={<Icon4 />}>Tool 4</AssetLibraryDarkButton>
  </div>
</AssetLibraryDarkSection>
```

### Pattern 3: Multiple Sections with Scroll

```typescript
<AssetLibraryDarkPanel title="" onClose={undefined}>
  <AssetLibraryDarkSection title="Section 1">
    {/* Content 1 */}
  </AssetLibraryDarkSection>

  <AssetLibraryDarkSection title="Section 2">
    {/* Content 2 */}
  </AssetLibraryDarkSection>

  <AssetLibraryDarkSection title="Section 3">
    {/* Content 3 */}
  </AssetLibraryDarkSection>
</AssetLibraryDarkPanel>
```

---

## CSS Customization

### Custom Scrollbar

All panels inherit the custom scrollbar styling:

```css
.asset-library-dark-content::-webkit-scrollbar {
  width: 6px;
}

.asset-library-dark-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.asset-library-dark-content::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.3);
  border-radius: 3px;
}
```

### Color Tokens

Commonly used colors in the dark theme:

```css
--bg-primary: rgba(12, 12, 15, 0.98);
--bg-secondary: rgba(18, 18, 21, 0.95);
--border-color: rgba(255, 255, 255, 0.1);
--text-primary: rgba(255, 255, 255, 0.95);
--text-secondary: rgba(255, 255, 255, 0.7);
--accent-blue: rgba(59, 130, 246, 0.8);
```

---

## Testing Checklist

### Functionality Tests

- [ ] Panel opens and closes correctly
- [ ] Dragging works smoothly (click and drag header)
- [ ] Resize works correctly (drag bottom-right corner)
- [ ] Minimize button works
- [ ] Maximize/Dock button works
- [ ] Close button works
- [ ] Panel stays within viewport bounds
- [ ] Multiple panels can be open simultaneously
- [ ] Z-index management (click to bring to front)

### Responsive Tests

- [ ] Panel adjusts to small screens (< 768px)
- [ ] Min/max width constraints enforced
- [ ] Min/max height constraints enforced
- [ ] Content scrolls properly when overflow

### Integration Tests

- [ ] No conflicts with other UI elements
- [ ] Proper z-index layering
- [ ] No console errors
- [ ] TypeScript compilation passes
- [ ] CSS is properly scoped

---

## Known Issues & Limitations

### Current Limitations

1. **No state persistence** - Panel positions/sizes reset on close/reopen
2. **Limited minimize behavior** - Minimized panels stack without smart positioning
3. **No snap-to-edges** - Panels don't magnetically attach to screen edges
4. **Single drag mode** - Can't drag from anywhere in panel, only header

### Planned Enhancements

See Phase 2 & 3 in the Release Plan below.

---

## Release Plan

### Phase 1: Critical Fixes ✅ COMPLETE

- ✅ Fix resize calculation bug
- ✅ Remove duplicate FloatingPanel.tsx
- ✅ Fix TypeScript errors
- ✅ Fix CSS class mismatch (close-btn)

### Phase 2: Enhancements (Recommended)

- [ ] State persistence (localStorage)
- [ ] Minimize improvements (smart positioning)
- [ ] Keyboard shortcuts (ESC to close)
- [ ] Z-index management (click to bring-to-front)
- [ ] Use design-tokens for z-index values

### Phase 3: Polish (Optional)

- [ ] Snap-to-edges functionality
- [ ] Better docking with visual indicators
- [ ] Animation improvements
- [ ] Accessibility audit

---

## Migration Guide

### From Old Modal System

If you're migrating from the old Tailwind-based FloatingPanel:

**Before:**
```typescript
<FloatingPanel isOpen={true} onClose={handleClose} title="My Panel">
  <div>Content</div>
</FloatingPanel>
```

**After:**
```typescript
<FloatingPanel
  title="My Panel"
  isVisible={true}
  onClose={handleClose}
  defaultSize={{ width: 400, height: 600 }}
>
  <AssetLibraryDarkPanel title="" onClose={undefined}>
    <div>Content</div>
  </AssetLibraryDarkPanel>
</FloatingPanel>
```

### Key Differences

1. `isOpen` → `isVisible`
2. Must wrap content in `AssetLibraryDarkPanel` for styling
3. Use `defaultSize` instead of `size` prop
4. Additional behavior props available (draggable, resizable, etc.)

---

## Best Practices

### DO:
✅ Use AssetLibraryDarkPanel wrapper for consistent styling
✅ Provide meaningful icons and titles
✅ Use AssetLibraryDarkDisabled for unavailable features
✅ Set appropriate z-index values (1000+)
✅ Test with different screen sizes
✅ Keep panel sizes within min/max constraints

### DON'T:
❌ Don't hardcode z-index values < 1000
❌ Don't skip the AssetLibraryDarkPanel wrapper
❌ Don't make panels too small (< 300px width)
❌ Don't put heavy computations in render
❌ Don't forget to handle onClose properly

---

## Troubleshooting

### Panel doesn't appear
- Check `isVisible` prop is `true`
- Verify z-index is sufficient (> 1000)
- Ensure parent container allows absolute positioning

### Drag doesn't work
- Verify `draggable={true}` is set
- Check that header is not blocked by other elements
- Ensure panel is in `floating` dock position

### Resize doesn't work
- Verify `resizable={true}` is set
- Check panel is in `floating` dock position (resize disabled when docked)
- Ensure resize handle is visible (bottom-right corner)

### Styling doesn't match Asset Library
- Ensure you're using `AssetLibraryDarkPanel` wrapper
- Check that CSS files are imported correctly
- Verify no conflicting global styles

---

## Support

For questions or issues:
1. Check existing implementations (FloatingKinematicsPanel, FloatingActuatorPanel)
2. Review this documentation
3. Post in `#dev-ui` Slack channel
4. Contact Edwin (UI Owner) or George (Architecture)

---

**Last Updated:** 2025-01-XX
**Version:** 1.0.0
**Status:** Production Ready (Phase 1 Complete)
