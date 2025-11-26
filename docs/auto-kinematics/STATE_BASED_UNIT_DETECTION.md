# State-Based Unit Detection

## Overview

State-based unit detection identifies tooling units by analyzing kinematic snapshots (world transforms at different states like "open" vs "closed"). This approach complements structure-based detection by providing motion-based verification of units.

## Key Concepts

### Kinematic Snapshots
A snapshot captures the world transform (position + rotation) of every node at a specific state:

```typescript
interface KinematicSnapshot {
  stateId: string;
  nodeWorldMatrices: Map<string, Matrix>;
}
```

### Rigid Groups
Nodes that move together as a rigid body across all snapshots are clustered into rigid groups:

```typescript
interface RigidGroup {
  id: RigidGroupId;
  nodeIds: string[];
  isStatic: boolean;
  totalPoints: number;
}
```

### Detection Flow
1. **Detect rigid groups** - Cluster nodes by transform consistency
2. **Select base group** - Choose static group with largest point count
3. **Build graph** - Connect rigid groups via joint pairs
4. **Extract units** - Each moving group connected to base becomes a unit

## Usage

### Basic Usage

```typescript
import { runUnitsV2Pipeline } from '@/domain/tooling';

const result = runUnitsV2Pipeline(structure, geometryIndex, {
  snapshots: [openSnapshot, closedSnapshot],
  includeDebug: true,
  stateBasedDetection: { minMovingGroupPoints: 20 },
});

// Access state-based units
console.log(result.stateBasedUnits);

// Access comparison metadata
console.log(result.metadata?.comparison);
```

### Configuration Options

```typescript
interface StateBasedUnitDetectionConfig {
  transformEpsilon: number;        // Transform equality threshold (default: 1e-3)
  minGroupPoints: number;          // Min points for a valid group (default: 10)
  maxDepth: number;                // Max tree traversal depth (default: 50)
  minMovingGroupPoints: number;    // Min points for a moving group (default: 10)
}
```

## Comparison Layer

The pipeline includes a comparison layer that matches state-based units against structure-based candidates:

### Match Logic
1. **Primary match**: Structure node is inside state unit's moving group nodes
2. **Secondary match**: Structure node equals state unit's base group ID
3. **Greedy selection**: Highest scoring structure candidate wins

### Comparison Result

```typescript
interface UnitComparisonResult {
  matches: Array<{
    stateUnit: StateBasedUnitSummary;
    structureUnit: StructureUnitSummary;
    matchReason: 'moving_group_contains_node' | 'base_group_match';
  }>;
  stateOnly: StateBasedUnitSummary[];     // State units with no match
  structureOnly: StructureUnitSummary[];  // Structure units with no match
}
```

## Debug Mode

Enable `includeDebug: true` to get:
- `metadata.structureCandidates`: Scored structure-based candidates
- `metadata.comparison`: State vs structure comparison results

```typescript
const result = runUnitsV2Pipeline(structure, geometryIndex, {
  snapshots: [openSnapshot, closedSnapshot],
  includeDebug: true,
});

// Inspect structure candidates
for (const cand of result.metadata.structureCandidates || []) {
  console.log(`${cand.nodeName}: score=${cand.score}, points=${cand.pointCount}`);
}

// Inspect comparison
const comp = result.metadata.comparison;
console.log(`Matches: ${comp.matches.length}`);
console.log(`State-only: ${comp.stateOnly.length}`);
console.log(`Structure-only: ${comp.structureOnly.length}`);
```

## Algorithm Details

### Transform Consistency Check
Two transforms are considered equal if:
- Position difference < epsilon
- Rotation matrix Frobenius norm difference < epsilon

### Rigid Group Clustering
O(N²) algorithm that groups nodes with identical transform histories across all snapshots.

### Base Group Selection
1. Filter to static groups (no motion across snapshots)
2. Select group with largest point count
3. Fallback to largest moving group if no static groups exist

### Unit Extraction
For each moving group connected to base:
1. Find shortest path from base to moving group
2. Filter groups below `minMovingGroupPoints` threshold
3. Create actuated unit from path

## Backwards Compatibility

The pipeline remains fully backwards compatible:
- Old calls without `snapshots` continue to work
- State-based detection is opt-in via `snapshots` parameter
- Existing structure-based detection unchanged

```typescript
// Old code - still works
const result = runUnitsV2Pipeline(structure, geometryIndex);

// New code - adds state-based detection
const result = runUnitsV2Pipeline(structure, geometryIndex, {
  snapshots: [openSnapshot, closedSnapshot],
});
```

## Testing

Unit tests are located in `tests/domain/tooling/unitComparison.test.ts`:

```bash
npx vitest run tests/domain/tooling/unitComparison.test.ts
```

## Related Documentation

- [Tooling Units V2 Algorithm](./TOOLING_UNITS_V2_ALGO.md)
- [Name-Based Unit Detection](./NAME_BASED_UNIT_DETECTION.md)
- [Auto-Kinematics Pipeline Quickstart](./AUTO_KINEMATICS_TOOLING_PIPELINE_QUICKSTART.md)
