# WIP: Structure-Based Joint Detection with BB + ICP

## Summary
Implementing structure-based joint detection that uses bounding box (BB) similarity and ICP alignment to find joints without relying on node names.

## Key Changes

### Algorithm Improvements
- **Structure-based state node detection**: Only collects nodes from sibling groups (2+ children with same parent)
- **BB + ICP approach**: Uses bounding box similarity as pre-filter, then ICP to verify matching geometry
- **No name dependencies**: Completely structure-based, no node name checking
- **Performance optimizations**: Limited ICP calls (2 pairs per parent group, 50 points per cloud, 15 iterations)

### Test Results
- ✅ Single joint test (MOVING_1 vs MOVING_2) works perfectly:
  - BB similarity: 0.0% difference (identical)
  - ICP alignment: 0.27mm error
- ⚠️ Full pipeline test still needs work (hanging/timeout issues)

### Files Modified
- `src/babylon/sceneAnalysis/StructureBasedToolAnalyzer.ts`: Main algorithm implementation
- `tests/babylon/sceneAnalysis/BB_ICP_SingleJoint.test.ts`: New focused test for single joint
- `tests/babylon/sceneAnalysis/StructureBasedToolAnalyzer.test.ts`: Full pipeline test

### Known Issues
- Test hangs/timeouts (likely due to too many ICP calls or infinite loop)
- Need to add more aggressive limits or early exit conditions
- Commented-out fallback comparison code needs cleanup

### Next Steps
1. Fix hanging/timeout issues
2. Verify all 4 joints are detected in UNIT_104
3. Test on all 9 units
4. Clean up commented code
5. Add more comprehensive logging

## Status: Work in Progress

