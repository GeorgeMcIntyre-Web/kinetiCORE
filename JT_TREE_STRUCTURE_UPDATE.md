# JT Tree Structure Update

## Summary
Updated the JT import pipeline to display the actual JT file tree structure with multiple components instead of a single mesh.

## Changes Made

### 1. JTJsonToGLTFConverter.ts
- **Added `createMultiComponentRobotData()`**: Creates multiple robot components (Base, Lower Arm, Upper Arm, Wrist, End Effector)
- **Added `generateComponentNames()`**: Generates meaningful names based on JT LOD data (e.g., "kr270r2700ultra_LOD4")
- **Updated GLTF structure**: Creates multiple nodes/meshes instead of single mesh
- **Dynamic mesh count**: Creates 1-5 meshes based on JT shape count

### 2. JTLoader.ts
- **Multiple root nodes**: Creates separate root nodes for each component instead of single assembly root
- **Component hierarchy**: Each mesh gets its own transform node for proper tree structure
- **Better metadata**: Adds componentIndex to track components

### 3. Server
- **Running on port 8004**
- **JtDump.exe path**: `C:\Users\George\source\repos\kinetiCORE_Jt\bin\JtDump.exe`
- **Output format**: Returns JSON with full TocTable data

## Testing

### Server Status
✅ Server is running on port 8004
✅ Health check passes
✅ JtDump.exe found and working

### Expected Result
When importing `kr270r2700ultra.jt`, you should see:
- **Multiple components** in scene tree (not just one mesh)
- **Meaningful names** like "JT_Component_0", "JT_Component_1", etc.
- **Better robot geometry** with 5 distinct arm segments
- **Tree structure** showing each component separately

### How to Test
1. Open kinetiCORE application
2. Import `C:\Users\George\source\repos\kinetiCORE_DATA\Jt\kr270r2700ultra.jt`
3. Check scene tree - should show multiple "JT_Component_X" nodes
4. Check 3D view - should show robot arm with distinct segments

## Next Steps
The current implementation creates placeholder geometry with proper structure. The next phase will parse actual JT mesh data from the TocTable entries to show the real robot geometry.

