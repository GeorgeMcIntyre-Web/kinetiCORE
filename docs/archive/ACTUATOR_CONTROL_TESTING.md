# Actuator Control Panel - Testing Guide

## Overview

This guide provides step-by-step instructions for testing the redesigned **Actuator Control Panel**. The panel has been completely rewritten to match Motion panel design standards with professional UI/UX, icon-only buttons, and full backend integration.

## What Changed

### Before (Problems):
- ❌ Text-heavy buttons wasting space
- ❌ Oversized controls
- ❌ No device selection dropdown
- ❌ Inefficient layout
- ❌ Poor space utilization

### After (Improvements):
- ✅ Icon-only buttons with tooltips
- ✅ Device selection dropdown (like Motion panel)
- ✅ Compact, professional layout
- ✅ Auto-discovery of devices with actuators
- ✅ Auto-selection based on scene tree selection
- ✅ Full backend integration with ActuatorSystem
- ✅ Real-time state updates every 500ms
- ✅ Collapsible metrics section
- ✅ Responsive design (mobile-friendly)

## Testing Prerequisites

1. **Development server running:**
   ```bash
   npm run dev
   ```

2. **MJCF robot loaded with actuators** (e.g., Unitree G1)
   - The robot must have actuators registered in ActuatorSystem
   - Actuators should follow naming convention: `robotId_joint_jointName`

3. **Browser console open** (F12) to monitor logs

## Test Plan

### Test 1: Panel Opening and Empty State

**Steps:**
1. Start development server: `npm run dev`
2. Open application in browser
3. Click **Actuator Control** icon in ribbon toolbar

**Expected Results:**
- ✅ Panel opens with title "Actuator Control"
- ✅ Subtitle shows "No device selected"
- ✅ Empty state message: "No actuators found - load an MJCF robot"
- ✅ Gamepad icon displayed in empty state

**Screenshot Location:** `[Device Select Section]`

---

### Test 2: Device Discovery After Loading MJCF

**Steps:**
1. Load Unitree G1 robot (or other MJCF model with actuators)
2. Wait 1 second for device discovery interval
3. Observe Actuator Control panel

**Expected Results:**
- ✅ Device dropdown appears with label "DEVICE"
- ✅ Dropdown shows robot name and actuator count (e.g., "Unitree G1 (20 actuators)")
- ✅ Device auto-selects if only one device available
- ✅ Actuator dropdown appears with all actuators listed

**Console Check:**
```javascript
// Run in browser console
const actuatorSystem = KinematicsManager.getInstance().getActuatorSystem();
console.log('Total actuators:', actuatorSystem.getAllActuators().length);
```

---

### Test 3: Device Selection from Dropdown

**Steps:**
1. Load multiple MJCF robots (if available)
2. Click device dropdown
3. Select different devices

**Expected Results:**
- ✅ Dropdown shows all devices with actuator counts
- ✅ Selecting device updates subtitle: "Device Name (X actuators)"
- ✅ Actuator list updates to show only actuators from selected device
- ✅ First actuator auto-selects

**Screenshot Location:** `[Device Selection Dropdown]`

---

### Test 4: Auto-Selection from Scene Tree

**Steps:**
1. Load Unitree G1 robot
2. Click on a robot link in the Scene Tree (e.g., "left_hip_pitch_link")
3. Observe Actuator Control panel

**Expected Results:**
- ✅ Panel auto-selects the robot device
- ✅ Device dropdown updates to show selected robot
- ✅ Actuator list populates with robot actuators

**Logic:**
The panel walks up the scene tree from selected node to find parent device:
```typescript
// Walk up to find if selected node is under any device
while (checkNode && !foundDeviceId) {
  if (devices.some(d => d.nodeId === checkNode.id)) {
    foundDeviceId = checkNode.id;
    break;
  }
  // Continue up tree...
}
```

---

### Test 5: Actuator Selection

**Steps:**
1. Select device with multiple actuators
2. Click actuator dropdown
3. Select different actuators

**Expected Results:**
- ✅ Dropdown shows all actuators with type labels (SERVO, LINEAR, etc.)
- ✅ Selecting actuator updates info section immediately
- ✅ Position slider updates to show current value
- ✅ Status indicator (LED) shows enabled/disabled state

