# Asset Library Category Redesign

**Date:** 2025-10-27
**Owner:** George McIntyre (Agent 1)

---

## Problem Statement

The original category structure was too prescriptive and not flexible:

❌ **Issues:**
- Hard-coded specific categories (Grippers, Conveyors, etc.)
- Not user-driven - can't create custom categories
- "Manufacturing" was too specific, not generic enough
- Mixed high-level categories (Robots) with specific types (6-Axis Arms)

---

## Solution: Flexible, User-Driven Categories

### New Design Principles

1. **Generic Top-Level Categories** - Broad classification
2. **User-Defined Categories** - Users can create their own
3. **Auto-Categorization** - Assets categorized by metadata
4. **Flat Structure** - Minimal hierarchy, easier to browse

---

## New Category Structure

### Default Categories (Minimal & Generic):

```
📦 Robots
   └─ (All robot types: articulated, SCARA, delta, collaborative, etc.)

⚙️ Equipment & Machinery
   └─ (Conveyors, grippers, actuators, general equipment)

🚗 Vehicles
   └─ (AGVs, forklifts, cranes, mobile platforms)

🏗️ Structures & Buildings
   └─ (Framing, panels, racks, shelving, buildings)

🔧 Tools & Accessories
   └─ (End effectors, fasteners, sensors, misc tools)

👤 My Assets
   ├─ Imported (User-imported from files)
   └─ Created in Scene (Built using primitives)
```

### User Can Add Custom Categories:

```
🎯 Assembly Line 1
🎯 Warehouse Section A
🎯 Prototype Components
🎯 [Any custom category user creates]
```

---

## How It Works

### 1. Browsing Assets

**By Category:**
- Click "Robots" → Shows all robots (any type)
- Click "Equipment & Machinery" → Shows conveyors, grippers, etc.

**By Type (Refined Filtering):**
- Select category "Robots"
- Check filter: "Articulated Robots" ✓
- Results: Only articulated robots

### 2. Creating Custom Categories

**Method 1: Click "+" Button**
```
User clicks [+] button
→ Prompt: "Enter category name:"
→ User types: "Assembly Line 1"
→ New category created
→ Drag assets into category (future feature)
```

**Method 2: Tag-Based Auto-Categorization**
```
Asset has tags: ['assembly', 'line1']
→ System suggests: "Create category 'Assembly Line 1'?"
→ Auto-categorize matching assets
```

### 3. Filtering Within Categories

After selecting a category, use filters to refine:

**Example:**
1. Select "Robots" category
2. Filter by:
   - ✓ Payload: 0-20 kg
   - ✓ Reach: 500-1500 mm
   - ✓ Type: SCARA
3. Results: SCARA robots with 6kg payload, 900mm reach

---

## Asset Metadata Mapping

Assets are auto-categorized based on their `assetClass` field:

| assetClass | Default Category |
|-----------|-----------------|
| `robots` | Robots |
| `machinery` | Equipment & Machinery |
| `endEffectors` | Equipment & Machinery |
| `vehicles` | Vehicles |
| `structures` | Structures & Buildings |
| `tools` | Tools & Accessories |
| `custom` | My Assets |

**Asset Type** determines sub-filtering (articulated, SCARA, delta, etc.)

---

## Implementation

### File: `FilterPaneFlexible.tsx`

**Features:**
- ✅ Generic default categories
- ✅ "Add Category" button (+)
- ✅ "Manage Categories" button (⚙️)
- ✅ Asset type checkboxes for refined filtering
- ✅ Search fixed (backspace works)

**Category State:**
```typescript
const [categories, setCategories] = useState<CategoryNode[]>(DEFAULT_CATEGORIES);

const handleAddCategory = () => {
  const newCategoryName = prompt('Enter category name:');
  const newCategory: CategoryNode = {
    id: `user-${Date.now()}`,
    label: newCategoryName,
    domain: 'custom',
    assetClass: 'custom',
    userDefined: true,
  };
  setCategories([...categories, newCategory]);
};
```

---

## Usage Examples

### Example 1: Robot Designer

**Workflow:**
1. Open Asset Library
2. Click "Robots" category
3. Filter:
   - ✓ Articulated Robots
   - Payload: 5-15 kg
   - Reach: 800-1500 mm
4. Browse results
5. Drag robot into scene

### Example 2: Warehouse Layout

**Workflow:**
1. Click [+] → Create category "Warehouse Zone A"
2. Import AGVs, racks, conveyors
3. Tag all with "zone-a"
4. Assets auto-appear in custom category
5. Build layout from category

### Example 3: Project Organization

**Custom Categories:**
- "Project Alpha - Robots"
- "Project Alpha - Fixtures"
- "Project Beta - Equipment"

**Benefits:**
- Organize by project
- Quick access to relevant assets
- Share categories with team (future)

---

## Future Enhancements

### Phase 2: Smart Categorization
- AI suggests categories based on asset usage
- Auto-detect patterns (e.g., "You often use FANUC robots together")
- Smart folders

### Phase 3: Team Categories
- Share custom categories with team
- Team libraries
- Category templates

### Phase 4: Drag & Drop Organization
- Drag asset to category to assign
- Multi-select for bulk categorization
- Visual category builder

---

## Migration from Old System

**Old Categories → New Categories:**

| Old | New |
|-----|-----|
| Manufacturing → 6-Axis Arms | Robots + Filter: Articulated |
| Manufacturing → SCARA Arms | Robots + Filter: SCARA |
| Manufacturing → Grippers | Equipment & Machinery + Search: "gripper" |
| Manufacturing → Conveyors | Equipment & Machinery + Search: "conveyor" |
| Logistics → AGVs | Vehicles + Filter: AGV |
| Structural → Beams | Structures & Buildings + Search: "beam" |

**No data loss** - All assets remain accessible, just organized differently.

---

## Integration

### Replace FilterPane:

File: `src/ui/components/AssetLibrary/AssetLibraryPanelV2.tsx`

```typescript
// OLD
import { FilterPane } from './FilterPane';

// NEW
import { FilterPaneFlexible as FilterPane } from './FilterPaneFlexible';
```

---

## Benefits

✅ **More Flexible** - Users create their own organization
✅ **Less Prescriptive** - Broad categories, refine with filters
✅ **Scalable** - Works for 10 or 10,000 assets
✅ **Project-Friendly** - Organize by projects/zones/stages
✅ **Future-Proof** - Easy to extend with new features

---

## Summary

**Old System:**
```
Manufacturing
  ├─ 6-Axis Arms         ← Too specific
  ├─ SCARA Arms          ← Too specific
  ├─ Grippers            ← Should be under Equipment
  └─ Conveyors           ← Should be under Equipment
```

**New System:**
```
Robots                   ← Generic
Equipment & Machinery    ← Generic
Vehicles                 ← Generic
[+ Add Custom Category]  ← User-driven
```

**Filtering:**
- Start broad: "Robots"
- Refine: ✓ Articulated, Payload 5-15kg
- Result: Exactly what you need

---

**Status:** Implementation complete
**File:** [FilterPaneFlexible.tsx](../src/ui/components/AssetLibrary/FilterPaneFlexible.tsx)
**Next:** Test with demo data
