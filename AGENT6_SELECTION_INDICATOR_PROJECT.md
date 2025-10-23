# Agent 6: World Selection Indicator Project

**Agent:** Agent 6  
**Role:** World Selection Indicator Implementation  
**Priority:** LOW - Small UI Enhancement  
**Status:** Ready to Start  
**Created:** 2025-01-23  

## 🎯 Mission Statement

Create a small, unobtrusive UI element that always displays the name of the currently selected object in the 3D world. This should be a minimal, always-visible indicator that helps users know what they have selected without cluttering the interface.

**Current State:** Users can select objects but may lose track of what's selected  
**Target State:** Small, persistent indicator showing current selection name

## 📋 Requirements

### Core Functionality
- **Always Visible**: Small indicator that stays on screen
- **Shows Selection Name**: Displays the name of currently selected object
- **Unobtrusive**: Small size, doesn't interfere with other UI
- **Real-time Updates**: Updates immediately when selection changes
- **Handles No Selection**: Shows appropriate message when nothing selected

### Visual Design
- **Size**: Small, compact (e.g., 200px wide, 30px tall)
- **Position**: Top-left corner or bottom-left corner
- **Style**: Subtle, matches existing UI theme
- **Colors**: Low contrast, doesn't distract from main content

## 🏗️ Implementation Plan

### Phase 1: Basic Selection Indicator (1-2 days)
**Timeline:** 1-2 days  
**Files to Create/Modify:**
- `src/ui/components/SelectionIndicator.tsx` (NEW)
- `src/ui/layouts/EssentialModeLayout.tsx` (MODIFY)

**Implementation Steps:**
1. **Create Selection Indicator Component**
   ```tsx
   interface SelectionIndicatorProps {
     selectedNodeIds: string[];
     className?: string;
   }
   
   export const SelectionIndicator: React.FC<SelectionIndicatorProps> = ({
     selectedNodeIds,
     className
   }) => {
     // Get selected object names
     // Display selection info
     // Handle no selection case
   };
   ```

2. **Integrate with Layout**
   ```tsx
   // Add to EssentialModeLayout.tsx
   <div className="selection-indicator-container">
     <SelectionIndicator selectedNodeIds={selectedNodeIds} />
   </div>
   ```

3. **Style the Indicator**
   ```css
   .selection-indicator {
     position: fixed;
     top: 10px;
     left: 10px;
     background: rgba(0, 0, 0, 0.7);
     color: white;
     padding: 8px 12px;
     border-radius: 4px;
     font-size: 12px;
     z-index: 1000;
     max-width: 200px;
   }
   ```

### Phase 2: Enhanced Features (1 day)
**Timeline:** 1 day  
**Files to Modify:**
- `src/ui/components/SelectionIndicator.tsx`

**Implementation Steps:**
1. **Multi-Selection Support**
   - Show count when multiple objects selected
   - Display "3 objects selected" format
   - Handle long names with truncation

2. **Object Type Information**
   - Show object type (Robot, Joint, Mesh, etc.)
   - Use icons to represent different types
   - Color coding for different object types

3. **Hover Information**
   - Show full name on hover
   - Display additional object properties
   - Quick actions (focus, hide, etc.)

## 📁 Key Files to Work With

### Primary Files (Must Create/Modify)
- `src/ui/components/SelectionIndicator.tsx` - Main component
- `src/ui/layouts/EssentialModeLayout.tsx` - Integration point
- `src/ui/components/SelectionIndicator.css` - Styling

### Reference Files (Study These)
- `src/ui/store/editorStore.ts` - Selection state management
- `src/scene/SceneTreeManager.ts` - Object name retrieval
- `src/ui/components/FloatingPanel/` - UI styling reference

### Integration Points
- **Editor Store**: `useEditorStore()` for `selectedNodeIds`
- **Scene Manager**: Get object names from scene tree
- **Layout System**: Integrate with existing layout

## 🎨 UI/UX Requirements

### Visual Design Standards
- **Size**: Compact (200px wide, 30px tall max)
- **Position**: Top-left corner (10px from edges)
- **Background**: Semi-transparent dark (`rgba(0, 0, 0, 0.7)`)
- **Text**: White, 12px font size
- **Border**: Subtle border radius (4px)
- **Z-index**: High enough to stay above other content (1000)

### Behavior Requirements
- **Always Visible**: Never hidden or minimized
- **Real-time Updates**: Updates immediately on selection change
- **No Selection**: Shows "No selection" or similar message
- **Long Names**: Truncate with ellipsis (...)
- **Multi-Selection**: Show count and summary

