# Name-Based Tooling Unit Detection

## Overview

The **name-based unit detection** algorithm identifies tooling units (clamp units, pin units, support units, etc.) using **tree structure + naming heuristics** instead of purely geometric clustering.

This complements the existing point-cloud clustering approach ([TOOLING_UNITS_V2_ALGO.md](TOOLING_UNITS_V2_ALGO.md)) and works reliably across different tooling naming conventions:

- **Pattern A**: Implicit unit types (e.g., `UNIT_10x` with RH/LH structure)
- **Pattern B**: Explicit unit types (e.g., `CLAMP UNIT`, `PIN UNIT`, `BASE UNIT`)

## Algorithm

### High-Level Flow

```
Input: ToolingStructure + GeometryIndex
  ↓
1. Find Tool Root (heuristic: project number pattern or largest child)
  ↓
2. Build Enriched Nodes (pathNames, depth, points, nameTokens)
  ↓
3. Collect Raw Candidates (score based on naming + structure)
  ↓
4. Select Non-Overlapping Units (greedy, largest first, no ancestor/descendant overlap)
  ↓
5. Enrich with Side Info (LH/RH from path and children)
  ↓
Output: ToolingUnitCandidate[]
```

### Key Features

#### 1. Tool Root Detection

**`findToolRoot(root, geometryIndex)`**

Identifies the top-level assembly node:

1. If root has **one child**, use that child
2. If root has **multiple children**, search for alphanumeric project code patterns:
   - `\d{3,}[A-Z]` (e.g., `016ZF`, `2174530000`)
   - `[A-Z]{2,}\d{3,}` (e.g., `CM030`, `GJR`)
3. **Fallback**: Child with maximum points

#### 2. Unit Classification

**`classifyUnitKind(features)`**

Classifies units based on name tokens:

| Pattern | Kind | Example |
|---------|------|---------|
| `BASE` + `UNIT` | `base` | `*_BASE UNIT_*` |
| `RETRACT` + `PIN` + `UNIT` | `retractPin` | `*_RETRACT PIN UNIT_*` |
| `PIN` + `UNIT` | `pin` | `*_PIN UNIT_*` |
| `SUPPORT` + `UNIT` | `support` | `*_SUPPORT UNIT_*` |
| `CLAMP` + `UNIT` | `clamp` | `*_CLAMP UNIT_*` |
| `UNIT_*` + FIXED/MOVING structure | `clamp` | `UNIT_10x` (implicit clamp) |
| Other `UNIT` | `misc` | (configurable) |

#### 3. Scoring Function

**`scoreUnitCandidate(features, enriched, toolRootPoints, config)`**

Scores candidates based on structural evidence:

**Strong Evidence (+3 points)**
- Has `UNIT` token in name

**Moderate Evidence (+2 points)**
- Has FIXED/MOVING/OPEN/WIRE descendants
- Has both FASTENER and ORDER children

**Weak Evidence (+1 point)**
- Has actuation vendor name (DESTACO, TUENKERS, POWER, SCHUNK)
- Has side token (LH/RH)
- Points ratio in "unit band" (2%–50% of tool root)

**Penalties (-5 points)**
- Name contains `CONSTRUCTION`

**Threshold**: Default minimum score is **2**

#### 4. Non-Overlapping Selection

**`selectNonOverlappingUnits(candidates, nodeMap)`**

Greedy selection ensuring no ancestor/descendant overlap:

1. **Sort candidates** by priority:
   - Kind priority: `base` > `clamp` > `pin` > `retractPin` > `support` > `misc`
   - Depth (shallower first)
   - Points (descending)

2. **Greedily accept** candidates where:
   - Not already accepted
   - Not an ancestor or descendant of any accepted unit
   - Special rule: **Only one base unit** allowed

3. **Symmetry handling**: Units with `SYM` in name are marked `isSymmetric=true` but treated as separate units

#### 5. Side Detection

**`enrichWithSideInfo(unit, nodeMap)`**

Detects side (LH/RH) from:
- Path names (e.g., `UNIT_101 → RH → ...`)
- Immediate children (e.g., `LH`, `RH` nodes)

Returns:
- `LH` / `RH`: Single side detected
- `BOTH`: Both sides present in children
- `UNKNOWN`: No side information found

## Configuration

```typescript
interface UnitDetectionConfig {
  minPointsRatio?: number;       // Default: 0.005 (0.5%)
  maxBaseUnitRatio?: number;     // Default: 0.6 (60%)
  minScoreForUnit?: number;      // Default: 2
  allowMiscUnits?: boolean;      // Default: false
  maxDepth?: number;             // Default: 20
}
```

## Usage

### Basic Usage

```typescript
import { selectToolingUnits } from '@/domain/tooling/nameBasedUnitDetection';

const units = selectToolingUnits(structure, geometryIndex);

for (const unit of units) {
  console.log(`${unit.displayName} - ${unit.kind} (${unit.side})`);
  console.log(`  Points: ${unit.points}`);
  console.log(`  Symmetric: ${unit.isSymmetric}`);
}
```

