# DOM Structure Analysis - Professional Mode Viewport Issue

## Expected DOM Hierarchy (What SHOULD render)

```
<div class="professional-layout">
  └── <div class="professional-content">
      └── <div class="dockable-layout-wrapper">

          <!-- Layer 0: Viewport (z-index: 0) - BACKGROUND -->
          └── <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 0;">
              └── <main id="viewport-professional" class="professional-viewport">
                  └── <div> (SceneCanvas container - position: relative)
                      └── <canvas> (Babylon.js canvas - THE 3D WORLD)

          <!-- Layer 1: Dockview Panels (z-index: 1) - OVERLAY -->
          └── <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1;">
              └── <DockviewReact class="dockview-theme-kineticore">
                  ├── Left panels (Scene Tree, Tool Palette)
                  ├── Right panels (Inspector)
                  ├── Bottom panels (Route Stats)
                  └── Center watermark area (TRANSPARENT - shows viewport behind)
```

## Problem Analysis

### Issue 1: Dockview Watermark Covering Viewport
**Location:** DockviewReact center area
**Symptom:** Gray/dark area in center blocking 3D canvas
**Root Cause:** Dockview default watermark has opaque background

**Fix Applied:**
- Added `watermarkComponent={() => null}` to DockviewReact (DockableLayoutWrapper.tsx:194)
- This removes the watermark component entirely

### Issue 2: SceneCanvas Positioning Conflict
**Location:** SceneCanvas component
**Symptom:** Canvas not rendering or positioned incorrectly
**Root Cause:** SceneCanvas was trying to use `position: fixed` to overlay itself on viewport-professional, but it's already INSIDE viewport-professional as a child

**Fix Applied:**
- Changed SceneCanvas from `position: absolute; z-index: 30` to `position: relative`
- Removed complex overlay positioning logic
- Now uses normal document flow

### Issue 3: Pointer Events Blocking Interaction
**Location:** Multiple layers
**Symptom:** Can't interact with panels or viewport
**Root Cause:** Conflicting pointer-events settings

**Fix Applied:**
- Dockview container: No `pointerEvents: 'none'` (removed from TSX)
- `.dockview-theme-kineticore`: `pointer-events: none` (CSS line 16)
- `.dv-group`: `pointer-events: auto` (CSS line 53)
- SceneCanvas container: `pointer-events: auto` (TSX line 605)

## Current State After Fixes

### DockableLayoutWrapper.tsx (Lines 163-196)
```tsx
<div className="dockable-layout-wrapper">
  {/* Layer 0: Viewport - z-index: 0 */}
  {config.mainContent && (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 0,
    }}>
      {config.mainContent}  // This is the <main id="viewport-professional">
    </div>
  )}

  {/* Layer 1: Dockview - z-index: 1 */}
  <div style={{
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  }}>
    <DockviewReact
      className="dockview-theme-kineticore"
      components={components}
      onReady={onReady}
      disableFloatingGroups={false}
      defaultTabComponent={undefined}
      watermarkComponent={() => null}  // ✅ ADDED - Removes watermark
    />
  </div>
</div>
```

### SceneCanvas.tsx (Lines 559-617)
```tsx
return (
  <div
    ref={containerRef}
    style={{
      position: 'relative',        // ✅ CHANGED from 'absolute'
      width: '100%',
      height: '100%',
      pointerEvents: 'auto',       // ✅ CHANGED from 'none'
    }}
  >
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        outline: 'none',
        pointerEvents: 'auto',
      }}
    />
  </div>
);
```

## Potential Remaining Issues

### Issue A: Dockview Still Creating Watermark Element
**Check:** Even with `watermarkComponent={() => null}`, dockview might still create a DOM element
**Diagnosis:** Use DevTools Elements tab to inspect if `.watermark` or `.dv-watermark` exists
**Solution:** Add CSS to hide it: `.dockview-theme-kineticore .watermark { display: none !important; }`

### Issue B: Dockview Groups Covering Center
**Check:** Dockview might be creating full-width/height groups that cover the center
**Diagnosis:** Look for `.dv-group` or `.dv-paneview` elements that span entire container
**Solution:** Already added `background: transparent !important` but might need `pointer-events: none` on center area

### Issue C: Canvas Not Initializing
**Check:** Babylon.js canvas might not be initializing properly
**Diagnosis:** Console errors like "WebGL not supported" or "Canvas is null"
**Solution:** Check SceneManager initialization, ensure canvas ref is set before init

### Issue D: Parent Container Has No Dimensions
**Check:** The `<main id="viewport-professional">` might have 0 height
**Diagnosis:** Use DevTools to inspect computed dimensions
**Solution:** Add explicit height to `.professional-content` or `.professional-viewport`

## DevTools Debugging Checklist

### Step 1: Inspect DOM Structure
```
1. Open DevTools (F12)
2. Elements tab
3. Find <div class="dockable-layout-wrapper">
4. Expand to see children
5. Verify TWO sibling divs exist (z-index: 0 and z-index: 1)
6. Verify viewport-professional exists inside z-index: 0 div
7. Verify <canvas> exists inside viewport-professional
```

