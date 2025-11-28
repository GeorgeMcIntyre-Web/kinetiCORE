# Motion Panel Integration with Auto-Kinematics

## Overview

The Motion Panel now fully supports controlling joints fitted via the Auto-Kinematics Pipeline! After fitting joints using the Tooling Fixture Animator, you can immediately control them using sliders in the Motion Panel.

**Integration Status:** ✅ **COMPLETE**

## How It Works

1. **Tooling Fixture Animator** fits joints via ICP and registers them with **KinematicsManager**
2. **KinematicsManager** maintains a single source of truth for all joint states (both robot and tooling fixtures)
3. **Motion Panel** reads tooling chains from KinematicsManager and displays sliders
4. **ForwardKinematicsSolver** updates joint values and applies transforms to the scene

```
┌─────────────────────────────────────────────────────────┐
│         Tooling Fixture Animator Panel                  │
│  (Guided workflow: Analyze → Capture → Fit → Play)     │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ registerSingleChainFromAnimator()
                     ▼
┌─────────────────────────────────────────────────────────┐
│              KinematicsManager                          │
│   (Single source of truth for joint state)             │
│   • toolingChains Map                                   │
│   • joints Map                                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ getToolingChains()
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Motion Panel                               │
│   (Displays sliders for tooling joints)                │
│   • Reads chains via kinematicsManager.getToolingChains()│
│   • Updates joints via fkSolver.updateJointPosition()  │
└─────────────────────────────────────────────────────────┘
                     │
                     │ updateJointPosition()
                     ▼
┌─────────────────────────────────────────────────────────┐
│         ForwardKinematicsSolver                         │
│   (Applies joint transforms to scene)                  │
│   • Computes rotation/translation from joint.position  │
│   • Updates Babylon mesh transforms                     │
└─────────────────────────────────────────────────────────┘
```

## Usage: U112 GOLD Workflow

This is the canonical workflow for controlling the **U112 fixture** (UNIT_112 hinge joint, 90° stroke).

### Step 1: Load Fixture

1. Open kinetiCORE
2. Import your GLB fixture (e.g., `016ZF_20142435_140_1E1_CI00_U112.glb`)
3. Select the root node in the scene tree

### Step 2: Fit Joints (Tooling Fixture Animator Panel)

1. Open **Tooling Fixture Animator** panel
2. Click **"1. Analyze Fixture"**
   - Detects UNIT_101 (fixed) and UNIT_112 (moving)
3. Ensure parts are in **retracted/home position**
4. Click **"2a. Capture Retracted (Home)"**
   - Samples point cloud in home position
5. **Manually move the clamp/gripper to extended position**
   - Use transform gizmo to rotate/translate the moving part
   - Ensure significant motion (at least 0.5° rotation or 1mm translation)
6. Click **"2b. Capture Extended (Actuated)"**
   - Samples point cloud in extended position
7. Click **"3. Fit Joints (ICP)"**
   - ICP aligns point clouds and extracts joint parameters
   - You should see: `✓ UNIT_112: hinge, 90.0°`
   - **Look for toast notification:** "Registered 1 joint(s) - open Motion Panel to control"

### Step 3: Control via Motion Panel

1. Open **Motion Panel** (floating panel on the left side)
2. Scroll down to the **"Tooling Motion"** section
3. You should see a slider for your fitted joint:
   ```
   Tooling Animator Chain
   └─ joint_012345 (or similar ID)
      [============○===========] 90.0°
   ```
4. **Scrub the slider** to control the joint in real-time
   - Left = retracted (0°)
   - Right = extended (90°)
   - The clamp in the scene will move smoothly

### Step 4: (Optional) Play Demo Animation

- You can still use the **"4. Play Demo"** button in Tooling Fixture Animator Panel
- This animates the joint using ValveBank (separate from Motion Panel)
- Both the demo animation and Motion Panel use the same underlying joint data

## Troubleshooting

### "Motion Panel shows no tooling joints"

**Symptoms:**
- Tooling Fixture Animator successfully fits joints
- Motion Panel "Tooling Motion" section is empty

**Solutions:**

1. **Check console for registration errors:**
   ```
   [ToolingFixtureAnimatorPanel] Successfully registered tooling chain: tooling_animator_chain_123
   ```
   If you see errors instead, the registration failed.

2. **Common causes:**
   - **Missing scene nodes:** The fixture's moving unit nodes may not have valid Babylon mesh references
   - **Incorrect node IDs:** The adapter context may not resolve node IDs correctly
   - **Silent failures:** Check for warnings like "Registration returned null chainId"

3. **Verify registration manually in console:**
   ```javascript
   const km = KinematicsManager.getInstance();
   console.log('Tooling chains:', km.getToolingChains());
   console.log('All chains:', km.getAllChains());
   ```
   You should see your tooling chain listed.

### "Slider moves but scene doesn't update"

**Symptoms:**
- Motion Panel slider scrubs correctly
- Joint value changes in console
- But the 3D mesh doesn't move

**Solutions:**

1. **Check FK solver is applying transforms:**
   ```
   [ForwardKinematicsSolver] Applying joint transform...
   ```

2. **Verify node references:**
   - The joint's `parentNodeId` and `childNodeId` must resolve to valid Babylon nodes
   - Use Scene Inspector (F12) to check node hierarchy

3. **Ensure mesh is not locked:**
   - Check that the moving mesh is not marked as `locked` or `freezeWorldMatrix`

### "RMS error too high"

**Symptoms:**
- Joint fits successfully but with warning: "High RMS errors"
- Motion looks choppy or incorrect

