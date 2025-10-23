# ROS 2 Integration - Usage Guide

This guide shows how to use kinetiCORE's ROS 2 integration to connect to real robots and simulators.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Connecting to ROS 2](#connecting-to-ros-2)
4. [Deploying Trajectories](#deploying-trajectories)
5. [Subscribing to Robot State](#subscribing-to-robot-state)
6. [Working with TF Transforms](#working-with-tf-transforms)
7. [Advanced Usage](#advanced-usage)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### ROS 2 Side (Ubuntu/Linux)

Install rosbridge_server on your ROS 2 system:

```bash
# For ROS 2 Humble
sudo apt install ros-humble-rosbridge-server

# For ROS 2 Iron
sudo apt install ros-iron-rosbridge-server
```

Launch rosbridge:

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

By default, rosbridge listens on `ws://localhost:9090`.

### kinetiCORE Side (Browser)

No installation needed! The ROS 2 integration is built into kinetiCORE.

---

## Quick Start

### 1. Open ROS 2 Panel

In kinetiCORE, open the **ROS 2 Panel** from the side menu.

### 2. Connect to rosbridge

1. Enter your rosbridge URL (default: `ws://localhost:9090`)
2. Click **Connect to ROS 2**
3. Wait for the green "Connected" indicator

### 3. View Live Data

Once connected, you'll see:
- Active topics
- Live joint states (if `/joint_states` is published)
- TF transforms
- Connection statistics

---

## Connecting to ROS 2

### Using the UI Panel

The easiest way to connect is via the ROS 2 Panel (see Quick Start above).

### Programmatic Connection

```typescript
import { ROSManager } from '@ros2/bridge';

// Create manager
const rosManager = new ROSManager();

// Connect to rosbridge
await rosManager.connect('ws://192.168.1.100:9090');

// Check connection
if (rosManager.isConnected()) {
  console.log('Connected to ROS 2!');
}

// Disconnect when done
rosManager.disconnect();
```

### Remote Connections

To connect to a remote ROS 2 system:

1. **On the ROS 2 machine**, launch rosbridge with `--address 0.0.0.0`:

```bash
ros2 launch rosbridge_server rosbridge_websocket_launch.xml address:=0.0.0.0
```

2. **In kinetiCORE**, use the remote IP:

```
ws://192.168.1.100:9090
```

⚠️ **Security Warning**: Only expose rosbridge on trusted networks. For production, use WSS (WebSocket Secure) with authentication.

---

## Deploying Trajectories

### Step 1: Plan a Trajectory in kinetiCORE

Use the trajectory planner to create a motion plan for your robot.

### Step 2: Export to ROS 2 Format

```typescript
import { TrajectoryExporter } from '@ros2/exporters';
import { TrajectoryOptimizer } from '@pathPlanning/TrajectoryOptimizer';

// Create exporter
const optimizer = new TrajectoryOptimizer(ikSolver, robotChainId);
const exporter = new TrajectoryExporter(optimizer);

// Export trajectory
const rosTrajectory = exporter.exportToJointTrajectory(
  trajectory,
  ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6'],
  {
    samplingRate: 100, // Hz
    includeVelocities: true,
    includeAccelerations: true
  }
);

// Download as JSON file
exporter.downloadAsFile(trajectory, jointNames, 'my_trajectory');
```

### Step 3: Deploy to Robot Controller

```typescript
import { ROSManager } from '@ros2/bridge';

const rosManager = new ROSManager();
await rosManager.connect();

// Set the trajectory optimizer
rosManager.setTrajectoryOptimizer(optimizer);

// Deploy trajectory
await rosManager.deployTrajectory(
  trajectory,
  ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6'],
  {
    controllerName: 'joint_trajectory_controller',
    goalTimeTolerance: 1.0 // seconds
  }
);

console.log('Trajectory deployed to robot!');
```

### Step 4: Execute in Gazebo/Real Robot

The trajectory will be sent to the ROS 2 controller specified. Make sure:

1. Your robot controller is running
2. The joint names match your robot's URDF
3. The controller is listening on the correct topic

---

## Subscribing to Robot State

### Joint States

```typescript
rosManager.subscribeToJointStates((state) => {
  console.log('Joint positions:', state.position);
  console.log('Joint velocities:', state.velocity);
  console.log('Joint names:', state.name);

  // Update kinetiCORE visualization
  // (This would update your 3D robot in the scene)
});
```

### Unsubscribe

```typescript
rosManager.unsubscribeFromJointStates();
```

---

## Working with TF Transforms

### Subscribe to TF

```typescript
rosManager.subscribeToTF((tfMessage) => {
  tfMessage.transforms.forEach((transform) => {
    console.log(`Transform: ${transform.header.frame_id} -> ${transform.child_frame_id}`);
    console.log('Position:', transform.transform.translation);
    console.log('Rotation:', transform.transform.rotation);
  });
});
```

### Publish a Transform

```typescript
import { TransformStamped } from '@ros2/messages';
import { getCurrentROSTime } from '@ros2/utils';

const transform: TransformStamped = {
  header: {
    stamp: getCurrentROSTime(),
    frame_id: 'world'
  },
  child_frame_id: 'robot_base',
  transform: {
    translation: { x: 1.0, y: 2.0, z: 0.0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 } // Identity quaternion
  }
};

rosManager.publishTransform(transform);
```

---

## Advanced Usage

### Get Available Topics

```typescript
const topics = await rosManager.getTopics();
console.log('Available topics:', topics);
```

### Get Available Nodes

```typescript
const nodes = await rosManager.getNodes();
console.log('Running nodes:', nodes);
```

### Get/Set ROS Parameters

```typescript
// Get parameter
const maxVel = await rosManager.getParameter<number>('/robot/max_velocity');
console.log('Max velocity:', maxVel);

// Set parameter
await rosManager.setParameter('/robot/max_velocity', 2.5);
```

### Call ROS Services

```typescript
// Using the low-level bridge client
const result = await rosManager.bridge.callService(
  '/my_service',
  'my_package/MyService',
  { input: 'hello' }
);
console.log('Service result:', result);
```

### Custom Message Publishing

```typescript
rosManager.bridge.advertise('/custom_topic', 'std_msgs/String');
rosManager.bridge.publish('/custom_topic', 'std_msgs/String', {
  data: 'Hello from kinetiCORE!'
});
```

---

## Troubleshooting

### Connection Refused

**Problem**: Cannot connect to `ws://localhost:9090`

**Solutions**:
1. Check that rosbridge is running:
   ```bash
   ros2 node list | grep rosbridge
   ```
2. Check the port:
   ```bash
   netstat -tuln | grep 9090
   ```
3. Try the full launch command:
   ```bash
   ros2 launch rosbridge_server rosbridge_websocket_launch.xml
   ```

### CORS Errors

**Problem**: Browser blocks WebSocket connection due to CORS policy

**Solution**: This usually happens when accessing kinetiCORE via `file://`. Use a development server instead:

```bash
npm run dev
# Access via http://localhost:5173
```

### Trajectory Not Executing

**Problem**: Trajectory deploys but robot doesn't move

**Checklist**:
1. ✅ Controller is running:
   ```bash
   ros2 control list_controllers
   ```
2. ✅ Joint names match URDF:
   ```bash
   ros2 topic echo /joint_states --once
   ```
3. ✅ Controller is in correct state:
   ```bash
   ros2 control set_controller_state joint_trajectory_controller active
   ```

### WebSocket Disconnects

**Problem**: Connection drops frequently

**Solutions**:
1. Check network stability
2. Increase reconnect attempts in ROSManager options
3. Use wired connection instead of WiFi
4. Check firewall settings

### Joint Names Mismatch

**Problem**: Error about unknown joints

**Solution**: Make sure joint names in kinetiCORE match your robot's URDF:

```bash
# List joints from URDF
ros2 param get /robot_state_publisher robot_description | grep "joint name"
```

Then use those exact names in kinetiCORE:

```typescript
const jointNames = [
  'shoulder_pan_joint',
  'shoulder_lift_joint',
  'elbow_joint',
  'wrist_1_joint',
  'wrist_2_joint',
  'wrist_3_joint'
];
```

---

## Example: Complete Workflow

Here's a complete example of planning and deploying a trajectory:

```typescript
import { ROSManager } from '@ros2/bridge';
import { TrajectoryExporter } from '@ros2/exporters';
import { TrajectoryOptimizer } from '@pathPlanning/TrajectoryOptimizer';

async function deployRobotTrajectory() {
  // 1. Connect to ROS 2
  const rosManager = new ROSManager();
  await rosManager.connect('ws://localhost:9090');

  // 2. Set up trajectory exporter
  const optimizer = new TrajectoryOptimizer(ikSolver, 'robot_arm');
  rosManager.setTrajectoryOptimizer(optimizer);

  // 3. Plan trajectory (your trajectory planning code here)
  const trajectory = planTrajectory();

  // 4. Deploy to robot
  await rosManager.deployTrajectory(
    trajectory,
    ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6'],
    {
      controllerName: 'joint_trajectory_controller',
      goalTimeTolerance: 0.5
    }
  );

  // 5. Subscribe to feedback
  rosManager.subscribeToJointStates((state) => {
    console.log('Robot moving:', state.position);
  });

  console.log('Trajectory deployed successfully!');
}

// Run it
deployRobotTrajectory().catch(console.error);
```

---

## Next Steps

- **Phase 3**: TF visualization, parameter server UI, graph introspection
- **Phase 4**: Optimization, compression, production deployment

See [ROS2_INTEGRATION_ROADMAP.md](./ROS2_INTEGRATION_ROADMAP.md) for the full development roadmap.

---

**Need Help?**

- ROS 2 Docs: https://docs.ros.org/en/humble/
- rosbridge Protocol: https://github.com/RobotWebTools/rosbridge_suite
- kinetiCORE Issues: https://github.com/GeorgeMcIntyre-Web/kinetiCORE/issues
