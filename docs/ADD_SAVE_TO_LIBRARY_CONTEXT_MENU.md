# Add "Save to Library" to Context Menu

**Quick guide to add the missing context menu option**

---

## Files to Edit

### 1. Update ContextMenu.tsx

**File:** `src/ui/components/ContextMenu.tsx`

**Step 1: Add Save icon import (Line 6-9)**
```typescript
import {
  Copy, Trash2, Eye, EyeOff, Lock, Unlock, Edit3, ZoomIn,
  Box, Circle, Cylinder as CylinderIcon, Folder, Play, Save  // ← Add Save here
} from 'lucide-react';
```

**Step 2: Update useNodeContextMenu hook (Line 151-167)**

Add `onSaveToLibrary` to the actions parameter:

```typescript
export const useNodeContextMenu = () => {
  const getNodeMenuItems = (
    _nodeId: string,
    _nodeName: string,
    _nodeType: string,
    isVisible: boolean,
    isLocked: boolean,
    canDelete: boolean,
    actions: {
      onRename: () => void;
      onDuplicate: () => void;
      onDelete: () => void;
      onToggleVisibility: () => void;
      onToggleLock: () => void;
      onZoom: () => void;
      onSaveToLibrary: () => void;  // ← Add this
    }
  ): ContextMenuItem[] => {
```

**Step 3: Add "Save to Library" menu item (after line 181)**

```typescript
return [
  {
    label: 'Rename',
    icon: <Edit3 size={16} />,
    action: actions.onRename,
    shortcut: 'F2',
  },
  {
    label: 'Duplicate',
    icon: <Copy size={16} />,
    action: actions.onDuplicate,
    disabled: !canDelete,
    shortcut: 'Ctrl+D',
  },
  { divider: true } as ContextMenuItem,

  // ← ADD THIS:
  {
    label: 'Save to Library',
    icon: <Save size={16} />,
    action: actions.onSaveToLibrary,
    disabled: _nodeType === 'world', // Can't save world root
  },
  { divider: true } as ContextMenuItem,
  // ← END ADD

  {
    label: isVisible ? 'Hide' : 'Show',
    icon: isVisible ? <EyeOff size={16} /> : <Eye size={16} />,
    action: actions.onToggleVisibility,
    shortcut: 'H',
  },
  // ... rest of menu items
];
```

---

### 2. Update SceneTree.tsx

**File:** `src/ui/components/SceneTree.tsx`

**Step 1: Import SaveToLibraryService**

Add to imports at top of file:
```typescript
import { SaveToLibraryService } from '../../library/SaveToLibraryService';
```

**Step 2: Add state for save dialog**

In the TreeNode component (around line 250), add:
```typescript
const [showSaveDialog, setShowSaveDialog] = useState(false);
```

**Step 3: Add handleSaveToLibrary function**

Add this function before the `menuItems` definition:
```typescript
const handleSaveToLibrary = () => {
  if (!node.mesh) {
    console.warn('No mesh to save');
    return;
  }

  // For now, show a simple prompt
  // TODO: Create proper SaveToLibraryDialog component
  const assetName = prompt('Enter asset name:', node.name);
  if (!assetName) return;

  const description = prompt('Enter description (optional):');
  const tagsInput = prompt('Enter tags (comma-separated, optional):');
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()) : [];

  const saveService = SaveToLibraryService.getInstance();

  saveService.saveMeshToLibrary(node.mesh, {
    name: assetName,
    description: description || '',
    tags: tags,
    domain: 'custom',
    assetClass: 'custom',
    assetType: 'imported',
    loaderType: 'glb',
    visibility: 'private',
    saveToLocal: true,
    saveToCloud: false,
  }).then((result) => {
    if (result.success) {
      alert(`✅ Asset saved to library: ${result.assetId}`);
    } else {
      alert(`❌ Failed to save: ${result.error}`);
    }
  });
};
```

**Step 4: Add onSaveToLibrary to menuItems**

Find where `menuItems` is created (look for `getNodeMenuItems` call) and add the handler:

