# Changelog

All notable changes to kinetiCORE will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2025-10-28

### Added - Skeleton Visualization System

#### Motion Panel Integration
- Skeleton gizmo system integrated into Motion Panel with dynamic link visualization
- Per-robot state handling and lifecycle cleanup on close/switch
- UnifiedGizmoManager context integration for coordinated gizmo state

#### Visualization Controls
- **Skeleton Styles**: Cylinder, Tube, and Line rendering modes
- **Thickness Control**: 1-50mm configurable link thickness
- **Animation Speed**: 0.1×-3.0× configurable animation speed
- **Active Joint Highlighting**: Visual emphasis on currently active joint
- **Coordinate Overlay**: Corner XYZ compass overlay toggle
- **Joint Axes Overlay**: Per-joint debug frames (XYZ axes + joint name)
- **Link Length Labels**: Millimeter measurements for link dimensions
- **Orientation Labels**: Euler angles (RPY) for link orientation

#### Data APIs for Future Features
- `getSkeletonInfo(robotId, chainId)` - Returns current link/joint configuration
- `getLinkInfo(robotId, chainId, linkIndex)` - Detailed link metrics
- `highlightLink(robotId, chainId, linkIndex)` - Visual emphasis for specific links
- Debug frame rendering system for edit mode foundation

#### Command Pattern for Undo/Redo
- `EditJointAngleCommand` - Undoable joint angle edits
- `EditJointLimitsCommand` - Undoable joint limit range edits
- Full CommandManager integration with undo/redo history

### Fixed

#### Memory Management
- Memory leaks from undisposed meshes on panel close
- WebGL object accumulation during repeated open/close cycles
- Proper cleanup of UtilityLayerRenderer instances
- Transform node disposal to prevent ghost geometries

#### TypeScript Linting
- Removed unused imports (`Edit3`, `Lock`, `Unlock` from lucide-react)
- Removed unused parameter `jointId` in `hideAllJointVisuals()`
- Clean TypeScript compilation with strict mode enabled

#### Multi-Robot Support
- Per-robot state isolation (no cross-contamination)
- Auto-discovery of kinematic chains from scene tree
- State persistence across panel reopen
- Clean transition when switching between robots

### Changed

#### UI State Management
- Zustand store extended with visualization state fields
- Per-robot state tracked via robot ID in store
- Edit mode state prepared for Editable Kinematics Phase 1

#### Architecture Improvements
- Lifecycle hooks implemented for proper cleanup
- Multi-robot detection and state management
- Debug frame system abstracted for reuse

### Technical Details

#### Files Created
- `src/history/commands/EditJointAngleCommand.ts` - Joint angle editing command
- `src/history/commands/EditJointLimitsCommand.ts` - Joint limits editing command

#### Files Modified
- `src/ui/components/FloatingKinematicsPanel.tsx` - Added visualization controls UI
- `src/ui/store/editorStore.ts` - Added visualization and edit mode state
- `src/kinematics/KinematicsManager.ts` - Debug frame rendering improvements

#### Performance Characteristics
- **Rendering**: 60 FPS with full skeleton + debug frames
- **Animation**: Smooth link transitions
- **Memory**: No leak detection after repeated cycles
- **State**: Instant UI updates via Zustand reactivity

### Status

- ✅ Type-checked (TypeScript strict mode)
- ✅ Linted (ESLint clean)
- ✅ Built (Production build succeeds)
- ✅ Smoke tested (All tests passed)
- ✅ Memory verified (No leaks detected)
- ✅ **Production-ready foundation** (PR #6511 merged)

### Dependencies

This release establishes the foundation for:
- **Editable Kinematics Phase 1** - Joint editing with visual feedback
- **Advanced IK Visualizations** - Reach zones, collision bounds
- **Keyframe System** - Pose capture and animation
- **Multi-Robot Workflows** - Coordinated manipulation

### Migration Notes

Existing users should see automatic discovery of kinematic chains when opening the Motion Panel. No manual migration required.

---

For detailed implementation notes, see: [docs/DEVELOPMENT_LOG/2025-10-Agent1-SkeletonGizmo.md](docs/DEVELOPMENT_LOG/2025-10-Agent1-SkeletonGizmo.md)

