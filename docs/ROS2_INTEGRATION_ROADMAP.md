# ROS 2 Integration Roadmap for kinetiCORE

**Goal:** Transform kinetiCORE into a web-based robotics development platform with native ROS 2 integration for universities and commercial users.

**Strategy:** Incremental approach - deliver value quickly while building toward full integration.

---

## Executive Summary

### Why ROS 2 Integration?

**Target Market:**
- **Universities:** Students learn robotics in browser, deploy to real robots/Gazebo
- **Commercial:** Digital twins, offline programming, remote monitoring

**Competitive Advantage:**
- Web-based (no install hell: `apt install ros-humble-*`)
- Collaborative (share URL to simulation)
- Intuitive UI (Babylon.js vs. old Qt tools)
- Lightweight (runs on Chromebooks)

**Market Gap:**
- Gazebo/RViz2: Desktop apps, steep learning curve
- Foxglove Studio: **Read-only** visualization
- **kinetiCORE:** **Read-write** world building + ROS 2 native

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  kinetiCORE (Browser)                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐      │
│  │ Babylon.js  │  │ Trajectory   │  │ ROS 2 Message  │      │
│  │ 3D Scene    │  │ Planning     │  │ Serialization  │      │
│  └─────────────┘  └──────────────┘  └────────────────┘      │
│                            │                                  │
│                            ▼                                  │
│                   ┌──────────────────┐                       │
│                   │  WebSocket       │                       │
│                   │  Client          │                       │
│                   └──────────────────┘                       │
└────────────────────────────│─────────────────────────────────┘
                             │
                             ▼ (WebSocket)
┌────────────────────────────────────────────────────────────┐
│  ROS 2 Bridge Service (Node.js/Python)                     │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ rosbridge_server │  │ foxglove_bridge  │               │
│  │ (JSON protocol)  │  │ (optimized CDR)  │               │
│  └──────────────────┘  └──────────────────┘               │
└────────────────────────────│───────────────────────────────┘
                             │
                             ▼ (DDS)
┌────────────────────────────────────────────────────────────┐
│  ROS 2 Ecosystem                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Gazebo   │  │ MoveIt 2 │  │ Nav2     │  │ Real Robot│ │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘ │
└────────────────────────────────────────────────────────────┘
```

---

## Phase 1: ROS Message Compatibility (Weeks 1-2)

**Goal:** Make exports ROS 2-compatible with zero breaking changes

**Deliverables:**
1. ✅ URDF export (already exists at [URDFExporter.ts](src/kinematics/exporters/URDFExporter.ts))
2. ✅ MJCF export (already exists at [MJCFExporter.ts](src/kinematics/exporters/MJCFExporter.ts))
3. 🆕 ROS 2 `JointTrajectory` message exporter
4. 🆕 ROS 2 `JointState` message publisher format
5. 🆕 TF2 (transform) message format

### Implementation Tasks

#### 1.1 Create ROS 2 Message Types
**File:** `src/ros2/messages/JointTrajectory.ts`

```typescript
export interface JointTrajectoryPoint {
  positions: number[];          // Joint positions [rad or m]
  velocities?: number[];        // Joint velocities
  accelerations?: number[];     // Joint accelerations
  effort?: number[];            // Forces/torques
  time_from_start: {            // Duration from trajectory start
    sec: number;
    nanosec: number;
  };
}

export interface JointTrajectory {
  header: {
    stamp: { sec: number; nanosec: number };
    frame_id: string;
  };
  joint_names: string[];
  points: JointTrajectoryPoint[];
}
```

**File:** `src/ros2/messages/JointState.ts`

```typescript
export interface JointState {
  header: {
    stamp: { sec: number; nanosec: number };
    frame_id: string;
  };
  name: string[];       // Joint names
  position: number[];   // Joint positions
  velocity: number[];   // Joint velocities
  effort: number[];     // Joint efforts (torque/force)
}
```

**File:** `src/ros2/messages/TFMessage.ts`

```typescript
export interface TransformStamped {
  header: {
    stamp: { sec: number; nanosec: number };
    frame_id: string;
  };
  child_frame_id: string;
  transform: {
    translation: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number }; // Quaternion
  };
}

