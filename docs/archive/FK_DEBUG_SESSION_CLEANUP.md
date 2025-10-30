# FK Debug Session - File Cleanup Plan

## Files to Keep (Essential Documentation)

### Primary References (Root Directory):
```bash
FK_QUICK_REFERENCE.md                    # Quick copy-paste pattern
FK_MATRIX_MULTIPLICATION_BUG_REPORT.md   # Technical deep dive
MH5_FK_BUG_FIX_SUMMARY.md               # Executive summary
MH5_DEBUG_DOCUMENTATION_INDEX.md         # Master index
FK_FIX_SESSION_FINAL_REPORT.md          # Complete session report
```

### Test Scripts (Root Directory):
```bash
FK_ROTATION_TEST.md                      # Rotation verification test
FK_JACOBIAN_TEST.md                      # Jacobian verification test
IK_TEST_CORRECT_METHOD.md                # IK test with correct API
```

## Files to Archive (Historical/Obsolete)

Move these to `docs/archive/fk-debug-session/`:

```bash
DEBUG_JOINT_ANGLES.md                    # Historical debug notes
DEBUG_MH5_QUICK_START.md                 # Historical quick start
DEBUG_NEW_DIVERGENCE.md                  # Historical bug notes
DEBUG_VISUALIZER_POSITION.md             # Historical debug notes
FK_BUG_FIXED_TEST.md                     # Obsolete (old fix attempt)
FK_BUG_ROOT_CAUSE_FOUND.md              # Historical diagnosis
FK_DIAGNOSTIC_COMPLEX_CONFIG.md          # Diagnostic script (superseded)
FK_UPDATE_BUG_DIAGNOSIS.md              # Historical bug #1 notes
IK_FULL_TEST_WITH_ROTATION.md           # Obsolete (had wrong IK method)
MH5_FK_COMMIT_MESSAGE.md                # Used once, can archive
MH5_TEST_RESULTS.md                     # Historical test results
START_HERE_MH5_DEBUG.md                 # Historical entry point
TEST_TRANSFORM_ORDER.md                 # Historical test notes
VISUALIZER_FIX_COMMANDS.md              # Historical commands
```

## Rationale

**Keep in root:**
- Quick references developers need frequently
- Technical bug reports (prevent regression)
- Active test scripts
- Session summary

**Archive:**
- Historical investigation notes
- Obsolete test scripts
- One-time-use files (commit message template)
- Superseded diagnostics