### With Custom Config

```typescript
const config: UnitDetectionConfig = {
  minPointsRatio: 0.01,    // Require at least 1% of tool points
  minScoreForUnit: 3,      // Higher threshold
  allowMiscUnits: true,    // Include misc units
};

const units = selectToolingUnits(structure, geometryIndex, config);
```

### Finding Tool Root Only

```typescript
import { findToolRoot } from '@/domain/tooling/nameBasedUnitDetection';

const toolRoot = findToolRoot(structure.root, geometryIndex);
console.log(`Tool root: ${toolRoot?.name}`);
```

## Output Format

```typescript
interface ToolingUnitCandidate {
  id: string;                 // Node ID of subtree root
  pathNames: string[];        // Full path from tool root
  displayName: string;        // e.g., "UNIT_106 RH", "CLAMP UNIT_240"
  kind: ToolingUnitKind;      // base | clamp | pin | support | retractPin | misc
  isSymmetric: boolean;       // True if name contains "SYM"
  side: Side;                 // LH | RH | BOTH | UNKNOWN
  depth: number;              // Tree depth
  points: number;             // Total points at this node
  parentPoints: number | null;
  score: number;              // Unit-likeness score
}
```

## Known Patterns

### Pattern A: Implicit Unit Types (UNIT_xxx with RH/LH)

**Structure:**
```
__root__ (100)
  └─ 016ZF_20142452_110 (101) [TOOL ROOT]
      ├─ UNIT_101 (102) [CLAMP UNIT]
      │   └─ RH (103)
      │       ├─ FIXED (104)
      │       ├─ MOVING (105)
      │       ├─ FASTENER (106)
      │       └─ ORDER (107)
      │           └─ POWER_CLAMP_* (...)
      ├─ UNIT_102 (108) [CLAMP UNIT]
      │   └─ LH (109)
      │       ├─ FIXED (110)
      │       ├─ MOVING (111)
      │       └─ ...
      └─ UNIT_106 (114) [CLAMP UNIT]
          └─ RH (115)
              ├─ FIXED (116)
              ├─ MOVING (117)
              ├─ WIRE (118)
              └─ ORDER (119)
```

**Detected Units:**
- `UNIT_101` (kind: clamp, side: RH)
- `UNIT_102` (kind: clamp, side: LH)
- `UNIT_106` (kind: clamp, side: RH)

**Key Characteristics:**
- Units named `UNIT_xxx` (numeric suffix)
- Side info in `RH`/`LH` child nodes
- Typical children: FIXED, MOVING, WIRE/OPEN, FASTENER, ORDER

### Pattern B: Explicit Unit Types (Typed Unit Names)

**Structure:**
```
__root__ (200)
  └─ 2174530000_M00_GJR_RR_FLR_CM030_T01 (201) [TOOL ROOT]
      ├─ 2174530020_M00_BASE UNIT_020 (202) [BASE UNIT]
      │   ├─ 2174530020_FIXED (203)
      │   └─ AUTOMATION (204)
      │       └─ (valve islands, manifolds, etc.)
      ├─ 2174530040_M00_CLAMP UNIT_040 (205) [CLAMP UNIT]
      │   ├─ 2174530040_FIXED (206)
      │   └─ 2174530040_MOVING (207)
      ├─ 2174530140_M00_PIN UNIT_140 (208) [PIN UNIT]
      │   └─ 2174530140_FIXED (209)
      ├─ 2174530180_M00_SUPPORT UNIT_180 (210) [SUPPORT UNIT]
      ├─ 2174530200_M00_SUPPORT UNIT_200_SYM_180 (212) [SUPPORT UNIT, SYMMETRIC]
      ├─ 2174530320_M00_RETRACT PIN UNIT_320 (220) [RETRACT PIN UNIT]
      ├─ 2174530340_M00_RETRACT PIN UNIT_340_SYM_320 (223) [RETRACT PIN UNIT, SYMMETRIC]
      └─ 2174530CST_M00_CONSTRUCTION (226) [IGNORED - 0 points]
```

**Detected Units:**
- 1× BASE UNIT
- 4× CLAMP UNITs
- 1× PIN UNIT
- 2× SUPPORT UNITs (one symmetric)
- 2× RETRACT PIN UNITs (one symmetric)

**Key Characteristics:**
- Explicit unit type in name (`CLAMP UNIT`, `PIN UNIT`, etc.)
- Symmetric units marked with `_SYM_*` pattern
- BASE UNIT contains AUTOMATION subtree (kept together)
- CONSTRUCTION nodes have 0 points (ignored)

## Pitfalls & Safety Rules

### 1. BASE UNIT Automation

**DO NOT** break out `AUTOMATION` subtrees as separate units.

**Example:**
```
2174530020_M00_BASE UNIT_020
  ├─ 2174530020_FIXED
  └─ AUTOMATION [PART OF BASE UNIT, NOT SEPARATE]
      ├─ valve_island_*
      ├─ manifold_*
      └─ lifting_ring_*
```

### 2. Valve Banks / Piping Inside Units