export interface TFMessage {
  transforms: TransformStamped[];
}
```

#### 1.2 Create Trajectory Exporter
**File:** `src/ros2/exporters/TrajectoryExporter.ts`

```typescript
export class TrajectoryExporter {
  /**
   * Convert kinetiCORE trajectory to ROS 2 JointTrajectory message
   */
  exportToJointTrajectory(
    trajectory: RobotTrajectory,
    jointNames: string[]
  ): JointTrajectory {
    // Sample trajectory at regular intervals (e.g., 100 Hz)
    const samplingRate = 100; // Hz
    const dt = 1.0 / samplingRate;

    const points: JointTrajectoryPoint[] = [];

    for (let t = 0; t <= trajectory.totalDuration; t += dt) {
      const jointAngles = this.optimizer.sampleTrajectory(trajectory, t);

      points.push({
        positions: jointAngles,
        velocities: this.computeVelocities(trajectory, t),
        accelerations: this.computeAccelerations(trajectory, t),
        time_from_start: this.toROSTime(t)
      });
    }

    return {
      header: {
        stamp: this.getCurrentROSTime(),
        frame_id: 'world'
      },
      joint_names: jointNames,
      points
    };
  }

  /**
   * Export as JSON for copy-paste into ROS 2 nodes
   */
  exportAsJSON(trajectory: JointTrajectory): string {
    return JSON.stringify(trajectory, null, 2);
  }

  /**
   * Download as .json file
   */
  downloadAsFile(trajectory: JointTrajectory, filename: string): void {
    const json = this.exportAsJSON(trajectory);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
  }
}
```

#### 1.3 Update TrajectoryOptimizer
**File:** [src/pathPlanning/TrajectoryOptimizer.ts](src/pathPlanning/TrajectoryOptimizer.ts)

Add methods to compute velocities/accelerations at specific times:

```typescript
// Add to existing TrajectoryOptimizer class
sampleVelocity(trajectory: RobotTrajectory, time: number): number[] | null {
  for (const segment of trajectory.segments) {
    const endTime = segment.startTime + segment.duration;
    if (time >= segment.startTime && time <= endTime) {
      const t = time - segment.startTime;
      return segment.jointTrajectories.map(fn => fn(t).vel);
    }
  }
  return null;
}

sampleAcceleration(trajectory: RobotTrajectory, time: number): number[] | null {
  for (const segment of trajectory.segments) {
    const endTime = segment.startTime + segment.duration;
    if (time >= segment.startTime && time <= endTime) {
      const t = time - segment.startTime;
      return segment.jointTrajectories.map(fn => fn(t).acc);
    }
  }
  return null;
}
```

### Testing Phase 1

```bash
# Test URDF export
npm run test:urdf-export

# Test trajectory export
npm run test:trajectory-export

# Manual verification
# 1. Export trajectory as JSON
# 2. Copy-paste into ROS 2 node
# 3. ros2 topic echo /joint_trajectory
```

**Success Criteria:**
- ✅ Export trajectory from kinetiCORE
- ✅ Import into ROS 2 workspace
- ✅ Execute on simulated robot in Gazebo
- ✅ Zero data loss (positions, velocities, accelerations match)

---

## Phase 2: WebSocket Bridge (Weeks 3-5)

**Goal:** Real-time bidirectional communication with ROS 2

**Deliverables:**
1. 🆕 WebSocket client for rosbridge protocol
2. 🆕 Publish to ROS 2 topics from browser
3. 🆕 Subscribe to ROS 2 topics in browser
4. 🆕 Real-time robot state visualization
5. 🆕 "Deploy to Robot" button in UI

### Implementation Tasks

#### 2.1 Install rosbridge_server (ROS 2 side)

```bash
# On ROS 2 machine (Ubuntu)
sudo apt install ros-humble-rosbridge-server

# Launch rosbridge
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

#### 2.2 Create WebSocket Client
**File:** `src/ros2/bridge/ROSBridgeClient.ts`

