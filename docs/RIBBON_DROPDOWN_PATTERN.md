# Ribbon Dropdown Pattern

**Owner:** Agent 1 (George)
**Created:** 2025-10-23
**Purpose:** Reusable template for creating dropdown buttons in RibbonToolbar

---

## Overview

The RibbonDropdown component provides a consistent pattern for adding dropdown menus to the RibbonToolbar. It matches the exact styling of standard ribbon buttons (35px height, transparent background) while adding a subtle chevron indicator and dropdown menu.

**Key Features:**
- ✅ Matches `.ribbon-btn` styling exactly
- ✅ Transparent background (dark theme)
- ✅ Icon + small chevron (10px) side-by-side
- ✅ Hidden clickable area for dropdown on right side
- ✅ Animated dropdown menu
- ✅ Keyboard accessible

---

## Visual Design

```
┌─────────────────────────────────┐
│  [📁] [💾 ▼] [👁 ▼] [📦]       │  ← Ribbon buttons with dropdowns
│         │      │                 │
│         │      └─ View dropdown  │
│         └─ Save dropdown         │
│                                  │
│    Click icon: Execute action   │
│    Click chevron: Show menu     │
└─────────────────────────────────┘
```

**Dimensions:**
- Height: **35px** (matches all ribbon buttons)
- Width: **50px** (35px icon area + 15px for chevron)
- Icon size: **24px** (slightly smaller to fit chevron)
- Chevron size: **10px** (small, subtle indicator)
- Gap: **2px** between icon and chevron

**Colors:**
- Background: `transparent` (hover: `rgba(255,255,255,0.1)`)
- Icon color: `rgba(255,255,255,0.6)` (hover: `rgba(255,255,255,1)`)
- Border: `rgba(255,255,255,0.1)` (hover: `rgba(255,255,255,0.2)`)

---

## Usage

### Basic Example

```tsx
import { RibbonDropdown } from './ui/components/RibbonDropdown';
import { Save, Download, Upload } from 'lucide-react';

<RibbonDropdown
  icon={<Save size={24} />}
  tooltip="Save project (Click to quick save)"
  onMainClick={() => handleQuickSave()}
  options={[
    {
      id: 'save',
      label: 'Save',
      icon: <Save size={20} />,
      onClick: () => handleSave(),
      description: 'Save to database'
    },
    {
      id: 'export',
      label: 'Export',
      icon: <Download size={20} />,
      onClick: () => handleExport(),
      description: 'Export to JSON file'
    },
    {
      id: 'import',
      label: 'Import',
      icon: <Upload size={20} />,
      onClick: () => handleImport(),
      description: 'Import from JSON file'
    }
  ]}
/>
```

---

## Complete Implementation Guide

### Step 1: Create Your Dropdown Component

```tsx
import { useState } from 'react';
import { RibbonDropdown } from './ui/components/RibbonDropdown';
import { Settings, Zap, Clock } from 'lucide-react';

export const SettingsDropdown: React.FC = () => {
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);

  const handleQuickSettings = () => {
    // Main button action
    console.log('Quick settings opened');
  };

  const options = [
    {
      id: 'general',
      label: 'General',
      icon: <Settings size={20} />,
      onClick: () => console.log('General settings'),
      description: 'General application settings'
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: <Zap size={20} />,
      onClick: () => console.log('Performance settings'),
      description: 'Performance and optimization'
    },
    {
      id: 'autosave',
      label: autoSaveEnabled ? 'Auto-save: ON' : 'Auto-save: OFF',
      icon: <Clock size={20} />,
      onClick: () => setAutoSaveEnabled(!autoSaveEnabled),
      description: 'Toggle auto-save',
      active: autoSaveEnabled
    }
  ];

  return (
    <RibbonDropdown
      icon={<Settings size={24} />}
      tooltip="Settings"
      onMainClick={handleQuickSettings}
      options={options}
    />
  );
};
```

