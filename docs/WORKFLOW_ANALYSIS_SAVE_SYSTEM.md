# Workflow Analysis - When to Save What?

**Agent 3 (Cursor) - Edwin**  
**Date:** 2025-10-23

---

## 🎯 Core Insight: Two Different Save Operations

### 1. **Asset Library Management** (Already Handled)
**What:** Individual robot models, equipment, parts  
**Where:** Asset Library  
**When:** One-time setup, managed by asset system  
**Storage:** Already in library database + CDN

### 2. **World State Management** (What We're Building)
**What:** Scene layout, robot positions, joint poses, attachments  
**Where:** Project saves  
**When:** During simulation/layout work  
**Storage:** Project database + file exports

---

## 📋 Workflow Scenarios

### Workflow 1: New Factory Layout Design

```
User Story:
"I'm designing a new factory floor layout with 10 robots, 
5 conveyors, and 20 work stations."

Steps:
1. Open new project
2. Drag KUKA KR270 from asset library → instantiate 10 times
   └─ Asset already in library ✅ (no save needed)
3. Position each robot in factory layout
   └─ SAVE WORLD STATE ← positions, orientations
4. Configure joint poses for each robot
   └─ SAVE WORLD STATE ← joint states
5. Add attachments (grippers to robots)
   └─ SAVE WORLD STATE ← attachment relationships
6. Test simulation
7. SAVE PROJECT ← entire world state

What's Saved:
✅ 10 robot instances with positions/joints/attachments
✅ 5 conveyor instances with positions
✅ 20 work station instances with positions
✅ Camera view, lighting, scene settings
❌ Robot mesh files (already in library)
❌ Conveyor mesh files (already in library)
```

**File Save Use Case:**
- Export factory layout to share with client
- Backup before major changes
- Version control (Git)

**Database Save Use Case:**
- Auto-save every 30 seconds while working
- Checkpoints during design process
- Collaboration with team members

---

### Workflow 2: Robot Programming & Testing

```
User Story:
"I'm programming a robot welding sequence and need to 
save different poses for testing."

Steps:
1. Load existing factory layout (from database)
2. Select Robot_1_Welding
3. Manually position joints for welding pose
   └─ SAVE WORLD STATE ← joint configuration "Weld_Start"
4. Adjust to second pose
   └─ SAVE WORLD STATE ← joint configuration "Weld_End"
5. Test motion between poses
6. SAVE PROJECT

What's Saved:
✅ Joint states for each named pose
✅ Robot position in world
✅ Attachment states (gripper open/closed)
❌ Robot URDF file (already in library)
```

**Why Both Saves?**
- **Database:** Quick checkpoint saves during programming
- **File:** Export "Weld_Sequence_v1.json" to share with programmer

---

### Workflow 3: Simulation Scenario Management

```
User Story:
"I have 5 different simulation scenarios for the same factory 
(normal operation, maintenance mode, high-speed mode, etc.)"

Steps:
1. Create base factory layout
2. SAVE "Factory_Base.json" (file export)
3. Configure for normal operation scenario
   └─ Set robot joint positions
   └─ Set conveyor speeds
   └─ SAVE "Scenario_Normal" (database)
4. Load "Factory_Base.json"
5. Configure for maintenance scenario
   └─ Move robots to safe positions
   └─ Stop conveyors
   └─ SAVE "Scenario_Maintenance" (database)
6. Load "Factory_Base.json"
7. Configure for high-speed scenario
   └─ Optimize robot poses
   └─ Speed up conveyors
   └─ SAVE "Scenario_HighSpeed" (database)

What's Saved (Each Scenario):
✅ Different joint configurations
✅ Different robot positions
✅ Different attachment states
✅ Different physics settings
❌ Asset geometry (shared across all scenarios)
```

**Why Both Saves?**
- **File:** "Factory_Base.json" as master template
- **Database:** Multiple scenario variations with quick switching

---

### Workflow 4: Collaborative Factory Planning