```typescript
export class ROSBridgeClient {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, (msg: any) => void> = new Map();

  /**
   * Connect to rosbridge_server
   */
  connect(url: string = 'ws://localhost:9090'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[ROSBridge] Connected to', url);
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[ROSBridge] Connection error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      };
    });
  }

  /**
   * Publish to a ROS topic
   */
  publish<T>(topic: string, messageType: string, message: T): void {
    if (!this.ws) throw new Error('Not connected');

    const rosbridgeMsg = {
      op: 'publish',
      topic,
      type: messageType,
      msg: message
    };

    this.ws.send(JSON.stringify(rosbridgeMsg));
  }

  /**
   * Subscribe to a ROS topic
   */
  subscribe<T>(
    topic: string,
    messageType: string,
    callback: (msg: T) => void
  ): void {
    if (!this.ws) throw new Error('Not connected');

    const rosbridgeMsg = {
      op: 'subscribe',
      topic,
      type: messageType
    };

    this.ws.send(JSON.stringify(rosbridgeMsg));
    this.subscribers.set(topic, callback);
  }

  /**
   * Call a ROS service
   */
  async callService<TReq, TRes>(
    service: string,
    serviceType: string,
    request: TReq
  ): Promise<TRes> {
    if (!this.ws) throw new Error('Not connected');

    return new Promise((resolve, reject) => {
      const id = `call_service:${service}:${Date.now()}`;

      const rosbridgeMsg = {
        op: 'call_service',
        id,
        service,
        type: serviceType,
        args: request
      };

      const listener = (event: MessageEvent) => {
        const response = JSON.parse(event.data);
        if (response.id === id) {
          this.ws?.removeEventListener('message', listener);
          if (response.result) {
            resolve(response.values as TRes);
          } else {
            reject(new Error('Service call failed'));
          }
        }
      };

      this.ws.addEventListener('message', listener);
      this.ws.send(JSON.stringify(rosbridgeMsg));
    });
  }

  private handleMessage(msg: any): void {
    if (msg.op === 'publish' && msg.topic) {
      const callback = this.subscribers.get(msg.topic);
      if (callback) callback(msg.msg);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

#### 2.3 Create ROS Manager
**File:** `src/ros2/ROSManager.ts`

```typescript
export class ROSManager {
  private bridge: ROSBridgeClient;

  constructor() {
    this.bridge = new ROSBridgeClient();
  }

  /**
   * Connect to ROS 2 system
   */
  async connect(url?: string): Promise<void> {
    await this.bridge.connect(url);

    // Subscribe to common topics
    this.subscribeToJointStates();
    this.subscribeToTF();
  }

  /**
   * Send trajectory to robot controller
   */
  async deployTrajectory(
    trajectory: JointTrajectory,
    controllerName: string = 'joint_trajectory_controller'
  ): Promise<void> {
    const action = {
      goal: {
        trajectory,
        goal_time_tolerance: { sec: 1, nanosec: 0 }
      }
    };

    // Use action client (simplified)
    await this.bridge.callService(
      `/${controllerName}/follow_joint_trajectory`,
      'control_msgs/action/FollowJointTrajectory',
      action
    );
  }

  /**
   * Subscribe to robot joint states
   */
  private subscribeToJointStates(): void {
    this.bridge.subscribe<JointState>(
      '/joint_states',
      'sensor_msgs/JointState',
      (msg) => {
        // Update kinetiCORE visualization
        this.updateRobotVisualization(msg);
      }
    );
  }

  /**
   * Subscribe to TF transforms
   */
  private subscribeToTF(): void {
    this.bridge.subscribe<TFMessage>(
      '/tf',
      'tf2_msgs/TFMessage',
      (msg) => {
        // Update coordinate frame visualization
        this.updateTFTree(msg);
      }
    );
  }

