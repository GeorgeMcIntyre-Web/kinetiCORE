# Agent 2: Full Body IK Front and Back End

**Agent:** Agent 2 (Cursor)  
**Priority:** HIGH - Core system enhancement  
**Timeline:** 10-13 days (3 phases)  
**Status:** 🚀 Ready to Start

---

## 🎯 Mission

Build multi-chain inverse kinematics system with constraint coordination, compact icon-based UI, and real-time full-body robot control.

---

## 📊 Current State Analysis

### What Works ✅
- Single-chain IK solver (`src/kinematics/IKSolver.ts`)
- Basic motion panel UI (`src/ui/components/MotionPanel.tsx`)
- Agent 1 building single-chain target placement

### What's Missing ❌
- **No multi-chain coordination** - Can't control multiple limbs simultaneously
- **No constraint system** - Chains can conflict (e.g., both arms reach same point)
- **No priority system** - Can't specify which chain is more important
- **No compact UI** - Current UI is verbose, needs icon-based design
- **No real-time updates** - No live feedback during multi-chain solving

### The Problem 🔥
Industrial robots often need coordinated motion:
- Dual-arm robots (both arms working together)
- Mobile manipulators (base + arm coordination)
- Humanoid robots (full-body balance)

**Currently:** Only single-chain IK works. No way to coordinate multiple chains.

---

## 📋 Implementation Plan

### Phase 1: Backend Multi-Chain Coordination (Days 1-4)
**Goal:** Solve IK for multiple chains with constraints

**Tasks:**
1. Extend IKSolver for multi-chain support
2. Implement constraint system (position, orientation, distance)
3. Add priority-based solver (high-priority chains solved first)
4. Add real-time update system (incremental solving)

**Files to Create/Modify:**
- `src/kinematics/MultiChainIKSolver.ts` (NEW)
- `src/kinematics/Constraints.ts` (NEW)
- `src/kinematics/IKSolver.ts` (MODIFY - refactor for multi-chain)

**Success Criteria:**
- Solve 2+ chains simultaneously
- Constraints enforced (e.g., distance between hands)
- Priority system works (chain A more important than chain B)
- Real-time updates (<16ms per frame)

---

### Phase 2: Compact Icon-Based UI (Days 5-9)
**Goal:** Clean, icon-driven multi-chain control panel

**Tasks:**
1. Design compact chain list (icons + names)
2. Add chain enable/disable toggles
3. Add priority sliders (1-10 scale)
4. Add constraint editor (visual constraint list)
5. Add "Solve All Chains" button

**Files to Create/Modify:**
- `src/ui/components/MultiChainPanel.tsx` (NEW)
- `src/ui/components/ConstraintEditor.tsx` (NEW)
- `src/ui/components/ChainListItem.tsx` (NEW)
- `src/ui/styles/multichain.css` (NEW)

**Success Criteria:**
- Each chain has icon (different color per chain)
- Toggle chains on/off with checkbox
- Adjust priority with slider
- Add/remove constraints with +/- buttons
- Compact design (fits in sidebar)

---

### Phase 3: Real-Time Integration & Testing (Days 10-13)
**Goal:** Wire UI to backend, test with real robots

**Tasks:**
1. Connect UI controls to MultiChainIKSolver
2. Add live preview (show solution before applying)
3. Add "Reset All" button
4. Test with dual-arm robot (UR10 + UR10)
5. Add error handling (unsolvable configurations)

**Files to Create/Modify:**
- `src/ui/components/MultiChainPanel.tsx` (MODIFY)
- `src/kinematics/MultiChainController.ts` (NEW)
- `src/scene/PreviewRenderer.ts` (NEW)

**Success Criteria:**
- Toggle chain → Solver updates in real-time
- Change priority → Solution changes
- Add constraint → Robots respect constraint
- Live preview shows ghost robots
- "Solve All" button works smoothly

---

## 🗂️ Key Files Reference