**DO NOT** treat valve banks, piping, or automation components as separate units when they appear inside a unit's ORDER/VB subtree.

**Example:**
```
UNIT_xxx
  └─ RH
      └─ ORDER
          └─ VB [PART OF UNIT, NOT SEPARATE]
              ├─ 6_Valves_24_Inputs
              ├─ Piping
              ├─ Inline_fittings
              └─ m12_lead_connector_female
```

### 3. Small Parts (Fasteners, Brackets, Locators)

**DO NOT** select tiny components as independent units.

**Suppressed by:**
- `minPointsRatio` threshold (default 0.5% of tool root)
- Low scoring (small parts lack FIXED/MOVING structure)

**Examples:**
- `DIN912_*`, `DIN934_*` (bolts, nuts)
- `*_PLATE`, `*_SENSOR_BRACKET`, `*_NC_LOCATOR`

### 4. CONSTRUCTION Nodes with 0 Points

**Always ignore** nodes with `points <= 0`.

**Example:**
```
2174530CST_M00_CONSTRUCTION :: points=0  [IGNORED]
```

### 5. Symmetric Units

**Treat as separate units**, but mark `isSymmetric=true`.

**Example:**
```
2174530200_M00_SUPPORT UNIT_200_SYM_180
```

Detected as a **separate unit** from `180`, but linked via:
- `isSymmetric=true`
- `displayName` includes `SYM_180`

## Testing

### Unit Tests

Location: `tests/domain/tooling/nameBasedUnitDetection.test.ts`

**Fixtures:**
- `createPatternAFixture()` – Implicit unit types (UNIT_xxx)
- `createPatternBFixture()` – Explicit unit types (CLAMP UNIT, PIN UNIT, etc.)

**Test Coverage:**
- ✓ Tool root detection
- ✓ Pattern A detection (UNIT_xxx with RH/LH structure)
- ✓ Pattern B detection (BASE/CLAMP/PIN/SUPPORT/RETRACT PIN)
- ✓ Side detection (LH/RH/BOTH)
- ✓ Symmetry detection
- ✓ Non-overlapping selection
- ✓ Configuration options
- ✓ Edge cases (null roots, missing geometry, 0 points)

### Manual Validation

Run standalone test:
```bash
npx tsx scripts/testNameBasedDetection.ts
```

Expected output:
```
Testing name-based unit detection...

1. Testing findToolRoot:
   Tool root: 016ZF_20142452_110 (ID: 101)
   ✓ PASS

2. Testing selectToolingUnits:
   Detected 1 unit(s):
   - UNIT_101 (kind: clamp, side: RH, points: 49054)
   ✓ PASS
   ✓ PASS - Kind is 'clamp'
   ✓ PASS - Side is 'RH'
   ✓ PASS - Points is 49,054

✓ All manual tests passed!
```

## Comparison: Name-Based vs. Point-Cloud Clustering

| Feature | Name-Based | Point-Cloud Clustering |
|---------|-----------|----------------------|
| **Input** | Tree structure + names | Point cloud geometry |
| **Detection** | Heuristic (patterns) | Spatial clustering |
| **Speed** | Very fast (tree traversal) | Slower (bbox overlap) |
| **Accuracy** | High (when names follow conventions) | Medium (depends on spatial separation) |
| **Robustness** | Fails on non-standard naming | Works regardless of naming |
| **Use Case** | Production tools with known naming | Unknown/messy structures |

**Recommendation**: Use **name-based** as primary, fall back to **point-cloud clustering** if names are ambiguous or non-standard.

## Future Enhancements

### 1. Vendor-Specific Patterns

Add more actuation vendor patterns:
- SMC, Festo, Norgren, etc.

### 2. Multi-Stage Refinement

Combine both approaches:
```typescript
// Stage 1: Name-based (fast)
const nameUnits = selectToolingUnits(structure, geometryIndex);

// Stage 2: Point-cloud clustering (fallback for undetected nodes)
const clusterUnits = detectUnits(structure, geometryIndex, {
  excludeNodes: nameUnits.flatMap(u => u.nodeIds)
});

// Merge results
const allUnits = [...nameUnits, ...clusterUnits];
```

### 3. Confidence Scoring

Return confidence level per unit:
```typescript
interface ToolingUnitCandidate {
  // ... existing fields
  confidence: number; // 0.0–1.0
}
```

### 4. Family Linking for Symmetric Units

Automatically link symmetric units:
```typescript
interface ToolingUnitCandidate {
  // ... existing fields
  symmetricFamilyId?: string; // e.g., "180" for SYM_180 units
}
```

## See Also

- [TOOLING_UNITS_V2_ALGO.md](TOOLING_UNITS_V2_ALGO.md) – Point-cloud clustering approach
- [src/domain/tooling/nameBasedUnitDetection.ts](../../src/domain/tooling/nameBasedUnitDetection.ts) – Implementation
- [tests/domain/tooling/nameBasedUnitDetection.test.ts](../../tests/domain/tooling/nameBasedUnitDetection.test.ts) – Test suite
