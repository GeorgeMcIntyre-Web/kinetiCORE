# MJCF Debug Logging Guide

## Overview

kinetiCORE now includes a comprehensive debug logging system for MJCF (MuJoCo XML) model loading. This system helps identify bugs in the joint creation pipeline by providing detailed, structured console output and downloadable log files.

## Enabling Debug Logging

### Method 1: URL Parameter (Recommended for Testing)

Add `?mjcf_debug` to your URL:

```
http://localhost:5173/?mjcf_debug
```

### Method 2: Browser Console

Open the browser console (F12) and run:

```javascript
MJCFDebugLogger.getInstance().enable()
```

Or use the shorthand:

```javascript
mjcfLogger.enable()
```

### Method 3: LocalStorage (Persists Across Sessions)

The debug flag is automatically saved to `localStorage` when enabled. To permanently enable:

```javascript
localStorage.setItem('mjcf_debug', 'true')
```

## Reading the Console Output

When MJCF debug logging is enabled, the console will show structured, collapsible groups:

### Example Output Structure

```
🔧 Creating Kinematics from MJCF
  ├─ 🔍 Extracting Joints from MJCF XML
  │   ├─ Joint [0]: floating_base_joint
  │   │   ├─ Type: free
  │   │   ├─ Parent Element: body (name: pelvis)
  │   │   ├─ Parent has 6 children: [joint, geom, geom, geom, body, body]
  │   │   ├─ ✓ Found parent body: pelvis
  │   │   └─ ✓ Found child body: base_link
  │   ├─ Joint [1]: left_hip_pitch_joint
  │   └─ ...
  ├─ 🗺️ Building Body → Scene Tree Node Mapping
  │   ├─ "pelvis" → node_12345
  │   ├─ "left_hip_pitch_link" → node_12346
  │   └─ ...
  ├─ 🔗 Joint Parent/Child Relationships
  │   ├─ ✓ floating_base_joint: pelvis → base_link (parent: found, child: found)
  │   ├─ ❌ broken_joint: foo → bar (parent: MISSING, child: MISSING)
  │   └─ ...
  ├─ ⚙️ Creating Kinematic Joints
  │   ├─ Joint: floating_base_joint
  │   │   ├─ Parent body "pelvis" → node_12345
  │   │   ├─ Child body "base_link" → node_12346
  │   │   ├─ Joint ID: robot_root_joint_floating_base_joint
  │   │   └─ ✓ Created joint (spherical)
  │   └─ ...
  └─ 🔗 Creating Kinematic Chain
      ├─ Chain Name: robot_root Kinematic Chain
      ├─ Root Node: robot_root
      ├─ Total joints in manager: 24
      ├─ Robot joints (filtered): 24
      └─ ✅ Created kinematic chain with 23 DOF

=== MJCF Debug Log Summary ===
✅ Success: 45
ℹ️  Info: 30
🐛 Debug: 120
⚠️  Warnings: 2
❌ Errors: 0
📊 Total Logs: 197
```

## Color Coding

The console uses color-coded prefixes for easy scanning:

- **🔵 Blue (Info)**: General information messages
- **🟢 Green (Success)**: Successful operations (✅, ✓)
- **🟡 Yellow (Warning)**: Warnings that don't prevent operation (⚠️)
- **🔴 Red (Error)**: Critical errors that cause failures (❌)
- **⚫ Gray (Debug)**: Detailed debug information

## Identifying Joint Creation Bugs

### Common Issues and Log Patterns

#### 1. **Missing Parent or Child Body**

**Symptom:**
```
❌ SKIPPING: Missing parent or child node
Parent body "foo_link" → NOT FOUND
Child body "bar_link" → NOT FOUND
```

**Cause:** The body names from the MJCF XML don't match the scene tree node names.

**Fix:** Check the Body Mapping Table to see which bodies were mapped. The issue is usually:
- Incorrect body naming in MJCF XML
- Scene tree nodes not created for all bodies
- Mismatch between MJCF body names and scene node names

