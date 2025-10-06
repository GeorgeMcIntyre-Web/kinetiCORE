# DWG Loader for kinetiCORE

Open source AutoCAD DWG file loader using LibreDWG.

## Overview

The DWG loader provides robust loading of AutoCAD DWG files into kinetiCORE's 3D environment. It uses LibreDWG (open source, GNU GPL) via WebAssembly for parsing DWG files directly in the browser.

## Features

- ✅ Open source (LibreDWG - GNU GPL)
- ✅ Browser-based (WebAssembly, no backend required)
- ✅ Supports DWG versions R13 (1994) through R2021
- ✅ Partial support for newer versions with warnings
- ✅ Progress reporting
- ✅ Comprehensive error handling with recovery suggestions
- ✅ Z-up coordinate system (kinetiCORE standard)

## Supported DWG Entities

### Fully Supported
- **LINE** - Straight lines
- **LWPOLYLINE** - Lightweight polylines
- **POLYLINE** - 2D/3D polylines
- **CIRCLE** - Circles
- **ARC** - Circular arcs
- **SPLINE** - Spline curves

### Placeholder Support
- **TEXT/MTEXT** - Text entities (rendered as marker boxes)

### Not Yet Supported
- **INSERT** - Block insertions (needs block definition system)
- **HATCH** - Hatch patterns
- **DIMENSION** - Dimensions
- **3DFACE, 3DSOLID** - 3D solid entities

## Usage

### Basic Usage

```typescript
import { loadDWGFromFile } from '../loaders/dwg';

const result = await loadDWGFromFile(file, scene);
console.log(`Loaded ${result.meshes.length} meshes`);
```

### With Options

```typescript
import { loadDWGFromFile } from '../loaders/dwg';

const result = await loadDWGFromFile(file, scene, {
  // Convert units (e.g., mm to meters)
  unitScale: 0.001,

  // Filter by layer
  layerFilter: ['Mechanical', 'Electrical'],

  // Filter by entity type
  entityTypeFilter: ['LINE', 'LWPOLYLINE', 'CIRCLE'],

  // Progress callback
  onProgress: (progress) => {
    console.log(`${progress.message} (${progress.percent}%)`);
  }
});
```

### Pre-initialization (Optional)

For better UX, pre-load the WASM module during app startup:

```typescript
import { preInitializeDWGLoader } from '../loaders/dwg';

// Call early in app lifecycle
await preInitializeDWGLoader();
```

### Error Handling

```typescript
import { loadDWGFromFile, DWGImportError, DWGErrorType } from '../loaders/dwg';

try {
  const result = await loadDWGFromFile(file, scene);
} catch (error) {
  if (error instanceof DWGImportError) {
    // User-friendly message with recovery suggestions
    console.error(error.getUserMessage());

    // Check if error is recoverable
    if (error.recoverable) {
      // Continue with partial data
    }

    // Check error type
    switch (error.type) {
      case DWGErrorType.UnsupportedVersion:
        // Suggest saving in older format
        break;
      case DWGErrorType.CorruptedFile:
        // Suggest using RECOVER command
        break;
    }
  }
}
```

## Architecture

### Component Structure

```
src/loaders/dwg/
├── DWGLoader.ts              # Main entry point
├── DWGParserService.ts       # LibreDWG wrapper
├── DWGToBabylonConverter.ts  # Entity → Mesh conversion
├── types.ts                  # TypeScript types
├── errors.ts                 # Error classes
└── index.ts                  # Public API exports
```

### Data Flow

```
DWG File
  ↓
DWGParserService (LibreDWG WASM)
  ↓
DwgDatabase (parsed entities)
  ↓
DWGToBabylonConverter
  ↓
Babylon.js Meshes
```

## Error Codes

LibreDWG error codes and their meanings:

| Code | Meaning | Recoverable |
|------|---------|-------------|
| 0 | Success | ✅ |
| 1-3 | Invalid file header/structure | ❌ |
| 8 | Unsupported version | ❌ |
| 68 | Partially supported (newer version) | ⚠️ Yes |
| 16 | Out of memory | ❌ |
| 32 | Read error | ❌ |

## Coordinate System

**DWG files typically use XY plane (Z=0 for 2D drawings).**

kinetiCORE uses Z-up (CAD/ROS standard), so DWG coordinates work directly without conversion. If your DWG uses Y-up, set `convertToZUp: true` in options.

## Limitations

1. **Block Insertions (INSERT entities)** - Not yet supported. Would require implementing a block definition resolution system.

2. **Hatch Patterns** - Complex pattern fills not yet implemented.

3. **Dimensions** - Dimension entities require special rendering logic.

4. **3D Solids** - 3DFACE and 3DSOLID entities not yet supported.

5. **Text Rendering** - Text entities currently render as placeholder boxes. Full text rendering would require a text/font system.

6. **Materials** - DWG material properties not yet mapped to Babylon.js materials.

## Performance

- **Parsing:** Fast (LibreDWG WASM is optimized)
- **WASM Loading:** ~2MB download, one-time initialization
- **Memory:** Efficient (entities processed incrementally)
- **Large Files:** Progress reporting every 100 entities

## Troubleshooting

### "Failed to load LibreDWG WebAssembly module"
- Check browser supports WebAssembly
- Check network connection (WASM file download)
- Try refreshing the page

### "Unsupported DWG version"
- Open in AutoCAD and save as R2013 or earlier format
- Use AutoCAD's SAVEAS command with older version

### "Partially supported version (error 68)"
- This is a warning, not a failure
- Most entities should load correctly
- Some advanced features may not work

### "No entities found"
- Check if DWG file has visible geometry
- Try unfreezing all layers in AutoCAD
- Check if entities are on visible layers

## Dependencies

- **@mlightcad/libredwg-web** - LibreDWG WebAssembly wrapper
- **@babylonjs/core** - 3D rendering

## License

This loader uses LibreDWG which is licensed under GNU GPL v3.

## References

- [LibreDWG Official Site](https://www.gnu.org/software/libredwg/)
- [LibreDWG-Web on npm](https://www.npmjs.com/package/@mlightcad/libredwg-web)
- [AutoCAD DWG Versions](https://knowledge.autodesk.com/support/autocad/learn-explore/caas/sfdcarticles/sfdcarticles/Drawing-file-compatibility.html)
- [kinetiCORE Coordinate System](../../../COORDINATE_SYSTEM.md)

## Contributing

When adding support for new DWG entities:

1. Add entity type to `DWGToBabylonConverter.convertEntity()`
2. Implement conversion method (e.g., `convertHatch()`)
3. Update this README's supported entities list
4. Add test cases
5. Update progress reporting if needed

## Changelog

### v1.0.0 (2025-10-06)
- Initial implementation
- Support for basic 2D entities (LINE, POLYLINE, CIRCLE, ARC, SPLINE)
- Placeholder support for TEXT/MTEXT
- Comprehensive error handling
- Progress reporting
- Unit conversion support
- Layer filtering