### Responsive Design
- **Mobile**: Smaller size, different positioning
- **Different Screen Sizes**: Adjust position if needed
- **High DPI**: Ensure crisp rendering

## 🔧 Technical Implementation Details

### Component Structure
```tsx
export const SelectionIndicator: React.FC<SelectionIndicatorProps> = ({
  selectedNodeIds,
  className
}) => {
  const [selectedObjects, setSelectedObjects] = useState<ObjectInfo[]>([]);
  
  useEffect(() => {
    // Update when selection changes
    updateSelectedObjects(selectedNodeIds);
  }, [selectedNodeIds]);
  
  const getDisplayText = () => {
    if (selectedObjects.length === 0) return "No selection";
    if (selectedObjects.length === 1) return selectedObjects[0].name;
    return `${selectedObjects.length} objects selected`;
  };
  
  return (
    <div className={`selection-indicator ${className}`}>
      {getDisplayText()}
    </div>
  );
};
```

### State Management
```typescript
interface ObjectInfo {
  id: string;
  name: string;
  type: string;
  isVisible: boolean;
}

// Get object info from scene manager
const getObjectInfo = (nodeId: string): ObjectInfo => {
  const node = sceneManager.getNode(nodeId);
  return {
    id: nodeId,
    name: node?.name || 'Unknown',
    type: node?.type || 'Unknown',
    isVisible: node?.isVisible ?? true
  };
};
```

### CSS Styling
```css
.selection-indicator {
  position: fixed;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  z-index: 1000;
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4px);
}

.selection-indicator:hover {
  background: rgba(0, 0, 0, 0.8);
  max-width: 300px;
}

.selection-indicator.no-selection {
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
}
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('SelectionIndicator', () => {
  test('shows no selection message when nothing selected', () => {
    render(<SelectionIndicator selectedNodeIds={[]} />);
    expect(screen.getByText('No selection')).toBeInTheDocument();
  });
  
  test('shows single object name when one selected', () => {
    render(<SelectionIndicator selectedNodeIds={['robot-1']} />);
    expect(screen.getByText('KR270 Robot')).toBeInTheDocument();
  });
  
  test('shows count when multiple objects selected', () => {
    render(<SelectionIndicator selectedNodeIds={['robot-1', 'joint-1', 'mesh-1']} />);
    expect(screen.getByText('3 objects selected')).toBeInTheDocument();
  });
});
```

### Integration Tests
- Test with real scene objects
- Verify updates when selection changes
- Test with different object types
- Verify positioning and styling

## 📊 Success Metrics

### Phase 1 Success
- [ ] Selection indicator always visible
- [ ] Shows current selection name
- [ ] Updates in real-time
- [ ] Handles no selection case

### Phase 2 Success
- [ ] Multi-selection support
- [ ] Object type information
- [ ] Hover details
- [ ] Responsive design

### Overall Success
- [ ] Unobtrusive and helpful
- [ ] No performance impact
- [ ] Consistent with UI theme
- [ ] Works across all screen sizes

## 🚀 Getting Started

1. **Study Existing Code**
   - Review `src/ui/store/editorStore.ts` for selection state
   - Study `src/scene/SceneTreeManager.ts` for object access
   - Look at existing UI components for styling patterns

2. **Create Basic Component**
   - Create `SelectionIndicator.tsx` with basic functionality
   - Add to `EssentialModeLayout.tsx`
   - Test with simple selection changes

3. **Add Styling**
   - Create CSS for the indicator
   - Position it in top-left corner
   - Ensure it's always visible

4. **Test and Iterate**
   - Test with different selection scenarios
   - Refine styling and behavior
   - Ensure no interference with other UI

## 📞 Support & Resources

### Code References
- **Selection State**: `src/ui/store/editorStore.ts`
- **Scene Objects**: `src/scene/SceneTreeManager.ts`
- **UI Styling**: `src/ui/components/FloatingPanel/`

### Team Coordination
- **Agent 1**: Ensure indicator works with IK target selection
- **Agent 2**: Coordinate with multi-chain selection
- **PM**: Report on small UI enhancement progress

### Questions to Ask
- Should the indicator be draggable/repositionable?
- What information should be shown on hover?
- Should it have any interactive features?
- What's the preferred position (top-left vs bottom-left)?

---

**Remember:** This is a small, focused enhancement. Keep it simple, unobtrusive, and helpful. The goal is to provide users with clear feedback about their current selection without cluttering the interface.

**Good luck, Agent 6! 🎯**
