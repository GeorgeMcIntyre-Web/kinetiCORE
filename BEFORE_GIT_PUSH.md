# Before Pushing Kinematics to Git Remote

## Critical Issues to Fix

### 1. Actuator Control Panel - BROKEN ❌
**File**: `src/ui/components/ActuatorControlPanel.tsx:27`
**Error**: `TypeError: kinematicsManager.getActuatorSystem is not a function`

**Root Cause**: `KinematicsManager` class doesn't have a `getActuatorSystem()` method.

**Temporary Fix**: Panel is commented out in EssentialModeLayout.tsx (lines 425-427)

**Permanent Fix Needed**:
```typescript
// Add to src/kinematics/KinematicsManager.ts
public getActuatorSystem(): ActuatorSystem {
  if (!this.actuatorSystem) {
    this.actuatorSystem = new ActuatorSystem();
  }
  return this.actuatorSystem;
}
```

### 2. Floating Panels Need Proper Implementation
**Current State**: Kinematics panel uses inline styles (not maintainable)

**What's Needed**:
- Create reusable `FloatingPanel` component similar to `AssetLibraryPanel`
- Add drag-to-move functionality
- Add resize handles
- Proper z-index management

**Reference**: `src/ui/components/AssetLibrary/AssetLibraryPanel.tsx` (lines 41-120)

### 3. DWG TEXT Import Not Working
**Status**: Documented in `src/loaders/dwg/DWG_TEXT_TODO.md`
**Issue**: TEXT entities processed but not visible (Babylon MSDF TextRenderer limitation)
**Priority**: Medium (non-blocking for geometry viewing)

## Testing Checklist Before Git Push

### UI Tests
- [ ] Kinematics button opens floating panel
- [ ] Kinematics panel close button works
- [ ] Kinematics panel doesn't cover viewport
- [ ] Scene Tree fills sidebar (no old Kinematics panel at bottom)
- [ ] Actuator button doesn't crash app
- [ ] Asset Library still works

### Kinematics Tests
- [ ] Load URDF file
- [ ] Joints detected and listed
- [ ] Joint sliders control robot
- [ ] FK solver updates robot pose
- [ ] Multiple robots handled correctly

### Build Tests
```bash
npm run type-check  # Must pass
npm run lint        # Must pass
npm run build       # Must succeed
```

### Git Workflow
```bash
# 1. Review all changes
git status
git diff

# 2. Stage kinematics files
git add src/kinematics/
git add src/ui/components/KinematicsPanel.*
git add src/ui/components/RobotJoggingPanel.*

# 3. DON'T commit broken files
# Exclude ActuatorControlPanel until getActuatorSystem() is implemented
# OR fix it first

# 4. Create feature branch
git checkout -b feature/kinematics-integration

# 5. Commit with descriptive message
git commit -m "feat: add kinematics system with FK solver and joint control

- Reorganized kinematics into subdirectories (solvers/, device/, actuation/)
- Added ForwardKinematicsSolver for real-time robot pose updates
- Created KinematicsPanel with device selection and joint jogging
- Integrated URDF joint extraction
- Added floating panel UI for kinematics control
- Net: -1106 lines (code consolidation)

BREAKING: ActuatorControlPanel temporarily disabled
TODO: Implement KinematicsManager.getActuatorSystem() method"

# 6. Push to remote
git push origin feature/kinematics-integration

# 7. Create PR on GitHub
gh pr create --title "Kinematics System Integration" --body "..."
```

## Known Working Commits
- `56feac1` - DWG TEXT work (geometry loads correctly)
- `ec34a2b` - LibreDWG entity type mappings
- Last known good: Before breaking ActuatorControlPanel

## Files Modified (Summary)
**Added**:
- `src/kinematics/solvers/` - FK/IK solver architecture
- `src/kinematics/device/` - Device definitions
- `src/kinematics/actuation/` - Actuator system
- `src/kinematics/exporters/` - Export functionality
- `src/loaders/dwg/DWG_TEXT_TODO.md` - TEXT import notes
- `BEFORE_GIT_PUSH.md` - This file

**Modified**:
- `src/kinematics/KinematicsManager.ts` - Refactored, needs getActuatorSystem()
- `src/ui/components/KinematicsPanel.tsx` - New floating panel
- `src/ui/components/RobotJoggingPanel.tsx` - Joint control UI
- `src/ui/layouts/EssentialModeLayout.tsx` - Added floating panel wrappers
- `src/ui/components/Toolbar.tsx` - Added Kinematics/Actuator buttons
- `src/loaders/dwg/DWGLoader.ts` - TEXT rendering attempts

**Deleted**:
- `src/kinematics/ForwardKinematicsSolver.ts` (moved to solvers/)
- `src/kinematics/InverseKinematicsSolver.ts` (moved to solvers/)

## Contact
If blocked, see:
- Architecture: George
- UI/React: Edwin
- Kinematics: Check `src/kinematics/INTEGRATION_COMPLETE.md`