### Step 2: Add to RibbonToolbar

```tsx
import { SettingsDropdown } from './SettingsDropdown';

// In RibbonToolbar.tsx
<div className="ribbon-category-excel">
  <div className="ribbon-category-label">Tools</div>
  <div className="ribbon-buttons-row">
    <SettingsDropdown />
    {/* Other buttons */}
  </div>
</div>
```

---

## API Reference

### RibbonDropdown Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `icon` | `ReactNode` | ✅ | Main icon to display (e.g., `<Save size={24} />`) |
| `tooltip` | `string` | ✅ | Tooltip text for main button |
| `onMainClick` | `() => void` | ✅ | Callback when icon is clicked |
| `options` | `DropdownOption[]` | ✅ | Array of dropdown menu items |
| `width` | `number` | ❌ | Custom width in pixels (default: 50) |

### DropdownOption Interface

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier |
| `label` | `string` | ✅ | Display text in menu |
| `icon` | `ReactNode` | ✅ | Icon for menu item (20px recommended) |
| `onClick` | `() => void` | ✅ | Callback when item is clicked |
| `description` | `string` | ❌ | Tooltip text (defaults to label) |
| `active` | `boolean` | ❌ | Highlight item as active (blue background) |

---

## Behavior

### Click Behavior

1. **Click main icon (left ~70%):** Executes `onMainClick()` - primary action
2. **Click chevron area (right ~30%):** Opens dropdown menu
3. **Click outside:** Closes dropdown menu
4. **Select menu item:** Executes item's `onClick()` and closes menu

### Keyboard Accessibility

- `Tab`: Focus main button
- `Enter` or `Space`: Execute main action
- `Escape`: Close dropdown (when open)

---

## Examples from kinetiCORE

### 1. SaveDropdown (World Save System)

```tsx
// src/ui/components/SaveDropdown.tsx
<RibbonDropdown
  icon={<Save size={24} />}
  tooltip="Save project to database (Click to save)"
  onMainClick={handleQuickSave}
  options={[
    {
      id: 'save',
      label: 'Save',
      icon: <Save size={20} />,
      onClick: handleSave,
      description: 'Save project to database'
    },
    {
      id: 'export',
      label: 'Export',
      icon: <Download size={20} />,
      onClick: handleExport,
      description: 'Export project to JSON file'
    },
    {
      id: 'import',
      label: 'Import',
      icon: <Upload size={20} />,
      onClick: handleImport,
      description: 'Import project from JSON file'
    },
    {
      id: 'autosave',
      label: autoSaveEnabled ? 'Auto-save: ON' : 'Auto-save: OFF',
      icon: <Clock size={20} />,
      onClick: handleToggleAutoSave,
      active: autoSaveEnabled
    }
  ]}
/>
```

### 2. ViewDropdown (Camera Views)

```tsx
// src/ui/components/ViewDropdown.tsx
<RibbonDropdown
  icon={currentView.icon}
  tooltip={`${currentView.label} View (Click to activate)`}
  onMainClick={currentView.onClick}
  options={[
    {
      id: 'front',
      label: 'Front',
      icon: <FrontViewIcon size={20} />,
      onClick: onFrontViewClick,
      active: currentView === 'front'
    },
    {
      id: 'right',
      label: 'Right',
      icon: <RightViewIcon size={20} />,
      onClick: onRightViewClick,
      active: currentView === 'right'
    },
    {
      id: 'top',
      label: 'Top',
      icon: <TopViewIcon size={20} />,
      onClick: onTopViewClick,
      active: currentView === 'top'
    },
    {
      id: 'iso',
      label: 'Isometric',
      icon: <IsometricViewIcon size={20} />,
      onClick: onIsoViewClick,
      active: currentView === 'iso'
    }
  ]}
/>
```

---

## Styling Customization

### Custom Width

For buttons with longer labels or more icons:

