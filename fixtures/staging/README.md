# Staging Fixtures - U113 and Beyond

This directory contains **work-in-progress** fixtures that are being validated before promotion to production or gold status.

## Fixture Development Workflow

### Stage 1: Initial Testing (This Directory)
Place new GLB fixtures here during development:
```
fixtures/staging/
├── u113/
│   ├── u113.glb
│   ├── notes.md (observations, issues)
│   └── test_results.json (if generated)
├── u114/
└── ...
```

### Stage 2: Validation Against U112
Before promoting to production, verify:
1. Units detected correctly
2. Joint fitting succeeds
3. Animation plays smoothly
4. No regression in U112 gold tests

### Stage 3: Promotion Decision
- **Pass all checks** → Move to `test_assets/tooling/`
- **New capabilities** → Create new gold standard in `fixtures/gold/`
- **Fails validation** → Document issues in `notes.md`, fix GLB

## Fixture Classification Rules

| Fixture Range | Requirements | Reference U112? | New Tests Required |
|---------------|--------------|-----------------|-------------------|
| **U113-U120** | 1 static + 1 revolute | ✅ REQUIRED | Extend U112 gold suite |
| **U121-U130** | 1 static + 2+ joints | ⚠️ Compare angles | New multi-joint tests |
| **U131-U150** | Prismatic/mixed | 📖 Reference workflow only | Separate gold baseline |
| **U151+** | Multi-chain/complex | ❌ New architecture | New test framework |

## Usage

### Adding a New Fixture

```bash
# 1. Place GLB in staging
mkdir fixtures/staging/u113
cp path/to/u113.glb fixtures/staging/u113/

# 2. Test manually in dev mode
npm run dev
# Load GLB, run auto-kinematics workflow

# 3. Document results
cat > fixtures/staging/u113/notes.md << EOF
# U113 Test Results

**Fixture**: u113.glb
**Date**: $(date)
**Tester**: Your Name

## Structure
- Units detected: 2
- Fixed: UNIT_XXX
- Moving: UNIT_YYY

## Joint Fitting
- Joint type: hinge
- Angle: 45° (expected 45°)
- RMS error: 0.5mm
- Confidence: 0.85

## Issues
- None

## Status
✅ Ready for promotion
EOF

# 4. If successful, promote to test_assets
mv fixtures/staging/u113/u113.glb test_assets/tooling/
```

### Comparing to U112 Baseline

```typescript
// Example test to compare new fixture to U112
import { describe, it, expect } from 'vitest';
import { ToolingFixtureAnimator } from '@/babylon/pipeline/ToolingFixtureAnimator';

describe('U113 - Single Revolute (45° stroke)', () => {
  it('should behave consistently with U112 baseline', async () => {
    // Setup U113 fixture
    const animator = new ToolingFixtureAnimator({ scene, rootNode });

    // Run workflow
    await animator.analyzeFixture();
    await animator.captureRetractedState();
    // ... move parts ...
    await animator.captureExtendedState();
    const result = await animator.fitJoints();

    // Compare to U112 expectations
    expect(result.details[0].jointType).toBe('hinge'); // Same as U112
    expect(result.details[0].angleDeg).toBeGreaterThanOrEqual(40); // Within tolerance
    expect(result.details[0].angleDeg).toBeLessThanOrEqual(50);
    expect(result.details[0].rmsErrorMm).toBeLessThan(1.0); // Same threshold
  });
});
```

## Known Staging Fixtures

| ID | Status | Notes |
|----|--------|-------|
| U113 | 🔄 In Progress | Testing 45° hinge |
| U114 | 📝 Planned | Vertical clamp |
| U115 | 📝 Planned | Dual-side gripper |

## Protection Rules

⚠️ Do NOT modify staging fixtures that are:
- Referenced in active tests
- Under review by another developer
- Tagged with `DO-NOT-MODIFY` in notes.md

## Cleanup Policy

Fixtures in staging for > 30 days without progress should be:
1. Documented with blocker reason
2. Moved to `fixtures/archived/` if blocked indefinitely
3. Or promoted/deleted if complete

---

**Remember**: U112 is the gold standard. All new fixtures must validate against it or document why they diverge.