  /**
   * Update kinetiCORE 3D scene with robot state from ROS
   */
  private updateRobotVisualization(jointState: JointState): void {
    // Map ROS joint names to kinetiCORE joints
    // Update joint angles in Babylon scene
    // This creates "digital twin" effect
  }
}
```

#### 2.4 Add UI Controls
**File:** `src/ui/panels/ROS2Panel.tsx`

```typescript
export const ROS2Panel: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [rosURL, setROSURL] = useState('ws://localhost:9090');
  const rosManager = useRef(new ROSManager());

  const handleConnect = async () => {
    try {
      await rosManager.current.connect(rosURL);
      setConnected(true);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDeploy = async () => {
    // Get current trajectory from state
    const trajectory = useEditorStore.getState().currentTrajectory;
    if (!trajectory) return;

    try {
      await rosManager.current.deployTrajectory(trajectory);
      console.log('Trajectory deployed to robot!');
    } catch (error) {
      console.error('Failed to deploy:', error);
    }
  };

  return (
    <div className="ros2-panel">
      <h3>ROS 2 Connection</h3>

      <input
        type="text"
        value={rosURL}
        onChange={(e) => setROSURL(e.target.value)}
        placeholder="ws://localhost:9090"
      />

      <button onClick={handleConnect} disabled={connected}>
        {connected ? 'Connected' : 'Connect to ROS 2'}
      </button>

      {connected && (
        <button onClick={handleDeploy}>
          Deploy to Robot
        </button>
      )}

      <div className="status">
        Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
    </div>
  );
};
```

### Testing Phase 2

**Test 1: Publish from browser**
```bash
# Terminal 1: Launch rosbridge
ros2 launch rosbridge_server rosbridge_websocket_launch.xml

# Terminal 2: Echo topic
ros2 topic echo /test_topic

# Browser: kinetiCORE publishes message
# Verify message appears in Terminal 2
```

**Test 2: Subscribe in browser**
```bash
# Terminal: Publish test message
ros2 topic pub /joint_states sensor_msgs/JointState "{...}"

# Browser: Verify robot visualization updates in real-time
```

**Test 3: Deploy trajectory**
```bash
# Terminal: Launch Gazebo with robot
ros2 launch my_robot_gazebo robot.launch.py

# Browser: Plan trajectory in kinetiCORE
# Click "Deploy to Robot"
# Verify robot executes motion in Gazebo
```

**Success Criteria:**
- ✅ Connect to rosbridge from browser
- ✅ Publish trajectory to ROS 2
- ✅ Subscribe to joint states
- ✅ Robot in Gazebo executes kinetiCORE trajectory
- ✅ <100ms latency for state updates

---

## Phase 3: Advanced ROS Features (Weeks 6-8)

**Goal:** Feature parity with desktop ROS tools

**Deliverables:**
1. 🆕 TF tree visualization (coordinate frames)
2. 🆕 Parameter server integration
3. 🆕 Graph introspection (see all nodes/topics)
4. 🆕 Launch file generation
5. 🆕 URDF import (load robots from ROS packages)

### Implementation Tasks

#### 3.1 TF Visualization
**File:** `src/ros2/visualization/TFVisualizer.ts`

- Subscribe to `/tf` and `/tf_static`
- Render coordinate frame axes in Babylon scene
- Show transform hierarchy (tree view)
- Click frame → show in 3D

#### 3.2 Parameter Server
**File:** `src/ros2/params/ParameterClient.ts`

```typescript
// Get/set ROS parameters from browser
const param = await rosManager.getParameter('/robot/max_velocity');
await rosManager.setParameter('/robot/max_velocity', 2.5);
```

#### 3.3 Graph Introspection
**File:** `src/ros2/introspection/GraphInspector.ts`

- Call `/rosapi/nodes` service → list all ROS nodes
- Call `/rosapi/topics` service → list all topics
- Render graph visualization (like `rqt_graph`)

#### 3.4 Launch File Generator
**File:** `src/ros2/exporters/LaunchFileExporter.ts`

```python
# Auto-generate launch.py from kinetiCORE scene
from launch import LaunchDescription
from launch_ros.actions import Node

def generate_launch_description():
    return LaunchDescription([
        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            parameters=[{'robot_description': urdf_content}]
        ),
        Node(
            package='joint_state_publisher_gui',
            executable='joint_state_publisher_gui'
        )
    ])
```

#### 3.5 URDF Import
**File:** `src/kinematics/importers/URDFImporter.ts`

- Parse URDF XML
- Load meshes (STL/DAE/OBJ)
- Create kinetiCORE `KinematicDevice`
- Add to scene

### Testing Phase 3

**Demo scenario:**
1. User clicks "Import from ROS"
2. Browse to ROS package URDF
3. kinetiCORE loads robot into scene
4. User plans trajectory visually
5. Export as launch file
6. `ros2 launch my_workspace robot.launch.py`

---

## Phase 4: Optimization & Polish (Weeks 9-10)

**Goal:** Production-ready performance and UX

**Tasks:**
1. **Performance:**
   - Compress messages (rosbridge supports CBOR/PNG compression)
   - Throttle high-frequency topics (e.g., `/joint_states` at 1kHz → 30Hz for viz)
   - Use Foxglove bridge for large data (camera images, point clouds)

2. **Error Handling:**
   - Reconnect on connection loss
   - Queue messages when offline
   - Show meaningful errors in UI

3. **Documentation:**
   - Tutorial: "Your First ROS 2 Robot in kinetiCORE"
   - Video: kinetiCORE → Gazebo → Real TurtleBot workflow
   - API docs for ROS message types

4. **Security:**
   - HTTPS/WSS for production
   - Authentication for rosbridge (if exposing to internet)

---

## Dependencies & Prerequisites

### kinetiCORE (Browser)
```json
// package.json additions
{
  "dependencies": {
    "jszip": "^3.10.1",  // Already installed ✅
    "quaternion": "^1.5.1"  // For rotation conversions
  }
}
```

### ROS 2 (Server)
```bash
# Ubuntu 22.04 with ROS 2 Humble
sudo apt install ros-humble-rosbridge-server
sudo apt install ros-humble-foxglove-bridge  # Optional, Phase 4

