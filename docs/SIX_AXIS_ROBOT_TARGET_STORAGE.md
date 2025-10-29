# Six-Axis Robot Target Storage Architecture

**Owner:** Cursor (working on joint and linear motion targets for 6-axis robots)  
**Date:** 2025  
**Context:** Based on requirements from 25 years of real robot programming experience

## Overview

This document describes the unified target storage system for 6-axis robots that works across all manufacturers (FANUC, KUKA, ABB, Kawasaki, etc.) while maintaining compatibility with each vendor's format.

## Core Principle: Single Source of Truth

**Key Insight:** All 6-axis robots operate primarily in **joint space**. Cartesian coordinates are computed/reference data, not primary storage.

### Primary Storage Format

```typescript
{
  joints: [J1, J2, J3, J4, J5, J6]  // degrees - THIS IS PRIMARY
  configuration: { ... }            // Common format - computed from joints
  cartesian?: { ... }                // OPTIONAL - computed when needed, not stored
}
```

**Why Joint Arrays are Primary:**
- Real robots store and execute in joint space
- Kawasaki and most vendors use pure 6-joint arrays
- Cartesian is only needed for calculations/math operations
- Joints are the canonical representation

## Data Structure Hierarchy

```
Robot
  └─ Program (sequential code execution)
       ├─ Program Pointer/IP (tracks current execution position)
       ├─ Instructions (execute top to bottom)
       │    ├─ Motion instructions (reference Targets)
       │    ├─ Logic (IF/WHILE/FOR, etc.)
       │    ├─ IO (digital output, wait for input)
       │    └─ Control flow (CALL, RETURN, LABEL, JUMP)
       └─ Targets (PR[] position registers)
            ├─ Joints [J1-J6] (PRIMARY)
            ├─ Configuration (common format)
            └─ Cartesian (OPTIONAL, computed)
```

## Program Execution Model

**Key Concept:** Robots execute programs sequentially from top to bottom, like a CPU executing assembly code.

**Program Pointer (IP):** Tracks which instruction the robot is currently executing.

**Execution:**
1. Program starts at instruction #1
2. Executes sequentially (line 1 → line 2 → line 3...)
3. Program pointer moves forward after each instruction
4. Control flow instructions (CALL, JUMP, IF) can change the pointer
5. Robot moves to targets as instructed by motion commands

**Examples:**

**FANUC:**
```
1:   L P[1] 100mm/sec FINE
2:   WAIT   DI[1] = ON
3:   L P[2] 50mm/sec CNT100
4:   DO[1] = ON
5:   CALL SUB_PROGRAM
```

**KUKA:**
```
1:   PTP P1 Vel=100
2:   WAIT FOR $IN[1]
3:   LIN P2 C_VEL
4:   $OUT[1] = TRUE
5:   CALL MYSUBROUTINE
```

**ABB:**
```
1:   MoveL p1, v100, fine, tool0;
2:   WaitDI di1, 1;
3:   MoveJ p2, v50, z10, tool0;
4:   SetDO do1, 1;
5:   ProcCall subroutine;
```

**Note:** "Sequences" is not the right term. It's just sequential program execution. The code itself may create logical sequences of motion, but there's no separate "sequence" data structure - just program lines executed in order.

## Common Configuration Format

All robots need configuration data to resolve redundancy (8 possible solutions for same Cartesian pose), but each vendor uses different terminology:

### Unified Common Format:
```typescript
configuration: {
  elbow: 'up' | 'down';        // J3 configuration
  wrist: 'flip' | 'non-flip';  // J5 configuration
  front: 'front' | 'rear';      // J1/arm orientation
  turns: [T1, T2, T3, T4, T5, T6]; // Full 360° rotations for continuous joints
}
```

### Vendor-Specific Mappings:

**KUKA:** Status (S1, S2, S3) + Turns (T1-T6)
- S1: Elbow up/down
- S2: Wrist flip/non-flip
- S3: Front/rear
- Turns: Full rotations for continuous joints

**ABB:** Configuration flags (CF1, CF4, CF6, CFX)
- CF1: Front/rear
- CF4: Elbow configuration
- CF6: Wrist configuration

**FANUC:** Configuration stored in PR[] along with joints
- FANUC FUT (FRAME, USER_FRAME, TOOL_FRAME) for coordinate systems

**Kawasaki:** Pure joint array (6 joints) + separate config encoding
- All data in joint array format
- Config stored separately if needed

## Coordinate Frames (FANUC FUT Model)

```
BASE (Robot base frame)
  └─ USER_FRAME [0-9] (Work object frames)
       └─ TOOL_FRAME [0-9] (Tool/TCP frames)
```