**Expected:**
```html
<div class="dockable-layout-wrapper">
  <div style="z-index: 0;">
    <main id="viewport-professional">
      <div>
        <canvas width="..." height="..."></canvas>
```

### Step 2: Check Computed Styles
```
1. Select <canvas> element in Elements tab
2. Look at Computed tab (right side)
3. Check:
   - width: Should be > 0 (e.g., 1200px)
   - height: Should be > 0 (e.g., 800px)
   - display: Should be 'block'
   - position: Should be 'static' (since parent is relative)
   - z-index: Should be 'auto'
```

### Step 3: Check for Overlapping Elements
```
1. Right-click on dark/black area
2. Inspect element
3. See what element is selected
4. If it's NOT <canvas>, that's the blocking element
5. Check that element's:
   - background-color (should be transparent or none)
   - z-index (should be < 1 or behind canvas)
   - pointer-events (should allow clicks through)
```

### Step 4: Check Canvas Rendering
```
1. Console tab
2. Look for errors related to:
   - "WebGL"
   - "Babylon"
   - "SceneManager"
   - "Canvas"
3. Type: SceneManager.getInstance().getCanvas()
4. Should return HTMLCanvasElement, not null
5. Type: SceneManager.getInstance().getEngine()
6. Should return Engine object, not null
```

### Step 5: Force Background Transparent
```
1. Console tab
2. Type: sceneManager.setBackgroundTransparent(false)
3. See if viewport appears
4. Type: sceneManager.setFloorType("epoxy-gray")
5. See if grid/floor appears
```

## CSS Hierarchy Issues

### Current CSS (DockableLayoutWrapper.css)

**Problem Areas:**

1. **Line 88-95: Watermark transparency**
```css
.dockview-theme-kineticore .watermark {
  display: block;  /* ❌ Should be 'none' if watermarkComponent={() => null} */
  width: 100%;
  height: 100%;
  background: transparent !important;  /* ✅ Good */
  position: relative;
  pointer-events: none !important;  /* ✅ Good */
}
```

**Recommended Fix:**
```css
.dockview-theme-kineticore .watermark {
  display: none !important;  /* Hide watermark completely */
}
```

2. **Line 50-54: Group transparency**
```css
.dockview-theme-kineticore .dv-group {
  background: transparent !important;  /* ✅ Good */
  opacity: 1 !important;
  pointer-events: auto !important;  /* ✅ Needed for panel interaction */
}
```

This looks correct.

3. **Line 98-104: Paneview transparency**
```css
.dockview-theme-kineticore .dv-paneview {
  background: transparent !important;  /* ✅ Good */
}

.dockview-theme-kineticore .dv-splitview {
  background: transparent !important;  /* ✅ Good */
}
```

This looks correct.

## Recommended Additional Fixes

### Fix 1: Hide Watermark Completely
**File:** `src/ui/layouts/DockableLayoutWrapper.css`
**Line:** 88
**Change:**
```css
.dockview-theme-kineticore .watermark {
  display: none !important;  /* Force hide watermark */
}
```

### Fix 2: Ensure Professional Viewport Has Dimensions
**File:** `src/ui/layouts/ProfessionalModeLayout.css`
**Add:**
```css
.professional-content {
  flex: 1;
  min-height: 0;
  position: relative;
}

.professional-viewport {
  width: 100%;
  height: 100%;
  position: relative;
  background: transparent;
}
```

### Fix 3: Ensure Dockable Layout Wrapper Has Dimensions
**File:** `src/ui/layouts/DockableLayoutWrapper.css`
**Check Line 3-10:**
```css
.dockable-layout-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  background: transparent;  /* ✅ Good */
  pointer-events: auto;
  overflow: hidden;
}
```

This looks correct.

## Testing Plan

### Test 1: Visual Inspection
1. Refresh browser (Ctrl+R)
2. Look at center area
3. Expected: See 3D grid, not black/dark area
4. If black: Viewport is blocked or canvas not rendering

### Test 2: DevTools Element Inspection
1. Right-click center dark area
2. Inspect Element
3. Check what element is selected in Elements tab
4. Expected: `<canvas>` element
5. Actual (if bug): Some dockview element (`.watermark`, `.dv-group`, etc.)

### Test 3: Console Check
1. Open Console tab (F12)
2. Type: `SceneManager.getInstance().getScene()`
3. Expected: Scene object with meshes
4. Type: `SceneManager.getInstance().getEngine().getRenderWidth()`
5. Expected: Number > 0 (e.g., 1200)

### Test 4: Quick Preset Test
1. Click "Electrical" button
2. Check Console for `[QuickRoutePresets]` logs
3. Expected: 5 log lines
4. Check viewport for yellow cylinder
5. Expected: Cylinder visible

## Next Steps

1. Apply Fix 1 (hide watermark completely)
2. Apply Fix 2 (ensure viewport dimensions)
3. Test with DevTools inspection
4. Report back findings from DevTools Elements tab
