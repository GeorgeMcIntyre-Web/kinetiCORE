# Routing System Tasks for Codex Agent

**Priority:** Fix visual issues and simplify workflow  
**Approach:** One task at a time, test after each

---

## Task 1: Fix Connection Point Sphere Size (5 minutes)

**Problem:** Spheres are 1.0 meter diameter - way too big!  
**File:** `src/routing/ui/ConnectionPointsRenderer.tsx` line 54

**Change:**
```typescript
// FROM:
diameter: 1.0, // Much larger for easy clicking (1 meter)

// TO:
diameter: 0.05, // 50mm - proportional to pipes
```

**Test:** Create connection point → sphere should be reasonable size

---

## Task 2: Make Pipe Cylinders More Visible (10 minutes)

**Problem:** Pipes are tiny (27mm diameter) - hard to see  
**File:** `src/routing/geometry/PipeGenerator.ts` line 218

**Options:**
1. **Scale up pipe diameter** (visual scale):
   ```typescript
   const diameter = od * 3; // 3x larger for visibility
   ```

2. **Or use minimum visible size:**
   ```typescript
   const diameter = Math.max(od, 0.05); // At least 50mm visible
   ```

**Test:** Create pipe route → should see visible cylinder, not tiny line

---

## Task 3: Convert "Place Connector" to Icon Button (5 minutes)

**Problem:** Button says "Place Connectors" text - should be icon  
**File:** `src/routing/ui/RoutingControlPanel.tsx` line 161-167

**Change:**
```tsx
// Add Network icon import at top
import { Network } from 'lucide-react';

// Change button to icon-only
<button
  className={`primary-btn ${routingMode === 'placing_connector' ? 'active' : ''}`}
  onClick={handlePlaceConnector}
  title="Place Connectors (click geometry in 3D)"
>
  <Network size={18} />
</button>
```

**Test:** Button shows icon, tooltip on hover

---

## Task 4: Fix Warning Panel Layout Issue (10 minutes)

**Problem:** Warning panel still causes ribbon bar to shrink

**File:** `src/routing/ui/RouteWarningsPanel.css`

**Solution:** Ensure warning panel uses absolute positioning within header container, or add padding to push content down instead of shrinking header.

**Option A - Use portal/overlay:**
```css
.route-warnings-panel {
  position: fixed;
  top: 48px; /* Below header */
  left: 0;
  right: 0;
  z-index: 1000;
  /* Add margin to push content below */
}
```

**Then add to layout:**
```css
.professional-header {
  /* ... existing ... */
  position: relative; /* Ensure z-index stacking */
}

.professional-content {
  margin-top: 0; /* Remove any margin, let warning push down */
  padding-top: 40px; /* Space for warning when visible */
}
```

**Test:** Warning appears → ribbon bar stays same size

---

## Task 5: Make Route Labels Visible (15 minutes)

**Problem:** Debug labels code exists but labels not showing in viewport

**Check:**
1. Is `RouteDebugLabels` component rendered? (`ProfessionalModeLayout.tsx`)
2. Is `setGlobalDebugLabels()` called?
3. Are labels visible by default?
4. Is eye icon toggle working?

**File:** Check `src/routing/ui/RouteDebugLabels.ts` and where it's used

**Fix:** Ensure labels are created and added to scene properly

**Test:** Create route → labels appear above route in 3D

---

## Task 6: Simple Workflow Test (10 minutes)

**Goal:** Verify complete workflow works end-to-end

**Steps:**
1. Click "Place Connector" button (icon)
2. Click in 3D viewport
3. Click second location
4. Verify:
   - ✅ 2 spheres appear (reasonable size)
   - ✅ Pipe cylinder appears (visible, not tiny)
   - ✅ Route created
   - ✅ Labels visible (if enabled)

**If broken:** Document what fails, then fix

---

## Order of Execution

**Start with:** Task 1 (sphere size) - quickest, most visible fix  
**Then:** Task 2 (pipe visibility) - makes routes actually visible  
**Then:** Task 3 (icon button) - UX polish  
**Then:** Task 4 (warning layout) - layout fix  
**Then:** Task 5 (labels) - debug existing feature  
**Finally:** Task 6 (test everything)

---

## Success Criteria

After all tasks:
- ✅ Spheres reasonable size (~50mm)
- ✅ Pipes clearly visible (not tiny lines)
- ✅ Icon buttons (not text)
- ✅ Warning panel doesn't shrink ribbon
- ✅ Labels visible when enabled
- ✅ Complete workflow: Click → Click → See pipe

**Estimated Time:** 1-2 hours total

**Each task is independent** - can be done separately and tested individually.