```
User Story:
"Three engineers are collaborating on a factory layout in real-time."

Engineer 1: Adding robots to layout
Engineer 2: Positioning conveyors
Engineer 3: Configuring safety zones

Steps:
1. All join same project (database-backed)
2. Engineer 1 drags robot from library
   └─ REAL-TIME SYNC ← new instance appears for all users
3. Engineer 1 positions robot
   └─ REAL-TIME SYNC ← position updates live
4. AUTO-SAVE (30 seconds) ← database checkpoint
5. Engineer 2 adds conveyor
   └─ REAL-TIME SYNC
6. Engineer 3 adds safety fence
   └─ REAL-TIME SYNC
7. Manual SAVE "Checkpoint_1" (database)
8. End of day: EXPORT FILE "Factory_EOD_2025-10-23.json"

What's Saved (Database - Frequent):
✅ Real-time updates of positions
✅ Real-time updates of joint states
✅ Auto-save checkpoints every 30 seconds
✅ Manual save checkpoints

What's Saved (File - Occasional):
✅ End-of-day snapshot
✅ Major milestone snapshots
✅ Client deliverables
```

**Why Both Saves?**
- **Database:** Real-time collaboration + auto-saves
- **File:** Major milestones, backups, client deliverables

---

### Workflow 5: Version Control & Rollback

```
User Story:
"I made a mistake and need to roll back to yesterday's layout."

Steps:
1. View save history (database)
   ├─ Auto-save 2:45 PM (current)
   ├─ Auto-save 2:44 PM
   ├─ Auto-save 2:43 PM
   ├─ Checkpoint "Before Robot 5" 2:30 PM
   ├─ Checkpoint "Morning Work" 10:00 AM
   └─ Checkpoint "EOD Yesterday" 5:00 PM ← Load this

2. LOAD "EOD Yesterday" (database)
3. Verify layout is correct
4. EXPORT FILE "Factory_Rollback_2025-10-23.json" (backup)

What's Loaded:
✅ All robot positions from yesterday
✅ All joint states from yesterday
✅ All attachments from yesterday
✅ Scene state from yesterday
```

**Why Both Saves?**
- **Database:** Quick rollback through history (10+ checkpoints)
- **File:** Long-term archival (keep for months/years)

---

### Workflow 6: Asset Update Propagation

```
User Story:
"KUKA released a new version of the KR270 model with 
improved geometry. I want to update all 10 robots in my scene."

Steps:
1. Asset manager uploads new KR270 v2.0.0 to library
   └─ New library asset created
2. Open existing factory layout
   └─ 10 robots currently use KR270 v1.0.0
3. Select "Update all instances of KR270"
   └─ System updates assetId references
   └─ Reloads all 10 robots with new geometry
4. SAVE WORLD STATE
   └─ Updates asset references to v2.0.0
   └─ Preserves positions, joints, attachments

What's Saved:
✅ Updated asset references (v1.0.0 → v2.0.0)
✅ Same positions (preserved)
✅ Same joint states (preserved)
✅ Same attachments (preserved)
```

**Key Point:** World save only stores **references** to assets, not the assets themselves!

---

## 🔄 Save Operation Matrix

| Operation | What's Saved | File Export | Database | Real-Time Sync |
|-----------|--------------|-------------|----------|----------------|
| Add asset instance | Instance transform | ✅ | ✅ | ✅ |
| Move object | Position/rotation | ✅ | ✅ | ✅ |
| Configure joints | Joint states | ✅ | ✅ | ✅ |
| Add attachment | Attachment data | ✅ | ✅ | ✅ |
| Change camera | Camera state | ✅ | ✅ | ❌ (local) |
| Change lighting | Light state | ✅ | ✅ | ✅ |
| Physics settings | Physics state | ✅ | ✅ | ✅ |
| Upload new asset | N/A (library) | ❌ | ❌ | ❌ |
| Update asset version | Asset ref update | ✅ | ✅ | ✅ |

---

## 📊 When to Use Each Save Type

