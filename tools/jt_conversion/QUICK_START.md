# Quick Start: JT/PSZ to kinetiCORE Pipeline

**Complete workflow from Tecnomatix robot library to working kinematics in kinetiCORE.**

---

## 30-Second Overview

```
Tecnomatix Library (JT/PSZ files)
    ↓
LineSimConverterRobust.exe (batch conversion)
    ↓
OBJ + JSON files (geometry + kinematics)
    ↓
kinetiCORE "Load File" button
    ↓
Working robot with animated joints!
```

---

## Step 1: Validate Environment (2 minutes)

```bash
cd C:\Users\George\source\repos\kinetiCORE\tools\jt_conversion
.\validate_environment.bat
```

**Expected output:**
```
✓ .NET Framework 4.8 detected
✓ C# compiler found
✓ LineSimulator installation verified
✓ All 20 required DLLs found
✓ Sufficient disk space (50+ GB available)
```

**If validation fails:** See [PREFLIGHT_CHECKLIST.md](PREFLIGHT_CHECKLIST.md) for troubleshooting.

---

## Step 2: Build Converter (3 minutes)

```bash
.\build_converter_robust.bat
```

**Expected output:**
```
[5/6] Compiling LineSimConverterRobust.cs
      ✓ Compilation successful

[6/6] Testing Executable
      ✓ Executable runs

Build Complete!
Executable: .\converter_build_robust\LineSimConverterRobust.exe
```

**Location:** `converter_build_robust\LineSimConverterRobust.exe` + 20 DLLs

---

## Step 3: Test with Single Robot (1 minute)

```bash
cd converter_build_robust

# Find a test robot (KUKA example)
dir C:\tmp\LineSimulator\*.jt /s

# Convert single file
.\LineSimConverterRobust.exe --jt "C:\path\to\kr5_arc.jt" test_robot.obj --verbose
```

**Expected output:**
```
[INFO] Converting: kr5_arc.jt → test_robot.obj
[INFO] Parsing JT file...
[INFO] Extracting geometry...
[INFO] Writing OBJ file... (1,234 vertices, 2,456 faces)
[INFO] Writing MTL file...
[INFO] Extracting kinematics...
[INFO] Writing kinematics JSON... (6 DOF, 6 joints)
[SUCCESS] ✓ Converted in 2.3 seconds

Output files:
  test_robot.obj               (mesh geometry)
  test_robot.mtl               (materials)
  test_robot.kinematics.json   (joint data)
```

**Verify files exist:**
```bash
dir test_robot.*
# Should show: test_robot.obj, test_robot.mtl, test_robot.kinematics.json
```

---

## Step 4: Batch Convert Library (1-3 hours)

### **Small Test (10 robots):**
```bash
.\LineSimConverterRobust.exe --batch "C:\RobotLibrary\KUKA\KR5" "C:\WebRobots\KUKA\KR5" --parallel 4
```

### **Full Library (all manufacturers):**
```bash
# Create output directory
mkdir C:\WebRobots

# Convert all robots (parallel processing with 8 workers)
.\LineSimConverterRobust.exe --batch "C:\RobotLibrary" "C:\WebRobots" --parallel 8 --log batch_conversion.log

# Monitor progress (in separate terminal)
tail -f batch_conversion.log
```

**Expected performance:**
- **100 robots:** 5-10 minutes
- **1000 robots:** 50-100 minutes
- **2000 robots:** 1.5-3 hours

**Output structure:**
```
C:\WebRobots\
├── KUKA\
│   ├── kr5_arc\
│   │   ├── kr5_arc.obj
│   │   ├── kr5_arc.mtl
│   │   └── kr5_arc.kinematics.json
│   ├── kr270_r2700\
│   │   └── ...
├── FANUC\
│   ├── m10ia\
│   ├── m20ia\
│   └── r2000ic\
├── ABB\
└── Kawasaki\
```

---

## Step 5: Load in kinetiCORE (10 seconds)

### **In kinetiCORE UI:**

1. **Open kinetiCORE** → Essential Mode
2. **Click "Load File"** button in ribbon toolbar (Import category, FileUp icon)
3. **Select converted robot:**
   - Navigate to `C:\WebRobots\KUKA\kr5_arc\`
   - Select `kr5_arc.obj`
   - Click "Open"

4. **Robot loads automatically** with working kinematics!

### **What happens under the hood:**

```typescript
// RibbonToolbar.tsx detects .obj file
const ext = file.name.toLowerCase();
if (ext.endsWith('.obj')) {

  // RobotOBJLoader.ts automatically handles it
  const robot = await loadRobotOBJ(file, scene);

  // Looks for kr5_arc.kinematics.json in same directory
  // Builds joint hierarchy from JSON
  // Creates Babylon.js mesh with working joints
}
```

---

## Step 6: Animate Robot (in kinetiCORE)

### **Using the Robot:**

Once loaded, you can programmatically control joints:

```typescript
import { setJointAngle, moveToPose, getJointAngles } from 'src/loaders/obj/RobotOBJLoader';

// Move individual joint
setJointAngle(robot, 0, 45);  // J1 to 45 degrees
setJointAngle(robot, 1, -30); // J2 to -30 degrees

