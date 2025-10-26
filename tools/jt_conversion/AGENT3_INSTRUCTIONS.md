# Instructions for Agent 3 (Cursor) - Essential Layout OBJ Import Integration

## Mission
Add OBJ file import capability to the Essential Layout mode with a button in the ribbon.

## Context
- **What's Ready**: Complete JT → OBJX → OBJ conversion pipeline (tested, working)
- **Output Files**: Standard Wavefront OBJ/MTL files in `tools/jt_conversion/output/`
- **Sample Data**: `validated.obj` (1,605 vertices, 2 materials, 107KB)
- **Your Task**: Frontend integration only - add UI button and load OBJ into Babylon scene

## Technical Specs

### OBJ File Format
```
# Standard Wavefront OBJ
v 0.221374 0.538613 1.017418  # Vertex positions (X Y Z)
vn 0.0 0.0 1.0                # Vertex normals
usemtl mat_0                  # Material assignment
f 1 2 3                       # Triangle faces (1-indexed)
```

### MTL File Format
```
newmtl mat_0
Ka 1.0 1.0 1.0     # Ambient
Kd 0.64 0.64 0.64  # Diffuse (main color)
Ks 0.0 0.0 0.0     # Specular
Ns 96.0            # Shininess
d 1.0              # Opacity
illum 2            # Illumination model
```

## Implementation Requirements

### 1. UI Integration (Essential Layout Only)

**Location**: `src/ui/layouts/EssentialModeLayout.tsx`

Add button to ribbon:
```typescript
<Button
  variant="outline"
  size="sm"
  onClick={handleImportOBJ}
>
  Import Robot (OBJ)
</Button>
```

### 2. File Upload Handler

```typescript
const handleImportOBJ = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.obj';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await loadOBJFile(file);
    }
  };
  input.click();
};
```

### 3. Babylon.js OBJ Loader

**IMPORTANT**: Babylon.js has built-in OBJ loader. Use it!

```typescript
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/OBJ'; // OBJ loader plugin

async function loadOBJFile(file: File) {
  const scene = useEditorStore.getState().scene;
  if (!scene) return;

  // Create object URL from file
  const url = URL.createObjectURL(file);
  const fileName = file.name;

  try {
    // Load OBJ file
    const result = await SceneLoader.ImportMeshAsync(
      '',           // meshNames (empty = all)
      url,          // rootUrl
      fileName,     // sceneFilename
      scene,
      undefined,    // onProgress
      '.obj'        // pluginExtension
    );

    // Coordinate system conversion (if needed)
    result.meshes.forEach(mesh => {
      // kinetiCORE uses Z-up, OBJ may use Y-up
      // Check COORDINATE_SYSTEM.md for conversion if needed
      
      mesh.position.y = 0; // Adjust as needed
      mesh.computeWorldMatrix(true);
    });

    // Register with entity system
    const entityRegistry = useEditorStore.getState().entityRegistry;
    result.meshes.forEach(mesh => {
      if (mesh.name !== '__root__') {
        entityRegistry.create({
          mesh,
          physics: { type: 'static' } // Static for now
        });
      }
    });

    console.log(`Loaded ${result.meshes.length} meshes from OBJ`);
    
  } catch (error) {
    console.error('Failed to load OBJ:', error);
    alert('Failed to load OBJ file');
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

### 4. MTL Material Support

MTL files should load automatically if they're in the same directory as the OBJ file. Babylon's OBJ loader handles this.

**If materials don't load:**
```typescript
// Manual material creation from MTL data
import { StandardMaterial } from '@babylonjs/core/Materials';

const material = new StandardMaterial('robotMat', scene);
material.diffuseColor = new Color3(0.64, 0.64, 0.64);
material.specularColor = new Color3(0, 0, 0);
mesh.material = material;
```

## File Locations

### Test Files (Ready to Use)
```
tools/jt_conversion/output/
├── validated.obj (107KB) - Test robot geometry
└── validated.mtl (320B)  - Test materials
```

### Your Files to Edit
```
src/
├── ui/layouts/EssentialModeLayout.tsx  - Add import button
└── services/                           - Create OBJImportService.ts (optional)
```

## Coordinate System Handling

**CRITICAL**: Read `COORDINATE_SYSTEM.md` first!

kinetiCORE uses **Z-up** (CAD/ROS standard). OBJ files may use Y-up.

**Quick conversion:**
```typescript
// If OBJ is Y-up, convert to Z-up
mesh.rotation.x = -Math.PI / 2;  // Rotate -90° around X
mesh.bakeCurrentTransformIntoVertices(); // Bake into geometry
```

## Testing Workflow

1. **Start dev server**: `npm run dev`
2. **Open Essential Layout mode**
3. **Click "Import Robot (OBJ)" button**
4. **Select**: `tools/jt_conversion/output/validated.obj`
5. **Verify**:
   - Mesh appears in scene
   - Materials applied (gray + orange/brown)
   - No console errors
   - Entity registered in scene tree

## Success Criteria

- ✅ Button appears in Essential Layout ribbon
- ✅ File picker opens when clicked
- ✅ OBJ file loads into Babylon scene
- ✅ Materials applied from MTL file
- ✅ Mesh added to entity registry
- ✅ No TypeScript errors
- ✅ No console errors during load

## Common Issues

### "OBJ loader not found"
```bash
npm install @babylonjs/loaders
```

### "Materials not loading"
Ensure MTL file is in same directory as OBJ:
```
validated.obj
validated.mtl  # Must have same base name
```

### "Mesh is invisible"
Check coordinate system and scale:
```typescript
console.log('Mesh bounds:', mesh.getBoundingInfo());
mesh.scaling = new Vector3(0.001, 0.001, 0.001); // If in mm
```

## Future Enhancements (Not Required Now)

- Progress indicator during load
- Multi-file import (batch)
- Material preview before import
- Coordinate system auto-detection
- Unit conversion (mm → m)

## Notes

- **Keep it simple**: Just get the button working and file loading
- **Use Babylon's built-in loader**: Don't write custom OBJ parser
- **Follow existing patterns**: Look at how other loaders work (URDF, USD)
- **Test with provided file**: `validated.obj` is guaranteed to work

## Questions?

Check these files for reference:
- `src/services/USDService.ts` - Example file loader
- `src/services/URDFService.ts` - Example mesh import
- `COORDINATE_SYSTEM.md` - Coordinate conversion details

---

**Agent 1 (Claude Code) has completed the backend conversion pipeline.**  
**Your job: Make it accessible from the UI!**