### File Export (JSON) - Use When:
- ✅ Sharing project with external parties
- ✅ Long-term archival (months/years)
- ✅ Version control (Git commits)
- ✅ Client deliverables
- ✅ Template creation (base layouts)
- ✅ Migration between environments
- ✅ Backup before major changes
- ✅ Documentation/auditing

### Database Save - Use When:
- ✅ Working on active project
- ✅ Auto-save during work session
- ✅ Quick checkpoints
- ✅ Collaboration (real-time or turn-based)
- ✅ Version history (short-term)
- ✅ Quick rollback scenarios
- ✅ Testing different configurations
- ✅ Daily work snapshots

### Real-Time Sync - Use When:
- ✅ Multiple users editing simultaneously
- ✅ Live collaboration session
- ✅ Immediate feedback needed
- ✅ Co-located team working together
- ❌ NOT for auto-save (too frequent)
- ❌ NOT for file export (not stored)

---

## 🎨 User Interface Flow

### Dual Save Strategy UI

```
┌─────────────────────────────────────────────────────────┐
│  File    Edit    View    Project    Help             ×  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Factory Layout v2]  Last saved: 2 min ago  Auto: ON   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │                                                     │ │
│  │              [3D Scene View]                       │ │
│  │                                                     │ │
│  │                                                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Save Options:                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Quick Save  │  │ Export File  │  │   History    │  │
│  │  (Database)  │  │    (JSON)    │  │   (Loads)    │  │
│  │              │  │              │  │              │  │
│  │  Ctrl+S      │  │  Ctrl+E      │  │  Ctrl+H      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Save Dialog (Dual Mode)

```
┌─────────────────────────────────────┐
│  Save Project                    ×  │
├─────────────────────────────────────┤
│                                     │
│  Save Name: [___________________]   │
│                                     │
│  Save Type:                         │
│  ○ Quick Save (Database)            │
│     └─ Fast, cloud-backed           │
│     └─ Enables collaboration        │
│     └─ Auto-save compatible         │
│                                     │
│  ○ Export File (JSON)               │
│     └─ Shareable, human-readable    │
│     └─ Version control friendly     │
│     └─ Long-term archival           │
│                                     │
│  ○ Both (Recommended)               │
│     └─ Database + File export       │
│     └─ Best of both worlds          │
│                                     │
│  Options:                           │
│  ☑ Include external meshes (CDN)    │
│  ☐ Include Babylon scene snapshot   │
│  ☑ Add to version history           │
│                                     │
│  Estimated size:                    │
│  Database: 1.2 MB (compressed)      │
│  File: 8.5 MB (if exported)         │
│                                     │
│  [Cancel]  [Save]                   │
└─────────────────────────────────────┘
```

### Auto-Save Configuration

```
┌─────────────────────────────────────┐
│  Auto-Save Settings              ×  │
├─────────────────────────────────────┤
│                                     │
│  ☑ Enable Auto-Save                 │
│                                     │
│  Frequency:                         │
│  [30] seconds  [▼]                  │
│                                     │
│  Options:                           │
│  30 seconds                         │
│  1 minute                           │
│  2 minutes                          │
│  5 minutes                          │
│  Custom...                          │
│                                     │
│  ☑ Save to database (cloud)         │
│  ☐ Save to local file               │
│                                     │
│  Keep history:                      │
│  [10] auto-saves  [▼]               │
│                                     │
│  ☑ Show notification on save        │
│  ☐ Pause auto-save during playback  │
│                                     │
│  [Apply]  [Cancel]                  │
└─────────────────────────────────────┘
```

---

## 💾 Revised Save Strategy

Based on user feedback:

### 1. Default Behavior: Save Both
```typescript
async function saveProject(name: string): Promise<void> {
  // 1. Save to database (fast, compressed)
  const dbSaveId = await saveWorldToDatabase(projectId, name);
  
  // 2. Export to file (human-readable backup)
  await exportWorldToFile(name);
  
  // 3. Notify user
  toast.success(`Saved to cloud and exported file`);
}
```

### 2. Use Brotli Compression
```typescript
import pako from 'pako'; // For gzip fallback
import { compress, decompress } from 'brotli-wasm'; // Better compression