# Alternative: Docker container
docker run -it -p 9090:9090 ros:humble-rosbridge
```

---

## Milestones & Timeline

| Week | Phase | Deliverable | Demo |
|------|-------|-------------|------|
| 1-2  | Phase 1 | ROS message exports | Export trajectory → Execute in Gazebo |
| 3-5  | Phase 2 | WebSocket bridge | Plan in browser → Deploy to robot |
| 6-8  | Phase 3 | Advanced features | Import ROS package → Edit → Export launch file |
| 9-10 | Phase 4 | Polish & docs | University beta test |

---

## Success Metrics

### Phase 1 (Technical)
- ✅ Trajectory executes in Gazebo without errors
- ✅ Position error <1mm, orientation error <0.1°

### Phase 2 (Integration)
- ✅ <100ms round-trip latency (browser → ROS → browser)
- ✅ No message drops at 30Hz update rate
- ✅ Stable connection for 1 hour continuous operation

### Phase 3 (Feature Complete)
- ✅ Import 10 different URDF robots successfully
- ✅ TF tree visualization matches RViz2

### Phase 4 (Production)
- ✅ 10 university students complete tutorial without help
- ✅ Works on Chromebook (no high-end GPU required)
- ✅ Zero critical bugs in 2-week beta test

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| rosbridge performance issues | High | Add Foxglove bridge as fallback (Phase 4) |
| Browser security blocks WebSocket | Medium | Provide HTTPS/WSS setup guide |
| URDF parsing complexity | Medium | Start with simple robots, use existing URDF.js library |
| User confusion (ROS learning curve) | High | Excellent tutorials + in-app tooltips |
| Network latency (remote robots) | Medium | Add offline mode: plan → export → manual upload |

---

## Market Validation (Before Phase 2)

**Week 3 checkpoint:** Before building WebSocket bridge, validate demand:

1. **Build Phase 1 demo video** (2 min)
   - Plan trajectory in kinetiCORE
   - Export JSON
   - Execute in Gazebo
   - Show side-by-side

2. **Get feedback from 5 target users:**
   - 2 robotics professors
   - 2 graduate students
   - 1 industrial robotics engineer

3. **Ask:**
   - Would you use this in your course/work?
   - What's missing?
   - Would your institution pay for this? (Pricing research)

4. **Decision gate:**
   - If 4/5 say "yes" → Proceed to Phase 2
   - If <3/5 → Pivot (maybe focus on different use case)

---

## Open Questions (To Resolve)

1. **Pricing model?**
   - Free tier: Limited robots, no commercial use
   - University: $500/year (unlimited students)
   - Commercial: $2000/year per engineer

2. **Backend hosting?**
   - Option A: Users host their own rosbridge (harder setup)
   - Option B: We provide cloud ROS 2 VMs (easier, recurring revenue)

3. **MoveIt 2 integration?**
   - kinetiCORE has RRT planner already
   - Could also offload planning to MoveIt 2 via ROS services
   - Which is better UX?

---

## Resources

- **ROS 2 Humble Docs:** https://docs.ros.org/en/humble/
- **rosbridge Protocol:** https://github.com/RobotWebTools/rosbridge_suite/blob/ros2/ROSBRIDGE_PROTOCOL.md
- **Foxglove WebSocket:** https://github.com/foxglove/ws-protocol
- **roslibjs (reference):** https://github.com/RobotWebTools/roslibjs
- **URDF Spec:** http://wiki.ros.org/urdf/XML

---

## Next Steps (This Week)

1. ✅ Get this roadmap approved (share with team)
2. 🔜 Create feature branch: `git checkout -b feature/ros2-integration`
3. 🔜 Implement Phase 1.1: ROS message types
4. 🔜 Implement Phase 1.2: Trajectory exporter
5. 🔜 Test export → Gazebo workflow
6. 🔜 Record demo video

---

**Owner:** George (Architecture Lead)
**Reviewers:** Cole (3D), Edwin (UI)
**Last Updated:** 2025-10-08
