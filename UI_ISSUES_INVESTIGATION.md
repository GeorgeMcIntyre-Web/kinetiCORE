# UI Issues Investigation & Fix Plan

## Current Status (From Screenshots)

### ✅ Working:
- TCP gizmo arrows ARE visible (red/green/blue arrows shown in image 2)
- Motion panel layout looks good
- Joint controls working

### ❌ Broken Issues:

## Issue 1: Floor Missing
**Symptom:** No ground plane visible
**Investigation Needed:**
- Check if floor/ground was ever implemented
- Scene may need a ground mesh added

## Issue 2: TCP Gizmo Not Following Joints
**Symptom:** When moving joints, TCP gizmo stays in place. When clicking "Home", gizmo doesn't reset.
**Screenshot Evidence:** Image 2 shows gizmo at wrong position

**Root Cause Hypothesis:**
1. `updateTargetPosition()` calls are being made BUT not working
2. Possible reasons:
   - `shouldShowGizmo()` returning false (activePanel not 'motion')
   - Target ID mismatch (`tcp_${robotId}` vs actual ID)
   - IKTargetGizmoManager.updateTargetPosition() not actually moving gizmo

**Investigation Steps:**
1. Add console.log in handleJogJoint to verify:
   - Is robotChain found?
   - Is tcpPose valid?
   - What is targetId?
   - Is unifiedGizmo.updateTargetPosition() called?
2. Add console.log in UnifiedGizmoManager.updateTargetPosition:
   - Is config found?
   - What is shouldShowGizmo() result?
3. Add console.log in IKTargetGizmoManager.updateTargetPosition:
   - Is gizmo actually being moved?

**Likely Fix:**
The gizmo update is probably not reaching IKTargetGizmoManager because of panel state.

## Issue 3: TCP Gizmo Persists When Panel Closed
**Symptom:** Closing Motion panel doesn't hide TCP gizmo

**Investigation Needed:**
- Check FloatingKinematicsPanel onClose handler
- Verify UnifiedGizmoManager.setActivePanel('none') is called
- Check if removeTarget() is needed

## Issue 4: Random Frame Visualization
**Symptom:** Red/green/blue frame visible at TCP (image 3)
**Screenshot Evidence:** Shows coordinate frame that shouldn't be there

**Root Cause:** Likely stale joint debug frame not cleaned up

**Investigation:**
- Check KinematicsManager.hideAllJointVisuals()
- Check if joint gizmos are being disposed properly
- Might be the "Show Axes" button creating frames that don't clean up

## Issue 5: Debug Visualizer Labels Still at base0
**Symptom:** Enable visualizer → all text appears at (0,0,0) instead of joint positions

**Root Cause:** My fix assumed `visualizer.update()` works, but clearly it doesn't

**Investigation Steps:**
1. Read TransformDebugVisualizer.ts to understand how update() works
2. Check if visualizer is actually enabled when update() is called
3. Check if scene/FK data is available to visualizer

**Likely Fix:**
- visualizer.update() might need scene or FK solver passed
- OR visualizer needs to be initialized differently
- OR update() doesn't do what we think it does

## Issue 6: Settings Button Jumps Back to Main Screen
**Symptom:** Click settings button → popover closes immediately

**Root Cause Analysis:**
Current code:
```typescript
onClick={(e) => {
  e.stopPropagation();
  e.preventDefault();
  setShowVizSettings(!showVizSettings);
}}
```

BUT there's a useEffect with handleClickOutside:
```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (vizSettingsRef.current && !vizSettingsRef.current.contains(event.target as Node)) {
      setShowVizSettings(false);
    }
  };

  if (showVizSettings) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [showVizSettings]);
```

**The Problem:**
1. User clicks button
2. setShowVizSettings(true) is called
3. React re-renders
4. useEffect runs and adds mousedown listener
5. The SAME click event that opened it might be propagating and triggering the close

**Fix:**
- Need to exclude the button from handleClickOutside check
- OR use setTimeout to delay listener attachment
- OR use mouseup instead of mousedown

## Issue 7: XYZ Labels Confusion (NOT ACTUALLY BROKEN)
**User said:** "X Y Z tcp gizmo is showing at all"

