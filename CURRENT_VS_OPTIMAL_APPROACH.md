# Current vs Optimal Approach for State Node Detection

## Current Approach (Lines 802-832)

### What It Does:

```
UNIT_104
  ├── RH (immediate child)
  │   ├── MOVING_1 (grandchild, has geometry) ✅ Added
  │   ├── MOVING_2 (grandchild, has geometry) ✅ Added
  │   └── FIXED (grandchild, has geometry) ✅ Added (WRONG!)
  ├── LH (immediate child)
  │   ├── MOVING_1 (grandchild, has geometry) ✅ Added
  │   ├── MOVING_2 (grandchild, has geometry) ✅ Added
  │   └── FIXED (grandchild, has geometry) ✅ Added (WRONG!)
  └── OPEN (immediate child)
      ├── OPEN_RH (grandchild, has children)
      │   ├── MOVING_1 (great-grandchild, has geometry) ✅ Added
      │   └── MOVING_2 (great-grandchild, has geometry) ✅ Added
      └── OPEN_LH (grandchild, has children)
          ├── MOVING_1 (great-grandchild, has geometry) ✅ Added
          └── MOVING_2 (great-grandchild, has geometry) ✅ Added

Result: 10+ state nodes per unit (includes FIXED which shouldn't be there)
```

### Problem:
- **Too Inclusive**: Adds ALL nodes with geometry
- **Includes FIXED**: FIXED is a different geometry, not a state
- **No Sibling Filtering**: Doesn't check if node is part of a sibling pair
- **Result**: 94+ candidates, many of which are irrelevant

## Optimal Approach (Based on Test Results)

### What It Should Do:

```
UNIT_104
  ├── RH (immediate child)
  │   ├── MOVING_1 (grandchild, has sibling MOVING_2) ✅ Added (part of pair)
  │   ├── MOVING_2 (grandchild, has sibling MOVING_1) ✅ Added (part of pair)
  │   └── FIXED (grandchild, no similar sibling) ❌ Skipped
  ├── LH (immediate child)
  │   ├── MOVING_1 (grandchild, has sibling MOVING_2) ✅ Added (part of pair)
  │   ├── MOVING_2 (grandchild, has sibling MOVING_1) ✅ Added (part of pair)
  │   └── FIXED (grandchild, no similar sibling) ❌ Skipped
  └── OPEN (immediate child)
      ├── OPEN_RH (grandchild, has children)
      │   ├── MOVING_1 (great-grandchild, has sibling MOVING_2) ✅ Added (part of pair)
      │   └── MOVING_2 (great-grandchild, has sibling MOVING_1) ✅ Added (part of pair)
      └── OPEN_LH (grandchild, has children)
          ├── MOVING_1 (great-grandchild, has sibling MOVING_2) ✅ Added (part of pair)
          └── MOVING_2 (great-grandchild, has sibling MOVING_1) ✅ Added (part of pair)

Result: 8 state nodes (only MOVING pairs, no FIXED)
```

### Key Difference:
- **Only Collect Sibling Groups**: Only add nodes that are part of a sibling pair
- **Filter FIXED**: FIXED has no similar sibling, so skip it
- **Result**: Fewer, more relevant candidates

## Code Comparison

### Current Code (Lines 806-832):
```typescript
for (const child of immediateChildren) {
  const grandChildren = this.getImmediateChildren(child);
  
  for (const grandChild of grandChildren) {
    const greatGrandChildren = this.getImmediateChildren(grandChild);
    
    if (greatGrandChildren.length > 0) {
      // Depth 3: Add ALL nodes with geometry
      for (const ggc of greatGrandChildren) {
        if (this.hasSignificantGeometry(ggc, opts.minVolume)) {
          targetNodes.push(ggc); // ❌ Adds everything
        }
      }
    } else {
      // Depth 2: Add ALL nodes with geometry
      if (this.hasSignificantGeometry(grandChild, opts.minVolume)) {
        targetNodes.push(grandChild); // ❌ Adds everything (including FIXED)
      }
    }
  }
}
```

### Optimal Code (Proposed):
```typescript
for (const child of immediateChildren) {
  const grandChildren = this.getImmediateChildren(child);
  
  // Check if grandchildren have their own children (depth 3)
  if (grandChildren.some(gc => this.getImmediateChildren(gc).length > 0)) {
    // Depth 3: OPEN -> OPEN_RH -> MOVING
    for (const grandChild of grandChildren) {
      const greatGrandChildren = this.getImmediateChildren(grandChild);
      
      // ✅ Only add if this is a sibling group (2+ children)
      if (greatGrandChildren.length >= 2) {
        for (const ggc of greatGrandChildren) {
          if (this.hasSignificantGeometry(ggc, opts.minVolume)) {
            targetNodes.push(ggc); // ✅ Only adds nodes in sibling groups
          }
        }
      }
    }
  } else {
    // Depth 2: RH -> MOVING
    // ✅ Only add if this is a sibling group (2+ children)
    if (grandChildren.length >= 2) {
      for (const grandChild of grandChildren) {
        if (this.hasSignificantGeometry(grandChild, opts.minVolume)) {
          targetNodes.push(grandChild); // ✅ Only adds nodes in sibling groups
        }
      }
    }
  }
}
```

## Why This Works

### Test Results Show:
- **MOVING_1 and MOVING_2**: Same geometry (0.0% BB difference) ✅
- **MOVING_1 and FIXED**: Different geometry (99.6% BB difference) ❌

### The Fix:
1. **Only collect nodes in sibling groups** (2+ children with same parent)
   - RH has MOVING_1, MOVING_2, FIXED → Collect all 3 (they're siblings)
   - But then BB similarity will filter out FIXED (no similar sibling)

2. **Better: Pre-filter by sibling count**
   - Only collect from parent groups with 2+ children
   - This naturally focuses on MOVING pairs
   - FIXED might be alone or have no similar sibling

3. **Even Better: Early BB filtering**
   - Before adding to candidates, check if node has a sibling with similar BB
   - Only add nodes that are part of a potential pair
   - This filters FIXED early

## Recommended Implementation

### Step 1: Collect Only Sibling Groups
```typescript
// Only collect nodes from parent groups with 2+ children
if (grandChildren.length >= 2) {
  // This is a sibling group - collect all children
  for (const grandChild of grandChildren) {
    if (this.hasSignificantGeometry(grandChild, opts.minVolume)) {
      targetNodes.push(grandChild);
    }
  }
}
```

### Step 2: Early BB Filtering (Optional but Better)
```typescript
// Before adding, check if this node has a sibling with similar BB
const hasSimilarSibling = grandChildren.some(sibling => {
  if (sibling === grandChild) return false;
  return this.areBoundingBoxesSimilar(
    { boundingBox: this.computeNodeBoundingBox(grandChild), ... },
    { boundingBox: this.computeNodeBoundingBox(sibling), ... }
  );
});

if (hasSimilarSibling && this.hasSignificantGeometry(grandChild, opts.minVolume)) {
  targetNodes.push(grandChild);
}
```

## Summary

**Current Issue:**
- Collects ALL nodes with geometry (94+ per unit)
- Includes FIXED and other non-state nodes
- Too many candidates for ICP comparison

**Optimal Solution:**
- Only collect nodes from sibling groups (2+ children)
- This naturally focuses on MOVING pairs
- Fewer, more relevant candidates
- BB + ICP will then verify the pairs

**The Fix:**
- Change line 824-826: Only add if `grandChildren.length >= 2`
- Change line 818-821: Only add if `greatGrandChildren.length >= 2`
- This ensures we only collect nodes that are part of sibling groups

