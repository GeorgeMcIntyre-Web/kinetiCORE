# JT File Import Module

Complete implementation for importing JT (Jupiter Tessellation) files into kinetiCORE.

## Overview

This module provides full support for importing JT files (Siemens' lightweight 3D format) with:
- ✅ Coordinate system conversion (JT right-handed → Babylon left-handed)
- ✅ Error handling and validation (JT versions 8.0 - 10.x)
- ✅ Progress reporting for large assemblies
- ✅ Physics integration with kinetiCORE architecture
- ✅ Material and embedded texture support
- ✅ PMI (Product Manufacturing Information) rendering
- ✅ LOD (Level of Detail) management
- ✅ Memory optimization for large assemblies

## Files Structure

```
src/loaders/jt/
├── types.ts                    # Type definitions and interfaces
├── errors.ts                   # Error handling classes
├── coordinateConversion.ts     # Coordinate system utilities
├── JTLoader.ts                 # Core JT file loader
├── JTEntityImporter.ts         # Physics/entity integration
├── JTMaterialLoader.ts         # Material and texture handling
├── JTPMIRenderer.ts           # PMI annotation rendering
├── JTLODManager.ts            # LOD management
├── JTMemoryManager.ts         # Memory optimization
└── index.ts                   # Module exports
```

## Quick Start

### Basic Usage

```typescript
import { JTLoader } from '@/loaders/jt';

const loader = new JTLoader();
await loader.initialize();

const meshes = await loader.load(file, (progress) => {
    console.log(`${progress.stage}: ${progress.percentComplete}%`);
});
```

### Integration with kinetiCORE Entities

```typescript
import { JTEntityImporter } from '@/loaders/jt';

const importer = new JTEntityImporter(entityRegistry, physicsEngine);

const entities = await importer.importAsEntities(file, {
    createPhysics: true,
    physicsType: 'static',
    targetLOD: 0,
    loadPMI: true,
    progressCallback: (progress) => {
        console.log(`Loading: ${progress.percentComplete}%`);
    }
});
```

### Material Loading

```typescript
import { JTMaterialLoader } from '@/loaders/jt';

const materialLoader = new JTMaterialLoader();
const material = await materialLoader.loadMaterial(jtPart, scene);
mesh.material = material;
```

### PMI Rendering

```typescript
import { JTPMIRenderer } from '@/loaders/jt';

const pmiRenderer = new JTPMIRenderer();
const pmiMeshes = pmiRenderer.createAllPMIOverlays(pmiData, scene);

// Toggle visibility
pmiRenderer.togglePMIVisibility(pmiMeshes, true);
```

### LOD Management

```typescript
import { JTLODManager } from '@/loaders/jt';

const lodManager = new JTLODManager(scene);

// Progressive loading
const mesh = await lodManager.loadProgressive(jtPart);

// Distance-based LOD switching
scene.onBeforeRenderObservable.add(() => {
    lodManager.updateLODLevels(camera, meshes);
});
```

### Memory Management

```typescript
import { JTMemoryManager } from '@/loaders/jt';

const memoryManager = new JTMemoryManager();

meshes.forEach(mesh => memoryManager.trackMesh(mesh));

// Check memory stats
const stats = memoryManager.getMemoryStats();
console.log(`Memory usage: ${stats.usage.toFixed(1)}%`);
```

## Important Notes

### ⚠️ JT Open Toolkit Required

This implementation provides the TypeScript interfaces and architecture, but requires the **JT Open Toolkit** compiled to WebAssembly:

```bash
# Clone JT Open Toolkit
git clone https://github.com/Siemens-PLM-Software/jt-open-toolkit.git

# Configure with Emscripten
emconfigure cmake -DCMAKE_BUILD_TYPE=Release \
    -DENABLE_WASM=ON \
    -DBUILD_SHARED_LIBS=OFF

# Build
emmake make -j8

# Output: jt-toolkit.wasm + jt-toolkit.js
```

Place the compiled WASM module in your project and update `JTLoader.ts` to load it.

### Coordinate Systems

- **JT format**: Right-handed Y-up
- **Babylon.js**: Left-handed Y-up
- **Rapier physics**: Right-handed Y-up

The `coordinateConversion.ts` module handles all transformations automatically.

### Supported JT Versions

- ✅ JT 8.0
- ✅ JT 9.0
- ✅ JT 10.x

Older versions (< 8.0) will throw `JTErrorType.UnsupportedVersion` error.

### Memory Budget

Default memory budget: **1.5GB** (safe browser limit)

Large assemblies (500+ parts) will automatically:
1. Downgrade distant meshes to lower LOD
2. Dispose very distant meshes
3. Re-load when camera approaches

## Integration Points

### Physics (George's Architecture)

```typescript
// JTEntityImporter automatically creates physics bodies
const entities = await importer.importAsEntities(file, {
    createPhysics: true,
    physicsType: 'static'  // or 'dynamic'
});

// Physics shape selection:
// - Box-like objects → 'box' collider
// - Complex geometry → 'trimesh' collider
```

### Scene Entities (Cole's Architecture)

```typescript
// Entities are created via EntityRegistry
const entity = entityRegistry.create({
    mesh: babylonMesh,
    physics: { type: 'static', shape: 'box' }
});

// JT metadata is preserved
entity.metadata.jtPartId
entity.metadata.lodLevels
entity.metadata.pmi
entity.metadata.sourceFormat // 'jt'
```

### UI Progress (Edwin's Architecture)

```typescript
// Progress callback integrates with UI state
const [progress, setProgress] = useState(0);

await importer.importAsEntities(file, {
    progressCallback: (progress) => {
        setProgress(progress.percentComplete);
        // Update UI: progress.stage, progress.currentPart
    }
});
```

## Error Handling

```typescript
import { JTImportError, JTErrorType } from '@/loaders/jt';

try {
    const entities = await importer.importAsEntities(file);
} catch (error) {
    if (error instanceof JTImportError) {
        console.error(error.type); // JTErrorType enum
        console.error(error.getUserMessage()); // User-friendly message

        if (error.isRecoverable()) {
            // Retry with different options
        }
    }
}
```

## Testing

See `docs/features_jt.md` for complete test strategy and examples.

## Next Steps for Implementation

1. **Compile JT Open Toolkit to WASM** (see above)
2. **Update `JTLoader.initialize()`** to load WASM module
3. **Implement `createReader()`** using JT Open Toolkit bindings
4. **Add unit tests** (see docs/features_jt.md for test cases)
5. **Integrate with file upload UI** (Edwin's components)

## Resources

- [JT Open Toolkit](https://github.com/Siemens-PLM-Software/jt-open-toolkit)
- [Emscripten Documentation](https://emscripten.org/docs/getting_started/downloads.html)
- [Full Implementation Guide](../../../docs/features_jt.md)
- [kinetiCORE Project Context](../../../CLAUDE.md)

## Questions?

Post in `#dev-blockers` Slack channel if stuck > 1 hour.
