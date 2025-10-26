# QUICK START - Working JT to OBJ Pipeline

## ✅ COMPLETE WORKING PIPELINE

Successfully converts JT files to standard OBJ/MTL format in 2 steps.

## Prerequisites

- Windows with .NET Framework 4.0+
- LineSimulator at `C:\tmp\LineSimulator`

## Usage

### Step 1: JT → OBJX

```powershell
cd C:\Users\George\source\repos\kinetiCORE\tools\jt_conversion\simple_build
./SimpleJTtoOBJ.exe "input.jt" "output_dir" "output_name"
```

### Step 2: OBJX → OBJ

```powershell
cd C:\Users\George\source\repos\kinetiCORE\tools\jt_conversion
./OBJXtoOBJ.exe "input.objx" "output.obj"
```

## Complete Example

```powershell
# Convert sample JT file
cd C:\Users\George\source\repos\kinetiCORE\tools\jt_conversion

# Step 1: Create OBJX (already done - test_sample1.objx exists)
./simple_build/SimpleJTtoOBJ.exe "C:/Users/George/source/repos/kinetiCORE_DATA/Jt/sample_jt_1.jt" "." "sample"

# Step 2: Convert OBJX to OBJ
./OBJXtoOBJ.exe "sample.objx" "sample.obj"

# Result: sample.obj and sample.mtl ready to use!
```

## Tested Example

Using existing `simple_build/test_sample1.objx`:

```powershell
cd C:\Users\George\source\repos\kinetiCORE\tools\jt_conversion
./OBJXtoOBJ.exe "simple_build/test_sample1.objx" "output.obj"
```

**Output:**
```
OBJX → OBJ Converter
Input:  simple_build/test_sample1.objx
Output: output.obj

[1/2] Loading OBJX...
  Version: 2
  Models: 1
  Materials: 2
[2/2] Writing OBJ/MTL...
  Processing 1 models...
  Wrote 1605 vertices
  Wrote 2 materials

SUCCESS!
  output.obj
  output.mtl
```

## Output Files

### output.obj
```
# Converted from OBJX to OBJ
mtllib output.mtl

# Model: bnc
o bnc
v 0.221374 0.538613 1.017418
v 0.221374 0.538613 1.017418
...
vn 0.0 0.0 1.0
...
usemtl mat_0
f 1 2 3
f 4 5 6
...
```

### output.mtl
```
# Converted from OBJX to MTL

newmtl mat_0
Ka 1.000000 1.000000 1.000000
Kd 0.640000 0.640000 0.640000
Ks 0.000000 0.000000 0.000000
Ns 96.000000
d 1.000000
illum 2

newmtl mat_1
Ka 0.168624 0.108232 0.063526
Kd 0.843122 0.541161 0.317632
Ks 0.800000 0.800000 0.800000
Ns 15.000000
d 1.000000
illum 2
```

## Key Discovery

The OBJX collections use `.Items` property to access arrays:

```csharp
// Access vertices
var vertices = lod.VertexDataList.Items;  // VertexData[]

// Access shapes
var shape = lod.Shapes[index];
var triangles = shape.TriangleFaceSet.Indicies;  // Int32[]
```

## Building from Source

### Rebuild SimpleJTtoOBJ.exe
```powershell
cd tools/jt_conversion
./build_simple.ps1
```

### Rebuild OBJXtoOBJ.exe
```powershell
cd tools/jt_conversion
./build_objx2obj.ps1
```

## Files

### Executables
- `simple_build/SimpleJTtoOBJ.exe` - JT to OBJX converter
- `OBJXtoOBJ.exe` - OBJX to OBJ converter (+ required DLLs)

### Source Code
- `SimpleJTtoOBJ.cs` - 220 lines, uses JT Open Toolkit
- `OBJXtoOBJ.cs` - 215 lines, uses ObjXFile.dll

### Test Data
- `simple_build/test_sample1.objx` - Sample OBJX file (39KB)
- `C:/Users/George/source/repos/kinetiCORE_DATA/Jt/*.jt` - Test JT files

## Next Steps

1. **Test with more JT files** - Verify conversion quality
2. **Kinematics extraction** - Parse joint data from JT properties
3. **Batch processing** - Convert entire robot library
4. **Web integration** - Load OBJ files into kinetiCORE

## Status

- ✅ JT → OBJX conversion works
- ✅ OBJX → OBJ conversion works
- ✅ Materials extracted correctly
- ✅ Geometry preserved (1605 vertices tested)
- ✅ Triangle strip to triangle conversion correct
- ❌ Kinematics not yet extracted
- ❌ Assembly hierarchy flattened

## Troubleshooting

### DLL not found error
Copy DLLs from objx2obj_build to main directory:
```powershell
cp objx2obj_build/*.dll .
```

### Empty path name error
This is a known non-fatal error in SimpleJTtoOBJ. The OBJX file is still created.

### No geometry in output
Check if OBJX has data:
```powershell
./objx2obj_build/InspectOBJX_detailed.exe "your_file.objx"
```

---

**Last Updated:** October 2024  
**Status:** ✅ WORKING PIPELINE