---

#### 2. **No Child Body Found (Leaf Joint)**

**Symptom:**
```
⚠️ No child body found - treating as leaf joint
Setting childBody = parentBody = pelvis
```

**Cause:** The joint has no `<body>` element following it in the XML.

**Fix:** This is normal for end-effector joints. Verify this is intentional by checking the MJCF XML structure.

---

#### 3. **Joints Not Added to Kinematic Chain**

**Symptom:**
```
Total joints in manager: 24
Robot joints (filtered): 0
⚠️ No joints created, skipping kinematic chain creation
```

**Cause:** The joint ID filter `${robotRootNodeId}_joint_` doesn't match created joints.

**Fix:** Check that `robotRootNodeId` is correct and matches the scene tree root node.

---

#### 4. **Incorrect Parent/Child Mapping**

**Symptom:**
```
❌ broken_joint: foo → bar (parent: MISSING, child: MISSING)
```

**Cause:** The MJCF XML structure doesn't follow expected conventions (joint before child body).

**Fix:** Examine the "Parent has X children" debug output to see the actual XML structure.

---

## Downloading Logs

### Download as JSON (for programmatic analysis)

```javascript
mjcfLogger.downloadLogs('unitree-g1-debug.json')
```

This creates a structured JSON file with all log entries:

```json
[
  {
    "timestamp": 1706000000000,
    "level": "info",
    "category": "MJCF Kinematic",
    "message": "Robot Root Node ID: robot_root",
    "data": null
  },
  ...
]
```

### Download as Text (human-readable)

```javascript
mjcfLogger.downloadLogsAsText('unitree-g1-debug.txt')
```

This creates a plain text file with formatted log entries:

```
[2025-01-23T10:30:00.000Z] [INFO] [MJCF Kinematic] Robot Root Node ID: robot_root

[2025-01-23T10:30:00.100Z] [DEBUG] [MJCF Kinematic] Total Joints to Process: 24

...
```

## Viewing Summary Statistics

At any time during or after loading, you can view a summary:

```javascript
mjcfLogger.printSummary()
```

Or programmatically access stats:

```javascript
const stats = mjcfLogger.getSummary()
console.log(`Errors: ${stats.errors}, Warnings: ${stats.warnings}`)
```

## Clearing Logs

To clear all logs and start fresh:

```javascript
mjcfLogger.clear()
```

## Disabling Debug Logging

```javascript
mjcfLogger.disable()
```

Or remove from localStorage:

```javascript
localStorage.removeItem('mjcf_debug')
```

## Advanced Usage

### Custom Logging from Other Files

You can use the logger in any TypeScript file:

```typescript
import { mjcfLogger } from './loaders/mjcf/MJCFDebugLogger';

mjcfLogger.group('My Category', 'My Operation');
mjcfLogger.info('My Category', 'Starting process...');
mjcfLogger.debug('My Category', 'Details:', someData);
mjcfLogger.groupEnd();
```

### Conditional Logging

The logger automatically checks if it's enabled, so you don't need to wrap calls:

```typescript
// This is safe - will only log if enabled
mjcfLogger.debug('MJCF', 'Expensive computation result:', heavyComputation());
```

## Debugging Workflow

### Step 1: Enable Logging

```
http://localhost:5173/?mjcf_debug
```

### Step 2: Load MJCF Model

Upload your MJCF ZIP file or model through the UI.

### Step 3: Examine Console

Open browser console (F12) and expand the collapsed groups to find issues.

### Step 4: Identify Problems

Look for:
- ❌ Red error messages
- ⚠️ Yellow warning messages
- Mismatches in the "Joint Parent/Child Relationships" section

### Step 5: Download Logs

```javascript
mjcfLogger.downloadLogsAsText('debug-session.txt')
```

Share this file with the team or attach to GitHub issues.

### Step 6: Fix and Retry

