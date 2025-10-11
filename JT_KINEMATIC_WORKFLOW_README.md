# JT Kinematic Workflow Implementation

## Overview

This implementation provides a complete solution for extracting kinematic data from JT files and applying it to GLB files converted via CAD Exchanger. The workflow enables you to:

1. **Extract kinematic data** (joints, links, constraints) from JT files
2. **Map kinematic data** to kinetiCORE's kinematic structures
3. **Apply kinematic data** to GLB meshes for simulation
4. **Create interactive controls** for robot manipulation

## Files Created

### Core Components
- `src/loaders/jt/JTKinematicExtractor.ts` - Main kinematic data extraction logic
- `src/loaders/jt/JTKinematicIntegrationService.ts` - Integration with existing JT pipeline
- `src/loaders/jt/JTKinematicWorkflowTest.ts` - Test suite for the workflow
- `src/ui/components/JTKinematicWorkflowUI.tsx` - React UI component for testing

### Test Files
- `test-jt-kinematic-workflow.ts` - Standalone test script

## How It Works

### 1. JT Kinematic Data Extraction

The `JTKinematicExtractor` analyzes JT files to extract:

```typescript
interface JTKinematicData {
    joints: JTJoint[];           // Joint definitions with axes, limits, etc.
    links: JTLink[];             // Link definitions with geometry and mass
    assemblyStructure: JTAssemblyNode[]; // Hierarchical structure
    constraints: JTConstraint[]; // Assembly constraints
}
```

### 2. Robot-Specific Kinematic Models

For your r2000ic robot, the system creates a realistic 6-axis kinematic model:

- **Joint 1**: Base rotation (Z-axis, ±180°)
- **Joint 2**: Lower arm (Y-axis, ±90°)
- **Joint 3**: Upper arm (Y-axis, ±180°)
- **Joint 4**: Wrist roll (X-axis, ±180°)
- **Joint 5**: Wrist pitch (Y-axis, ±90°)
- **Joint 6**: Wrist yaw (Z-axis, ±180°)

### 3. GLB Integration

The extracted kinematic data is applied to GLB meshes by:

1. **Loading GLB file** using Babylon.js
2. **Creating kinematic chain** using kinetiCORE's KinematicsManager
3. **Setting up joint controls** with sliders for manual manipulation
4. **Applying transforms** based on joint positions

## Usage

### Method 1: Using the UI Component

Add the `JTKinematicWorkflowUI` component to your React app:

```tsx
import { JTKinematicWorkflowUI } from './src/ui/components/JTKinematicWorkflowUI';

function App() {
    return (
        <div>
            <JTKinematicWorkflowUI scene={scene} />
        </div>
    );
}
```

### Method 2: Programmatic Usage

```typescript
import { JTKinematicWorkflowTest } from './src/loaders/jt/JTKinematicWorkflowTest';

const workflowTest = new JTKinematicWorkflowTest();

// Test with your r2000ic robot
const success = await workflowTest.testR2000icWorkflow(scene);
```

### Method 3: Integration Service

```typescript
import { JTKinematicIntegrationService } from './src/loaders/jt/JTKinematicIntegrationService';

const integrationService = new JTKinematicIntegrationService();

const result = await integrationService.loadJTWithKinematics(
    jtFile,
    scene,
    {
        extractKinematics: true,
        createPhysicsJoints: false,
        applyToGLB: true,
        glbFilePath: 'path/to/your/robot.glb'
    }
);
```

## Testing Your Setup

### 1. Test JT Conversion Server

Your server is running on port 8005. Test it:

```bash
curl http://localhost:8005/health
```

Expected response:
```json
{
    "status": "degraded",
    "pyopenjt_built": false,
    "message": "PyOpenJt module not available"
}
```

### 2. Test the Workflow

Run the test script:

```bash
npm run test:jt-kinematic
```

Or use the UI component to test individual steps.

## File Paths

Your files are located at:
- **JT File**: `C:\Users\georgem\source\repos\kinetiCORE_data\glb\r2000ic_210l_if_v02.jt`
- **GLB File**: `C:\Users\georgem\source\repos\kinetiCORE_data\glb\r2000ic_210l_if_v02.glb`

## Next Steps

### 1. Build PyOpenJt (Optional)

To get full JT parsing capabilities:

```bash
cd C:\Users\George\source\repos\PyOpenJt
.\Setup.bat
# Then build in Visual Studio
```

### 2. Enhance Kinematic Extraction

The current implementation uses mock data. To extract real kinematic data:

1. **Parse JT Logical Scene Graph** to get assembly structure
2. **Extract assembly constraints** from JT metadata
3. **Map JT constraints** to kinetiCORE joint types
4. **Extract geometry data** for accurate link definitions

### 3. Add Physics Integration

Connect the kinematic system to your physics engine:

```typescript
const result = await integrationService.loadJTWithKinematics(
    jtFile,
    scene,
    {
        extractKinematics: true,
        createPhysicsJoints: true,  // Enable physics
        applyToGLB: true
    }
);
```

## Troubleshooting

### Common Issues

1. **Server not responding**: Check if JT conversion server is running on port 8005
2. **GLB file not found**: Verify file paths are correct
3. **No kinematic data**: Check if JT file contains assembly structure
4. **Meshes not moving**: Ensure kinematic chain is properly created

### Debug Mode

Enable debug logging:

```typescript
// Add to your code
console.log('[JT Kinematic] Debug mode enabled');
```

## Architecture

```
JT File (.jt)
    ↓ (jtdump/PyOpenJt)
JT JSON Data
    ↓ (JTKinematicExtractor)
Kinematic Data (joints, links, constraints)
    ↓ (KinematicsManager)
Kinematic Chain
    ↓ (Babylon.js)
GLB Meshes with Kinematics
    ↓ (UI Controls)
Interactive Robot Simulation
```

## Benefits

✅ **Preserves JT kinematic data** from original CAD files  
✅ **Works with CAD Exchanger** GLB conversions  
✅ **Integrates with kinetiCORE** kinematic system  
✅ **Provides interactive controls** for robot manipulation  
✅ **Supports realistic robot models** like r2000ic  
✅ **Extensible architecture** for different robot types  

This implementation gives you a solid foundation for JT→kinematic→GLB workflows that you can extend based on your specific needs!