**Screenshot Location:** `[Actuator Selection Dropdown]`

---

### Test 6: Actuator Info Display

**Steps:**
1. Select any actuator
2. Observe info section

**Expected Results:**
- ✅ **Type badge** shows actuator type (SERVO, LINEAR, PNEUMATIC, etc.)
- ✅ **Status indicator** shows:
  - Green LED with glow effect if enabled
  - Gray LED if disabled
  - Red warning icon if fault detected
- ✅ **Position** shows percentage (0.0% - 100.0%)
- ✅ All values update in real-time (every 500ms)

**Screenshot Location:** `[Actuator Info Section]`

---

### Test 7: Icon-Only Action Buttons

**Steps:**
1. Enable actuator (if disabled)
2. Test each action button

**Expected Results:**

| Button | Icon | Color | Action | Backend Command |
|--------|------|-------|--------|-----------------|
| **Open** | Play | Green | Fully open/extend | `set_value: 1.0` |
| **Close** | Square | Blue | Fully close/retract | `set_value: 0.0` |
| **Stop** | AlertTriangle | Red | Emergency stop | `disable` |
| **Power** | Power/PowerOff | Green when enabled | Enable/Disable | `enable` / `disable` |

**Testing:**
1. Click **Open** button → Actuator value should go to 100%
2. Click **Close** button → Actuator value should go to 0%
3. Click **Stop** button → Actuator should disable
4. Click **Power** button → Actuator should enable/disable

**Console Verification:**
```javascript
// Monitor ActuatorSystem commands
const actuatorSystem = KinematicsManager.getInstance().getActuatorSystem();
// Check console for command logs
```

**Screenshot Location:** `[Quick Actions Section]`

---

### Test 8: Manual Position Slider

**Steps:**
1. Ensure actuator is enabled
2. Drag position slider
3. Observe actuator state

**Expected Results:**
- ✅ Slider shows current position (0-100%)
- ✅ Dragging slider sends `set_value` command to backend
- ✅ Slider value displays on right side
- ✅ Slider is disabled if actuator is disabled
- ✅ Slider thumb changes color on hover (blue glow effect)

**Backend Command:**
```typescript
actuatorSystem.sendCommand({
  actuatorId: selectedActuatorId,
  command: 'set_value',
  value: value / 100, // Converts 0-100 to 0.0-1.0
});
```

**Screenshot Location:** `[Manual Control Section]`

---

### Test 9: Collapsible Metrics Section

**Steps:**
1. Select actuator
2. Click "Metrics" section header
3. Observe section collapse/expand

**Expected Results:**
- ✅ Section starts collapsed by default
- ✅ Clicking header toggles expand/collapse
- ✅ Chevron icon changes direction (Right → Down)
- ✅ Metrics display when expanded:
  - **Force:** Shows force in Newtons (or "—" if unavailable)
  - **Velocity:** Shows velocity in m/s (or "—" if unavailable)
  - **Temperature:** Shows temperature in °C (currently hardcoded 25°C)

**Screenshot Location:** `[Metrics Section - Expanded]`

---

### Test 10: Disabled State Behavior

**Steps:**
1. Select enabled actuator
2. Click **Power** button to disable
3. Observe UI changes

**Expected Results:**
- ✅ Status LED changes from green (glowing) to gray
- ✅ Status text changes from "Enabled" to "Disabled"
- ✅ **Open** button becomes disabled (grayed out)
- ✅ **Close** button becomes disabled (grayed out)
- ✅ Position slider becomes disabled (grayed out)
- ✅ **Stop** button remains enabled
- ✅ **Power** button remains enabled

---

### Test 11: Real-Time State Updates

**Steps:**
1. Open browser console
2. Manually change actuator state via console:
   ```javascript
   const actuatorSystem = KinematicsManager.getInstance().getActuatorSystem();
   actuatorSystem.sendCommand({
     actuatorId: 'robot_root_joint_left_hip_pitch',
     command: 'set_value',
     value: 0.75
   });
   ```
3. Observe panel updates