Based on the log findings:
1. Fix the MJCF XML or code
2. Clear logs: `mjcfLogger.clear()`
3. Reload the model
4. Compare results

## Integration Points

The debug logger is integrated at these critical points:

1. **`MJCFKinematicExtractor.extractJointsFromMJCF`**
   - XML parsing
   - Parent/child body detection
   - Joint attribute extraction

2. **`MJCFKinematicExtractor.createKinematicsFromMJCF`**
   - Scene tree node mapping
   - Body name → node ID resolution
   - Joint creation in KinematicsManager
   - Kinematic chain assembly

3. **Future Integration Points** (planned):
   - `MJCFLoader.parseMJCF` - XML parsing phase
   - `MJCFActuatorIntegration.registerMJCFActuators` - Actuator creation
   - `MJCFKeyframeIntegration.registerMJCFKeyframes` - Keyframe registration

## Performance Impact

- **Enabled**: Minimal impact (~5-10ms for typical robot models)
- **Disabled**: Zero impact (all calls return immediately)

The logger is designed for development and debugging. Disable it in production builds if needed.

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (Chromium): Full support with colored output
- Firefox: Full support with colored output
- Safari: Full support with colored output

## Example Debugging Session

### Problem: Unitree G1 robot has missing joints

#### 1. Enable debugging
```
http://localhost:5173/?mjcf_debug
```

#### 2. Upload Unitree G1 MJCF

#### 3. Check console output

Found this in "Joint Parent/Child Relationships":
```
❌ left_ankle_roll_joint: left_ankle_pitch_link → UNKNOWN (parent: found, child: MISSING)
```

#### 4. Expand the joint details

```
Joint [12]: left_ankle_roll_joint
  ├─ Type: hinge
  ├─ Parent Element: body (name: left_ankle_pitch_link)
  ├─ Parent has 4 children: [geom, geom, joint, geom]
  ├─ ✓ Found parent body: left_ankle_pitch_link
  ├─ 🔎 Finding child body by searching siblings after joint...
  ├─ Joint index in parent: 2
  └─ ⚠️ No child body found - treating as leaf joint
```

#### 5. Diagnosis

The joint is at index 2, and there are only 4 children total. The remaining children are `<geom>` elements, not `<body>` elements. This is a **leaf joint** (end-effector), which is correct behavior.

#### 6. Resolution

✅ No bug! This is expected for end-effector joints like ankle rolls.

---

## Troubleshooting

### Q: Debug logging not appearing

**A:** Check:
1. Is `?mjcf_debug` in the URL?
2. Console not filtered (click "All" in console)
3. Try `mjcfLogger.enable()` manually
4. Check `localStorage.getItem('mjcf_debug')` returns `'true'`

### Q: Logs are overwhelming

**A:** Collapse all groups and expand only the sections with errors:
1. Look for ❌ or ⚠️ symbols
2. Expand only those groups
3. Use browser console search (Ctrl+F) to find specific joint names

### Q: Can't find specific joint

**A:** Use console search:
1. Press Ctrl+F in console
2. Search for joint name (e.g., "left_hip_pitch")
3. Console will highlight all instances

### Q: How to share logs with team?

**A:** Two options:
1. **Screenshot**: Expand relevant groups, take screenshot
2. **Download**: `mjcfLogger.downloadLogsAsText()` and attach to GitHub issue

---

## Related Documentation

- [MJCF Integration Guide](./MJCF_E2E_TESTING_ESSENTIAL.md)
- [How to Load MJCF with Meshes](../HOW_TO_LOAD_MJCF_WITH_MESHES.md)
- [MJCF ZIP Support](./MJCF_ZIP_SUPPORT.md)
- [Coordinate System Guide](../COORDINATE_SYSTEM.md)

## Support

For issues or questions:
1. Check this guide first
2. Download logs with `mjcfLogger.downloadLogsAsText()`
3. Create GitHub issue with logs attached
4. Tag @georgem (owner: MJCF pipeline)
