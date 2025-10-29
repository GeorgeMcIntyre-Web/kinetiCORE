# Vendor Format Reference Guide

**Date:** 2025  
**Purpose:** Reference guide for how different robot vendors store target data

## Overview

While we use a unified internal format, each vendor has their own specific format. This document provides reference for import/export conversion.

## FANUC

### Target Storage Format (PR[] - Position Register)

```typescript
{
  pr: {
    j1: number,  // Joint 1 angle (degrees)
    j2: number,  // Joint 2 angle (degrees)
    j3: number,  // Joint 3 angle (degrees)
    j4: number,  // Joint 4 angle (degrees)
    j5: number,  // Joint 5 angle (degrees)
    j6: number,  // Joint 6 angle (degrees)
    
    // Optional Cartesian (stored for reference/calculations)
    x: number,   // X position (mm)
    y: number,   // Y position (mm)
    z: number,   // Z position (mm)
    w: number,   // W (Yaw) orientation (degrees)
    p: number,   // P (Pitch) orientation (degrees)
    r: number,   // R (Roll) orientation (degrees)
    
    // Configuration flags (model-specific)
    config: {
      // FANUC stores config bits in PR data
      // Format varies by robot model
    }
  },
  
  // Frame references
  userFrame: number,  // USER frame number (0-9)
  toolFrame: number,  // TOOL frame number (0-9)
  
  // Motion instruction
  motionType: 'JOINT' | 'LINEAR' | 'CIRCULAR'
}
```

### Program Format Example
```
1:   L P[1] 100mm/sec FINE
2:   WAIT   DI[1] = ON
3:   L P[2] 50mm/sec CNT100
4:   DO[1] = ON
5:   CALL SUB_PROGRAM
```

**Key Features:**
- PR[] variables store joint positions (primary)
- Cartesian stored optionally in same PR[]
- USER frames (0-9) for work object reference
- TOOL frames (0-9) for TCP definitions
- Configuration stored as flags in PR data

## KUKA

### Target Storage Format (PTP/LIN Points)

```typescript
{
  // Joint positions (degrees)
  joints: [j1, j2, j3, j4, j5, j6],
  
  // Status (configuration flags)
  status: {
    s1: 1 | -1,   // Elbow up/down
    s2: 1 | -1,   // Wrist flip/non-flip
    s3: 1 | -1    // Front/rear
  },
  
  // Turns (full 360° rotations for continuous joints)
  turns: {
    t1: number,   // Turn count for J1
    t2: number,   // Turn count for J2
    t3: number,   // Turn count for J3
    t5: number,   // Turn count for J5
    t6: number    // Turn count for J6
  },
  
  // Optional Cartesian (for LIN motions)
  x: number,      // X position (mm)
  y: number,      // Y position (mm)
  z: number,      // Z position (mm)
  a: number,      // A (rotation around Z) (degrees)
  b: number,      // B (rotation around Y) (degrees)
  c: number,      // C (rotation around X) (degrees)
  
  // Motion type
  motionType: 'PTP' | 'LIN' | 'CIRC'
}
```

### Program Format Example
```
DEF MAIN()
  PTP P1 Vel=100
  LIN P2 C_VEL
  WAIT FOR $IN[1]
  $OUT[1] = TRUE
  CALL MYSUB()
END
```

**Key Features:**
- Status + Turns for configuration
- PTP (Point-to-Point) for joint motion
- LIN (Linear) for Cartesian motion
- Base coordinate system or user frames

## ABB

### Target Storage Format (robtarget)

```typescript
{
  // Configuration flags
  config: {
    cf1: 0 | 1,   // Front/rear
    cf4: 0 | 1,   // Elbow up/down
    cf6: 0 | 1,   // Wrist flip/non-flip
    cfx: number   // Additional flags
  },
  
  // Transformation (position + orientation)
  trans: [x, y, z],              // Position (mm)
  rot: [q1, q2, q3, q4],         // Quaternion or rotation matrix
  
  // Joint angles (for joint motion targets)
  joints: [j1, j2, j3, j4, j5, j6],  // Degrees
  
  // Motion type
  motionType: 'MoveJ' | 'MoveL' | 'MoveC'
}
```