**Expected Results:**
- ✅ Position updates within 500ms
- ✅ Slider moves to new position
- ✅ Position percentage updates
- ✅ Metrics update (if available)

**Update Interval:** 500ms (configured in useEffect)

---

### Test 12: Responsive Layout (Mobile)

**Steps:**
1. Open browser DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select mobile device (e.g., iPhone 12, 390px width)
4. Resize panel to minimum width (320px)

**Expected Results:**
- ✅ Action buttons grid changes from 4 columns to 2 columns
- ✅ Metrics grid changes to single column
- ✅ All text remains legible
- ✅ No horizontal scrolling
- ✅ Touch targets remain accessible (≥44px)

**CSS Breakpoint:**
```css
@media (max-width: 380px) {
  .action-buttons {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

### Test 13: Panel Resizing and Dragging

**Steps:**
1. Drag panel by title bar
2. Resize panel by dragging edges
3. Test minimum and maximum sizes

**Expected Results:**
- ✅ Panel is draggable
- ✅ Panel is resizable
- ✅ Min size: 320px × 450px
- ✅ Max size: 500px × 800px
- ✅ Default size: 340px × 550px
- ✅ Content adapts to panel size

---

### Test 14: Error Handling - No Actuators

**Steps:**
1. Load URDF robot (no actuators)
2. Open Actuator Control panel

**Expected Results:**
- ✅ Panel shows empty state
- ✅ Message: "No actuators found - load an MJCF robot"
- ✅ No errors in console

---

### Test 15: Error Handling - Missing Device

**Steps:**
1. Load MJCF robot
2. Delete robot from scene tree (via console)
3. Observe panel behavior

**Expected Results:**
- ✅ Device list updates (device removed)
- ✅ Panel shows empty state
- ✅ No crashes or undefined errors

---

## Backend Integration Verification

### ActuatorSystem Commands

The panel sends these commands to ActuatorSystem:

1. **Set Value:**
   ```typescript
   actuatorSystem.sendCommand({
     actuatorId: 'robot_root_joint_left_hip_pitch',
     command: 'set_value',
     value: 0.5 // 0.0 to 1.0
   });
   ```

2. **Enable:**
   ```typescript
   actuatorSystem.sendCommand({
     actuatorId: 'robot_root_joint_left_hip_pitch',
     command: 'enable'
   });
   ```

3. **Disable:**
   ```typescript
   actuatorSystem.sendCommand({
     actuatorId: 'robot_root_joint_left_hip_pitch',
     command: 'disable'
   });
   ```

### Verification Console Commands

Run these in browser console to verify backend integration:

```javascript
// Get ActuatorSystem instance
const kinematicsManager = KinematicsManager.getInstance();
const actuatorSystem = kinematicsManager.getActuatorSystem();

// List all actuators
console.log('All actuators:', actuatorSystem.getAllActuators());

// Get specific actuator state
const actuator = actuatorSystem.getAllActuators()[0];
console.log('Actuator state:', actuator.state);

// Send test command
actuatorSystem.sendCommand({
  actuatorId: actuator.id,
  command: 'set_value',
  value: 0.5
});

// Verify command was received
console.log('Updated state:', actuator.state);
```

---

## Common Issues and Troubleshooting

### Issue 1: Device Not Appearing in Dropdown

**Symptoms:**
- MJCF robot loaded
- Actuator panel shows "No actuators found"

**Diagnosis:**
```javascript
// Check if actuators registered
const actuatorSystem = KinematicsManager.getInstance().getActuatorSystem();
console.log('Total actuators:', actuatorSystem.getAllActuators().length);

// Check actuator IDs
actuatorSystem.getAllActuators().forEach(a => {
  console.log('Actuator ID:', a.id, 'Name:', a.name);
});
```

**Possible Causes:**
1. Actuators not registered during MJCF load
2. Incorrect actuator ID format (should be `robotId_joint_jointName`)
3. Scene tree node not found for robot root

**Fix:**
- Check `MJCFActuatorIntegration.ts` for actuator registration
- Verify actuator IDs follow naming convention

---

### Issue 2: Auto-Selection Not Working

**Symptoms:**
- Click on robot link in scene tree
- Device doesn't auto-select

**Diagnosis:**
```javascript
// Check selected node ID
console.log('Selected node:', useEditorStore.getState().selectedNodeId);