### Primary Files (You'll Work On)
```
src/kinematics/
├── MultiChainIKSolver.ts      (NEW - Multi-chain IK backend)
├── Constraints.ts             (NEW - Constraint system)
├── MultiChainController.ts    (NEW - UI ↔ Solver bridge)
└── IKSolver.ts                (MODIFY - Refactor for multi-chain)

src/ui/components/
├── MultiChainPanel.tsx        (NEW - Main UI panel)
├── ConstraintEditor.tsx       (NEW - Constraint list UI)
├── ChainListItem.tsx          (NEW - Individual chain UI)
└── MotionPanel.tsx            (MODIFY - Integrate multi-chain)

src/scene/
└── PreviewRenderer.ts         (NEW - Ghost robot preview)
```

### Reference Files (Don't Modify, Just Read)
```
src/kinematics/IKSolver.ts              (Agent 1's single-chain solver)
src/manipulation/IKTargetGizmo.ts       (Agent 1's target gizmo)
src/ui/components/MotionPanel.tsx       (Agent 1's UI work)
```

---

## 🛠️ Technical Requirements

### Multi-Chain Solver Algorithm
```typescript
// Pseudo-code for MultiChainIKSolver.ts
class MultiChainIKSolver {
  solve(chains: ChainConfig[], constraints: Constraint[]): Solution {
    // 1. Sort chains by priority (high to low)
    const sorted = chains.sort((a, b) => b.priority - a.priority);
    
    // 2. Solve each chain sequentially
    const solutions = sorted.map(chain => {
      // Solve with constraints from previous chains
      return IKSolver.solve(chain, constraints);
    });
    
    // 3. Check constraint violations
    const violations = checkConstraints(solutions, constraints);
    
    // 4. If violations, re-solve with relaxed priorities
    if (violations.length > 0) {
      return solveLeastSquares(chains, constraints);
    }
    
    return solutions;
  }
}
```

### Constraint System Design
```typescript
// Pseudo-code for Constraints.ts
interface Constraint {
  type: 'position' | 'orientation' | 'distance' | 'collision';
  chains: string[];  // Which chains this affects
  params: any;       // Constraint-specific parameters
  weight: number;    // How important (0-1)
}

// Example: Keep hands 0.5m apart
const distanceConstraint: Constraint = {
  type: 'distance',
  chains: ['left_arm', 'right_arm'],
  params: { distance: 0.5, tolerance: 0.05 },
  weight: 0.8
};

// Example: Keep end effector vertical
const orientationConstraint: Constraint = {
  type: 'orientation',
  chains: ['arm'],
  params: { axis: [0, 0, 1], tolerance: 0.1 },
  weight: 1.0
};
```

### Compact UI Design (Icon-Based)
```typescript
// Pseudo-code for ChainListItem.tsx
function ChainListItem({ chain }: { chain: KinematicChain }) {
  return (
    <div className="chain-item">
      {/* Icon (colored circle) */}
      <div className="chain-icon" style={{ background: chain.color }} />
      
      {/* Name */}
      <span className="chain-name">{chain.name}</span>
      
      {/* Enable/Disable Toggle */}
      <input 
        type="checkbox" 
        checked={chain.enabled} 
        onChange={(e) => toggleChain(chain.id, e.target.checked)}
      />
      
      {/* Priority Slider (1-10) */}
      <input 
        type="range" 
        min="1" 
        max="10" 
        value={chain.priority}
        onChange={(e) => setPriority(chain.id, e.target.value)}
      />
      
      {/* Priority Value */}
      <span className="priority-value">{chain.priority}</span>
    </div>
  );
}
```

### Multi-Chain Panel Layout
```tsx
// Pseudo-code for MultiChainPanel.tsx
function MultiChainPanel() {
  const chains = useKinematicsStore(state => state.chains);
  const constraints = useKinematicsStore(state => state.constraints);
  
  return (
    <div className="multichain-panel">
      {/* Chain List */}
      <div className="chain-list">
        <h3>Chains</h3>
        {chains.map(chain => (
          <ChainListItem key={chain.id} chain={chain} />
        ))}
      </div>
      
      {/* Constraint Editor */}
      <div className="constraint-editor">
        <h3>Constraints</h3>
        <ConstraintEditor constraints={constraints} />
        <button onClick={addConstraint}>+ Add Constraint</button>
      </div>
      
      {/* Solve Button */}
      <div className="actions">
        <button onClick={solveAllChains} className="primary">
          Solve All Chains
        </button>
        <button onClick={resetAll} className="secondary">
          Reset All
        </button>
      </div>
    </div>
  );
}
```