### Program Format Example
```
MODULE MainModule
  PROC main()
    MoveL p1, v100, fine, tool0;
    WaitDI di1, 1;
    MoveJ p2, v50, z10, tool0;
    SetDO do1, 1;
    ProcCall subroutine;
  ENDPROC
ENDMODULE
```

**Key Features:**
- Configuration flags (CF1, CF4, CF6, CFX)
- robtarget stores both joints and Cartesian
- MoveJ (joint motion) vs MoveL (linear motion)
- Tool frames and work object frames

## Kawasaki

### Target Storage Format

```typescript
{
  // Primary: Pure joint array
  joints: [j1, j2, j3, j4, j5, j6],  // Degrees
  
  // Configuration (if needed, stored separately)
  config?: {
    // Model-specific encoding
  },
  
  // Motion type
  motionType: 'JMOVE' | 'LMOVE' | 'CMOVE'
}
```

### Program Format Example
```
.BEGIN
  JMOVE #P1
  LMOVE #P2
  WAIT TIME = 2.0
  JMOVE #P3
.END
```

**Key Features:**
- Simplest format - pure joint array
- Configuration stored separately if needed
- JMOVE (joint), LMOVE (linear), CMOVE (circular)

## Common Conversion Mapping

### Configuration Flags

| Common Format | KUKA | ABB | FANUC | Description |
|---------------|------|-----|-------|-------------|
| elbow: 'up' | s1: 1 | cf4: 1 | config bit | J3 configuration |
| elbow: 'down' | s1: -1 | cf4: 0 | config bit | |
| wrist: 'flip' | s2: 1 | cf6: 1 | config bit | J5 configuration |
| wrist: 'non-flip' | s2: -1 | cf6: 0 | config bit | |
| front: 'front' | s3: 1 | cf1: 1 | config bit | J1/arm orientation |
| front: 'rear' | s3: -1 | cf1: 0 | config bit | |
| turns: [t1...] | t1-t6 | (not used) | (not used) | Full rotations |

### Motion Types

| Common | KUKA | ABB | FANUC | Kawasaki |
|--------|------|-----|-------|----------|
| PTP | PTP | MoveJ | J (joint) | JMOVE |
| LINEAR | LIN | MoveL | L (linear) | LMOVE |
| CIRCULAR | CIRC | MoveC | C (circular) | CMOVE |

### Coordinate Frames

| Common | KUKA | ABB | FANUC | Kawasaki |
|--------|------|-----|-------|----------|
| BASE | Base | world | BASE | BASE |
| USER | User frame | wobj | USER_FRAME | User frame |
| TOOL | Tool frame | tool | TOOL_FRAME | Tool frame |

## Import/Export Notes

### FANUC
- **Import:** Extract joints from PR[].j1-j6, compute config from flags
- **Export:** Create PR format with joints primary, optional Cartesian

### KUKA
- **Import:** Extract joints + Status/Turns, compute common config
- **Export:** Convert common config to Status, add Turns

### ABB
- **Import:** Extract Cartesian + Config, need IK for joints (or if joints provided)
- **Export:** Convert common config to CF flags, store both Cartesian and joints

### Kawasaki
- **Import:** Pure joint array (simplest)
- **Export:** Pure joint array, config separate if needed

## Round-Trip Compatibility

**Strategy:** Preserve original vendor format in `vendorMetadata.originalFormat` to maintain perfect round-trip conversion.

When importing:
1. Parse vendor format
2. Convert to common format
3. Store original in metadata

When exporting:
1. Use common format
2. If original format preserved, prefer exact match
3. Otherwise, convert from common format