**Reality:** The color-coded arrows ARE showing (image 2). User might be confused that:
- We REMOVED the text labels (X, Y, Z)
- But the arrows themselves are still there (red, green, blue)

**This is actually correct behavior!** Just need to explain:
- Red arrow = X axis
- Green arrow = Y axis
- Blue arrow = Z axis
- No text needed (industry standard)

---

## Priority Fix Order

### 1. TCP Gizmo Not Following (CRITICAL)
This is the #1 issue. Need to debug why update calls aren't working.

### 2. Settings Button Closes Immediately (CRITICAL)
Prevents user from changing visualizer settings.

### 3. Debug Visualizer Labels at base0 (HIGH)
Makes visualizer unusable.

### 4. TCP Gizmo Persists When Panel Closed (HIGH)
Clutters scene.

### 5. Random Frame Showing (MEDIUM)
Visual clutter but not blocking.

### 6. Floor Missing (LOW)
Nice to have but not critical for robot testing.

---

## Systematic Debug Approach

### Step 1: Add Comprehensive Logging
Add console.log statements to trace execution:

**In RobotJoggingPanelWithGizmo.tsx handleJogJoint:**
```typescript
const handleJogJoint = (jointId: string, direction: number) => {
  // ... existing code ...

  console.log('[DEBUG] handleJogJoint called:', {
    jointId,
    direction,
    robotChainFound: !!robotChain,
    tcpPoseFound: !!tcpPose,
    targetId: targetId,
    tcpPosition: tcpPose?.position,
  });

  unifiedGizmo.updateTargetPosition(targetId, tcpPose.position);
  console.log('[DEBUG] updateTargetPosition called');
}
```

**In UnifiedGizmoManager.ts updateTargetPosition:**
```typescript
updateTargetPosition(targetId: string, position: BABYLON.Vector3): void {
  console.log('[DEBUG] UnifiedGizmoManager.updateTargetPosition:', {
    targetId,
    position,
    configFound: !!this.activeTargets.get(targetId),
    activePanel: this.activePanel,
    shouldShow: this.shouldShowGizmo(this.activeTargets.get(targetId)!),
  });

  const config = this.activeTargets.get(targetId);
  if (config) {
    config.position = position.clone();
    if (this.shouldShowGizmo(config)) {
      console.log('[DEBUG] Calling IKTargetGizmoManager.updateTargetPosition');
      this.ikGizmoManager.updateTargetPosition(targetId, position);
    } else {
      console.warn('[DEBUG] shouldShowGizmo returned false!', {
        activePanel: this.activePanel,
        targetType: config.targetType,
      });
    }
  } else {
    console.error('[DEBUG] No config found for targetId:', targetId);
  }
}
```

**In IKTargetGizmoManager.ts updateTargetPosition:**
```typescript
updateTargetPosition(targetId: string, newPosition: BABYLON.Vector3): void {
  console.log('[DEBUG] IKTargetGizmoManager.updateTargetPosition:', {
    targetId,
    newPosition,
    gizmoFound: !!this.activeGizmos.get(targetId),
  });

  const gizmo = this.activeGizmos.get(targetId);
  if (gizmo?.transformNode) {
    const oldPos = gizmo.transformNode.position.clone();
    gizmo.transformNode.position.copyFrom(newPosition);
    console.log('[DEBUG] Gizmo position updated:', {
      oldPosition: oldPos,
      newPosition: gizmo.transformNode.position,
    });
  } else {
    console.error('[DEBUG] Gizmo or transformNode not found for:', targetId);
  }
}
```

### Step 2: Test & Analyze Logs
1. Load robot
2. Open Motion panel (Joint mode)
3. Move J1 slider
4. Check console logs to see where the chain breaks

### Step 3: Fix Based on Root Cause
Once we identify where the failure happens, implement targeted fix.

---

## Next Actions

1. Add debug logging to all 3 locations
2. Test with MH5 robot
3. Analyze console output
4. Fix root cause
5. Fix settings button clickOutside issue
6. Fix visualizer.update()
7. Add floor if needed