// Move to predefined pose
moveToPose(robot, 'HOME');  // Home position
moveToPose(robot, 'PARK');  // Park position

// Get current joint angles
const angles = getJointAngles(robot);
console.log('Current pose:', angles); // [45, -30, 0, 0, 0, 0]
```

**Available poses** (from kinematics.json):
- `HOME` - Home position (all joints at 0°)
- `PARK` - Park position (compact storage)
- `READY` - Ready position for operation
- `APPROACH` - Approach position for picking

---

## Troubleshooting

### **Issue: "No kinematics found"**

**Problem:** OBJ file has no matching `.kinematics.json` file

**Solution:**
```bash
# Check if JSON was created during conversion
dir C:\WebRobots\KUKA\kr5_arc\

# Should show:
#   kr5_arc.obj
#   kr5_arc.mtl
#   kr5_arc.kinematics.json  ← Must exist!

# If missing, re-run conversion with --verbose to see why
.\LineSimConverterRobust.exe --jt "input.jt" "output.obj" --verbose
```

### **Issue: "Failed to load JT file"**

**Problem:** JT version not supported or file corrupted

**Solution:**
```bash
# Check JT version
xxd input.jt | head -1
# Should show: "Version 9" or "Version 10"

# Try PSZ file instead (always works)
.\LineSimConverterRobust.exe --psz "input.psz" "output.obj"
```

### **Issue: "DLL not found"**

**Problem:** Running converter outside of `converter_build_robust` directory

**Solution:**
```bash
# ALWAYS run from build directory
cd C:\Users\George\source\repos\kinetiCORE\tools\jt_conversion\converter_build_robust
.\LineSimConverterRobust.exe ...
```

---

## Performance Tips

### **Maximize Speed:**

1. **Use SSD storage** for input/output directories
2. **Increase worker count** on powerful machines:
   ```bash
   --parallel 16  # For 16-core CPU
   ```
3. **Resume interrupted batches:**
   ```bash
   --resume  # Skips already-converted files
   ```

### **Reduce Disk Usage:**

1. **Convert only needed models:**
   ```bash
   # Only convert KUKA KR5 series
   .\LineSimConverterRobust.exe --batch "C:\RobotLibrary\KUKA\KR5" ...
   ```

2. **Delete source JT files after conversion** (if you have backups!)

---

## Next Steps

### **Immediate:**
- ✅ Validate environment
- ✅ Build converter
- ✅ Test single robot
- ✅ Load in kinetiCORE
- ✅ Verify kinematics work

### **Production Deployment:**
1. Batch convert entire library overnight
2. Host converted robots on file server or CDN
3. Update kinetiCORE to point to robot library path
4. Train users on "Load File" workflow

### **Future Enhancements:**
- **GLB export** (smaller files, faster loading)
- **URDF generation** (ROS compatibility)
- **Collision geometry** (simplified physics meshes)
- **Web-based converter** (no local installation needed)

---

## File Locations Reference

| Component | Location |
|-----------|----------|
| **Converter source** | `tools/jt_conversion/LineSimConverterRobust.cs` |
| **Build script** | `tools/jt_conversion/build_converter_robust.bat` |
| **Executable** | `tools/jt_conversion/converter_build_robust/LineSimConverterRobust.exe` |
| **OBJ Loader** | `src/loaders/obj/RobotOBJLoader.ts` |
| **Documentation** | `docs/TECNOMATIX_JT_TO_OBJ_PIPELINE.md` |
| **Preflight checklist** | `tools/jt_conversion/PREFLIGHT_CHECKLIST.md` |
| **Full README** | `tools/jt_conversion/README.md` |

---

## Support

**If you get stuck:**

1. Check [PREFLIGHT_CHECKLIST.md](PREFLIGHT_CHECKLIST.md) for environment issues
2. Check [README.md](README.md) for detailed command reference
3. Check [TECNOMATIX_JT_TO_OBJ_PIPELINE.md](../../docs/TECNOMATIX_JT_TO_OBJ_PIPELINE.md) for architecture details
4. Review logs in `conversion.log` (created during batch conversion)

---

## Success Criteria

**You're ready for production when:**

- ✅ `validate_environment.bat` passes all checks
- ✅ Single robot converts successfully with kinematics
- ✅ Batch conversion completes without critical errors
- ✅ Robot loads in kinetiCORE with "Load File" button
- ✅ Joint animation works (use `setJointAngle()`)
- ✅ Conversion speed ≥ 20 robots/minute (with 8 workers)

**Go/No-Go Decision:**
- **GO:** >95% conversion success rate on test batch
- **NO-GO:** <90% success rate → investigate failures first

---

**Last Updated:** 2025-10-25
**Status:** Production Ready
**Tested:** LineSimulator v2.x, .NET Framework 4.8, Windows 10/11

**Start converting NOW:**
```bash
cd tools\jt_conversion
.\validate_environment.bat && .\build_converter_robust.bat
cd converter_build_robust
.\LineSimConverterRobust.exe --jt "C:\path\to\robot.jt" test.obj --verbose
```