Frames are hierarchical and defined relative to parent:
- USER frames (0-9): Work object/part reference frames
- TOOL frames (0-9): Tool center point definitions
- WORLD/WORK: Optional world coordinate system

## Storage Architecture

### Internal Format (Single Source of Truth)

```typescript
interface SixAxisTarget {
  // PRIMARY
  joints: [number, number, number, number, number, number]; // J1-J6 degrees
  
  // COMMON CONFIGURATION (works for all vendors)
  configuration: {
    elbow: 'up' | 'down';
    wrist: 'flip' | 'non-flip';
    front: 'front' | 'rear';
    turns: [number, number, number, number, number, number];
  };
  
  // COMMON FRAME
  frame: {
    type: 'WORLD' | 'BASE' | 'USER' | 'TOOL';
    frameId?: number;  // 0-9 for USER/TOOL frames
  };
  
  // OPTIONAL: Cartesian (computed, cached for efficiency)
  cartesian?: {
    position: [number, number, number];  // mm
    orientation: [number, number, number]; // W,P,R degrees
  };
  
  // VENDOR METADATA (only for import/export, not internal use)
  vendorMetadata?: {
    vendor: 'FANUC' | 'KUKA' | 'ABB' | 'Kawasaki' | ...;
    originalFormat?: any;  // Preserve for round-trip
  };
}
```

### Program Structure

```typescript
interface SixAxisTargetProgram {
  robotId: string;
  robotName: string;
  robotModel?: string;
  
  // Tool/TCP definitions
  tools: Array<{
    id: string;
    name: string;
    tcpOffset: { position, rotation };
    weight?: number;
    cog?: [number, number, number];
  }>;
  
  // Frame definitions (FANUC FUT model)
  frames: {
    userFrames: FanucFrame[];  // USER frames 0-9
    toolFrames: FanucFrame[];  // TOOL frames 0-9
  };
  
  // Target points (PR[] variables, position registers)
  // These are taught positions stored separately
  // Program instructions reference these targets
  targets: SixAxisTarget[];
  
  // Program - sequential instruction execution
  // Like CPU executing assembly code from top to bottom
  program: {
    instructions: Array<{
      lineNumber: number;        // Program line number (execution order)
      instruction: string;       // Raw instruction text (vendor-specific)
      type: 'MOTION' | 'LOGIC' | 'IO' | 'WAIT' | 'COMMENT' | 'LABEL' | 'CALL' | 'RETURN' | 'JUMP';
      targetId?: string;         // Reference to target if motion instruction
      motionType?: MotionType;   // PTP, LINEAR, CIRCULAR
      speed?: number;            // Motion speed
      // Logic/control flow
      condition?: string;        // IF condition
      jumpToLine?: number;       // JUMP target
      subroutineName?: string;   // CALL target
    }>;
    
    // Program Pointer (IP) - tracks current execution position
    currentLine?: number;        // Currently executing instruction
    executionState?: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
  };
}
```

## Key Design Decisions

### 1. Joint Array is PRIMARY
**Rationale:** Matches real robot behavior. All vendors store primarily in joint space. Cartesian is computed when needed.

**Implementation:**
- `captureCurrentTarget()` - Gets joints FIRST, then optionally computes Cartesian
- `applyJointConfiguration()` - Operates on joint array
- Cartesian is cache/computed field, never the source of truth

### 2. Common Configuration Format
**Rationale:** Single internal representation that translates to any vendor format.

**Benefits:**
- No duplication
- Works for all robots
- Vendor adapters only at import/export boundary
- Round-trip compatible

### 3. Vendor-Specific Data Separate
**Rationale:** Preserve original format for export but don't use internally.

**Storage:**
- `vendorMetadata.originalFormat` - Raw vendor data preserved
- Only used during import/export translation
- Internal operations use common format only

### 4. Frames Use FANUC FUT Model
**Rationale:** FANUC frame hierarchy is comprehensive and matches other vendors conceptually.

**Structure:**
- Hierarchical: BASE → USER → TOOL
- Frame numbers: 0-9 for USER and TOOL frames
- Can be translated to other vendor frame systems

## Implementation Files

### Core Storage
- `src/kinematics/utils/SixAxisTargetStorage.ts` - Storage format and import/export
- `src/kinematics/utils/SixAxisRobotTargetHandler.ts` - Joint configuration management

### Key Functions

**Target Management:**
- `captureCurrentTarget()` - Capture current robot state (joints PRIMARY)
- `exportToVendorFormat()` - Convert to KUKA/ABB/FANUC/Kawasaki format
- `importFromVendorFormat()` - Normalize vendor data to common format

