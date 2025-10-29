# Robot Program Execution Model

**Date:** 2025  
**Context:** Understanding how real robots execute programs - based on actual robot controller behavior

## Core Concept

Robots execute programs **sequentially from top to bottom**, similar to how a CPU executes assembly code. There's a **Program Pointer (IP - Instruction Pointer)** that tracks which instruction is currently being executed.

## Key Terminology

### Program
A sequential list of instructions that the robot executes line by line.

### Program Pointer (IP)
The current execution position - indicates which program line the robot is executing.

### Instructions
Individual commands that the robot executes:
- **Motion:** Move to target, follow path, etc.
- **Logic:** IF/WHILE/FOR conditions
- **IO:** Set outputs, wait for inputs
- **Control Flow:** CALL, RETURN, JUMP, LABEL

### Targets (Position Registers)
Stored positions (PR[] in FANUC, P variables in KUKA, robtarget in ABB) that are referenced by motion instructions. These are taught separately and stored in the `targets[]` array.

## Execution Model

### Sequential Execution

```
Program starts at line 1
  ↓
Execute line 1 → Program pointer = 2
  ↓
Execute line 2 → Program pointer = 3
  ↓
Execute line 3 → Program pointer = 4
  ↓
...
```

### Program Pointer Behavior

The program pointer (IP) always points to the next instruction to execute:

1. **After executing an instruction:** IP moves to next line
2. **On CALL:** IP jumps to subroutine start, return address saved
3. **On RETURN:** IP restores to return address (line after CALL)
4. **On JUMP/LABEL:** IP jumps to target line number
5. **On conditional:** IP may skip forward or jump based on condition
6. **On PAUSE:** IP stays at current line
7. **On STOP:** IP resets or stays at error line

### Example Program Execution

```typescript
// Program starting at line 1
{
  lineNumber: 1,
  instruction: "L P[1] 100mm/sec FINE",
  type: 'MOTION',
  targetId: 'target_1',
  motionType: 'LINEAR'
}
// Robot executes: Moves to target P[1]
// Program pointer: 1 → 2

{
  lineNumber: 2,
  instruction: "WAIT DI[1] = ON",
  type: 'WAIT',
  condition: 'DI[1] == ON'
}
// Robot executes: Waits for digital input
// Program pointer: 2 → 3 (when condition met)

{
  lineNumber: 3,
  instruction: "DO[1] = ON",
  type: 'IO',
  output: { channel: 1, value: true }
}
// Robot executes: Sets digital output
// Program pointer: 3 → 4

{
  lineNumber: 4,
  instruction: "CALL SUB_PICK",
  type: 'CALL',
  subroutineName: 'SUB_PICK'
}
// Robot executes: Jumps to subroutine SUB_PICK (line 50)
// Program pointer: 4 → 50 (return address: 5 saved)

{
  lineNumber: 50,  // Start of SUB_PICK
  instruction: "L P[10] 50mm/sec CNT50",
  type: 'MOTION',
  targetId: 'target_10'
}
// Robot executes: Moves to P[10]
// Program pointer: 50 → 51

{
  lineNumber: 51,
  instruction: "RETURN",
  type: 'RETURN'
}
// Robot executes: Returns to caller
// Program pointer: 51 → 5 (restored from return address)
```

## Instruction Types

### Motion Instructions
Move robot to a target position:

**FANUC:** `L P[1] 100mm/sec FINE`
- L = Linear motion
- P[1] = Target (references target ID)
- 100mm/sec = Speed
- FINE = Termination type (exact stop)

**KUKA:** `PTP P1 Vel=100`
- PTP = Point-to-Point
- P1 = Target
- Vel=100 = Velocity

**ABB:** `MoveL p1, v100, fine, tool0;`
- MoveL = Linear motion
- p1 = Target
- v100 = Velocity
- fine = Termination
- tool0 = Tool frame

### Logic Instructions
Control program flow:

- **IF/THEN/ELSE:** Conditional execution
- **WHILE/DO/END:** Loops
- **FOR/TO/NEXT:** Counted loops
- **SWITCH/CASE:** Multi-way branching

### IO Instructions
Interface with external devices:

- **Wait for Input:** `WAIT DI[1] = ON`
- **Set Output:** `DO[1] = ON`
- **Wait for Time:** `WAIT 2.5 sec`

### Control Flow Instructions
Change program pointer:

- **CALL:** Jump to subroutine (save return address)
- **RETURN:** Return from subroutine (restore return address)
- **JUMP/LABEL:** Unconditional jump to line number
- **EXIT:** End program execution

## Program State

```typescript
interface ProgramExecutionState {
  currentLine: number;        // Program pointer (IP)
  state: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
  callStack: number[];        // Return addresses for nested CALLs
  variables: Record<string, any>;  // Program variables
  errorLine?: number;         // Line where error occurred
  errorMessage?: string;
}
```

### State Transitions

