# Six-Axis Robot Joint and Linear Motion Targets Implementation

**Owner:** Cursor  
**Date:** 2025  
**Context:** Implementation of joint and linear motion target handling for 6-axis robots

## Overview

This document describes the implementation of joint and linear motion targets for 6-axis robots, including synchronization, validation, and storage.

## Implementation Summary

### Components Created

1. **SixAxisRobotTargetHandler.ts** - Joint configuration management
2. **SixAxisTargetStorage.ts** - Unified target storage format
3. **Integration in RobotJoggingPanelWithGizmo.tsx** - UI integration

### Key Features Implemented

#### 1. Joint Target Handling
- `syncTcpGizmoAfterJointMove()` - Syncs TCP gizmo when joints move
- `getSixAxisJointConfiguration()` - Gets current joint configuration
- `applyJointConfiguration()` - Applies joint config with validation
- `clampJointConfiguration()` - Enforces joint limits
- `validateJointLimits()` - Validates without clamping
- `createHomeConfiguration()` - Creates home position preset

#### 2. Linear Motion Target Handling
- `syncTcpGizmoAfterLinearMove()` - Syncs TCP gizmo after Cartesian moves
- `validateLinearMotionTarget()` - Validates target before IK
- Coordinate space handling (TCP-local frame for linear motion)
- Error reporting and warnings

#### 3. Target Storage
- Unified format with joint array as primary
- Common configuration format (elbow/wrist/front/turns)
- Vendor-specific adapters (KUKA, ABB, FANUC, Kawasaki)
- Import/export functions

## Integration Points

### RobotJoggingPanelWithGizmo.tsx

**Joint Mode:**
- Uses `syncTcpGizmoAfterJointMove()` when joints are moved
- Automatically updates TCP gizmo position
- Validates 6-axis robot before specialized handling

**TCP/Linear Mode:**
- Uses `validateLinearMotionTarget()` before IK
- Uses `syncTcpGizmoAfterLinearMove()` after IK
- Handles TCP-local frame motion correctly
- Provides detailed error reporting

**TCP Gizmo Drag:**
- Validates target before attempting IK
- Uses specialized sync functions for 6-axis robots
- Falls back to standard handling for other robots

## Coordinate Systems

### User Space (Display)
- Z-up, millimeters
- Used for UI display and user input

### Babylon Space (Internal)
- Y-up, meters
- Used for IK solving and 3D calculations

### TCP-Local Frame (Linear Motion)
- Motion relative to TCP orientation
- Converts to world space before IK

## Configuration Calculation

**Current Implementation:**
- Elbow: `joints[2] > 0 ? 'up' : 'down'`
- Wrist: `Math.abs(joints[4]) < 90 ? 'flip' : 'non-flip'`
- Front: `joints[0] > 0 ? 'front' : 'rear'`
- Turns: `Math.floor(joint / 360)` for each joint

**Note:** This is simplified. Proper geometric calculation based on kinematic model may be needed.

## Error Handling

### Validation Results
```typescript
{
  valid: boolean;
  error?: string;
  warnings?: string[];
}
```

### Application Results
```typescript
{
  success: boolean;
  applied: SixAxisJointConfiguration;
  warnings: string[];
  errors: string[];
}
```

## Usage Examples

### Capture Current Target
```typescript
const target = captureCurrentTarget(
  chainName,
  'Pick_Position_1',
  'LINEAR',
  'KUKA',  // or 'FANUC', 'ABB', 'Kawasaki'
  fkSolver
);
// Result: Joint array PRIMARY, config computed, Cartesian optional
```

### Apply Joint Configuration
```typescript
const config: SixAxisJointConfiguration = {
  jointAngles: [0, 45, -90, 0, 45, 0],  // degrees
  jointNames: ['J1', 'J2', 'J3', 'J4', 'J5', 'J6']
};

const result = applyJointConfiguration(
  chainName,
  config,
  fkSolver,
  true  // enforce limits
);

if (result.success) {
  console.log('Applied:', result.applied);
} else {
  console.error('Errors:', result.errors);
  console.warn('Warnings:', result.warnings);
}
```

### Export to Vendor Format
```typescript
const kukaFormat = exportToVendorFormat(target, 'KUKA');
// Returns KUKA format with Status/Turns

const fanucFormat = exportToVendorFormat(target, 'FANUC');
// Returns FANUC PR format
```

## Testing Checklist

- [ ] Joint motion updates TCP gizmo correctly
- [ ] Linear motion validates target before IK
- [ ] TCP gizmo drag works correctly
- [ ] Joint limits are enforced
- [ ] Configuration calculated correctly from joints
- [ ] Round-trip import/export works (KUKA, FANUC, ABB, Kawasaki)
- [ ] Cartesian computed correctly when needed
- [ ] Frame definitions work correctly
- [ ] 6-axis robot detection works

## Known Limitations

1. **Configuration Calculation:** Simplified - may need geometric refinement
2. **Sequences Structure:** Needs clarification on exact contents
3. **FANUC Config Details:** Need exact PR[] format details
4. **Kawasaki Config:** Need encoding format details

## Future Enhancements

1. Proper geometric configuration calculation
2. Sequence structure clarification and implementation
3. Complete vendor format support (all details)
4. Tool/Frame management UI integration
5. Program editor with sequence support

## Files Modified

- `src/kinematics/utils/SixAxisRobotTargetHandler.ts` - Created
- `src/kinematics/utils/SixAxisTargetStorage.ts` - Created
- `src/ui/components/RobotJoggingPanelWithGizmo.tsx` - Enhanced with 6-axis handlers