async function compressWorldData(data: WorldSaveData): Promise<Uint8Array> {
  const jsonString = JSON.stringify(data);
  
  // Try Brotli first (better compression)
  try {
    const compressed = await compress(
      new TextEncoder().encode(jsonString),
      { quality: 11 } // Max quality for best compression
    );
    return compressed;
  } catch (error) {
    // Fallback to gzip if Brotli fails
    console.warn('Brotli failed, falling back to gzip');
    return pako.gzip(jsonString);
  }
}

// Compression comparison:
// Gzip:   25 MB → 3 MB (88% reduction)
// Brotli: 25 MB → 2 MB (92% reduction) ✨
```

### 3. Configurable Auto-Save
```typescript
interface AutoSaveConfig {
  enabled: boolean;
  frequency: number; // seconds
  saveToDatabase: boolean;
  saveToFile: boolean;
  keepHistory: number; // number of auto-saves to keep
}

const defaultAutoSaveConfig: AutoSaveConfig = {
  enabled: true,
  frequency: 30, // 30 seconds
  saveToDatabase: true,
  saveToFile: false, // Don't spam file exports
  keepHistory: 10 // Keep last 10 auto-saves
};

// User can configure in settings
function setAutoSaveConfig(config: Partial<AutoSaveConfig>): void {
  const newConfig = { ...currentConfig, ...config };
  localStorage.setItem('autoSaveConfig', JSON.stringify(newConfig));
  restartAutoSaveTimer(newConfig.frequency);
}
```

### 4. Real-Time + Save-Based Collaboration
```typescript
// Hybrid collaboration model

// 1. Real-time sync for live updates
websocket.on('user_move_object', (data) => {
  // Update immediately in 3D scene
  scene.updateObjectPosition(data.objectId, data.position);
  // Don't save yet - just visual update
});

websocket.on('user_change_joint', (data) => {
  // Update immediately in 3D scene
  robot.setJointPosition(data.jointId, data.position);
  // Don't save yet - just visual update
});

// 2. Save-based sync for persistence
websocket.on('user_save', (data) => {
  // Another user saved - reload their changes
  await loadWorldFromDatabase(data.saveId);
  toast.info(`${data.userName} saved project`);
});

// 3. Auto-save creates checkpoints
setInterval(() => {
  if (hasUnsavedChanges()) {
    await saveWorldToDatabase(projectId, 'Auto-save');
    broadcastSave(); // Tell other users
  }
}, autoSaveFrequency);

// 4. Conflict resolution
function handleSaveConflict(
  localChanges: Change[],
  remoteChanges: Change[]
): Resolution {
  // Show merge UI or use last-write-wins
  return mergeChanges(localChanges, remoteChanges);
}
```

---

## 📝 Summary: What Gets Saved Where

### Asset Library (Separate System)
- ✅ Robot URDF files
- ✅ Mesh files (.stl, .dae, .obj)
- ✅ Texture files
- ✅ Asset metadata
- 🏠 Storage: Library database + CDN

### World Save (This System)
- ✅ Asset instance references (not full assets!)
- ✅ Instance transforms (position, rotation, scale)
- ✅ Joint states (per robot instance)
- ✅ Attachments (connections between instances)
- ✅ Scene state (camera, lights, physics)
- ✅ Kinematics chains
- 🏠 Storage: Project database (compressed) + File exports (JSON)

### Real-Time Sync (Live Collaboration)
- ✅ Live transform updates
- ✅ Live joint updates
- ✅ User cursors/selections
- ✅ Locks (who's editing what)
- ⚡ Transport: WebSocket
- 🏠 Storage: Not persisted (ephemeral)

---

## ✅ Revised Decisions

1. **Save both file and database** ✅ Default behavior
2. **Use Brotli compression** ✅ Better than gzip (92% vs 88%)
3. **Configurable auto-save** ✅ Default 30s, user adjustable
4. **Hybrid collaboration** ✅ Real-time updates + save-based checkpoints

Next: Implement Phase 1 with these decisions! 🚀