```
STOPPED → START → RUNNING
RUNNING → PAUSE → PAUSED
PAUSED → RESUME → RUNNING
RUNNING → ERROR → ERROR (currentLine = error line)
ANY → STOP → STOPPED (IP may reset or stay)
```

## Target References

**Important:** Targets are stored separately and referenced by instructions:

```typescript
// Targets array (like PR[] registers)
targets: [
  { id: 'target_1', name: 'P[1]', joints: [...], ... },
  { id: 'target_2', name: 'P[2]', joints: [...], ... },
  ...
]

// Program instructions reference targets
instructions: [
  { lineNumber: 1, targetId: 'target_1', ... },  // Move to P[1]
  { lineNumber: 3, targetId: 'target_2', ... },  // Move to P[2]
]
```

## Real Robot Examples

### FANUC TP Program
```
1:   L P[1] 100mm/sec FINE
2:   L P[2] 80mm/sec CNT100
3:   WAIT   DI[1] = ON
4:   CALL   SUBROUTINE
5:   L P[3] 50mm/sec FINE
6:   END
```

Execution:
- Line 1 → Move to P[1] → IP = 2
- Line 2 → Move to P[2] → IP = 3
- Line 3 → Wait for input → IP = 4 (when input received)
- Line 4 → Jump to SUBROUTINE → IP = 100 (return = 5)
- Line 5 → Move to P[3] → IP = 6
- Line 6 → End program → STOPPED

### KUKA SRC Program
```
DEF MAIN()
  PTP P1 Vel=100
  LIN P2 C_VEL
  WAIT FOR $IN[1]
  $OUT[1] = TRUE
  CALL MYSUB()
  PTP P3 Vel=50
END
```

Execution:
- Line 1 → PTP to P1 → IP = 2
- Line 2 → LIN to P2 → IP = 3
- Line 3 → Wait → IP = 4 (when condition met)
- Line 4 → Set output → IP = 5
- Line 5 → Call subroutine → IP = 10 (return = 6)
- Line 6 → PTP to P3 → IP = 7
- END → STOPPED

## Implementation in Code

### Program Structure
```typescript
interface SixAxisTargetProgram {
  targets: SixAxisTarget[];  // PR[] registers - taught positions
  
  program: {
    instructions: Array<{
      lineNumber: number;
      instruction: string;       // Raw text (vendor-specific)
      type: InstructionType;
      targetId?: string;          // References target in targets[]
      // ... motion/logic/io parameters
    }>;
    
    currentLine?: number;         // Program pointer (IP)
    executionState?: ExecutionState;
  };
}
```

### Execution Simulation
```typescript
function executeProgram(program: SixAxisTargetProgram) {
  let ip = program.program.currentLine || 1;
  let state: ExecutionState = 'RUNNING';
  const callStack: number[] = [];
  
  while (state === 'RUNNING' && ip <= program.program.instructions.length) {
    const instruction = program.program.instructions[ip - 1];
    
    switch (instruction.type) {
      case 'MOTION':
        // Move robot to target
        const target = program.targets.find(t => t.id === instruction.targetId);
        if (target) {
          moveToTarget(target, instruction.motionType, instruction.speed);
        }
        ip++; // Next line
        break;
        
      case 'WAIT':
        // Wait for condition
        if (checkCondition(instruction.condition)) {
          ip++; // Condition met, next line
        }
        // Else: stay at current line (retry on next cycle)
        break;
        
      case 'CALL':
        // Save return address and jump
        callStack.push(ip + 1); // Save return address
        ip = findSubroutineLine(instruction.subroutineName);
        break;
        
      case 'RETURN':
        // Restore return address
        if (callStack.length > 0) {
          ip = callStack.pop()!;
        } else {
          state = 'ERROR'; // No return address
        }
        break;
        
      case 'JUMP':
        ip = instruction.jumpToLine!;
        break;
        
      // ... other instruction types
    }
    
    // Update program pointer
    program.program.currentLine = ip;
    program.program.executionState = state;
  }
}
```

## Key Takeaways

1. **Programs are sequential** - Execute from top to bottom
2. **Program Pointer tracks position** - Like CPU instruction pointer
3. **Targets stored separately** - Instructions reference them
4. **Control flow changes IP** - CALL/RETURN/JUMP modify pointer
5. **No "sequences" structure** - Just sequential execution
6. **Motion sequences emerge from code flow** - Not a separate data structure

## Common Misconceptions

❌ **Wrong:** "Sequences are a separate data structure"
✅ **Correct:** Sequential program execution creates logical sequences

❌ **Wrong:** "Targets contain program flow"
✅ **Correct:** Targets are stored positions, programs reference them

❌ **Wrong:** "Programs are declarative (what to do)"
✅ **Correct:** Programs are imperative (how to execute step by step)

## Related Documentation

- `docs/SIX_AXIS_ROBOT_TARGET_STORAGE.md` - Target storage format
- `src/kinematics/utils/SixAxisTargetStorage.ts` - Implementation

