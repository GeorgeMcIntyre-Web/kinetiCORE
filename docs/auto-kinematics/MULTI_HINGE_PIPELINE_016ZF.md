# Multi-Hinge Pipeline: 016ZF Full Fixture (4 Clamps)

## Overview

This document describes the auto-kinematics pipeline support for multi-hinge fixtures like `016ZF_20142435_140_1E1_CI00.glb`. Unlike the U112 single-hinge GOLD fixture, this fixture has **4 moving clamps** with **4 independent hinge joints**.

## Fixture Specifications

| Property | Value |
|----------|-------|
| Fixture File | `016ZF_20142435_140_1E1_CI00.glb` |
| Fixed Unit | UNIT_101 (base) |
| Moving Units | 4 clamps (UNIT_1XX) |
| Joint Type | All revolute (hinge) |
| Angle Range | ~80-100° per clamp |

## Pipeline Architecture

The existing auto-kinematics pipeline already supports multi-unit fixtures:

```
┌─────────────────────────────────────────────────────────────────┐
│                  ToolingFixtureAnimator                        │
│                                                                 │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│   │   Analyze   │──▶│   Capture   │──▶│   Fit Joints │          │
│   │   (N units) │   │   (N pairs) │   │   (N joints) │          │
│   └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                 │
│   movingUnits: ToolUnit[]    statePairs: Map<id, pair>         │
│   (4 units for 016ZF)        (4 pairs for 016ZF)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  KinematicsManager                              │
│                                                                 │
│   registerToolingChain({                                        │
│     id: 'tooling_animator_chain_XXX',                           │
│     joints: [                                                    │
│       { id: 'UNIT_102_joint', type: 'revolute', ... },         │
│       { id: 'UNIT_103_joint', type: 'revolute', ... },         │
│       { id: 'UNIT_104_joint', type: 'revolute', ... },         │
│       { id: 'UNIT_105_joint', type: 'revolute', ... },         │
│     ]                                                           │
│   })                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Motion Panel (UI)                              │
│                                                                 │
│   ┌───────────────────────────────────┐                        │
│   │  Tooling Motion                   │                        │
│   │  ┌─────────────────────────────┐  │                        │
│   │  │ All Clamps (4)    [75%]    │  │  ◀── Aggregate slider  │
│   │  │ ═══════════════●═══════════ │  │                        │
│   │  └─────────────────────────────┘  │                        │
│   │  ┌─────────────────────────────┐  │                        │
│   │  │ UNIT_102_joint   [67.5°]   │  │  ◀── Individual slider │
│   │  │ ═══════════●═══════════════ │  │                        │
│   │  └─────────────────────────────┘  │                        │
│   │  ┌─────────────────────────────┐  │                        │
│   │  │ UNIT_103_joint   [90.0°]   │  │                        │
│   │  │ ═══════════════════●═══════ │  │                        │
│   │  └─────────────────────────────┘  │                        │
│   │  ... (2 more joints)              │                        │
│   └───────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. ToolingFixtureAnimator

The animator already iterates over all moving units:

```typescript
// Step 1: Analyze (detects all 4 moving units)
const result = await animator.analyzeFixture();
// result.movingUnits.length === 4

// Step 2a: Capture retracted for all
await animator.captureRetractedState();

// Step 2b: Capture extended for all
await animator.captureExtendedState();

// Step 3: Fit joints for all (produces 4 JointFitResultInfo)
const fitResult = await animator.fitJoints();
// fitResult.jointCount === 4
```

### 2. Motion Panel - All Clamps Slider

When a tooling chain has 2+ revolute joints, an aggregate "All Clamps" slider appears:

- **Range**: 0% (retracted) to 100% (extended)
- **Behavior**: Moves all revolute joints proportionally
- **Calculation**: Normalizes each joint's position relative to its limits

```typescript
// Aggregate value calculation
const avgNormalized = revoluteJoints.reduce((sum, j) => {
  const range = j.limits.upper - j.limits.lower;
  const normalized = range > 0 ? (j.position - j.limits.lower) / range : 0;
  return sum + normalized;
}, 0) / revoluteJoints.length;
```

### 3. ValveBank Animation

The animator creates channels for all joints:

```typescript
// Each joint gets a channel for extend/retract animation
for (const jointOut of this.joints) {
  const channel: Channel = {
    id: jointOut.id,
    unitId: jointOut.id,
    jointId: jointOut.id,
    advanceValue: jointOut.limits.upper,
    retractValue: jointOut.limits.lower,
  };
  this.valveBank.addChannel(channel);
}
```

## Invariants (Test Assertions)

| Invariant | Expected Value |
|-----------|----------------|
| Moving unit count | 4 |
| Hinge joint count | 4 |
| Each joint angle | 80° - 100° |
| Each joint RMS error | < 1mm |
| Each joint confidence | > 0.70 |
| All Clamps slider visible | true (when >= 2 joints) |

## Test Helpers

The `ToolingTestHelper.multiHinge` API provides programmatic access for E2E tests:

```typescript
// In Playwright test
const helper = await page.evaluate(() => window.__ToolingTestHelper__);

// Count moving units
expect(helper.multiHinge.getMovingUnitCount()).toBe(4);

// Count fitted joints
expect(helper.multiHinge.getHingeJointCount()).toBe(4);

// Set all clamps extended
await helper.multiHinge.setAllClampsExtended();

// Get joint info for assertions
const joints = helper.multiHinge.getJointInfo();
for (const joint of joints) {
  expect(joint.angleDeg).toBeGreaterThan(80);
  expect(joint.angleDeg).toBeLessThan(100);
}
```

## E2E Test Location

- **Test file**: `tests/e2e/auto-kinematics/016ZF/016ZF-multi-hinge.spec.ts`
- **Fixture path**: `C:\Users\georgem\source\repos\kinetiCORE_data\Tooling\8X-140-1E1_LH\016ZF_20142435_140_1E1_CI00.glb`

## Comparison with U112 GOLD

| Feature | U112 (Single-Hinge) | 016ZF (Multi-Hinge) |
|---------|---------------------|---------------------|
| Moving units | 1 | 4 |
| Hinge joints | 1 | 4 |
| All Clamps slider | Hidden | Visible |
| Pipeline complexity | Single iteration | 4 iterations |
| Test focus | Core algorithm | Scale/multi-unit |

## Troubleshooting

### Only 1 joint detected (expected 4)

Check console for `[ToolingFixtureAnimator] Analysis Result:` log. Verify:
- `movingCount: 4` in the log
- All UNIT_* nodes are present in scene tree

### Joints not appearing in Motion Panel

1. Verify `toolingChains.length > 0` in FloatingKinematicsPanel
2. Check `actuatedJoints.filter(j => j.type === 'revolute').length`
3. Ensure `fitJoints()` was called before `setupAnimation()`

### All Clamps slider not visible

The slider only appears when `actuatedJoints.filter(j => j.type === 'revolute').length >= 2`. Check:
1. All 4 joints are registered as `type: 'revolute'`
2. No joints were filtered out due to low confidence