**Joint Configuration:**
- `getSixAxisJointConfiguration()` - Get current joint config
- `applyJointConfiguration()` - Apply with validation/clamping
- `clampJointConfiguration()` - Enforce joint limits
- `validateJointLimits()` - Check limits without clamping

**Display/Formatting:**
- `formatTargetForDisplay()` - Human-readable format (joints first, config, then Cartesian)
- `formatJointConfiguration()` - Format joint array for display

## Vendor Format Examples

### KUKA Format (Export)
```javascript
{
  joints: [J1, J2, J3, J4, J5, J6],
  status: { s1: 1, s2: -1, s3: 1 },
  turns: { t1: 0, t2: 0, t3: 0, t5: 0, t6: 0 },
  x, y, z, a, b, c  // Cartesian (optional)
}
```

### FANUC Format (Export)
```javascript
{
  pr: {
    j1, j2, j3, j4, j5, j6,  // Joints
    x, y, z, w, p, r,         // Cartesian (optional)
    // Config flags
  },
  userFrame: 0  // Frame number
}
```

### Kawasaki Format (Export)
```javascript
{
  joints: [J1, J2, J3, J4, J5, J6]  // Pure joint array
  // Config stored separately if needed
}
```

## Open Questions / TODO

### Program Execution Model
**Status:** Clarified - sequential execution with program pointer

**Understanding:**
- Programs are sequential code - execute from top to bottom
- Program Pointer (IP) tracks current line being executed
- Instructions reference targets (PR[] variables)
- No separate "sequences" concept - just sequential execution
- Code may create logical motion sequences, but it's just program flow

**Example Program Flow:**
```
Line 1: Move to P[1] → Execute → Program pointer = 2
Line 2: Wait for input → Execute → Program pointer = 3
Line 3: Move to P[2] → Execute → Program pointer = 4
Line 4: Set output → Execute → Program pointer = 5
Line 5: CALL Subroutine → Jump to subroutine → Program pointer = 10
...
Line 15: RETURN → Back to caller → Program pointer = 6
```

**Implementation Notes:**
- Track program pointer for execution state
- Support standard control flow (IF/WHILE/FOR/JUMP/CALL)
- Motion instructions reference targets from `targets[]` array
- Execution can be paused/resumed at any line

### Configuration Calculation
**Status:** Simplified implementation needs refinement

Current:
- Elbow: Based on J3 sign
- Wrist: Based on J5 angle threshold
- Front: Based on J1 sign
- Turns: Floor division by 360

Need: Proper geometric calculation based on kinematic model

### Model-Specific Config Details
**Status:** Basic structure in place, details needed

- FANUC: Exact configuration storage in PR[] format
- Kawasaki: Configuration encoding details
- ABB: Complete CF flag calculation from joints

## Best Practices

1. **Always use joint array for storage** - Never store Cartesian-only
2. **Compute Cartesian on-demand** - Use FK solver when needed
3. **Validate before applying** - Check limits, workspace, feasibility
4. **Preserve vendor data** - Store original format in metadata for round-trip
5. **Use common format internally** - Only translate at import/export boundary

## Testing Considerations

When testing target storage:
- Verify joint array is primary (not derived from Cartesian)
- Test round-trip conversion (import → internal → export)
- Validate configuration calculation from joints
- Ensure limits are respected when applying configurations
- Test with multiple vendors (KUKA, FANUC, ABB, Kawasaki)

## Related Files

- `src/kinematics/utils/SixAxisRobotTargetHandler.ts` - Joint config utilities
- `src/kinematics/utils/SixAxisTargetStorage.ts` - Storage format
- `src/ui/components/RobotJoggingPanelWithGizmo.tsx` - Uses target handlers
- `src/kinematics/KinematicsManager.ts` - Joint/chain management
- `src/kinematics/types/TargetStructure.ts` - General target types

## Notes from Conversation

**Key Learnings:**
1. Real robots store in joint space - joint arrays are primary
2. Model-specific config (Status/Turns) is needed but should be normalized
3. Cartesian is optional/computed - only use for calculations
4. Single source of truth approach prevents duplication and inconsistency
5. Vendor adapters should be at import/export boundary only
6. **Program execution: Sequential from top to bottom with Program Pointer (IP) - NOT "sequences"**
7. FANUC FUT (FRAME, USER_FRAME, TOOL_FRAME) is good model for frames
8. Kawasaki uses pure joint arrays - simplest format
9. Targets stored separately (PR[]), instructions reference them
10. Motion sequences emerge from program flow, not a separate structure

**Important:** This architecture was developed with feedback from 25 years of real robot programming experience. The joint-array-primary, common-configuration, vendor-agnostic approach is the correct foundation.

**See Also:** `docs/ROBOT_PROGRAM_EXECUTION_MODEL.md` for detailed explanation of program execution model.

