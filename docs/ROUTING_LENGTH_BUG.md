# Routing Length Calculation Bug

**Date:** 2025-11-03  
**Severity:** 🔴 CRITICAL  
**Issue:** Routes showing 10,000+ meter lengths (should be ~10 meters or less)

---

## Problem

Routes are displaying **absurdly large lengths**:
- Example: `1 segments, 10117.03m` (over 10 kilometers!)
- Should be: `1 segments, 10.12m` (reasonable)

---

## Root Cause Analysis

### Coordinate System Mismatch

**Coordinate Conversion:**
```typescript
// Babylon.js uses: Y-up, meters
// User space uses: Z-up, millimeters

export function babylonToUser(babylonPos: BABYLON.Vector3): Vector3 {
  return {
    x: babylonPos.x * M_TO_MM,  // meters → millimeters (×1000)
    y: babylonPos.z * M_TO_MM,  // meters → millimeters (×1000)
    z: babylonPos.y * M_TO_MM,  // meters → millimeters (×1000)
  };
}
```

**Length Calculation:**
```typescript
// Route segment length is calculated in user space (millimeters)
const dx = end.x - start.x;  // mm - mm = mm
const dy = end.y - start.y;  // mm - mm = mm
const dz = end.z - start.z;  // mm - mm = mm
const length = Math.sqrt(dx * dx + dy * dy + dz * dz);  // Result: mm
```

**Display:**
```tsx
// Route list shows length in meters
{route.getTotalLength().toFixed(2)}m  // Length is in MM, not meters!
```

**Bug:** `getTotalLength()` returns **millimeters** but is displayed as **meters**!

---

## Evidence

### Console Logs from User Testing

```
CreateConnectionPointCommand] Position: {x: 78.48837108955516, y: 133.8955565940516, z: 1.0000000474974513}
CreateConnectionPointCommand] Position: {x: -9994.18591873687, y: -297.7684666944089, z: 1.0000000474974513}
```

**Distance calculation:**
- dx = -9994.19 - 78.49 = **-10,072.68 mm**
- dy = -297.77 - 133.90 = **-431.67 mm**
- dz = 1.00 - 1.00 = **0 mm**
- Length = sqrt(10,072.68² + 431.67²) = **10,082 mm = 10.08 meters**

**But displayed as:** `10117.03m` (off by factor of 1000)

---

## Fix Options

### Option 1: Convert Length Before Display (RECOMMENDED)

**Change:** Convert millimeters to meters when displaying

**Code:**
```tsx
// In RoutingControlPanel.tsx, RouteStatsPanel.tsx, etc.

// BEFORE:
<div className="route-details">
  {route.segments.length} segments, {route.getTotalLength().toFixed(2)}m
</div>

// AFTER:
<div className="route-details">
  {route.segments.length} segments, {(route.getTotalLength() / 1000).toFixed(2)}m
</div>
```

**Files to Update:**
- `src/routing/ui/RoutingControlPanel.tsx` (line 270)
- `src/routing/ui/RouteStatsPanel.tsx` (anywhere length is displayed)
- `src/routing/ui/RouteEditPanel.tsx` (if length shown)
- Any other UI components displaying route lengths

---

### Option 2: Store Lengths in Meters (BREAKING CHANGE)

**Change:** Convert segment lengths to meters when calculating

**Code:**
```typescript
// In Route.ts createSegmentFromPoints()
private createSegmentFromPoints(start: Vector3, end: Vector3): RouteSegment {
  const dx = end.x - start.x;  // mm
  const dy = end.y - start.y;  // mm
  const dz = end.z - start.z;  // mm
  const lengthMm = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const lengthM = lengthMm / 1000;  // Convert to meters
  
  return {
    id: generateId(),
    startPoint: { ...start },
    endPoint: { ...end },
    segmentType: 'straight',
    length: lengthM,  // Store in meters
  };
}
```

**Impact:** 
- ❌ Breaking change (all existing routes will show wrong lengths)
- ✅ Consistent units throughout system

---

### Option 3: Add Unit Helper Function

**Create utility:**
```typescript
// In src/routing/core/RoutingUtils.ts

/**
 * Format route length for display (mm → m)
 */
export function formatRouteLength(lengthMm: number): string {
  const lengthM = lengthMm / 1000;
  if (lengthM < 0.01) {
    return `${(lengthMm).toFixed(0)}mm`;  // Show mm for tiny routes
  } else if (lengthM < 1000) {
    return `${lengthM.toFixed(2)}m`;      // Show meters for normal routes
  } else {
    return `${(lengthM / 1000).toFixed(2)}km`;  // Show km for very long routes
  }
}
```

**Usage:**
```tsx
import { formatRouteLength } from '../core/RoutingUtils';

<div className="route-details">
  {route.segments.length} segments, {formatRouteLength(route.getTotalLength())}
</div>
```

**Result:** `1 segments, 10.08m` ✅

---

## Recommended Fix

**Priority 1:** Apply Option 1 (quick fix)

1. Find all places displaying `route.getTotalLength()` with `m` unit
2. Divide by 1000: `(route.getTotalLength() / 1000).toFixed(2)`
3. Test with routes of known lengths

**Priority 2:** Add Option 3 (nice to have)

1. Create `formatRouteLength()` helper
2. Replace all manual conversions with helper
3. Handles edge cases (mm, m, km)

---

## Testing

### Test Case 1: Small Route

**Setup:** Create route between (0, 0, 0) and (1000, 0, 0) mm  
**Expected:** `1.00m`  
**Before Fix:** `1000.00m` ❌  
**After Fix:** `1.00m` ✅

### Test Case 2: Medium Route

**Setup:** Create route between (0, 0, 0) and (5000, 3000, 0) mm  
**Expected:** `5.83m` (sqrt(5² + 3²) = 5.83)  
**Before Fix:** `5830.95m` ❌  
**After Fix:** `5.83m` ✅

### Test Case 3: User's Route

**Setup:** Route from console logs  
**Expected:** `~10.08m`  
**Before Fix:** `10117.03m` ❌  
**After Fix:** `10.08m` ✅

---

## Files to Fix

1. ✅ `src/routing/ui/RoutingControlPanel.tsx` - Line 270
2. ✅ `src/routing/ui/RouteStatsPanel.tsx` - All length displays
3. ✅ `src/routing/ui/RouteEditPanel.tsx` - If length shown
4. ✅ `src/routing/ui/RouteWarningsPanel.tsx` - If length in warnings
5. ✅ Any other components displaying route lengths

---

## Related Issues

1. **Coordinate Conversion:** Verify `babylonToUser` is correct
2. **Click Position Accuracy:** Check if click positions are reasonable
3. **Unit Consistency:** Document that lengths are stored in mm internally

---

## Summary

**Problem:** Route lengths are stored in **millimeters** but displayed as **meters**  
**Impact:** Routes show 1000× larger than actual  
**Fix:** Divide by 1000 when displaying: `(length / 1000).toFixed(2)`  
**Priority:** 🔴 **CRITICAL** - Makes system unusable