```typescript
const menuItems = getNodeMenuItems(
  node.id,
  node.name,
  node.type,
  node.visible,
  node.locked,
  canDelete,
  {
    onRename: handleStartRename,
    onDuplicate: handleDuplicate,
    onDelete: handleDelete,
    onToggleVisibility: handleToggleVisibility,
    onToggleLock: handleToggleLock,
    onZoom: handleZoomTo,
    onSaveToLibrary: handleSaveToLibrary,  // ← Add this
  }
);
```

---

## Testing

After making these changes:

1. **Restart dev server:**
   ```bash
   npm run dev
   ```

2. **Test the feature:**
   ```
   1. Load a robot (like m710ic70)
   2. Right-click in Scene Tree
   3. "Save to Library" should appear ✅
   4. Click it
   5. Enter name, description, tags
   6. Asset saves to IndexedDB ✅
   ```

3. **Verify in Asset Library:**
   ```
   1. Open Asset Library
   2. Click "My Assets" category
   3. Your saved asset should appear
   4. Click "Add to Scene" to load it back ✅
   ```

---

## Future Enhancement: Proper Dialog

The current implementation uses `prompt()` which is basic. For a better UX, create a proper dialog:

**File:** `src/ui/components/AssetLibrary/SaveToLibraryDialog.tsx`

```typescript
import { useState } from 'react';
import { Save, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  defaultName: string;
  onSubmit: (options: SaveToLibraryOptions) => void;
  onCancel: () => void;
}

export function SaveToLibraryDialog({ isOpen, defaultName, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [category, setCategory] = useState('custom');
  const [visibility, setVisibility] = useState<'private' | 'public' | 'shared'>('private');

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: '#1a1a1a',
        padding: '24px',
        borderRadius: '8px',
        border: '1px solid #444',
        maxWidth: '500px',
        width: '90%'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>Save to Library</h2>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '13px' }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Asset name"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#2a2a2a',
                color: '#fff'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '13px' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#2a2a2a',
                color: '#fff',
                resize: 'vertical'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '13px' }}>
              Tags
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {tags.map(tag => (
                <span key={tag} style={{
                  padding: '4px 8px',
                  background: '#3a3a3a',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#ccc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {tag}
                  <button
                    onClick={() => setTags(tags.filter(t => t !== tag))}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '0 4px' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    setTags([...tags, newTag.trim()]);
                    setNewTag('');
                  }
                }}
                placeholder="Add tag..."
                style={{
                  flex: 1,
                  padding: '6px',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  background: '#2a2a2a',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <button
                onClick={() => {
                  if (newTag.trim()) {
                    setTags([...tags, newTag.trim()]);
                    setNewTag('');
                  }
                }}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  background: '#333',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', color: '#ccc', fontSize: '13px' }}>
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#2a2a2a',
                color: '#fff'
              }}
            >
              <option value="private">Private (Only Me)</option>
              <option value="public">Public (Everyone)</option>
              <option value="shared">Shared (Specific Users)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                border: '1px solid #444',
                borderRadius: '4px',
                background: '#2a2a2a',
                color: '#ccc',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSubmit({
                  name: name.trim() || defaultName,
                  description: description.trim(),
                  tags,
                  domain: 'custom',
                  assetClass: 'custom',
                  assetType: 'imported',
                  loaderType: 'glb',
                  visibility,
                  saveToLocal: true,
                  saveToCloud: false,
                });
              }}
              disabled={!name.trim()}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                background: name.trim() ? '#3b82f6' : '#444',
                color: '#fff',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Save size={16} />
              Save to Library
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Then use this dialog instead of `prompt()`.

---

## Summary

**3 Steps to Add "Save to Library":**

1. **ContextMenu.tsx** - Add Save icon + menu item + action parameter
2. **SceneTree.tsx** - Add handler + import service + wire up action
3. **Test** - Right-click → Save to Library → Works! ✅

**Optional Enhancement:**
- Create SaveToLibraryDialog component for better UX

---

**After this, you'll be able to:**
- Right-click any asset in Scene Tree
- Click "Save to Library"
- Enter metadata (name, description, tags)
- Asset saved to IndexedDB
- Load it back from "My Assets" category ✅