```tsx
<RibbonDropdown
  icon={<Package size={24} />}
  tooltip="Package Manager"
  width={60}  // Wider button
  onMainClick={handlePackages}
  options={packageOptions}
/>
```

### Custom Colors (via CSS)

Override in your component's CSS:

```css
.my-dropdown .ribbon-dropdown-main-btn:hover {
  background: rgba(45, 125, 70, 0.2);  /* Green tint */
}

.my-dropdown .ribbon-dropdown-item.active {
  background: #2d7d46;  /* Custom active color */
}
```

---

## Migration from Old Pattern

### Before (Old Split Button)

```tsx
// Old ViewDropdown pattern
<div className="view-dropdown-button-group">
  <button className="view-dropdown-main-btn">
    {icon}
  </button>
  <button className="view-dropdown-arrow-btn">
    <ChevronDown size={16} />
  </button>
</div>
```

**Issues:**
- ❌ Two separate buttons (confusing UX)
- ❌ White background (didn't match theme)
- ❌ Larger size (48px height)
- ❌ Separate border (visual separation)

### After (New Pattern)

```tsx
// New RibbonDropdown pattern
<RibbonDropdown
  icon={icon}
  tooltip="..."
  onMainClick={handleAction}
  options={menuOptions}
/>
```

**Benefits:**
- ✅ Single unified button
- ✅ Transparent background (matches theme)
- ✅ Standard size (35px height)
- ✅ Integrated chevron
- ✅ Cleaner appearance

---

## Troubleshooting

### Dropdown appears white/bright

**Problem:** Background using solid color instead of transparent

**Solution:** Check CSS uses `transparent` or very low alpha:
```css
background: transparent;  /* Not #fff or solid color */
```

### Chevron not visible

**Problem:** Button width too small or chevron overlapping

**Solution:** Increase width to at least 50px:
```tsx
<RibbonDropdown width={50} ... />
```

### Height doesn't match other buttons

**Problem:** CSS height not set to 35px

**Solution:** Verify CSS matches:
```css
.ribbon-dropdown-main-btn {
  height: 35px;  /* Must match .ribbon-btn */
}
```

### Menu doesn't close on click outside

**Problem:** Click handler not properly attached

**Solution:** Ensure `dropdownRef` is passed to container:
```tsx
<div className="ribbon-dropdown" ref={dropdownRef}>
```

---

## Best Practices

1. **Icon Sizes:**
   - Main button icon: **24px** (fits with chevron)
   - Menu item icons: **20px** (slightly smaller)

2. **Option Count:**
   - Ideal: **3-6 options**
   - Maximum: **8 options** (longer menus need scroll)

3. **Labels:**
   - Keep short: **1-2 words** ("Save", "Export", "Import")
   - Use descriptions for longer explanations

4. **Active State:**
   - Use for toggles (Auto-save ON/OFF)
   - Use for current selection (Front View, Top View)

5. **Grouping:**
   - Consider separators for logical groups (future enhancement)

---

## Future Enhancements

Potential improvements to the pattern:

- [ ] Keyboard navigation (arrow keys in menu)
- [ ] Menu item separators/dividers
- [ ] Sub-menus (nested dropdowns)
- [ ] Custom animations
- [ ] Icon-only mode (no chevron)
- [ ] Right-click context menu support

---

## Related Files

- **Template:** `src/ui/components/RibbonDropdown.tsx`
- **Styles:** `src/ui/components/RibbonDropdown.css`
- **Examples:**
  - `src/ui/components/SaveDropdown.tsx`
  - `src/ui/components/ViewDropdown.tsx`
- **Toolbar:** `src/ui/components/RibbonToolbar.tsx`

---

## Questions?

Contact Agent 1 (George) for:
- Pattern usage questions
- Styling customization help
- New dropdown implementations
- Bug reports or improvements

**Last Updated:** 2025-10-23