---

## 📏 Success Metrics

### Phase 1 Success (Backend)
- [ ] Solve 2+ chains simultaneously
- [ ] Constraints enforced correctly
- [ ] Priority system works
- [ ] Performance: <16ms per solve (60 FPS)
- [ ] No TypeScript errors

### Phase 2 Success (UI)
- [ ] Compact icon-based design
- [ ] Chain list with enable/disable toggles
- [ ] Priority sliders functional
- [ ] Constraint editor with add/remove
- [ ] Fits in sidebar (max 400px wide)

### Phase 3 Success (Integration)
- [ ] UI controls update solver in real-time
- [ ] Live preview shows ghost robots
- [ ] "Solve All" button works smoothly
- [ ] Error handling for unsolvable configs
- [ ] Tests with dual-arm robot pass

### Overall Success
- [ ] Complete multi-chain IK workflow
- [ ] UI is intuitive and compact
- [ ] Performance meets 60 FPS target
- [ ] No linter warnings
- [ ] Documentation complete

---

## 🚀 Getting Started

### Step 1: Read Agent 1's Code
```bash
# Agent 1 built single-chain IK - read their work
cat src/kinematics/IKSolver.ts
cat src/manipulation/IKTargetGizmo.ts
cat src/kinematics/IKController.ts
```

### Step 2: Create Phase 1 Files (Backend)
```bash
# Create multi-chain solver
touch src/kinematics/MultiChainIKSolver.ts

# Create constraint system
touch src/kinematics/Constraints.ts

# Create controller
touch src/kinematics/MultiChainController.ts
```

### Step 3: Test Multi-Chain Solver
```typescript
// Test in browser console
const chains = [
  { name: 'left_arm', target: leftTarget, priority: 8 },
  { name: 'right_arm', target: rightTarget, priority: 8 }
];

const constraints = [
  { type: 'distance', chains: ['left_arm', 'right_arm'], params: { distance: 0.5 } }
];

const solver = new MultiChainIKSolver();
const solution = solver.solve(chains, constraints);
console.log('Multi-chain solution:', solution);
```

---

## 🤝 Coordination with Other Agents

### Agent 1 Handoff
- Agent 1 built single-chain IK target placement
- **You extend:** Their IKController for multi-chain
- **You add:** Constraint system on top of their solver
- **Coordination:** Don't break Agent 1's single-chain workflow

### Agent 3 Code Review
- Agent 3 will review your code
- Follow React best practices
- Add TypeScript types for all props
- Write clean, modular components

### Agent 4 Performance Testing
- Agent 4 will benchmark multi-chain solver
- Target: <16ms per solve (60 FPS)
- Optimize constraint checking (use spatial hashing)
- Profile with Chrome DevTools

---

## 📚 Resources

### Documentation
- IK Solver API: `docs/IK_SOLVER_API.md`
- Constraint Systems: `docs/CONSTRAINT_SYSTEMS.md`
- React Component Guide: `docs/REACT_COMPONENTS.md`

### External References
- Multi-Chain IK: https://graphics.stanford.edu/courses/cs348a-18-winter/Handouts/ik.pdf
- Constraint-Based IK: https://www.cs.cmu.edu/~robotics/papers/paper1082.pdf
- React Performance: https://react.dev/learn/render-and-commit

---

## ❓ Questions or Blockers?

Post in `#dev-blockers` Slack channel if stuck >1 hour.

**Common Issues:**
- **Solver too slow?** → Profile with Chrome DevTools, optimize constraint checks
- **Constraints conflicting?** → Use least-squares solver for relaxation
- **UI not updating?** → Check Zustand store subscriptions

---

**Status: READY TO START! 🚀**

First, read Agent 1's code, then start Phase 1: Multi-Chain Backend.
