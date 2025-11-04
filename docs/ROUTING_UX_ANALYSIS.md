# Routing System UX Analysis

**Date:** 2025-11-03  
**Status:** Testing Required  
**Priority:** HIGH

---

## Current State Analysis

### What Exists in UI

**ProfessionalModeLayout has:**
1. ✅ **Quick Preset Buttons** (Electrical, Pipe, Tray, Conduit, Mixed)
   - Location: Ribbon toolbar, under "Kinematics" section
   - Function: Creates complete routes at fixed positions automatically
   - UX: **Good for demos, confusing for real work**

2. ✅ **Labels Toggle** button (eye icon)
   - Function: Shows/hides route debug labels
   - UX: **Clear and intuitive**

3. ✅ **Templates** button
   - Function: Opens route templates panel
   - UX: **Clear**

### What's MISSING in UI

1. ❌ **Route Type Selector**
   - **Problem**: No dropdown to select Pipe vs Electrical vs Cable Tray vs Conduit
   - **Impact**: Users can't choose route type before placing connectors
   - **Solution Needed**: Add route type dropdown to ribbon toolbar

2. ❌ **"Place Connectors" Button**
   - **Problem**: No button to activate `placing_connector` mode
   - **Impact**: Users can't manually place connection points by clicking geometry
   - **Location**: Should be in Routing section of ribbon toolbar
   - **Solution Needed**: Add button that toggles routing mode

3. ❌ **Route Type Indicator**
   - **Problem**: No visual feedback showing current route type
   - **Impact**: Users don't know what type they're creating
   - **Solution Needed**: Show current route type badge/indicator