**Solutions:**

1. **Move parts further between captures:**
   - Larger motion → better ICP alignment
   - Aim for at least 45° rotation for revolute joints

2. **Check for overlapping geometry:**
   - ICP can fail if geometries intersect or overlap significantly

3. **Increase point cloud density:**
   - Lower the `stride` parameter in `pipelineOptions.stateCapture`

## API Reference

### KinematicsManager

```typescript
// Register a tooling chain (automatically called by ToolingFixtureAnimator)
KinematicsManager.getInstance().registerToolingChain(chain: KinematicChain): void

// Get all tooling chains (used by Motion Panel)
KinematicsManager.getInstance().getToolingChains(): KinematicChain[]

// Get a specific joint (searches both robot and tooling chains)
KinematicsManager.getInstance().getJoint(jointId: string): JointConfig | undefined
```

### ForwardKinematicsSolver

```typescript
// Update a joint position (works for both robot and tooling joints)
ForwardKinematicsSolver.getInstance().updateJointPosition(
  jointId: string,
  value: number,      // Radians for revolute, meters for prismatic
  syncPhysics: boolean = true
): boolean
```

### ToolingKinematicsAdapter

```typescript
// Register a chain from animator (called automatically after fitJoints)
ToolingKinematicsAdapter.registerSingleChainFromAnimator(
  rootNodeId: string,
  jointsOut: JointDefinitionOutput[],
  context: KinematicsAdapterContext
): string | null  // Returns chainId or null if failed
```

## Architecture Changes (Technical)

The following changes were made to enable this integration:

### 1. KinematicsManager Updates

**File:** `src/kinematics/KinematicsManager.ts`

- **`getJoint()`** now searches both `this.joints` (robot) and `this.toolingChains` (tooling)
- **`getAllChains()`** now returns both robot chains and tooling chains
- **`getChainById()`** now searches both chain maps
- **`getChainJoints()`** now searches both chain maps

**Rationale:** ForwardKinematicsSolver and Motion Panel call these methods to look up joints and chains. By making them search both maps, tooling joints are treated identically to robot joints.

### 2. ToolingFixtureAnimatorPanel Registration

**File:** `src/ui/components/ToolingFixtureAnimatorPanel.tsx`

- **Removed silent `try/catch` wrappers** around registration calls
- **Added explicit error logging** for registration failures
- **Added toast notification** on successful registration: "Registered N joint(s) - open Motion Panel to control"
- **Improved error messages** to guide users when registration fails

**Rationale:** Silent failures made it impossible to debug registration issues. Now failures are logged clearly with actionable error messages.

### 3. Motion Panel (No Changes Required!)

**File:** `src/ui/components/FloatingKinematicsPanel.tsx`

The Motion Panel already had full support for tooling chains! Lines 1071-1111 implement the "Tooling Motion" section, which:

- Calls `kinematicsManager.getToolingChains()`
- Renders a slider for each joint
- Updates joints via `fkSolver.updateJointPosition()`

**No changes were needed.** The panel automatically displays tooling joints once they're registered.

## Testing

### Manual Test (U112 Fixture)

```bash
# 1. Build the project
npm run build

# 2. Start dev server
npm run dev

# 3. Open browser to http://localhost:5173

# 4. Load fixture: fixtures/gold/u112/016ZF_20142435_140_1E1_CI00_U112.glb

# 5. Follow "Usage: U112 GOLD Workflow" above

# 6. Expected result:
#    - Tooling Fixture Animator fits 1 hinge joint with ~90° angle
#    - Toast notification: "Registered 1 joint(s) - open Motion Panel to control"
#    - Motion Panel shows slider under "Tooling Motion"
#    - Scrubbing slider moves UNIT_112 clamp in real-time
```

### Automated Tests

Integration tests should be added to verify:

1. **Joint registration:** After `fitJoints()`, `KinematicsManager.getToolingChains()` returns the fitted joint
2. **Motion Panel display:** Motion Panel renders sliders for tooling chains
3. **FK updates:** Calling `fkSolver.updateJointPosition()` with a tooling joint ID updates the scene

**TODO:** Add tests to `tests/babylon/pipeline/ToolingFixtureAnimator.test.ts`

## Known Limitations

1. **Single-axis joints only:** Multi-DOF joints (e.g., ball joints) are not supported
2. **No joint visualization in Motion Panel:** The panel doesn't show 3D debug axes for tooling joints (unlike robot joints)
3. **No keyframe saving:** Tooling joint poses cannot be saved as named keyframes (robot-only feature)

## Future Enhancements

- [ ] Add "Show Axes" toggle for tooling joints in Motion Panel
- [ ] Support saving tooling joint poses as keyframes
- [ ] Add "Reset to Retracted" / "Jump to Extended" quick buttons
- [ ] Show confidence and RMS error in Motion Panel tooltips
- [ ] Add "Re-fit" button to update joint parameters without re-capturing

## Related Documentation

- [Auto-Kinematics Pipeline](./AUTO_KINEMATICS_PIPELINE.md) - Core pipeline documentation
- [U112 Gold Standard](../../fixtures/gold/u112/DOCS/reference_notes.md) - Reference fixture details
- [Tooling Units V2 Algorithm](./TOOLING_UNITS_V2_ALGO.md) - Unit detection algorithm

## Support

If you encounter issues:

1. Check browser console for errors (F12)
2. Verify fixtures follow `UNIT_*` naming convention
3. Ensure significant motion between retracted/extended captures
4. File bug reports with console logs and fixture GLB file
