# SelectionIndicator Component

A small, always-visible UI element that displays the currently selected object(s) in the 3D world.

## Usage

```tsx
import { SelectionIndicator } from './components/SelectionIndicator';

// In your layout component:
const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);

<SelectionIndicator selectedNodeIds={selectedNodeIds} />
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selectedNodeIds` | `string[]` | Yes | - | Array of selected node IDs from editorStore |
| `className` | `string` | No | `''` | Additional CSS classes |

## Features

- ✅ Always visible in top-left corner
- ✅ Shows object name and type-specific icon
- ✅ Multi-selection support with count badge
- ✅ Hover to reveal full details
- ✅ Performance-optimized with React memoization
- ✅ Responsive design for mobile devices

## Visual States

### No Selection
```
📍 No selection
```
- Gray, italic text
- Lower opacity
- Tooltip: "Click an object in the 3D viewport to select it"

### Single Selection
```
🤖 KR270 Robot
```
- Blue accent background
- Object type icon
- Tooltip: Shows full details (name, type, parent, visibility, locked)

### Multi-Selection
```
📦 3 objects selected   [3]
```
- Blue accent background
- Count badge on the right
- Tooltip: Summary of selected object types

## Object Type Icons

| Type | Icon | Description |
|------|------|-------------|
| `robot` | 🤖 | Robot objects |
| `mesh` | 🔷 | Mesh objects |
| `joint` | ⚙️ | Joint objects |
| `collection` | 📁 | Collections/folders |
| `multiple` | 📦 | Multiple selected |
| `world` | 🌍 | World node |
| `scene` | 🎬 | Scene node |
| `system` | ⚡ | System node |
| Default | 📍 | Unknown/other types |

## Styling

The component uses `SelectionIndicator.css` for styling. Key CSS classes:

- `.selection-indicator` - Main container
- `.selection-indicator-icon` - Icon container
- `.selection-indicator-text` - Text content
- `.selection-indicator-badge` - Count badge (multi-selection)
- `.selection-indicator.no-selection` - No selection state

### Customization

To customize the position or appearance:

```tsx
<SelectionIndicator 
  selectedNodeIds={selectedNodeIds}
  className="custom-position"
/>
```

```css
.custom-position {
  top: 100px; /* Different position */
  left: 20px;
}
```

## Position and Layout

- **Position:** Fixed, top-left corner
- **Top:** 90px (below 80px header + 10px gap)
- **Left:** 10px
- **Z-index:** 900 (above content, below modals)
- **Max Width:** 280px (expands to 400px on hover)

## Performance

- Uses `useMemo` to prevent unnecessary re-renders
- Only updates when `selectedNodeIds` changes
- Lightweight DOM structure
- No performance impact on render loop

## Browser Support

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ High DPI displays (Retina, 4K)

## Integration Points

Currently integrated in:
- `EssentialModeLayout.tsx`
- `ProfessionalModeLayout.tsx`
- `ExpertModeLayout.tsx`

## Accessibility

- Has `title` attribute for tooltips
- Uses semantic HTML structure
- Text is readable with high contrast
- Icons complement text (not required for understanding)

## Testing

To test the component:

1. Start dev server: `npm run dev`
2. Load a 3D model
3. Click objects in the viewport
4. Verify indicator updates immediately
5. Test multi-selection (Ctrl+Click)
6. Test on mobile viewport

## Example

```tsx
import React from 'react';
import { useEditorStore } from '../store/editorStore';
import { SelectionIndicator } from '../components/SelectionIndicator';

export const MyLayout: React.FC = () => {
  const selectedNodeIds = useEditorStore((state) => state.selectedNodeIds);
  
  return (
    <div className="layout">
      <SelectionIndicator selectedNodeIds={selectedNodeIds} />
      {/* Rest of your layout */}
    </div>
  );
};
```

## Troubleshooting

**Issue:** Indicator not showing
- **Solution:** Ensure component is placed in layout JSX
- **Solution:** Check that it's not hidden behind other elements (z-index)

**Issue:** Not updating when selection changes
- **Solution:** Verify `selectedNodeIds` is subscribed from editorStore
- **Solution:** Check that editorStore is properly updating selection

**Issue:** Text truncated
- **Solution:** Hover to see full name
- **Solution:** Increase `max-width` in CSS if needed

## Future Enhancements

Potential features (not implemented):
- Click to focus on selected object
- Right-click context menu
- Drag to reposition
- Keyboard shortcut to toggle
- Animation on selection change
- Custom color themes

---

**Owner:** Agent 6 (Edwin)  
**Created:** 2025-10-23  
**Version:** 1.0.0