4. ❌ **Specifications Panel**
   - **Problem**: No UI to configure pipe size/material before creating routes
   - **Impact**: All routes use defaults (3/4" steel pipe)
   - **Solution Needed**: Add specifications panel or inline controls

---

## UX Issues Identified

### Issue 1: Confusing Two Workflows

**Current State:**
- **Workflow A (Quick Presets)**: Click button → Route appears at fixed positions
- **Workflow B (Manual)**: Should be: Select type → Place connectors → Create route

**Problem:**
- Workflow A exists but Workflow B is **not accessible** (no UI for it)
- Users see preset buttons but no way to create custom routes
- Professional users need manual placement, not just presets

**User Expectation:**
```
1. Select route type (Pipe/Electrical/etc.) → Visual indicator shows type
2. Click "Place Connectors" → Button highlights, tooltip says "Click geometry to place"
3. Click on 3D model → Connection point appears
4. Click another location → Second connection point appears
5. Route automatically created OR "Create Route" button becomes active
6. Geometry generated → 3D pipe/cable appears
```

**Current Reality:**
```
1. ??? (No way to select type)
2. ??? (No "Place Connectors" button visible)
3. Clicking geometry does nothing (mode not activated)
4. Preset buttons work but create routes at fixed positions only
```

---

### Issue 2: No Route Type Selection

**Problem:**
- Route type is stored in `routingStore.currentRouteType` (default: 'pipe')
- But there's **no UI to change it** in ProfessionalModeLayout
- Users must edit route type AFTER creating route (in Edit Panel)

**Expected:**
```
Routing Toolbar:
┌─────────────────────────────────────┐
│ Route Type: [Pipe ▼]               │
│ [Place Connectors] [Create Route]   │
└─────────────────────────────────────┘
```

**Current:**
```
Routing Section:
┌──────────────────────┐
│ [Labels] [Templates] │
│ [Electrical] [Pipe]  │ ← Presets only
│ [Tray] [Conduit]     │
└──────────────────────┘
```

---

### Issue 3: Hidden Functionality

**RoutingToolbar.tsx exists but not used:**
- Has route type dropdown
- Has "Add Connection Point" button
- Has "Route Between Points" button
- **But it's not imported/rendered in ProfessionalModeLayout**

**RoutingControlPanel.tsx exists but not used:**
- Has "Place Connectors" button
- Has route type selector
- Has connector list
- **But it's not accessible as a dockable panel**

---

### Issue 4: Pipe Size Configuration Missing

**Problem:**
- Default specs use `'3/4 inch'` but PIPE_SIZES table uses `'3/4"'`
- No UI to select pipe size before creation
- Users must edit route after creation to change size

**Expected Flow:**
```
1. Select route type: Pipe
2. Configure specs:
   - Size: [3/4" ▼] (dropdown with visual sizes)
   - Material: [Steel ▼]
3. Place connectors
4. Route created with configured size
```

**Current Flow:**
```
1. ??? (No way to select type)
2. ??? (No way to configure specs)
3. Click preset → Creates route with default (3/4 inch)
4. Edit route → Change size (but geometry may not update correctly)
```

---

## Recommended UX Improvements

### Priority 1: Add Route Type Selector

**Location:** Ribbon toolbar, Routing section  
**Implementation:**
```tsx
<div className="tool-group">
  <div className="group-label">Routing</div>
  <div className="tool-buttons">
    {/* Route Type Selector */}
    <select
      className="tool-select"
      value={currentRouteType}
      onChange={(e) => setCurrentRouteType(e.target.value)}
      title="Select Route Type"
    >
      <option value="pipe">Pipe</option>
      <option value="electrical">Electrical</option>
      <option value="cable_tray">Cable Tray</option>
      <option value="conduit">Conduit</option>
    </select>
    
    {/* Place Connectors Button */}
    <button
      className={`tool-btn ${routingMode === 'placing_connector' ? 'active' : ''}`}
      onClick={() => {
        const newMode = routingMode === 'placing_connector' ? 'off' : 'placing_connector';
        setRoutingMode(newMode);
      }}
      title={routingMode === 'placing_connector' ? 'Stop Placing Connectors' : 'Place Connectors (click geometry)'}
    >
      <Network size={18} />
      <span className="tool-btn-label">Place</span>
    </button>
    
    {/* Existing buttons */}
    <button ... >Labels</button>
    <button ... >Templates</button>
  </div>
</div>
```

---

### Priority 2: Add Visual Feedback

**Current Route Type Badge:**
```tsx
<div className="route-type-badge">
  <span className="badge-label">Active:</span>
  <span className="badge-value">{currentRouteType}</span>
</div>
```

**Place Mode Indicator:**
```tsx
{routingMode === 'placing_connector' && (
  <div className="hint-banner">
    👆 Click on 3D geometry to place connection points
    <button onClick={() => setRoutingMode('off')}>Cancel</button>
  </div>
)}
```

---

### Priority 3: Add Specifications Panel (Optional)

**For Advanced Users:**
- Dockable panel (like Edit Panel)
- Configure specs before placing connectors
- Pipe size dropdown with visual preview
- Material selection
- Pressure/voltage settings

**For Simple Users:**
- Defaults work fine
- Edit specs after creation if needed

---

## Testing Checklist

### Test 1: Manual Route Creation Workflow

**Steps:**
1. Open app → Professional Mode active
2. Find Routing section in ribbon toolbar
3. Select route type from dropdown → ✅ Should see current type highlighted
4. Click "Place Connectors" button → ✅ Button highlights, mode activated
5. Click on ground plane → ✅ Cyan sphere appears at click location
6. Click on box geometry → ✅ Second sphere appears
7. Route should auto-create OR button becomes active
8. Click "Create Route" → ✅ Route path calculated
9. Geometry generates → ✅ 3D pipe visible

**Expected Result:** Complete route created with 3D geometry  
**Current Status:** ❌ **BLOCKED** - No "Place Connectors" button exists

---

### Test 2: Pipe Size Verification

**Steps:**
1. Create pipe route (using preset or manual)
2. Check console: `route.source.specifications.size`
3. Verify PipeGenerator uses correct size:
   ```javascript
   const pipeSpec = PIPE_SIZES[route.source.specifications.size];
   console.log('Pipe OD:', pipeSpec.od, 'meters');
   ```
4. Verify geometry matches:
   - Measure cylinder diameter in viewport
   - Should match pipeSpec.od

**Expected Result:** Pipe diameter matches specification  
**Current Status:** ⚠️ **MISMATCH** - Default uses `'3/4 inch'` but table uses `'3/4"'`

---

### Test 3: Route Type Persistence

**Steps:**
1. Select "Electrical" route type
2. Place connector → ✅ Should create electrical connection point
3. Place second connector → ✅ Should create electrical connection point
4. Create route → ✅ Route type should be "electrical"
5. Generate geometry → ✅ Yellow wire bundle (not gray pipe)

**Expected Result:** Route type persists through workflow  
**Current Status:** ❌ **UNTESTABLE** - No way to select route type

---

## Code Changes Needed

### 1. Add Route Type Selector to ProfessionalModeLayout

```tsx
// In src/ui/layouts/ProfessionalModeLayout.tsx

import { useRoutingStore } from '../store/routingStore';

// In toolbar section:
const currentRouteType = useRoutingStore((state) => state.currentRouteType);
const setCurrentRouteType = useRoutingStore((state) => state.setCurrentRouteType);

<div className="tool-group">
  <div className="group-label">Routing</div>
  <div className="tool-buttons">
    {/* NEW: Route Type Selector */}
    <select
      className="tool-select"
      value={currentRouteType}
      onChange={(e) => setCurrentRouteType(e.target.value as RouteType)}
      title="Route Type"
    >
      <option value="pipe">Pipe</option>
      <option value="electrical">Electrical</option>
      <option value="cable_tray">Cable Tray</option>
      <option value="conduit">Conduit</option>
    </select>
    
    {/* NEW: Place Connectors Button */}
    <button
      className={`tool-btn ${routingMode === 'placing_connector' ? 'active' : ''}`}
      onClick={() => {
        const newMode = routingMode === 'placing_connector' ? 'off' : 'placing_connector';
        setRoutingMode(newMode);
      }}
      title={routingMode === 'placing_connector' ? 'Stop Placing (Esc)' : 'Place Connectors - Click geometry'}
    >
      <Network size={18} />
      <span className="tool-btn-label">Place</span>
    </button>
    
    {/* Existing buttons */}
    <button ... >Labels</button>
    <button ... >Templates</button>
  </div>
</div>
```

---

### 2. Fix Pipe Size String Mismatch

**In RoutingWorkflowHandler.ts:**
```typescript
// Change from:
return { size: '3/4 inch', material: 'steel' };

// To:
return { size: '3/4"', material: 'steel' };
```

**Reason:** PIPE_SIZES table uses `'3/4"'` format, not `'3/4 inch'`

---

### 3. Add Size Normalization

**In PipeGenerator.ts:**
```typescript
private getPipeDiameter(route: Route): { od: number; id: number } {
  let size = route.source.specifications.size || '1/2"';
  
  // Normalize size string
  size = size.replace(/\s*inch(es)?\s*/i, '"'); // "3/4 inch" → "3/4""
  size = size.replace(/\s+/g, ''); // Remove spaces
  
  const pipeSpec = PIPE_SIZES[size];
  
  if (!pipeSpec) {
    console.warn(`[PipeGenerator] Unknown pipe size: ${size}, using default 1/2"`);
    return PIPE_SIZES['1/2"'];
  }
  
  return pipeSpec;
}
```

---

## Summary

### Current UX Score: **3/10** ❌

**Issues:**
- ❌ No way to select route type
- ❌ No way to place connectors manually
- ❌ Only preset buttons work (fixed positions)
- ❌ No visual feedback on current state
- ❌ Pipe size string mismatch

### After Fixes UX Score: **8/10** ✅

**Improvements:**
- ✅ Route type selector visible
- ✅ Place connectors button accessible
- ✅ Clear workflow: Select type → Place → Create
- ✅ Visual feedback on mode
- ✅ Pipe sizes work correctly

---

**Next Steps:**
1. Implement route type selector in ProfessionalModeLayout
2. Add "Place Connectors" button
3. Fix pipe size string normalization
4. Test complete workflow
5. Update user documentation