// Check scene tree structure
const tree = SceneTreeManager.getInstance();
const node = tree.getNode(selectedNodeId);
console.log('Node:', node);
console.log('Parent ID:', node?.parentId);
```

**Possible Causes:**
1. Scene tree selection not updating
2. Node not under device hierarchy
3. Parent node name is 'Assets' (boundary condition)

**Fix:**
- Verify scene tree selection updates in editorStore
- Check node parent chain reaches device root

---

### Issue 3: Commands Not Executing

**Symptoms:**
- Click action buttons
- Actuator state doesn't change

**Diagnosis:**
```javascript
// Monitor commands
const actuatorSystem = KinematicsManager.getInstance().getActuatorSystem();

// Check if sendCommand exists
console.log('sendCommand method:', typeof actuatorSystem.sendCommand);

// Try manual command
actuatorSystem.sendCommand({
  actuatorId: 'test_id',
  command: 'set_value',
  value: 0.5
});
```

**Possible Causes:**
1. ActuatorSystem.sendCommand not implemented
2. Backend not connected to simulation
3. Actuator ID mismatch

**Fix:**
- Implement ActuatorSystem.sendCommand if missing
- Verify backend integration with simulation loop

---

### Issue 4: Real-Time Updates Not Working

**Symptoms:**
- Panel shows stale data
- Values don't update

**Diagnosis:**
```javascript
// Check update interval
console.log('Update interval running:', /* check setInterval */);

// Manually trigger update
const allActuators = actuatorSystem.getAllActuators();
console.log('Current actuator states:', allActuators.map(a => a.state));
```

**Possible Causes:**
1. setInterval cleanup not working
2. Component unmounted but interval still running
3. ActuatorSystem not updating state

**Fix:**
- Verify useEffect cleanup returns `() => clearInterval(interval)`
- Check ActuatorSystem state updates in simulation loop

---

## Performance Benchmarks

Expected performance metrics:

| Metric | Target | Measured |
|--------|--------|----------|
| Device discovery interval | 1000ms | — |
| Actuator state update interval | 500ms | — |
| Command execution latency | <50ms | — |
| Panel render time | <16ms (60fps) | — |
| Memory usage (panel open) | <10MB | — |

---

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter/Space activates buttons
- [ ] Arrow keys navigate dropdowns

### Screen Reader Support
- [ ] All buttons have tooltips (title attribute)
- [ ] Dropdowns have labels
- [ ] Status indicators announced

### Color Contrast
- [ ] Text meets WCAG AA standards (4.5:1)
- [ ] Status indicators have text labels (not color-only)

---

## Browser Compatibility

Tested browsers:

- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Final Checklist

Before marking as complete:

- [ ] All 15 tests pass
- [ ] Backend integration verified
- [ ] No console errors or warnings
- [ ] TypeScript compilation successful
- [ ] Responsive layout works on mobile
- [ ] Panel dragging/resizing works
- [ ] Real-time updates work correctly
- [ ] Commands execute successfully
- [ ] Documentation complete

---

## Related Files

- **Component:** [src/ui/components/FloatingActuatorPanel.tsx](../src/ui/components/FloatingActuatorPanel.tsx)
- **Styles:** [src/ui/components/FloatingActuatorPanel.css](../src/ui/components/FloatingActuatorPanel.css)
- **Backend:** [src/kinematics/ActuatorSystem.ts](../src/kinematics/ActuatorSystem.ts)
- **MJCF Integration:** [src/loaders/mjcf/MJCFActuatorIntegration.ts](../src/loaders/mjcf/MJCFActuatorIntegration.ts)

---

## Support

For issues or questions:
1. Check this testing guide first
2. Verify backend integration with console commands
3. Create GitHub issue with screenshots and console logs
4. Tag @georgem (owner: Actuator Control panel)

---

**Last Updated:** 2025-01-23
**Owner:** George (Agent 1 - Claude Code)
**Status:** ✅ Ready for Testing
